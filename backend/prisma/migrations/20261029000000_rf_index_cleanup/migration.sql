-- RfCompany (27M rows) carried 7.6 GB of indexes on a 4 GB database: they no longer fit in
-- memory, and every monthly import has to maintain all of them. Drop the ones that are
-- duplicated, covered by a composite index, or unused since queries switched to exact
-- (accent-free) city matches. Frees ~2.1 GB.
DROP INDEX IF EXISTS "idx_rfcompany_ddd_telefone";          -- duplicate of "RfCompany_ddd_telefone_idx"
DROP INDEX IF EXISTS "idx_rfcompany_upper_municipio";       -- queries now use municipio = $1
DROP INDEX IF EXISTS "idx_rfcompany_municipio_lower_trgm";  -- old LIKE '%city%' filter, removed
DROP INDEX IF EXISTS "RfCompany_cnaePrincipal_idx";         -- prefix of (cnaePrincipal, municipio, uf)
DROP INDEX IF EXISTS "RfCompany_uf_idx";                    -- prefix of (uf, cnaePrincipal)
DROP INDEX IF EXISTS "RfCompany_porte_idx";                 -- 3 distinct values, never selective
DROP INDEX IF EXISTS "RfCompany_municipio_uf_bairro_idx";   -- neighbourhood lookup uses idx_rfcompany_municipio_bairro (upper)
