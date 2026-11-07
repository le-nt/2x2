-- CreateTable
CREATE TABLE "BannedIps" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedIps_pkey" PRIMARY KEY ("id")
);
