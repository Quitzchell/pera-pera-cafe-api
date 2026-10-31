import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { CurrentSession } from '../auth/auth.decorators'
import type { SignedIn } from '../auth/auth.service'
import { ExportQueryDto } from './dto/export-query.dto'
import {
  exportRow,
  flattenMistake,
  MISTAKE_COLUMNS,
  RULE_PROGRESS_COLUMNS,
  toCsv,
} from './progress-stats'
import { ProgressService } from './progress.service'

@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  summary(@CurrentSession() session: SignedIn) {
    return this.progress.summary(session.user.id)
  }

  @Get('export')
  async export(
    @CurrentSession() session: SignedIn,
    @Query() { format }: ExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.attachment(`progress.${format}`)
    if (format === 'json') {
      return this.progress.exportJson(session.user.id)
    }
    const rows = await this.progress.ruleGroups(session.user.id)
    return toCsv(RULE_PROGRESS_COLUMNS, rows.map(exportRow))
  }

  @Get('export/mistakes')
  async exportMistakes(
    @CurrentSession() session: SignedIn,
    @Res({ passthrough: true }) response: Response,
  ) {
    const mistakes = await this.progress.recentMistakes(session.user.id)
    response.attachment('mistakes.csv')
    return toCsv(MISTAKE_COLUMNS, mistakes.map(flattenMistake))
  }
}
