/*
  Warnings:

  - The values [PrestigiousBuildersClub] on the enum `MembershipType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MembershipType_new" AS ENUM ('BuildersClub', 'TurboBuildersClub', 'OutrageousBuildersClub');
ALTER TABLE "Membership" ALTER COLUMN "type" TYPE "MembershipType_new" USING ("type"::text::"MembershipType_new");
ALTER TYPE "MembershipType" RENAME TO "MembershipType_old";
ALTER TYPE "MembershipType_new" RENAME TO "MembershipType";
DROP TYPE "MembershipType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "UserAdminTrait" ADD VALUE 'ProtectedUser';
