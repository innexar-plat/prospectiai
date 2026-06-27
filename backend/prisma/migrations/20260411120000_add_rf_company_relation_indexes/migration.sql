-- Indexes to speed up smart-relations queries on large RF datasets.
CREATE INDEX "idx_rf_company_cnae_municipio_uf"
ON "RfCompany" ("cnaePrincipal", "municipio", "uf");

CREATE INDEX "idx_rf_company_municipio_uf_bairro"
ON "RfCompany" ("municipio", "uf", "bairro");

CREATE INDEX "idx_rf_company_ddd_telefone"
ON "RfCompany" ("ddd", "telefone");

-- Case-insensitive shared-email lookup.
CREATE INDEX "idx_rf_company_email_lower"
ON "RfCompany" (LOWER("email"));
