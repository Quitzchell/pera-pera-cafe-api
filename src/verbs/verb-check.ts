import {
  ConjugatableVerb,
  ConjugationError,
  ConjugationForm,
  conjugate,
  supportedForms,
  Verb,
  VerbClass,
} from '../conjugation'

export interface StoredVerb extends Verb {
  excludedForms: ConjugationForm[]
}

const I_OR_E_ROW = new Set('いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ')

// Common godan verbs that end in -iru/-eru and so look ichidan.
const GODAN_LOOKALIKES = new Set([
  '帰る',
  '入る',
  '走る',
  '知る',
  '切る',
  '要る',
  '減る',
  '蹴る',
  '滑る',
  '喋る',
  '握る',
  '参る',
  '限る',
  '散る',
  '焦る',
  '照る',
  '練る',
  '茂る',
  '湿る',
  '混じる',
  '交じる',
  '遮る',
  '覆る',
  '陥る',
])

const looksIchidan = (verb: Verb) =>
  verb.reading.endsWith('る') && I_OR_E_ROW.has(verb.reading.at(-2) ?? '')

export function toConjugatable(verb: Verb, base?: Verb): ConjugatableVerb {
  if (!base) {
    return verb
  }
  return {
    prefix: {
      kanji: verb.dictionaryForm.slice(0, -base.dictionaryForm.length),
      kana: verb.reading.slice(0, -base.reading.length),
    },
    base,
  }
}

export function drillableForms(verb: StoredVerb, base?: Verb): ConjugationForm[] {
  return supportedForms(toConjugatable(verb, base)).filter(
    (form) => !verb.excludedForms.includes(form),
  )
}

// Throws ConjugationError for a verb the engine cannot conjugate; returns warnings for a
// verb that is probably misclassified.
export function checkVerb(
  verb: StoredVerb,
  base?: StoredVerb & { baseVerbId?: string | null },
): string[] {
  if (!/^[ぁ-ゖ]+$/.test(verb.reading)) {
    throw new ConjugationError('Reading must be hiragana')
  }
  if (base) {
    if (base.baseVerbId) {
      throw new ConjugationError('The base verb cannot itself be a compound')
    }
    if (
      verb.dictionaryForm.length <= base.dictionaryForm.length ||
      !verb.dictionaryForm.endsWith(base.dictionaryForm) ||
      verb.reading.length <= base.reading.length ||
      !verb.reading.endsWith(base.reading)
    ) {
      throw new ConjugationError(
        `A compound must end in its base verb ${base.dictionaryForm} (${base.reading})`,
      )
    }
  }

  const engineVerb = base ?? verb
  if (engineVerb.verbClass === VerbClass.ICHIDAN && !looksIchidan(engineVerb)) {
    throw new ConjugationError('Ichidan verbs end in -iru or -eru')
  }
  const forms = drillableForms(verb, base)
  if (forms.length === 0) {
    throw new ConjugationError('Every form is excluded')
  }
  forms.forEach((form) => conjugate(toConjugatable(verb, base), form))

  if (base) {
    return []
  }
  if (verb.verbClass === VerbClass.ICHIDAN && GODAN_LOOKALIKES.has(verb.dictionaryForm)) {
    return [`${verb.dictionaryForm} is usually godan, not ichidan`]
  }
  if (
    verb.verbClass === VerbClass.GODAN &&
    looksIchidan(verb) &&
    !GODAN_LOOKALIKES.has(verb.dictionaryForm)
  ) {
    return [`${verb.dictionaryForm} looks ichidan; check that godan is right`]
  }
  return []
}
