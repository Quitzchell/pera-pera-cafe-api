import { Body, Controller, Get, Patch } from '@nestjs/common'
import { CurrentSession } from '../auth/auth.decorators'
import type { SignedIn } from '../auth/auth.service'
import { UpdateSettingsDto } from './dto/update-settings.dto'
import { SettingsService } from './settings.service'

@Controller('me/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentSession() session: SignedIn) {
    return this.settings.get(session.user.id)
  }

  @Patch()
  update(@CurrentSession() session: SignedIn, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(session.user.id, dto)
  }
}
