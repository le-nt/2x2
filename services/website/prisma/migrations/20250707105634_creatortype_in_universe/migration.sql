/*
  Warnings:

  - Added the required column `creatorType` to the `Universe` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Universe" DROP CONSTRAINT "Universe_creatorId_fkey";

-- AlterTable
ALTER TABLE "Universe" ADD COLUMN     "creatorType" INTEGER NOT NULL;
