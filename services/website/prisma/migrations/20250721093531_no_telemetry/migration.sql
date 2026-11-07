/*
  Warnings:

  - You are about to drop the `Telemetry` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "ArbiterNode" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lon" DOUBLE PRECISION;

-- DropTable
DROP TABLE "Telemetry";
