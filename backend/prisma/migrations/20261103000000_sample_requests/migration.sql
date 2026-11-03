-- Free 20-company samples (cold e-mail link and SEO lead magnet)
CREATE TABLE "SampleRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "prospectedLeadId" TEXT,
    "segment" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'seo',
    "ipHash" TEXT,
    "convertedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SampleRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SampleRequest_email_createdAt_idx" ON "SampleRequest"("email", "createdAt");
CREATE INDEX "SampleRequest_ipHash_createdAt_idx" ON "SampleRequest"("ipHash", "createdAt");
CREATE INDEX "SampleRequest_prospectedLeadId_idx" ON "SampleRequest"("prospectedLeadId");
