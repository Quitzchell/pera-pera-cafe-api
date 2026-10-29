import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { AdminOnly, CurrentSession } from '../auth/auth.decorators'
import type { SignedIn } from '../auth/auth.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UsersService } from './users.service'

@AdminOnly()
@Controller('admin/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list()
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto)
  }

  @Patch(':id')
  update(@CurrentSession() session: SignedIn, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(session.user.id, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentSession() session: SignedIn, @Param('id') id: string) {
    return this.users.remove(session.user.id, id)
  }

  @Post(':id/reset-link')
  resetLink(@Param('id') id: string) {
    return this.users.resetLink(id)
  }
}
