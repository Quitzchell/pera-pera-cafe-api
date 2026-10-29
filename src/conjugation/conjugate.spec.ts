import {
  ALL_FORMS,
  CompoundVerb,
  ConjugationError,
  ConjugationForm,
  RuleGroup,
  Verb,
  VerbClass,
  conjugate,
  supportedForms,
} from '.'

const { GODAN, ICHIDAN, IRREGULAR } = VerbClass

// Expected kanji in ALL_FORMS order; '-' marks a form the verb does not have.
// prettier-ignore
const TABLE: [string, string, VerbClass, string][] = [
  ['買う', 'かう', GODAN, '買います 買いません 買いました 買わない 買わなかった 買って 買った 買える 買われる 買わせる 買わせられる 買おう 買えば 買え 買うな 買えれば'],
  ['会う', 'あう', GODAN, '会います 会いません 会いました 会わない 会わなかった 会って 会った 会える 会われる 会わせる 会わせられる 会おう 会えば 会え 会うな 会えれば'],
  ['待つ', 'まつ', GODAN, '待ちます 待ちません 待ちました 待たない 待たなかった 待って 待った 待てる 待たれる 待たせる 待たせられる 待とう 待てば 待て 待つな 待てれば'],
  ['持つ', 'もつ', GODAN, '持ちます 持ちません 持ちました 持たない 持たなかった 持って 持った 持てる 持たれる 持たせる 持たせられる 持とう 持てば 持て 持つな 持てれば'],
  ['取る', 'とる', GODAN, '取ります 取りません 取りました 取らない 取らなかった 取って 取った 取れる 取られる 取らせる 取らせられる 取ろう 取れば 取れ 取るな 取れれば'],
  ['作る', 'つくる', GODAN, '作ります 作りません 作りました 作らない 作らなかった 作って 作った 作れる 作られる 作らせる 作らせられる 作ろう 作れば 作れ 作るな 作れれば'],
  // Godan -る verbs that look ichidan
  ['帰る', 'かえる', GODAN, '帰ります 帰りません 帰りました 帰らない 帰らなかった 帰って 帰った 帰れる 帰られる 帰らせる 帰らせられる 帰ろう 帰れば 帰れ 帰るな 帰れれば'],
  ['入る', 'はいる', GODAN, '入ります 入りません 入りました 入らない 入らなかった 入って 入った 入れる 入られる 入らせる 入らせられる 入ろう 入れば 入れ 入るな 入れれば'],
  ['走る', 'はしる', GODAN, '走ります 走りません 走りました 走らない 走らなかった 走って 走った 走れる 走られる 走らせる 走らせられる 走ろう 走れば 走れ 走るな 走れれば'],
  ['知る', 'しる', GODAN, '知ります 知りません 知りました 知らない 知らなかった 知って 知った 知れる 知られる 知らせる 知らせられる 知ろう 知れば 知れ 知るな 知れれば'],
  ['切る', 'きる', GODAN, '切ります 切りません 切りました 切らない 切らなかった 切って 切った 切れる 切られる 切らせる 切らせられる 切ろう 切れば 切れ 切るな 切れれば'],
  ['要る', 'いる', GODAN, '要ります 要りません 要りました 要らない 要らなかった 要って 要った 要れる 要られる 要らせる 要らせられる 要ろう 要れば 要れ 要るな 要れれば'],
  ['飲む', 'のむ', GODAN, '飲みます 飲みません 飲みました 飲まない 飲まなかった 飲んで 飲んだ 飲める 飲まれる 飲ませる 飲ませられる 飲もう 飲めば 飲め 飲むな 飲めれば'],
  ['読む', 'よむ', GODAN, '読みます 読みません 読みました 読まない 読まなかった 読んで 読んだ 読める 読まれる 読ませる 読ませられる 読もう 読めば 読め 読むな 読めれば'],
  ['遊ぶ', 'あそぶ', GODAN, '遊びます 遊びません 遊びました 遊ばない 遊ばなかった 遊んで 遊んだ 遊べる 遊ばれる 遊ばせる 遊ばせられる 遊ぼう 遊べば 遊べ 遊ぶな 遊べれば'],
  ['呼ぶ', 'よぶ', GODAN, '呼びます 呼びません 呼びました 呼ばない 呼ばなかった 呼んで 呼んだ 呼べる 呼ばれる 呼ばせる 呼ばせられる 呼ぼう 呼べば 呼べ 呼ぶな 呼べれば'],
  ['死ぬ', 'しぬ', GODAN, '死にます 死にません 死にました 死なない 死ななかった 死んで 死んだ 死ねる 死なれる 死なせる 死なせられる 死のう 死ねば 死ね 死ぬな 死ねれば'],
  ['書く', 'かく', GODAN, '書きます 書きません 書きました 書かない 書かなかった 書いて 書いた 書ける 書かれる 書かせる 書かせられる 書こう 書けば 書け 書くな 書ければ'],
  ['聞く', 'きく', GODAN, '聞きます 聞きません 聞きました 聞かない 聞かなかった 聞いて 聞いた 聞ける 聞かれる 聞かせる 聞かせられる 聞こう 聞けば 聞け 聞くな 聞ければ'],
  ['歩く', 'あるく', GODAN, '歩きます 歩きません 歩きました 歩かない 歩かなかった 歩いて 歩いた 歩ける 歩かれる 歩かせる 歩かせられる 歩こう 歩けば 歩け 歩くな 歩ければ'],
  ['泳ぐ', 'およぐ', GODAN, '泳ぎます 泳ぎません 泳ぎました 泳がない 泳がなかった 泳いで 泳いだ 泳げる 泳がれる 泳がせる 泳がせられる 泳ごう 泳げば 泳げ 泳ぐな 泳げれば'],
  ['急ぐ', 'いそぐ', GODAN, '急ぎます 急ぎません 急ぎました 急がない 急がなかった 急いで 急いだ 急げる 急がれる 急がせる 急がせられる 急ごう 急げば 急げ 急ぐな 急げれば'],
  ['脱ぐ', 'ぬぐ', GODAN, '脱ぎます 脱ぎません 脱ぎました 脱がない 脱がなかった 脱いで 脱いだ 脱げる 脱がれる 脱がせる 脱がせられる 脱ごう 脱げば 脱げ 脱ぐな 脱げれば'],
  ['話す', 'はなす', GODAN, '話します 話しません 話しました 話さない 話さなかった 話して 話した 話せる 話される 話させる 話させられる 話そう 話せば 話せ 話すな 話せれば'],
  ['貸す', 'かす', GODAN, '貸します 貸しません 貸しました 貸さない 貸さなかった 貸して 貸した 貸せる 貸される 貸させる 貸させられる 貸そう 貸せば 貸せ 貸すな 貸せれば'],
  ['出す', 'だす', GODAN, '出します 出しません 出しました 出さない 出さなかった 出して 出した 出せる 出される 出させる 出させられる 出そう 出せば 出せ 出すな 出せれば'],
  ['食べる', 'たべる', ICHIDAN, '食べます 食べません 食べました 食べない 食べなかった 食べて 食べた 食べられる 食べられる 食べさせる 食べさせられる 食べよう 食べれば 食べろ 食べるな 食べられれば'],
  ['見る', 'みる', ICHIDAN, '見ます 見ません 見ました 見ない 見なかった 見て 見た 見られる 見られる 見させる 見させられる 見よう 見れば 見ろ 見るな 見られれば'],
  ['起きる', 'おきる', ICHIDAN, '起きます 起きません 起きました 起きない 起きなかった 起きて 起きた 起きられる 起きられる 起きさせる 起きさせられる 起きよう 起きれば 起きろ 起きるな 起きられれば'],
  ['寝る', 'ねる', ICHIDAN, '寝ます 寝ません 寝ました 寝ない 寝なかった 寝て 寝た 寝られる 寝られる 寝させる 寝させられる 寝よう 寝れば 寝ろ 寝るな 寝られれば'],
  ['教える', 'おしえる', ICHIDAN, '教えます 教えません 教えました 教えない 教えなかった 教えて 教えた 教えられる 教えられる 教えさせる 教えさせられる 教えよう 教えれば 教えろ 教えるな 教えられれば'],
  ['着る', 'きる', ICHIDAN, '着ます 着ません 着ました 着ない 着なかった 着て 着た 着られる 着られる 着させる 着させられる 着よう 着れば 着ろ 着るな 着られれば'],
  ['出る', 'でる', ICHIDAN, '出ます 出ません 出ました 出ない 出なかった 出て 出た 出られる 出られる 出させる 出させられる 出よう 出れば 出ろ 出るな 出られれば'],
  ['行く', 'いく', GODAN, '行きます 行きません 行きました 行かない 行かなかった 行って 行った 行ける 行かれる 行かせる 行かせられる 行こう 行けば 行け 行くな 行ければ'],
  ['ある', 'ある', GODAN, 'あります ありません ありました ない なかった あって あった - - - - - あれば - - -'],
  ['する', 'する', IRREGULAR, 'します しません しました しない しなかった して した できる される させる させられる しよう すれば しろ するな できれば'],
  ['来る', 'くる', IRREGULAR, '来ます 来ません 来ました 来ない 来なかった 来て 来た 来られる 来られる 来させる 来させられる 来よう 来れば 来い 来るな 来られれば'],
]

