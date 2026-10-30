import { IsString, MaxLength } from 'class-validator'

export class AnswerDto {
  @IsString()
  @MaxLength(100)
  answer: string
}
