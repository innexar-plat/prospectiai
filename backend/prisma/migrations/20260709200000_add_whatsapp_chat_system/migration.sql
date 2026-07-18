-- AlterTable
ALTER TABLE "Representative" ADD COLUMN     "metaPhoneNumberId" TEXT,
ADD COLUMN     "whatsappProvider" TEXT NOT NULL DEFAULT 'EVOLUTION';

-- CreateTable
CREATE TABLE "AdminWhatsAppConfig" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Precision IA',
    "provider" TEXT NOT NULL DEFAULT 'META',
    "evolutionInstanceName" TEXT,
    "whatsappStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "whatsappNumber" TEXT,
    "whatsappConnectedAt" TIMESTAMP(3),
    "metaPhoneNumberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWhatsAppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT,
    "adminConfigId" TEXT,
    "workspaceId" TEXT,
    "contactNumber" TEXT NOT NULL,
    "contactName" TEXT,
    "repClientId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminWhatsAppConfig_evolutionInstanceName_key" ON "AdminWhatsAppConfig"("evolutionInstanceName");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWhatsAppConfig_metaPhoneNumberId_key" ON "AdminWhatsAppConfig"("metaPhoneNumberId");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_representativeId_lastMessageAt_idx" ON "WhatsAppConversation"("representativeId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_adminConfigId_lastMessageAt_idx" ON "WhatsAppConversation"("adminConfigId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_representativeId_contactNumber_key" ON "WhatsAppConversation"("representativeId", "contactNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_adminConfigId_contactNumber_key" ON "WhatsAppConversation"("adminConfigId", "contactNumber");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_conversationId_createdAt_idx" ON "WhatsAppMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_provider_providerMessageId_key" ON "WhatsAppMessage"("provider", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Representative_metaPhoneNumberId_key" ON "Representative"("metaPhoneNumberId");

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_adminConfigId_fkey" FOREIGN KEY ("adminConfigId") REFERENCES "AdminWhatsAppConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_repClientId_fkey" FOREIGN KEY ("repClientId") REFERENCES "RepClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