// prettier-ignore
const COMPOUND_TABLE: [string, string, Verb, string][] = [
  ['勉強', 'べんきょう', { dictionaryForm: 'する', reading: 'する', verbClass: IRREGULAR }, '勉強します 勉強しません 勉強しました 勉強しない 勉強しなかった 勉強して 勉強した 勉強できる 勉強される 勉強させる 勉強させられる 勉強しよう 勉強すれば 勉強しろ 勉強するな 勉強できれば'],
  ['持って', 'もって', { dictionaryForm: '来る', reading: 'くる', verbClass: IRREGULAR }, '持って来ます 持って来ません 持って来ました 持って来ない 持って来なかった 持って来て 持って来た 持って来られる 持って来られる 持って来させる 持って来させられる 持って来よう 持って来れば 持って来い 持って来るな 持って来られれば'],
  ['出て', 'でて', { dictionaryForm: '行く', reading: 'いく', verbClass: GODAN }, '出て行きます 出て行きません 出て行きました 出て行かない 出て行かなかった 出て行って 出て行った 出て行ける 出て行かれる 出て行かせる 出て行かせられる 出て行こう 出て行けば 出て行け 出て行くな 出て行ければ'],
]

// prettier-ignore
const KANA_TABLE: [string, CompoundVerb | Verb, string][] = [
  ['来る', { dictionaryForm: '来る', reading: 'くる', verbClass: IRREGULAR }, 'きます きません きました こない こなかった きて きた こられる こられる こさせる こさせられる こよう くれば こい くるな こられれば'],
  ['持って来る', { prefix: { kanji: '持って', kana: 'もって' }, base: { dictionaryForm: '来る', reading: 'くる', verbClass: IRREGULAR } }, 'もってきます もってきません もってきました もってこない もってこなかった もってきて もってきた もってこられる もってこられる もってこさせる もってこさせられる もってこよう もってくれば もってこい もってくるな もってこられれば'],
  ['勉強する', { prefix: { kanji: '勉強', kana: 'べんきょう' }, base: { dictionaryForm: 'する', reading: 'する', verbClass: IRREGULAR } }, 'べんきょうします べんきょうしません べんきょうしました べんきょうしない べんきょうしなかった べんきょうして べんきょうした べんきょうできる べんきょうされる べんきょうさせる べんきょうさせられる べんきょうしよう べんきょうすれば べんきょうしろ べんきょうするな べんきょうできれば'],
  ['出て行く', { prefix: { kanji: '出て', kana: 'でて' }, base: { dictionaryForm: '行く', reading: 'いく', verbClass: GODAN } }, 'でていきます でていきません でていきました でていかない でていかなかった でていって でていった でていける でていかれる でていかせる でていかせられる でていこう でていけば でていけ でていくな でていければ'],
  ['帰る', { dictionaryForm: '帰る', reading: 'かえる', verbClass: GODAN }, 'かえります かえりません かえりました かえらない かえらなかった かえって かえった かえれる かえられる かえらせる かえらせられる かえろう かえれば かえれ かえるな かえれれば'],
  ['泳ぐ', { dictionaryForm: '泳ぐ', reading: 'およぐ', verbClass: GODAN }, 'およぎます およぎません およぎました およがない およがなかった およいで およいだ およげる およがれる およがせる およがせられる およごう およげば およげ およぐな およげれば'],
  ['着る', { dictionaryForm: '着る', reading: 'きる', verbClass: ICHIDAN }, 'きます きません きました きない きなかった きて きた きられる きられる きさせる きさせられる きよう きれば きろ きるな きられれば'],
]

