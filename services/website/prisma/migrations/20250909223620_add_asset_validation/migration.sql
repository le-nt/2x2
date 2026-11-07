/*
  Warnings:

  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."User_email_key";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "email";

-- CreateTable
CREATE TABLE "public"."AssetValidation" (
    "id" TEXT NOT NULL,
    "assetId" BIGINT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetValidation_assetId_key" ON "public"."AssetValidation"("assetId");

-- AddForeignKey
ALTER TABLE "public"."AssetValidation" ADD CONSTRAINT "AssetValidation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
