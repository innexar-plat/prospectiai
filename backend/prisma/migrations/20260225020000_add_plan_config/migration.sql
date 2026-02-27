-- CreateTable
CREATE TABLE "PlanConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadsLimit" INTEGER NOT NULL DEFAULT 10,
    "priceMonthlyBrl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceAnnualBrl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceMonthlyUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceAnnualUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modules" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanConfig_key_key" ON "PlanConfig"("key");

-- CreateIndex
CREATE INDEX "PlanConfig_isActive_idx" ON "PlanConfig"("isActive");

-- CreateIndex
CREATE INDEX "PlanConfig_sortOrder_idx" ON "PlanConfig"("sortOrder");
