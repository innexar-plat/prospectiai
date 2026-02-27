# Stack do Projeto

## Serviços (Prospector AI)
- app: Next.js 16 (monorepo backend) — porta 3010 (host) / 3000 (container)
- db: Postgres 16 (postgres:16-alpine) — porta 5433 (host) / 5432 (container)
- redis: opcional (REDIS_URL no .env)

## Padrões
- Tudo em Docker Compose
- Logs no stdout/stderr (12-factor)
- Config por env vars (.env local, não versionado)

## Versionamento
- Node: 20-alpine (Dockerfile)
- Banco: postgres:16-alpine (sem latest)

## Ports
- app: 3010 (host) → 3000 (container)
- db: 5433 (host) → 5432 (container)

## Convenções de env
- DATABASE_URL / DB_HOST/DB_USER/DB_PASS
- JWT_SECRET (somente env)
- LOG_LEVEL=info|debug
