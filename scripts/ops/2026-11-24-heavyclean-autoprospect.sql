-- Heavy Clean: auto-prospecção B2B (higienização e impermeabilização de estofados) nas 6 cidades
-- atendidas da Baixada Santista. Workspace interno, sem login; remetente próprio
-- orcamento@heavyclean.com.br (SMTP do nosso servidor), respostas para comercial@heavyclean.com.br.
-- :sender_enc = senha SMTP já criptografada (encryptEmailSecret), passada por psql -v.
BEGIN;

INSERT INTO "User" (id, name, plan, "createdAt", "updatedAt")
VALUES ('hc-user-autoprosp', 'Heavy Clean (auto-prospecção)', 'FREE', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Workspace" (id, name, plan, "createdAt", "updatedAt")
VALUES ('hc-ws-autoprosp', 'Heavy Clean — Auto-Prospecção', 'SCALE', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "WorkspaceMember" (id, "userId", "workspaceId", role, "createdAt", "updatedAt")
VALUES ('hc-member-autoprosp', 'hc-user-autoprosp', 'hc-ws-autoprosp', 'OWNER', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "AutoProspeccaoConfig" (id, "workspaceId", "isActive", "searchIntervalHours", "maxLeadsPerRun",
  "maxEmailsPerDay", "hotScoreMin", "warmScoreMin", "crmAutoSend", "emailAutoSend", "emailStepIntervalHours",
  "useSystemSender", "replyToEmail", "senderName", "updatedAt")
VALUES ('hc-config-autoprosp', 'hc-ws-autoprosp', true, 72, 20,
  120, 60, 30, false, true, 72,
  false, 'comercial@heavyclean.com.br', 'Heavy Clean | Higienização de Estofados', now())
ON CONFLICT ("workspaceId") DO NOTHING;

INSERT INTO "AutoProspSenderPool" (id, "workspaceId", label, provider, "fromEmail", "isActive", "dailyLimit",
  "smtpHost", "smtpPort", "smtpUser", "smtpPasswordEncrypted", "updatedAt")
VALUES ('hc-sender-orcamento', 'hc-ws-autoprosp', 'heavyclean.com.br (servidor próprio)', 'smtp',
  'Heavy Clean <orcamento@heavyclean.com.br>', true, 120,
  'mail.innexar.com.br', 587, 'orcamento@heavyclean.com.br', :'sender_enc', now())
ON CONFLICT (id) DO NOTHING;

-- Perfis: 5 segmentos com estofados em quantidade × 6 cidades atendidas.
INSERT INTO "SearchProfile" (id, "workspaceId", "isSystem", "isActive", name, description, priority, "cnaeList", uf, municipio, "hasEmail", "updatedAt")
SELECT 'hc-prof-' || s.key || '-' || c.slug, 'hc-ws-autoprosp', false, true,
       s.label || ' — ' || c.name, s.descr, s.prio, s.cnaes::jsonb, '["SP"]'::jsonb, c.rf, true, now()
FROM (VALUES
  ('hoteis', 'Hotéis e pousadas', 'Colchões, sofás-cama e estofados dos quartos', 1, '["5510","5590"]'),
  ('clinicas', 'Clínicas e consultórios', 'Longarinas e poltronas de sala de espera', 2, '["8630","8650"]'),
  ('beleza', 'Salões de beleza e estética', 'Cadeiras, poltronas e macas estofadas', 3, '["9602"]'),
  ('imoveis', 'Imobiliárias e administradoras', 'Imóveis de temporada e condomínios administrados', 4, '["6821","6822"]'),
  ('restaurantes', 'Restaurantes', 'Cadeiras e bancos estofados de salão', 5, '["5611"]')
) AS s(key, label, descr, prio, cnaes)
CROSS JOIN (VALUES
  ('praia-grande', 'Praia Grande', 'PRAIA GRANDE'), ('santos', 'Santos', 'SANTOS'), ('sao-vicente', 'São Vicente', 'SAO VICENTE'),
  ('cubatao', 'Cubatão', 'CUBATAO'), ('mongagua', 'Mongaguá', 'MONGAGUA'), ('itanhaem', 'Itanhaém', 'ITANHAEM')
) AS c(slug, name, rf)
ON CONFLICT (id) DO NOTHING;

-- Modelos próprios para as 4 etapas (sem eles o sistema usaria os modelos do Precision IA).
INSERT INTO "AutoProspeccaoTemplate" (id, name, type, subject, preheader, "bodyHtml", "isSystem", "workspaceId", "updatedAt")
VALUES
('hc-tpl-1', 'Heavy Clean — apresentação', 'HOT_COLD_INTRO',
 'Estofados da {{razaoSocial}}',
 'Higienização no local, em {{cidade}}, fora do horário de atendimento.',
 '<p>Olá, tudo bem?</p>
<p>Sou da Heavy Clean, de Praia Grande. Nosso trabalho é um só: higienizar e impermeabilizar estofados — cadeiras, poltronas, longarinas, sofás de recepção e colchões — no próprio local, em {{cidade}} e região.</p>
<p>Para empresas como a {{razaoSocial}}, combinamos o horário para não atrapalhar o atendimento (antes de abrir, depois do expediente ou no fim de semana) e registramos o antes e depois de cada peça.</p>
<p>Se fizer sentido, me responda com a quantidade aproximada de peças ou mande fotos pelo WhatsApp <a href="https://wa.me/5511912801461?text=Ol%C3%A1!%20Recebi%20o%20e-mail%20da%20Heavy%20Clean%20e%20quero%20um%20or%C3%A7amento%20de%20higieniza%C3%A7%C3%A3o.">(11) 91280-1461</a> que eu envio o orçamento.</p>
<p>Abraço,<br>Equipe Heavy Clean<br>Higienização e impermeabilização de estofados · nota 5,0 no Google<br><a href="https://heavyclean.com.br/empresas">heavyclean.com.br</a></p>',
 false, 'hc-ws-autoprosp', now()),
('hc-tpl-2a', 'Heavy Clean — retorno (abriu)', 'HOT_FOLLOW_OPENED',
 'Re: Estofados da {{razaoSocial}}',
 'Uma ideia de frequência para quem recebe clientes todos os dias.',
 '<p>Olá,</p>
<p>Voltando ao meu e-mail: em clínicas, salões, pousadas e recepções, as peças mais usadas costumam pedir higienização a cada 3 a 6 meses — e a impermeabilização logo depois faz café, maquiagem e suor saírem com um pano.</p>
<p>Posso mandar uma proposta para a {{razaoSocial}} com valor por peça e uma sugestão de frequência. Basta responder este e-mail ou chamar no <a href="https://wa.me/5511912801461?text=Ol%C3%A1!%20Quero%20a%20proposta%20de%20higieniza%C3%A7%C3%A3o%20de%20estofados.">WhatsApp</a>.</p>
<p>Equipe Heavy Clean</p>',
 false, 'hc-ws-autoprosp', now()),
('hc-tpl-2b', 'Heavy Clean — retorno (não abriu)', 'HOT_FOLLOW_NO_OPEN',
 'Higienização de cadeiras e poltronas em {{cidade}}',
 'No local, com horário combinado e fotos de antes e depois.',
 '<p>Olá,</p>
<p>A Heavy Clean higieniza e impermeabiliza estofados de empresas em {{cidade}} e em toda a Baixada Santista: cadeiras, longarinas, poltronas, sofás e colchões, no próprio local e no horário que funcionar para vocês.</p>
<p>Se quiser um orçamento para a {{razaoSocial}}, responda com a quantidade de peças ou mande fotos pelo <a href="https://wa.me/5511912801461?text=Ol%C3%A1!%20Quero%20um%20or%C3%A7amento%20de%20higieniza%C3%A7%C3%A3o%20de%20estofados.">WhatsApp (11) 91280-1461</a>.</p>
<p>Equipe Heavy Clean · <a href="https://heavyclean.com.br">heavyclean.com.br</a></p>',
 false, 'hc-ws-autoprosp', now()),
('hc-tpl-3', 'Heavy Clean — última tentativa', 'HOT_LAST_ATTEMPT',
 'Fecho por aqui, {{razaoSocial}}',
 'Fica o contato para quando precisar.',
 '<p>Olá,</p>
<p>Não quero lotar sua caixa — este é meu último e-mail. Se em algum momento os estofados da {{razaoSocial}} precisarem de higienização ou proteção, é só responder aqui ou chamar no <a href="https://wa.me/5511912801461?text=Ol%C3%A1!%20Quero%20um%20or%C3%A7amento%20de%20higieniza%C3%A7%C3%A3o.">WhatsApp (11) 91280-1461</a>.</p>
<p>Obrigado pela atenção,<br>Equipe Heavy Clean</p>',
 false, 'hc-ws-autoprosp', now())
ON CONFLICT (id) DO NOTHING;

SELECT (SELECT count(*) FROM "SearchProfile" WHERE "workspaceId" = 'hc-ws-autoprosp') AS perfis,
       (SELECT count(*) FROM "AutoProspeccaoTemplate" WHERE "workspaceId" = 'hc-ws-autoprosp') AS modelos,
       (SELECT count(*) FROM "AutoProspSenderPool" WHERE "workspaceId" = 'hc-ws-autoprosp') AS remetentes;
COMMIT;
