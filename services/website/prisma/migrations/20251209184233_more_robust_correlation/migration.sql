/*
  Warnings:

  - You are about to drop the column `userId` on the `Fingerprint` table. All the data in the column will be lost.
  - You are about to drop the `Flag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_FlagToUser` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[fingerprint]` on the table `Fingerprint` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[content]` on the table `Ip` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[contentHash]` on the table `Ip` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Fingerprint" DROP CONSTRAINT "Fingerprint_userId_fkey";

-- DropForeignKey
ALTER TABLE "_FlagToUser" DROP CONSTRAINT "_FlagToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_FlagToUser" DROP CONSTRAINT "_FlagToUser_B_fkey";

-- DropIndex
DROP INDEX "Fingerprint_userId_fingerprint_key";

-- AlterTable
ALTER TABLE "Fingerprint" DROP COLUMN "userId";

-- DropTable
DROP TABLE "Flag";

-- DropTable
DROP TABLE "_FlagToUser";

-- DropEnum
DROP TYPE "AppType";

-- DropEnum
DROP TYPE "RenderType";

-- CreateTable
CREATE TABLE "_FingerprintToUser" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FingerprintToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_FingerprintToUser_B_index" ON "_FingerprintToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Fingerprint_fingerprint_key" ON "Fingerprint"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Ip_content_key" ON "Ip"("content");

-- CreateIndex
CREATE UNIQUE INDEX "Ip_contentHash_key" ON "Ip"("contentHash");

-- AddForeignKey
ALTER TABLE "_FingerprintToUser" ADD CONSTRAINT "_FingerprintToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Fingerprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FingerprintToUser" ADD CONSTRAINT "_FingerprintToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
