import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SessionsController } from './sessions/sessions.controller';
import { ParticipantsModule } from './participants/participants.module';
import {SessionsModule} from "./sessions/sessions.module";

@Module({
  imports: [ParticipantsModule, SessionsModule],
  controllers: [AppController, SessionsController],
  providers: [AppService],
})
export class AppModule {}
