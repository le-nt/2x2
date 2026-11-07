/*
  Warnings:

  - Made the column `reason` on table `Moderation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `internalNotes` on table `Moderation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Moderation" ALTER COLUMN "reason" SET NOT NULL,
ALTER COLUMN "internalNotes" SET NOT NULL;
