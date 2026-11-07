/*
  Warnings:

  - You are about to drop the column `gamePort` on the `Gameserver` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `Gameserver` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Gameserver_gamePort_key";

-- DropIndex
DROP INDEX "Gameserver_ipAddress_key";

-- AlterTable
ALTER TABLE "Gameserver" DROP COLUMN "gamePort",
DROP COLUMN "ipAddress";
