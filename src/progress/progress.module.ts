import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { ProgressController } from './progress.controller'
import { ProgressService } from './progress.service'

@Module({
  imports: [SettingsModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
