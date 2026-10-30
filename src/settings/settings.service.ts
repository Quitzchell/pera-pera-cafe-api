import { Injectable } from '@nestjs/common'
import { JlptLevel } from '../../generated/prisma/client'
import { ALL_FORMS } from '../conjugation'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateSettingsDto } from './dto/update-settings.dto'

const DEFAULTS = {
  enabledForms: [...ALL_FORMS],
  jlptLevels: [JlptLevel.N5, JlptLevel.N4],
  roundSize: 20,
  romajiInput: false,
  showFurigana: true,
  timeZone: 'UTC',
}

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

  async get(userId: string) {
    return (await this.prisma.userSettings.findUnique({ where: { userId }, select })) ?? DEFAULTS
  }

  update(userId: string, dto: UpdateSettingsDto) {
    const { enabledForms, jlptLevels, roundSize, romajiInput, showFurigana, timeZone } = dto
    const changes = { enabledForms, jlptLevels, roundSize, romajiInput, showFurigana, timeZone }
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as Partial<typeof DEFAULTS>
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { ...DEFAULTS, ...defined, userId },
      update: changes,
      select,
    })
  }
}
