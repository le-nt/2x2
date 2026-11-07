/*
  Warnings:

  - A unique constraint covering the columns `[userId,fingerprint]` on the table `Fingerprint` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Fingerprint_userId_fingerprint_key" ON "Fingerprint"("userId", "fingerprint");
