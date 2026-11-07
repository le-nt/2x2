-- DropForeignKey
ALTER TABLE "AssetVersion" DROP CONSTRAINT "AssetVersion_assetId_fkey";

-- AddForeignKey
ALTER TABLE "AssetVersion" ADD CONSTRAINT "AssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
