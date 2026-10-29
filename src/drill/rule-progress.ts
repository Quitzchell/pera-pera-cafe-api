import { Prisma, PrismaClient } from '../../generated/prisma/client'
import { projectProgress } from './leitner'

// Serializes everything that writes a learner's attempts or progress: answering, finishing a
// round and rebuilding. Held until the surrounding transaction ends.
export const lockLearner = (tx: Prisma.TransactionClient, userId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`

export function rebuildRuleProgress(prisma: PrismaClient, userId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await lockLearner(tx, userId)
    const attempts = await tx.attempt.findMany({
      where: { userId },
      select: { form: true, ruleGroup: true, isCorrect: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    const rows = projectProgress(attempts)
    await tx.ruleProgress.deleteMany({ where: { userId } })
    await tx.ruleProgress.createMany({ data: rows.map((row) => ({ userId, ...row })) })
    return rows.length
  })
}
