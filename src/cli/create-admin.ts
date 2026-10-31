import { Role, UserStatus } from '../../generated/prisma/client'
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
  USERNAME_PATTERN,
} from '../auth/credentials'
import { PrismaService } from '../prisma/prisma.service'

async function main() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD')
  }
  const username = normalizeUsername(ADMIN_USERNAME)
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('ADMIN_USERNAME must be 3-30 characters: a-z, 0-9, _ or -')
  }
  if (ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  const prisma = new PrismaService()
  try {
    await prisma.user.create({
      data: {
        username,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    })
    console.log(`Admin ${username} created`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
