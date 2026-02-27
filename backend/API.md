# Prospector AI — Documentação das APIs (Backend)

Base URL (ex.): `https://api.exemplo.com` ou `http://localhost:4000`.  
Todas as rotas protegidas exigem sessão (cookie NextAuth), exceto as indicadas como públicas.

---

## Política de Versionamento

Todas as novas integrações externas ou SDKs devem consumir os endpoints com prefixo de versão (ex.: `/api/v1/search`, `/api/v1/analyze`).
Rotas em `/api/` sem versão especificada são de uso interno exclusivo do frontend (App Router) da própria aplicação, podendo sofrer alterações a cada deploy para parear com a UI.

**Ciclo de Vida (Depreciação de /vX/):**
1. **Sunset Header**: A rota retornará o header `Sunset` 6 meses antes da remoção definitiva.
2. **Docs**: O endpoint será sinalizado como "Deprecated" na documentação oficial.
3. **Remoção**: Retornará `410 Gone` após o fim do período de suporte.

---

## Convenções de resposta HTTP

| Status | Uso |
|--------|-----|
| 200 | Sucesso (body conforme contrato do endpoint). |
| 400 | Validação de body/query ou requisição inválida. |
| 401 | Não autenticado (sem sessão ou token inválido). |
| 403 | Autenticado mas não autorizado (onboarding, limite, admin). |
| 404 | Recurso não encontrado (ex.: workspace, lead). |
| 429 | Rate limit excedido. |
| 500 | Erro interno (mensagem genérica). |

**Corpo de erro:** sempre JSON com `{ "error": string }`. Quando aplicável, inclui `"code"` para o cliente tratar (ex.: `REQUIRES_ONBOARDING`, `LIMIT_EXCEEDED`). Todas as rotas seguem essa convenção.

**Paginação:** listas paginadas retornam `{ items, total, limit, offset }` (admin, search/history). Demais listas documentadas por endpoint.

**Rastreabilidade:** todas as respostas da API incluem o header `x-request-id` (valor enviado pelo cliente ou gerado pelo servidor). Use-o para correlacionar logs e suporte. O logger estruturado (JSON) inclui `requestId` quando disponível.

**Resiliência e fallbacks:**
- **Rate limit:** em caso de indisponibilidade do Redis, a requisição é permitida (fallback permissivo para não bloquear o uso).
- **Cache (search/details):** uso de Redis opcional; em falha de cache a busca segue via Google Places API e o resultado é retornado normalmente.
- **Erros 500:** todas as rotas críticas usam try/catch, registram o erro no logger (formato estruturado) e respondem com mensagem genérica ao cliente.

**Performance e cache (TTL Redis):**

| Uso | Chave / escopo | TTL / janela |
|-----|----------------|--------------|
| Search (leitura) | `search:<textQuery>:<type>:<pageSize>:...` | Leitura apenas; cache opcional. |
| Details | `details:<placeId>` | **900 s (15 min)** |
| Rate limit (login) | `ratelimit:login:<email>` | 900 s (15 min) |
| Rate limit (register) | `ratelimit:register:<ip>` | 3600 s (1 h) |
| Rate limit (forgot/reset/analyze/profile/checkout) | Por rota | Documentado em cada endpoint. |
| Rate limit (search) | `search:<ip>` | 30 req/min; 429 quando excedido. |

**Créditos:** Busca e análise consomem do workspace; checagem de limite antes de chamada externa; análise já em cache (DB) não desconta crédito. **Consultas ao banco:** selects enxutos e `include`/`select` explícitos para evitar over-fetch e N+1 em listagens.

---

## Índice

