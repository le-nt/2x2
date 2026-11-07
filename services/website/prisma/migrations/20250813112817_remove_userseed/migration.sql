/*
  Warnings:

  - You are about to drop the `UserSeed` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserSeed" DROP CONSTRAINT "UserSeed_userId_fkey";

-- DropTable
DROP TABLE "UserSeed";
