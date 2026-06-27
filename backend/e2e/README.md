# E2E Playwright — Prospector AI

Testes end-to-end em `backend/e2e/*.spec.ts`. Config: `backend/playwright.config.ts`.

## Pré-requisitos

1. Stack saudável: `make up && make health`
2. Playwright instalado (via `npm install` na raiz ou em `backend/`)

## Rodar todos os E2E

```bash
make test-e2e
```

Equivalente manual:

```bash
curl -sf http://localhost:3010/api/health
cd backend && E2E_BASE_URL=http://localhost:5173 npx playwright test
```

## Rodar só o fluxo US

```bash
make up && make health
cd backend && E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/us-market.spec.ts
```

## Stack US (build com `VITE_MARKET=US`)

Para validar o frontend exatamente como produção US (sem depender do cookie `prospector-market`):

```bash
docker compose -f docker-compose.yml -f docker-compose.us.yml up -d --build
make health
cd backend && E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/us-market.spec.ts
```

## Variáveis úteis

| Variável | Default | Uso |
|----------|---------|-----|
| `E2E_BASE_URL` | `http://localhost:5173` | Frontend (proxy `/api`) ou backend direto (`http://localhost:3010`) |
| `BACKEND_HEALTH_URL` | `http://localhost:3010/api/health` | Usado por `docker/scripts/test-e2e.sh` |

## Specs

| Arquivo | Escopo |
|---------|--------|
| `us-market.spec.ts` | API US (headers/cookie) + smoke landing/signup/pricing EN + USD |
| `frontend-routes.spec.ts` | SPA fallback 200 em rotas públicas |
| `api-*.spec.ts` | Auth, health, export, verify-email |

### Fluxo US (`us-market.spec.ts`)

- **API:** registro/forgot-password/session com `X-Prospector-Market: US` e host `precisionai.innexar.app`
- **Frontend:** cookie `prospector-market=US` + páginas `/`, `/auth/signup`, `/en/pricing` com textos EN e preços USD
