import {
  ALL_FORMS,
  ConjugationError,
  ConjugationForm,
  RuleGroup,
  Verb,
  VerbClass,
  Written,
} from './types'

export interface Inflection extends Written {
  ruleGroup: RuleGroup
  change: { from: string; to: string }
  alternatives: Written[]
  regularKanji?: string
}

export interface Conjugator {
  matches(verb: Verb): boolean
  supportedForms: readonly ConjugationForm[]
  inflect(verb: Verb, form: ConjugationForm): Inflection
}

interface GodanRow {
  a: string
  i: string
  u: string
  e: string
  o: string
  te: string
  ta: string
  ruleGroup: RuleGroup
}

// prettier-ignore
const GODAN_ROWS: Record<string, GodanRow> = {
  う: { a: 'わ', i: 'い', u: 'う', e: 'え', o: 'お', te: 'って', ta: 'った', ruleGroup: RuleGroup.GODAN_U_TSU_RU },
  つ: { a: 'た', i: 'ち', u: 'つ', e: 'て', o: 'と', te: 'って', ta: 'った', ruleGroup: RuleGroup.GODAN_U_TSU_RU },
  る: { a: 'ら', i: 'り', u: 'る', e: 'れ', o: 'ろ', te: 'って', ta: 'った', ruleGroup: RuleGroup.GODAN_U_TSU_RU },
  む: { a: 'ま', i: 'み', u: 'む', e: 'め', o: 'も', te: 'んで', ta: 'んだ', ruleGroup: RuleGroup.GODAN_MU_BU_NU },
  ぶ: { a: 'ば', i: 'び', u: 'ぶ', e: 'べ', o: 'ぼ', te: 'んで', ta: 'んだ', ruleGroup: RuleGroup.GODAN_MU_BU_NU },
  ぬ: { a: 'な', i: 'に', u: 'ぬ', e: 'ね', o: 'の', te: 'んで', ta: 'んだ', ruleGroup: RuleGroup.GODAN_MU_BU_NU },
  く: { a: 'か', i: 'き', u: 'く', e: 'け', o: 'こ', te: 'いて', ta: 'いた', ruleGroup: RuleGroup.GODAN_KU },
  ぐ: { a: 'が', i: 'ぎ', u: 'ぐ', e: 'げ', o: 'ご', te: 'いで', ta: 'いだ', ruleGroup: RuleGroup.GODAN_GU },
  す: { a: 'さ', i: 'し', u: 'す', e: 'せ', o: 'そ', te: 'して', ta: 'した', ruleGroup: RuleGroup.GODAN_SU },
}

const GODAN_SUFFIXES: Record<ConjugationForm, (row: GodanRow) => string> = {
  POLITE: (r) => `${r.i}ます`,
  POLITE_NEGATIVE: (r) => `${r.i}ません`,
  POLITE_PAST: (r) => `${r.i}ました`,
  NEGATIVE: (r) => `${r.a}ない`,
  PAST_NEGATIVE: (r) => `${r.a}なかった`,
  TE: (r) => r.te,
  PAST: (r) => r.ta,
  POTENTIAL: (r) => `${r.e}る`,
  PASSIVE: (r) => `${r.a}れる`,
  CAUSATIVE: (r) => `${r.a}せる`,
  CAUSATIVE_PASSIVE: (r) => `${r.a}せられる`,
  VOLITIONAL: (r) => `${r.o}う`,
  CONDITIONAL_BA: (r) => `${r.e}ば`,
  IMPERATIVE: (r) => r.e,
  PROHIBITIVE: (r) => `${r.u}な`,
  POTENTIAL_CONDITIONAL: (r) => `${r.e}れば`,
}

const ICHIDAN_SUFFIXES: Record<ConjugationForm, string> = {
  POLITE: 'ます',
  POLITE_NEGATIVE: 'ません',
  POLITE_PAST: 'ました',
  NEGATIVE: 'ない',
  PAST_NEGATIVE: 'なかった',
  TE: 'て',
  PAST: 'た',
  POTENTIAL: 'られる',
  PASSIVE: 'られる',
  CAUSATIVE: 'させる',
  CAUSATIVE_PASSIVE: 'させられる',
  VOLITIONAL: 'よう',
  CONDITIONAL_BA: 'れば',
  IMPERATIVE: 'ろ',
  PROHIBITIVE: 'るな',
  POTENTIAL_CONDITIONAL: 'られれば',
}

const SURU_FORMS: Record<ConjugationForm, string> = {
  POLITE: 'します',
  POLITE_NEGATIVE: 'しません',
  POLITE_PAST: 'しました',
  NEGATIVE: 'しない',
  PAST_NEGATIVE: 'しなかった',
  TE: 'して',
  PAST: 'した',
  POTENTIAL: 'できる',
  PASSIVE: 'される',
  CAUSATIVE: 'させる',
  CAUSATIVE_PASSIVE: 'させられる',
  VOLITIONAL: 'しよう',
  CONDITIONAL_BA: 'すれば',
  IMPERATIVE: 'しろ',
  PROHIBITIVE: 'するな',
  POTENTIAL_CONDITIONAL: 'できれば',
}

const KURU_FORMS: Record<ConjugationForm, string> = {
  POLITE: 'きます',
  POLITE_NEGATIVE: 'きません',
  POLITE_PAST: 'きました',
  NEGATIVE: 'こない',
  PAST_NEGATIVE: 'こなかった',
  TE: 'きて',
  PAST: 'きた',
  POTENTIAL: 'こられる',
  PASSIVE: 'こられる',
  CAUSATIVE: 'こさせる',
  CAUSATIVE_PASSIVE: 'こさせられる',
  VOLITIONAL: 'こよう',
  CONDITIONAL_BA: 'くれば',
  IMPERATIVE: 'こい',
  PROHIBITIVE: 'くるな',
  POTENTIAL_CONDITIONAL: 'こられれば',
}

