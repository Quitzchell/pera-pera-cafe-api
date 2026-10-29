import { ConjugationForm } from '../src/conjugation'
import { rebuildRuleProgress } from '../src/drill/rule-progress'
import { createApp, createUser, expectedAnswer, seedVerbs, signIn, TestApp, VERBS } from './helpers'

interface RoundItem {
  id: string
  form: ConjugationForm
  choices?: string[]
  verb: { dictionaryForm: string }
}

describe('Drill (e2e)', () => {
  let t: TestApp
  let learner: Record<string, string>

  beforeEach(async () => {
    t = await createApp()
    await seedVerbs(t.prisma)
    await createUser(t, { email: 'learner@example.com' })
    learner = await signIn(t, 'learner@example.com')
  })

  afterEach(async () => {
    await t.app.close()
  })

  const settings = (body: object) =>
    t.http().patch('/api/me/settings').set(learner).send(body).expect(200)
  const startRound = (mode: string) =>
    t.http().post('/api/drill/rounds').set(learner).send({ mode })
  const answer = (
    headers: Record<string, string>,
    roundId: string,
    itemId: string,
    value: string,
  ) =>
    t
      .http()
      .post(`/api/drill/rounds/${roundId}/items/${itemId}/answer`)
      .set(headers)
      .send({ answer: value })

  it('creates settings with defaults and validates changes', async () => {
    const { body } = await t.http().get('/api/me/settings').set(learner).expect(200)
    expect(body).toEqual({
      enabledForms: expect.arrayContaining(['TE', 'POTENTIAL_CONDITIONAL']),
      jlptLevels: ['N5', 'N4'],
      roundSize: 20,
      romajiInput: false,
      showFurigana: true,
      timeZone: 'UTC',
    })
    expect(body.enabledForms).toHaveLength(16)

    const updated = await settings({ roundSize: 10, enabledForms: ['TE'], showFurigana: false })
    expect(updated.body).toMatchObject({ roundSize: 10, enabledForms: ['TE'], showFurigana: false })

    for (const invalid of [{ roundSize: 2 }, { enabledForms: [] }, { jlptLevels: ['N9'] }]) {
      await t.http().patch('/api/me/settings').set(learner).send(invalid).expect(400)
    }
  })

  it('plays a full standard round and keeps progress rebuildable from the attempt log', async () => {
    await settings({ roundSize: 5 })
    const { body: round } = await startRound('STANDARD').expect(201)
    const items = round.items as RoundItem[]

    expect(items).toHaveLength(5)
    expect(new Set(items.map((i) => i.verb.dictionaryForm)).size).toBe(5)
    expect(JSON.stringify(round)).not.toMatch(/kanji|kana|choices/)

    const [first, second, ...rest] = items
    const right = await expectedAnswer(t.prisma, first.id)
    const result = await answer(learner, round.id, first.id, `${right.kana}。`).expect(200)
    expect(result.body).toEqual({
      isCorrect: true,
      expected: { kanji: right.kanji, kana: right.kana },
      ruleGroup: right.ruleGroup,
      ruleHint: right.ruleHint,
    })
    await answer(learner, round.id, first.id, right.kana).expect(409)

    await answer(learner, round.id, second.id, 'わからない')
      .expect(200)
      .expect((res) => {
        expect(res.body.isCorrect).toBe(false)
      })
    for (const item of rest) {
      await answer(learner, round.id, item.id, (await expectedAnswer(t.prisma, item.id)).kanji)
    }

    const { body: summary } = await t
      .http()
      .post(`/api/drill/rounds/${round.id}/finish`)
      .set(learner)
      .expect(200)
    const secondExpected = await expectedAnswer(t.prisma, second.id)
    expect(summary).toMatchObject({ total: 5, answered: 5, correct: 4 })
    expect(summary.mistakes).toEqual([
      expect.objectContaining({
        itemId: second.id,
        answer: 'わからない',
        expected: { kanji: secondExpected.kanji, kana: secondExpected.kana },
        ruleHint: secondExpected.ruleHint,
      }),
    ])
    await answer(learner, round.id, first.id, right.kana).expect(409)

    const { id: userId } = await t.prisma.user.findUniqueOrThrow({
      where: { email: 'learner@example.com' },
    })
    const live = await t.prisma.ruleProgress.findMany({
      where: { userId },
      orderBy: [{ form: 'asc' }, { ruleGroup: 'asc' }],
    })
    expect(live.reduce((sum, row) => sum + row.attemptCount, 0)).toBe(5)
    await rebuildRuleProgress(t.prisma, userId)
    const rebuilt = await t.prisma.ruleProgress.findMany({
      where: { userId },
      orderBy: [{ form: 'asc' }, { ruleGroup: 'asc' }],
    })
    expect(rebuilt).toEqual(live)
  })

  it('marks ra-nuki wrong with a note', async () => {
    await settings({ roundSize: VERBS.length, enabledForms: ['POTENTIAL'] })
    const { body: round } = await startRound('STANDARD').expect(201)
    const item = (round.items as RoundItem[]).find((i) => i.verb.dictionaryForm === '見る')!

    const { body } = await answer(learner, round.id, item.id, '見れる').expect(200)
    expect(body).toMatchObject({
      isCorrect: false,
      note: 'Colloquial. In written / exam Japanese use 見られる.',
    })
  })

  it('keeps other learners out of a round', async () => {
    const { body: round } = await startRound('STANDARD').expect(201)
    await createUser(t, { email: 'other@example.com' })
    const other = await signIn(t, 'other@example.com')

    await answer(other, round.id, round.items[0].id, 'x').expect(404, {
      statusCode: 404,
      error: 'Not Found',
      message: 'Round not found',
    })
    await t.http().post(`/api/drill/rounds/${round.id}/finish`).set(other).expect(404)
    await answer(learner, round.id, 'not-an-item', 'x').expect(404)
  })

  it('offers 4 choices in exam mode, one of them correct', async () => {
    await settings({ roundSize: 5 })
    const { body: round } = await startRound('EXAM').expect(201)

    for (const item of round.items as RoundItem[]) {
      expect(item.choices).toHaveLength(4)
      expect(item.choices).toContain((await expectedAnswer(t.prisma, item.id)).kana)
    }
  })

  it('pairs forms of the same verb back to back in contrast mode', async () => {
    await settings({ roundSize: 6, enabledForms: ['TE', 'PAST'] })
    const { body: round } = await startRound('CONTRAST').expect(201)
    const items = round.items as RoundItem[]

    expect(items).toHaveLength(6)
    for (let i = 0; i < items.length; i += 2) {
      expect(items[i].verb).toEqual(items[i + 1].verb)
      expect([items[i].form, items[i + 1].form].sort()).toEqual(['PAST', 'TE'])
    }

    await settings({ enabledForms: ['TE', 'POTENTIAL'] })
    await startRound('CONTRAST').expect(400)
  })

  it('keeps progress consistent when answers arrive at the same time', async () => {
    await settings({ roundSize: VERBS.length, enabledForms: ['TE'] })
    const { body: round } = await startRound('STANDARD').expect(201)

    await Promise.all(
      (round.items as RoundItem[]).map(async (item) =>
        answer(learner, round.id, item.id, (await expectedAnswer(t.prisma, item.id)).kana).expect(
          200,
        ),
      ),
    )

    const { id: userId } = await t.prisma.user.findUniqueOrThrow({
      where: { email: 'learner@example.com' },
    })
    const order = [{ form: 'asc' as const }, { ruleGroup: 'asc' as const }]
    const live = await t.prisma.ruleProgress.findMany({ where: { userId }, orderBy: order })
    expect(live.find((row) => row.ruleGroup === 'ICHIDAN')?.attemptCount).toBe(2)
    await rebuildRuleProgress(t.prisma, userId)
    expect(await t.prisma.ruleProgress.findMany({ where: { userId }, orderBy: order })).toEqual(
      live,
    )
  })

  it('copes with a verb the admin changed during the round', async () => {
    await settings({ roundSize: VERBS.length, enabledForms: ['TE'] })
    const { body: round } = await startRound('STANDARD').expect(201)
    const items = round.items as RoundItem[]
    const itemFor = (dictionaryForm: string) =>
      items.find((i) => i.verb.dictionaryForm === dictionaryForm)!

    await answer(learner, round.id, itemFor('書く').id, 'wrong').expect(200)
    // Godan verbs ending in く cannot be conjugated as ichidan.
    await t.prisma.verb.updateMany({
      where: { dictionaryForm: { in: ['書く', '泳ぐ'] } },
      data: { verbClass: 'ICHIDAN' },
    })

    await answer(learner, round.id, itemFor('泳ぐ').id, 'およいで')
      .expect(409)
      .expect((res) =>
        expect(res.body.message).toBe('This verb was changed during the round; skip this item'),
      )
    const { body: summary } = await t
      .http()
      .post(`/api/drill/rounds/${round.id}/finish`)
      .set(learner)
      .expect(200)
    expect(summary).toMatchObject({ answered: 1, correct: 0, mistakes: [] })
  })

  it('explains when no verbs match the settings', async () => {
    await settings({ jlptLevels: ['N3'] })
    const { body } = await startRound('STANDARD').expect(400)
    expect(body.message).toBe('No verbs match your settings')
  })
})
