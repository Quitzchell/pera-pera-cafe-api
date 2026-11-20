import { ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsEnum, IsTimeZone } from 'class-validator'
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
  @IsBoolean()
  romajiInput?: boolean

  @IsOmittable()
  @IsBoolean()
  showFurigana?: boolean

  @IsOmittable()
  @IsTimeZone()
  timeZone?: string
}
