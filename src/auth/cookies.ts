import { CookieOptions } from 'express'
import { config } from '../config'

export const SESSION_COOKIE = 'session'

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  path: '/',
  ...config.cookie,
}
