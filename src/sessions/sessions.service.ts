import { Injectable } from '@nestjs/common';
import { Session } from './interfaces/session';
import { CreateSessionDto } from './dto/create-session.dto';
import { generateJoinCode } from './utils/generate-join-code';

@Injectable()
export class SessionsService {
  private readonly sessions: Session[] = [];

  create(dto: CreateSessionDto) {
    const session: Session = {
      ...dto,
      join_code: generateJoinCode(),
      status: 'pending',
      ended_at: null,
    };
    this.sessions.push(session);
    return session;
  }
}
