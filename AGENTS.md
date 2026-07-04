# AGENTS.md — Precision (prospector-ai)

> High-signal facts for OpenCode agents working in this monorepo.
> Read before any edit, commit, or deploy.

## Monorepo (npm workspaces)

| Workspace | Dir | Stack | Build cmd | Test cmd |
|-----------|-----|-------|-----------|----------|
| Frontend | `frontend/` | Vite 7 + React 19 + Tailwind 4 | `npm run build` | `vitest run` |
| Admin | `admin/` | Vite 5 + React 19 + Tailwind 4 | `npm run build` | `vitest run` |
| Backend | `backend/` | Next.js 16 (API-only) + Prisma + Zod 4 | `npm run build` | `jest` |

Root `package.json` at `/srv/innexar/production/prospector-ai/package.json`.

## Git Remote Quirk

- Remote URL: `git@github.com-innexar:innexar-plat/prospectiai.git`
- SSH host `github.com-innexar` (aliased in `~/.ssh/config`) uses key `id_ed25519_dunnaa_app`
- DO NOT push to `github.com` — the default `id_ed25519` key won't authenticate.
- Current branch: `feat/sidebar-and-sonar-fixes` (off `main`)

## Build Pipeline

```
frontend: tsc -b && vite build --emptyOutDir && node scripts/generate-seo-html.mjs
admin:    tsc -b && vite build
backend:  next build (standalone output)
```

- Frontend build **generates static SEO HTML** via `frontend/scripts/generate-seo-html.mjs` — post-build step.
- SEO routes are listed in both `generate-seo-html.mjs` and `frontend/src/lib/sitemap-routes.ts` — **keep in sync**.
- Backend generates Prisma client at build time (`prisma generate`).

## Make Targets

| Target | What it does |
|--------|-------------|
| `make build` | `docker compose build` (all services) |
| `make up` | Brings stack up (needs `.env`) |
| `make down` | Tears stack down |
| `make test` | Starts DB in Docker, runs backend Jest + frontend Vitest + admin Vitest on host |
| `make check` | `make test` then `make build` |
| `make deploy` | Git pull → build → restart → health → Telegram alert |
| `make sonar` | `sonar-scanner` (requires `SONAR_TOKEN`) |
| `make health` | Checks all container health endpoints |
| `make logs SERVICE=<svc>` | Tail logs for a service |

## Docker Architecture (production)

```
Traefik (external) → frontend (Nginx :80) → backend (Next.js :4000) → PostgreSQL / Redis
                                               ↑ PgBouncer (planned)
```

- Frontend Nginx serves SPA at `/`, admin SPA at `/admin/`, proxies `/api/*` to backend
- Two domains: `precisionia.com.br` (BR) and `precisionai.innexar.app` (US)
- Redis password is hardcoded in `docker-compose.yml:223` — **do not copy/commit**
- Stack: frontend (128MB) + backend (512MB) + Redis (768MB) + PostgreSQL (4GB)
- Health check endpoints: frontend `GET /`, backend `GET /api/health`

