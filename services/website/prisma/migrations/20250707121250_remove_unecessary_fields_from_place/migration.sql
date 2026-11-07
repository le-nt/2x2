/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Place` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Place" DROP COLUMN "createdAt",
DROP COLUMN "description",
DROP COLUMN "name",
DROP COLUMN "updatedAt";
