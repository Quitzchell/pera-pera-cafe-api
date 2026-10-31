import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { CurrentSession } from '../auth/auth.decorators'
import type { SignedIn } from '../auth/auth.service'
import { ExportQueryDto } from './dto/export-query.dto'
import { toCsv } from './progress-stats'
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
    return format === 'csv'
      ? toCsv(await this.progress.ruleGroups(session.user.id))
      : this.progress.exportJson(session.user.id)
  }
}
