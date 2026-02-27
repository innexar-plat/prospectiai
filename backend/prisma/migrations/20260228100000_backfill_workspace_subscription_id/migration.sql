-- Backfill Workspace.subscriptionId from User for existing workspaces where:
-- - workspace has paid plan and currentPeriodEnd set but subscriptionId null
-- - workspace owner (WorkspaceMember role OWNER) has User.subscriptionId set
-- Allows downgrade flow to work for users migrated from User-based billing.
UPDATE "Workspace" w
SET "subscriptionId" = u."subscriptionId",
    "updatedAt" = NOW()
FROM "WorkspaceMember" wm,
     "User" u
WHERE wm."workspaceId" = w.id
  AND wm."userId" = u.id
  AND wm.role = 'OWNER'
  AND w.plan != 'FREE'
  AND w."currentPeriodEnd" IS NOT NULL
  AND w."subscriptionId" IS NULL
  AND u."subscriptionId" IS NOT NULL;
