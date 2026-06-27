-- Deactivate legacy FREE plan in catalog
UPDATE "PlanConfig" SET "isActive" = false WHERE key = 'FREE';

-- Insert TRIAL plan config (not purchasable; assigned on signup)
INSERT INTO "PlanConfig" (id, key, name, "leadsLimit", "priceMonthlyBrl", "priceAnnualBrl", "priceMonthlyUsd", "priceAnnualUsd", modules, "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'cmm1trial0000o001trialplan01',
  'TRIAL',
  'Trial',
  50,
  0,
  0,
  0,
  0,
  '["MAPEAMENTO","INTELIGENCIA_LEADS","ANALISE_CONCORRENCIA","ACAO_COMERCIAL"]'::jsonb,
  false,
  -1,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  "leadsLimit" = EXCLUDED."leadsLimit",
  modules = EXCLUDED.modules,
  "isActive" = false,
  "updatedAt" = NOW();

-- Migrate existing FREE workspaces (real users) to TRIAL with 7 days from now
UPDATE "Workspace" w
SET
  plan = 'TRIAL',
  "leadsLimit" = 50,
  "subscriptionStatus" = 'trialing',
  "currentPeriodEnd" = NOW() + INTERVAL '7 days'
WHERE w.plan = 'FREE'
  AND NOT EXISTS (
    SELECT 1 FROM "WorkspaceMember" wm
    JOIN "User" u ON u.id = wm."userId"
    WHERE wm."workspaceId" = w.id
      AND wm.role = 'OWNER'
      AND (
        u.email LIKE '%@example.com'
        OR u.email LIKE '%bench%'
        OR u.email LIKE '%loadtest%'
        OR u.email LIKE '%stress%'
      )
  );

UPDATE "User" u
SET plan = 'TRIAL', "leadsLimit" = 50
WHERE u.plan = 'FREE'
  AND u.email NOT LIKE '%@example.com'
  AND u.email NOT LIKE '%bench%'
  AND u.email NOT LIKE '%loadtest%'
  AND u.email NOT LIKE '%stress%';

-- Update public plan prices (revised pricing)
UPDATE "PlanConfig" SET "priceMonthlyBrl" = 97, "priceAnnualBrl" = 989, "priceMonthlyUsd" = 19, "priceAnnualUsd" = 194, "updatedAt" = NOW() WHERE key = 'BASIC';
UPDATE "PlanConfig" SET "priceMonthlyBrl" = 297, "priceAnnualBrl" = 3029, "priceMonthlyUsd" = 59, "priceAnnualUsd" = 602, "updatedAt" = NOW() WHERE key = 'PRO';
UPDATE "PlanConfig" SET "priceMonthlyBrl" = 797, "priceAnnualBrl" = 8135, "priceMonthlyUsd" = 159, "priceAnnualUsd" = 1622, "updatedAt" = NOW() WHERE key = 'BUSINESS';
UPDATE "PlanConfig" SET "priceMonthlyBrl" = 1997, "priceAnnualBrl" = 20369, "priceMonthlyUsd" = 399, "priceAnnualUsd" = 4070, "updatedAt" = NOW() WHERE key = 'SCALE';
