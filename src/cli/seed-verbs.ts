import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync } from 'node:fs'
import {
  ConjugationForm,
  JlptLevel,
  PrismaClient,
  Verb,
  VerbClass,
} from '../../generated/prisma/client'
import { checkVerb } from '../verbs/verb-check'

export interface SeedVerb {
  dictionaryForm: string
  reading: string
  meaning: string
  jlptLevel: JlptLevel
  verbClass?: VerbClass
  excludedForms?: ConjugationForm[]
  // Dictionary form of the base verb, for compounds.
  base?: string
}

async function main() {
  const seed = JSON.parse(readFileSync('prisma/seed-data/verbs.json', 'utf8')) as SeedVerb[]
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  const saved = new Map<string, Verb>()
  const basesFirst = [...seed].sort((a, b) => Number(!!a.base) - Number(!!b.base))

  try {
    for (const { base: baseForm, ...verb } of basesFirst) {
      const base = baseForm ? saved.get(baseForm) : undefined
      if (baseForm && !base) {
        throw new Error(`${verb.dictionaryForm}: unknown base verb ${baseForm}`)
      }
      const verbClass = base?.verbClass ?? verb.verbClass
      if (!verbClass) {
        throw new Error(`${verb.dictionaryForm}: verbClass is required`)
      }
      const data = {
        ...verb,
        verbClass,
        excludedForms: verb.excludedForms ?? [],
        baseVerbId: base?.id ?? null,
      }
      const warnings = checkVerb(data, base)
      if (warnings.length > 0) {
        throw new Error(warnings.join('; '))
      }
      const { dictionaryForm, reading } = verb
      saved.set(
        dictionaryForm,
        await prisma.verb.upsert({
          where: { dictionaryForm_reading: { dictionaryForm, reading } },
          create: data,
          update: data,
        }),
      )
    }
    console.log(`Seeded ${saved.size} verbs`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
