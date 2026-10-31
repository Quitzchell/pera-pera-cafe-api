import { Role } from '../generated/prisma/client'
import { createApp, createUser, expectedAnswer, seedVerbs, signIn, TestApp } from './helpers'

describe('Progress (e2e)', () => {
  let t: TestApp
  let learner: Record<string, string>
  let learnerId: string

  beforeEach(async () => {
    t = await createApp()
    await seedVerbs(t.prisma)
    learnerId = (await createUser(t, { username: 'learner' })).id
    learner = await signIn(t, 'learner')
  })

  afterEach(async () => {
    await t.app.close()
  })

  // Answers every item correctly except the first, then finishes the round.
  async function playRound(headers: Record<string, string>) {
    await t.http().patch('/api/me/settings').set(headers).send({ roundSize: 5 }).expect(200)
    const { body: round } = await t
      .http()
      .post('/api/drill/rounds')
      .set(headers)
      .send({ mode: 'STANDARD' })
      .expect(201)
    for (const [index, item] of (round.items as { id: string }[]).entries()) {
      const answer = index === 0 ? 'wrong' : (await expectedAnswer(t.prisma, item.id)).kana
      await t
        .http()
        .post(`/api/drill/rounds/${round.id}/items/${item.id}/answer`)
        .set(headers)
        .send({ answer })
        .expect(200)
    }
    await t.http().post(`/api/drill/rounds/${round.id}/finish`).set(headers).expect(200)
  }

  it('starts empty', async () => {
    const { body } = await t.http().get('/api/progress').set(learner).expect(200)
    expect(body).toEqual({
      totals: { attempts: 0, correct: 0, accuracy: 0, roundsFinished: 0, dueToday: 0 },
      streak: 0,
      ruleGroups: [],
    })
  })

  it('does not count a round finished without answers', async () => {
    const { body: round } = await t
      .http()
      .post('/api/drill/rounds')
      .set(learner)
      .send({ mode: 'STANDARD' })
      .expect(201)
    await t.http().post(`/api/drill/rounds/${round.id}/finish`).set(learner).expect(200)

    const { body } = await t.http().get('/api/progress').set(learner).expect(200)
    expect(body.totals.roundsFinished).toBe(0)
    expect(body.streak).toBe(0)
  })

  it('reads settings without creating them', async () => {
    await createUser(t, { username: 'admin', role: Role.ADMIN })
    const admin = await signIn(t, 'admin')
    await t.http().get(`/api/admin/users/${learnerId}/progress`).set(admin).expect(200)
    await t.http().get('/api/progress').set(learner).expect(200)
    expect(await t.prisma.userSettings.count()).toBe(0)
  })

  it('reports totals, the streak and rule groups weakest first', async () => {
    await playRound(learner)

    const { body } = await t.http().get('/api/progress').set(learner).expect(200)
    expect(body.totals).toEqual({
      attempts: 5,
      correct: 4,
      accuracy: 0.8,
      roundsFinished: 1,
      dueToday: 0,
    })
    expect(body.streak).toBe(1)
    expect(body.ruleGroups[0]).toMatchObject({ accuracy: 0, box: 0, attemptCount: 1 })
    expect(body.ruleGroups[body.ruleGroups.length - 1]).toMatchObject({ accuracy: 1, box: 1 })
    expect(Object.keys(body.ruleGroups[0]).sort()).toEqual(
      [
        'accuracy',
        'attemptCount',
        'box',
        'correctCount',
        'dueAt',
        'form',
        'lastPracticedAt',
        'ruleGroup',
      ].sort(),
    )
  })

  it('counts due rule groups and streak days in the learner time zone', async () => {
    await t
      .http()
      .patch('/api/me/settings')
      .set(learner)
      .send({ timeZone: 'Mars/Olympus' })
      .expect(400)
    await t
      .http()
      .patch('/api/me/settings')
      .set(learner)
      .send({ timeZone: 'Asia/Tokyo' })
      .expect(200)
      .expect((res) => expect(res.body.timeZone).toBe('Asia/Tokyo'))

    const day = 86_400_000
    const now = Date.now()
    const { id: verbId } = await t.prisma.verb.findFirstOrThrow()
    for (const daysAgo of [1, 2]) {
      await t.prisma.drillRound.create({
        data: {
          userId: learnerId,
          mode: 'STANDARD',
          finishedAt: new Date(now - daysAgo * day),
          items: {
            create: {
              verbId,
              form: 'TE',
              position: 0,
              attempt: {
                create: {
                  userId: learnerId,
                  verbId,
                  form: 'TE',
                  ruleGroup: 'GODAN_KU',
                  answer: 'x',
                  isCorrect: false,
                },
              },
            },
          },
        },
      })
    }
    await t.prisma.ruleProgress.create({
      data: {
        userId: learnerId,
        form: 'TE',
        ruleGroup: 'GODAN_KU',
        box: 0,
        dueAt: new Date(now - day),
        attemptCount: 1,
        correctCount: 0,
        lastPracticedAt: new Date(now - 2 * day),
      },
    })

    const { body } = await t.http().get('/api/progress').set(learner).expect(200)
    expect(body.streak).toBe(2)
    expect(body.totals.dueToday).toBe(1)
  })

  it('exports one row per rule group as CSV', async () => {
    await playRound(learner)

    const csv = await t.http().get('/api/progress/export?format=csv').set(learner).expect(200)
    expect(csv.get('Content-Type')).toMatch(/^text\/csv/)
    expect(csv.get('Content-Disposition')).toMatch(/^attachment; filename="?progress\.csv"?$/)
    const [header, ...lines] = csv.text.trim().split('\n')
    expect(header).toBe('form,ruleGroup,attemptCount,accuracy,box,lastPracticedAt')
    expect(lines.length).toBeGreaterThan(0)

    await t.http().get('/api/progress/export?format=xml').set(learner).expect(400)
  })

  it('exports totals, rule progress and recent mistakes as JSON', async () => {
    await playRound(learner)

    const json = await t.http().get('/api/progress/export').set(learner).expect(200)
    expect(json.get('Content-Disposition')).toMatch(/^attachment; filename="?progress\.json"?$/)
    const { body } = json
    expect(Object.keys(body)).toEqual(['exportedAt', 'totals', 'ruleProgress', 'recentMistakes'])
    expect(Date.now() - Date.parse(body.exportedAt)).toBeLessThan(60_000)
    expect(body.totals).toEqual({ rounds: 1, attempts: 5, accuracy: 0.8, streak: 1 })

    const { body: progress } = await t.http().get('/api/progress').set(learner).expect(200)
    expect(body.ruleProgress).toHaveLength(progress.ruleGroups.length)
    expect(Object.keys(body.ruleProgress[0])).toEqual([
      'form',
      'ruleGroup',
      'attemptCount',
      'accuracy',
      'box',
      'lastPracticedAt',
      'dueAt',
    ])

    const missed = await t.prisma.attempt.findFirstOrThrow({
      where: { isCorrect: false },
      include: { drillItem: true },
    })
    const expected = await expectedAnswer(t.prisma, missed.drillItemId)
    const verb = await t.prisma.verb.findUniqueOrThrow({ where: { id: missed.verbId } })
    expect(body.recentMistakes).toEqual([
      {
        createdAt: missed.createdAt.toISOString(),
        mode: 'STANDARD',
        verb: { dictionaryForm: verb.dictionaryForm, reading: verb.reading },
        form: missed.form,
        ruleGroup: missed.ruleGroup,
        expected: { kanji: expected.kanji, kana: expected.kana },
        answer: 'wrong',
      },
    ])
  })

  it('exports only the 30 most recent mistakes, newest first', async () => {
    const verb = await t.prisma.verb.findFirstOrThrow({ where: { dictionaryForm: '書く' } })
    const start = Date.now() - 3_600_000
    await t.prisma.drillRound.create({
      data: {
        userId: learnerId,
        mode: 'EXAM',
        items: {
          create: Array.from({ length: 32 }, (_, i) => ({
            verbId: verb.id,
            form: 'TE' as const,
            position: i,
            attempt: {
              create: {
                userId: learnerId,
                verbId: verb.id,
                form: 'TE' as const,
                ruleGroup: 'GODAN_KU' as const,
                answer: `wrong ${i}`,
                isCorrect: i === 31,
                createdAt: new Date(start + i * 1000),
              },
            },
          })),
        },
      },
    })

    const { body } = await t.http().get('/api/progress/export?format=json').set(learner).expect(200)
    expect(body.recentMistakes).toHaveLength(30)
    expect(body.recentMistakes[0]).toMatchObject({
      answer: 'wrong 30',
      mode: 'EXAM',
      expected: { kanji: '書いて', kana: 'かいて' },
    })
    expect(body.recentMistakes[29].answer).toBe('wrong 1')
  })

  it('shows learners only their own progress, and admins anyone', async () => {
    await playRound(learner)
    await createUser(t, { username: 'other' })
    const other = await signIn(t, 'other')
    const { body: otherProgress } = await t.http().get('/api/progress').set(other).expect(200)
    expect(otherProgress.totals.attempts).toBe(0)

    await t.http().get(`/api/admin/users/${learnerId}/progress`).set(other).expect(403)

    await createUser(t, { username: 'admin', role: Role.ADMIN })
    const admin = await signIn(t, 'admin')
    const { body: own } = await t.http().get('/api/progress').set(learner).expect(200)
    await t
      .http()
      .get(`/api/admin/users/${learnerId}/progress`)
      .set(admin)
      .expect(200)
      .expect((res) => expect(res.body).toEqual(own))
    await t.http().get('/api/admin/users/missing/progress').set(admin).expect(404)
  })
})
