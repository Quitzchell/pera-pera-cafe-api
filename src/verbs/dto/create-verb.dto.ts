import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { ConjugationForm, JlptLevel, VerbClass } from '../../../generated/prisma/client'
import { IsOmittable } from '../../validation'

export class CreateVerbDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  dictionaryForm: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  reading: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  meaning: string

  // Taken from the base verb for compounds.
  @IsOmittable()
  @IsEnum(VerbClass)
  verbClass?: VerbClass

  @IsEnum(JlptLevel)
  jlptLevel: JlptLevel

  @IsOmittable()
  @IsBoolean()
  isActive?: boolean

  @IsOmittable()
  @IsArray()
  @IsEnum(ConjugationForm, { each: true })
  excludedForms?: ConjugationForm[]

  // null turns a compound back into a plain verb.
  @IsOptional()
  @IsString()
  baseVerbId?: string | null
}
