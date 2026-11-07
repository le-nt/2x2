/*
  Warnings:

  - The primary key for the `Asset` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Place` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `universeId` to the `Place` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AssetVersion" DROP CONSTRAINT "AssetVersion_assetId_fkey";

-- DropForeignKey
ALTER TABLE "Place" DROP CONSTRAINT "Place_id_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_assetId_fkey";

-- DropForeignKey
ALTER TABLE "UserInventory" DROP CONSTRAINT "UserInventory_assetId_fkey";

-- AlterTable
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_pkey",
ALTER COLUMN "id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "Asset_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AssetVersion" ALTER COLUMN "assetId" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Place" DROP CONSTRAINT "Place_pkey",
ADD COLUMN     "universeId" BIGINT NOT NULL,
ALTER COLUMN "id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "Place_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "assetId" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "UserInventory" ALTER COLUMN "assetId" SET DATA TYPE BIGINT;

-- CreateTable
CREATE TABLE "Universe" (
    "id" BIGINT NOT NULL,
    "startPlaceId" BIGINT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isCloudEdit" BOOLEAN NOT NULL DEFAULT false,
    "editors" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "creatorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Universe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataStore" (
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "value" TEXT,
    "valueInt" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "universeId" BIGINT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DataStore_universeId_key_scope_target_key" ON "DataStore"("universeId", "key", "scope", "target");

-- AddForeignKey
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Universe" ADD CONSTRAINT "Universe_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_id_fkey" FOREIGN KEY ("id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVersion" ADD CONSTRAINT "AssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataStore" ADD CONSTRAINT "DataStore_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
