import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { conjugateIfPossible } from '../verbs/verb-check'
import {
  accuracy,
  currentStreak,
  exportRow,
  localDate,
  RuleGroupStats,
  weakestFirst,
} from './progress-stats'

const RECENT_MISTAKES = 30

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
        where: {
          userId,
          finishedAt: { not: null },
          items: { some: { attempt: { isNot: null } } },
        },
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

  async exportJson(userId: string) {
    const [summary, mistakes] = await Promise.all([
      this.summary(userId),
      this.prisma.attempt.findMany({
        where: { userId, isCorrect: false },
        orderBy: { createdAt: 'desc' },
        take: RECENT_MISTAKES,
        select: {
          createdAt: true,
          form: true,
          ruleGroup: true,
          answer: true,
          drillItem: { select: { round: { select: { mode: true } } } },
          verb: { include: { baseVerb: true } },
        },
      }),
    ])
    return {
      exportedAt: new Date(),
      totals: {
        rounds: summary.totals.roundsFinished,
        attempts: summary.totals.attempts,
        accuracy: summary.totals.accuracy,
        streak: summary.streak,
      },
      ruleProgress: summary.ruleGroups.map(exportRow),
      recentMistakes: mistakes.map(({ createdAt, form, ruleGroup, answer, drillItem, verb }) => {
        const expected = conjugateIfPossible(verb, form)
        return {
          createdAt,
          mode: drillItem.round.mode,
          verb: { dictionaryForm: verb.dictionaryForm, reading: verb.reading },
          form,
          ruleGroup,
          expected: expected && { kanji: expected.kanji, kana: expected.kana },
          answer,
        }
      }),
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
