import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { SessionsService } from './sessions.service'
import { CreateSessionDto } from './dto/create-session.dto'

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionService: SessionsService) {}

  @Post()
  create(@Body() body: CreateSessionDto) {
    return this.sessionService.create(body)
  }

  @Get(':sessionId')
  findOne(@Param('sessionId') sessionId: string) {
    return this.sessionService.findOne(sessionId)
  }
}
