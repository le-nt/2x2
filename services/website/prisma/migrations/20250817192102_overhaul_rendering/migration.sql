/*
  Warnings:

  - You are about to drop the `Render` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Render" DROP CONSTRAINT "Render_userId_fkey";

-- DropTable
DROP TABLE "Render";

-- CreateTable
CREATE TABLE "AvatarRender" (
    "id" TEXT NOT NULL,
    "characterAppearanceHash" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,

    CONSTRAINT "AvatarRender_pkey" PRIMARY KEY ("id")
);
