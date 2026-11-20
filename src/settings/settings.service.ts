import { Injectable } from '@nestjs/common'
import { JlptLevel } from '../../generated/prisma/client'
import { ALL_FORMS } from '../conjugation'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateSettingsDto } from './dto/update-settings.dto'

const DEFAULTS = {
  enabledForms: [...ALL_FORMS],
  jlptLevels: [JlptLevel.N5, JlptLevel.N4],
  romajiInput: false,
  showFurigana: true,
  timeZone: 'UTC',
}

const select = {
  enabledForms: true,
  jlptLevels: true,
  romajiInput: true,
  showFurigana: true,
  timeZone: true,
}

// shortcut: the live frontend still reads roundSize; once the redesigned frontend is released, drop it from the API and drop the unused UserSettings.roundSize column.
const LEGACY = { roundSize: 5 }

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId }, select })
    return { ...(settings ?? DEFAULTS), ...LEGACY }
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const { enabledForms, jlptLevels, romajiInput, showFurigana, timeZone } = dto
    const changes = { enabledForms, jlptLevels, romajiInput, showFurigana, timeZone }
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as Partial<typeof DEFAULTS>
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { ...DEFAULTS, ...defined, userId },
      update: changes,
      select,
    })
    return { ...settings, ...LEGACY }
  }
}
