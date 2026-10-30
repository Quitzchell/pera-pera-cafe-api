import { Transform } from 'class-transformer'
import { IsBoolean, Matches } from 'class-validator'
import { normalizeUsername, USERNAME_PATTERN } from '../../auth/credentials'
import { IsOmittable } from '../../validation'

export class UpdateUserDto {
  @IsOmittable()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeUsername(value) : value,
  )
  @Matches(USERNAME_PATTERN, { message: 'username must be 3-30 characters: a-z, 0-9, _ or -' })
  username?: string

  @IsOmittable()
  @IsBoolean()
  disabled?: boolean
}
