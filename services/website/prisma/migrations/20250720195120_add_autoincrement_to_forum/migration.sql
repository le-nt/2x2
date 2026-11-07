/*
  Warnings:

  - The primary key for the `Forum` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Forum` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `forumId` on the `ForumThread` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "ForumThread" DROP CONSTRAINT "ForumThread_forumId_fkey";

-- AlterTable
ALTER TABLE "Forum" DROP CONSTRAINT "Forum_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Forum_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ForumThread" DROP COLUMN "forumId",
ADD COLUMN     "forumId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