const formCases = (expected: string) =>
  expected.split(' ').map((value, i) => ({ form: ALL_FORMS[i], value }))

describe('conjugate', () => {
  describe.each(TABLE)('%s (%s, %s)', (dictionaryForm, reading, verbClass, expected) => {
    const verb: Verb = { dictionaryForm, reading, verbClass }

    it.each(formCases(expected))('$form → $value', ({ form, value }) => {
      if (value === '-') {
        expect(() => conjugate(verb, form)).toThrow(ConjugationError)
        expect(supportedForms(verb)).not.toContain(form)
        return
      }
      const result = conjugate(verb, form)
      expect(result.kanji).toBe(value)
      if (verbClass !== IRREGULAR || reading === 'する') {
        // Kana is the kanji form with the kanji stem swapped for the reading's stem.
        expect(result.kana).toBe(
          dictionaryForm === reading
            ? value
            : reading.slice(0, -1) + value.slice(dictionaryForm.length - 1),
        )
      }
    })
  })

  describe.each(COMPOUND_TABLE)('%s + %s', (kanji, kana, base, expected) => {
    const verb: CompoundVerb = { prefix: { kanji, kana }, base }

    it.each(formCases(expected))('$form → $value', ({ form, value }) => {
      expect(conjugate(verb, form).kanji).toBe(value)
    })
  })

  describe.each(KANA_TABLE)('%s in kana', (_label, verb, expected) => {
    it.each(formCases(expected))('$form → $value', ({ form, value }) => {
      expect(conjugate(verb, form).kana).toBe(value)
    })
  })
})

