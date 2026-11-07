/*
  Warnings:

  - Added the required column `bust` to the `AvatarRender` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imageType` to the `AvatarRender` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AvatarRender" ADD COLUMN     "bust" BOOLEAN NOT NULL,
ADD COLUMN     "imageType" INTEGER NOT NULL;
