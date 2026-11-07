/*
  Warnings:

  - You are about to drop the column `commmentsAllowed` on the `Place` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Place" DROP COLUMN "commmentsAllowed",
ADD COLUMN     "commentsAllowed" BOOLEAN NOT NULL DEFAULT true;
