import {Test, TestingModule} from '@nestjs/testing';
import {SessionsController} from './sessions.controller';
import {SessionsService} from "./sessions.service";
import {PrismaService} from "../prisma/prisma.service";

describe('SessionsController', () => {
    let controller: SessionsController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SessionsController],
            providers: [
                SessionsService,
                {provide: PrismaService, useValue: {session: {create: jest.fn()}}},
            ],
        }).compile();

        controller = module.get<SessionsController>(SessionsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
