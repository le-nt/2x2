-- CreateEnum
CREATE TYPE "AppType" AS ENUM ('Backend2', 'Arbiter');

-- CreateEnum
CREATE TYPE "UserAdminTrait" AS ENUM ('AssetManager', 'Moderator', 'Administrator', 'HiddenAdministrator');

-- CreateEnum
CREATE TYPE "ModerationType" AS ENUM ('Warning', 'Ban_1Day', 'Ban_3Days', 'Ban_7Days', 'Ban_14Days', 'Ban_30Days', 'PermanentBan', 'IPBan');

-- CreateEnum
CREATE TYPE "RenderType" AS ENUM ('Hat', 'Shirt', 'Pants', 'User', 'UserBust');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('BuildersClub', 'TurboBuildersClub', 'OutrageousBuildersClub', 'PrestigiousBuildersClub');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "robux" BIGINT NOT NULL DEFAULT 25,
    "tickets" BIGINT NOT NULL DEFAULT 100,
    "lastLogin" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "about" TEXT NOT NULL DEFAULT '',
    "gender" INTEGER NOT NULL DEFAULT 0,
    "birthday" TIMESTAMP(3) NOT NULL,
    "adminStatusId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAdminStatus" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "trait" "UserAdminTrait" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorisedBy" INTEGER,

    CONSTRAINT "UserAdminStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSeed" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bad" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInventory" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccoutrements" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "userInventoryId" TEXT NOT NULL,

    CONSTRAINT "UserAccoutrements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "type" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Asset',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "creatorType" INTEGER NOT NULL,
    "assetCategory" INTEGER,
    "assetGenre" INTEGER NOT NULL,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moderation" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "activeUntil" TIMESTAMP(3),
    "reason" TEXT,
    "action" "ModerationType" NOT NULL,

    CONSTRAINT "Moderation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "merchantId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "special" BOOLEAN NOT NULL DEFAULT false,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedBy" INTEGER,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gameserver" (
    "id" TEXT NOT NULL,
    "placeId" INTEGER NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "gamePort" INTEGER NOT NULL,
    "playerCount" INTEGER NOT NULL DEFAULT 0,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gameserver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Render" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "RenderType" NOT NULL,
    "characterAppearanceHash" TEXT NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "Render_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "MembershipType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Telemetry" (
    "id" TEXT NOT NULL,
    "app" "AppType" NOT NULL,
    "event" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "Telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "priceInRobux" BIGINT NOT NULL DEFAULT 0,
    "priceInTickets" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isForSale" BOOLEAN NOT NULL DEFAULT true,
    "isLimited" BOOLEAN NOT NULL DEFAULT false,
    "isLimitedUnique" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Place',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetVersion" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,
    "versionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GameserverPlayers" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GameserverPlayers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_adminStatusId_key" ON "User"("adminStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAdminStatus_userId_key" ON "UserAdminStatus"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_usedBy_key" ON "Invite"("usedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Gameserver_placeId_key" ON "Gameserver"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "Gameserver_ipAddress_key" ON "Gameserver"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Gameserver_gamePort_key" ON "Gameserver"("gamePort");

-- CreateIndex
CREATE UNIQUE INDEX "Gameserver_jobId_key" ON "Gameserver"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_key" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_assetId_key" ON "Product"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetVersion_versionHash_key" ON "AssetVersion"("versionHash");

-- CreateIndex
CREATE UNIQUE INDEX "AssetVersion_assetId_versionId_key" ON "AssetVersion"("assetId", "versionId");

-- CreateIndex
CREATE INDEX "_GameserverPlayers_B_index" ON "_GameserverPlayers"("B");

-- AddForeignKey
ALTER TABLE "UserAdminStatus" ADD CONSTRAINT "UserAdminStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSeed" ADD CONSTRAINT "UserSeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccoutrements" ADD CONSTRAINT "UserAccoutrements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccoutrements" ADD CONSTRAINT "UserAccoutrements_userInventoryId_fkey" FOREIGN KEY ("userInventoryId") REFERENCES "UserInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moderation" ADD CONSTRAINT "Moderation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_id_fkey" FOREIGN KEY ("id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVersion" ADD CONSTRAINT "AssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameserverPlayers" ADD CONSTRAINT "_GameserverPlayers_A_fkey" FOREIGN KEY ("A") REFERENCES "Gameserver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GameserverPlayers" ADD CONSTRAINT "_GameserverPlayers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
