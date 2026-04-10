-- CreateTable: CNAE reference codes
CREATE TABLE "CnaeCode" (
    "code" VARCHAR(7) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "CnaeCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable: Receita Federal companies
CREATE TABLE "RfCompany" (
    "cnpj" VARCHAR(14) NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnaePrincipal" VARCHAR(7) NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "municipio" TEXT,
    "cep" VARCHAR(8),
    "bairro" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "ddd" VARCHAR(4),
    "telefone" TEXT,
    "email" TEXT,
    "porte" TEXT,
    "capitalSocial" DOUBLE PRECISION,
    "dataAbertura" TEXT,

    CONSTRAINT "RfCompany_pkey" PRIMARY KEY ("cnpj")
);

-- CreateIndex
CREATE INDEX "CnaeCode_description_idx" ON "CnaeCode"("description");

-- CreateIndex
CREATE INDEX "RfCompany_cnaePrincipal_idx" ON "RfCompany"("cnaePrincipal");

-- CreateIndex
CREATE INDEX "RfCompany_uf_idx" ON "RfCompany"("uf");

-- CreateIndex
CREATE INDEX "RfCompany_uf_cnaePrincipal_idx" ON "RfCompany"("uf", "cnaePrincipal");

-- CreateIndex
CREATE INDEX "RfCompany_municipio_idx" ON "RfCompany"("municipio");

-- CreateIndex
CREATE INDEX "RfCompany_porte_idx" ON "RfCompany"("porte");
