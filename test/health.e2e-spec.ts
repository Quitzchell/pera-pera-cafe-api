import { createApp, TestApp } from './helpers'

describe('Health (e2e)', () => {
  let t: TestApp

  beforeEach(async () => {
    t = await createApp()
  })

  afterEach(async () => {
    await t.app.close()
  })

  it('GET /api/health returns ok without signing in', () => {
    return t.http().get('/api/health').expect(200).expect({ status: 'ok' })
  })

  it('serves nothing outside the api prefix', () => {
    return t.http().get('/health').expect(404)
  })
})
