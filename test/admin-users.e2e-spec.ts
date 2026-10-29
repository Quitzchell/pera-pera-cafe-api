import { Role, UserStatus } from '../generated/prisma/client'
import { createApp, createUser, PASSWORD, signIn, TestApp } from './helpers'

const NEW_PASSWORD = 'a brand new passphrase'

const tokenFrom = (link: string) => link.split('/').pop() ?? ''

describe('Admin users (e2e)', () => {
  let t: TestApp
  let admin: Record<string, string>
  let adminId: string

  beforeEach(async () => {
    t = await createApp()
    adminId = (await createUser(t, { email: 'admin@example.com', role: Role.ADMIN })).id
    admin = await signIn(t, 'admin@example.com')
  })

  afterEach(async () => {
    await t.app.close()
  })

  it('invites a learner who sets a password once and can then sign in', async () => {
    const { body } = await t
      .http()
      .post('/api/admin/users')
      .set(admin)
      .send({ email: 'New@Example.com', displayName: 'New Learner' })
      .expect(201)
    expect(body.user).toMatchObject({
      email: 'new@example.com',
      status: 'INVITED',
      role: 'LEARNER',
    })
    expect(body.link).toMatch(/^http:\/\/app\.test\/invite\/[\w-]{43}$/)
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6.9 * 86_400_000)

    const token = tokenFrom(body.link)
    await t
      .http()
      .post('/api/auth/accept-invite')
      .send({ token, password: 'too short' })
      .expect(400)
    await t
      .http()
      .post('/api/auth/accept-invite')
      .send({ token, password: NEW_PASSWORD })
      .expect(204)
    await t
      .http()
      .post('/api/auth/accept-invite')
      .send({ token, password: NEW_PASSWORD })
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'This link is invalid or has expired',
      })

    const learner = await signIn(t, 'new@example.com', NEW_PASSWORD)
    const me = await t.http().get('/api/auth/me').set(learner).expect(200)
    expect(me.body).toMatchObject({ email: 'new@example.com', status: 'ACTIVE' })
  })

  it('rejects an expired invite and a reset token used as invite', async () => {
    const { body } = await t
      .http()
      .post('/api/admin/users')
      .set(admin)
      .send({ email: 'new@example.com', displayName: 'New' })
      .expect(201)
    await t.prisma.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })

    await t
      .http()
      .post('/api/auth/accept-invite')
      .send({ token: tokenFrom(body.link), password: NEW_PASSWORD })
      .expect(400)

    const learner = await createUser(t, { email: 'learner@example.com' })
    const reset = await t
      .http()
      .post(`/api/admin/users/${learner.id}/reset-link`)
      .set(admin)
      .expect(201)
    await t
      .http()
      .post('/api/auth/accept-invite')
      .send({ token: tokenFrom(reset.body.link), password: NEW_PASSWORD })
      .expect(400)
  })

  it('rejects a duplicate email with 409', async () => {
    await createUser(t, { email: 'learner@example.com' })
    await t
      .http()
      .post('/api/admin/users')
      .set(admin)
      .send({ email: 'LEARNER@example.com', displayName: 'Again' })
      .expect(409)
  })

  it('resets a password, ending the old sessions', async () => {
    const learner = await createUser(t, { email: 'learner@example.com' })
    const oldSession = await signIn(t, 'learner@example.com')

    const { body } = await t
      .http()
      .post(`/api/admin/users/${learner.id}/reset-link`)
      .set(admin)
      .expect(201)
    expect(body.link).toMatch(/^http:\/\/app\.test\/reset\//)

    await t
      .http()
      .post('/api/auth/reset-password')
      .send({ token: tokenFrom(body.link), password: NEW_PASSWORD })
      .expect(204)

    await t.http().get('/api/auth/me').set(oldSession).expect(401)
    await t
      .http()
      .post('/api/auth/login')
      .send({ email: 'learner@example.com', password: PASSWORD })
      .expect(401)
    await signIn(t, 'learner@example.com', NEW_PASSWORD)
  })

  it('gives an invited user a fresh invite instead of a reset link', async () => {
    const invited = await createUser(t, {
      email: 'invited@example.com',
      passwordHash: null,
      status: UserStatus.INVITED,
    })
    const { body } = await t
      .http()
      .post(`/api/admin/users/${invited.id}/reset-link`)
      .set(admin)
      .expect(201)
    expect(body.link).toMatch(/\/invite\//)
  })

  it('disables a user for good: re-enabling does not revive old sessions', async () => {
    const learner = await createUser(t, { email: 'learner@example.com' })
    const session = await signIn(t, 'learner@example.com')

    const disabled = await t
      .http()
      .patch(`/api/admin/users/${learner.id}`)
      .set(admin)
      .send({ disabled: true })
      .expect(200)
    expect(disabled.body.status).toBe('DISABLED')
    await t.http().get('/api/auth/me').set(session).expect(401)
    await t.http().post(`/api/admin/users/${learner.id}/reset-link`).set(admin).expect(400)

    const enabled = await t
      .http()
      .patch(`/api/admin/users/${learner.id}`)
      .set(admin)
      .send({ disabled: false, displayName: 'Renamed' })
      .expect(200)
    expect(enabled.body).toMatchObject({ status: 'ACTIVE', displayName: 'Renamed' })
    await t.http().get('/api/auth/me').set(session).expect(401)
  })

  it('lists users without secrets and deletes a user', async () => {
    const learner = await createUser(t, { email: 'learner@example.com' })

    const { body } = await t.http().get('/api/admin/users').set(admin).expect(200)
    expect(body).toEqual([
      expect.objectContaining({ email: 'admin@example.com' }),
      expect.objectContaining({ email: 'learner@example.com' }),
    ])
    expect(body[0]).not.toHaveProperty('passwordHash')

    await t.http().delete(`/api/admin/users/${learner.id}`).set(admin).expect(204)
    await t.http().delete(`/api/admin/users/${learner.id}`).set(admin).expect(404)
  })

  it('does not let the admin disable or delete their own account', async () => {
    await t
      .http()
      .patch(`/api/admin/users/${adminId}`)
      .set(admin)
      .send({ disabled: true })
      .expect(400)
    await t.http().delete(`/api/admin/users/${adminId}`).set(admin).expect(400)
  })

  it('keeps learners out of admin routes', async () => {
    const learner = await createUser(t, { email: 'learner@example.com' })
    const headers = await signIn(t, 'learner@example.com')

    await t
      .http()
      .get('/api/admin/users')
      .set(headers)
      .expect(403, { statusCode: 403, error: 'Forbidden', message: 'Admins only' })
    await t.http().post(`/api/admin/users/${learner.id}/reset-link`).set(headers).expect(403)
    await t.http().get('/api/admin/users').expect(401)
  })
})
