# Prospector AI

Monorepo do Prospector AI: frontend (Vite/React), backend (Next.js API), admin (Vite) e infraestrutura Docker.

## Estrutura

- **frontend/** — App React (Vite) na porta 5173; proxy de `/api` para o backend.
- **backend/** — API Next.js na porta 3010 (host) / 3000 (container); auth, billing, search, etc.
- **admin/** — Painel admin (Vite) na porta 5174.
- **docker/** — Scripts e configs para build/up/logs/health.
- **.ai/** — Regras do agente, arquitetura, procedimentos (ARCHITECTURE.md, PROCEDURE.md, STACK.md).

## Pré-requisitos

- Docker e Docker Compose
- Node 20+ (para desenvolvimento local fora do Docker)

## Comandos principais (Makefile)

| Comando | Descrição |
|---------|-----------|
| `make up` | Sobe a stack (frontend, backend, admin, db, redis). |
| `make down` | Para os containers. |
| `make build` | Build de todos os serviços. |
| `make health` | Verifica saúde do backend (aguardar ~30s após `make up`). |
| `make test` | Testes Jest do backend (via script no container). |
| `make check` | Roda `make test` e depois `make build`. |
| `make test-e2e` | Testes E2E Playwright (stack deve estar up). |
| `make logs` | Logs de todos os serviços; `make logs SERVICE=backend` para um só. |

## Desenvolvimento rápido

1. Subir ambiente: `make up`
2. Verificar saúde: `make health`
3. Frontend: http://localhost:5173 — Backend API: http://localhost:3010

Em ambiente local sem Traefik, criar a rede antes de `make up`:

```bash
docker network create fixelo_fixelo-network
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores. Principais: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, chaves Stripe/Mercado Pago para billing. Detalhes em [.ai/RUNBOOK.md](.ai/RUNBOOK.md) e em `.env.example`.

## Documentação interna

- [.ai/PROCEDURE.md](.ai/PROCEDURE.md) — Fluxo obrigatório para mudanças (build, test, up, health, evidências).
- [.ai/ARCHITECTURE.md](.ai/ARCHITECTURE.md) — Padrão domain/application/api e regras do backend.
- [.ai/STACK.md](.ai/STACK.md) — Serviços, portas e convenções de env.
- [.ai/RUNBOOK.md](.ai/RUNBOOK.md) — Subir ambiente, logs, problemas comuns e cron de billing.

## Deploy

Build das imagens e uso em produção seguem o mesmo `docker-compose` e Makefile. Garantir que variáveis de produção estejam configuradas e que o cron de apply-pending-plans (billing) esteja agendado quando usar Mercado Pago. Ver RUNBOOK para o endpoint e header necessários.
