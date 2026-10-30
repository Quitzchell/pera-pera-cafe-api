import { ConflictException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'

// For .catch(): turns a unique-constraint violation into a 409 with the given message.
export const onDuplicate =
  (message: string) =>
  (error: unknown): never => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message)
    }
    throw error
  }
