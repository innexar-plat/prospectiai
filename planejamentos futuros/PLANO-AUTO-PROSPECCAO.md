# Plano de Auto-Prospecção — PrecisionAI
_Última atualização: 2026-04-11 — Módulo implementado e em produção_

---

## Objetivo

A plataforma encontra, analisa com IA, pontua e dispara contato automaticamente para empresas da base Receita Federal — sem interação manual. Pode ser usado:
1. **Internamente** pela PrecisionAI para prospectar clientes para a própria plataforma
2. **Por usuários autorizados** (owner ou membros ativados pelo owner da workspace)

---

## Visão Geral do Fluxo

```
[CRON] Dispara workers conforme schedule configurado
    │
    ▼
[search.worker]  Busca RfCompany por perfis ativos → cria ProspectedLead (status: NEW)
    │                                                  Deduplica por (workspaceId, cnpj)
    ▼
[analyze.worker] Chama módulo IA existente → score 0-100 → classifica HOT/WARM/COLD
    │                                          COLD → descartado; HOT/WARM → avançam
    ▼
[crm-push.worker]        Leads HOT → push ao CRM configurado (RD Station / HubSpot / Agendor)
    │                    Reutiliza integrações existentes em /api/integrations/
    ▼
[email-sequence.worker]  HOT: sequência 4 emails (D+0, D+3 condicional, D+7)
                         WARM: nurturing 4 semanas
                         Respeita EmailUnsubscribe (LGPD)
                         Registra ProspectedLeadEmailEvent por step
```

---

## Controle de Acesso

```
Admin do sistema (ADMIN_EMAILS)
  → Ativa Workspace.autoProspeccaoEnabled = true   (plano admin)
  → Configura templates de sistema (isSystem=true)

Owner da Workspace
  → Ativa WorkspaceMember.autoProspeccaoEnabled    (para cada membro)
  → Configura AutoProspeccaoConfig (schedule, limites, CRM, email)
  → Gerencia perfis de busca e templates da workspace

Membro autorizado
  → Lê painel, leads gerados, histórico de execuções
  → Não altera configuração (somente owner)

Guard no backend:
  1. workspace.autoProspeccaoEnabled === true
  2. member.role === 'OWNER' || member.autoProspeccaoEnabled === true
```

---

## Arquitetura: Conta Especial no Dashboard

- Criar conta dedicada (ex: `prospeccao@precisionia.com.br`) no dashboard principal
- Flag `isInternal: true` no banco (model User)
- Plano `INTERNAL` com créditos ilimitados (bypass no middleware)
- Usa 100% das funcionalidades existentes: busca, filtros, IA, pipeline, notas, campanhas de email
- Zero código novo na UI

### Implementação mínima:
1. Campo `isInternal: Boolean` no model User (Prisma)
2. Bypass de consumo de créditos para contas internas
3. Perfis de busca pré-configurados salvos na conta

---

## ESPECIFICAÇÃO TÉCNICA COMPLETA

### Modelos Prisma (6 novos + 2 campos em modelos existentes)

#### Extensões em modelos existentes
```prisma
model Workspace {
  // ... campos existentes ...
  autoProspeccaoEnabled Boolean @default(false)
}

model WorkspaceMember {
  // ... campos existentes ...
  autoProspeccaoEnabled Boolean @default(false)
}
```

#### AutoProspeccaoConfig — Configuração principal (1 por workspace)
```prisma
model AutoProspeccaoConfig {
  id                   String   @id @default(cuid())
  workspaceId          String   @unique
  isActive             Boolean  @default(false)
  scheduleDays         Json     @default("[1,2,3,4,5]")  // 1=Seg ... 7=Dom
  scheduleTimeStart    String   @default("08:00")
  scheduleTimeEnd      String   @default("20:00")
  searchIntervalHours  Int      @default(24)
  analyzeDelayMinutes  Int      @default(30)
  maxLeadsPerRun       Int      @default(50)
  maxEmailsPerDay      Int      @default(200)
  maxCrmPushPerDay     Int      @default(100)
  hotScoreMin          Int      @default(70)
  warmScoreMin         Int      @default(40)
  crmAutoSend          Boolean  @default(false)
  crmProvider          String?  // "rdstation"|"hubspot"|"agendor"|"all"
  crmOwnerUserId       String?
  emailAutoSend        Boolean  @default(true)
  defaultSequenceId    String?
  whatsappEnabled      Boolean  @default(false)   // Fase futura
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}
```

#### SearchProfile — Perfis de busca (sistema + workspace)
```prisma
model SearchProfile {
  id            String    @id @default(cuid())
  workspaceId   String?   // null = perfil do sistema
  isSystem      Boolean   @default(false)
  isActive      Boolean   @default(true)
  name          String
  description   String?
  priority      Int       @default(0)
  cnae          String?   // "7020400" ou "7020%"
  cnaeList      Json?     // ["7020400","7311400"]
  uf            Json?     // ["SP","RJ","MG"]
  municipio     String?
  porte         Json?     // ["ME","EPP","DEMAIS"]
  hasEmail      Boolean?
  hasPhone      Boolean?
  minCapital    Float?
  openedAfter   String?   // "YYYYMMDD"
  lastRunAt     DateTime?
  nextRunAt     DateTime?
  totalFound    Int       @default(0)
  totalHot      Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  runs AutoProspeccaoRun[]
  leads ProspectedLead[]
}
```

#### ProspectedLead — Leads gerados automaticamente
```prisma
enum ProspectedLeadStatus {
  NEW ANALYZING SCORED COLD WARM HOT
  EMAILING CRM_SENT ENGAGED CONVERTED BOUNCED OPTED_OUT
}

model ProspectedLead {
  id                String               @id @default(cuid())
  workspaceId       String
  searchProfileId   String
  cnpj              String               @db.VarChar(14)
  razaoSocial       String
  nomeFantasia      String?
  email             String?
  ddd               String?
  telefone          String?
  cnaePrincipal     String?
  uf                String?
  municipio         String?
  porte             String?
  score             Int?
  status            ProspectedLeadStatus @default(NEW)
  aiAnalysisSummary String?              @db.Text
  aiScoreFactors    Json?
  crmProvider       String?
  crmId             String?
  crmPushedAt       DateTime?
  emailSequenceId   String?
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  workspace     Workspace      @relation(...)
  searchProfile SearchProfile  @relation(...)
  emailEvents   ProspectedLeadEmailEvent[]

  @@unique([workspaceId, cnpj])
  @@index([workspaceId, status])
  @@index([workspaceId, score])
  @@index([searchProfileId])
}
```

#### ProspectedLeadEmailEvent — Tracking de emails por step
```prisma
model ProspectedLeadEmailEvent {
  id        String    @id @default(cuid())
  leadId    String
  step      Int
  subject   String
  templateId String?
  sentAt    DateTime?
  openedAt  DateTime?
  clickedAt DateTime?
  bouncedAt DateTime?

  lead ProspectedLead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([leadId])
}
```

#### AutoProspeccaoTemplate — Templates específicos do módulo
```prisma
enum AutoProspTemplateType {
  HOT_COLD_INTRO HOT_FOLLOW_NO_OPEN HOT_FOLLOW_OPENED
  HOT_LAST_ATTEMPT WARM_WEEK1_EDUCATION WARM_WEEK2_VALUE
  WARM_WEEK3_SOCIAL WARM_WEEK4_OFFER CUSTOM
}

model AutoProspeccaoTemplate {
  id              String                @id @default(cuid())
  name            String
  type            AutoProspTemplateType
  subject         String
  preheader       String?
  bodyHtml        String                @db.Text
  bodyText        String?               @db.Text
  variables       Json?
  targetCnae      String?
  targetSegment   String?
  isSystem        Boolean               @default(false)
  workspaceId     String?
  createdBy       String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  @@index([type])
  @@index([isSystem])
  @@index([workspaceId])
}
```

#### AutoProspeccaoRun — Histórico de execuções
```prisma
enum AutoProspRunStatus { RUNNING COMPLETED FAILED CANCELLED }

model AutoProspeccaoRun {
  id              String            @id @default(cuid())
  workspaceId     String
  searchProfileId String?
  triggeredBy     String            // "cron"|"manual"|userId
  status          AutoProspRunStatus @default(RUNNING)
  leadsFound      Int               @default(0)
  leadsAnalyzed   Int               @default(0)
  leadsHot        Int               @default(0)
  leadsWarm       Int               @default(0)
  leadsCold       Int               @default(0)
  leadsDedupSkip  Int               @default(0)
  crmPushed       Int               @default(0)
  emailsQueued    Int               @default(0)
  errorLog        String?           @db.Text
  startedAt       DateTime          @default(now())
  completedAt     DateTime?

  workspace     Workspace      @relation(...)
  searchProfile SearchProfile? @relation(...)

  @@index([workspaceId, startedAt])
}
```

