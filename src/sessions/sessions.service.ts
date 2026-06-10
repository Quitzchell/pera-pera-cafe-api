import {BadRequestException, ForbiddenException, Injectable, NotFoundException} from '@nestjs/common'
import {PrismaService} from '../prisma/prisma.service'
import {CreateSessionDto} from './dto/create-session.dto'
import {generateJoinCode} from './utils/generate-join-code'
import {SessionStatus} from "../../generated/prisma/enums";

@Injectable()
export class SessionsService {
    constructor(private readonly prisma: PrismaService) {
    }

    async create(dto: CreateSessionDto) {
        if (dto.host.nativeLanguage === dto.targetLanguage) {
            throw new BadRequestException('Native and target language must differ')
        }

        const languages = [dto.targetLanguage, dto.host.nativeLanguage].sort()

        const session = await this.prisma.session.create({
            data: {
                title: dto.title,
                languages,
                join_code: generateJoinCode(),
                participants: {
                    create: {
                        name: dto.host.displayName,
                        native_language: dto.host.nativeLanguage,
                        proficiency_levels: dto.host.proficiencyLevels,
                        is_host: true,
                    },
                },
            },
            include: {
                participants: {where: {is_host: true}},
            },
        })
        const host = session.participants[0]
        return {
            session: {id: session.id, title: session.title, languages: session.languages},
            participant: {id: host.id},
        }
    }

    async findOne(sessionId: string) {
        const session = await this.prisma.session.findUnique({
            where: {id: sessionId},
        })

        if (!session) {
            throw new NotFoundException('Session not found')
        }

        return {
            id: session.id,
            title: session.title,
            languages: session.languages,
        }
    }

    async startSession(sessionId: string, actorId: string) {
        const session = await this.prisma.session.findUnique({where: {id: sessionId}})
        if (!session) throw new NotFoundException('Session not found')
        if (session.status !== SessionStatus.pending) {
            throw new BadRequestException(`Session is already ${session.status}`)
        }

        const actor = await this.prisma.participant.findFirst({
            where: {
                id: actorId,
                session_id: sessionId,
                is_host: true
            }
        })
        if (!actor) throw new ForbiddenException('Only the host can start the session')

        await this.prisma.$transaction([
            this.prisma.session.update({
                where: {id: sessionId},
                data: {status: SessionStatus.active}
            }),
            this.prisma.sessionEvent.create({
                data: {session_id: sessionId, type: 'session_started', actor_id: actorId},
            })
        ])
    }

    async endSession(sessionId: string, actorId: string) {
        const session = await this.prisma.session.findUnique({where: {id: sessionId}})
        if (!session) throw new NotFoundException('Session not found')
        if (session.status === SessionStatus.ended) {
            throw new BadRequestException(`Session is already ended`)
        }

        const actor = await this.prisma.participant.findFirst({
            where: {
                id: actorId,
                session_id: sessionId,
                is_host: true
            }
        })
        if (!actor) throw new ForbiddenException('Only the host can end the session')

        await this.prisma.$transaction([
            this.prisma.session.update({
                where: {id: sessionId},
                data: {status: SessionStatus.ended, ended_at: new Date()}
            }),
            this.prisma.sessionEvent.create({
                data: {session_id: sessionId, type: 'session_ended', actor_id: actorId},
            })
        ])
    }


}
