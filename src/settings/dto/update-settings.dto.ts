import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator'
import { ConjugationForm, JlptLevel } from '../../../generated/prisma/client'

export class UpdateSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(ConjugationForm, { each: true })
  enabledForms?: ConjugationForm[]

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(JlptLevel, { each: true })
  jlptLevels?: JlptLevel[]

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(50)
  roundSize?: number

  @IsOptional()
  @IsBoolean()
  romajiInput?: boolean

  @IsOptional()
  @IsBoolean()
  showFurigana?: boolean
}