---

### Estrutura de Pastas Backend

```
backend/src/modules/auto-prospeccao/
├── domain/
│   └── types.ts              ← interfaces, enums, schemas Zod, contratos
├── application/
│   ├── config.service.ts     ← CRUD de configuração
│   ├── profile.service.ts    ← CRUD de perfis de busca
│   ├── template.service.ts   ← CRUD de templates
│   ├── score.service.ts      ← calculatePropensityScore()
│   ├── search.worker.ts      ← busca RF → cria ProspectedLead
│   ├── analyze.worker.ts     ← IA → score → classifica
│   ├── email-sequence.worker.ts ← dispara steps de email
│   ├── crm-push.worker.ts    ← push multi-CRM
│   └── auto-prospeccao.service.ts ← orquestrador + stats
├── __tests__/
│   ├── score.service.test.ts
│   ├── search.worker.test.ts
│   ├── analyze.worker.test.ts
│   ├── email-sequence.worker.test.ts
│   └── crm-push.worker.test.ts
└── index.ts
```

---

### API Endpoints (22 rotas)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/auto-prospeccao/config` | Lê config da workspace | workspace |
| PUT | `/api/auto-prospeccao/config` | Salva config | owner only |
| GET | `/api/auto-prospeccao/stats` | Cards do dashboard | workspace |
| POST | `/api/auto-prospeccao/trigger` | Execução manual | owner only |
| GET | `/api/auto-prospeccao/runs` | Lista execuções | workspace |
| GET | `/api/auto-prospeccao/runs/[id]` | Detalhe de execução | workspace |
| GET | `/api/auto-prospeccao/profiles` | Lista perfis | workspace |
| POST | `/api/auto-prospeccao/profiles` | Cria perfil | owner only |
| PUT | `/api/auto-prospeccao/profiles/[id]` | Edita perfil | owner only |
| DELETE | `/api/auto-prospeccao/profiles/[id]` | Remove perfil | owner only |
| POST | `/api/auto-prospeccao/profiles/[id]/toggle` | Ativa/desativa | owner only |
| GET | `/api/auto-prospeccao/leads` | Lista leads gerados | workspace |
| GET | `/api/auto-prospeccao/leads/[id]` | Detalhe lead | workspace |
| POST | `/api/auto-prospeccao/leads/[id]/push-crm` | Push manual ao CRM | workspace |
| POST | `/api/auto-prospeccao/leads/[id]/discard` | Descarta lead | workspace |
| GET | `/api/auto-prospeccao/templates` | Lista templates | workspace |
| POST | `/api/auto-prospeccao/templates` | Cria template | owner only |
| PUT | `/api/auto-prospeccao/templates/[id]` | Edita template | owner only |
| DELETE | `/api/auto-prospeccao/templates/[id]` | Remove template | owner only |
| GET | `/api/admin/auto-prospeccao/workspaces` | Gestão de acesso | admin sistema |
| POST | `/api/admin/auto-prospeccao/workspaces/[id]/toggle` | Liga/desliga workspace | admin sistema |
| POST | `/api/auto-prospeccao/team/[memberId]/toggle` | Liga/desliga membro | owner only |
| POST | `/api/cron/auto-prospeccao/search` | Worker de busca RF | CRON_SECRET |
| POST | `/api/cron/auto-prospeccao/analyze` | Worker de análise IA | CRON_SECRET |
| POST | `/api/cron/auto-prospeccao/email-sequence` | Worker de email | CRON_SECRET |
| POST | `/api/cron/auto-prospeccao/crm-push` | Worker de CRM | CRON_SECRET |

---

### Workers — Lógica Detalhada

#### search.worker
1. Busca workspaces com `autoProspeccaoEnabled=true` e `config.isActive=true`
2. Para cada workspace, filtra SearchProfiles ativos com `nextRunAt <= now()`
3. Query em `RfCompany` com filtros do perfil (cnae, uf, porte, hasEmail, hasPhone)
4. Para cada resultado: verifica se já existe `ProspectedLead` com mesmo `(workspaceId, cnpj)` → skip duplicado
5. Cria `ProspectedLead[]` com status `NEW` em batch (createMany, skipDuplicates)
6. Atualiza `SearchProfile.lastRunAt`, `totalFound`, `nextRunAt`
7. Cria `AutoProspeccaoRun` com métricas

#### analyze.worker
1. Busca `ProspectedLead` com `status=NEW` mais antigos que `config.analyzeDelayMinutes`
2. Para cada lead: chama módulo analyze existente (reutiliza `AiProviderConfig`)
3. Aplica `calculatePropensityScore()` combinando dados RF + resultado IA
4. Classifica: `COLD` (< warmScoreMin), `WARM`, `HOT`
5. `COLD` → status `COLD` (não avança), outros → `WARM` ou `HOT`
6. Atualiza `AutoProspeccaoRun` com counters

#### crm-push.worker
1. Busca `ProspectedLead` com `status=HOT` onde `crmPushedAt=null`
2. Lê `config.crmAutoSend`, `config.crmProvider`
3. Busca token do usuário owner: `rdStationToken`, `hubspotToken`, `agendorApiTokenEncrypted`
4. Chama lógica de push correspondente (reutiliza `/api/integrations/{provider}/send`)
5. Atualiza `ProspectedLead.crmPushedAt`, `crmId`, `crmProvider`, status `CRM_SENT`
6. Respeita `config.maxCrmPushPerDay`

#### email-sequence.worker
1. Busca `ProspectedLead` com `status IN [HOT, WARM, EMAILING]` e `emailAutoSend=true`
2. Para cada lead: verifica `ProspectedLeadEmailEvent` para saber qual step vem depois
3. Aplica lógica condicional: HOT D+0 intro → se não abriu D+3 follow → se abriu D+3 social proof → D+7 última tentativa
4. WARM: S1 educativo → S2 valor → S3 social proof → S4 oferta
5. Verifica `EmailUnsubscribe` (LGPD) antes de cada envio
6. Usa `sendEmail()` existente via Resend/SMTP
7. Registra `ProspectedLeadEmailEvent` por step enviado
8. Respeita `config.maxEmailsPerDay`

---

### Função de Score (calculatePropensityScore)

```typescript
// Inputs: RfCompany data + optional AI analysis result
// Output: 0-100 integer

Pesos:
+20  porte === "DEMAIS" (grande)
+12  porte === "EPP"
+5   porte === "ME"
+15  CNAE em segmento de alto valor (7020*, 7311*, 6201*, 6202*, 6821*, 6920*, 6622*)
+15  tem email E telefone
+7   tem apenas email (sem telefone)
+10  tem site (digitalPresence detectada na análise IA)
+10  capitalSocial > 500000
+10  análise IA gerou score > 70
+5   dataAbertura < 5 anos (empresa jovem)
+5   uf IN ["SP","RJ","MG","DF"]
-10  sem email
-10  CNAE em segmento de baixa relevância (restantes, varejo simples)
```

---

### Páginas Frontend

| Rota | Componente | Acesso |
|------|------------|--------|
| `/dashboard/auto-prospeccao` | `AutoProspeccaoPage` | owner + membro autorizado |
| `/dashboard/auto-prospeccao/configuracao` | `AutoProspeccaoConfigPage` | owner only |
| `/dashboard/auto-prospeccao/perfis` | `AutoProspeccaoPerfisPage` | owner + membro |
| `/dashboard/auto-prospeccao/templates` | `AutoProspeccaoTemplatesPage` | owner only |
| `/dashboard/auto-prospeccao/leads` | `AutoProspeccaoLeadsPage` | owner + membro |
| `/dashboard/auto-prospeccao/historico` | `AutoProspeccaoHistoricoPage` | owner + membro |

**Sidebar:** entrada "Auto-Prospecção" (ícone `<Bot />`) visível apenas quando módulo habilitado para a workspace do usuário.

---

### Templates de Conversão (9 de sistema)

