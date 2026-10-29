import { PartialType, PickType } from '@nestjs/mapped-types'
import { IsBoolean, IsOptional } from 'class-validator'
import { CreateUserDto } from './create-user.dto'

export class UpdateUserDto extends PartialType(PickType(CreateUserDto, ['username'])) {
  @IsOptional()
  @IsBoolean()
  disabled?: boolean
}
