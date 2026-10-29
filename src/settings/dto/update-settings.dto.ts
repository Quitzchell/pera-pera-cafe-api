import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsTimeZone,
  Max,
  Min,
} from 'class-validator'
import { ConjugationForm, JlptLevel } from '../../../generated/prisma/client'
import { IsOmittable } from '../../validation'

export class UpdateSettingsDto {
  @IsOmittable()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(ConjugationForm, { each: true })
  enabledForms?: ConjugationForm[]

  @IsOmittable()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(JlptLevel, { each: true })
  jlptLevels?: JlptLevel[]

  @IsOmittable()
  @IsInt()
  @Min(5)
  @Max(50)
  roundSize?: number

  @IsOmittable()
  @IsBoolean()
  romajiInput?: boolean

  @IsOmittable()
  @IsBoolean()
  showFurigana?: boolean

  @IsOmittable()
  @IsTimeZone()
  timeZone?: string
}
