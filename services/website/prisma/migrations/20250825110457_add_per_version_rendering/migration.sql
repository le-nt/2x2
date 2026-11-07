-- CreateTable
CREATE TABLE "public"."AssetRender" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageType" INTEGER NOT NULL,
    "assetVersionIdGlobal" INTEGER NOT NULL,

    CONSTRAINT "AssetRender_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."AssetRender" ADD CONSTRAINT "AssetRender_assetVersionIdGlobal_fkey" FOREIGN KEY ("assetVersionIdGlobal") REFERENCES "public"."AssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
