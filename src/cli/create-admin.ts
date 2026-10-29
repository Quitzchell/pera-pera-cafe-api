import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Role, UserStatus } from '../../generated/prisma/client'
import { hashPassword, MIN_PASSWORD_LENGTH, normalizeEmail } from '../auth/credentials'

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Admin' } = process.env
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD')
  }
  if (ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  try {
    const email = normalizeEmail(ADMIN_EMAIL)
    await prisma.user.create({
      data: {
        email,
        displayName: ADMIN_NAME,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    })
    console.log(`Admin ${email} created`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
