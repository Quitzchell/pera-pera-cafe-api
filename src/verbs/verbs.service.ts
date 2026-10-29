import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { ConjugationError } from '../conjugation'
import { PrismaService } from '../prisma/prisma.service'
import { CreateVerbDto } from './dto/create-verb.dto'
import { UpdateVerbDto } from './dto/update-verb.dto'
import { checkVerb } from './verb-check'

const conflict = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException('This verb already exists')
  }
  throw error
}

@Injectable()
export class VerbsService {
  constructor(private readonly prisma: PrismaService) {}

  list(q?: string) {
    return this.prisma.verb.findMany({
      where: q
        ? {
            OR: [
              { dictionaryForm: { contains: q } },
              { reading: { contains: q } },
              { meaning: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ jlptLevel: 'asc' }, { reading: 'asc' }],
    })
  }

  async create(dto: CreateVerbDto) {
    const { data, warnings } = await this.prepare(dto)
    const verb = await this.prisma.verb.create({ data }).catch(conflict)
    return { verb, warnings }
  }

  async update(id: string, dto: UpdateVerbDto) {
    const existing = await this.prisma.verb.findUnique({
      where: { id },
      include: { _count: { select: { compounds: true } } },
    })
    if (!existing) {
      throw new NotFoundException('Verb not found')
    }
    const merged: CreateVerbDto = {
      dictionaryForm: dto.dictionaryForm ?? existing.dictionaryForm,
      reading: dto.reading ?? existing.reading,
      meaning: dto.meaning ?? existing.meaning,
      verbClass: dto.verbClass ?? existing.verbClass,
      jlptLevel: dto.jlptLevel ?? existing.jlptLevel,
      isActive: dto.isActive ?? existing.isActive,
      excludedForms: dto.excludedForms ?? existing.excludedForms,
      baseVerbId: dto.baseVerbId !== undefined ? dto.baseVerbId : existing.baseVerbId,
    }
    if (merged.baseVerbId === id) {
      throw new BadRequestException('A verb cannot be its own base verb')
    }
    if (
      existing._count.compounds > 0 &&
      (merged.dictionaryForm !== existing.dictionaryForm ||
        merged.reading !== existing.reading ||
        merged.verbClass !== existing.verbClass)
    ) {
      throw new BadRequestException(
        'Compound verbs are built on this verb, so its form, reading and class cannot change',
      )
    }

    const { data, warnings } = await this.prepare(merged)
    const verb = await this.prisma.verb.update({ where: { id }, data }).catch(conflict)
    return { verb, warnings }
  }

  private async prepare(input: CreateVerbDto) {
    const base = input.baseVerbId
      ? await this.prisma.verb.findUnique({ where: { id: input.baseVerbId } })
      : null
    if (input.baseVerbId && !base) {
      throw new BadRequestException('Base verb not found')
    }
    const verbClass = base?.verbClass ?? input.verbClass
    if (!verbClass) {
      throw new BadRequestException('verbClass is required')
    }

    const data = {
      ...input,
      verbClass,
      excludedForms: input.excludedForms ?? [],
      baseVerbId: base?.id ?? null,
    }
    try {
      return { data, warnings: checkVerb(data, base ?? undefined) }
    } catch (error) {
      if (error instanceof ConjugationError) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }
}
