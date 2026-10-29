import { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { Prisma, Role, UserStatus } from '../generated/prisma/client'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app.setup'
import { hashPassword } from '../src/auth/credentials'
import { PrismaService } from '../src/prisma/prisma.service'

export const PASSWORD = 'correct horse battery'

let passwordHash: Promise<string> | undefined

export async function createApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication<NestExpressApplication>()
  configureApp(app)
  await app.init()
  const prisma = app.get(PrismaService)
  await prisma.$executeRawUnsafe('TRUNCATE "User", "Verb" CASCADE')
  return { app, prisma, http: () => request(app.getHttpServer()) }
}

export type TestApp = Awaited<ReturnType<typeof createApp>>

export async function createUser(
  { prisma }: TestApp,
  data: Partial<Prisma.UserCreateInput> & { email: string },
) {
  return prisma.user.create({
    data: {
      displayName: data.email.split('@')[0],
      passwordHash: await (passwordHash ??= hashPassword(PASSWORD)),
      role: Role.LEARNER,
      status: UserStatus.ACTIVE,
      ...data,
    },
  })
}

// Headers for follow-up requests as the signed-in user.
export async function signIn({ http }: TestApp, email: string, password = PASSWORD) {
  const response = await http().post('/api/auth/login').send({ email, password }).expect(200)
  const cookie = response.get('Set-Cookie')?.[0]?.split(';')[0] ?? ''
  return { Cookie: cookie, 'X-CSRF-Token': response.body.csrfToken as string }
}
