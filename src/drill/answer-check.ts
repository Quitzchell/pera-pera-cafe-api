import {
  ConjugatableVerb,
  Conjugation,
  ConjugationForm,
  conjugate,
  RuleGroup,
  Written,
} from '../conjugation'

export interface AnswerResult {
  isCorrect: boolean
  expected: Written
  ruleGroup: RuleGroup
  ruleHint: string
  note?: string
}

const normalize = (answer: string) => answer.trim().replace(/。$/, '').trim()

const spellings = (written: Written[]) => written.flatMap(({ kanji, kana }) => [kanji, kana])

// Every correct spelling. A compound may mix kanji and kana per part: 持ってこない, もって来ない.
export function acceptedAnswers(verb: ConjugatableVerb, form: ConjugationForm): Set<string> {
  if (!('base' in verb)) {
    const result = conjugate(verb, form)
    return new Set(spellings([result, ...result.alternatives]))
  }
  const base = conjugate(verb.base, form)
  const prefixes = [verb.prefix.kanji, verb.prefix.kana]
  return new Set(
    prefixes.flatMap((prefix) =>
      spellings([base, ...base.alternatives]).map((word) => prefix + word),
    ),
  )
}

// 見れる for 見られる: colloquial, and wrong in written / exam Japanese.
export function raNukiForms(
  conjugation: Conjugation,
  form: ConjugationForm,
  accepted: Set<string>,
): Set<string> {
  const applies =
    (form === ConjugationForm.POTENTIAL || form === ConjugationForm.POTENTIAL_CONDITIONAL) &&
    (conjugation.ruleGroup === RuleGroup.ICHIDAN ||
      conjugation.ruleGroup === RuleGroup.IRREGULAR_KURU)
  return new Set(
    applies ? [...accepted].map((answer) => answer.replace(/られ(る|れば)$/, 'れ$1')) : [],
  )
}

export function checkAnswer(
  answer: string,
  verb: ConjugatableVerb,
  form: ConjugationForm,
): AnswerResult {
  const conjugation = conjugate(verb, form)
  const accepted = acceptedAnswers(verb, form)
  const given = normalize(answer)
  const result: AnswerResult = {
    isCorrect: accepted.has(given),
    expected: { kanji: conjugation.kanji, kana: conjugation.kana },
    ruleGroup: conjugation.ruleGroup,
    ruleHint: conjugation.ruleHint,
  }
  if (raNukiForms(conjugation, form, accepted).has(given)) {
    result.note = `Colloquial. In written / exam Japanese use ${conjugation.kanji}.`
  }
  return result
}
