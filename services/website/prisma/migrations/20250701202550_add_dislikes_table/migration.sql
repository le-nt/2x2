/*
  Warnings:

  - You are about to drop the column `type` on the `PlaceLikes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PlaceLikes" DROP COLUMN "type";

-- DropEnum
DROP TYPE "LikeType";

-- CreateTable
CREATE TABLE "PlaceDislikes" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "placeId" BIGINT NOT NULL,

    CONSTRAINT "PlaceDislikes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceDislikes_userId_key" ON "PlaceDislikes"("userId");

-- AddForeignKey
ALTER TABLE "PlaceDislikes" ADD CONSTRAINT "PlaceDislikes_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