describe('rule groups', () => {
  const v = (dictionaryForm: string, reading: string, verbClass: VerbClass): Verb => ({
    dictionaryForm,
    reading,
    verbClass,
  })

  it.each([
    [v('買う', 'かう', GODAN), ConjugationForm.NEGATIVE, RuleGroup.GODAN_U_TSU_RU],
    [v('待つ', 'まつ', GODAN), ConjugationForm.TE, RuleGroup.GODAN_U_TSU_RU],
    [v('帰る', 'かえる', GODAN), ConjugationForm.TE, RuleGroup.GODAN_U_TSU_RU],
    [v('飲む', 'のむ', GODAN), ConjugationForm.TE, RuleGroup.GODAN_MU_BU_NU],
    [v('遊ぶ', 'あそぶ', GODAN), ConjugationForm.PAST, RuleGroup.GODAN_MU_BU_NU],
    [v('死ぬ', 'しぬ', GODAN), ConjugationForm.TE, RuleGroup.GODAN_MU_BU_NU],
    [v('書く', 'かく', GODAN), ConjugationForm.TE, RuleGroup.GODAN_KU],
    [v('泳ぐ', 'およぐ', GODAN), ConjugationForm.TE, RuleGroup.GODAN_GU],
    [v('話す', 'はなす', GODAN), ConjugationForm.TE, RuleGroup.GODAN_SU],
    [v('着る', 'きる', ICHIDAN), ConjugationForm.TE, RuleGroup.ICHIDAN],
    [v('行く', 'いく', GODAN), ConjugationForm.TE, RuleGroup.EXCEPTION_IKU],
    [v('行く', 'いく', GODAN), ConjugationForm.PAST, RuleGroup.EXCEPTION_IKU],
    [v('行く', 'いく', GODAN), ConjugationForm.NEGATIVE, RuleGroup.GODAN_KU],
    [v('ある', 'ある', GODAN), ConjugationForm.NEGATIVE, RuleGroup.EXCEPTION_ARU],
    [v('ある', 'ある', GODAN), ConjugationForm.PAST_NEGATIVE, RuleGroup.EXCEPTION_ARU],
    [v('ある', 'ある', GODAN), ConjugationForm.TE, RuleGroup.GODAN_U_TSU_RU],
    [v('する', 'する', IRREGULAR), ConjugationForm.POTENTIAL, RuleGroup.IRREGULAR_SURU],
    [v('来る', 'くる', IRREGULAR), ConjugationForm.NEGATIVE, RuleGroup.IRREGULAR_KURU],
  ])('%o %s → %s', (verb, form, ruleGroup) => {
    expect(conjugate(verb, form).ruleGroup).toBe(ruleGroup)
  })

  it('uses the base verb group for compounds', () => {
    const base = v('行く', 'いく', GODAN)
    expect(conjugate({ prefix: { kanji: '出て', kana: 'でて' }, base }, 'TE').ruleGroup).toBe(
      RuleGroup.EXCEPTION_IKU,
    )
    expect(
      conjugate(
        { prefix: { kanji: '勉強', kana: 'べんきょう' }, base: v('する', 'する', IRREGULAR) },
        'POTENTIAL',
      ).ruleGroup,
    ).toBe(RuleGroup.IRREGULAR_SURU)
  })
})