| Tipo | Assunto | Segmento |
|------|---------|---------|
| HOT_COLD_INTRO | "Como `{{segmento}}` estão encontrando 3× mais clientes com IA" | Genérico |
| HOT_FOLLOW_NO_OPEN | "Vi que não conseguiu ver — é só 2 minutos" | Genérico |
| HOT_FOLLOW_OPENED | "A `{{empresa_similar}}` dobrou a prospecção em 30 dias — veja como" | Genérico |
| HOT_LAST_ATTEMPT | "Última tentativa: acesso grátis por 14 dias, sem cartão" | Genérico |
| WARM_WEEK1_EDUCATION | "5 erros de prospecção B2B que custam caro (e como evitar)" | Genérico |
| WARM_WEEK2_VALUE | "A IA já encontra oportunidades que o vendedor nunca veria" | Genérico |
| WARM_WEEK3_SOCIAL | "+200% de leads qualificados em 30 dias: case real" | Genérico |
| WARM_WEEK4_OFFER | "Teste grátis por 14 dias — sua prospecção piloto começa hoje" | Genérico |
| HOT_COLD_INTRO | "Como `{{segmento}}` usam IA pra fechar contratos antes da concorrência" | Consultorias |

---

### Perfis de Sistema (10 pré-definidos)

| Nome | CNAE principal | UFs | Porte | Tem email |
|------|---------------|-----|-------|-----------|
| Consultorias de vendas | 7020-4* | SP,RJ,MG,RS,PR | ME,EPP,DEMAIS | Sim |
| Agências de marketing digital | 7311-4*, 7319-0 | SP,RJ,MG,SC,RS | ME,EPP | Sim |
| Software houses e SaaS | 6201-5, 6202-3 | SP,MG,RS,SC,PR | ME,EPP | Sim |
| Imobiliárias (médias+) | 6821-8 | SP,RJ,MG,GO,DF | EPP,DEMAIS | Sim |
| Escritórios de contabilidade | 6920-6 | SP,MG,PR,RS,SC | ME,EPP,DEMAIS | Sim |
| Corretoras de seguros | 6622-3 | SP,RJ,MG,PR,RS | ME,EPP | Sim |
| Distribuidoras B2B | 46** | SP,MG,RS,PR,SC | EPP,DEMAIS | Sim |
| Clínicas e planos de saúde | 86** | SP,MG,RJ,BA,PR | EPP,DEMAIS | Sim |
| Startups B2B tecnologia | 6201-5, 6202-3 | SP,MG,RS,SC,DF | ME,EPP | Sim |
| Franquias e redes | 70* | SP,RJ,MG,PR,RS,SC | DEMAIS | Sim |

---

### Segurança e LGPD

- Toda ação automática é auditada (cria `AuditLog`)
- Opt-out respeita `EmailUnsubscribe` existente
- Link de unsubscribe incluído em todos os emails do módulo
- Pause automática se bounce_rate > 5% em 24h
- Blacklist de CNPJ: lista `blockedCnpjs` em `AutoProspeccaoConfig`
- Limite diário de envio por domínio configurável

---

### Fases de Implementação

| Fase | Escopo | Status |
|------|--------|--------|
| 1 — Base | Prisma models, guards de acesso, config API, sidebar, dashboard shell | ✅ Concluído |
| 2 — Workers | search.worker + analyze.worker + crons de busca e análise, página de leads | ✅ Concluído |
| 3 — CRM + Email | crm-push.worker + email-sequence.worker, templates, configuração completa | ✅ Concluído |
| 4 — Admin toggle | Painel admin com toggle Auto-Prospecção por workspace (WorkspaceDetailPage) | ✅ Concluído |
| 5 — Polimento | Conta interna PrecisionIA, dry-run, notificações em tempo real | Pendente |

### Pendente (Fase 5)
- [ ] Conta interna `prospeccao@precisionia.com.br` com `isInternal: true` e créditos ilimitados
- [ ] Perfis de sistema pré-configurados (10 perfis) e templates (9) via seed
- [ ] Dry-run mode (simular execução sem criar leads reais)
- [ ] Notificações em tempo real para acompanhar runs ao vivo

---

---

## Pipeline de Automação (5 Etapas)

### Etapa 1 — Auto-Busca (Cron diário/semanal)

- Salvar "perfis de busca" com filtros pré-definidos (região, CNAE, porte, etc.)
- Cron job no backend executa cada perfil automaticamente
- Novas empresas encontradas entram com `status: NEW`
- Deduplicação automática — se já existe no banco, pula

**Perfis sugeridos:**

| Perfil | Filtros |
|--------|---------|
| Consultorias de vendas | CNAE 70.20-4, porte médio+, com site |
| Agências de marketing | CNAE 73.11-4 / 73.19-0, com site e telefone |
| Imobiliárias | CNAE 68.21-8, porte médio+, capitais |
| Software houses / SaaS | CNAE 62.01-5 / 62.02-3, com site |
| Escritórios de contabilidade | CNAE 69.20-6, porte médio+, capitais |
| Corretoras de seguros | CNAE 66.22-3, com site e telefone |
| Distribuidoras | CNAE 46.x, porte médio+, com site |
| Franquias | Empresas com múltiplas filiais, porte grande |
| Startups B2B | CNAE 62/63, fundação < 5 anos, com site |
| Indústrias com equipe comercial | CNAE 10-33, porte grande, com site |

**Regiões prioritárias:** SP, RJ, MG, PR, SC, RS, DF, BA, GO

**Trabalho necessário:**
- Modelo `SearchProfile` no Prisma (nome, filtros JSON, frequência, userId)
- Endpoint CRUD para perfis de busca
- Cron job (`node-cron` ou Vercel Cron) que executa cada perfil

---

### Etapa 2 — Análise IA Automática + Score

- Para cada empresa nova da auto-busca, executa análise IA (já existe)
- Gera **score de propensão** (0-100) baseado em:
  - Porte da empresa (maior = mais chances de ter equipe comercial)
  - Setor de atuação (vendas B2B, serviços, consultorias = mais relevantes)
  - Presença digital (tem site, redes sociais = mais tech-savvy)
  - Crescimento (filiais abertas recentemente, contratações)
  - Quantidade de sócios/funcionários

**Classificação:**

| Faixa | Score | Ação |
|-------|-------|------|
| 🔥 Quente | 70-100 | Avança para CRM + email imediato |
| 🟡 Morno | 40-69 | Cria contato no CRM + entra em nurturing |
| ❄️ Frio | 0-39 | Descarta (não avança no pipeline) |

**Trabalho necessário:**
- Função `calculatePropensityScore(companyData, aiAnalysis)` → número 0-100
- Executar análise IA em batch após busca automática
- Salvar score no registro da empresa/lead

---

### Etapa 3 — Enriquecimento Automático

- Buscar dados complementares para leads quentes e mornos:
  - Email do decisor (sócio/diretor comercial)
  - Perfil LinkedIn
  - Telefone direto
- Validar emails (MX check)
- Associar CNAE → segmento → template de abordagem adequado

**Mapeamento CNAE → Template:**

| Segmento | Template de email |
|----------|-------------------|
| Consultorias | Foco em escalar prospecção dos clientes deles |
| Agências | Oferecer como ferramenta white-label para clientes |
| Imobiliárias | Foco em encontrar compradores/investidores |
| SaaS/Tech | Foco em gerar leads outbound qualificados |
| Contabilidade | Foco em captar novos clientes empresariais |
| Indústria | Foco em mapear distribuidores/revendedores |

**Trabalho necessário:**
- Integração com API de enriquecimento (ou scraping básico)
- Validação de email (verificação MX)
- Mapeamento CNAE → segmento → template

---

### Etapa 4 — Push Automático para CRM (Agendor)

- **Leads quentes (70+):** Cria deal automaticamente no Agendor com dados enriquecidos
- **Leads mornos (40-69):** Cria contato sem deal (nurturing)
- Mapeia campos: empresa, contato, telefone, email, notas com análise IA
- Cria atividade/tarefa no CRM: "Ligar para lead qualificado"
- Tag automática: `auto-prospeccao`, score, segmento

**Fluxo Agendor:**

```
Lead Quente → Organização + Pessoa + Deal + Tarefa "Ligar"
Lead Morno  → Organização + Pessoa + Nota "Nurturing automático"
```

**Trabalho necessário:**
- Expandir integração Agendor existente para criar deals automáticos
- Criar função de mapeamento de campos
- Configurar pipeline específico no Agendor ("Auto-Prospecção PrecisionAI")

