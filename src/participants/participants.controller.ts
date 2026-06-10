import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ParticipantsService } from './participants.service'
import { JoinSessionDto } from './dto/join-session.dto'

@Controller('sessions/:sessionId/participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  join(@Param('sessionId') sessionId: string, @Body() dto: JoinSessionDto) {
    return this.participantsService.join(sessionId, dto)
  }

  @Get(':participantId')
  findOne(@Param('sessionId') sessionId: string, @Param('participantId') participantId: string) {
    return this.participantsService.findOne(sessionId, participantId)
  }
}
