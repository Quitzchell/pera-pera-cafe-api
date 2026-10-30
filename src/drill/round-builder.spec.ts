import { ConjugationForm, RuleGroup } from '../conjugation'
import { buildRound, Candidate, ProgressSnapshot, RoundInput } from './round-builder'

const now = new Date('2026-10-29T12:00:00Z')
const DAY = 86_400_000

// Deterministic pseudo-random numbers, so failures are reproducible.
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const verb = (
  verbId: string,
  ruleGroup: RuleGroup,
  forms: ConjugationForm[],
  isCompound = false,
): Candidate => ({ verbId, isCompound, forms: forms.map((form) => ({ form, ruleGroup })) })

const progress = (
  form: ConjugationForm,
  ruleGroup: RuleGroup,
  box: number,
  dueInDays: number,
  correctCount = 1,
  attemptCount = 1,
): ProgressSnapshot => ({
  form,
  ruleGroup,
  box,
  dueAt: new Date(now.getTime() + dueInDays * DAY),
  correctCount,
  attemptCount,
})

const build = (input: Partial<RoundInput> & Pick<RoundInput, 'candidates'>) =>
  buildRound({ mode: 'STANDARD', progress: [], size: 20, now, random: seeded(), ...input })

const many = (prefix: string, ruleGroup: RuleGroup, forms: ConjugationForm[], count: number) =>
  Array.from({ length: count }, (_, i) => verb(`${prefix}${i}`, ruleGroup, forms))

describe('buildRound', () => {
  it('fills the round without repeating a verb', () => {
    const items = build({ candidates: many('ku', 'GODAN_KU', ['TE', 'PAST', 'NEGATIVE'], 30) })
    expect(items).toHaveLength(20)
    expect(new Set(items.map((i) => i.verbId)).size).toBe(20)
  })

  it('returns fewer items when there are not enough verbs, and none without candidates', () => {
    expect(build({ candidates: many('ku', 'GODAN_KU', ['TE'], 3) })).toHaveLength(3)
    expect(build({ candidates: [] })).toEqual([])
  })

  it('puts due rule groups first: lowest box, then most overdue', () => {
    const candidates = [
      ...many('ku', 'GODAN_KU', ['TE'], 5),
      ...many('gu', 'GODAN_GU', ['TE'], 5),
      ...many('su', 'GODAN_SU', ['TE'], 5),
      ...many('mu', 'GODAN_MU_BU_NU', ['TE'], 5),
    ]
    const items = build({
      candidates,
      size: 2,
      progress: [
        progress('TE', 'GODAN_KU', 3, -10),
        progress('TE', 'GODAN_GU', 1, -1),
        progress('TE', 'GODAN_SU', 1, -5),
        progress('TE', 'GODAN_MU_BU_NU', 0, 5),
      ],
    })
    expect(items.map((i) => i.verbId.slice(0, 2)).sort()).toEqual(['gu', 'su'])
  })

  it('takes the weakest accuracy next, then a few new combinations', () => {
    const candidates = [
      ...many('strong', 'GODAN_KU', ['TE'], 10),
      ...many('weak', 'GODAN_GU', ['TE'], 10),
      ...many('new', 'GODAN_SU', ['TE'], 10),
    ]
    const items = build({
      candidates,
      size: 5,
      progress: [progress('TE', 'GODAN_KU', 2, 3, 9, 10), progress('TE', 'GODAN_GU', 2, 3, 2, 10)],
    })
    const counts = items.reduce<Record<string, number>>((acc, { verbId }) => {
      const key = verbId.replace(/\d+$/, '')
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    expect(counts.new).toBe(1)
    expect(counts.weak).toBeGreaterThanOrEqual(counts.strong ?? 0)
  })

  it('allows at most 2 compounds per round', () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      verb(`suru${i}`, 'IRREGULAR_SURU', ['POLITE', 'TE'], true),
    )
    expect(build({ candidates })).toHaveLength(2)
  })

  describe('contrast mode', () => {
    it('shows both forms of a pair for the same verb, back to back', () => {
      const candidates = many(
        'ku',
        'GODAN_KU',
        ['TE', 'PAST', 'POTENTIAL', 'PASSIVE', 'NEGATIVE'],
        20,
      )
      const items = build({ mode: 'CONTRAST', candidates, size: 10 })

      expect(items).toHaveLength(10)
      for (let i = 0; i < items.length; i += 2) {
        const [first, second] = [items[i], items[i + 1]]
        expect(first.verbId).toBe(second.verbId)
        expect(['PAST,TE', 'PASSIVE,POTENTIAL']).toContain([first.form, second.form].sort().join())
      }
    })

    it('needs both forms of a pair', () => {
      expect(
        build({ mode: 'CONTRAST', candidates: many('ku', 'GODAN_KU', ['TE', 'POTENTIAL'], 5) }),
      ).toEqual([])
    })

    it('never splits a pair to fit an odd round size', () => {
      const items = build({
        mode: 'CONTRAST',
        candidates: many('ku', 'GODAN_KU', ['TE', 'PAST'], 20),
        size: 5,
      })
      expect(items).toHaveLength(4)
    })
  })
})
