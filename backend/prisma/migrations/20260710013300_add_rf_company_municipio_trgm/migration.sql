-- Trigram index so `lower(municipio) LIKE '%term%'` (used by the RF cross-search)
-- can use an index scan instead of a sequential filter over 27M+ rows.
-- Already created CONCURRENTLY in production; IF NOT EXISTS makes this a fast no-op there.
CREATE INDEX IF NOT EXISTS idx_rfcompany_municipio_lower_trgm
ON "RfCompany" USING GIN (lower(municipio) gin_trgm_ops);
