import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { DrillMode, DrillRound, Verb } from '../../generated/prisma/client'
import { conjugate, ConjugationError, ConjugationForm } from '../conjugation'
import { onDuplicate } from '../prisma/on-duplicate'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { drillableForms, toConjugatable } from '../verbs/verb-check'
import { checkAnswer } from './answer-check'
import { examChoices } from './exam-choices'
import { applyAttempt } from './leitner'
import { lockLearner } from './rule-progress'
import { buildRound } from './round-builder'

type VerbWithBase = Verb & { baseVerb: Verb | null }

const engineVerb = (verb: VerbWithBase) => toConjugatable(verb, verb.baseVerb ?? undefined)

const verbSummary = ({ dictionaryForm, reading, meaning }: Verb) => ({
  dictionaryForm,
  reading,
  meaning,
})

@Injectable()
export class DrillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async createRound(userId: string, mode: DrillMode) {
    const settings = await this.settings.get(userId)
    const [verbs, progress] = await Promise.all([
      this.prisma.verb.findMany({
        where: { isActive: true, jlptLevel: { in: settings.jlptLevels } },
        include: { baseVerb: true },
      }),
      this.prisma.ruleProgress.findMany({ where: { userId } }),
    ])
    const enabled = new Set<ConjugationForm>(settings.enabledForms)
    const candidates = verbs.map((verb) => ({
      verbId: verb.id,
      isCompound: verb.baseVerb !== null,
      forms: drillableForms(verb, verb.baseVerb ?? undefined)
        .filter((form) => enabled.has(form))
        .map((form) => ({ form, ruleGroup: conjugate(engineVerb(verb), form).ruleGroup })),
    }))

    const planned = buildRound({
      mode,
      candidates,
      progress,
      size: settings.roundSize,
      now: new Date(),
    })
    if (planned.length === 0) {
      throw new BadRequestException(
        mode === DrillMode.CONTRAST
          ? 'Enable both forms of a pair (potential/passive, te/past, ba/potential-ba) for a contrast round'
          : 'No verbs match your settings',
      )
    }

