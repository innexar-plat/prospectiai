-- Win-back campaigns + auto-prospecting activation (2026-10-29).
-- Idempotent: re-running does not duplicate templates/campaigns. Runs in one transaction.
-- Run: docker exec -i prospector-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < scripts/ops/2026-10-29-winback-and-autoprospect.sql

BEGIN;

-- 1. Retire templates with the old brand ("Prospector AI") or discounts that checkout does not
--    honour (BR promo pricing is disabled), and cancel drafts that use them.
UPDATE "EmailCampaign" SET status = 'CANCELLED', "updatedAt" = now()
WHERE status IN ('DRAFT', 'SCHEDULED')
  AND "templateId" IN ('cmnqr64ji0000qs4i2g5wvd99', 'cmnqr64jw0001qs4iycq8anjm', 'cmnqr64k40002qs4ii3o1wdsr',
                       'cmnqr64ka0003qs4idx6adbgw', 'cmnqr64kn0005qs4iqmjtypo9', 'cmnqr64l10007qs4ilf68axnl',
                       'cmnqr64ld0009qs4izf6jx10u');
UPDATE "EmailTemplate" SET status = 'ARCHIVED', "updatedAt" = now()
WHERE id IN ('cmnqr64ji0000qs4i2g5wvd99', 'cmnqr64jw0001qs4iycq8anjm', 'cmnqr64k40002qs4ii3o1wdsr',
             'cmnqr64ka0003qs4idx6adbgw', 'cmnqr64kn0005qs4iqmjtypo9', 'cmnqr64l10007qs4ilf68axnl',
             'cmnqr64ld0009qs4izf6jx10u');

