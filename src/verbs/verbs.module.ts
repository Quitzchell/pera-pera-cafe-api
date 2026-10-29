import { Module } from '@nestjs/common'
import { VerbsController } from './verbs.controller'
import { VerbsService } from './verbs.service'

@Module({
  controllers: [VerbsController],
  providers: [VerbsService],
})
export class VerbsModule {}
