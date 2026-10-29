import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { MAX_PASSWORD_LENGTH } from '../credentials'

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string

  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string
}
