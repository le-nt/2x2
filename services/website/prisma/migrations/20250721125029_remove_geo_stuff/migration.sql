/*
  Warnings:

  - You are about to drop the column `lat` on the `ArbiterNode` table. All the data in the column will be lost.
  - You are about to drop the column `lon` on the `ArbiterNode` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ArbiterNode" DROP COLUMN "lat",
DROP COLUMN "lon";
