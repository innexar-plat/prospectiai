# Arquitetura

## Objetivo
Código modular, escalável e fácil de manter, com baixo acoplamento.

## Padrão por módulo (backend)
`backend/src/modules/<module_name>/`
- **domain/**   — entidades e tipos puros (sem dependência de infra)
- **application/** — use-cases e serviços (orquestram libs/infra)
- **api/**      — no App Router: rotas em `app/api/` que só validam, autenticam e chamam application

Módulos existentes: **search** (domain + application), **analyze** (application). Rotas em `app/api/search` e `app/api/analyze` delegam a `runSearch` e `runAnalyze` respectivamente.

## Regras
- domain não depende de infra
- api (rotas) só chama application
- infra (prisma, redis, http clients) fica em `lib/` e é usada pela application
- Validação de request (Zod) sempre antes de entrar em regra de negócio

## Escalabilidade
- **Stateless app**: Next.js API routes sem sessão em memória; sessão via cookie/JWT. Múltiplas instâncias atrás de load balancer.
- **Multi-tenant**: Workspace como unidade de isolamento; créditos e limites por workspace.
- **Leitura**: Prisma permite apontar para réplicas de leitura (DATABASE_URL_READ) quando necessário; hoje uma única conexão.
- **Cache**: Redis para rate limit, cache de search e opcionalmente sessões; fallback gracioso se Redis indisponível.
- **Escala horizontal**: App e workers podem ser replicados; Redis e Postgres escalados conforme carga.

## Banco de dados (Prisma)
- **Migrations:** versionadas em `prisma/migrations/`; em produção o startup executa `prisma migrate deploy` (ex.: `docker/entrypoint.sh`) antes de subir a app.
- **Auditoria:** modelos de negócio (User, Workspace, WorkspaceMember, Lead, LeadAnalysis, SearchHistory) possuem `createdAt` e `updatedAt` para rastreabilidade; Prisma `@updatedAt` atualiza automaticamente em toda alteração.
- **Transações:** operações que alteram mais de uma entidade (ex.: register, search) usam `prisma.$transaction`.
- **Índices:** em chaves de filtro e ordenação (workspaceId, userId, leadId, createdAt) para performance.

## Observabilidade
- Logs por request (correlation id quando disponível)
- Erros padronizados (HTTP + body)
- Endpoint /health

## Mudança mínima
- Preferir adicionar código ao invés de reescrever sem necessidade
- Refatoração grande só com justificativa e em PR separado
