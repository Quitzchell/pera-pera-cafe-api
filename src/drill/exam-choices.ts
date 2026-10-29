import {
  ALL_FORMS,
  ConjugatableVerb,
  ConjugationForm,
  conjugate,
  supportedForms,
  Verb,
  VerbClass,
} from '../conjugation'
import { acceptedAnswers, raNukiForms } from './answer-check'

const CHOICES = 4

const CONFUSED_WITH: Record<ConjugationForm, ConjugationForm[]> = {
  POLITE: ['POLITE_PAST', 'POLITE_NEGATIVE'],
  POLITE_NEGATIVE: ['NEGATIVE', 'POLITE_PAST'],
  POLITE_PAST: ['PAST', 'POLITE'],
  NEGATIVE: ['PAST_NEGATIVE', 'POLITE_NEGATIVE'],
  PAST_NEGATIVE: ['NEGATIVE', 'PAST'],
  TE: ['PAST'],
  PAST: ['TE'],
  POTENTIAL: ['PASSIVE', 'CAUSATIVE'],
  PASSIVE: ['POTENTIAL', 'CAUSATIVE_PASSIVE'],
  CAUSATIVE: ['CAUSATIVE_PASSIVE', 'PASSIVE'],
  CAUSATIVE_PASSIVE: ['CAUSATIVE', 'PASSIVE'],
  VOLITIONAL: ['IMPERATIVE', 'CONDITIONAL_BA'],
  CONDITIONAL_BA: ['POTENTIAL_CONDITIONAL', 'VOLITIONAL'],
  IMPERATIVE: ['VOLITIONAL', 'PROHIBITIVE'],
  PROHIBITIVE: ['IMPERATIVE', 'NEGATIVE'],
  POTENTIAL_CONDITIONAL: ['CONDITIONAL_BA', 'POTENTIAL'],
}

const GODAN_ENDINGS = ['う', 'つ', 'る', 'む', 'ぶ', 'ぬ', 'く', 'ぐ', 'す']

const tryKana = (verb: Verb, form: ConjugationForm) => {
  try {
    return [conjugate({ ...verb, dictionaryForm: verb.reading }, form).kana]
  } catch {
    return []
  }
}

// The base verb conjugated by the wrong rules: another godan row (書く → 書って),
// the other class for -る verbs (帰る → 帰ない), or 来る as if it were ichidan (きない).
function wrongRuleGroup(verb: Verb, form: ConjugationForm): string[] {
  const stem = verb.reading.slice(0, -1)
  const as = (reading: string, verbClass: VerbClass) =>
    tryKana({ dictionaryForm: reading, reading, verbClass }, form)

  if (verb.verbClass === VerbClass.IRREGULAR) {
    return verb.reading === 'くる'
      ? [...as('きる', VerbClass.ICHIDAN), ...as('くる', VerbClass.ICHIDAN)]
      : [...as('する', VerbClass.GODAN)]
  }
  const otherClass =
    verb.reading.endsWith('る') && verb.verbClass === VerbClass.GODAN
      ? as(verb.reading, VerbClass.ICHIDAN)
      : verb.verbClass === VerbClass.ICHIDAN
        ? as(verb.reading, VerbClass.GODAN)
        : []
  const otherRows =
    verb.verbClass === VerbClass.GODAN && (form === 'TE' || form === 'PAST')
      ? GODAN_ENDINGS.flatMap((ending) => as(stem + ending, VerbClass.GODAN))
      : []
  // 行く and ある conjugated as regular godan (行いて, あらない), via a reading that is no exception.
  const regular = ['いく', 'ある'].includes(verb.reading)
    ? as(`ま${verb.reading.slice(-1)}`, VerbClass.GODAN).map((kana) => stem + kana.slice(1))
    : []
  return [...regular, ...otherClass, ...otherRows]
}

// 急ぎた for 急いだ: the masu-stem with た/て glued on.
function masuStemMistake(verb: Verb, form: ConjugationForm): string[] {
  if (form !== 'TE' && form !== 'PAST') {
    return []
  }
  return tryKana(verb, 'POLITE').map(
    (polite) => polite.slice(0, -'ます'.length) + (form === 'TE' ? 'て' : 'た'),
  )
}

export function examChoices(
  verb: ConjugatableVerb,
  form: ConjugationForm,
  random: () => number = Math.random,
): string[] {
  const prefix = 'base' in verb ? verb.prefix.kana : ''
  const base = 'base' in verb ? verb.base : verb
  const correct = conjugate(verb, form)
  const accepted = acceptedAnswers(verb, form)
  const forms = supportedForms(verb)
  const otherForm = (f: ConjugationForm) => (forms.includes(f) ? [conjugate(verb, f).kana] : [])

  const candidates = [
    ...otherForm(CONFUSED_WITH[form][0]),
    ...raNukiForms(correct, form, new Set([correct.kana])),
    ...[...masuStemMistake(base, form), ...wrongRuleGroup(base, form)].map((kana) => prefix + kana),
    ...CONFUSED_WITH[form].slice(1).flatMap(otherForm),
    ...ALL_FORMS.flatMap(otherForm),
  ]
  const distractors = [...new Set(candidates)]
    .filter((kana) => !accepted.has(kana))
    .slice(0, CHOICES - 1)

  const choices = [correct.kana, ...distractors]
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[choices[i], choices[j]] = [choices[j], choices[i]]
  }
  return choices
}
