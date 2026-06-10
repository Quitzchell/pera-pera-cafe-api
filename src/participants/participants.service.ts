import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '../../generated/prisma/client'
import { JoinSessionDto } from './dto/join-session.dto'

type ParticipantWithSession = Prisma.ParticipantGetPayload<{ include: { session: true } }>

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(sessionId: string, participantId: string) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, session_id: sessionId },
      include: { session: true },
    })

    if (!participant) {
      throw new NotFoundException('Participant not found')
    }

    return this.toResponse(participant)
  }

  async join(sessionId: string, dto: JoinSessionDto) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      throw new NotFoundException('Session not found')
    }

    if (!session.languages.includes(dto.nativeLanguage)) {
      throw new BadRequestException(
        `Native language must be one of: ${session.languages.join(', ')}`,
      )
    }

    const participant = await this.prisma.participant.create({
      data: {
        session_id: sessionId,
        name: dto.displayName,
        native_language: dto.nativeLanguage,
        proficiency_levels: dto.proficiencyLevels,
        is_host: false,
      },
      include: { session: true },
    })

    return this.toResponse(participant)
  }

  private toResponse(participant: ParticipantWithSession) {
    const targetLanguage = participant.session.languages.find(
      (l) => l !== participant.native_language,
    )

    return {
      id: participant.id,
      sessionId: participant.session_id,
      name: participant.name,
      nativeLanguage: participant.native_language,
      targetLanguage,
      proficiencyLevels: participant.proficiency_levels,
      isHost: participant.is_host,
      joinedAt: participant.joined_at,
      leftAt: participant.left_at,
    }
  }
}
