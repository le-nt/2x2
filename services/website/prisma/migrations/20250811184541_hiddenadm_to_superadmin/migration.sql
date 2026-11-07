/*
  Warnings:

  - The values [HiddenAdministrator] on the enum `UserAdminTrait` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserAdminTrait_new" AS ENUM ('Unprivileged', 'AssetManager', 'ForumModerator', 'Moderator', 'Administrator', 'SuperAdmin');
ALTER TABLE "UserAdminStatus" ALTER COLUMN "trait" DROP DEFAULT;
ALTER TABLE "UserAdminStatus" ALTER COLUMN "trait" TYPE "UserAdminTrait_new" USING ("trait"::text::"UserAdminTrait_new");
ALTER TYPE "UserAdminTrait" RENAME TO "UserAdminTrait_old";
ALTER TYPE "UserAdminTrait_new" RENAME TO "UserAdminTrait";
DROP TYPE "UserAdminTrait_old";
ALTER TABLE "UserAdminStatus" ALTER COLUMN "trait" SET DEFAULT 'Unprivileged';
COMMIT;
