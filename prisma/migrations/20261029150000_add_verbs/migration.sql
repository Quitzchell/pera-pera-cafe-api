-- CreateEnum
CREATE TYPE "VerbClass" AS ENUM ('GODAN', 'ICHIDAN', 'IRREGULAR');

-- CreateEnum
CREATE TYPE "JlptLevel" AS ENUM ('N5', 'N4', 'N3');

-- CreateEnum
CREATE TYPE "ConjugationForm" AS ENUM ('POLITE', 'POLITE_NEGATIVE', 'POLITE_PAST', 'NEGATIVE', 'PAST_NEGATIVE', 'TE', 'PAST', 'POTENTIAL', 'PASSIVE', 'CAUSATIVE', 'CAUSATIVE_PASSIVE', 'VOLITIONAL', 'CONDITIONAL_BA', 'IMPERATIVE', 'PROHIBITIVE');

-- CreateTable
CREATE TABLE "Verb" (
    "id" TEXT NOT NULL,
    "dictionaryForm" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "verbClass" "VerbClass" NOT NULL,
    "jlptLevel" "JlptLevel" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "excludedForms" "ConjugationForm"[] DEFAULT ARRAY[]::"ConjugationForm"[],
    "baseVerbId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verb_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Verb_dictionaryForm_reading_key" ON "Verb"("dictionaryForm", "reading");

-- AddForeignKey
ALTER TABLE "Verb" ADD CONSTRAINT "Verb_baseVerbId_fkey" FOREIGN KEY ("baseVerbId") REFERENCES "Verb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

