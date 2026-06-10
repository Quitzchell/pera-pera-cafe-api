import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { SessionsModule } from './sessions/sessions.module'
import { ParticipantsModule } from './participants/participants.module'

@Module({
  imports: [PrismaModule, SessionsModule, ParticipantsModule],
})
export class AppModule {}
