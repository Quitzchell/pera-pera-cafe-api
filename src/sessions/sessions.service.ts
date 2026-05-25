import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { generateJoinCode } from './utils/generate-join-code';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSessionDto) {
    const { title, targetLanguage, sourceLanguage, host } = dto;
    const session = await this.prisma.session.create({
      data: {
        title,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        join_code: generateJoinCode(),
        participants: {
          create: {
            name: host.displayName,
            native_language: host.nativeLanguage,
            target_language: targetLanguage,
            proficiency_levels: host.proficiencyLevels,
            is_host: true,
          },
        },
      },
      include: { participants: true },
    });

    const hostParticipant = session.participants.find((p) => p.is_host)!;

    return {
      session: { id: session.id, title: session.title },
      participant: { id: hostParticipant.id },
    };
  }
}