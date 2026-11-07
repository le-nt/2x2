-- CreateEnum
CREATE TYPE "public"."ChatStyle" AS ENUM ('Classic', 'Bubble', 'ClassicAndBubble');

-- CreateEnum
CREATE TYPE "public"."Device" AS ENUM ('Computer', 'Phone', 'Tablet');

-- AlterTable
ALTER TABLE "public"."Place" ADD COLUMN     "allowAnyGearGenre" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowedGearCategories" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "chatStyle" "public"."ChatStyle" NOT NULL DEFAULT 'Classic',
ADD COLUMN     "commmentsAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "copyLocked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isBuildServer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "playableDevices" "public"."Device"[] DEFAULT ARRAY['Computer', 'Phone', 'Tablet']::"public"."Device"[],
ADD COLUMN     "vipEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "vipPrice" INTEGER NOT NULL DEFAULT 100;
