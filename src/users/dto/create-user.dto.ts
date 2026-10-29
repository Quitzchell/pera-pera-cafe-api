import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName: string
}
