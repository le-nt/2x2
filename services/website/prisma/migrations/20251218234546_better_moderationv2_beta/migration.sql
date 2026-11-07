/*
  Warnings:

  - You are about to drop the column `active` on the `Moderation` table. All the data in the column will be lost.
  - You are about to drop the column `activeUntil` on the `Moderation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[latestModerationId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `action` on the `Moderation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Escalation" AS ENUM ('Warn', 'Remind', 'Ban_1Day', 'Ban_3Day', 'Ban_7Day', 'Ban_14Day', 'Ban_183Day', 'Ban_365Day', 'Delete');

-- AlterTable
ALTER TABLE "Moderation" DROP COLUMN "active",
DROP COLUMN "activeUntil",
ADD COLUMN     "cannotReactivateUntil" TIMESTAMP(3),
ADD COLUMN     "resolved" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "action",
ADD COLUMN     "action" "Escalation" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "latestModerationId" TEXT;

-- DropEnum
DROP TYPE "ModerationType";

-- CreateIndex
CREATE UNIQUE INDEX "User_latestModerationId_key" ON "User"("latestModerationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_latestModerationId_fkey" FOREIGN KEY ("latestModerationId") REFERENCES "Moderation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
