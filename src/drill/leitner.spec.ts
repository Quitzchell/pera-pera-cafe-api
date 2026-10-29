import { applyAttempt, AttemptEvent, INTERVAL_DAYS, projectProgress } from './leitner'

const DAY = 86_400_000
const at = new Date('2026-10-01T10:00:00Z')

describe('applyAttempt', () => {
  it('moves up one box per correct answer, up to box 5, with growing intervals', () => {
    let progress = applyAttempt(undefined, true, at)
    const boxes = [progress.box]
    for (let i = 0; i < 6; i++) {
      progress = applyAttempt(progress, true, at)
      boxes.push(progress.box)
    }
    expect(boxes).toEqual([1, 2, 3, 4, 5, 5, 5])
    expect(progress.dueAt.getTime() - at.getTime()).toBe(60 * DAY)
    expect(progress).toMatchObject({ attemptCount: 7, correctCount: 7, lastPracticedAt: at })
  })

  it('drops to box 0, due tomorrow, after a wrong answer', () => {
    const progress = applyAttempt(
      applyAttempt(applyAttempt(undefined, true, at), true, at),
      false,
      at,
    )
    expect(progress).toMatchObject({ box: 0, attemptCount: 3, correctCount: 2 })
    expect(progress.dueAt.getTime() - at.getTime()).toBe(1 * DAY)
  })

  it.each(INTERVAL_DAYS.map((days, box) => [box, days]).slice(1))(
    'box %i is due after %i days',
    (box, days) => {
      const previous = {
        box: box - 1,
        dueAt: at,
        attemptCount: 0,
        correctCount: 0,
        lastPracticedAt: at,
      }
      expect(applyAttempt(previous, true, at).dueAt.getTime() - at.getTime()).toBe(days * DAY)
    },
  )
})

describe('projectProgress', () => {
  const event = (
    minutes: number,
    form: AttemptEvent['form'],
    isCorrect: boolean,
  ): AttemptEvent => ({
    form,
    ruleGroup: 'GODAN_KU',
    isCorrect,
    createdAt: new Date(at.getTime() + minutes * 60_000),
  })

  it('folds attempts in time order, whatever order they arrive in', () => {
    const events = [
      event(1, 'TE', true),
      event(2, 'TE', true),
      event(3, 'TE', false),
      event(4, 'TE', true),
      event(5, 'PAST', true),
    ]
    const rows = projectProgress([...events].reverse())

    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.form === 'TE')).toMatchObject({
      box: 1,
      attemptCount: 4,
      correctCount: 3,
      lastPracticedAt: events[3].createdAt,
    })
    expect(rows.find((r) => r.form === 'PAST')).toMatchObject({ box: 1, attemptCount: 1 })
  })

  it('matches applying the same attempts one by one', () => {
    const events = [event(1, 'TE', false), event(2, 'TE', true), event(3, 'TE', true)]
    const live = events.reduce<ReturnType<typeof applyAttempt> | undefined>(
      (progress, e) => applyAttempt(progress, e.isCorrect, e.createdAt),
      undefined,
    )
    expect(projectProgress(events)[0]).toEqual({ form: 'TE', ruleGroup: 'GODAN_KU', ...live })
  })
})
