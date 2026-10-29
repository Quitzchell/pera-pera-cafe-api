import { UserStatus } from '../generated/prisma/client'
import { createApp, createUser, PASSWORD, signIn, TestApp } from './helpers'

describe('Auth (e2e)', () => {
  let t: TestApp

  beforeEach(async () => {
    t = await createApp()
  })

  afterEach(async () => {
    await t.app.close()
  })

  it('signs in with an httpOnly session cookie and returns a CSRF token', async () => {
    await createUser(t, { email: 'learner@example.com' })

    const response = await t
      .http()
      .post('/api/auth/login')
      .send({ username: 'Learner', password: PASSWORD })
      .expect(200)

    expect(response.get('Set-Cookie')?.[0]).toMatch(
      /^session=.+; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/,
    )
    expect(response.body).toEqual({
      user: expect.objectContaining({ username: 'learner', role: 'LEARNER' }),
      csrfToken: expect.any(String),
    })
    expect(response.body.user).not.toHaveProperty('passwordHash')
    expect(response.body.user).not.toHaveProperty('email')
  })

  it('returns the same 401 for a wrong password and an unknown username', async () => {
    await createUser(t, { email: 'learner@example.com' })
    const body = { statusCode: 401, error: 'Unauthorized', message: 'Invalid username or password' }

    await t
      .http()
      .post('/api/auth/login')
      .send({ username: 'learner', password: 'wrong password!' })
      .expect(401, body)
    await t
      .http()
      .post('/api/auth/login')
      .send({ username: 'nobody', password: PASSWORD })
      .expect(401, body)
  })

  it('returns validation errors in the shared error shape', async () => {
    const response = await t.http().post('/api/auth/login').send({}).expect(400)
    expect(response.body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.arrayContaining(['username should not be empty']),
    })
  })

  it('slows sign-in down after 5 failures with a wait that grows per failure', async () => {
    await createUser(t, { email: 'learner@example.com' })
    const login = (password: string) =>
      t.http().post('/api/auth/login').send({ username: 'learner', password })
    const where = { email: 'learner@example.com' }
    const waitMinutes = async () => {
      const { lockedUntil } = await t.prisma.user.findUniqueOrThrow({ where })
      return lockedUntil ? Math.round((lockedUntil.getTime() - Date.now()) / 60_000) : 0
    }
    const endWait = () =>
      t.prisma.user.update({ where, data: { lockedUntil: new Date(Date.now() - 1000) } })

    for (let i = 0; i < 4; i++) {
      await login('wrong password!').expect(401)
    }
    expect(await waitMinutes()).toBe(0)
    await login('wrong password!').expect(401)
    expect(await waitMinutes()).toBe(1)

    // During the wait even the right password is refused, and the try does not count.
    await login(PASSWORD).expect(401)
    await login('wrong password!').expect(401)
    expect(await t.prisma.user.findUniqueOrThrow({ where })).toMatchObject({ failedLoginCount: 5 })

    await endWait()
    await login('wrong password!').expect(401)
    expect(await waitMinutes()).toBe(2)

    await endWait()
    await login(PASSWORD).expect(200)
    expect(await t.prisma.user.findUniqueOrThrow({ where })).toMatchObject({
      failedLoginCount: 0,
      lockedUntil: null,
    })
  })

  it('caps the wait at 15 minutes', async () => {
    await createUser(t, { email: 'learner@example.com', failedLoginCount: 30 })
    await t.http().post('/api/auth/login').send({ username: 'learner', password: 'nope' })
    const { lockedUntil } = await t.prisma.user.findUniqueOrThrow({
      where: { email: 'learner@example.com' },
    })
    expect(Math.round((lockedUntil!.getTime() - Date.now()) / 60_000)).toBe(15)
  })

  it('rate-limits login attempts per IP', async () => {
    for (let i = 0; i < 10; i++) {
      await t
        .http()
        .post('/api/auth/login')
        .send({ username: `user${i}`, password: PASSWORD })
        .expect(401)
    }
    const response = await t
      .http()
      .post('/api/auth/login')
      .send({ username: 'user', password: PASSWORD })
      .expect(429)
    expect(response.body.error).toBe('Too Many Requests')
  })

  it('rejects requests without a session', async () => {
    await t
      .http()
      .get('/api/auth/me')
      .expect(401, { statusCode: 401, error: 'Unauthorized', message: 'Not signed in' })
  })

  it('requires the CSRF token for state-changing requests', async () => {
    await createUser(t, { email: 'learner@example.com' })
    const headers = await signIn(t, 'learner')

    await t.http().post('/api/auth/logout').set('Cookie', headers.Cookie).expect(403)
    await t
      .http()
      .post('/api/auth/logout')
      .set({ ...headers, 'X-CSRF-Token': 'forged' })
      .expect(403)

    const { body } = await t.http().get('/api/auth/csrf').set(headers).expect(200)
    expect(body).toEqual({ csrfToken: headers['X-CSRF-Token'] })

    await t.http().post('/api/auth/logout').set(headers).expect(204)
    await t.http().get('/api/auth/me').set(headers).expect(401)
  })

  it('ends existing sessions of a disabled user and blocks sign-in', async () => {
    await createUser(t, { email: 'learner@example.com' })
    const headers = await signIn(t, 'learner')
    await t.http().get('/api/auth/me').set(headers).expect(200)

    await t.prisma.user.update({
      where: { email: 'learner@example.com' },
      data: { status: UserStatus.DISABLED },
    })

    await t.http().get('/api/auth/me').set(headers).expect(401)
    await t
      .http()
      .post('/api/auth/login')
      .send({ username: 'learner', password: PASSWORD })
      .expect(401)
  })

  it('rejects an expired session', async () => {
    await createUser(t, { email: 'learner@example.com' })
    const headers = await signIn(t, 'learner')
    await t.prisma.authSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })

    await t.http().get('/api/auth/me').set(headers).expect(401)
    expect(await t.prisma.authSession.count()).toBe(0)
  })
})
