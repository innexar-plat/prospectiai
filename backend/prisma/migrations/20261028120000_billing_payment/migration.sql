-- Ledger of received payments (admin revenue)
CREATE TABLE "BillingPayment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "method" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingPayment_externalId_key" ON "BillingPayment"("externalId");
CREATE INDEX "BillingPayment_workspaceId_idx" ON "BillingPayment"("workspaceId");
CREATE INDEX "BillingPayment_createdAt_idx" ON "BillingPayment"("createdAt");
