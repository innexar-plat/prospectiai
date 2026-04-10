# Plano de Auto-Prospecção Interna — PrecisionAI

## Objetivo

Usar a própria plataforma PrecisionAI para prospectar clientes automaticamente, vendendo a ferramenta para empresas que se beneficiariam dela.

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
