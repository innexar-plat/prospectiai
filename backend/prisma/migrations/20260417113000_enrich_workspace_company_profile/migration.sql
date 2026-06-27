-- Enrich workspace company profile with structured business and location fields
ALTER TABLE "Workspace" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "tradeName" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "primaryCnaeCode" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "primaryCnaeDescription" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "companySize" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "foundingDate" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "street" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "number" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "complement" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "neighborhood" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "city" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "state" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "serviceModel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "averageTicket" DOUBLE PRECISION;
ALTER TABLE "Workspace" ADD COLUMN "operationRadiusKm" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN "knownCompetitors" TEXT;

CREATE INDEX "Workspace_cnpj_idx" ON "Workspace"("cnpj");
CREATE INDEX "Workspace_city_state_idx" ON "Workspace"("city", "state");
CREATE INDEX "Workspace_primaryCnaeCode_idx" ON "Workspace"("primaryCnaeCode");