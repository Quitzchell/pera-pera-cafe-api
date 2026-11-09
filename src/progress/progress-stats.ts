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

// YYYY-MM-DD-HHmm in the given IANA time zone, for export filenames.
export const fileStamp = (date: Date, timeZone: string) => {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  return `${localDate(date, timeZone)}-${time.replace(':', '')}`
}

const MAX_SPENT_SKIPS = 2
const SKIP_RETURN_DAYS = 7

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000

// Days with a finished round. A missed day spends a skip, which returns seven days later; a
// miss with none left resets the streak. Today without a round yet spends nothing.
export function currentStreak(roundDays: Set<string>, today: string) {
  const studied = new Set([...roundDays].map(dayNumber))
  const end = dayNumber(today)
  let streak = 0
  let spent: number[] = []
  for (let day = Math.min(...studied); day < end; day++) {
    if (studied.has(day)) {
      streak++
      continue
    }
    // Without a streak to save, a long absence must not drain the skips.
    if (streak === 0) {
      continue
    }
    spent = spent.filter((spentOn) => day - spentOn < SKIP_RETURN_DAYS)
    if (spent.length < MAX_SPENT_SKIPS) {
      spent.push(day)
    } else {
      streak = 0
    }
  }
  return {
    streak: streak + (studied.has(end) ? 1 : 0),
    streakSkipsLeft:
      MAX_SPENT_SKIPS - spent.filter((spentOn) => end - spentOn < SKIP_RETURN_DAYS).length,
  }
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
