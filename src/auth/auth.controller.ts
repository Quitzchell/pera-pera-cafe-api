import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import type { Response } from 'express'
import { AuthTokenType } from '../../generated/prisma/client'
import { CurrentSession, Public } from './auth.decorators'
import { AuthService } from './auth.service'
import type { SignedIn } from './auth.service'
import { SESSION_COOKIE, sessionCookieOptions } from './cookies'
import { LoginDto } from './dto/login.dto'
import { SetPasswordDto } from './dto/set-password.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { sessionToken, expiresAt, signedIn } = await this.auth.login(dto.email, dto.password)
    response.cookie(SESSION_COOKIE, sessionToken, { ...sessionCookieOptions, expires: expiresAt })
    return { user: signedIn.user, csrfToken: signedIn.csrfToken }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentSession() session: SignedIn,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(session.sessionId)
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions)
  }

  @Get('me')
  me(@CurrentSession() session: SignedIn) {
    return session.user
  }

  @Get('csrf')
  csrf(@CurrentSession() session: SignedIn) {
    return { csrfToken: session.csrfToken }
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('accept-invite')
  @HttpCode(204)
  async acceptInvite(@Body() dto: SetPasswordDto) {
    await this.auth.setPasswordWithToken(AuthTokenType.INVITE, dto.token, dto.password)
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(@Body() dto: SetPasswordDto) {
    await this.auth.setPasswordWithToken(AuthTokenType.PASSWORD_RESET, dto.token, dto.password)
  }
}