---

### Etapa 5 — Sequência de Emails Automática

**Lead Quente (score 70+):**

| Dia | Ação | Template |
|-----|------|----------|
| D+0 | Email de apresentação | "Como [segmento] estão 3x mais produtivos com IA" |
| D+3 | Se não abriu → follow-up | "Vi que não conseguiu ver — resumo rápido" |
| D+3 | Se abriu sem clicar → caso de sucesso | "Como a [empresa similar] dobrou vendas em 60 dias" |
| D+0 | Se clicou → notifica no CRM | Tarefa: "Ligar AGORA — lead engajado" |
| D+7 | Se não respondeu → último follow-up | "Última tentativa — oferta especial" |

**Lead Morno (score 40-69):**

| Semana | Ação | Template |
|--------|------|----------|
| S1 | Email educativo | "5 erros na prospecção B2B que custam caro" |
| S2 | Email de valor | "Como a IA está mudando vendas B2B" |
| S3 | Email com prova social | "Case: +200% de leads em 30 dias" |
| S4 | Email com oferta | "Teste grátis por 14 dias — sem cartão" |

**Trabalho necessário:**
- Modelo `EmailSequence` (steps, delays, conditions)
- Worker/cron que processa sequências pendentes
- Tracking de aberturas e cliques (já existe via Resend webhooks)
- Lógica condicional: "se abriu", "se clicou", "se não abriu"

---

## Ordem de Implementação (Prioridade)

| # | Etapa | Esforço | Dependência |
|---|-------|---------|-------------|
| 1 | Conta interna + bypass créditos | Baixo | Nenhuma |
| 2 | Perfis de busca salvos | Médio | Etapa 1 |
| 3 | Cron de auto-busca | Médio | Etapa 2 |
| 4 | Score de propensão | Médio | Etapa 3 |
| 5 | Push automático Agendor | Médio | Etapa 4 |
| 6 | Sequência de emails | Alto | Etapa 4 |

---

## Componentes Existentes que Serão Reutilizados

| Componente | Localização | Status |
|------------|-------------|--------|
| Busca de empresas | `backend/src/modules/` | ✅ Pronto |
| Análise IA | `backend/src/modules/` | ✅ Pronto |
| Envio de email (Resend) | `backend/src/lib/email-templates.ts` | ✅ Pronto |
| Templates de email | `backend/src/lib/email-templates.ts` | ✅ Pronto |
| Integração Agendor | `backend/src/modules/` | ✅ Parcial |
| Pipeline/Leads | `frontend/src/pages/` | ✅ Pronto |
| Dashboard completo | `frontend/src/` | ✅ Pronto |
| Webhooks Resend | `backend/src/app/api/` | ✅ Pronto |

## Componentes Novos Necessários

| Componente | Descrição |
|------------|-----------|
| `isInternal` flag | Campo boolean no model User (Prisma) |
| `SearchProfile` model | Perfis de busca salvos com filtros e frequência |
| `calculatePropensityScore()` | Função de scoring baseada em dados + análise IA |
| `EmailSequence` model | Sequências de email com steps, delays, condições |
| Cron jobs | Auto-busca + processamento de sequências |
| CNAE→Segmento mapping | Mapeamento de CNAE para segmento e template |

---

## Métricas de Sucesso

- Leads gerados por semana (meta: 50+)
- Taxa de leads quentes (meta: 20%+)
- Taxa de abertura de emails (meta: 30%+)
- Taxa de clique (meta: 5%+)
- Deals criados no Agendor por semana
- Conversão lead → reunião agendada
- Conversão reunião → cliente

---

## Base de Dados Receita Federal (Infraestrutura)

### Fonte de Dados

- **URL:** `https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNPJ/`
- **Acesso:** WebDAV com token público (`gn672Ad4CF8N6TK`)
- **Frequência:** Publicação **mensal** (pastas YYYY-MM, de 2023-05 até hoje)
- **Padrão:** Nova pasta aparece entre o dia **5-10 do mês seguinte**
- **Conteúdo por mês:** CNAEs, Municípios, Empresas0-9, Estabelecimentos0-9, Sócios0-9, Simples, Naturezas, Qualificações, Países, Motivos

### Arquivos e Tamanhos

| Arquivo | Tamanho (zip) | Conteúdo |
|---------|---------------|----------|
| Cnaes.zip | 22 KB | 1.359 códigos de atividade econômica |
| Municipios.zip | 43 KB | 5.572 municípios (código RF → nome) |
| Empresas0-9.zip | ~75-486 MB cada | CNPJ base, razão social, porte, capital social |
| Estabelecimentos0-9.zip | ~320-1.9 GB cada | CNAE, endereço, telefone, email, situação, matriz/filial |
| **Total** | **~6.3 GB comprimido** | ~60M empresas (total), ~10M+ matrizes ativas |

### Filtros Aplicados na Importação

- Situação cadastral = **02 (Ativa)**
- Tipo = **1 (Matriz)** (ignora filiais)
- CNAE principal válido (não vazio, não 0000000)
- Resultado: ~10M+ empresas ativas com endereço, CNAE, telefone e email

### Modelos Prisma (já implementados)

```prisma
model CnaeCode {
  code        String @id          // "5611201"
  description String               // "Restaurantes e similares"
}

model RfCompany {
  cnpj           String  @id       // "12345678000199"
  razaoSocial    String
  nomeFantasia   String?
  cnaePrincipal  String             // FK para CnaeCode
  uf             String
  municipio      String?
  cep            String?
  bairro         String?
  logradouro     String?
  numero         String?
  ddd            String?
  telefone       String?
  email          String?
  dataAbertura   String?
  porte          String?            // "00"=N/I, "01"=MEI, "03"=ME, "05"=EPP, "09"=Demais
  capitalSocial  Float?
}
```

### Script de Importação

- **Localização:** `backend/scripts/import-rf-data.mjs`
- **Execução:** `DATABASE_URL=... node backend/scripts/import-rf-data.mjs`
- **Flags:** `--cnae-only`, `--skip-download`, `--batch=N`
- **Retry:** 3 tentativas por download, timeout 600s
- **Batch size:** Empresas=5000, Estabelecimentos=4000 (limite PG: 65535 params)
- **Resiliência:** Erro em 1 batch → pula pro próximo, INSERT ON CONFLICT DO NOTHING

---

## Painel Admin: Gestão de Dados RF (NOVO)

### Página `/rf-data` no Admin

**Seção 1 — Status da Base:**

| Card | Dado |
|------|------|
| Total Empresas RF | `SELECT count(*) FROM "RfCompany"` |
| Empresas com Email | `SELECT count(*) FROM "RfCompany" WHERE email IS NOT NULL AND email != ''` |
| Empresas com Telefone | `SELECT count(*) FROM "RfCompany" WHERE telefone IS NOT NULL` |
| Total CNAEs | `SELECT count(*) FROM "CnaeCode"` |
| Última Atualização | Data do último `RfImportJob` completo |
| Mês dos Dados | Ex: "2026-03" |

**Seção 2 — Import Manual:**
- Dropdown com meses disponíveis (auto-detecta via WebDAV PROPFIND)
- Botão "Importar Agora"
- Barra de progresso em tempo real (polling a cada 5s)
- Log de saída ao vivo

**Seção 3 — Import Agendado:**
- Toggle: ativado/desativado
- Dia do mês para verificar (padrão: dia 10)
- Horário (padrão: 03:00)
- Notificação por email ao concluir/falhar

**Seção 4 — Histórico de Imports:**

| Campo | Tipo |
|-------|------|
| Mês importado | "2026-03" |
| Tipo | MANUAL / CRON |
| Status | PENDING / RUNNING / COMPLETED / FAILED |
| Empresas importadas | 10.234.567 |
| Erros | 2 batches falharam |
| Duração | 3h 42min |
| Data | 2026-04-09 03:00 |

### Modelo Prisma Novo

