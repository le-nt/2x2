/*
  Warnings:

  - You are about to drop the column `adminStatusId` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_adminStatusId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "adminStatusId";

-- AlterTable
ALTER TABLE "UserAdminStatus" ALTER COLUMN "trait" SET DEFAULT 'Unprivileged';
