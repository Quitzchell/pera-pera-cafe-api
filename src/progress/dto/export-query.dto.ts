import { IsIn, IsOptional } from 'class-validator'

export class ExportQueryDto {
  @IsOptional()
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json' = 'json'
}
