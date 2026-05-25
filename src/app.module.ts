import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ParticipantsModule } from './participants/participants.module';
import {SessionsModule} from "./sessions/sessions.module";

@Module({
  imports: [ParticipantsModule, SessionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
