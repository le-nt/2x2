-- AlterTable
ALTER TABLE "Gameserver" ALTER COLUMN "placeId" SET DATA TYPE BIGINT;

-- AddForeignKey
ALTER TABLE "Gameserver" ADD CONSTRAINT "Gameserver_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
