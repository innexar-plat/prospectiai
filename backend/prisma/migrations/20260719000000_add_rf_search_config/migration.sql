-- CreateTable
CREATE TABLE "RfSearchConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfSearchConfig_pkey" PRIMARY KEY ("id")
);

-- Insert default row
INSERT INTO "RfSearchConfig" ("id", "enabled", "updatedAt") VALUES ('rf-search-config-default', true, NOW());
