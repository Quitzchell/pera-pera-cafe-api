import {Module} from '@nestjs/common'
import {SessionsController} from './sessions.controller'
import {SessionsService} from './sessions.service'
import {SessionsGateway} from './sessions.gateway'
import {GameplayService} from "./gameplay.service";

@Module({
    controllers: [SessionsController],
    providers: [SessionsService, GameplayService, SessionsGateway],
})
export class SessionsModule {
}