```prisma
model RfImportJob {
  id                 String   @id @default(cuid())
  month              String                           // "2026-03"
  status             RfImportStatus @default(PENDING)
  triggeredBy        RfImportTrigger                  // MANUAL ou CRON
  companiesImported  Int      @default(0)
  cnaesImported      Int      @default(0)
  errorsCount        Int      @default(0)
  errorLog           String?  @db.Text
  progress           String?                          // JSON: {"step":"Estabelecimentos3","pct":45}
  startedAt          DateTime?
  completedAt        DateTime?
  createdAt          DateTime @default(now())
}

enum RfImportStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

---

## Execucao Tatica (apos Contact Intelligence)

Este plano inicia somente apos os gates definidos no plano de Contact Intelligence.

### Sprint 1 - Base interna e governanca

Objetivo:
- Habilitar operacao interna com controle e seguranca.

Entregaveis:
- Campo `isInternal` no `User` e regras de permissao.
- Plano `INTERNAL` com bypass controlado de creditos.
- Auditoria de execucao automatica (quem, quando, filtro, volume).

Criterio de aceite:
- Conta interna opera sem consumir creditos.
- Eventos ficam rastreaveis em log e auditoria.

KPI:
- 0 consumo indevido de credito em conta interna

### Sprint 2 - Perfis de busca e auto-busca

Objetivo:
- Executar prospeccao recorrente com deduplicacao.

Entregaveis:
- Modelo `SearchProfile` e CRUD.
- Cron de execucao por perfil (diario/semanal).
- Deduplicacao com idempotencia.

Criterio de aceite:
- Perfis executam em horario previsto e nao duplicam leads existentes.

KPI:
- >= 95% de execucoes de cron com sucesso
- taxa de duplicidade < 1%

### Sprint 3 - Score de propensao e priorizacao

Objetivo:
- Priorizar automaticamente o que vira acao comercial.

Entregaveis:
- `calculatePropensityScore()` com pesos por segmento.
- Classificacao Quente/Morno/Frio com thresholds configuraveis.
- Regras de descarte para baixo potencial.

Criterio de aceite:
- Leads gerados recebem score consistente e faixa operacional.

KPI:
- >= 90% dos novos leads auto-prospectados com score

### Sprint 4 - Push CRM (Agendor) e tarefas

Objetivo:
- Levar leads priorizados para acao no CRM sem friccao.

Entregaveis:
- Fluxo automatico para criar organizacao/pessoa/deal/tarefa.
- Tags operacionais (`auto-prospeccao`, score, segmento).
- Retry resiliente e controle de falha por lote.

Criterio de aceite:
- Leads quentes criam deal + tarefa automaticamente.
- Falha parcial nao interrompe lote inteiro.

KPI:
- >= 98% de sucesso no push CRM para leads elegiveis

### Sprint 5 - Sequencias de email e nurturing

Objetivo:
- Automatizar follow-up com regras condicionais.

Entregaveis:
- Modelo `EmailSequence` + worker de processamento.
- Regras condicionais (`abriu`, `clicou`, `nao abriu`).
- Limites diarios de envio e protecao de reputacao de dominio.

Criterio de aceite:
- Sequencias disparam corretamente por estado de engajamento.
- Protecoes de envio evitam picos e bloqueios.

KPI:
- abertura >= 30%
- clique >= 5%

### Sprint 6 - Operacao, compliance e escala

Objetivo:
- Escalar com previsibilidade, governanca e seguranca.

Entregaveis:
- Dashboard operacional (funil completo auto-prospeccao).
- Alertas de anomalia (queda de entrega, baixa resposta, falha de cron).
- Revisao de compliance (LGPD, opt-out, consentimento e retention).

Criterio de aceite:
- Operacao consegue monitorar ponta a ponta em tempo real.
- Playbook de incidente definido para falhas de automacao.

KPI:
- MTTR < 30 min para falhas criticas
- conversao lead -> reuniao com tendencia mensal positiva

## Dependencias obrigatorias

- Contact Intelligence estavel (gates aprovados)
- Observabilidade ativa com alertas
- Politica de envio e reputacao de dominio definida
- Templates e copy revisados por segmento

## Regras de seguranca operacional

- Limite de envio por dominio e por janela de tempo
- Pausa automatica de sequencia em caso de bounce elevado
- Blacklist e unsubscribe respeitados em 100% dos envios
- Controle de auditoria para toda acao automatica

enum RfImportTrigger {
  MANUAL
  CRON
}
```

### Endpoints API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/rf-data/stats` | Contagens (empresas, emails, telefones, CNAEs) |
| GET | `/api/admin/rf-data/months` | Meses disponíveis no WebDAV |
| POST | `/api/admin/rf-data/import` | Iniciar import (body: {month}) |
| GET | `/api/admin/rf-data/import/[id]` | Status/progresso de um import |
| GET | `/api/admin/rf-data/imports` | Histórico de imports |
| POST | `/api/admin/rf-data/schedule` | Configurar cron (body: {enabled, day, hour}) |

### Cron de Auto-Import Mensal

```
Dia 10 de cada mês, 03:00 →
  1. PROPFIND no WebDAV: lista meses disponíveis
  2. Compara com último mês importado (RfImportJob)
  3. Se novo mês existe → cria RfImportJob(CRON) e executa
  4. Se não → retenta dia 15 e dia 20
  5. Ao concluir → envia email admin com resumo
  6. Ao falhar → envia email admin com erro + log
```

---

## Exportação de Emails por Segmento (NOVO)

### Página `/rf-export` no Admin

**Propósito:** Extrair listas segmentadas da base RF para campanhas de marketing.

**Filtros disponíveis:**

| Filtro | Tipo | Exemplo |
|--------|------|---------|
| CNAE | Autocomplete (CnaeCode) | "5611-2 - Restaurantes" |
| UF | Multi-select | SP, RJ, MG |
| Município | Autocomplete | São Paulo, Curitiba |
| Porte | Multi-select | ME, EPP, Demais |
| Com email | Toggle | Sim/Não |
| Com telefone | Toggle | Sim/Não |
| Data abertura | Range | 2020-01 a 2026-03 |

**Preview:** Mostra os primeiros 50 resultados + total encontrado antes de exportar.

**Formatos de exportação:**
- CSV (compatível com Mailchimp, ActiveCampaign, RD Station)
- JSON
- Integração direta → EmailCampaign (já existe no sistema)

**Campos exportados:**
CNPJ, Razão Social, Nome Fantasia, CNAE (código + descrição), Email, DDD+Telefone, UF, Município, Bairro, CEP, Porte, Capital Social, Data Abertura

### Endpoint API

```
GET /api/admin/rf-export?cnae=5611201&uf=SP&porte=03&hasEmail=true&limit=10000&format=csv

Headers: Content-Disposition: attachment; filename="rf-export-5611201-SP-2026-04.csv"
```

### Exemplos de Uso

| Campanha | Filtros | Resultado Estimado |
|----------|---------|-------------------|
| Restaurantes SP com email | CNAE 5611*, UF=SP, hasEmail=true | ~50K empresas |
| Consultorias BR inteiras | CNAE 7020*, hasEmail=true | ~15K empresas |
| SaaS fundadas em 2024+ | CNAE 6201/6202, abertura>2024 | ~8K empresas |
| Indústrias grandes com tel | CNAE 10-33, porte=09, hasTel=true | ~20K empresas |

---

## IA Inteligente no Admin (NOVO)

### Fase 1: Tarefas IA Pré-definidas (Prioridade Alta)

Reutiliza a infraestrutura IA existente (Gemini/OpenAI/Cloudflare) com prompts especializados.

**Página `/ai-tasks` no Admin:**

| Tarefa | Input | Output | Custo |
|--------|-------|--------|-------|
| **Análise de Segmento** | CNAE + UF | "4.532 restaurantes ativos em SP. 12% têm email. Concorrência alta. Recomendo abordagem por..." | ~500 tokens |
| **Score de Mercado** | CNAE selecionado | "Consultorias de vendas (CNAE 70.20-4): 847 c/ email, porte médio+. Score 85/100 para prospecção." | ~800 tokens |
| **Gerador de Campanha** | Segmento + objetivo | Subject, body, CTA personalizados. Integra com EmailTemplate existente. | ~1K tokens |
| **Resumo do Sistema** | Automático (dados internos) | "Ontem: 12 buscas, 3 novos usuários, 45 análises. Segmento mais buscado: restaurantes." | ~300 tokens |
| **Sugestões de Prospecção** | Base RF + histórico de uso | "73% dos usuários buscam restaurantes/bares. Sugiro priorizar CNAE 5611-2 na auto-prospecção." | ~1K tokens |
| **Análise de Churn** | Dados de uso dos clientes | "Identificados 5 usuários inativos há 15+ dias. Sugestão: email de reengajamento para..." | ~800 tokens |

