/*
  Warnings:

  - You are about to drop the column `role` on the `Participant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "role",
ADD COLUMN     "is_host" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "ParticipantRole";
