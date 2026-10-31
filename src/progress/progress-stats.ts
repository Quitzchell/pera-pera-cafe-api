import { ConjugationForm, RuleGroup } from '../conjugation'

export interface RuleGroupStats {
  form: ConjugationForm
  ruleGroup: RuleGroup
  attemptCount: number
  correctCount: number
  accuracy: number
  box: number
  dueAt: Date
  lastPracticedAt: Date
}

export const accuracy = (correct: number, attempts: number) =>
  attempts === 0 ? 0 : Math.round((correct / attempts) * 100) / 100

// YYYY-MM-DD in the given IANA time zone.
export const localDate = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

const previousDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)

// Days in a row with a finished round. Today without a round yet does not break it.
export function currentStreak(roundDays: Set<string>, today: string): number {
  let day = roundDays.has(today) ? today : previousDay(today)
  let streak = 0
  while (roundDays.has(day)) {
    streak++
    day = previousDay(day)
  }
  return streak
}

export const weakestFirst = (a: RuleGroupStats, b: RuleGroupStats) =>
  a.accuracy - b.accuracy || a.box - b.box || b.attemptCount - a.attemptCount

const CSV_COLUMNS = [
  'form',
  'ruleGroup',
  'attemptCount',
  'accuracy',
  'box',
  'lastPracticedAt',
] as const

// Every value is an enum, a number or an ISO date, so nothing needs quoting.
export function toCsv(rows: RuleGroupStats[]): string {
  const lines = rows.map((row) =>
    CSV_COLUMNS.map((column) =>
      column === 'lastPracticedAt' ? row.lastPracticedAt.toISOString() : String(row[column]),
    ).join(','),
  )
  return [CSV_COLUMNS.join(','), ...lines].join('\n') + '\n'
}

export const exportRow = (row: RuleGroupStats) => ({
  ...Object.fromEntries(CSV_COLUMNS.map((column) => [column, row[column]])),
  dueAt: row.dueAt,
})