    const verbsById = new Map(verbs.map((verb) => [verb.id, verb]))
    const round = await this.prisma.drillRound.create({
      data: {
        userId,
        mode,
        items: {
          create: planned.map(({ verbId, form }, position) => ({
            verbId,
            form,
            position,
            choices:
              mode === DrillMode.EXAM ? examChoices(engineVerb(verbsById.get(verbId)!), form) : [],
          })),
        },
      },
      include: { items: { orderBy: { position: 'asc' }, include: { verb: true } } },
    })
    return {
      id: round.id,
      mode: round.mode,
      startedAt: round.startedAt,
      items: round.items.map(({ id, position, form, choices, verb }) => ({
        id,
        position,
        form,
        verb: verbSummary(verb),
        ...(choices.length > 0 && { choices }),
      })),
    }
  }

  async answer(userId: string, roundId: string, itemId: string, answer: string) {
    const item = await this.findOpenItem(userId, roundId, itemId)
    if (item.attempt) {
      throw new ConflictException('This item is already answered')
    }

    const result = this.check(answer, item.verb, item.form)
    const { form } = item
    const { ruleGroup, isCorrect } = result
    await this.prisma
      .$transaction(async (tx) => {
        // One write of this learner at a time, so concurrent answers cannot overwrite each
        // other's RuleProgress, and Attempt order matches the order progress was applied in.
        await lockLearner(tx, userId)
        const { finishedAt } = await tx.drillRound.findUniqueOrThrow({
          where: { id: roundId },
          select: { finishedAt: true },
        })
        if (finishedAt) {
          throw new ConflictException('This round is finished')
        }
        const now = new Date()
        await tx.attempt.create({
          data: {
            userId,
            drillItemId: item.id,
            verbId: item.verbId,
            form,
            ruleGroup,
            answer,
            isCorrect,
            createdAt: now,
          },
        })
        const where = { userId_form_ruleGroup: { userId, form, ruleGroup } }
        const previous = await tx.ruleProgress.findUnique({ where })
        const next = applyAttempt(previous ?? undefined, isCorrect, now)
        await tx.ruleProgress.upsert({
          where,
          create: { userId, form, ruleGroup, ...next },
          update: next,
        })
      })
      .catch(onDuplicate('This item is already answered'))
    return result
  }

  // Practice after a miss: graded like the first answer, but only the first answer counts, so
  // nothing is stored.
  async retry(userId: string, roundId: string, itemId: string, answer: string) {
    const item = await this.findOpenItem(userId, roundId, itemId)
    if (!item.attempt || item.attempt.isCorrect) {
      throw new ConflictException('Only a missed item can be retried')
    }
    return this.check(answer, item.verb, item.form)
  }

  async finish(userId: string, roundId: string) {
    const round = await this.findOwnRound(userId, roundId)
    const finishedAt =
      round.finishedAt ??
      (await this.prisma.$transaction(async (tx) => {
        // Waits for an answer in flight, so the summary below includes it.
        await lockLearner(tx, userId)
        const { finishedAt } = await tx.drillRound.update({
          where: { id: roundId },
          data: { finishedAt: new Date() },
        })
        return finishedAt
      }))
    const items = await this.prisma.drillItem.findMany({
      where: { roundId },
      orderBy: { position: 'asc' },
      include: { verb: { include: { baseVerb: true } }, attempt: true },
    })

    const answered = items.filter((item) => item.attempt)
    const mistakes = answered
      .filter((item) => !item.attempt!.isCorrect)
      .flatMap((item) => {
        const conjugation = this.conjugateCurrent(item.verb, item.form)
        if (!conjugation) {
          return []
        }
        return [
          {
            itemId: item.id,
            position: item.position,
            verb: verbSummary(item.verb),
            form: item.form,
            answer: item.attempt!.answer,
            expected: { kanji: conjugation.kanji, kana: conjugation.kana },
            ruleHint: conjugation.ruleHint,
          },
        ]
      })
    return {
      id: round.id,
      mode: round.mode,
      startedAt: round.startedAt,
      finishedAt,
      total: items.length,
      answered: answered.length,
      correct: answered.filter((item) => item.attempt!.isCorrect).length,
      mistakes,
    }
  }

  // The admin may have edited the verb since the round started, so it may no longer have this form.
  private check(answer: string, verb: VerbWithBase, form: ConjugationForm) {
    try {
      return checkAnswer(answer, engineVerb(verb), form)
    } catch (error) {
      if (error instanceof ConjugationError) {
        throw new ConflictException('This verb was changed during the round; skip this item')
      }
      throw error
    }
  }

  private conjugateCurrent(verb: VerbWithBase, form: ConjugationForm) {
    try {
      return conjugate(engineVerb(verb), form)
    } catch (error) {
      if (error instanceof ConjugationError) {
        return null
      }
      throw error
    }
  }

  private async findOpenItem(userId: string, roundId: string, itemId: string) {
    const round = await this.findOwnRound(userId, roundId)
    if (round.finishedAt) {
      throw new ConflictException('This round is finished')
    }
    const item = await this.prisma.drillItem.findFirst({
      where: { id: itemId, roundId },
      include: { verb: { include: { baseVerb: true } }, attempt: { select: { isCorrect: true } } },
    })
    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  private async findOwnRound(userId: string, roundId: string) {
    const round = await this.prisma.drillRound.findUnique({ where: { id: roundId } })
    this.assertOwnsRound(round, userId)
    return round
  }

  // Someone else's round answers 404, so round ids cannot be probed.
  private assertOwnsRound(round: DrillRound | null, userId: string): asserts round is DrillRound {
    if (!round || round.userId !== userId) {
      throw new NotFoundException('Round not found')
    }
  }
}
