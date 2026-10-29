import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { AdminOnly } from '../auth/auth.decorators'
import { CreateVerbDto } from './dto/create-verb.dto'
import { UpdateVerbDto } from './dto/update-verb.dto'
import { VerbsService } from './verbs.service'

@AdminOnly()
@Controller('admin/verbs')
export class VerbsController {
  constructor(private readonly verbs: VerbsService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.verbs.list(q)
  }

  @Post()
  create(@Body() dto: CreateVerbDto) {
    return this.verbs.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVerbDto) {
    return this.verbs.update(id, dto)
  }
}
