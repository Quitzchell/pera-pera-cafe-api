import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { CurrentSession } from '../auth/auth.decorators'
import type { SignedIn } from '../auth/auth.service'
import { ExportQueryDto } from './dto/export-query.dto'
import { exportRow, toCsv } from './progress-stats'
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
    const rows = await this.progress.ruleGroups(session.user.id)
    response.attachment(`progress.${format}`)
    return format === 'csv' ? toCsv(rows) : rows.map(exportRow)
  }
}