## Critical Files

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Production stack (frontend, backend, redis, db, maintenance) |
| `frontend/nginx.conf` | SPA serving, SEO HTML, proxy, cache, security headers |
| `frontend/scripts/generate-seo-html.mjs` | Post-build SEO static HTML generator |
| `frontend/src/lib/i18n/bundles/{pt,en}.ts` | i18n strings (BR/US markets) |
| `frontend/src/lib/api.ts` | **1.7K lines** — all API clients and types (to be split) |
| `frontend/src/lib/sitemap-routes.ts` | SEO route definitions (keep synced with SEO script) |
| `frontend/src/components/layout/SeoMeta.tsx` | Reusable SEO meta tags component (OG, description, canonical) |
| `frontend/src/components/layout/BreadcrumbJsonLd.tsx` | Schema.org BreadcrumbList JSON-LD component |
| `frontend/public/robots.txt` | Robots rules with AI crawlers (GPTBot, ClaudeBot, etc.) |
| `frontend/src/index.css` | CSS variables, theme tokens, reduced-motion |
| `frontend/src/lib/utils.ts` | `cn()` — currently just `.join(' ')`, twMerge available |
| `backend/src/modules/search/application/search.service.ts` | **2K lines** — monolithic (to be refactored) |
| `backend/prisma/schema.prisma` | Database schema |
| `backend/src/auth.ts` | JWT + NextAuth config |
| `backend/src/lib/api-auth.ts` | API route auth middleware |
| `backend/src/lib/email-config-encrypt.ts` | Email config encryption (static salt — security issue) |
| `backend/jest.config.js` | Jest config with coverage thresholds (lines: 85%, branches: 79%, funcs: 82%) |
| `sonar-project.properties` | SonarQube exclusions & coverage config |
| `plan/system-improvement-v1.md` | 8-phase improvement plan (from audit) |
| `.cursor/rules/AGENT_RULES.mdc` | Global project rules (strict TS, no any, tests required) |
| `.cursor/rules/ai-workflow.mdc` | Pre/post-change workflow (build → test → commit → sonar) |
| `.cursor/rules/sonar-quality.mdc` | Sonar rules + coverage minimum (80%) |
| `Makefile` | All automation targets |

## SonarQube Rules That Fail Most Often

- **S3358** — nested ternaries
- **S3776** — cognitive complexity
- **S1874** — deprecated APIs (Zod v4 `z.email()`, old React event types)
- **S1128** — unused imports
- **S3863** — duplicate imports from same module
- **S1854** — useless assignments
- **S3696** — bare `throw { message }` instead of `throw new Error()`

Target: **0 issues**, coverage ≥ **80%** lines/functions/branches.
Dashboard: `https://sonar.innexar.com.br/dashboard?id=Prospector-AI`

## Cloudflare AI Audit

Configure Cloudflare AI Audit to **allow** the same crawlers listed in `frontend/public/robots.txt`:
- `GPTBot` / `ChatGPT-User`
- `ClaudeBot` / `anthropic-ai`
- `Google-Extended`
- `PerplexityBot`
- `Amazonbot` / `Bytespider`

The `robots.txt` and Cloudflare AI Audit allowlist must be kept in sync so AI crawlers can index public content (landing pages, blog, integration docs, pricing).

## i18n

- Market determined by domain (BR: `precisionia.com.br`, US: `precisionai.innexar.app`)
- i18n bundles: `frontend/src/lib/i18n/bundles/{pt,en}.ts`
- SEO HTML generator reads `VITE_MARKET` env var (`BR` or `US`)

## Security Hotspots (must fix)

1. Redis password hardcoded in `docker-compose.yml` (line 223)
2. `resetToken` stored plaintext in DB (no hash)
3. JWT 30-day expiry, no revocation mechanism
4. Static salt in `email-config-encrypt.ts`
5. Redis `protected-mode no` in `docker/redis.conf`

## Common Pitfalls

- AI workflow `.cursor/rules/ai-workflow.mdc` references `.ai/` directory — **doesn't exist**. Rules live in `.cursor/rules/`.
- Zod versions differ: frontend = v3, backend = v4.
- `framer-motion` (~140KB) in critical bundle — must use lazy imports.
- `App.css` (42 lines, Vite boilerplate) is dead code — not imported anywhere.
- Coverage exclusions are extensive — check `sonar-project.properties` and `jest.config.js` before adding tests.
- `make test` starts a **dedicated test DB** via `docker/docker-compose.yml`, not the production one.
- Docker build uses `docker compose build` (no cache by default) — use `make build-clean` for force rebuild.
- Maintenance mode: `docker compose --profile maintenance up -d` (captures all traffic via higher Traefik priority 500).

## Conventions

- Branches: `feat/<name>`, `fix/<name>`, `chore/<name>`
- Commit messages: imperative mood, prefix with type (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)
- TypeScript: strict mode, no `any`, prefer `unknown` + type guards
- Tests required for new features, must not break existing ones
- `.env` file required for Docker stack — see `.env.example`
