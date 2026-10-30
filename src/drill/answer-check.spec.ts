import { CompoundVerb, ConjugationForm, Verb } from '../conjugation'
import { checkAnswer } from './answer-check'

const v = (dictionaryForm: string, reading: string, verbClass: Verb['verbClass']): Verb => ({
  dictionaryForm,
  reading,
  verbClass,
})
const yomu = v('読む', 'よむ', 'GODAN')
const miru = v('見る', 'みる', 'ICHIDAN')
const kuru = v('来る', 'くる', 'IRREGULAR')
const kaku = v('書く', 'かく', 'GODAN')
const motteKuru: CompoundVerb = { prefix: { kanji: '持って', kana: 'もって' }, base: kuru }

describe('checkAnswer', () => {
  it.each([
    [yomu, 'PASSIVE', '読まれる'],
    [yomu, 'PASSIVE', 'よまれる'],
    [yomu, 'PASSIVE', '  よまれる。 '],
    [yomu, 'PASSIVE', '　読まれる　'],
    [kaku, 'CAUSATIVE_PASSIVE', '書かせられる'],
    [kaku, 'CAUSATIVE_PASSIVE', '書かされる'],
    [kaku, 'CAUSATIVE_PASSIVE', 'かかされる'],
    [motteKuru, 'NEGATIVE', '持って来ない'],
    [motteKuru, 'NEGATIVE', '持ってこない'],
    [motteKuru, 'NEGATIVE', 'もってこない'],
    [motteKuru, 'NEGATIVE', 'もって来ない'],
  ] as [Verb | CompoundVerb, ConjugationForm, string][])(
    'accepts %# %s %p',
    (verb, form, answer) => {
      expect(checkAnswer(answer, verb, form).isCorrect).toBe(true)
    },
  )

  it.each([
    [yomu, 'PASSIVE', '読まれ'],
    [yomu, 'PASSIVE', 'ヨマレル'],
    [yomu, 'PASSIVE', 'yomareru'],
    [yomu, 'PASSIVE', ''],
    [kaku, 'TE', 'かきて'],
    [v('話す', 'はなす', 'GODAN'), 'CAUSATIVE_PASSIVE', '話さされる'],
  ] as [Verb, ConjugationForm, string][])('rejects %# %s %p', (verb, form, answer) => {
    expect(checkAnswer(answer, verb, form).isCorrect).toBe(false)
  })

  it('returns the expected form and rule hint', () => {
    expect(checkAnswer('およいで', v('泳ぐ', 'およぐ', 'GODAN'), 'TE')).toEqual({
      isCorrect: true,
      expected: { kanji: '泳いで', kana: 'およいで' },
      ruleGroup: 'GODAN_GU',
      ruleHint: 'ぐ → いで (泳ぐ → 泳いで)',
    })
  })

  it.each([
    [miru, 'POTENTIAL', '見れる', '見られる'],
    [miru, 'POTENTIAL', 'みれる', '見られる'],
    [miru, 'POTENTIAL_CONDITIONAL', '見れれば', '見られれば'],
    [kuru, 'POTENTIAL', '来れる', '来られる'],
    [kuru, 'POTENTIAL', 'これる', '来られる'],
    [motteKuru, 'POTENTIAL', '持ってこれる', '持って来られる'],
  ] as [Verb | CompoundVerb, ConjugationForm, string, string][])(
    'marks ra-nuki %# %p wrong with a note',
    (verb, form, answer, expected) => {
      expect(checkAnswer(answer, verb, form)).toMatchObject({
        isCorrect: false,
        note: `Colloquial. In written / exam Japanese use ${expected}.`,
      })
    },
  )

  it('adds no note to other wrong answers', () => {
    expect(checkAnswer('見させる', miru, 'POTENTIAL').note).toBeUndefined()
    expect(checkAnswer('読めれる', yomu, 'POTENTIAL').note).toBeUndefined()
  })
})
