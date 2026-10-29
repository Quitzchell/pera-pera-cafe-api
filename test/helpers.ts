import { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { JlptLevel, Prisma, Role, UserStatus, VerbClass } from '../generated/prisma/client'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app.setup'
import { hashPassword } from '../src/auth/credentials'
import { conjugate } from '../src/conjugation'
import { PrismaService } from '../src/prisma/prisma.service'
import { toConjugatable } from '../src/verbs/verb-check'

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

export const VERBS: [string, string, VerbClass][] = [
  ['書く', 'かく', 'GODAN'],
  ['泳ぐ', 'およぐ', 'GODAN'],
  ['話す', 'はなす', 'GODAN'],
  ['行く', 'いく', 'GODAN'],
  ['食べる', 'たべる', 'ICHIDAN'],
  ['見る', 'みる', 'ICHIDAN'],
  ['来る', 'くる', 'IRREGULAR'],
  ['する', 'する', 'IRREGULAR'],
]

export async function seedVerbs(prisma: PrismaService) {
  for (const [dictionaryForm, reading, verbClass] of VERBS) {
    await prisma.verb.create({
      data: { dictionaryForm, reading, verbClass, meaning: 'x', jlptLevel: JlptLevel.N5 },
    })
  }
}

// The answer the engine expects for a drill item, as the client would have to type it.
export async function expectedAnswer(prisma: PrismaService, itemId: string) {
  const item = await prisma.drillItem.findUniqueOrThrow({
    where: { id: itemId },
    include: { verb: { include: { baseVerb: true } } },
  })
  return conjugate(toConjugatable(item.verb, item.verb.baseVerb ?? undefined), item.form)
}
