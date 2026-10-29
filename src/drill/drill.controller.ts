import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { CurrentSession } from '../auth/auth.decorators'
import type { SignedIn } from '../auth/auth.service'
import { DrillService } from './drill.service'
import { AnswerDto } from './dto/answer.dto'
import { CreateRoundDto } from './dto/create-round.dto'

@Controller('drill/rounds')
export class DrillController {
  constructor(private readonly drill: DrillService) {}

  @Post()
  create(@CurrentSession() session: SignedIn, @Body() dto: CreateRoundDto) {
    return this.drill.createRound(session.user.id, dto.mode)
  }

  @Post(':roundId/items/:itemId/answer')
  @HttpCode(200)
  answer(
    @CurrentSession() session: SignedIn,
    @Param('roundId') roundId: string,
    @Param('itemId') itemId: string,
    @Body() dto: AnswerDto,
  ) {
    return this.drill.answer(session.user.id, roundId, itemId, dto.answer)
  }

  @Post(':roundId/items/:itemId/retry')
  @HttpCode(200)
  retry(
    @CurrentSession() session: SignedIn,
    @Param('roundId') roundId: string,
    @Param('itemId') itemId: string,
    @Body() dto: AnswerDto,
  ) {
    return this.drill.retry(session.user.id, roundId, itemId, dto.answer)
  }

  @Post(':roundId/finish')
  @HttpCode(200)
  finish(@CurrentSession() session: SignedIn, @Param('roundId') roundId: string) {
    return this.drill.finish(session.user.id, roundId)
  }
}
