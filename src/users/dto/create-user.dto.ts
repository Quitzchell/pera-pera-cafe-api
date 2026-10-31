import { Transform } from 'class-transformer'
import { Allow, Matches } from 'class-validator'
import { normalizeUsername, USERNAME_PATTERN } from '../../auth/credentials'

export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeUsername(value) : value,
  )
  @Matches(USERNAME_PATTERN, { message: 'username must be 3-30 characters: a-z, 0-9, _ or -' })
  username: string

  // shortcut: accepted and ignored so the deployed frontend can still invite users; remove once
  // the frontend no longer sends an email.
  @Allow()
  email?: unknown
}
