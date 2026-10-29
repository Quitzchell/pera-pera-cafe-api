import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AuthTokenType, UserStatus } from '../../generated/prisma/client'
import { adminUserSelect, AuthService } from '../auth/auth.service'
import { normalizeEmail } from '../auth/credentials'
import { config } from '../config'
import { onDuplicate } from '../prisma/on-duplicate'
import { PrismaService } from '../prisma/prisma.service'
import { ProgressService } from '../progress/progress.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

const LINK_PATHS: Record<AuthTokenType, string> = { INVITE: 'invite', PASSWORD_RESET: 'reset' }

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly progress: ProgressService,
  ) {}

  list() {
    return this.prisma.user.findMany({ select: adminUserSelect, orderBy: { createdAt: 'asc' } })
  }

  async create(dto: CreateUserDto) {
    const user = await this.prisma.user
      .create({
        data: { username: dto.username, email: normalizeEmail(dto.email) },
        select: adminUserSelect,
      })
      .catch(onDuplicate('A user with this username or email already exists'))
    return { user, ...(await this.createLink(user.id, AuthTokenType.INVITE)) }
  }

  async update(actorId: string, id: string, dto: UpdateUserDto) {
    const user = await this.findOrFail(id)
    if (dto.disabled !== undefined) {
      this.assertNotSelf(actorId, id)
    }
    const status =
      dto.disabled === undefined
        ? undefined
        : dto.disabled
          ? UserStatus.DISABLED
          : user.passwordHash
            ? UserStatus.ACTIVE
            : UserStatus.INVITED

    return this.prisma
      .$transaction(async (tx) => {
        // Re-enabling must not bring back sessions from before the account was disabled.
        if (status === UserStatus.DISABLED) {
          await tx.authSession.deleteMany({ where: { userId: id } })
        }
        return tx.user.update({
          where: { id },
          data: { username: dto.username, status },
          select: adminUserSelect,
        })
      })
      .catch(onDuplicate('A user with this username already exists'))
  }

  async remove(actorId: string, id: string) {
    this.assertNotSelf(actorId, id)
    const { count } = await this.prisma.user.deleteMany({ where: { id } })
    if (count === 0) {
      throw new NotFoundException('User not found')
    }
  }

  async progressOf(id: string) {
    await this.findOrFail(id)
    return this.progress.summary(id)
  }

  async resetLink(id: string) {
    const user = await this.findOrFail(id)
    if (user.status === UserStatus.DISABLED) {
      throw new BadRequestException('Enable the user before creating a link')
    }
    // An invited user who lost their invite gets a fresh one.
    const type =
      user.status === UserStatus.INVITED ? AuthTokenType.INVITE : AuthTokenType.PASSWORD_RESET
    return this.createLink(id, type)
  }

  private async createLink(userId: string, type: AuthTokenType) {
    const { token, expiresAt } = await this.auth.issueToken(userId, type)
    return { link: `${config.frontendOrigins[0]}/${LINK_PATHS[type]}/${token}`, expiresAt }
  }

  private async findOrFail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { status: true, passwordHash: true },
    })
    if (!user) {
      throw new NotFoundException('User not found')
    }
    return user
  }

  private assertNotSelf(actorId: string, id: string) {
    if (actorId === id) {
      throw new BadRequestException('You cannot disable or delete your own account')
    }
  }
}