1. [Health](#1-health)
2. [Auth](#2-auth)
3. [User](#3-user)
4. [Onboarding](#4-onboarding)
5. [Search](#5-search)
6. [Analyze](#6-analyze)
7. [Leads](#7-leads)
8. [Details](#8-details)
9. [Billing](#9-billing)
10. [Team](#10-team)
11. [Product](#11-product)
12. [Sistema](#12-sistema)
13. [Admin (SaaS)](#13-admin-saas)
14. [Competitors (Análise de Concorrência)](#14-competitors-análise-de-concorrência)
15. [Market Report (Inteligência de Mercado)](#15-market-report-inteligência-de-mercado)

---

## Exemplos de request/response

### POST /api/search (sucesso)

**Request:**
```http
POST /api/search HTTP/1.1
Host: api.exemplo.com
Content-Type: application/json
Cookie: next-auth.session-token=...

{"textQuery": "cafés em São Paulo", "pageSize": 10}
```

**Response 200:**
```json
{
  "places": [
    {
      "id": "ChIJ...",
      "displayName": { "text": "Café Exemplo" },
      "formattedAddress": "Rua X, 123 - São Paulo",
      "nationalPhoneNumber": "+5511999999999",
      "websiteUri": "https://exemplo.com"
    }
  ],
  "nextPageToken": "CtQB..."
}
```
Header: `x-request-id: <uuid>` em todas as respostas.

---

### POST /api/analyze (sucesso)

**Request:**
```http
POST /api/analyze HTTP/1.1
Content-Type: application/json
Cookie: next-auth.session-token=...

{"placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4", "name": "Café Exemplo"}
```

**Response 200:**
```json
{
  "score": 8,
  "scoreLabel": "Quente",
  "summary": "Lead com bom potencial...",
  "strengths": ["Presença digital", "Avaliação alta"],
  "weaknesses": ["Poucos reviews"],
  "painPoints": [],
  "gaps": ["Falta CTA no site"],
  "approach": "Abordagem sugerida...",
  "contactStrategy": "Primeiro contato por e-mail...",
  "firstContactMessage": "Olá, ...",
  "suggestedWhatsAppMessage": "Olá! ...",
  "fullReport": null,
  "socialMedia": { "instagram": "https://...", "facebook": null, "linkedin": null }
}
```

---

### Erro de validação (400)

**Request:** `POST /api/search` com body `{}`.

**Response 400:**
```json
{
  "error": "body: textQuery is required"
}
```

---

### Erro de negócio (403)

**Response 403 (limite excedido):**
```json
{
  "error": "Limit reached",
  "code": "LIMIT_EXCEEDED",
  "limit": 100,
  "used": 100
}
```

---

## 1. Health

### GET /api/health

**Público.** Usado por load balancers e healthchecks.

**Resposta**

| Status | Body |
|--------|------|
| 200 | `{ "status": "ok" }` |

---

## 2. Auth

### POST /api/auth/register

**Público.** Cria usuário, workspace padrão e vínculo OWNER em uma transação. Usuário fica com `onboardingCompletedAt = null` até concluir o onboarding.

**Rate limit:** 5 requisições/hora por IP.

**Body (JSON)**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| email | string | Sim | Email único (será normalizado em trim + lowercase). |
| password | string | Sim | Mínimo 8 caracteres. |
| name | string | Não | Nome do usuário (trim). |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "message": "User created successfully", "id": "<userId>", "requiresOnboarding": true }` |
| 400 | `{ "error": "Missing fields: email and password are required" }` |
| 400 | `{ "error": "Password must be at least 8 characters" }` |
| 400 | `{ "error": "Email already in use" }` |
| 429 | `{ "error": "Too many requests. Try again later." }` |
| 500 | `{ "error": "Internal server error" }` |

---

### GET /api/auth/session

**Público.** Retorna a sessão atual (cookie). Se não houver sessão, retorna `user: null`.

**Resposta**

| Status | Body |
|--------|------|
| 200 | `{ "user": null }` ou `{ "user": { "id", "name", "email", "image", "plan", "leadsUsed", "leadsLimit" } }` |

---

### POST /api/auth/forgot-password

**Público.** Solicita reset de senha. Gera token e expiração. Se `RESEND_API_KEY` estiver configurado, envia e-mail com link de reset; caso contrário, em desenvolvimento a resposta pode incluir `devToken` para testes.

**Rate limit:** 3 requisições/hora por IP.

**Body (JSON)**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| email | string | Sim |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "message": "If that email exists, a reset link has been sent.", "devToken": "..." }` (devToken só em NODE_ENV=development) |
| 400 | `{ "error": "Email is required" }` |
| 429 | `{ "error": "Too many requests. Try again later." }` |

---

### POST /api/auth/reset-password

**Público.** Redefine a senha usando o token recebido por e-mail (ou devToken em dev).

**Rate limit:** 10 requisições/hora por IP.

**Body (JSON)**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| token | string | Sim |
| password | string | Sim (nova senha) |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "message": "Password updated successfully" }` |
| 400 | `{ "error": "Token and password are required" }` ou `{ "error": "Invalid or expired token" }` |
| 429 | `{ "error": "Too many requests. Try again later." }` |
| 500 | `{ "error": "Internal server error" }` |

---

### GET /api/auth/verify-email

**Público.** Confirma o e-mail do cadastro. Deve ser chamado com o token enviado por e-mail no registro.

**Query**

| Parâmetro | Tipo | Obrigatório |
|-----------|------|-------------|
| token | string | Sim |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "message": "Email verified successfully" }` |
| 400 | `{ "error": "Missing or invalid token" }` ou `{ "error": "Invalid or expired token" }` |
| 500 | `{ "error": "Internal server error" }` |

---

### POST /api/auth/2fa/enable

**Autenticado.** Gera segredo TOTP e grava no usuário; retorna `secret` e `otpauthUrl` para exibir QR. O usuário deve em seguida chamar **verify** com um código do app autenticador para ativar o 2FA.

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "secret": "<base32>", "otpauthUrl": "otpauth://totp/..." }` |
| 400 | `{ "error": "2FA is already enabled" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 404 | `{ "error": "User not found" }` |
| 500 | `{ "error": "Internal server error" }` |

---

### POST /api/auth/2fa/verify

**Autenticado.** Valida o código TOTP de 6 dígitos e define `twoFactorEnabled = true`.

**Body (JSON)**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| code | string | Sim (6 dígitos) |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "message": "2FA enabled successfully" }` |
| 400 | `{ "error": "..." }` (código inválido ou 2FA não configurado) |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Internal server error" }` |

---

### POST /api/auth/2fa/disable

**Autenticado.** Valida o código TOTP e desativa 2FA (remove segredo e flag).

**Body (JSON)** — mesmo que verify.

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "message": "2FA disabled successfully" }` |
| 400 | `{ "error": "Invalid code" }` ou `{ "error": "2FA is not enabled" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Internal server error" }` |

---

### NextAuth (login/social)

Login e callbacks são tratados por **NextAuth** em `/api/auth/[...nextauth]`. Não documentado aqui; ver configuração em `auth.ts`.

---

## 3. User

### GET /api/user/me

**Autenticado.** Retorna o usuário atual com dados do workspace ativo e flag de onboarding.

**Respostas**

| Status | Body |
|--------|------|
| 200 | Objeto usuário com: `id`, `name`, `email`, `plan`, `leadsUsed`, `leadsLimit`, `companyName`, `productService`, `targetAudience`, `mainBenefit`, **`requiresOnboarding`** (boolean). Se `true`, o front deve redirecionar para `/onboarding` e bloquear o dashboard. |
| 401 | `{ "error": "Unauthorized" }` |
| 404 | `{ "error": "User not found" }` |

---

### POST /api/user/profile

**Autenticado.** Atualiza perfil do usuário.

**Body (JSON)** — todos opcionais

| Campo | Tipo |
|-------|------|
| name | string |
| phone | string |
| companyName | string |
| productService | string |
| targetAudience | string |
| mainBenefit | string |

**Respostas**

| Status | Body |
|--------|------|
| 200 | Objeto User atualizado |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Internal Server Error" }` |

---

## 4. Onboarding

### POST /api/onboarding/complete

**Autenticado.** Conclui o onboarding: atualiza dados do negócio e define `onboardingCompletedAt`. Após isso o usuário pode acessar busca e análise (e dashboard).

**Body (JSON)** — todos opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| companyName | string | Nome da empresa |
| productService | string | Produto/serviço |
| targetAudience | string | Público-alvo |
| mainBenefit | string | Principal benefício |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "message": "Onboarding completed", "onboardingCompletedAt": "<ISO date>" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Internal server error" }` |

---

## 5. Search

### POST /api/search

**Autenticado.** Requer onboarding concluído (`requiresOnboarding === false`). Busca lugares (Google Places + cache + DB). Incrementa uso do workspace e grava histórico (SearchHistory) para reaproveitamento.

**Rate limit:** 30 requisições/minuto por IP. Resposta 429 quando excedido.

**Body (JSON)**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| textQuery | string | Sim | Texto da busca (ex.: "cafés em SP"). |
| includedType | string | Não | Tipo de estabelecimento (ex.: "restaurant"). |
| pageSize | number | Não | 1–100; default 20. |
| pageToken | string | Não | Paginação (Google). |
| hasWebsite | string | Não | `"yes"` \| `"no"` — filtrar por presença de site. |
| hasPhone | string | Não | `"yes"` \| `"no"` — filtrar por presença de telefone. |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "places": [...], "nextPageToken"?: string, "fromCache"?: true }` |
| 400 | `{ "error": "textQuery is required" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Complete onboarding before searching", "code": "REQUIRES_ONBOARDING" }` |
| 403 | `{ "error": "Limit reached", "code": "LIMIT_EXCEEDED", "limit", "used" }` |
| 404 | `{ "error": "Workspace not found" }` |
| 429 | `{ "error": "Too many requests" }` (rate limit por IP) |
| 500 | `{ "error": "<message>" }` |

---

### GET /api/search/history

**Autenticado.** Lista histórico de buscas do workspace do usuário (para reaproveitamento e auditoria).

**Query**

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| limit | number | 20 | Máximo 100. |
| offset | number | 0 | Offset para paginação. |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "items": [...], "total": number, "limit": number, "offset": number }`. Cada item: `id`, `textQuery`, `pageSize`, `filters`, `resultsCount`, `createdAt`, `user`: `{ name, email }`. |
| 401 | `{ "error": "Unauthorized" }` |
| 404 | `{ "error": "Workspace not found" }` |

---

## 6. Analyze

### POST /api/analyze

**Autenticado.** Requer onboarding concluído. Analisa um lead (IA). Se já existir análise em DB, retorna do cache (não consome crédito). Caso contrário, consome 1 crédito do workspace.

**Rate limit:** 15 requisições/minuto por IP.

**Body (JSON)**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| placeId | string | Sim | ID do lugar (Google). |
| name | string | Sim | Nome do negócio. |
| userProfile | object | Não | Perfil do usuário (sobrescreve dados do onboarding). |
| locale | string | Não | Default `"pt"`. |

**Respostas**

| Status | Body |
|--------|------|
| 200 | Objeto de análise: `score`, `scoreLabel`, `summary`, `strengths`, `weaknesses`, `painPoints`, `gaps`, `approach`, `contactStrategy`, `firstContactMessage`, `suggestedWhatsAppMessage`, `fullReport`, `socialMedia`, etc. |
| 400 | `{ "error": "Business name and placeId are required" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Complete onboarding before analyzing leads", "code": "REQUIRES_ONBOARDING" }` |
| 403 | `{ "error": "Limit reached", "code": "LIMIT_EXCEEDED", "details": "..." }` |
| 404 | `{ "error": "Workspace not found" }` |
| 429 | `{ "error": "Too many requests. Try again later." }` |
| 500 | `{ "error": "<message>" }` |

---

## 14. Competitors (Análise de Concorrência)

### POST /api/competitors

**Autenticado.** Requer plano com módulo ANALISE_CONCORRENCIA (PRO ou superior). Executa uma busca e devolve análise competitiva: ranking por avaliação, ranking por número de reviews, presença digital (com/sem site e telefone), oportunidades (quem não tem site ou telefone).

**Rate limit:** 15 requisições/minuto por IP.

**Body (JSON)** — mesmo contrato de POST /api/search para definir a amostra

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| textQuery | string | Sim | Ex.: "cafés em São Paulo". |
| includedType | string | Não | Tipo de estabelecimento. |
| pageSize | number | Não | 1–100; default 60. |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "totalCount", "rankingByRating", "rankingByReviews", "digitalPresence": { "withWebsite", "withoutWebsite", "withPhone", "withoutPhone" }, "opportunities": [{ "id", "name", "missingWebsite", "missingPhone" }] }` |
| 400 | `{ "error": "..." }` (validação) |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Competitor analysis is not available on your plan. Upgrade to PRO or higher." }` |
| 429 | `{ "error": "Too many requests. Try again later." }` |
| 500 | `{ "error": "Internal server error" }` |

---

## 15. Market Report (Inteligência de Mercado)

### POST /api/market-report

**Autenticado.** Requer plano com módulo INTELIGENCIA_MERCADO (BUSINESS ou superior). Executa uma busca e devolve relatório de mercado: total de negócios, segmentos por tipo (count e avgRating), maturidade digital (percentual com site/telefone), índice de saturação.

**Rate limit:** 15 requisições/minuto por IP.

**Body (JSON)**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| textQuery | string | Sim | Ex.: "restaurantes Praia Grande". |
| includedType | string | Não | Tipo de estabelecimento. |
| pageSize | number | Não | 1–60; default 60. |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "totalBusinesses", "segments": [{ "type", "count", "avgRating" }], "digitalMaturity": { "withWebsite", "withPhone", "total", "withWebsitePercent", "withPhonePercent" }, "saturationIndex" }` |
| 400 | `{ "error": "..." }` (validação) |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Market intelligence is not available on your plan. Upgrade to BUSINESS or higher." }` |
| 429 | `{ "error": "Too many requests. Try again later." }` |
| 500 | `{ "error": "Internal server error" }` |

---

## 7. Leads

### GET /api/leads

**Autenticado.** Lista análises de leads do workspace do usuário.

**Resposta**

| Status | Body |
|--------|------|
| 200 | Array de `LeadAnalysis` com `lead` incluído, ordenado por `createdAt` desc. |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Internal Server Error" }` |

---

### GET /api/export/leads

**Autenticado.** Exporta as análises de leads do workspace do usuário em JSON ou CSV.

**Query**

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| format | string | json | `json` ou `csv`. |

**Respostas**

| Status | Body / headers |
|--------|----------------|
| 200 | JSON: array de análises (mesma estrutura do GET /api/leads). CSV: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="leads-export.csv"`. |
| 400 | `{ "error": "..." }` (formato inválido) |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Internal server error" }` |

---

### PATCH /api/leads/[id]

**Autenticado.** Atualiza o status de uma análise (ex.: lead do usuário).

**Body (JSON)**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| status | string | Sim (valor permitido pelo schema) |

**Respostas**

| Status | Body |
|--------|------|
| 200 | Objeto LeadAnalysis atualizado |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Internal Server Error" }` |

---

## 8. Details

### GET /api/details?placeId=...

**Público.** Retorna detalhes de um lugar (Google Place Details). Usa cache e sincroniza lead no DB em background.

**Query**

| Parâmetro | Obrigatório |
|-----------|-------------|
| placeId | Sim |

**Respostas**

| Status | Body |
|--------|------|
| 200 | Objeto de detalhes do lugar; pode incluir `fromCache: true`. |
| 400 | `{ "error": "placeId is required" }` |
| 500 | `{ "error": "<message>" }` |

---

## 9. Billing

### POST /api/billing/checkout

**Autenticado.** Cria sessão de checkout (Stripe ou Mercado Pago conforme `locale`).

**Body (JSON)**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| planId | string | Sim | `BASIC` \| `PRO` \| `BUSINESS` (não FREE). |
| interval | string | Não | `"monthly"` \| `"annual"`. |
| locale | string | Não | `"pt"` → Mercado Pago (BRL); outro → Stripe (USD). |

**Respostas**

| Status | Body |
|--------|------|
| 200 | `{ "url": "<checkout_url>" }` (init_point MP ou url da sessão Stripe) |
| 400 | `{ "error": "Invalid plan" }` |
| 401 | `{ "error": "Unauthorized" }` |

---

### Webhooks

- **POST /api/billing/webhook** — Stripe (ex.: `payment_intent.succeeded`).
- **POST /api/billing/webhook/mercadopago** — Mercado Pago (notificações de pagamento).

Payload e assinaturas dependem de cada provedor; não documentados aqui.

---

### POST /api/billing/process-payment

**Autenticado.** Processa pagamento após retorno do checkout (atualiza plano/workspace). Uso interno/redirect.

---

## 10. Team

### GET /api/team/members

**Autenticado.** Lista membros do workspace ativo.

**Respostas**

| Status | Body |
|--------|------|
| 200 | Array de `WorkspaceMember` com `user`: `{ id, name, email }`. |
| 401 | `{ "error": "Unauthorized" }` |
| 404 | `{ "error": "Workspace not found" }` |
| 500 | `{ "error": "Internal Server Error" }` |

---

### POST /api/team/invite

**Autenticado.** Apenas OWNER ou ADMIN. Convida usuário por e-mail para o workspace.

**Body (JSON)**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| email | string | Sim (válido) |

**Respostas**

| Status | Body |
|--------|------|
| 200 | Objeto com resultado do convite |
| 400 | `{ "error": "Valid email is required" }` ou `{ "error": "User is already in this workspace" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Only owners or admins can invite members" }` |
| 404 | `{ "error": "Workspace not found" }` |

---

### POST /api/team/remove

**Autenticado.** Remove membro do workspace (body com identificador do membro). Apenas OWNER/ADMIN.

---

## 11. Product

### GET /api/product/modules

**Autenticado.** Retorna módulos disponíveis para o plano do workspace e catálogo completo (para exibir “bloqueado” no front).

**Resposta**

| Status | Body |
|--------|------|
| 200 | `{ "plan", "modules", "catalog", "tagline": "..." }` |
| 401 | `{ "error": "Unauthorized" }` |
| 404 | `{ "error": "User not found" }` |

---

## 12. Sistema

### POST /api/system/migrate-workspace

Uso interno: migração de dados para modelo workspace. Não documentado para uso externo.

---

## 13. Admin (SaaS)

Todas as rotas abaixo exigem **sessão autenticada** e que o e-mail do usuário esteja em **ADMIN_EMAILS** (variável de ambiente: lista de e-mails separados por vírgula). Caso contrário retornam **403 Forbidden**.

| Método | Path | Descrição |
|--------|------|-----------|
| GET | /api/admin/stats | Contagens: users, workspaces, searchHistory, leadAnalyses |
| GET | /api/admin/users | Lista usuários (paginação: limit, offset) |
| GET | /api/admin/users/[id] | Usuário por id com workspaces |
| GET | /api/admin/workspaces | Lista workspaces (paginação) |
| GET | /api/admin/workspaces/[id] | Workspace por id com members |
| GET | /api/admin/search-history | Histórico de buscas (query: limit, offset, workspaceId opcional) |
| GET | /api/admin/leads | Análises de leads (query: limit, offset, workspaceId opcional) |

**Respostas comuns:** 401 Unauthorized, 403 Forbidden, 500 Internal server error.

Documentação detalhada: ver `ADMIN.md` na raiz do backend.

---

## Códigos de erro comuns

| code | Significado |
|------|-------------|
| `REQUIRES_ONBOARDING` | Usuário deve concluir POST /api/onboarding/complete antes de buscar ou analisar. |
| `LIMIT_EXCEEDED` | Cota de leads do workspace atingida. |

---

## Validações (Zod)

Schemas centralizados em `src/lib/validations/schemas.ts` para uso opcional nas rotas:

- `registerSchema` — POST /api/auth/register  
- `onboardingCompleteSchema` — POST /api/onboarding/complete  
- `searchSchema` — POST /api/search  
- `analyzeSchema` — POST /api/analyze  

As rotas atualmente fazem validação manual; os schemas podem ser usados para padronizar mensagens e tipos.
