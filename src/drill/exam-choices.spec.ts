import { CompoundVerb, ConjugationForm, Verb } from '../conjugation'
import { examChoices } from './exam-choices'

const v = (dictionaryForm: string, reading: string, verbClass: Verb['verbClass']): Verb => ({
  dictionaryForm,
  reading,
  verbClass,
})

describe('examChoices', () => {
  it.each([
    [v('急ぐ', 'いそぐ', 'GODAN'), 'PAST', 'いそいだ', ['いそぎた', 'いそいで']],
    [v('書く', 'かく', 'GODAN'), 'TE', 'かいて', ['かきて']],
    [v('行く', 'いく', 'GODAN'), 'TE', 'いって', ['いいて']],
    [v('ある', 'ある', 'GODAN'), 'NEGATIVE', 'ない', ['あらない']],
    [v('見る', 'みる', 'ICHIDAN'), 'POTENTIAL', 'みられる', ['みれる']],
    [v('読む', 'よむ', 'GODAN'), 'POTENTIAL', 'よめる', ['よまれる']],
    [v('来る', 'くる', 'IRREGULAR'), 'NEGATIVE', 'こない', ['きない']],
    [v('書く', 'かく', 'GODAN'), 'CONDITIONAL_BA', 'かけば', ['かければ']],
  ] as [Verb, ConjugationForm, string, string[]][])(
    '%o %s offers %s among realistic mistakes',
    (verb, form, correct, mistakes) => {
      const choices = examChoices(verb, form)
      expect(choices).toHaveLength(4)
      expect(new Set(choices).size).toBe(4)
      expect(choices).toContain(correct)
      for (const mistake of mistakes) {
        expect(choices).toContain(mistake)
      }
    },
  )

  it('never offers another correct spelling as a wrong option', () => {
    const choices = examChoices(v('書く', 'かく', 'GODAN'), 'CAUSATIVE_PASSIVE')
    expect(choices).toContain('かかせられる')
    expect(choices).not.toContain('かかされる')
  })

  it('keeps the prefix on compound choices', () => {
    const motteKuru: CompoundVerb = {
      prefix: { kanji: '持って', kana: 'もって' },
      base: v('来る', 'くる', 'IRREGULAR'),
    }
    const choices = examChoices(motteKuru, 'POTENTIAL')
    expect(choices).toContain('もってこられる')
    expect(choices.every((choice) => choice.startsWith('もって'))).toBe(true)
  })

  it('shuffles the correct answer into a random position', () => {
    const verb = v('書く', 'かく', 'GODAN')
    const positions = new Set(
      [0, 0.3, 0.6, 0.99].map((r) => examChoices(verb, 'TE', () => r).indexOf('かいて')),
    )
    expect(positions.size).toBeGreaterThan(1)
  })
})
