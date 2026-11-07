/*
  Warnings:

  - You are about to drop the `AssetRender` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AvatarRender` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."AssetRender" DROP CONSTRAINT "AssetRender_assetVersionIdGlobal_fkey";

-- DropTable
DROP TABLE "public"."AssetRender";

-- DropTable
DROP TABLE "public"."AvatarRender";

-- CreateTable
CREATE TABLE "public"."Thumbnail" (
    "id" TEXT NOT NULL,
    "imageHash" TEXT NOT NULL,
    "characterAppearanceHash" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "imageType" INTEGER NOT NULL,
    "assetVersionIdGlobal" INTEGER NOT NULL,

    CONSTRAINT "Thumbnail_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Thumbnail" ADD CONSTRAINT "Thumbnail_assetVersionIdGlobal_fkey" FOREIGN KEY ("assetVersionIdGlobal") REFERENCES "public"."AssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
