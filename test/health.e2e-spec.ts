import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

// PrismaService is overridden with an empty mock so the test exercises the real
// HTTP surface (routing, the global `api` prefix and the ValidationPipe from
// main.ts) without a DB.
describe('Health (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
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
    await app.close()
  })

  it('GET /api/health returns ok', () => {
    return request(app.getHttpServer()).get('/api/health').expect(200).expect({ status: 'ok' })
  })

  it('serves nothing outside the api prefix', () => {
    return request(app.getHttpServer()).get('/health').expect(404)
  })
})
