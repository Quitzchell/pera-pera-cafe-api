import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

// The endpoints all depend on Postgres via PrismaService. We override that
// provider with a mock so the test exercises the real HTTP surface (routing,
// the global `api` prefix and the ValidationPipe from main.ts) without a DB.
describe('Sessions (e2e)', () => {
  let app: INestApplication<App>

  const prismaMock = {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  }

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile()

    app = moduleFixture.createNestApplication()
    // Mirror src/main.ts so the test hits the same HTTP surface as production.
    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    )
    await app.init()
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await app.close()
  })

  describe('POST /api/sessions', () => {
    it('rejects an empty body with 400 (validation)', () => {
      return request(app.getHttpServer()).post('/api/sessions').send({}).expect(400)
    })

    it('rejects when native and target language match with 400', () => {
      return request(app.getHttpServer())
        .post('/api/sessions')
        .send({
          title: 'Coffee chat',
          targetLanguage: 'ja',
          host: { displayName: 'Mitchell', nativeLanguage: 'ja', proficiencyLevels: ['n5'] },
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Native and target language must differ')
        })
    })

    it('creates a session and returns the mapped shape', () => {
      prismaMock.session.create.mockResolvedValue({
        id: 'session-1',
        title: 'Coffee chat',
        languages: ['en', 'ja'],
        participants: [{ id: 'host-1' }],
      })

      return request(app.getHttpServer())
        .post('/api/sessions')
        .send({
          title: 'Coffee chat',
          targetLanguage: 'ja',
          host: { displayName: 'Mitchell', nativeLanguage: 'en', proficiencyLevels: ['n5'] },
        })
        .expect(201)
        .expect({
          session: { id: 'session-1', title: 'Coffee chat', languages: ['en', 'ja'] },
          participant: { id: 'host-1' },
        })
    })
  })

  describe('GET /api/sessions/:sessionId', () => {
    it('returns 404 when the session does not exist', () => {
      prismaMock.session.findUnique.mockResolvedValue(null)
      return request(app.getHttpServer()).get('/api/sessions/missing').expect(404)
    })

    it('returns the session when it exists', () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'session-1',
        title: 'Coffee chat',
        languages: ['en', 'ja'],
        status: 'pending',
      })
      return request(app.getHttpServer())
        .get('/api/sessions/session-1')
        .expect(200)
        .expect({ id: 'session-1', title: 'Coffee chat', languages: ['en', 'ja'] })
    })
  })
})