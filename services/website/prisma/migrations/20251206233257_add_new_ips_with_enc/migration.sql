/*
  Warnings:

  - You are about to drop the `BannedIps` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "BannedIps";

-- CreateTable
CREATE TABLE "Ip" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "banned" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IpToUser" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_IpToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_IpToUser_B_index" ON "_IpToUser"("B");

-- AddForeignKey
ALTER TABLE "_IpToUser" ADD CONSTRAINT "_IpToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Ip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IpToUser" ADD CONSTRAINT "_IpToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
