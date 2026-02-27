# Prospector AI — Testes (Backend)

## Execução

```bash
cd backend
npm run test
npm run test -- --coverage
npm run test -- --testPathPatterns="api-register|api-search"
```

## Cobertura

- **Meta:** 80% em lines, statements, branches e functions (threshold global no Jest).
- **Threshold atual:** 80% em todas as métricas; build falha se ficar abaixo.
- Relatório: `npm run test -- --coverage`; opcional `--coverageReporters=html` para `coverage/lcov-report/index.html`.
- **Excluídos do coverage:** auth.ts, middleware.ts, redis, stripe, mercadopago, utils; rotas NextAuth, billing (process-payment, webhook, checkout), v1/*, system/migrate-workspace; libs gemini e google-places (integração externa).

## Estrutura dos testes

- **`src/__tests__/*.test.ts`**: testes por domínio (auth, api-register, api-search, api-analyze, api-admin, health, validations, admin-lib, leads-get, etc.).
- Mocks: `@/auth`, `@/lib/prisma`, `@/lib/admin`, `@/lib/ratelimit`, etc., conforme necessário.
- Variáveis de ambiente em testes: ex. `GEMINI_API_KEY`, `GOOGLE_PLACES_API_KEY` definidas nos testes que chamam libs reais (ou mocks evitam env).

## Módulos cobertos

| Área | Arquivo de teste | Observação |
|------|------------------|------------|
| Health | health.test.ts | GET /api/health |
| Auth/Register | api-register.test.ts | POST register, validações, transação |
| Auth (lógica) | auth.test.ts | Hash, tokens |
| Search | api-search.test.ts | 401, 403 onboarding, 403 limit, 200 |
| Analyze | api-analyze.test.ts | Cache DB, 400 validação, 403 LIMIT_EXCEEDED, 200 no-cache (Gemini) |
| Admin | api-admin.test.ts | stats 401/403/200, users 403/200 |
| Admin lib | admin-lib.test.ts | isAdmin() |
| Validações | validations.test.ts | registerSchema, searchSchema, formatZodError |
| Leads | leads-get.test.ts | GET /api/leads 401, 200 |
| Billing | billing.test.ts | PLANS |
| Gemini | gemini.test.ts | Mock SDK + env |
| Google Places | google-places.test.ts | Mock fetch + env |
| Rate limit | ratelimit.test.ts | Lógica de rate limit |
| Onboarding complete | onboarding-complete.test.ts | POST 401, 400, 200, 500 |
| User me | user-me.test.ts | GET 401, 404, 200 (with/without workspace) |
| Search history | search-history.test.ts | GET 401, 404, 200, limit/offset |
| Logger | logger.test.ts | info/warn/error JSON, getRequestId |
| User profile | user-profile.test.ts | POST 401, 200, 500 |
| Product modules | product-modules.test.ts | GET 401, 404, 200 (plan/catalog) |
| Auth session | auth-session.test.ts | GET 200 null/user, defaults |
| Team invite | team-invite.test.ts | POST 401, 400, 404, 403, 200 |
| Team members | team-members.test.ts | GET 401, 404, 200 |
| Admin workspaces [id] | admin-workspaces-id.test.ts | GET 401, 403, 404, 200 |
| Details | details.test.ts | GET 400, 200 cache/API, 500 |
| Forgot password | forgot-password.test.ts | POST 429, 400, 200 (user exists/not) |
| Reset password | reset-password.test.ts | POST 429, 400, 200 |
| Team remove | team-remove.test.ts | DELETE 401, 400, 404, 403, 200 |
| Admin search-history | admin-search-history.test.ts | GET 401, 403, 200 |
| Admin leads | admin-leads.test.ts | GET 401, 403, 200 |
| Billing checkout | billing-checkout.test.ts | POST 401, 400 (invalid plan) |
| Product-modules lib | product-modules-lib.test.ts | getModulesForPlan, planHasModule, fallback |
| Db-sync | db-sync.test.ts | syncLead upsert/success/error, syncLeads |

## Objetivo 80%

Para atingir 80% de cobertura mínima, priorizar:

1. Branches nas rotas já testadas (ex.: search com cache, com DB, com Google).
2. Lib redis quando usado em rotas (já mockado em details/search).
