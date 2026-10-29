import { conjugatorFor } from './conjugators'
import {
  ConjugatableVerb,
  Conjugation,
  ConjugationError,
  ConjugationForm,
  Verb,
  Written,
} from './types'

const NO_PREFIX: Written = { kanji: '', kana: '' }

function split(verb: ConjugatableVerb): { prefix: Written; base: Verb } {
  return 'base' in verb ? verb : { prefix: NO_PREFIX, base: verb }
}

export function supportedForms(verb: ConjugatableVerb): readonly ConjugationForm[] {
  return conjugatorFor(split(verb).base).supportedForms
}

export function conjugate(verb: ConjugatableVerb, form: ConjugationForm): Conjugation {
  const { prefix, base } = split(verb)
  const conjugator = conjugatorFor(base)
  if (!conjugator.supportedForms.includes(form)) {
    throw new ConjugationError(`${base.dictionaryForm} has no ${form} form`)
  }

  const inflection = conjugator.inflect(base, form)
  const kanji = prefix.kanji + inflection.kanji
  const dictionaryForm = prefix.kanji + base.dictionaryForm
  const ruleHint =
    inflection.regularKanji === undefined
      ? `${inflection.change.from} → ${inflection.change.to} (${dictionaryForm} → ${kanji})`
      : `Exception: ${dictionaryForm} → ${kanji}, not ${prefix.kanji + inflection.regularKanji}`

  return {
    kanji,
    kana: prefix.kana + inflection.kana,
    ruleGroup: inflection.ruleGroup,
    ruleHint,
    alternatives: inflection.alternatives.map((alt) => ({
      kanji: prefix.kanji + alt.kanji,
      kana: prefix.kana + alt.kana,
    })),
  }
}
