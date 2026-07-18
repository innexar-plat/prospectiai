-- AlterTable: WhatsApp/Evolution API connection fields on Representative
ALTER TABLE "Representative" ADD COLUMN "evolutionInstanceName" TEXT;
ALTER TABLE "Representative" ADD COLUMN "whatsappStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED';
ALTER TABLE "Representative" ADD COLUMN "whatsappNumber" TEXT;
ALTER TABLE "Representative" ADD COLUMN "whatsappConnectedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Representative_evolutionInstanceName_key" ON "Representative"("evolutionInstanceName");