const stem = (word: string) => word.slice(0, -1)

function inflectGodan(verb: Verb, form: ConjugationForm): Inflection {
  const row = GODAN_ROWS[verb.reading.slice(-1)]
  if (!row) {
    throw new ConjugationError(`${verb.dictionaryForm} does not end in a godan ending`)
  }
  const suffix = GODAN_SUFFIXES[form](row)
  // す-verbs have no short form (話さされる).
  const alternatives =
    form === ConjugationForm.CAUSATIVE_PASSIVE && row.u !== 'す'
      ? [
          {
            kanji: `${stem(verb.dictionaryForm)}${row.a}される`,
            kana: `${stem(verb.reading)}${row.a}される`,
          },
        ]
      : []

  return {
    kanji: stem(verb.dictionaryForm) + suffix,
    kana: stem(verb.reading) + suffix,
    ruleGroup: row.ruleGroup,
    change: { from: row.u, to: suffix },
    alternatives,
  }
}

const godan: Conjugator = {
  matches: (verb) => verb.verbClass === VerbClass.GODAN,
  supportedForms: ALL_FORMS,
  inflect: inflectGodan,
}

const iku: Conjugator = {
  matches: (verb) => verb.verbClass === VerbClass.GODAN && verb.reading === 'いく',
  supportedForms: ALL_FORMS,
  inflect(verb, form) {
    const regular = inflectGodan(verb, form)
    if (form !== ConjugationForm.TE && form !== ConjugationForm.PAST) {
      return regular
    }
    const suffix = form === ConjugationForm.TE ? 'って' : 'った'
    return {
      kanji: stem(verb.dictionaryForm) + suffix,
      kana: stem(verb.reading) + suffix,
      ruleGroup: RuleGroup.EXCEPTION_IKU,
      change: { from: 'く', to: suffix },
      alternatives: [],
      regularKanji: regular.kanji,
    }
  },
}

// ある's potential, passive, causative, volitional and commands are not used, so not drilled.
const aru: Conjugator = {
  matches: (verb) => verb.verbClass === VerbClass.GODAN && verb.reading === 'ある',
  supportedForms: [
    ConjugationForm.POLITE,
    ConjugationForm.POLITE_NEGATIVE,
    ConjugationForm.POLITE_PAST,
    ConjugationForm.NEGATIVE,
    ConjugationForm.PAST_NEGATIVE,
    ConjugationForm.TE,
    ConjugationForm.PAST,
    ConjugationForm.CONDITIONAL_BA,
  ],
  inflect(verb, form) {
    const regular = inflectGodan(verb, form)
    if (form !== ConjugationForm.NEGATIVE && form !== ConjugationForm.PAST_NEGATIVE) {
      return regular
    }
    const word = form === ConjugationForm.NEGATIVE ? 'ない' : 'なかった'
    return {
      kanji: word,
      kana: word,
      ruleGroup: RuleGroup.EXCEPTION_ARU,
      change: { from: 'ある', to: word },
      alternatives: [],
      regularKanji: regular.kanji,
    }
  },
}

const ichidan: Conjugator = {
  matches: (verb) => verb.verbClass === VerbClass.ICHIDAN,
  supportedForms: ALL_FORMS,
  inflect(verb, form) {
    if (!verb.reading.endsWith('る')) {
      throw new ConjugationError(`Ichidan verb ${verb.dictionaryForm} must end in る`)
    }
    const suffix = ICHIDAN_SUFFIXES[form]
    return {
      kanji: stem(verb.dictionaryForm) + suffix,
      kana: stem(verb.reading) + suffix,
      ruleGroup: RuleGroup.ICHIDAN,
      change: { from: 'る', to: suffix },
      alternatives: [],
    }
  },
}

const suru: Conjugator = {
  matches: (verb) => verb.verbClass === VerbClass.IRREGULAR && verb.reading === 'する',
  supportedForms: ALL_FORMS,
  inflect(_verb, form) {
    const word = SURU_FORMS[form]
    return {
      kanji: word,
      kana: word,
      ruleGroup: RuleGroup.IRREGULAR_SURU,
      change: { from: 'する', to: word },
      alternatives: [],
    }
  },
}

const kuru: Conjugator = {
  matches: (verb) => verb.verbClass === VerbClass.IRREGULAR && verb.reading === 'くる',
  supportedForms: ALL_FORMS,
  inflect(verb, form) {
    const kana = KURU_FORMS[form]
    const kanji = verb.dictionaryForm === '来る' ? `来${kana.slice(1)}` : kana
    return {
      kanji,
      kana,
      ruleGroup: RuleGroup.IRREGULAR_KURU,
      change: { from: 'くる', to: kana },
      alternatives: [],
    }
  },
}

// First match wins, so exceptions go before their general class.
const CONJUGATORS: readonly Conjugator[] = [iku, aru, suru, kuru, ichidan, godan]

export function conjugatorFor(verb: Verb): Conjugator {
  if (!verb.reading || verb.dictionaryForm.slice(-1) !== verb.reading.slice(-1)) {
    throw new ConjugationError(
      `Dictionary form ${verb.dictionaryForm} and reading ${verb.reading} must end in the same kana`,
    )
  }
  const conjugator = CONJUGATORS.find((c) => c.matches(verb))
  if (!conjugator) {
    throw new ConjugationError(
      `No conjugation rules for ${verb.verbClass} verb ${verb.dictionaryForm}`,
    )
  }
  return conjugator
}
