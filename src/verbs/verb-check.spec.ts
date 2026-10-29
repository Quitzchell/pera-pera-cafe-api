import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SeedVerb } from '../cli/seed-verbs'
import { ConjugationError, ConjugationForm, conjugate, RuleGroup, VerbClass } from '../conjugation'
import { examChoices } from '../drill/exam-choices'
import { checkVerb, drillableForms, StoredVerb, toConjugatable } from './verb-check'

const { GODAN, ICHIDAN, IRREGULAR } = VerbClass

const verb = (
  dictionaryForm: string,
  reading: string,
  verbClass: VerbClass,
  excludedForms: ConjugationForm[] = [],
): StoredVerb => ({ dictionaryForm, reading, verbClass, excludedForms })

describe('checkVerb', () => {
  it.each([
    [verb('食べる', 'たべる', ICHIDAN)],
    [verb('帰る', 'かえる', GODAN)],
    [verb('変える', 'かえる', ICHIDAN)],
    [verb('書く', 'かく', GODAN)],
    [verb('する', 'する', IRREGULAR)],
  ])('accepts %o without warnings', (v) => {
    expect(checkVerb(v)).toEqual([])
  })

  it('warns when a common godan verb is marked ichidan', () => {
    expect(checkVerb(verb('帰る', 'かえる', ICHIDAN))).toEqual([
      '帰る is usually godan, not ichidan',
    ])
  })

  it('warns when an -iru/-eru verb is marked godan', () => {
    expect(checkVerb(verb('食べる', 'たべる', GODAN))).toEqual([
      '食べる looks ichidan; check that godan is right',
    ])
  })

  it.each([
    [verb('分かる', 'わかる', ICHIDAN), 'Ichidan verbs end in -iru or -eru'],
    [verb('書く', 'kaku', GODAN), 'Reading must be hiragana'],
    [verb('書く', 'カク', GODAN), 'Reading must be hiragana'],
    [
      verb('勉強する', 'べんきょうする', IRREGULAR),
      'No conjugation rules for IRREGULAR verb 勉強する',
    ],
    [
      verb('ある', 'ある', GODAN, [
        'POLITE',
        'POLITE_NEGATIVE',
        'POLITE_PAST',
        'NEGATIVE',
        'PAST_NEGATIVE',
        'TE',
        'PAST',
        'CONDITIONAL_BA',
      ]),
      'Every form is excluded',
    ],
  ])('rejects %o', (v, message) => {
    expect(() => checkVerb(v)).toThrow(new ConjugationError(message))
  })

  describe('compounds', () => {
    const suru = verb('する', 'する', IRREGULAR)

    it('accepts a prefix on the base verb', () => {
      expect(checkVerb(verb('勉強する', 'べんきょうする', IRREGULAR), suru)).toEqual([])
    })

    it.each([
      verb('勉強', 'べんきょう', IRREGULAR),
      verb('勉強する', 'べんきょう', IRREGULAR),
      verb('する', 'する', IRREGULAR),
    ])('rejects %o when it does not end in the base verb', (v) => {
      expect(() => checkVerb(v, suru)).toThrow(/must end in its base verb/)
    })

    it('rejects a compound as base verb', () => {
      const base = { ...verb('勉強する', 'べんきょうする', IRREGULAR), baseVerbId: 'x' }
      expect(() => checkVerb(verb('猛勉強する', 'もうべんきょうする', IRREGULAR), base)).toThrow(
        'The base verb cannot itself be a compound',
      )
    })

    it('splits the prefix off in kanji and kana', () => {
      const kuru = verb('来る', 'くる', IRREGULAR)
      expect(toConjugatable(verb('持って来る', 'もってくる', IRREGULAR), kuru)).toEqual({
        prefix: { kanji: '持って', kana: 'もって' },
        base: kuru,
      })
    })
  })

  it('leaves excluded forms out of the drill', () => {
    const wakaru = verb('分かる', 'わかる', GODAN, ['POTENTIAL', 'IMPERATIVE'])
    expect(drillableForms(wakaru)).not.toContain('POTENTIAL')
    expect(drillableForms(wakaru)).toHaveLength(14)
  })
})

describe('seed data', () => {
  const seed = JSON.parse(
    readFileSync(join(__dirname, '../../prisma/seed-data/verbs.json'), 'utf8'),
  ) as SeedVerb[]
  const byForm = new Map(seed.map((v) => [v.dictionaryForm, v]))
  const stored = (v: SeedVerb): StoredVerb => ({
    dictionaryForm: v.dictionaryForm,
    reading: v.reading,
    verbClass: v.verbClass ?? byForm.get(v.base ?? '')!.verbClass!,
    excludedForms: v.excludedForms ?? [],
  })
  const baseOf = (v: SeedVerb) => (v.base ? stored(byForm.get(v.base)!) : undefined)

  it('has about 150 verbs and 5-8 compounds, without duplicates', () => {
    expect(seed.length).toBeGreaterThanOrEqual(150)
    expect(seed.filter((v) => v.base)).toHaveLength(8)
    expect(new Set(seed.map((v) => `${v.dictionaryForm}/${v.reading}`)).size).toBe(seed.length)
  })

  it.each(seed.map((v) => [v.dictionaryForm, v] as const))('%s passes the verb check', (_, v) => {
    expect(checkVerb(stored(v), baseOf(v))).toEqual([])
  })

  it('covers every rule group', () => {
    const groups = new Set(
      seed.flatMap((v) =>
        drillableForms(stored(v), baseOf(v)).map(
          (form) => conjugate(toConjugatable(stored(v), baseOf(v)), form).ruleGroup,
        ),
      ),
    )
    expect([...groups].sort()).toEqual(Object.values(RuleGroup).sort())
  })

  it('includes the godan verbs that look ichidan', () => {
    for (const form of ['帰る', '入る', '走る', '知る', '切る', '要る']) {
      expect(byForm.get(form)?.verbClass).toBe(GODAN)
    }
  })

  it('excludes potential + ば wherever the potential is excluded', () => {
    for (const v of seed.filter((v) => v.excludedForms?.includes('POTENTIAL'))) {
      expect(v.excludedForms).toContain('POTENTIAL_CONDITIONAL')
    }
  })

  it('gives every seed verb 4 distinct exam choices in every drillable form', () => {
    for (const v of seed) {
      const verb = toConjugatable(stored(v), baseOf(v))
      for (const form of drillableForms(stored(v), baseOf(v))) {
        expect(new Set(examChoices(verb, form)).size).toBe(4)
      }
    }
  })

  it('never drills the irregular imperative of くれる', () => {
    expect(drillableForms(stored(byForm.get('くれる')!))).not.toContain('IMPERATIVE')
  })
})