**Implementação:**
- Cada tarefa = um botão que chama `generateCompletion()` com prompt pré-definido
- Dados da base RF injetados como contexto no prompt (stats agregados, não dados brutos)
- Resultados salvos em `IntelligenceReport` (modelo já existe)
- Custo mínimo: ~500-1K tokens por tarefa (~R$0,01-0,05 com Gemini Flash)

### Fase 2: Chat IA Interativo (Prioridade Média)

**Página `/ai-chat` no Admin:**

**Biblioteca:** Vercel AI SDK (`ai` package) — suporta Gemini, OpenAI, Anthropic, streaming nativo, hooks React (`useChat()`).

**Arquitetura:**
```
Admin UI ←→ useChat() ←→ POST /api/admin/ai-chat ←→ AI Provider
                                   ↓
                          System Prompt com:
                          - Stats RF (count por UF, CNAE, porte)
                          - Stats de uso (buscas, análises, conversões)
                          - Dados do plano (churn, receita, crescimento)
                          - Histórico de campanhas email
```

**Exemplos de perguntas:**
- "Quantas empresas de tecnologia existem em Curitiba com email?"
- "Qual o melhor segmento pra prospectar esse mês?"
- "Gere um email de apresentação pra contadores"
- "Quantos usuários fizeram busca essa semana?"
- "Analise o desempenho da última campanha de email"

**Limites:** 50 mensagens/dia para controlar custo.

**Context window:** Stats agregados (~2K tokens de contexto), não dados brutos. Para consultas específicas, a IA chama functions/tools que fazem queries no banco.

**Trabalho necessário:**
- `npm install ai @ai-sdk/google @ai-sdk/openai` no backend
- Endpoint `/api/admin/ai-chat` com streaming
- Componente React `AiChat.tsx` com `useChat()`
- System prompt com stats injetados dinamicamente
- Tool calling para queries sob demanda (ex: "quantas empresas de CNAE X em UF Y")

### Fase 3: IA Proativa com Insights Automáticos (Prioridade Baixa)

**Cron semanal** que executa a IA para gerar insights sem ninguém pedir:

| Insight | Frequência | Destination |
|---------|------------|-------------|
| Resumo semanal do sistema | Toda segunda | Email admin + card no dashboard |
| Detecção de tendências | Semanal | Notificação in-app |
| Alertas de churn | Diário | Email + tarefa no CRM |
| Oportunidades de upsell | Semanal | Notificação + sugestão de campanha |
| Sugestão de novos segmentos | Mensal (após import RF) | Card no dashboard admin |

---

## Ordem de Implementação Revisada (Completa)

| # | Feature | Esforço | Impacto | Dependência |
|---|---------|---------|---------|-------------|
| **0** | **Finalizar import RF (Empresas + Estabelecimentos)** | ✅ Em andamento | Crítico | Nenhuma |
| **1** | Import RF Sócios + Simples Nacional | Médio | **Altíssimo** | #0 |
| **2** | Import IBGE Municípios (PIB + Pop + CEMPRE) | Baixo | Alto | Nenhuma |
| **3** | Painel Admin RF Data (stats + import manual + histórico) | Médio | Alto | #0 |
| **4** | Exportação emails por segmento (CSV/JSON) | Médio | **Altíssimo** | #0 |
| **5** | Cron mensal de auto-import RF | Baixo | Alto | #3 |
| **6** | Import IBGE Agro (PAM + PPM) | Baixo | Alto | #2 |
| **7** | Módulo Agro no Dashboard (filtros + cards enriquecidos) | Médio | Alto | #6 |
| **8** | Import CVM (Cias Abertas) | Baixo | Médio | Nenhuma |
| **9** | Conta interna (`isInternal`) + bypass créditos | Baixo | Alto | Nenhuma |
| **10** | IA Tarefas pré-definidas (6 tasks) | Médio | Alto | #0 |
| **11** | Perfis de busca (SearchProfile) + CRUD | Médio | Alto | #9 |
| **12** | Cron de auto-busca | Médio | Alto | #11 |
| **13** | Score de propensão | Médio | Alto | #12 |
| **14** | Push automático Agendor | Médio | Médio | #13 |
| **15** | Chat IA no admin (Vercel AI SDK) | Alto | Médio | #10 |
| **16** | Sequência de emails automática | Alto | Alto | #13 |
| **17** | Import CAFIR (Imóveis Rurais) | Médio | Médio | #6 |
| **18** | API Comercial autenticada (keys + rate limit + Swagger) | Alto | **Altíssimo** | #1 + #2 |
| **19** | IA Proativa (insights automáticos semanais) | Médio | Médio | #15 |

---

## Componentes Existentes que Serão Reutilizados

| Componente | Localização | Status |
|------------|-------------|--------|
| Busca de empresas | `backend/src/modules/search/` | ✅ Pronto |
| Análise IA (Gemini/OpenAI/Cloudflare) | `backend/src/modules/analyze/` + `backend/src/lib/ai/` | ✅ Pronto |
| Adaptadores IA multi-provider | `backend/src/lib/ai/adapters/` | ✅ Pronto (3 providers) |
| Envio de email (Resend + SMTP) | `backend/src/lib/email-templates.ts` | ✅ Pronto |
| Templates de email | `backend/src/lib/email-templates.ts` | ✅ Pronto |
| Campanhas de email marketing | `backend/src/app/api/admin/email-marketing/` | ✅ Pronto |
| Integração Agendor | `backend/src/modules/` | ✅ Parcial |
| Pipeline/Leads | `frontend/src/pages/` | ✅ Pronto |
| Dashboard completo | `frontend/src/` + `admin/src/` | ✅ Pronto (25+ páginas admin) |
| Webhooks Resend (tracking) | `backend/src/app/api/` | ✅ Pronto |
| Base RF (CnaeCode + RfCompany) | `backend/prisma/schema.prisma` | ✅ Pronto |
| Script import RF | `backend/scripts/import-rf-data.mjs` | ✅ Pronto (com retry) |
| CNAE Autocomplete | `frontend/src/components/dashboard/CnaeAutocomplete.tsx` | ✅ Pronto |
| Busca RF por CNAE | `backend/src/app/api/rf-search/route.ts` | ✅ Pronto |
| Usage tracking (tokens, API calls) | `backend/src/lib/usage.ts` | ✅ Pronto |
| Audit log | `backend/src/lib/audit.ts` | ✅ Pronto |
| Criptografia de API keys | `backend/src/lib/ai/encrypt.ts` | ✅ Pronto |

## Componentes Novos Necessários

| Componente | Descrição | Etapa |
|------------|-----------|-------|
| `isInternal: Boolean` | Flag no model User (Prisma) | #2 |
| `RfImportJob` model | Histórico e status de imports RF | #3 |
| Página admin `/rf-data` | Gestão visual da base RF | #3 |
| Página admin `/rf-export` | Exportação segmentada de emails | #4 |
| Endpoint `/api/admin/rf-export` | Export CSV/JSON com filtros | #4 |
| Cron RF mensal | Auto-detecta novo mês via WebDAV | #5 |
| Página admin `/ai-tasks` | 6 tarefas IA pré-definidas | #6 |
| `SearchProfile` model | Perfis de busca com filtros JSON e frequência | #7 |
| `calculatePropensityScore()` | Scoring 0-100 baseado em dados + IA | #9 |
| Página admin `/ai-chat` | Chat interativo com IA (Vercel AI SDK) | #11 |
| `EmailSequence` model | Sequências com steps, delays, condições | #12 |
| Worker de sequências | Cron que processa steps pendentes | #12 |
| `CNAE→Segmento` mapping | Mapeamento de CNAE para segmento e template | #9 |
| Insights IA proativos | Cron semanal com resumo + sugestões | #13 |

---

## API de Dados Unificada — PrecisionAI Data (NOVO)

### Visão

Consolidar TODOS os dados públicos brasileiros em um banco próprio, atualizado automaticamente, e oferecer:
1. **Internamente:** Enriquecimento de leads, análise de mercado, scores inteligentes
2. **Externamente:** API comercial para venda de consultas (SaaS B2B)

### Documento de Referência

**→ Ver [FONTES-DADOS-PUBLICOS.md](FONTES-DADOS-PUBLICOS.md) para catálogo completo de todas as fontes testadas e confirmadas.**

### Fontes Confirmadas (Testadas em Abril/2026)

