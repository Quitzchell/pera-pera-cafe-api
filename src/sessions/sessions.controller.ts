import { Body, Controller, Post } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionsService } from './sessions.service';
import { Session } from './interfaces/session';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionService: SessionsService) {}

  @Post()
  async create(@Body() createSessionDto: CreateSessionDto): Promise<Session> {
    return this.sessionService.create(createSessionDto);
  }
}
