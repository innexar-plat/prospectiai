-- US businesses (Overture Maps places), the US counterpart of "RfCompany".
CREATE TABLE "UsCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "basicCategory" TEXT,
    "address" TEXT,
    "city" TEXT,
    "cityNorm" TEXT,
    "state" CHAR(2) NOT NULL,
    "postcode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "operatingStatus" TEXT,
    "release" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsCompany_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UsCompany_state_category_idx" ON "UsCompany"("state", "category");
CREATE INDEX "UsCompany_category_cityNorm_state_idx" ON "UsCompany"("category", "cityNorm", "state");
CREATE INDEX "UsCompany_cityNorm_state_idx" ON "UsCompany"("cityNorm", "state");
