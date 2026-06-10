-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "proficiency_level" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTranslation" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "romanization" TEXT,

    CONSTRAINT "CardTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardTranslation_card_id_idx" ON "CardTranslation"("card_id");

-- CreateIndex
CREATE UNIQUE INDEX "CardTranslation_card_id_language_key" ON "CardTranslation"("card_id", "language");

-- AddForeignKey
ALTER TABLE "CardTranslation" ADD CONSTRAINT "CardTranslation_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
