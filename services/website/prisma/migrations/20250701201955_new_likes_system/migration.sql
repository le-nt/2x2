/*
  Warnings:

  - You are about to drop the column `dislikes` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `likes` on the `Place` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LikeType" AS ENUM ('None', 'Like', 'Dislike');

-- AlterTable
ALTER TABLE "Place" DROP COLUMN "dislikes",
DROP COLUMN "likes";

-- CreateTable
CREATE TABLE "PlaceLikes" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "LikeType" NOT NULL,
    "placeId" BIGINT NOT NULL,

    CONSTRAINT "PlaceLikes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceLikes_userId_key" ON "PlaceLikes"("userId");

-- AddForeignKey
ALTER TABLE "PlaceLikes" ADD CONSTRAINT "PlaceLikes_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
