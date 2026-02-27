-- Add business profile fields to Workspace (one profile per workspace, shared by all members)
ALTER TABLE "Workspace" ADD COLUMN "companyName" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "productService" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "targetAudience" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "mainBenefit" TEXT;

-- Backfill: copy profile from first member's User for each workspace
UPDATE "Workspace" w
SET
  "companyName" = COALESCE(w."companyName", sub."companyName"),
  "productService" = COALESCE(w."productService", sub."productService"),
  "targetAudience" = COALESCE(w."targetAudience", sub."targetAudience"),
  "mainBenefit" = COALESCE(w."mainBenefit", sub."mainBenefit")
FROM (
  SELECT DISTINCT ON (wm."workspaceId") wm."workspaceId", u."companyName", u."productService", u."targetAudience", u."mainBenefit"
  FROM "WorkspaceMember" wm
  JOIN "User" u ON u.id = wm."userId"
  ORDER BY wm."workspaceId", wm."createdAt" ASC
) sub
WHERE w.id = sub."workspaceId";
