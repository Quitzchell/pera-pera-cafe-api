import { Injectable } from '@nestjs/common'
import { JlptLevel } from '../../generated/prisma/client'
import { ALL_FORMS } from '../conjugation'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateSettingsDto } from './dto/update-settings.dto'

const select = {
  enabledForms: true,
  jlptLevels: true,
  roundSize: true,
  romajiInput: true,
  showFurigana: true,
  timeZone: true,
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get(userId: string) {
    return this.update(userId, {})
  }

  update(userId: string, dto: UpdateSettingsDto) {
    const { enabledForms, jlptLevels, roundSize, romajiInput, showFurigana, timeZone } = dto
    const changes = { enabledForms, jlptLevels, roundSize, romajiInput, showFurigana, timeZone }
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        ...changes,
        userId,
        enabledForms: enabledForms ?? [...ALL_FORMS],
        jlptLevels: jlptLevels ?? [JlptLevel.N5, JlptLevel.N4],
      },
      update: changes,
      select,
    })
  }
}
