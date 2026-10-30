import { IsString, Length, MaxLength } from 'class-validator'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../credentials'

export class SetPasswordDto {
  @IsString()
  @MaxLength(100)
  token: string

  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  password: string
}