| # | Fonte | Registros | API/Download | Status |
|---|-------|-----------|-------------|--------|
| 1 | RF CNPJ (Empresas + Estabelecimentos) | ~60M | WebDAV CSV | 🔄 Importando |
| 2 | RF Sócios | ~40M | WebDAV CSV | ⏳ Próximo |
| 3 | RF Simples Nacional + MEI | ~30M | WebDAV CSV | ⏳ Próximo |
| 4 | RF CAFIR (Imóveis Rurais) | ~7M | WebDAV CSV | ✅ Confirmado |
| 5 | IBGE PIB Municipal | 5.570 | SIDRA REST | ✅ Testado |
| 6 | IBGE População (Estimada + Censo 2022) | 5.570 | SIDRA REST | ✅ Testado |
| 7 | IBGE CEMPRE (Empresas + Emprego por município) | 5.570 | SIDRA REST | ✅ Testado |
| 8 | IBGE PAM (Produção Agrícola) | 5.570 | SIDRA REST | ✅ Testado |
| 9 | IBGE PPM (Pecuária) | 5.570 | SIDRA REST | ✅ Testado |
| 10 | CVM — Cias Abertas (S.A.) | 2.671 | CSV download | ✅ Testado |
| 11 | BCB — Instituições Financeiras | 1.500+ | OData REST | ✅ Testado |
| 12 | BrasilAPI (CNPJ, CEP, Bancos) | Real-time | REST | ✅ Testado |
| 13 | Portal Transparência (CNEP/CEIS) | ~20K | REST (API key) | ⏳ Cadastro |
| 14 | ANEEL — Geração de energia | ~50K | CKAN REST | ✅ Testado |
| 15 | CAGED/RAIS — Empregos formais | ~50M/ano | FTP CSV | ⏳ Download |

### Banco de Dados Unificado (`Municipality`)

Modelo central que agrega TODOS os indicadores por município:

```prisma
model Municipality {
  ibgeCode           String @id    // "5107925"
  nome               String        // "Sorriso"
  uf                 String        // "MT"
  pibMilReais        Float?        // 16.568.250 (IBGE t/5938)
  populacaoEstimada  Int?          // 263.708 (IBGE t/6579)
  populacaoCenso     Int?          // 244.911 (IBGE t/9514)
  empresasTotal      Int?          // 9.242 (IBGE CEMPRE)
  pessoalOcupado     Int?          // 74.606 (IBGE CEMPRE)
  salariosMilR       Float?        // 2.195.656 (IBGE CEMPRE)
  culturas           Json?         // PAM: [{cultura, areaHa, ton, valorMilR}]
  rebanhos           Json?         // PPM: [{tipo, cabecas}]
  updatedAt          DateTime @updatedAt
}
```

### Scripts de Importação

| Script | Fonte | Prioridade | Status |
|--------|-------|------------|--------|
| `import-rf-data.mjs` | RF CNPJ | Crítica | ✅ Rodando |
| `import-rf-socios.mjs` | RF Sócios | Alta | ⏳ Criar |
| `import-rf-simples.mjs` | RF Simples | Alta | ⏳ Criar |
| `import-ibge-municipios.mjs` | IBGE (PIB+Pop+CEMPRE) | Alta | ⏳ Criar |
| `import-ibge-agro.mjs` | IBGE PAM+PPM | Média | ⏳ Criar |
| `import-cvm.mjs` | CVM S.A. | Média | ⏳ Criar |
| `import-rf-cafir.mjs` | RF CAFIR | Baixa | ⏳ Criar |

### Armazenamento Estimado

| Dados | Registros | Tamanho |
|-------|-----------|---------|
| Empresas ativas + Estabelecimentos | ~10M | ~15 GB |
| Sócios (de ativas) | ~15-20M | ~20 GB |
| Simples Nacional | ~10M | ~5 GB |
| Municípios (completo) | 5.570 | ~5 MB |
| CAFIR | ~7M | ~10 GB |
| **Total** | | **~50 GB** |
| **Disco disponível** | | **~104 GB** |

### Crons de Atualização Automática

| Fonte | Frequência | Cron |
|-------|------------|------|
| RF CNPJ + Sócios + Simples | Mensal | `0 3 10 * *` |
| IBGE PIB | Anual (Jan) | `0 3 15 1 *` |
| IBGE Pop Estimada | Anual (Set) | `0 3 15 9 *` |
| IBGE CEMPRE | Anual (Nov) | `0 3 15 11 *` |
| IBGE PAM/PPM | Anual (Out) | `0 3 15 10 *` |
| CVM | Semanal (Seg) | `0 4 * * 1` |

---

## Módulo Agro — Inteligência Rural (NOVO)

### Visão Geral

Módulo dedicado ao agronegócio dentro do PrecisionAI, cruzando dados da Receita Federal (CNPJs agro) com bases públicas do IBGE (produção agrícola e pecuária) para gerar inteligência sobre produtores rurais por região, cultura e porte.

**Diferencial:** Nenhuma plataforma acessível faz esse cruzamento RF + IBGE de forma automatizada. As que fazem (Agridata, Brain Ag) cobram caro e vendem para grandes players. Nós podemos atender o **mercado médio** (revendas agrícolas, cooperativas, fintechs agro, seguradoras rurais).

**Modelo de negócio duplo:**
1. **Módulo no PrecisionAI** — filtros agro no dashboard, busca por cultura/região
2. **API independente** — venda de consultas para integradores (futura monetização)

### Fontes de Dados Confirmadas

| Fonte | API/URL | Dados | Status |
|-------|---------|-------|--------|
| **Receita Federal** | Base RF local (já temos) | CNPJs agro (CNAE 01-03), razão social, endereço, email, telefone, porte, capital social | ✅ Importando |
| **IBGE PAM** (Produção Agrícola Municipal) | `servicodados.ibge.gov.br/api/v3/agregados/5457` | Área colhida (ha), quantidade produzida (ton), valor (R$) **por cultura por município** | ✅ API REST pública testada |
| **IBGE PPM** (Pesquisa Pecuária Municipal) | `servicodados.ibge.gov.br/api/v3/agregados/3939` | Rebanho bovino, suíno, aves, caprino, ovino **por município** | ✅ API REST pública testada |
| **IBGE Censo Agropecuário** | `servicodados.ibge.gov.br/api/v3/agregados/` | Estabelecimentos rurais, pessoal ocupado, máquinas, irrigação | ✅ API REST pública |
| **CAR/SICAR** | `consultapublica.car.gov.br` | Polígonos de propriedades, área em hectares, CPF/CNPJ titular | ⏳ Fase 2 (download por estado, ~50GB) |
| **CONAB** | `conab.gov.br` | Preços safra, estimativas produção | ⏳ Fase 3 (PDFs/CSVs) |

### CNAEs Agro na Base RF

| Grupo | Descrição | Subclasses | Exemplos |
|-------|-----------|------------|----------|
| **01** | Agricultura, pecuária e serviços relacionados | 82 códigos | Cultivo de soja, milho, café, cana; criação de bovinos, suínos, aves |
| **02** | Produção florestal | 18 códigos | Silvicultura, extração de madeira |
| **03** | Pesca e aquicultura | 22 códigos | Pesca, criação de peixes, camarão |
| **Total** | | **122 CNAEs** | |

### Dados Testados (exemplo real: Sorriso/MT)

**Produção Agrícola (PAM 2023):**

| Cultura | Área Colhida |
|---------|-------------|
| Soja | 598.500 ha |
| Milho | 535.000 ha |
| Algodão | 60.413 ha |
| Feijão | 22.000 ha |
| Cana-de-açúcar | 1.800 ha |
| **Total** | **1.217.806 ha** |

**Rebanho (PPM 2023):**

| Tipo | Cabeças |
|------|---------|
| Bovino | 101.402 |
| Suíno | 206.601 |
| Galináceos | 4.231.349 |
| Ovino | 12.202 |
| Equino | 1.703 |

### Arquitetura do Módulo

```
┌─────────────────────────────────────────────────────┐
│                  MÓDULO AGRO                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Base RF (CNPJs agro)  ←── CNAE 01/02/03           │
│         +                                           │
│  IBGE PAM (produção agrícola por município)          │
│         +                                           │
│  IBGE PPM (rebanho por município)                    │
│         =                                           │
│  Perfil completo do município agro                   │
│    → Empresas agro na região                        │
│    → Culturas principais                            │
│    → Tamanho dos rebanhos                           │
│    → Contatos (email, telefone)                     │
│                                                     │
│  Fase 2: + CAR/SICAR (área em hectares por imóvel)  │
│  Fase 3: + Fuzzy match proprietário → CNPJ          │
│  Fase 3: + Score de produtor (pequeno/médio/grande)  │
└─────────────────────────────────────────────────────┘
```

