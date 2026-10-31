import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthTokenType, Prisma, UserStatus } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { hashPassword, hashToken, newToken, normalizeUsername, verifyPassword } from './credentials'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const SESSION_TTL = 30 * DAY
const TOKEN_TTL: Record<AuthTokenType, number> = { INVITE: 7 * DAY, PASSWORD_RESET: DAY }
// From the 5th failed login on, the next attempt is only checked after a wait that grows by a
// minute per failure, up to 15. A right password after the wait always signs in.
const FREE_FAILED_LOGINS = 4
const MAX_LOGIN_WAIT = 15 * MINUTE
const LAST_ACTIVE_RESOLUTION = 5 * MINUTE

export const publicUserSelect = {
  id: true,
  username: true,
  role: true,
  status: true,
  createdAt: true,
  lastActiveAt: true,
} satisfies Prisma.UserSelect

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>

export interface SignedIn {
  sessionId: string
  csrfToken: string
  user: PublicUser
}

// Same message for every failure, so it does not reveal which accounts exist or are locked.
const invalidLogin = () => new UnauthorizedException('Invalid username or password')
const invalidLink = () => new BadRequestException('This link is invalid or has expired')

@Injectable()
export class AuthService {
  // Verified against for unknown usernames, so they take as long as known ones.
  private readonly dummyHash = hashPassword(newToken())

  constructor(private readonly prisma: PrismaService) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: normalizeUsername(username) },
    })
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash))
    if (!user || user.status !== UserStatus.ACTIVE || this.mustWait(user)) {
      throw invalidLogin()
    }
    if (!passwordOk) {
      await this.recordFailedLogin(user.id)
      throw invalidLogin()
    }

    const sessionToken = newToken()
    const csrfToken = newToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL)
    const [session, signedInUser] = await this.prisma.$transaction([
      this.prisma.authSession.create({
        data: { userId: user.id, tokenHash: hashToken(sessionToken), csrfToken, expiresAt },
        select: { id: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastActiveAt: new Date() },
        select: publicUserSelect,
      }),
    ])
    const signedIn: SignedIn = { sessionId: session.id, csrfToken, user: signedInUser }
    return { sessionToken, expiresAt, signedIn }
  }

  async logout(sessionId: string) {
    await this.prisma.authSession.deleteMany({ where: { id: sessionId } })
  }

  async authenticate(sessionToken: string | undefined): Promise<SignedIn | null> {
    if (!sessionToken) {
      return null
    }
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashToken(sessionToken) },
      select: { id: true, csrfToken: true, expiresAt: true, user: { select: publicUserSelect } },
    })
    if (!session || session.user.status !== UserStatus.ACTIVE) {
      return null
    }
    if (session.expiresAt <= new Date()) {
      await this.logout(session.id)
      return null
    }

    const { user } = session
    if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > LAST_ACTIVE_RESOLUTION) {
      user.lastActiveAt = new Date()
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: user.lastActiveAt },
      })
    }
    return { sessionId: session.id, csrfToken: session.csrfToken, user }
  }

  async issueToken(userId: string, type: AuthTokenType) {
    const token = newToken()
    const expiresAt = new Date(Date.now() + TOKEN_TTL[type])
    await this.prisma.$transaction([
      this.prisma.authToken.deleteMany({ where: { userId, usedAt: null } }),
      this.prisma.authToken.create({
        data: { userId, type, tokenHash: hashToken(token), expiresAt },
      }),
    ])
    return { token, expiresAt }
  }

  async setPasswordWithToken(type: AuthTokenType, token: string, password: string) {
    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { status: true } } },
    })
    if (
      !record ||
      record.type !== type ||
      record.usedAt ||
      record.expiresAt <= new Date() ||
      record.user.status === UserStatus.DISABLED
    ) {
      throw invalidLink()
    }
    // Hashed only for a valid token, so random tokens cost no argon2 work.
    const passwordHash = await hashPassword(password)

    await this.prisma.$transaction(async (tx) => {
      // Checked again: another request may have used the token, or the admin disabled the
      // user, while the password was being hashed.
      const redeemed = await tx.authToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      })
      const activated = await tx.user.updateMany({
        where: { id: record.userId, status: { not: UserStatus.DISABLED } },
        data: { passwordHash, status: UserStatus.ACTIVE, failedLoginCount: 0, lockedUntil: null },
      })
      if (redeemed.count !== 1 || activated.count !== 1) {
        throw invalidLink()
      }
      await tx.authSession.deleteMany({ where: { userId: record.userId } })
    })
  }

  private mustWait(user: { lockedUntil: Date | null }) {
    return user.lockedUntil !== null && user.lockedUntil > new Date()
  }

  private async recordFailedLogin(userId: string) {
    const { failedLoginCount } = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    })
    if (failedLoginCount > FREE_FAILED_LOGINS) {
      const wait = Math.min((failedLoginCount - FREE_FAILED_LOGINS) * MINUTE, MAX_LOGIN_WAIT)
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + wait) },
      })
    }
  }
}