-- 2. New templates (Precision IA, no discounts — only what the product really does today).
INSERT INTO "EmailTemplate" (id, name, slug, type, status, subject, preheader, body, "ctaLabel", "ctaUrl", "accentColor", "createdBy", "updatedAt")
VALUES (
  'tpl_winback_trial_2026_11',
  'Volta — trial expirado (nov/2026)',
  'winback-trial-2026-11',
  'PROMOTION', 'ACTIVE',
  '{{firstName}}, a Precision IA ficou bem diferente desde o seu teste',
  'Lista diária de quem contatar, mensagem pronta e milhões de empresas da Receita.',
  jsonb_build_object(
    'badge', 'Novidades',
    'subtitle', 'Encontrar o lead sempre foi fácil. Agora a plataforma também lembra você de voltar nele.',
    'paragraphs', jsonb_build_array(
      'Seu período de teste acabou, mas sua conta e as empresas que você salvou continuam lá.',
      'Ouvimos quem testou: o difícil não era achar empresas, era manter o ritmo de contato. Por isso mudamos três coisas:'
    ),
    'benefits', jsonb_build_array(
      'Rotina "Hoje": toda manhã, quem contatar — com a mensagem pronta e o WhatsApp em um clique.',
      'Base de Empresas: milhões de empresas da Receita Federal por segmento e cidade, inclusive as recém-abertas.',
      'Roteiro de venda por IA: para cada lead, por que falar agora, como abrir a conversa e como responder às objeções.'
    )
  ),
  'Ver planos',
  'https://precisionia.com.br/dashboard/planos?utm_source=email&utm_campaign=winback_trial_2026_11',
  '#4F46E5',
  'cmlzfjgaf0000pj01za4cn355',
  now()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "EmailTemplate" (id, name, slug, type, status, subject, preheader, body, "ctaLabel", "ctaUrl", "accentColor", "createdBy", "updatedAt")
VALUES (
  'tpl_novidades_2026_11',
  'Novidades — rotina de vendas (nov/2026)',
  'novidades-rotina-2026-11',
  'FEATURE_ANNOUNCEMENT', 'ACTIVE',
  'Novo na Precision IA: sua rotina de vendas em um só lugar',
  'Follow-ups lembrados, mensagens prontas e o próximo contato escrito pela IA.',
  jsonb_build_object(
    'badge', 'Novidade',
    'subtitle', 'Follow-ups lembrados, mensagens prontas e o próximo contato escrito pela IA.',
    'paragraphs', jsonb_build_array(
      'A maioria das vendas B2B fecha entre o 2º e o 5º contato — e é justamente aí que a gente se perde.',
      'A partir de agora, a Precision IA organiza esse ritmo para você.'
    ),
    'benefits', jsonb_build_array(
      'Lista "Hoje" no painel com os follow-ups do dia e os melhores leads ainda não contatados.',
      'Ao marcar um contato, o próximo follow-up é agendado sozinho — e você recebe um lembrete.',
      'A 2ª e a 3ª mensagem são escritas pela IA com um ângulo novo, sem repetir a primeira.',
      'Roteiro de venda em cada análise: abertura, perguntas, objeções e fechamento.'
    )
  ),
  'Abrir minha rotina de hoje',
  'https://precisionia.com.br/dashboard?utm_source=email&utm_campaign=novidades_2026_11#hoje',
  '#4F46E5',
  'cmlzfjgaf0000pj01za4cn355',
  now()
)
ON CONFLICT (slug) DO NOTHING;

-- 3. Campaigns. 10:00 Brasília (13:00 UTC). The second goes a week later; the shared marketing
--    cap (1 e-mail / 4 days) also keeps win-back e-mails and campaigns from stacking up.
INSERT INTO "EmailCampaign" (id, name, "templateId", audience, status, "scheduledAt", "createdBy", "updatedAt")
SELECT 'cmp_winback_trial_2026_11', 'Volta — trial expirado/cancelado', 'tpl_winback_trial_2026_11',
       'CHURNED', 'SCHEDULED', '2026-11-03 13:00:00+00', 'cmlzfjgaf0000pj01za4cn355', now()
WHERE NOT EXISTS (SELECT 1 FROM "EmailCampaign" WHERE id = 'cmp_winback_trial_2026_11');

INSERT INTO "EmailCampaign" (id, name, "templateId", audience, status, "scheduledAt", "createdBy", "updatedAt")
SELECT 'cmp_novidades_2026_11', 'Novidades — rotina de vendas (todos)', 'tpl_novidades_2026_11',
       'ALL', 'SCHEDULED', '2026-11-10 13:00:00+00', 'cmlzfjgaf0000pj01za4cn355', now()
WHERE NOT EXISTS (SELECT 1 FROM "EmailCampaign" WHERE id = 'cmp_novidades_2026_11');

-- 4. Cold-outreach templates: the trial is 7 days (TRIAL_DAYS), not 14; drop the invented case study.
UPDATE "AutoProspeccaoTemplate"
SET subject = replace(subject, '14 dias', '7 dias'),
    "bodyHtml" = replace("bodyHtml", '14 dias', '7 dias'),
    "bodyText" = replace("bodyText", '14 dias', '7 dias'),
    "updatedAt" = now()
WHERE subject LIKE '%14 dias%' OR "bodyHtml" LIKE '%14 dias%' OR "bodyText" LIKE '%14 dias%';

UPDATE "AutoProspeccaoTemplate"
SET subject = 'O que a prospecção com IA faz por uma equipe comercial em 30 dias',
    "bodyHtml" = '<html><body style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;max-width:560px;margin:0 auto;padding:24px;">'
      || '<p>Olá, {{razaoSocial}}.</p>'
      || '<p>Na Precision IA, uma equipe comercial passa a ter, todos os dias:</p>'
      || '<ul><li>Empresas do seu segmento e região vindas da base pública da Receita Federal, inclusive as recém-abertas;</li>'
      || '<li>Uma nota de oportunidade para cada uma, para começar pelas mais promissoras;</li>'
      || '<li>Um roteiro de abordagem escrito pela IA e a lista de follow-ups do dia.</li></ul>'
      || '<p>Se fizer sentido, você pode testar por 7 dias, sem cartão: <a href="https://precisionia.com.br/?utm_source=coldmail&utm_campaign=warm_week3">precisionia.com.br</a></p>'
      || '<p>Abraço,<br>Equipe Precision IA</p></body></html>',
    "bodyText" = 'Olá, {{razaoSocial}}. Na Precision IA, uma equipe comercial passa a ter todos os dias: empresas do seu segmento vindas da base pública da Receita Federal, uma nota de oportunidade para cada uma e um roteiro de abordagem escrito pela IA. Teste por 7 dias, sem cartão: https://precisionia.com.br',
    "updatedAt" = now()
WHERE type = 'WARM_WEEK3_SOCIAL';

-- 5. Turn auto-prospecting on for the company workspace, sending through the main sender with
--    warm-up (15/day first week → 30 → 60 → up to 120), business hours only, risky recipients
--    skipped. Requires migration 20261031000000_auto_prosp_system_sender (applied on deploy).
--    Set "Responder para" and "Nome do remetente" in Admin → Auto-prospecção → Configurações.
UPDATE "AutoProspeccaoConfig"
SET "isActive" = true, "emailAutoSend" = true, "useSystemSender" = true, "updatedAt" = now()
WHERE "workspaceId" = 'sys-workspace-precisionia';

COMMIT;

-- Check
SELECT c.name, c.audience, c.status, c."scheduledAt" FROM "EmailCampaign" c WHERE c.id LIKE 'cmp_%2026_11' ORDER BY c."scheduledAt";
SELECT "isActive", "emailAutoSend", "useSystemSender", "crmAutoSend" FROM "AutoProspeccaoConfig" WHERE "workspaceId" = 'sys-workspace-precisionia';
