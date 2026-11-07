-- CreateTable
CREATE TABLE "ArbiterNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "websocketUrl" TEXT NOT NULL,
    "https" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maintenanced" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ArbiterNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArbiterNode_name_key" ON "ArbiterNode"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ArbiterNode_url_key" ON "ArbiterNode"("url");

-- CreateIndex
CREATE UNIQUE INDEX "ArbiterNode_websocketUrl_key" ON "ArbiterNode"("websocketUrl");
