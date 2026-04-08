-- Enable pg_trgm extension for trigram-based ILIKE index acceleration
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes on Lead.name and Lead.address for fast ILIKE '%...%' searches
CREATE INDEX IF NOT EXISTS "Lead_name_trgm_idx" ON "Lead" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_address_trgm_idx" ON "Lead" USING gin ("address" gin_trgm_ops);

-- B-tree index on lastSearchedAt for freshness filtering and ordering
CREATE INDEX IF NOT EXISTS "Lead_lastSearchedAt_idx" ON "Lead" ("lastSearchedAt" DESC NULLS LAST);

-- Partial indexes for hasWebsite/hasPhone filter push-down
CREATE INDEX IF NOT EXISTS "Lead_website_not_null_idx" ON "Lead" ("id") WHERE "website" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Lead_phone_not_null_idx" ON "Lead" ("id") WHERE "phone" IS NOT NULL;
