-- Recent companies by niche/place (radar, win-back, free sample). Without it, a city-level
-- "opened since" lookup reads every company of the CNAE in the city from disk (30 s+ in São Paulo).
-- Production builds it beforehand with CREATE INDEX CONCURRENTLY; IF NOT EXISTS makes this a no-op there.
-- Partial index: refresh the cut-off yearly (the sample looks back 2 years).
CREATE INDEX IF NOT EXISTS "RfCompany_recent_cnae_uf_municipio_idx"
  ON "RfCompany" ("cnaePrincipal", uf, municipio, "dataAbertura")
  WHERE "dataAbertura" >= '20240101';
