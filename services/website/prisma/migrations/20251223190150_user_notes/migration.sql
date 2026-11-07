-- CreateTable
CREATE TABLE "ModerationNotes" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "moderatorId" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationNotes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ModerationNotes" ADD CONSTRAINT "ModerationNotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationNotes" ADD CONSTRAINT "ModerationNotes_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
