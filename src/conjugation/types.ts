// Same shape as Prisma's generated enums, so those are assignable without importing Prisma.

export const VerbClass = {
  GODAN: 'GODAN',
  ICHIDAN: 'ICHIDAN',
  IRREGULAR: 'IRREGULAR',
} as const
export type VerbClass = (typeof VerbClass)[keyof typeof VerbClass]

export const ConjugationForm = {
  POLITE: 'POLITE',
  POLITE_NEGATIVE: 'POLITE_NEGATIVE',
  POLITE_PAST: 'POLITE_PAST',
  NEGATIVE: 'NEGATIVE',
  PAST_NEGATIVE: 'PAST_NEGATIVE',
  TE: 'TE',
  PAST: 'PAST',
  POTENTIAL: 'POTENTIAL',
  PASSIVE: 'PASSIVE',
  CAUSATIVE: 'CAUSATIVE',
  CAUSATIVE_PASSIVE: 'CAUSATIVE_PASSIVE',
  VOLITIONAL: 'VOLITIONAL',
  CONDITIONAL_BA: 'CONDITIONAL_BA',
  IMPERATIVE: 'IMPERATIVE',
  PROHIBITIVE: 'PROHIBITIVE',
} as const
export type ConjugationForm = (typeof ConjugationForm)[keyof typeof ConjugationForm]

export const ALL_FORMS: readonly ConjugationForm[] = Object.values(ConjugationForm)

export const RuleGroup = {
  GODAN_U_TSU_RU: 'GODAN_U_TSU_RU',
  GODAN_MU_BU_NU: 'GODAN_MU_BU_NU',
  GODAN_KU: 'GODAN_KU',
  GODAN_GU: 'GODAN_GU',
  GODAN_SU: 'GODAN_SU',
  ICHIDAN: 'ICHIDAN',
  IRREGULAR_SURU: 'IRREGULAR_SURU',
  IRREGULAR_KURU: 'IRREGULAR_KURU',
  EXCEPTION_IKU: 'EXCEPTION_IKU',
  EXCEPTION_ARU: 'EXCEPTION_ARU',
} as const
export type RuleGroup = (typeof RuleGroup)[keyof typeof RuleGroup]

export interface Verb {
  dictionaryForm: string
  reading: string
  verbClass: VerbClass
}

export interface CompoundVerb {
  prefix: Written
  base: Verb
}

export type ConjugatableVerb = Verb | CompoundVerb

export interface Written {
  kanji: string
  kana: string
}

export interface Conjugation extends Written {
  ruleGroup: RuleGroup
  ruleHint: string
  alternatives: Written[]
}

export class ConjugationError extends Error {}
