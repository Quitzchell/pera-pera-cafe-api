import { Role } from '../generated/prisma/client'
import { createApp, createUser, signIn, TestApp } from './helpers'

const kaeru = {
  dictionaryForm: '帰る',
  reading: 'かえる',
  meaning: 'to go home',
  verbClass: 'GODAN',
  jlptLevel: 'N5',
}

describe('Admin verbs (e2e)', () => {
  let t: TestApp
  let admin: Record<string, string>

  beforeEach(async () => {
    t = await createApp()
    await createUser(t, { email: 'admin@example.com', role: Role.ADMIN })
    admin = await signIn(t, 'admin@example.com')
  })

  afterEach(async () => {
    await t.app.close()
  })

  const post = (body: object) => t.http().post('/api/admin/verbs').set(admin).send(body)

  it('creates a verb and rejects a duplicate', async () => {
    const { body } = await post(kaeru).expect(201)
    expect(body).toEqual({
      verb: expect.objectContaining({ ...kaeru, isActive: true, excludedForms: [] }),
      warnings: [],
    })
    await post(kaeru).expect(409)
  })

  it('warns about a godan verb marked ichidan, and still saves it', async () => {
    const { body } = await post({ ...kaeru, verbClass: 'ICHIDAN' }).expect(201)
    expect(body.warnings).toEqual(['帰る is usually godan, not ichidan'])
  })

  it.each([
    [
      { ...kaeru, dictionaryForm: '分かる', reading: 'わかる', verbClass: 'ICHIDAN' },
      'Ichidan verbs end in -iru or -eru',
    ],
    [{ ...kaeru, reading: 'kaeru' }, 'Reading must be hiragana'],
    [{ ...kaeru, verbClass: undefined }, 'verbClass is required'],
    [
      { ...kaeru, excludedForms: ['TE', 'NOPE'] },
      [
        'each value in excludedForms must be one of the following values: POLITE, POLITE_NEGATIVE, POLITE_PAST, NEGATIVE, PAST_NEGATIVE, TE, PAST, POTENTIAL, PASSIVE, CAUSATIVE, CAUSATIVE_PASSIVE, VOLITIONAL, CONDITIONAL_BA, IMPERATIVE, PROHIBITIVE',
      ],
    ],
  ])('rejects %o', async (body, message) => {
    await post(body)
      .expect(400)
      .expect((res) => expect(res.body.message).toEqual(message))
  })

  it('creates a compound that takes its class from the base verb', async () => {
    const suru = await post({
      ...kaeru,
      dictionaryForm: 'する',
      reading: 'する',
      verbClass: 'IRREGULAR',
    })
    const { body } = await post({
      dictionaryForm: '勉強する',
      reading: 'べんきょうする',
      meaning: 'to study',
      jlptLevel: 'N5',
      baseVerbId: suru.body.verb.id,
    }).expect(201)
    expect(body.verb).toMatchObject({ verbClass: 'IRREGULAR', baseVerbId: suru.body.verb.id })

    await post({
      ...kaeru,
      dictionaryForm: '勉強',
      reading: 'べんきょう',
      baseVerbId: suru.body.verb.id,
    })
      .expect(400)
      .expect((res) =>
        expect(res.body.message).toBe('A compound must end in its base verb する (する)'),
      )

    await t
      .http()
      .patch(`/api/admin/verbs/${suru.body.verb.id}`)
      .set(admin)
      .send({ verbClass: 'GODAN' })
      .expect(400)
  })

  it('updates a verb and re-checks it', async () => {
    const created = await post(kaeru)
    const url = `/api/admin/verbs/${created.body.verb.id}`

    const { body } = await t
      .http()
      .patch(url)
      .set(admin)
      .send({ excludedForms: ['IMPERATIVE'], isActive: false })
      .expect(200)
    expect(body.verb).toMatchObject({ ...kaeru, excludedForms: ['IMPERATIVE'], isActive: false })

    const warned = await t.http().patch(url).set(admin).send({ verbClass: 'ICHIDAN' }).expect(200)
    expect(warned.body.warnings).toEqual(['帰る is usually godan, not ichidan'])

    await t.http().patch('/api/admin/verbs/missing').set(admin).send({}).expect(404)
  })

  it('searches by kanji, kana and meaning', async () => {
    await post(kaeru)
    await post({ ...kaeru, dictionaryForm: '書く', reading: 'かく', meaning: 'to write' })

    for (const q of ['帰', 'かえ', 'HOME']) {
      const { body } = await t.http().get('/api/admin/verbs').query({ q }).set(admin).expect(200)
      expect(body).toEqual([expect.objectContaining({ dictionaryForm: '帰る' })])
    }
    const all = await t.http().get('/api/admin/verbs').set(admin).expect(200)
    expect(all.body).toHaveLength(2)
  })

  it('keeps learners out', async () => {
    await createUser(t, { email: 'learner@example.com' })
    const learner = await signIn(t, 'learner@example.com')
    await t.http().get('/api/admin/verbs').set(learner).expect(403)
    await t.http().post('/api/admin/verbs').set(learner).send(kaeru).expect(403)
  })
})
