-- CreateEnum
CREATE TYPE "RuleGroup" AS ENUM ('GODAN_U_TSU_RU', 'GODAN_MU_BU_NU', 'GODAN_KU', 'GODAN_GU', 'GODAN_SU', 'ICHIDAN', 'IRREGULAR_SURU', 'IRREGULAR_KURU', 'EXCEPTION_IKU', 'EXCEPTION_ARU');

-- CreateEnum
CREATE TYPE "DrillMode" AS ENUM ('STANDARD', 'CONTRAST', 'EXAM');

-- AlterEnum
ALTER TYPE "ConjugationForm" ADD VALUE 'POTENTIAL_CONDITIONAL';

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "enabledForms" "ConjugationForm"[],
    "jlptLevels" "JlptLevel"[],
    "roundSize" INTEGER NOT NULL DEFAULT 20,
    "romajiInput" BOOLEAN NOT NULL DEFAULT false,
    "showFurigana" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DrillRound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "DrillMode" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DrillRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillItem" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "verbId" TEXT NOT NULL,
    "form" "ConjugationForm" NOT NULL,
    "position" INTEGER NOT NULL,
    "choices" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "DrillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "drillItemId" TEXT NOT NULL,
    "verbId" TEXT NOT NULL,
    "form" "ConjugationForm" NOT NULL,
    "ruleGroup" "RuleGroup" NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleProgress" (
    "userId" TEXT NOT NULL,
    "form" "ConjugationForm" NOT NULL,
    "ruleGroup" "RuleGroup" NOT NULL,
    "box" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "lastPracticedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleProgress_pkey" PRIMARY KEY ("userId","form","ruleGroup")
);

-- CreateIndex
CREATE INDEX "DrillRound_userId_finishedAt_idx" ON "DrillRound"("userId", "finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DrillItem_roundId_position_key" ON "DrillItem"("roundId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_drillItemId_key" ON "Attempt"("drillItemId");

-- CreateIndex
CREATE INDEX "Attempt_userId_createdAt_idx" ON "Attempt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillRound" ADD CONSTRAINT "DrillRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillItem" ADD CONSTRAINT "DrillItem_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "DrillRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillItem" ADD CONSTRAINT "DrillItem_verbId_fkey" FOREIGN KEY ("verbId") REFERENCES "Verb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_drillItemId_fkey" FOREIGN KEY ("drillItemId") REFERENCES "DrillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_verbId_fkey" FOREIGN KEY ("verbId") REFERENCES "Verb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleProgress" ADD CONSTRAINT "RuleProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

