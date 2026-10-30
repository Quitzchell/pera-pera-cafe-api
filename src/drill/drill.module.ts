import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { DrillController } from './drill.controller'
import { DrillService } from './drill.service'

@Module({
  imports: [SettingsModule],
  controllers: [DrillController],
  providers: [DrillService],
})
export class DrillModule {}
