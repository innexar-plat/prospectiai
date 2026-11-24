-- US auto-prospecting: Overture ids are longer than a CNPJ; CAN-SPAM needs a postal address.
ALTER TABLE "ProspectedLead" ALTER COLUMN "cnpj" TYPE VARCHAR(64);
ALTER TABLE "AutoProspeccaoConfig" ADD COLUMN "market" TEXT NOT NULL DEFAULT 'BR';
ALTER TABLE "AutoProspeccaoConfig" ADD COLUMN "postalAddress" TEXT;
