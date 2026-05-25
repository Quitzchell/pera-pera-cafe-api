import {Body, Controller, Post} from '@nestjs/common';
import {CreateSessionDto} from './dto/create-session.dto';
import {SessionsService} from './sessions.service';

@Controller('sessions')
export class SessionsController {
    constructor(private readonly sessionsService: SessionsService) {
    }

    @Post()
    create(@Body() createSessionDto: CreateSessionDto) {
        return this.sessionsService.create(createSessionDto);
    }
}
