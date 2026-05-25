import {Injectable} from '@nestjs/common';
import {PrismaService} from "../prisma/prisma.service";
import {CreateSessionDto} from './dto/create-session.dto';
import {generateJoinCode} from './utils/generate-join-code';

@Injectable()
export class SessionsService {
    constructor(private readonly prisma: PrismaService) {
    }

    create(dto: CreateSessionDto) {
        return this.prisma.session.create({
            data: {...dto, join_code: generateJoinCode()}
        })
    }
}
