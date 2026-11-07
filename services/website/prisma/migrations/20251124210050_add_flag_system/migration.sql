-- CreateTable
CREATE TABLE "Flag" (
    "id" TEXT NOT NULL,
    "flag" TEXT NOT NULL,

    CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FlagToUser" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FlagToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_FlagToUser_B_index" ON "_FlagToUser"("B");

-- AddForeignKey
ALTER TABLE "_FlagToUser" ADD CONSTRAINT "_FlagToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Flag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FlagToUser" ADD CONSTRAINT "_FlagToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
