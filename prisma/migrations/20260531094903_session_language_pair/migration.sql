/*
  Warnings:

  - You are about to drop the column `source_language` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `target_language` on the `Session` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Session" DROP COLUMN "source_language",
DROP COLUMN "target_language",
ADD COLUMN     "languages" TEXT[];
