-- Precision IA in the US: auto-prospecting workspace, created INACTIVE. Before activating:
--   1. a sender on a dedicated US domain in "AutoProspSenderPool" (never precisionia.com.br);
--   2. "postalAddress" filled in (CAN-SPAM) — the worker sends nothing without both.
BEGIN;
INSERT INTO "User" (id, name, plan, market, "createdAt", "updatedAt")
VALUES ('us-user-autoprosp', 'Precision US (auto-prospecting)', 'FREE', 'US', now(), now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO "Workspace" (id, name, plan, "createdAt", "updatedAt")
VALUES ('us-ws-autoprosp', 'Precision US — Auto-Prospecting', 'SCALE', now(), now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO "WorkspaceMember" (id, "userId", "workspaceId", role, "createdAt", "updatedAt")
VALUES ('us-member-autoprosp', 'us-user-autoprosp', 'us-ws-autoprosp', 'OWNER', now(), now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO "AutoProspeccaoConfig" (id, "workspaceId", "isActive", market, "maxLeadsPerRun", "maxEmailsPerDay", "hotScoreMin", "warmScoreMin",
  "crmAutoSend", "emailAutoSend", "emailStepIntervalHours", "useSystemSender", "replyToEmail", "senderName", "updatedAt")
VALUES ('us-config-autoprosp', 'us-ws-autoprosp', false, 'US', 30, 120, 60, 30, false, true, 72, false,
  'support@precisionia.com.br', 'Precision AI', now()) ON CONFLICT ("workspaceId") DO NOTHING;

-- Who sells to local businesses: agencies, web/IT, consultants, staffing, printing.
INSERT INTO "SearchProfile" (id, "workspaceId", "isSystem", "isActive", name, priority, "cnaeList", uf, "hasEmail", "updatedAt")
SELECT 'us-prof-' || k || '-' || lower(st), 'us-ws-autoprosp', false, true, label || ' — ' || st, prio, cats::jsonb, jsonb_build_array(st), true, now()
FROM (VALUES
  ('agencies', 'Marketing & advertising agencies', 1, '["marketing_agency","advertising_agency","web_designer"]'),
  ('it', 'IT services', 2, '["it_service_and_computer_repair","information_technology_company"]'),
  ('consulting', 'Business consultants', 3, '["business_consulting","b2b_business_management_service"]'),
  ('staffing', 'Staffing agencies', 4, '["employment_agency"]'),
  ('printing', 'Printing & signs', 5, '["printing_service","sign_making"]')
) s(k, label, prio, cats) CROSS JOIN (VALUES ('FL'), ('TX'), ('NY'), ('CA'), ('GA')) t(st)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "AutoProspeccaoTemplate" (id, name, type, subject, "bodyHtml", "isSystem", "workspaceId", "updatedAt") VALUES
('us-tpl-1', 'US — intro', 'HOT_COLD_INTRO', 'New clients for {{razaoSocial}}',
 '<p>Hi there,</p><p>Most teams that sell to local businesses lose hours building lists by hand before the first call.</p><p>Precision AI gives {{razaoSocial}} a list of U.S. businesses by industry and city — with phone, website and e-mail when available — plus an AI score and a draft message for each one.</p><p>You can try it free for 7 days (card required, cancel before day 8 and you pay nothing): <a href="{{amostraUrl}}">see how it works</a>.</p><p>Would a list of businesses around {{cidade}} be useful? Just reply and tell me the industry you sell to.</p><p>The Precision AI team</p>',
 false, 'us-ws-autoprosp', now()),
('us-tpl-2a', 'US — follow-up (opened)', 'HOT_FOLLOW_OPENED', 'Re: New clients for {{razaoSocial}}',
 '<p>Hi again,</p><p>If you tell me the industry and city you sell to, I can show you what the list looks like for {{razaoSocial}} — just reply to this e-mail.</p><p>Or try it yourself: <a href="{{amostraUrl}}">Precision AI</a>.</p><p>The Precision AI team</p>',
 false, 'us-ws-autoprosp', now()),
('us-tpl-2b', 'US — follow-up (not opened)', 'HOT_FOLLOW_NO_OPEN', 'Who does {{razaoSocial}} sell to?',
 '<p>Hi,</p><p>Precision AI finds U.S. businesses by industry and city and tells you which ones to contact first. If {{razaoSocial}} sells to local businesses around {{cidade}}, it may save you a few hours a week.</p><p><a href="{{amostraUrl}}">Take a look</a> or reply with the industry you target.</p><p>The Precision AI team</p>',
 false, 'us-ws-autoprosp', now()),
('us-tpl-3', 'US — last e-mail', 'HOT_LAST_ATTEMPT', 'Last note for {{razaoSocial}}',
 '<p>Hi,</p><p>This is my last e-mail. If finding new clients becomes a priority for {{razaoSocial}}, you can reply here any time or visit <a href="{{amostraUrl}}">Precision AI</a>.</p><p>Thanks,<br>The Precision AI team</p>',
 false, 'us-ws-autoprosp', now())
ON CONFLICT (id) DO NOTHING;
SELECT (SELECT count(*) FROM "SearchProfile" WHERE "workspaceId"='us-ws-autoprosp') perfis, (SELECT count(*) FROM "AutoProspeccaoTemplate" WHERE "workspaceId"='us-ws-autoprosp') modelos, (SELECT "isActive" FROM "AutoProspeccaoConfig" WHERE "workspaceId"='us-ws-autoprosp') ativo;
COMMIT;