### Implementação: 3 Fases

#### Fase 1 — MVP Agro (Prioridade Alta)

**O que faz:** Busca empresas agro da base RF enriquecidas com dados IBGE do município.

**Filtros na busca:**

| Filtro | Tipo | Exemplo |
|--------|------|---------|
| Cultura/Atividade | Autocomplete CNAE agro (122 códigos) | "Cultivo de soja", "Criação de bovinos" |
| Estado (UF) | Multi-select | MT, GO, MS, PR |
| Município | Autocomplete | Sorriso, Rio Verde, Dourados |
| Porte | Multi-select | MEI, ME, EPP, Demais |
| Com email | Toggle | Sim |
| Com telefone | Toggle | Sim |

**Card de resultado enriquecido:**

```
┌──────────────────────────────────────────────────┐
│ 🌱 Fazenda Boa Vista Agropecuária LTDA           │
│ CNPJ: 12.345.678/0001-99                         │
│ CNAE: 01.15-6 - Cultivo de soja                  │
│ 📍 Sorriso - MT                                  │
│ 📞 (66) 3544-1234 | ✉️ contato@boavista.agr.br  │
│ Porte: EPP | Capital: R$ 500.000                 │
│                                                   │
│ 📊 Perfil do Município (IBGE 2023):              │
│ • Soja: 598.500 ha | Milho: 535.000 ha           │
│ • Bovinos: 101.402 | Suínos: 206.601             │
│ • Área total colhida: 1.217.806 ha               │
└──────────────────────────────────────────────────┘
```

**Endpoints API:**

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/agro/search` | Busca empresas agro com filtros (CNAE, UF, município, porte) |
| GET | `/api/agro/municipio/[ibgeCode]` | Perfil agro do município (PAM + PPM) |
| GET | `/api/agro/stats` | Estatísticas gerais (total empresas agro por estado/CNAE) |
| GET | `/api/agro/culturas` | Lista culturas disponíveis (PAM) |
| GET | `/api/agro/export` | Exportação CSV/JSON com filtros |

**Modelos Prisma:**

```prisma
model AgroMunicipioProfile {
  ibgeCode       String   @id          // "5107925"
  nome           String                // "Sorriso"
  uf             String                // "MT"
  // PAM - Produção Agrícola
  areaTotalHa    Float?               // 1217806
  culturas       Json?                // [{cultura: "Soja", areaHa: 598500, producaoTon: ...}, ...]
  // PPM - Pecuária
  rebanho        Json?                // [{tipo: "Bovino", cabecas: 101402}, ...]
  // Metadados
  anoReferencia  Int                  // 2023
  updatedAt      DateTime @updatedAt
}
```

**Script de importação IBGE:**
- `backend/scripts/import-ibge-agro.mjs`
- Faz fetch PAM + PPM para todos os ~5.200 municípios
- Roda uma vez e depois via cron anual (IBGE publica dados do ano anterior)
- Batch de 100 municípios por request para não sobrecarregar API

**Frontend:**
- Nova seção no dashboard: "Módulo Agro" (ícone: 🌱 ou Sprout do Lucide)
- Filtros dedicados com autocomplete de culturas
- Cards com selo "🌱 Agro" + dados do município
- Mapa de calor por produção (opcional, usando dados IBGE por UF)

#### Fase 2 — Enriquecimento CAR/SICAR

**O que adiciona:** Área real da propriedade em hectares + classificação de porte rural.

**Dados do SICAR:**
- Download por estado (shapefiles + CSV)
- ~7 milhões de imóveis rurais cadastrados
- Campos: número CAR, CPF/CNPJ titular, área (ha), município, polígono

**Match com base RF:**
- JOIN por CNPJ (quando PJ tem CAR)
- JOIN por município + nome similar (fuzzy match com pg_trgm)

**Classificação de porte real:**

| Porte | Módulos Fiscais | Hectares (varia por município) |
|-------|-----------------|-------------------------------|
| Pequena propriedade | Até 4 MF | ~20-300 ha (depende região) |
| Média propriedade | 4-15 MF | ~300-1.500 ha |
| Grande propriedade | Acima 15 MF | 1.500+ ha |

**Requisitos técnicos:**
- PostGIS no PostgreSQL (extensão geoespacial)
- pg_trgm para fuzzy matching de nomes
- ~50GB de downloads SICAR (por estado)
- Parser de shapefiles (npm: `shapefile` ou `shpjs`)

#### Fase 3 — API Comercial + Score de Produtor

**Produto final:** API REST com autenticação, rate limiting, e documentação Swagger.

**Endpoints comerciais:**

```
GET /api/v1/agro/produtores?uf=MT&cultura=soja&hectares_min=300
GET /api/v1/agro/produtores?municipio=Sorriso&porte=grande
GET /api/v1/agro/municipio/5107925/perfil
GET /api/v1/agro/cnpj/12345678000199
GET /api/v1/agro/stats/uf/MT
```

**Score de produtor (0-100):**

| Fator | Peso | Critério |
|-------|------|----------|
| Área (hectares) | 30% | >1000ha=30, >300ha=20, >100ha=10 |
| Capital social | 20% | >R$1M=20, >R$200K=15, >R$50K=10 |
| Porte RF | 15% | Demais=15, EPP=10, ME=5 |
| Região produtiva | 15% | Top 100 municípios PAM=15, top 500=10 |
| Presença digital | 10% | Email+tel=10, só tel=5, sem contato=0 |
| Tempo de atividade | 10% | >10 anos=10, >5=7, >2=4 |

**Pricing API:**

| Plano | Consultas/mês | Preço |
|-------|---------------|-------|
| Free | 100 | R$0 |
| Starter | 2.000 | R$197/mês |
| Pro | 10.000 | R$497/mês |
| Business | 50.000 | R$997/mês |
| Enterprise | Ilimitado | Sob consulta |

**Público-alvo da API:**
- Revendas de insumos agrícolas (sementes, defensivos, fertilizantes)
- Cooperativas (prospecção de novos cooperados)
- Fintechs agro (crédito rural, seguro safra)
- Seguradoras rurais
- Empresas de máquinas agrícolas
- Consultorias agronômicas
- Marketplaces agro (compra/venda de grãos)

### Atenção LGPD

| Dado | Tipo | Risco | Mitigação |
|------|------|-------|-----------|
| CNPJ, razão social, endereço | Pessoa jurídica | ✅ Baixo | Dados públicos |
| Email, telefone da empresa | Pessoa jurídica | ✅ Baixo | Dados públicos RF |
| CPF de proprietário (CAR) | Pessoa física | ⚠️ Alto | **Anonimizar ou não usar** |
| Nome de sócio (RF Sócios) | Pessoa física | ⚠️ Médio | Usar só como match, não expor |

**Regra:** Usar apenas dados de **pessoa jurídica** (CNPJ). CPF é usado internamente para matching mas **nunca exposto** na API ou frontend.

### Ordem de Implementação do Módulo Agro

| # | Tarefa | Esforço | Dependência |
|---|--------|---------|-------------|
| A1 | Script import IBGE PAM/PPM (5.200 municípios) | Baixo | Base RF importada |
| A2 | Modelo `AgroMunicipioProfile` + migration | Baixo | A1 |
| A3 | Endpoint `/api/agro/search` (busca RF + filtros agro) | Médio | A2 |
| A4 | Endpoint `/api/agro/municipio/[code]` (perfil município) | Baixo | A2 |
| A5 | Endpoint `/api/agro/stats` + `/api/agro/culturas` | Baixo | A2 |
| A6 | Frontend: seção Agro no dashboard (filtros + cards) | Médio | A3 |
| A7 | Endpoint `/api/agro/export` (CSV/JSON) | Baixo | A3 |
| A8 | Admin: página gestão dados IBGE (stats + re-import) | Baixo | A2 |
| A9 | Import CAR/SICAR (PostGIS + download por estado) | Alto | A6 funcionando |
| A10 | Fuzzy match proprietário → CNPJ (pg_trgm) | Alto | A9 |
| A11 | Score de produtor | Médio | A9 ou A6 |
| A12 | API comercial autenticada (API keys + rate limit + Swagger) | Alto | A11 |
