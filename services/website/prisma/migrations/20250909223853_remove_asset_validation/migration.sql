/*
  Warnings:

  - You are about to drop the `AssetValidation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."AssetValidation" DROP CONSTRAINT "AssetValidation_assetId_fkey";

-- DropTable
DROP TABLE "public"."AssetValidation";
