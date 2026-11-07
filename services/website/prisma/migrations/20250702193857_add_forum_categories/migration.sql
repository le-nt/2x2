/*
  Warnings:

  - Added the required column `category` to the `Forum` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ForumCategory" AS ENUM ('Roblox', 'ClubHouses', 'GCandD', 'Entertainment');

-- AlterTable
ALTER TABLE "Forum" ADD COLUMN     "category" "ForumCategory" NOT NULL;
