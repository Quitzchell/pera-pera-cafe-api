import { PrismaClient } from '../../generated/prisma/client'
import { projectProgress } from './leitner'

export async function rebuildRuleProgress(prisma: PrismaClient, userId: string): Promise<number> {
  const attempts = await prisma.attempt.findMany({
    where: { userId },
    select: { form: true, ruleGroup: true, isCorrect: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const rows = projectProgress(attempts)
  await prisma.$transaction([
    prisma.ruleProgress.deleteMany({ where: { userId } }),
    prisma.ruleProgress.createMany({ data: rows.map((row) => ({ userId, ...row })) }),
  ])
  return rows.length
}
