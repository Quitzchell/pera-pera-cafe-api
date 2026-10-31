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

export const RULE_PROGRESS_COLUMNS = [
  'form',
  'ruleGroup',
  'attemptCount',
  'accuracy',
  'box',
  'lastPracticedAt',
  'dueAt',
] as const

export const MISTAKE_COLUMNS = [
  'createdAt',
  'mode',
  'dictionaryForm',
  'reading',
  'form',
  'ruleGroup',
  'expectedKanji',
  'expectedKana',
  'answer',
] as const

export interface RecentMistake {
  createdAt: Date
  mode: string
  verb: { dictionaryForm: string; reading: string }
  form: ConjugationForm
  ruleGroup: RuleGroup
  expected: { kanji: string; kana: string } | null
  answer: string
}

export const exportRow = (row: RuleGroupStats) =>
  Object.fromEntries(RULE_PROGRESS_COLUMNS.map((column) => [column, row[column]])) as Pick<
    RuleGroupStats,
    (typeof RULE_PROGRESS_COLUMNS)[number]
  >

export const flattenMistake = ({ verb, expected, ...mistake }: RecentMistake) => ({
  ...mistake,
  dictionaryForm: verb.dictionaryForm,
  reading: verb.reading,
  expectedKanji: expected?.kanji,
  expectedKana: expected?.kana,
})

// Answers are free text, so quote what needs quoting, and prefix values a spreadsheet would
// run as a formula (CSV injection).
type CsvValue = string | number | Date | null | undefined

function csvField(value: CsvValue): string {
  if (value === null || value === undefined) {
    return ''
  }
  let text = value instanceof Date ? value.toISOString() : String(value)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv<C extends string>(
  columns: readonly C[],
  rows: Partial<Record<C, CsvValue>>[],
): string {
  const lines = rows.map((row) => columns.map((column) => csvField(row[column])).join(','))
  return [columns.join(','), ...lines].join('\n') + '\n'
}
