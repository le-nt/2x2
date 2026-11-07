/*
  Warnings:

  - You are about to drop the column `robloxId` on the `Asset` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Asset_robloxId_key";

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "robloxId";
