import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { SessionsModule } from './sessions/sessions.module'
import { ParticipantsModule } from './participants/participants.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [PrismaModule, SessionsModule, ParticipantsModule, HealthModule],
})
export class AppModule {}
