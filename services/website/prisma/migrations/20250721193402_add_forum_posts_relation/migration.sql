/*
  Warnings:

  - Added the required column `forumId` to the `ForumPost` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ForumPost" ADD COLUMN     "forumId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
