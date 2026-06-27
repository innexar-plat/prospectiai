# Módulo Auto-Prospecção — Documentação Interna

> **CONFIDENCIAL — USO INTERNO**
> Este documento é exclusivo para a equipe técnica e operacional da Precision IA.
> Não compartilhar com clientes ou terceiros.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura e Fluxo Completo](#2-arquitetura-e-fluxo-completo)
3. [Como Ativar para um Workspace](#3-como-ativar-para-um-workspace)
4. [Configurações Disponíveis](#4-configurações-disponíveis)
5. [Perfis de Busca](#5-perfis-de-busca)
6. [Pool de Remetentes](#6-pool-de-remetentes)
7. [Templates de Email](#7-templates-de-email)
8. [Ciclo de Vida do Lead](#8-ciclo-de-vida-do-lead)
9. [Sequência de Email Automática](#9-sequência-de-email-automática)
10. [Rastreamento de Abertura](#10-rastreamento-de-abertura)
11. [Integração CRM](#11-integração-crm)
12. [Crons — Agendamento no Servidor](#12-crons--agendamento-no-servidor)
13. [Banco de Dados — Modelos](#13-banco-de-dados--modelos)
14. [APIs Administrativas](#14-apis-administrativas)
15. [Observabilidade e Logs](#15-observabilidade-e-logs)
16. [Operações Manuais Comuns](#16-operações-manuais-comuns)
17. [Limitações Conhecidas](#17-limitações-conhecidas)

---

## 1. Visão Geral

O módulo de **Auto-Prospecção** é um pipeline totalmente automatizado que:

1. **Busca empresas** na base de dados da Receita Federal (RfCompany) usando perfis de busca configuráveis
2. **Analisa cada empresa** com IA (Gemini) gerando um score de 0 a 100 e um resumo estratégico
3. **Classifica leads** em HOT (≥70), WARM (40–69) ou COLD (<40)
4. **Dispara sequência de emails** automática para leads HOT/WARM
5. **Envia leads HOT** automaticamente para o CRM do workspace (RD Station, HubSpot, Agendor)
6. **Rastreia abertura** de emails via pixel de rastreamento

> Este módulo **não é exibido para clientes comuns**. É ativado manualmente pela equipe interna workspace a workspace via painel admin.

---

## 2. Arquitetura e Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                         CRON (HOST)                             │
│                                                                 │
│  0 8,14,20,2 * * *  → /api/cron/auto-prospeccao/search         │
│  30 8,14,20,2 * * * → /api/cron/auto-prospeccao/analyze        │
│  */30 * * * *       → /api/cron/auto-prospeccao/email-sequence  │
│  */30 * * * *       → /api/cron/auto-prospeccao/crm-push        │
│  1 0 * * *          → /api/cron/auto-prospeccao/reset-sender-counts │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SEARCH WORKER                              │
│  Para cada workspace com isActive=true:                         │
│  1. Pega SearchProfile com nextRunAt <= now                     │
│  2. Consulta RfCompany com filtros do perfil                     │
│  3. Cria ProspectedLead (status=NEW) — deduplica por (ws,cnpj)  │
│  4. Atualiza nextRunAt do perfil                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │ ~30min depois
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ANALYZE WORKER                              │
│  Para cada lead com status=NEW:                                 │
│  1. Monta prompt com dados da empresa                           │
│  2. Envia para Gemini → score (0-100) + resumo + fatores        │
│  3. Atualiza: score, aiAnalysisSummary, aiScoreFactors          │
│  4. Status: COLD | WARM | HOT                                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ a cada 30min
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  EMAIL SEQUENCE WORKER                          │
│  Inicia: leads HOT/WARM sem email → status=EMAILING             │
│  Avança: leads EMAILING com intervalo mínimo atingido           │
│  3 steps máximos (HOT_COLD_INTRO → HOT_FOLLOW_* → HOT_LAST)    │
│  • Injeta pixel de rastreamento no HTML                         │
│  • Round-robin pelo SenderPool du workspace                     │
│  • Fallback para EmailConfig do sistema                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │ a cada 30min
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CRM PUSH WORKER                            │
│  Para leads HOT e EMAILING não enviados ao CRM:                 │
│  1. Monta payload conforme provider (RD Station / HubSpot /     │
│     Agendor)                                                    │
│  2. Envia via OAuth / API Key do workspace                      │
│  3. Salva crmId, crmPushedAt, crmProvider no lead               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Como Ativar para um Workspace

### Passo 1 — Habilitar o módulo

1. Acesse o painel admin: `https://precisionia.com.br/admin`
2. Vá em **Auto-Prospecção → Configurações**
3. Selecione o workspace
4. Ative a chave **"Módulo ativo"** (`isActive = true`)
5. Salve

### Passo 2 — Configurar pelo menos 1 Perfil de Busca

1. Vá em **Auto-Prospecção → Perfis de Busca**
2. Crie um perfil com os filtros desejados (segmento, UF, porte, CNAE)
3. O sistema já usa os perfis do sistema se nenhum personalizado existir

### Passo 3 — Configurar Pool de Remetentes (opcional mas recomendado)

1. Vá em **Auto-Prospecção → Pool de Remetentes**
2. Adicione pelo menos 1 remetente (Resend ou SMTP)
3. Teste com o botão "Testar remetente"
4. Se não configurar, os emails saem pelo EmailConfig global do sistema

### Passo 4 — Testar manualmente (opcional)

Execute os endpoints de cron manualmente via curl ou Postman para validar antes do próximo ciclo automático:

```bash
# 1. Busca
curl -X POST https://precisionia.com.br/api/cron/auto-prospeccao/search \
  -H "Authorization: Bearer <CRON_SECRET>"

# 2. Análise IA
curl -X POST https://precisionia.com.br/api/cron/auto-prospeccao/analyze \
  -H "Authorization: Bearer <CRON_SECRET>"

# 3. Email
curl -X POST https://precisionia.com.br/api/cron/auto-prospeccao/email-sequence \
  -H "Authorization: Bearer <CRON_SECRET>"

# 4. CRM
curl -X POST https://precisionia.com.br/api/cron/auto-prospeccao/crm-push \
  -H "Authorization: Bearer <CRON_SECRET>"
```

> **CRON_SECRET** = `54bebe0a5743be95a408830e3b51358bc98718cb96af7757d60b56f2b75caff3`

---

## 4. Configurações Disponíveis

Todas as configurações ficam em `AutoProspeccaoConfig` (1 por workspace).

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `isActive` | `false` | Liga/desliga o módulo para o workspace |
| `scheduleDays` | `[1,2,3,4,5]` | Dias da semana ativos (1=Seg, 7=Dom) |
| `scheduleTimeStart` | `08:00` | Hora de início do envio de emails |
| `scheduleTimeEnd` | `20:00` | Hora de fim do envio de emails |
| `searchIntervalHours` | `24` | Horas entre cada ciclo de busca |
| `analyzeDelayMinutes` | `30` | Minutos de espera entre busca e análise |
| `maxLeadsPerRun` | `50` | Máximo de leads novos por rodada de busca |
| `maxEmailsPerDay` | `200` | Limite diário de emails por workspace |
| `maxCrmPushPerDay` | `100` | Limite diário de envios ao CRM |
| `hotScoreMin` | `70` | Score mínimo para classificar como HOT |
| `warmScoreMin` | `40` | Score mínimo para classificar como WARM |
| `crmAutoSend` | `false` | Enviar automaticamente leads ao CRM |
| `crmProvider` | `null` | Provider CRM: `rdstation`, `hubspot`, `agendor`, `all` |
| `crmOwnerUserId` | `null` | ID do owner no CRM para atribuição automática |
| `emailAutoSend` | `true` | Enviar sequência de email automaticamente |
| `emailStepIntervalHours` | `48` | Horas entre steps da sequência de email |
| `blockedCnpjs` | `[]` | Lista de CNPJs nunca prospectar (blacklist) |

---

## 5. Perfis de Busca

`SearchProfile` define **quais empresas buscar** da base RF.

### Filtros disponíveis

| Filtro | Exemplo | Descrição |
|--------|---------|-----------|
| `cnae` | `"7020400"` | CNAE único |
| `cnaeList` | `["7020400","7311400"]` | Lista de CNAEs |
| `uf` | `["SP","RJ","MG"]` | Estados |
| `municipio` | `"São Paulo"` | Município específico |
| `porte` | `["ME","EPP"]` | Porte: ME, EPP, DEMAIS, GRANDE |
| `hasEmail` | `true` | Só empresas com email cadastrado |
| `hasPhone` | `true` | Só empresas com telefone |
| `minCapital` | `50000` | Capital social mínimo (R$) |
| `openedAfter` | `"20220101"` | Abertura após esta data (YYYYMMDD) |

### Perfis do sistema vs. workspace

- **Perfis do sistema** (`isSystem=true`, `workspaceId=null`): criados pelo admin, visíveis para todos os workspaces
- **Perfis do workspace**: personalizados por workspace, têm prioridade sobre os do sistema

### Ordem de execução

Os perfis são executados por `priority ASC` (menor número = executado primeiro).

---

## 6. Pool de Remetentes

O pool permite configurar **múltiplos remetentes** por workspace com balanceamento automático.

### Como funciona

- O worker seleciona o remetente com `lastUsedAt` mais antigo que ainda tem capacidade (`sentToday < dailyLimit`)
- Após cada envio: `sentToday++` e `lastUsedAt = agora`
- Às 00:01 de cada dia: `sentToday = 0` (reset pelo cron `reset-sender-counts`)
- Se o pool estiver vazio ou todos os remetentes atingiram o limite: usa o `EmailConfig` global do sistema

### Campos do remetente

| Campo | Descrição |
|-------|-----------|
| `label` | Nome interno (ex: "Domínio Principal") |
| `provider` | `resend` ou `smtp` |
| `fromEmail` | Endereço completo, ex: `"Contato <contato@empresa.com>"` |
| `isActive` | Liga/desliga o remetente |
| `dailyLimit` | Máximo de envios por dia (padrão: 200) |
| `sentToday` | Contador de hoje (resetado diariamente) |
| `resendApiKeyEncrypted` | API Key do Resend (criptografada AES-256-GCM) |
| `smtpHost/Port/User` | Credenciais SMTP |
| `smtpPasswordEncrypted` | Senha SMTP (criptografada AES-256-GCM) |

### Segurança

Todas as credenciais (Resend API Key e SMTP password) são armazenadas **criptografadas** com AES-256-GCM usando a chave `AI_CONFIG_ENCRYPTION_KEY` do servidor. Nunca são expostas nas respostas da API.

---

## 7. Templates de Email

### Tipos de template (enum `AutoProspTemplateType`)

| Tipo | Quando é usado |
|------|---------------|
| `HOT_COLD_INTRO` | Step 1 — D+0: Apresentação inicial para lead HOT |
| `HOT_FOLLOW_NO_OPEN` | Step 2 — D+N: Follow-up se o lead NÃO abriu o step 1 |
| `HOT_FOLLOW_OPENED` | Step 2 — D+N: Follow-up se o lead ABRIU o step 1 (mais personalizado) |
| `HOT_LAST_ATTEMPT` | Step 3 — D+N: Última tentativa + oferta |
| `WARM_WEEK1_EDUCATION` | Semana 1: Conteúdo educativo para lead WARM |
| `WARM_WEEK2_VALUE` | Semana 2: Email de valor / insight |
| `WARM_WEEK3_SOCIAL` | Semana 3: Prova social / case |
| `WARM_WEEK4_OFFER` | Semana 4: Oferta trial + CTA |
| `CUSTOM` | Template personalizado pelo workspace |

### Variáveis disponíveis nos templates

| Variável | Exemplo de saída |
|----------|-----------------|
| `{{razaoSocial}}` | "Tech Solutions Ltda" |

> Mais variáveis podem ser adicionadas no `interpolate()` do worker conforme necessidade.

### Prioridade de resolução

1. Template personalizado do workspace (mesmo type, `isSystem=false`)
2. Template do sistema (mesmo type, `isSystem=true`)
3. Template hardcoded mínimo (fallback de emergência no código)

### Editar templates no admin

1. **Auto-Prospecção → Templates de Email**
2. Para editar um sistema: clique no template e edite diretamente
3. Para criar um template específico de workspace: crie com `workspaceId` preenchido

---

## 8. Ciclo de Vida do Lead

```
NEW
 │
 ├─ [analyze worker] ──────────────→ COLD (score < warmScoreMin → descartado)
 │                    └──────────→ WARM (warmScoreMin ≤ score < hotScoreMin)
 │                    └──────────→ HOT (score ≥ hotScoreMin)
 │
 ├─ [email worker] → EMAILING (step 1 enviado)
 │                       │
 │                   step 2, step 3...
 │                       │
 │            (após step 3 sem engajamento) → COLD
 │
 ├─ [crm worker] → CRM_SENT
 │
 ├─ [pixel de abertura] → ENGAGED
 │
 └─ [manual] → CONVERTED | OPTED_OUT | BOUNCED
```

### Status detalhado

| Status | Descrição |
|--------|-----------|
| `NEW` | Recém-encontrado na busca, aguarda análise |
| `ANALYZING` | IA está processando |
| `SCORED` | Score calculado (transitório, evolui para COLD/WARM/HOT) |
| `COLD` | Score baixo ou sem engajamento após sequência completa |
| `WARM` | Score médio — em nurturing de longo prazo |
| `HOT` | Score alto — prioridade máxima |
| `EMAILING` | Em sequência de email ativa |
| `CRM_SENT` | Enviado ao CRM com sucesso |
| `ENGAGED` | Abriu ou clicou em algum email |
| `CONVERTED` | Virou cliente (atualização manual) |
| `BOUNCED` | Email inválido / hard bounce |
| `OPTED_OUT` | Solicitou opt-out / unsubscribe |

---

## 9. Sequência de Email Automática

### Lógica do worker (`email-sequence.worker.ts`)

**Fase 1 — Iniciar sequência** (para leads HOT/WARM sem nenhum email):
- Busca até 30 leads HOT/WARM por rodada (HOT primeiro, depois por score desc)
- Envia step 1 (`HOT_COLD_INTRO`)
- Muda status para `EMAILING`

**Fase 2 — Avançar sequência** (para leads `EMAILING`):
- Verifica se passou `emailStepIntervalHours` desde o último step
- Verifica se o step anterior foi aberto (via `openedAt`)
  - Se **abriu**: usa `HOT_FOLLOW_OPENED`
  - Se **não abriu**: usa `HOT_FOLLOW_NO_OPEN`
- Step máximo: 3. Após o step 3, o lead vai para `COLD` se sem engajamento

### Exemplo de timeline (intervalo = 48h)

```
D+0   → Step 1: HOT_COLD_INTRO
D+2   → Step 2: HOT_FOLLOW_OPENED ou HOT_FOLLOW_NO_OPEN (baseado em abertura)
D+4   → Step 3: HOT_LAST_ATTEMPT
D+4+  → Status = COLD (sequência encerrada)
```

---

## 10. Rastreamento de Abertura

### Como funciona

1. Antes de cada envio, o worker gera um `eventId = crypto.randomUUID()`
2. Um pixel invisível é injetado no HTML do email:
   ```html
   <img src="https://precisionia.com.br/api/track/email/open/{eventId}"
        width="1" height="1" style="display:none" />
   ```
3. Quando o destinatário abre o email, o cliente de email carrega a imagem
4. O endpoint registra `openedAt = now()` no `ProspectedLeadEmailEvent`
5. No próximo ciclo do worker, o step 2 usa esta informação para personalizar o template

### Endpoint de rastreamento

```
GET /api/track/email/open/:eventId
```
- Retorna um GIF 1x1 transparente
- Cache-Control: no-store
- Registra apenas a **primeira abertura** (idempotente)
- Não requer autenticação (é um pixel público)

### Limitações

- Clientes de email que bloqueiam imagens externas (Apple Mail, Outlook por padrão) **não registram abertura**
- iOS 15+ (Mail Privacy Protection) pode criar falso positivo de abertura

---

## 11. Integração CRM

### Providers suportados

| Provider | Autenticação | Deduplicação |
|----------|-------------|-------------|
| RD Station | OAuth 2.0 | Por CNPJ/email |
| HubSpot | API Key | Por email |
| Agendor | API Token | Por CNPJ |
| `all` | Todos configurados | Envia para todos |

### Configuração necessária

A integração CRM usa a conexão OAuth/API Key já configurada no workspace em `CrmIntegration`. O módulo de auto-prospecção apenas **lê** essa conexão e usa para enviar leads.

Para ativar o envio automático ao CRM:
- `crmAutoSend = true`
- `crmProvider = "rdstation"` (ou outro)
- Workspace deve ter a integração CRM OAuth configurada

### O que é enviado ao CRM

Por padrão, é enviado:
- Razão social
- CNPJ
- Email
- Telefone
- Score de IA
- Resumo da análise IA
- Link para o lead no painel

---

## 12. Crons — Agendamento no Servidor

Os crons rodam no **host do servidor** (não dentro do Docker) via `crontab`.

### Cronograma atual

| Horário | Endpoint | Log |
|---------|----------|-----|
| `*/30 * * * *` | `/api/cron/auto-prospeccao/email-sequence` | `/var/log/prospector-cron-email.log` |
| `*/30 * * * *` | `/api/cron/auto-prospeccao/crm-push` | `/var/log/prospector-cron-crm.log` |
| `0 8,14,20,2 * * *` | `/api/cron/auto-prospeccao/search` | `/var/log/prospector-cron-search.log` |
| `30 8,14,20,2 * * *` | `/api/cron/auto-prospeccao/analyze` | `/var/log/prospector-cron-analyze.log` |
| `1 0 * * *` | `/api/cron/auto-prospeccao/reset-sender-counts` | `/var/log/prospector-cron-reset.log` |

### Autenticação dos crons

Todos os endpoints de cron exigem o header:
```
Authorization: Bearer <CRON_SECRET>
```

O `CRON_SECRET` é definido na variável de ambiente `CRON_SECRET` do backend.

### Verificar logs de cron

```bash
# Últimos emails enviados
tail -50 /var/log/prospector-cron-email.log

# Últimas buscas
tail -50 /var/log/prospector-cron-search.log

# Últimas análises IA
tail -50 /var/log/prospector-cron-analyze.log

# Últimos envios CRM
tail -50 /var/log/prospector-cron-crm.log

# Reset de contadores diários
tail -20 /var/log/prospector-cron-reset.log
```

### Editar crontab

```bash
crontab -e
```

---

## 13. Banco de Dados — Modelos

### `AutoProspeccaoConfig`
Configuração principal. **1 registro por workspace.**

### `SearchProfile`
Perfil de busca. Pode ser do sistema (`isSystem=true`) ou do workspace. Contém todos os filtros para a query na `RfCompany`.

### `ProspectedLead`
Lead encontrado. **Chave única: `(workspaceId, cnpj)`** — não duplica o mesmo CNPJ no mesmo workspace.

### `ProspectedLeadEmailEvent`
Cada email enviado. Contém `sentAt`, `openedAt`, `clickedAt`, `bouncedAt` por step.

### `AutoProspSenderPool`
Pool de remetentes de email por workspace. Credenciais criptografadas.

### `AutoProspeccaoTemplate`
Templates de email. `isSystem=true` = sistema, `workspaceId` preenchido = workspace-specific.

### `AutoProspeccaoRun`
Log de cada execução do módulo. Contém métricas: `leadsFound`, `leadsAnalyzed`, `leadsHot`, `leadsWarm`, `leadsCold`, `emailsQueued`, `crmPushed`.

---

## 14. APIs Administrativas

Todas as rotas abaixo requerem sessão de admin (`isAdmin(session) === true`).

### Configuração

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/admin/auto-prospeccao/config?workspaceId=` | Ler config |
| `PATCH` | `/api/admin/auto-prospeccao/config?workspaceId=` | Atualizar config |

### Perfis de Busca

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/admin/auto-prospeccao/search-profiles` | Listar todos |
| `POST` | `/api/admin/auto-prospeccao/search-profiles` | Criar perfil |
| `PATCH` | `/api/admin/auto-prospeccao/search-profiles/:id` | Atualizar |
| `DELETE` | `/api/admin/auto-prospeccao/search-profiles/:id` | Remover |

### Templates

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/admin/auto-prospeccao/templates` | Listar |
| `POST` | `/api/admin/auto-prospeccao/templates` | Criar |
| `GET` | `/api/admin/auto-prospeccao/templates/:id` | Ler um |
| `PATCH` | `/api/admin/auto-prospeccao/templates/:id` | Atualizar |
| `DELETE` | `/api/admin/auto-prospeccao/templates/:id` | Remover |

### Pool de Remetentes

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/admin/auto-prospeccao/sender-pool?workspaceId=` | Listar |
| `POST` | `/api/admin/auto-prospeccao/sender-pool` | Criar remetente |
| `PATCH` | `/api/admin/auto-prospeccao/sender-pool/:id` | Atualizar |
| `DELETE` | `/api/admin/auto-prospeccao/sender-pool/:id` | Remover |
| `POST` | `/api/admin/auto-prospeccao/sender-pool/:id/test` | Enviar email teste |

### Workspaces com módulo ativo

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/admin/auto-prospeccao/workspaces` | Listar workspaces ativos |
| `POST` | `/api/admin/auto-prospeccao/workspaces/:id/toggle` | Ativar/desativar módulo |

### Crons (disparo manual)

| Método | Rota | Auth |
|--------|------|------|
| `POST` | `/api/cron/auto-prospeccao/search` | Bearer token |
| `POST` | `/api/cron/auto-prospeccao/analyze` | Bearer token |
| `POST` | `/api/cron/auto-prospeccao/email-sequence` | Bearer token |
| `POST` | `/api/cron/auto-prospeccao/crm-push` | Bearer token |
| `POST` | `/api/cron/auto-prospeccao/reset-sender-counts` | Bearer token |

---

## 15. Observabilidade e Logs

### Logs das aplicações

```bash
# Logs em tempo real do backend
docker logs -f prospector-backend --since 1h

# Filtrar só logs do módulo de auto-prospecção
docker logs prospector-backend 2>&1 | grep "auto-prospeccao\|email-sequence\|crm-push\|analyze\|search"

# Logs do frontend/admin
docker logs -f prospector-frontend --since 1h
```

### Consultas úteis no banco

```sql
-- Quantos leads por workspace e status
SELECT workspaceId, status, COUNT(*) as total
FROM "ProspectedLead"
GROUP BY workspaceId, status
ORDER BY workspaceId, total DESC;

-- Leads HOT sem email enviado
SELECT id, razaoSocial, email, score
FROM "ProspectedLead"
WHERE status = 'HOT' AND email IS NOT NULL
AND (SELECT COUNT(*) FROM "ProspectedLeadEmailEvent" e WHERE e."leadId" = "ProspectedLead".id) = 0;

-- Taxa de abertura por step
SELECT step,
  COUNT(*) as total,
  COUNT("openedAt") as abertos,
  ROUND(COUNT("openedAt")::numeric / COUNT(*) * 100, 1) as taxa_abertura
FROM "ProspectedLeadEmailEvent"
WHERE "sentAt" IS NOT NULL
GROUP BY step
ORDER BY step;

-- Últimas runs
SELECT id, workspaceId, triggeredBy, status, leadsFound, 
       leadsHot, emailsQueued, crmPushed, startedAt, completedAt
FROM "AutoProspeccaoRun"
ORDER BY "startedAt" DESC
LIMIT 20;

-- Contagem de emails enviados hoje
SELECT COUNT(*) as emails_hoje
FROM "ProspectedLeadEmailEvent"
WHERE "sentAt" >= CURRENT_DATE;
```

---

## 16. Operações Manuais Comuns

### Reprocessar leads COLD para um workspace

```sql
-- Voltar leads COLD recentes para SCORED (novo ciclo de email)
UPDATE "ProspectedLead"
SET status = 'SCORED', "updatedAt" = NOW()
WHERE "workspaceId" = 'WORKSPACE_ID'
  AND status = 'COLD'
  AND "createdAt" >= NOW() - INTERVAL '7 days';
```

### Bloquear um CNPJ específico

Via API (adiciona ao `blockedCnpjs` da config):
```bash
PATCH /api/admin/auto-prospeccao/config?workspaceId=<id>
{ "blockedCnpjs": ["12345678000190", "98765432000111"] }
```

### Resetar contador de remetentes manualmente

```bash
curl -X POST https://precisionia.com.br/api/cron/auto-prospeccao/reset-sender-counts \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### Forçar envio de email para um lead específico

Não há endpoint direto. Para casos urgentes, altere o status do lead para `HOT` e execute o worker manualmente:

```sql
UPDATE "ProspectedLead" SET status = 'HOT', "updatedAt" = NOW()
WHERE id = 'LEAD_ID';
```

Depois dispare o cron de email-sequence.

### Ver qual template está sendo usado

O sistema resolve na ordem: workspace personalizado → sistema → hardcoded. Para debugar qual template está sendo selecionado, procure no log do backend pelo `templateId` registrado em `ProspectedLeadEmailEvent`.

---

## 17. Limitações Conhecidas

| Limitação | Impacto | Solução futura |
|-----------|---------|---------------|
| Sequência de email apenas para HOT (WARM ainda não totalmente implementado) | Leads WARM não entram na sequência de nurturing de 4 semanas | Implementar WARM_WEEK* templates no worker |
| `emailStepIntervalHours` é único para todos os steps | Não dá para ter D+2 para step 2 e D+7 para step 3 | Adicionar `stepIntervalOverrides` por step |
| Rastreamento de abertura não funciona em clients com imagens bloqueadas | Taxa de abertura subestimada | Implementar rastreamento por link (click tracking) |
| WhatsApp desabilitado (`whatsappEnabled=false`) | Só email e CRM disponíveis | Fase futura — integração com WhatsApp Business API |
| Sem unsubscribe automático | Requer opt-out manual pela equipe | Implementar link de unsubscribe nos templates |
| Sem bouncing automático | Emails com bounce não são marcados automaticamente | Implementar webhook de bounce do Resend |
| Perfis de busca não têm preview de quantidade antes de ativar | Usuário não sabe quantas empresas o perfil vai encontrar | Implementar endpoint de "count preview" |

---

## Contato e Responsabilidade

- **Módulo desenvolvido por**: Equipe técnica Precision IA
- **Repositório**: `/opt/prospector-ai`
- **Dúvidas técnicas**: chat interno da equipe
- **Ambiente de produção**: `https://precisionia.com.br`
- **Painel admin**: `https://precisionia.com.br/admin`

---

*Última atualização: Abril 2026*
