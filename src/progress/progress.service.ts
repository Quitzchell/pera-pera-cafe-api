import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { accuracy, currentStreak, localDate, RuleGroupStats, weakestFirst } from './progress-stats'

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async summary(userId: string) {
    const [{ timeZone }, ruleGroups, rounds] = await Promise.all([
      this.settings.get(userId),
      this.ruleGroups(userId),
      // shortcut: reads every finished round; fine for years of daily practice, move the
      // date grouping into SQL if it ever gets slow.
      this.prisma.drillRound.findMany({
        where: { userId, finishedAt: { not: null } },
        select: { finishedAt: true },
      }),
    ])
    const today = localDate(new Date(), timeZone)
    const attempts = ruleGroups.reduce((sum, row) => sum + row.attemptCount, 0)
    const correct = ruleGroups.reduce((sum, row) => sum + row.correctCount, 0)
    const roundDays = new Set(
      rounds.flatMap(({ finishedAt }) => (finishedAt ? [localDate(finishedAt, timeZone)] : [])),
    )

    return {
      totals: {
        attempts,
        correct,
        accuracy: accuracy(correct, attempts),
        roundsFinished: rounds.length,
        dueToday: ruleGroups.filter((row) => localDate(row.dueAt, timeZone) <= today).length,
      },
      streak: currentStreak(roundDays, today),
      ruleGroups,
    }
  }

  async ruleGroups(userId: string): Promise<RuleGroupStats[]> {
    const rows = await this.prisma.ruleProgress.findMany({ where: { userId } })
    return rows
      .map(({ form, ruleGroup, attemptCount, correctCount, box, dueAt, lastPracticedAt }) => ({
        form,
        ruleGroup,
        attemptCount,
        correctCount,
        accuracy: accuracy(correctCount, attemptCount),
        box,
        dueAt,
        lastPracticedAt,
      }))
      .sort(weakestFirst)
  }
}
