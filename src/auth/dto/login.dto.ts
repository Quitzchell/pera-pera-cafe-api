import { IsEmail, IsString, MaxLength } from 'class-validator'
import { MAX_PASSWORD_LENGTH } from '../credentials'

export class LoginDto {
  @IsEmail()
  email: string

  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string
}
