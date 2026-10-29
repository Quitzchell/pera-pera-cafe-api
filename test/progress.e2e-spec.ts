import { Role } from '../generated/prisma/client'
import { createApp, createUser, expectedAnswer, seedVerbs, signIn, TestApp } from './helpers'

describe('Progress (e2e)', () => {
  let t: TestApp
  let learner: Record<string, string>
  let learnerId: string

  beforeEach(async () => {
    t = await createApp()
    await seedVerbs(t.prisma)
    learnerId = (await createUser(t, { email: 'learner@example.com' })).id
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
    await createUser(t, { email: 'admin@example.com', role: Role.ADMIN })
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

  it('exports one row per rule group as CSV or JSON', async () => {
    await playRound(learner)

    const csv = await t.http().get('/api/progress/export?format=csv').set(learner).expect(200)
    expect(csv.get('Content-Type')).toMatch(/^text\/csv/)
    expect(csv.get('Content-Disposition')).toMatch(/^attachment; filename="?progress\.csv"?$/)
    const [header, ...lines] = csv.text.trim().split('\n')
    expect(header).toBe('form,ruleGroup,attemptCount,accuracy,box,lastPracticedAt')
    expect(lines.length).toBeGreaterThan(0)

    const json = await t.http().get('/api/progress/export').set(learner).expect(200)
    expect(json.get('Content-Disposition')).toMatch(/^attachment; filename="?progress\.json"?$/)
    expect(json.body).toHaveLength(lines.length)
    expect(Object.keys(json.body[0])).toEqual(header.split(','))

    await t.http().get('/api/progress/export?format=xml').set(learner).expect(400)
  })

  it('shows learners only their own progress, and admins anyone', async () => {
    await playRound(learner)
    await createUser(t, { email: 'other@example.com' })
    const other = await signIn(t, 'other')
    const { body: otherProgress } = await t.http().get('/api/progress').set(other).expect(200)
    expect(otherProgress.totals.attempts).toBe(0)

    await t.http().get(`/api/admin/users/${learnerId}/progress`).set(other).expect(403)

    await createUser(t, { email: 'admin@example.com', role: Role.ADMIN })
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
