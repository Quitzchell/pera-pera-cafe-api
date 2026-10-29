import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import { Request } from 'express'
import type { SignedIn } from './auth.service'

export const IS_PUBLIC = 'isPublic'
export const ADMIN_ONLY = 'adminOnly'

export const Public = () => SetMetadata(IS_PUBLIC, true)
export const AdminOnly = () => SetMetadata(ADMIN_ONLY, true)

export interface AuthenticatedRequest extends Request {
  auth: SignedIn
}

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SignedIn =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().auth,
)
