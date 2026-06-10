import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../generated/prisma/client";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const LANGUAGE_MAP: Record<string, string> = {
    Dutch: 'nl',
    Japanese: 'ja'
}

type SeedCard = {
    id: string
    question: string
    proficiency_level: string
    translations: Record<string, string>
    romanizations?: Record<string, string>
}

async function main() {
    const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL})
    const prisma = new PrismaClient({adapter})

    const raw = readFileSync(join(process.cwd(), 'prisma/seed-data/cards.json'), 'utf8')
    const cards = JSON.parse(raw) as SeedCard[]

    console.log(`Seeding ${cards.length} cards...`)

    for (const card of cards) {
        await prisma.card.upsert({
            where: {id: card.id},
            create: {
                id: card.id,
                question: card.question,
                proficiency_level: card.proficiency_level
            },
            update: {
                question: card.question,
                proficiency_level: card.proficiency_level
            }
        })

        for (const [sourceLanguage, translation] of Object.entries(card.translations)) {
            const language = LANGUAGE_MAP[sourceLanguage]
            if (!language) {
                console.warn(`Skipping unknown language ${sourceLanguage}`)
                continue
            }
            const romanization = card.romanizations?.[sourceLanguage] ?? null

            await prisma.cardTranslation.upsert({
                where: {card_id_language: {card_id: card.id, language}},
                create: {card_id: card.id, language, translation, romanization},
                update: {translation, romanization}
            })
        }
    }

    const cardCount = await prisma.card.count()
    const translationCount = await prisma.cardTranslation.count()
    console.log(`Done. ${cardCount} cards, ${translationCount} translations in DB`)

    await prisma.$disconnect()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})