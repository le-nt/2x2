/*
  Warnings:

  - You are about to drop the column `websocketUrl` on the `ArbiterNode` table. All the data in the column will be lost.
  - You are about to drop the column `jobId` on the `Gameserver` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nodeId]` on the table `Gameserver` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `countryCode` to the `ArbiterNode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gameserver` to the `ArbiterNode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `renderer` to the `ArbiterNode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nodeId` to the `Gameserver` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ArbiterNode_websocketUrl_key";

-- DropIndex
DROP INDEX "Gameserver_jobId_key";

-- AlterTable
ALTER TABLE "ArbiterNode" DROP COLUMN "websocketUrl",
ADD COLUMN     "countryCode" TEXT NOT NULL,
ADD COLUMN     "gameserver" BOOLEAN NOT NULL,
ADD COLUMN     "port" INTEGER,
ADD COLUMN     "renderer" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "Gameserver" DROP COLUMN "jobId",
ADD COLUMN     "nodeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "maxPlayerCount" INTEGER NOT NULL DEFAULT 10;

-- CreateIndex
CREATE UNIQUE INDEX "Gameserver_nodeId_key" ON "Gameserver"("nodeId");

-- AddForeignKey
ALTER TABLE "Gameserver" ADD CONSTRAINT "Gameserver_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ArbiterNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
