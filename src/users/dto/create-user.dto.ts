import { Transform } from 'class-transformer'
import { Matches } from 'class-validator'
import { normalizeUsername, USERNAME_PATTERN } from '../../auth/credentials'

export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeUsername(value) : value,
  )
  @Matches(USERNAME_PATTERN, { message: 'username must be 3-30 characters: a-z, 0-9, _ or -' })
  username: string
}
