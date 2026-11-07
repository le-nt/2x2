-- CreateTable
CREATE TABLE "ThreadView" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThreadView_threadId_userId_key" ON "ThreadView"("threadId", "userId");

-- AddForeignKey
ALTER TABLE "ThreadView" ADD CONSTRAINT "ThreadView_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadView" ADD CONSTRAINT "ThreadView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
