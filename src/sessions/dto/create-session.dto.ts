import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class HostDto {
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

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  title: string

  @IsString()
  @IsNotEmpty()
  targetLanguage: string

  @ValidateNested()
  @Type(() => HostDto)
  host: HostDto
}
