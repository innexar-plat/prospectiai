# Relatório Técnico — Docker, Build e Auditoria

**Data:** 2026-02-22  
**Projeto:** Prospector AI (monorepo Next.js + Postgres)

---

## 1. Status Geral

**Status:** **OK**

- Stack sobe em Docker.
- Build completo no container: OK.
- Healthchecks: app e db healthy.
- Logs sem erros críticos após correções.
- Landing e `/api/health` respondem corretamente.

---

## 2. Containers Saudáveis

| Serviço | Imagem | Porta (host) | Status |
|--------|--------|---------------|--------|
| app | docker-app (Next.js 16 standalone) | 3010 → 3000 | Up (healthy) |
| db | postgres:16-alpine | 5433 → 5432 | Up (healthy) |

---

## 3. Problemas Encontrados e Correções Realizadas

### Build
- **globals.css ausente:** `backend/src/app/[locale]/layout.tsx` importava `../globals.css` que não existia.  
  **Correção:** Criado `backend/src/app/globals.css` com Tailwind v4 e variáveis CSS.
- **Input sem prop `label`:** `SignInPage` passava `label` para `Input`; tipo não permitia.  
  **Correção:** Adicionada prop opcional `label` em `InputProps` e renderização em `Input.tsx`.
- **Função Server → Client:** Página passava `onViewPlans` (função) do Server para Client Component, gerando 500.  
  **Correção:** Removida passagem de função; `onViewPlans` opcional em `LandingPage` com fallback no cliente (scroll para `#plans`).

### Docker / Compose
- **Compose desalinhado com o projeto:** Compose antigo tinha `web` (Node dev) + `api` (Python FastAPI); o projeto é monorepo Next.js (backend) + Postgres.  
  **Correção:** Novo `docker-compose.yml` com serviços `app` (Dockerfile raiz) e `db` (postgres:16-alpine). Removidos serviços `web` e `api`.
- **Healthcheck do app:** Não existia endpoint dedicado.  
  **Correção:** Criado `GET /api/health` retornando `{ "status": "ok" }` e healthcheck no compose usando `wget` nesse endpoint.
- **Portas em uso (5432, 3000, 3001):** Conflito com serviços no host.  
  **Correção:** app em 3010, db em 5433 no host.
- **Scripts e Makefile:** Ajustados para stack real: `health.sh` (app em 3010, landing 307/200, /pt 200); `test.sh` com serviço `test` (profile test); `logs.sh` por serviço.

### Observabilidade
- **Restart e imagem do DB:** Adicionados `restart: unless-stopped` em app e db; imagem fixa `postgres:16-alpine` (sem `latest`).

---

## 4. Riscos Arquiteturais

- **Uso de `any` (TypeScript):** Vários arquivos usam `any` (SignInPage, DashboardRoot, AppShell, Header, Sidebar, Dashboard, LeadsList, billing webhook). Impacto: tipagem fraca e manutenção difícil. Recomendação: substituir por tipos/interfaces e `unknown` com type guards onde fizer sentido.
- **Middleware “deprecated”:** Next.js avisa que a convenção “middleware” está deprecated em favor de “proxy”. Impacto: futuro breaking change. Recomendação: acompanhar documentação e migrar quando estável.
- **MERCADOPAGO_ACCESS_TOKEN não definido em build:** Aparece durante “Collecting page data”. Impacto: possível falha em rotas que dependem do token em build time. Recomendação: garantir env em build ou tornar uso apenas runtime.
- **npm audit (33 vulnerabilidades):** 2 moderate, 31 high. Recomendação: `npm audit` e correções incrementais (evitar `--force` sem análise).
- **Prisma sem `migrate deploy` no startup:** Migrations não são aplicadas automaticamente ao subir o app. Recomendação: adicionar passo `prisma migrate deploy` no entrypoint ou em job de init.

---

## 5. Melhorias Recomendadas

1. **Tipagem:** Eliminar `any` nos arquivos listados; definir props e DTOs explícitos.
2. **Segurança:** Não logar segredos; validar payloads em webhooks (Stripe/Mercado Pago); manter NEXTAUTH_SECRET e tokens só em env.
3. **Docker:** Considerar multi-stage mais enxuto (ex.: não copiar frontend/admin desnecessários para o stage final); adicionar `.dockerignore` robusto para reduzir contexto de build.
4. **Observabilidade:** Logs estruturados (JSON) e correlation id por request; métricas básicas se houver carga.
5. **Testes no container:** Serviço `test` (profile test) já configurado; garantir que `npm run test -w backend` rode estável e cubra rotas críticas.
6. **Migrations:** Rodar `prisma migrate deploy` antes de `node backend/server.js` (script de entrypoint ou init container).

---

## 6. Checklist Final Validado

- [x] Build no container OK
- [x] `make up` / `docker compose up -d` OK
- [x] `make health` OK (app + landing + /pt)
- [x] Logs do app sem erros críticos
- [x] DB conectado (Prisma)
- [x] Landing page responde (307 para /, 200 para /pt)
- [x] `/api/health` retorna 200
- [x] Imagens com tag fixa (postgres:16-alpine)
- [x] Volumes persistentes para Postgres (pgdata)
- [x] Restart policy nos serviços

---

## 7. Evidências (resumidas)

### Build
```
Image docker-app Built
✓ Compiled successfully
✓ Generating static pages
```

### Health
```
== Health app (Next.js) ==
OK
== Landing page (redirect or 200) ==
OK (307)
== Locale page /pt ==
OK
```

### Containers
```
docker-app-1   docker-app     Up (healthy)   0.0.0.0:3010->3000/tcp
docker-db-1    postgres:16-alpine   Up (healthy)   0.0.0.0:5433->5432/tcp
```

### Logs app
```
▲ Next.js 16.1.6
✓ Ready in 160ms
```

---

## 8. Scores (0–10)

| Critério | Score | Observação |
|----------|-------|------------|
| **Maturidade técnica** | 7 | Build e deploy ok; tipagem fraca (`any`), migrations não automáticas, deprecation middleware. |
| **Segurança** | 6 | Headers de segurança no Next; segredos por env; webhooks e validação de input podem ser reforçados; npm audit com vulnerabilidades. |
| **Escalabilidade** | 7 | Stateless app; DB com volume; falta Redis/rate limit explícito e health mais rico para LB. |
| **Organização de código** | 7 | Monorepo claro; backend com app router e APIs; uso de `any` e alguns acoplamentos (ex.: billing webhook) reduzem nota. |

---

**Como reproduzir:**

```bash
cd /opt/prospector-ai
make build
make up
make health
make logs SERVICE=app
```
