/*
  Warnings:

  - The values [GCandD] on the enum `ForumCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ForumCategory_new" AS ENUM ('Roblox', 'ClubHouses', 'GameCreationAndDevelopment', 'Entertainment');
ALTER TABLE "Forum" ALTER COLUMN "category" TYPE "ForumCategory_new" USING ("category"::text::"ForumCategory_new");
ALTER TYPE "ForumCategory" RENAME TO "ForumCategory_old";
ALTER TYPE "ForumCategory_new" RENAME TO "ForumCategory";
DROP TYPE "ForumCategory_old";
COMMIT;

-- AlterEnum
ALTER TYPE "UserAdminTrait" ADD VALUE 'ForumModerator';
