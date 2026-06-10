import { IsArray, IsNotEmpty, IsString } from 'class-validator'

export class JoinSessionDto {
  @IsString()
  @IsNotEmpty()
  displayName: string

  @IsString()
  @IsNotEmpty()
  nativeLanguage: string

  @IsArray()
  @IsString({ each: true })
  proficiencyLevels: string[]
}
