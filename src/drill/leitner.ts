import { ConjugationForm, RuleGroup } from '../conjugation'

const DAY = 86_400_000

export const INTERVAL_DAYS = [1, 3, 7, 16, 35, 60] as const
export const MAX_BOX = INTERVAL_DAYS.length - 1

export interface Progress {
  box: number
  dueAt: Date
  attemptCount: number
  correctCount: number
  lastPracticedAt: Date
}

export interface AttemptEvent {
  form: ConjugationForm
  ruleGroup: RuleGroup
  isCorrect: boolean
  createdAt: Date
}

export type RuleProgressRow = Progress & { form: ConjugationForm; ruleGroup: RuleGroup }

export function applyAttempt(
  progress: Progress | undefined,
  isCorrect: boolean,
  at: Date,
): Progress {
  const counts = {
    attemptCount: (progress?.attemptCount ?? 0) + 1,
    correctCount: (progress?.correctCount ?? 0) + (isCorrect ? 1 : 0),
    lastPracticedAt: at,
  }
  // Practising a rule group before it is due does not move it up, so the spacing holds.
  if (isCorrect && progress && at < progress.dueAt) {
    return { box: progress.box, dueAt: progress.dueAt, ...counts }
  }
  const box = isCorrect ? Math.min((progress?.box ?? 0) + 1, MAX_BOX) : 0
  return { box, dueAt: new Date(at.getTime() + INTERVAL_DAYS[box] * DAY), ...counts }
}

export function projectProgress(attempts: AttemptEvent[]): RuleProgressRow[] {
  const rows = new Map<string, RuleProgressRow>()
  const inOrder = [...attempts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  for (const { form, ruleGroup, isCorrect, createdAt } of inOrder) {
    const key = `${form}:${ruleGroup}`
    rows.set(key, { form, ruleGroup, ...applyAttempt(rows.get(key), isCorrect, createdAt) })
  }
  return [...rows.values()]
}
