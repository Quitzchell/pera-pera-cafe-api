import { ConjugationForm, RuleGroup } from '../conjugation'

export type DrillMode = 'STANDARD' | 'CONTRAST' | 'EXAM'

export interface Candidate {
  verbId: string
  isCompound: boolean
  // Drillable, enabled forms of this verb with their rule group.
  forms: { form: ConjugationForm; ruleGroup: RuleGroup }[]
}

export interface ProgressSnapshot {
  form: ConjugationForm
  ruleGroup: RuleGroup
  box: number
  dueAt: Date
  attemptCount: number
  correctCount: number
}

export interface PlannedItem {
  verbId: string
  form: ConjugationForm
}

export interface RoundInput {
  mode: DrillMode
  candidates: Candidate[]
  progress: ProgressSnapshot[]
  size: number
  now: Date
  random?: () => number
}

export const CONTRAST_PAIRS: readonly [ConjugationForm, ConjugationForm][] = [
  ['POTENTIAL', 'PASSIVE'],
  ['TE', 'PAST'],
  ['CONDITIONAL_BA', 'POTENTIAL_CONDITIONAL'],
]

const MAX_COMPOUNDS = 2
const NEW_SHARE = 0.2

interface Option {
  verbId: string
  isCompound: boolean
  items: PlannedItem[]
}

// What the round picks from: one (form, rule group) slot, or a contrast pair of slots.
interface Group {
  slots: string[]
  options: Option[]
}

// Lower sorts first: due (lowest box, most overdue), then weakest accuracy, then new.
type Rank = [tier: number, primary: number, secondary: number]

const compare = (a: Rank, b: Rank) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function groupsFor(mode: DrillMode, candidates: Candidate[], random: () => number): Group[] {
  const groups = new Map<string, Group>()
  const add = (slots: string[], option: Option) => {
    const key = slots.join('|')
    const group = groups.get(key) ?? { slots, options: [] }
    group.options.push(option)
    groups.set(key, group)
  }

  for (const { verbId, isCompound, forms } of candidates) {
    if (mode !== 'CONTRAST') {
      for (const { form, ruleGroup } of forms) {
        add([`${form}:${ruleGroup}`], { verbId, isCompound, items: [{ verbId, form }] })
      }
      continue
    }
    for (const pair of CONTRAST_PAIRS) {
      const [a, b] = pair.map((form) => forms.find((f) => f.form === form))
      if (a && b) {
        const items = shuffle([a, b], random).map(({ form }) => ({ verbId, form }))
        add([`${a.form}:${a.ruleGroup}`, `${b.form}:${b.ruleGroup}`], { verbId, isCompound, items })
      }
    }
  }
  return [...groups.values()]
}

export function buildRound(input: RoundInput): PlannedItem[] {
  const { mode, candidates, size, now, random = Math.random } = input
  const progress = new Map(input.progress.map((p) => [`${p.form}:${p.ruleGroup}`, p]))

  const slotRank = (slot: string): Rank => {
    const p = progress.get(slot)
    if (!p) {
      return [2, random(), 0]
    }
    if (p.dueAt <= now) {
      return [0, p.box, p.dueAt.getTime()]
    }
    return [1, p.correctCount / p.attemptCount, 0]
  }
  const ranked = groupsFor(mode, candidates, random)
    .map((group) => ({ group, rank: group.slots.map(slotRank).sort(compare)[0] }))
    .sort((a, b) => compare(a.rank, b.rank))

  const known = ranked.filter(({ rank }) => rank[0] < 2).map(({ group }) => group)
  const fresh = ranked.filter(({ rank }) => rank[0] === 2).map(({ group }) => group)
  const groupsNeeded = Math.ceil(size / (mode === 'CONTRAST' ? 2 : 1))
  const newBudget = Math.min(fresh.length, Math.ceil(groupsNeeded * NEW_SHARE))
  const knownBudget = Math.max(groupsNeeded - newBudget, 0)
  const sequence = [
    ...known.slice(0, knownBudget),
    ...fresh.slice(0, newBudget),
    ...known.slice(knownBudget),
    ...fresh.slice(newBudget),
  ]

  const picked: Option[] = []
  const usedVerbs = new Set<string>()
  let itemCount = 0
  let compounds = 0
  // Repeated passes let a slot come back with another verb when there are few slots.
  for (let added = true; added && itemCount < size; ) {
    added = false
    for (const group of sequence) {
      const options = group.options.filter(
        (o) =>
          !usedVerbs.has(o.verbId) &&
          (!o.isCompound || compounds < MAX_COMPOUNDS) &&
          itemCount + o.items.length <= size,
      )
      if (options.length === 0) {
        continue
      }
      const option = options[Math.floor(random() * options.length)]
      picked.push(option)
      usedVerbs.add(option.verbId)
      itemCount += option.items.length
      compounds += option.isCompound ? 1 : 0
      added = true
      if (itemCount >= size) {
        break
      }
    }
  }
  return shuffle(picked, random).flatMap((option) => option.items)
}
