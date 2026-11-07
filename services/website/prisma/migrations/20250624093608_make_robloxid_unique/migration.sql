/*
  Warnings:

  - A unique constraint covering the columns `[robloxId]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Asset_robloxId_key" ON "Asset"("robloxId");