describe('rule hints', () => {
  it.each([
    [
      { dictionaryForm: '泳ぐ', reading: 'およぐ', verbClass: GODAN },
      'TE',
      'ぐ → いで (泳ぐ → 泳いで)',
    ],
    [
      { dictionaryForm: '買う', reading: 'かう', verbClass: GODAN },
      'NEGATIVE',
      'う → わない (買う → 買わない)',
    ],
    [
      { dictionaryForm: '食べる', reading: 'たべる', verbClass: ICHIDAN },
      'POTENTIAL',
      'る → られる (食べる → 食べられる)',
    ],
    [
      { dictionaryForm: '来る', reading: 'くる', verbClass: IRREGULAR },
      'NEGATIVE',
      'くる → こない (来る → 来ない)',
    ],
    [
      { dictionaryForm: '行く', reading: 'いく', verbClass: GODAN },
      'TE',
      'Exception: 行く → 行って, not 行いて',
    ],
    [
      { dictionaryForm: 'ある', reading: 'ある', verbClass: GODAN },
      'NEGATIVE',
      'Exception: ある → ない, not あらない',
    ],
    [
      {
        prefix: { kanji: '勉強', kana: 'べんきょう' },
        base: { dictionaryForm: 'する', reading: 'する', verbClass: IRREGULAR },
      },
      'POTENTIAL',
      'する → できる (勉強する → 勉強できる)',
    ],
    [
      {
        prefix: { kanji: '出て', kana: 'でて' },
        base: { dictionaryForm: '行く', reading: 'いく', verbClass: GODAN },
      },
      'PAST',
      'Exception: 出て行く → 出て行った, not 出て行いた',
    ],
  ] as [Verb | CompoundVerb, ConjugationForm, string][])('%o %s', (verb, form, hint) => {
    expect(conjugate(verb, form).ruleHint).toBe(hint)
  })
})

describe('causative-passive alternatives', () => {
  it('accepts the short godan form next to the canonical long form', () => {
    const result = conjugate(
      { dictionaryForm: '書く', reading: 'かく', verbClass: GODAN },
      'CAUSATIVE_PASSIVE',
    )
    expect(result.kanji).toBe('書かせられる')
    expect(result.alternatives).toEqual([{ kanji: '書かされる', kana: 'かかされる' }])
  })

  it('keeps the prefix on compound alternatives', () => {
    const base: Verb = { dictionaryForm: '行く', reading: 'いく', verbClass: GODAN }
    expect(
      conjugate({ prefix: { kanji: '出て', kana: 'でて' }, base }, 'CAUSATIVE_PASSIVE')
        .alternatives,
    ).toEqual([{ kanji: '出て行かされる', kana: 'でていかされる' }])
  })

  it.each([
    { dictionaryForm: '話す', reading: 'はなす', verbClass: GODAN },
    { dictionaryForm: '食べる', reading: 'たべる', verbClass: ICHIDAN },
    { dictionaryForm: 'する', reading: 'する', verbClass: IRREGULAR },
    { dictionaryForm: '来る', reading: 'くる', verbClass: IRREGULAR },
  ] as Verb[])('has no short form for $dictionaryForm', (verb) => {
    expect(conjugate(verb, 'CAUSATIVE_PASSIVE').alternatives).toEqual([])
  })

  it('has no alternatives for other forms', () => {
    const verb: Verb = { dictionaryForm: '書く', reading: 'かく', verbClass: GODAN }
    for (const form of ALL_FORMS.filter((f) => f !== 'CAUSATIVE_PASSIVE')) {
      expect(conjugate(verb, form).alternatives).toEqual([])
    }
  })
})

describe('invalid verbs', () => {
  it.each([
    [{ dictionaryForm: '食べる', reading: 'たべ', verbClass: ICHIDAN }, 'mismatched endings'],
    [{ dictionaryForm: '死に', reading: 'しに', verbClass: GODAN }, 'no godan ending'],
    [{ dictionaryForm: '泳ぐ', reading: 'およぐ', verbClass: ICHIDAN }, 'ichidan without る'],
    [
      { dictionaryForm: '食べる', reading: 'たべる', verbClass: IRREGULAR },
      'irregular other than する/来る',
    ],
  ] as [Verb, string][])('rejects %o (%s)', (verb) => {
    expect(() => conjugate(verb, 'POLITE')).toThrow(ConjugationError)
  })
})
