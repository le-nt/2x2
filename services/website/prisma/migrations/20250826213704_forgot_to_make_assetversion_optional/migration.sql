-- DropForeignKey
ALTER TABLE "public"."Thumbnail" DROP CONSTRAINT "Thumbnail_assetVersionIdGlobal_fkey";

-- AlterTable
ALTER TABLE "public"."Thumbnail" ALTER COLUMN "assetVersionIdGlobal" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Thumbnail" ADD CONSTRAINT "Thumbnail_assetVersionIdGlobal_fkey" FOREIGN KEY ("assetVersionIdGlobal") REFERENCES "public"."AssetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
