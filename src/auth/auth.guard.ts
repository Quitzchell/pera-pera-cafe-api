import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Role } from '../../generated/prisma/client'
import { ADMIN_ONLY, AuthenticatedRequest, IS_PUBLIC } from './auth.decorators'
import { AuthService } from './auth.service'
import { SESSION_COOKIE } from './cookies'
import { tokensEqual } from './credentials'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Global: every route needs a signed-in user unless it is marked @Public().
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flag = (key: string) =>
      this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()])
    if (flag(IS_PUBLIC)) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const cookie: unknown = request.cookies?.[SESSION_COOKIE]
    const signedIn = await this.auth.authenticate(typeof cookie === 'string' ? cookie : undefined)
    if (!signedIn) {
      throw new UnauthorizedException('Not signed in')
    }
    if (
      !SAFE_METHODS.has(request.method) &&
      !tokensEqual(request.get('x-csrf-token'), signedIn.csrfToken)
    ) {
      throw new ForbiddenException('Missing or invalid CSRF token')
    }
    if (flag(ADMIN_ONLY) && signedIn.user.role !== Role.ADMIN) {
      throw new ForbiddenException('Admins only')
    }
    request.auth = signedIn
    return true
  }
}
