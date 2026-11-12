import { IsString, Length, MaxLength } from 'class-validator'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../credentials'

export class TokenDto {
  @IsString()
  @MaxLength(100)
  token: string
}

export class SetPasswordDto extends TokenDto {
  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  password: string
}
