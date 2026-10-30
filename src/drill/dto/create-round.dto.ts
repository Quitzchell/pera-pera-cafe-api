import { IsEnum } from 'class-validator'
import { DrillMode } from '../../../generated/prisma/client'

export class CreateRoundDto {
  @IsEnum(DrillMode)
  mode: DrillMode
}
