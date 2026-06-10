import {BadRequestException, ForbiddenException, Injectable, NotFoundException} from "@nestjs/common";
import {PrismaService} from "../prisma/prisma.service";
import {Prisma, SessionStatus} from "../../generated/prisma/client";

type DrawCardResult = {
    cardId: string
    question: string
    translations: Array<{ language: string, translation: string, romanization: string | null }>
    targetParticipantId: string,
    practiceLanguage: string,
}

type CurrentCardState = {
    cardId: string
    targetParticipantId: string,
    practiceLanguage: string,
} | null

@Injectable()
export class GameplayService {
    constructor(private readonly prisma: PrismaService) {
    }

    async getCurrentDealer(sessionId: string): Promise<string> {
        const latestTurnPassed = await this.prisma.sessionEvent.findFirst({
            where: {session_id: sessionId, type: 'turn_passed'},
            orderBy: {created_at: 'desc'}
        })
        if (latestTurnPassed) {
            const payload = latestTurnPassed.payload as Prisma.JsonObject
            return payload.next_participant_id as string
        }
        // Fallback: host
        const host = await this.prisma.participant.findFirst({
            where: {session_id: sessionId, is_host: true},
        })
        if (!host) throw new NotFoundException('Session has no host')
        return host.id
    }

    async getCurrentCard(sessionId: string): Promise<CurrentCardState> {
        const latest = await this.prisma.sessionEvent.findFirst({
            where: {
                session_id: sessionId,
                type: {in: ['card_drawn', 'card_skipped', 'turn_passed']},
            },
            orderBy: {created_at: 'desc'}
        })
        if (!latest || latest.type !== 'card_drawn') return null

        const payload = latest.payload as Prisma.JsonObject
        return {
            cardId: payload.card_id as string,
            targetParticipantId: payload.target_participant_id as string,
            practiceLanguage: payload.practice_language as string,
        }
    }

    // ────── Actions ──────

    async drawCard(sessionId: string, actorId: string, targetId: string): Promise<DrawCardResult> {
        await this.assertActive(sessionId)
        await this.assertDealer(sessionId, actorId)

        if (actorId === targetId) {
            throw new BadRequestException('Cannot draw a card for yourself')
        }

        const target = await this.prisma.participant.findFirst({
            where: {id: targetId, session_id: sessionId},
            include: {session: true},
        })
        if (!target) throw new NotFoundException('Target not found in this session')

        // Determine practice language: the other half of the pair form the target's native
        const practiceLanguage = target.session.languages.find((l) => l !== target.native_language)
        if (!practiceLanguage) throw new BadRequestException('Cannot determine practice language')

        // Find untouched cards matching target's proficiency
        const drawnIds = await this.getDrawnCardsId(sessionId)
        const candidates = await this.prisma.card.findMany({
            where: {
                proficiency_level: {in: target.proficiency_levels},
                ...(drawnIds.length > 0 ? {id: {notIn: drawnIds}} : {})
            },
            select: {id: true}
        })
        if (candidates.length === 0) {
            throw new NotFoundException('No more cards available for this target')
        }

        const pickedId = candidates[Math.floor(Math.random() * candidates.length)].id
        const card = await this.prisma.card.findUniqueOrThrow({
            where: {id: pickedId},
            include: {translations: true}
        })

        await this.prisma.sessionEvent.create({
            data: {
                session_id: sessionId,
                type: 'card_drawn',
                actor_id: actorId,
                payload: {
                    card_id: card.id,
                    target_participant_id: targetId,
                    practice_language: practiceLanguage,
                }
            }
        })

        return this.toDrawResult(card, targetId, practiceLanguage)
    }

    async skipCard(sessionId: string, actorId: string): Promise<DrawCardResult> {
        await this.assertActive(sessionId)
        await this.assertDealer(sessionId, actorId)

        const current = await this.getCurrentCard(sessionId)
        if (!current) throw new BadRequestException('No card to skip')

        await this.prisma.sessionEvent.create({
            data: {
                session_id: sessionId,
                type: 'card_skipped',
                actor_id: actorId,
                payload: {card_id: current.cardId}
            }
        })

        // Auto-draw a new card for the same target
        return this.drawCard(sessionId, actorId, current.targetParticipantId)
    }

    async passTurn(sessionId: string, actorId: string): Promise<{ nextDealerId: string }> {
        await this.assertActive(sessionId)
        await this.assertDealer(sessionId, actorId)

        const current = await this.getCurrentCard(sessionId)
        if (!current) throw new BadRequestException('Cannot pass turn without a drawn card')

        const nextDealerId = current.targetParticipantId

        await this.prisma.sessionEvent.create({
            data: {
                session_id: sessionId,
                type: 'turn_passed',
                actor_id: actorId,
                payload: {next_participant_id: nextDealerId, previous_dealer_id: actorId},
            }
        })

        return {nextDealerId}
    }

    // ────── Guards ──────

    private async assertActive(sessionId: string) {
        const session = await this.prisma.session.findUnique({where: {id: sessionId}})
        if (!session) throw new NotFoundException('Session not found')
        if (session.status !== SessionStatus.active) {
            throw new BadRequestException(`Session is ${session.status}, not active`)
        }
    }

    private async assertDealer(sessionId: string, actorId: string) {
        const dealerId = await this.getCurrentDealer(sessionId)
        if (dealerId !== actorId) {
            throw new ForbiddenException('Only the current dealer can perform this action')
        }
    }

    private async getDrawnCardsId(sessionId: string): Promise<string[]> {
        const events = await this.prisma.sessionEvent.findMany({
            where: {session_id: sessionId, type: 'card_drawn'},
            select: {payload: true}
        })
        return events
            .map((e) => (e.payload as Prisma.JsonObject).card_id as string)
            .filter((id): id is string => !!id)
    }

    private toDrawResult(
        card: {
            id: string,
            question: string,
            translations: Array<{ language: string; translation: string; romanization: string | null }>
        },
        targetId: string,
        practiceLanguage: string
    ): DrawCardResult {
        return {
            cardId: card.id,
            question: card.question,
            translations: card.translations.map((t) => ({
                language: t.language,
                translation: t.translation,
                romanization: t.romanization
            })),
            targetParticipantId: targetId,
            practiceLanguage
        }
    }
}