import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'
import { normalizeUsername } from '../auth/credentials'
import { rebuildRuleProgress } from '../drill/rule-progress'

async function main() {
  const target = process.argv[2]
  if (!target) {
    throw new Error('Usage: npm run rebuild-progress -- <username | --all>')
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  try {
    const users = await prisma.user.findMany({
      where: target === '--all' ? {} : { username: normalizeUsername(target) },
      select: { id: true, username: true },
    })
    if (users.length === 0) {
      throw new Error(`No user ${target}`)
    }
    for (const { id, username } of users) {
      console.log(`${username}: ${await rebuildRuleProgress(prisma, id)} rule groups rebuilt`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
