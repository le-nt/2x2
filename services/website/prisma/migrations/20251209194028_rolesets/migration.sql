/*
  Warnings:

  - You are about to drop the `UserAdminStatus` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserAdminStatus" DROP CONSTRAINT "UserAdminStatus_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roleSet" "UserAdminTrait" NOT NULL DEFAULT 'Unprivileged';

-- DropTable
DROP TABLE "UserAdminStatus";
