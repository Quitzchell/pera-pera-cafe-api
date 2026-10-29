import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { DrillMode, DrillRound, Prisma, Verb } from '../../generated/prisma/client'
import { conjugate, ConjugationForm } from '../conjugation'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { drillableForms, toConjugatable } from '../verbs/verb-check'
import { checkAnswer } from './answer-check'
import { examChoices } from './exam-choices'
import { applyAttempt } from './leitner'
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
    const round = await this.findOwnRound(userId, roundId)
    if (round.finishedAt) {
      throw new ConflictException('This round is finished')
    }
    const item = await this.prisma.drillItem.findFirst({
      where: { id: itemId, roundId },
      include: { verb: { include: { baseVerb: true } }, attempt: { select: { id: true } } },
    })
    if (!item) {
      throw new NotFoundException('Item not found')
    }
    if (item.attempt) {
      throw new ConflictException('This item is already answered')
    }

    const result = checkAnswer(answer, engineVerb(item.verb), item.form)
    const { form } = item
    const { ruleGroup, isCorrect } = result
    const now = new Date()
    // shortcut: read-then-write on RuleProgress; fine while one learner answers one item at a
    // time. If it ever drifts, rebuild-progress recomputes it from the Attempt log.
    await this.prisma
      .$transaction(async (tx) => {
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
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('This item is already answered')
        }
        throw error
      })
    return result
  }

  async finish(userId: string, roundId: string) {
    const round = await this.findOwnRound(userId, roundId)
    const finishedAt =
      round.finishedAt ??
      (
        await this.prisma.drillRound.update({
          where: { id: roundId },
          data: { finishedAt: new Date() },
        })
      ).finishedAt
    const items = await this.prisma.drillItem.findMany({
      where: { roundId },
      orderBy: { position: 'asc' },
      include: { verb: { include: { baseVerb: true } }, attempt: true },
    })

    const answered = items.filter((item) => item.attempt)
    const mistakes = answered
      .filter((item) => !item.attempt!.isCorrect)
      .map((item) => {
        const { kanji, kana, ruleHint } = conjugate(engineVerb(item.verb), item.form)
        return {
          itemId: item.id,
          position: item.position,
          verb: verbSummary(item.verb),
          form: item.form,
          answer: item.attempt!.answer,
          expected: { kanji, kana },
          ruleHint,
        }
      })
    return {
      id: round.id,
      mode: round.mode,
      startedAt: round.startedAt,
      finishedAt,
      total: items.length,
      answered: answered.length,
      correct: answered.length - mistakes.length,
      mistakes,
    }
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
