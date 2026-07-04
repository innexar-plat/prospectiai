---
goal: "Sistema Precision — Plano Completo de Melhorias"
version: "1.0"
date_created: "2026-07-04"
last_updated: "2026-07-04"
owner: "Time de engenharia"
status: "Planned"
tags: ["improvement", "security", "performance", "seo", "a11y", "refactoring"]
---

# Introdução

Plano de melhorias abrangente para o sistema Precision (prospector-ai), baseado em auditorias de 10 agentes especializados. O sistema está em produção atendendo clientes BR e US. Cada fase foi desenhada para ser segura, reversível e entregar valor incremental sem interromper operações.

# Architecture Decisions

| Decisão | Rationale |
|---------|-----------|
| Faseamento por risco/impacto | Correções críticas (segurança, dados) primeiro; refactoring e UX depois |
| Vertical slicing | Cada fase entrega um sistema funcional e testável |
| Feature flags para mudanças arriscadas | Permite rollback rápido sem novo deploy |
| Commits por fase | Cada fase é um commit atômico com push |

# Fases do Plano

# FASE 0 — Correções Críticas de Segurança (DX: 1-2 dias)
Risco: Alto — dados de clientes expostos. Fazer primeiro, testar, deploy imediato.

## Task 0.1: Remover senha hardcoded do Redis

**Descrição:** A senha `5pSc2M5Dr2SzezABGL4pJYEtU7QTi2jj3aZgIvi` está hardcoded no `docker-compose.yml` e `docker/redis.conf`. Mover para variável de ambiente.

**Acceptance criteria:**
- [ ] `REDIS_PASSWORD` lido de variável de ambiente (com fallback para warning)
- [ ] `docker-compose.yml` referencia `${REDIS_PASSWORD}` em vez de string literal
- [ ] `docker/redis.conf` usa `requirepass ${REDIS_PASSWORD}`

**Verification:**
- [ ] `docker compose config` não mostra a senha em texto puro
- [ ] Redis reinicia e autentica com a nova variável

**Files likely touched:**
- `docker-compose.yml`
- `docker/redis.conf`
- `.env.example`

**Estimated scope:** Small (1-2 files)

## Task 0.2: Hash resetToken antes de armazenar no banco

**Descrição:** `resetToken` armazenado em plaintext no Prisma schema. Aplicar SHA-256 hash antes de salvar.

**Acceptance criteria:**
- [ ] Rota `forgot-password` hasheia o token antes de salvar
- [ ] Rota `reset-password` hasheia o token recebido antes de buscar no DB
- [ ] Migração Prisma para garantir que tokens existentes continuam funcionando

**Files likely touched:**
- `backend/src/app/api/auth/forgot-password/route.ts`
- `backend/src/app/api/auth/reset-password/route.ts`

**Estimated scope:** Small (2 files)

## Task 0.3: Implementar JWT revogação

**Descrição:** JWT com 30 dias sem revogação. Adicionar `tokenVersion` no modelo User e verificar em cada request.

**Acceptance criteria:**
- [ ] Campo `tokenVersion` adicionado ao schema User
- [ ] JWT contém `tokenVersion` no payload
- [ ] Middleware `api-auth.ts` verifica `tokenVersion` do DB
- [ ] Rota de logout incrementa `tokenVersion`
- [ ] Rota admin de "force logout" incrementa `tokenVersion`

**Files likely touched:**
- `backend/prisma/schema.prisma`
- `backend/src/auth.ts`
- `backend/src/lib/api-auth.ts`
- `backend/src/app/api/auth/*/route.ts`

**Estimated scope:** Medium (4-5 files)

## Task 0.4: Substituir salt estático de criptografia

**Descrição:** `SALT = 'email-config-salt'` é fixo. Gerar salt aleatório por operação e armazenar junto do ciphertext.

**Acceptance criteria:**
- [ ] `email-config-encrypt.ts` gera salt aleatório por encryption
- [ ] Salt armazenado como prefixo do output hex
- [ ] Decrypt lê o salt do próprio ciphertext

**Files likely touched:**
- `backend/src/lib/email-config-encrypt.ts`

**Estimated scope:** Small (1 file)

## Task 0.5: Remover `protected-mode no` do Redis

**Descrição:** Redis exposto na rede Docker. Mudar para `protected-mode yes`.

**Acceptance criteria:**
- [ ] `docker/redis.conf` muda `protected-mode yes`
- [ ] Redis continua acessível pelos containers na mesma rede via senha

**Files likely touched:**
- `docker/redis.conf`

**Estimated scope:** XS (1 file)

### Checkpoint: Fase 0
- [ ] `npm run build` passa
- [ ] `npm run lint` passa
- [ ] Backend reinicia e opera normalmente
- [ ] Fluxo de forgot/reset password funciona
- [ ] Login/logout com revogação funcional
- [ ] Redis conecta com nova senha

---

# FASE 1 — Pipeline de Testes e CI (DX: 2-3 dias)
Risco: Médio — sem testes, refactoring é cego. Bloqueio para fases seguintes.

## Task 1.1: Adicionar testes faltando nos componentes do dashboard

**Descrição:** Componentes como `CrmSidePanel`, `CommandPalette`, `TrialBanner`, `UpgradeCTAModal` e `LocationFields` têm 0% de cobertura. Escrever testes para estados loading, empty, error.

**Acceptance criteria:**
- [ ] Cada componente tem teste de renderização básica
- [ ] Estados de loading e error cobertos
- [ ] Interações do usuário testadas (clique, submit)

**Files likely touched:**
- `frontend/src/components/dashboard/*.test.tsx`
- `frontend/src/components/dashboard/*.tsx`

**Estimated scope:** Large (8+ arquivos)

## Task 1.2: Adicionar testes de hooks customizados

**Description:** `useKeyboardShortcuts` e `useVersionCheck` sem testes. Escrever testes unitários.

**Acceptance criteria:**
- [ ] `useKeyboardShortcuts.test.ts` cobre keydown handlers
- [ ] `useVersionCheck.test.ts` cobre polling e atualização

**Files likely touched:**
- `frontend/src/hooks/useKeyboardShortcuts.test.ts`
- `frontend/src/hooks/useVersionCheck.test.ts`

**Estimated scope:** Small (2 files)

## Task 1.3: Configurar CI com enforce de coverage

**Descrição:** Adicionar GitHub Action que roda `npm run test:coverage` e falha se coverage cair abaixo do threshold.

**Acceptance criteria:**
- [ ] `.github/workflows/ci.yml` criado
- [ ] Roda lint, build, test em paralelo
- [ ] Falha se coverage < threshold configurado

**Files likely touched:**
- `.github/workflows/ci.yml`
- `Makefile` (adicionar target `ci`)

**Estimated scope:** Small (2 files)

## Task 1.4: Adicionar jest-axe na suite de testes do frontend

**Descrição:** Integrar `jest-axe` (vitest-axe) para testes automatizados de acessibilidade nos componentes UI.

**Acceptance criteria:**
- [ ] `vitest-axe` adicionado como devDependency
- [ ] Setup global inclui `toHaveNoViolations`
- [ ] Testes de `Button`, `Input`, `Card`, `Select` verificam a11y

**Files likely touched:**
- `frontend/package.json`
- `frontend/vitest.config.ts`
- `frontend/src/test/setup.ts`

**Estimated scope:** Small (3 files)

### Checkpoint: Fase 1
- [ ] `npm run test` passa em todas workspaces
- [ ] Coverage thresholds são atingidos ou ajustados
- [ ] CI pipeline funciona
- [ ] Testes de a11y passam

---

# FASE 2 — Performance e Infraestrutura (DX: 3-5 dias)
Risco: Médio — mudanças de infra podem afetar estabilidade. Feature flags e deploy gradual.

## Task 2.1: Adicionar PgBouncer

**Descrição:** Pool de conexão Prisma (10) é gargalo comprovado em load test. Adicionar PgBouncer sidecar no docker-compose.

**Acceptance criteria:**
- [ ] Serviço `pgbouncer` no docker-compose
- [ ] `DATABASE_URL` do backend aponta para PgBouncer
- [ ] Pool size configurado (25-50 conexões)
- [ ] Health check no PgBouncer
- [ ] Documentado no README

**Files likely touched:**
- `docker-compose.yml`
- `backend/.env.example`
- `docker/Dockerfile.pgbouncer` (se necessário)

**Estimated scope:** Medium (3-5 files)

## Task 2.2: Lazy-load framer-motion

**Descrição:** `framer-motion` (~140KB gzipped) no bundle crítico. Importar dinamicamente apenas onde usado.

**Acceptance criteria:**
- [ ] `framer-motion` removido de imports estáticos no entry point
- [ ] Componentes que usam animação importam com `React.lazy()` ou `dynamic()`
- [ ] Bundle size analysis mostra framer-motion fora do chunk crítico

**Files likely touched:**
- `frontend/src/App.tsx`
- `frontend/src/components/landing/LandingPage.tsx`
- `frontend/vite.config.ts`

**Estimated scope:** Medium (3-4 files)

## Task 2.3: Configurar CDN (Cloudflare)

**Descrição:** Assets estáticos servidos sem CDN. Configurar Cloudflare para cache de assets com 1y immutable.

**Acceptance criteria:**
- [ ] Regras de cache page rule configuradas no Cloudflare
- [ ] Nginx retorna headers de cache corretos (já configurado, verificar)
- [ ] Assets hasheados servidos com `Cache-Control: public, immutable, max-age=31536000`

**Files likely touched:**
- `frontend/nginx.conf` (revisar)
- Dashboard Cloudflare

**Estimated scope:** Small (1 file + config externa)

## Task 2.4: Adicionar compressão Brotli

**Descrição:** Usar gzip apenas. Brotli reduz 20-30% no tamanho de transferência de JS/CSS.

**Acceptance criteria:**
- [ ] Nginx configurado com `brotli on`
- [ ] Brotli compression level 6
- [ ] Testado com `curl --header "Accept-Encoding: br"`

**Files likely touched:**
- `frontend/nginx.conf`

**Estimated scope:** XS (1 file)

### Checkpoint: Fase 2
- [ ] Deploy não afeta usuários ativos
- [ ] PgBouncer operacional sem quebras
- [ ] Bundle size do frontend reduzido
- [ ] Brotli ativo e funcionando

---

# FASE 3 — SEO e Conteúdo (DX: 3-5 dias)
Risco: Baixo — mudanças em conteúdo e metadata não afetam funcionalidade.

## Task 3.1: Adicionar SSR para páginas públicas

**Descrição:** SPA puro sem SSR é o maior gap SEO. Implementar pré-renderização para páginas públicas usando `vite-plugin-ssr` ou serviço de prerender.

**Acceptance criteria:**
- [ ] Homepage renderiza HTML completo no server
- [ ] Blog posts renderizam HTML completo
- [ ] Landing pages SEO renderizam HTML completo
- [ ] Meta tags (og:title, description) presentes no HTML inicial

**Files likely touched:**
- `frontend/vite.config.ts`
- `frontend/src/App.tsx`
- `frontend/src/pages/seo/SeoLandingPage.tsx`

**Estimated scope:** Large (mais de 8 arquivos — pode ser dividido)

## Task 3.2: Corrigir bloqueio de AI crawlers no Cloudflare

**Descrição:** Cloudflare AI Audit sobrescreve robots.txt e bloqueia AI crawlers. Ajustar configuração.

**Acceptance criteria:**
- [ ] Cloudflare AI Audit configurado para permitir GPTBot, ClaudeBot, Google-Extended, PerplexityBot
- [ ] robots.txt e Cloudflare em sincronia
- [ ] Testado com `curl -A "GPTBot"` retorna 200

**Files likely touched:**
- Configuração Cloudflare

**Estimated scope:** XS (config externa)

## Task 3.3: Adicionar meta tags para páginas de integração e pricing

**Descrição:** Páginas RdStation, Agendor, HubSpot, e Pricing herdam meta tags da home. Adicionar title, description, og:title, og:description, canonical.

**Acceptance criteria:**
- [ ] Cada página de integração tem title e description únicos
- [ ] Pricing page tem title e description únicos
- [ ] Canonical URL configurada por página

**Files likely touched:**
- `frontend/src/pages/public/IntegracoesPage.tsx`
- `frontend/src/pages/public/PricingPage.tsx`

**Estimated scope:** Small (2 files)

## Task 3.4: Adicionar BreadcrumbList JSON-LD

**Descrição:** Nenhuma página tem BreadcrumbList schema. Adicionar em todas páginas públicas.

**Acceptance criteria:**
- [ ] Home → Categoria → Página tem breadcrumb no JSON-LD
- [ ] Blog posts têm breadcrumb
- [ ] Landing pages SEO têm breadcrumb

**Files likely touched:**
- `frontend/src/components/layout/Breadcrumb.tsx` (novo)
- `frontend/src/pages/*.tsx`

**Estimated scope:** Medium (vários arquivos)

### Checkpoint: Fase 3
- [ ] Homepage e blog renderizam HTML no server
- [ ] Cloudflare não bloqueia AI crawlers
- [ ] Todas páginas públicas têm meta tags únicas
- [ ] Structured data (BreadcrumbList) presente

---

# FASE 4 — Acessibilidade (DX: 2-3 dias)
Risco: Baixo — mudanças de a11y não alteram comportamento funcional.

## Task 4.1: Adicionar `aria-describedby` e `aria-invalid` nos inputs com erro

**Descrição:** Inputs com erro não são anunciados por leitores de tela. Associar mensagem de erro programaticamente.

**Acceptance criteria:**
- [ ] `Input.tsx` renderiza `aria-describedby` apontando para o `<p>` de erro
- [ ] `Input.tsx` renderiza `aria-invalid={!!error}`
- [ ] `Select.tsx` mesmo padrão

**Files likely touched:**
- `frontend/src/components/ui/Input.tsx`
- `frontend/src/components/ui/Select.tsx`

**Estimated scope:** Small (2 files)

## Task 4.2: Adicionar `prefers-reduced-motion`

**Descrição:** Animações contínuas (marquee, float, shimmer) sem respeito por preferência de movimento.

**Acceptance criteria:**
- [ ] `index.css` tem `@media (prefers-reduced-motion: reduce)` que desliga animações
- [ ] `InfiniteMarquee` tem `aria-hidden="true"` + alternativa `sr-only`
- [ ] `active:scale-95` condicional à preferência

**Files likely touched:**
- `frontend/src/index.css`
- `frontend/src/components/landing/LandingPage.tsx`
- `frontend/src/components/ui/Button.tsx`

**Estimated scope:** Small (3 files)

## Task 4.3: Tornar dropdowns operáveis por teclado

**Descrição:** Dropdowns de notificações e avatar menu não fecham com Escape, não têm navegação por setas.

**Acceptance criteria:**
- [ ] Dropdown de notificações fecha com Escape
- [ ] Menu avatar fecha com Escape
- [ ] Menu mobile tem focus trapping
- [ ] Itens do menu navegáveis por ArrowUp/ArrowDown

**Files likely touched:**
- `frontend/src/pages/dashboard/DashboardLayout.tsx`
- `frontend/src/components/layout/Header.tsx`

**Estimated scope:** Medium (2 files, but complex logic)

## Task 4.4: Corrigir contraste do `text-muted`

**Descrição:** `--theme-muted: #4a4860` em `#f0eef6` = 4.4:1 (falha WCAG AA 4.5:1).

**Acceptance criteria:**
- [ ] `--theme-muted` alterado para no mínimo 4.5:1 contra `--theme-bg`
- [ ] Todas as instâncias de `text-muted` verificadas visualmente

**Files likely touched:**
- `frontend/src/index.css`

**Estimated scope:** XS (1 file)

### Checkpoint: Fase 4
- [ ] Lighthouse a11y score >= 90
- [ ] axe DevTools não reporta violações críticas
- [ ] Todos os form inputs associam erros programaticamente
- [ ] Animações respeitam prefers-reduced-motion

---

# FASE 5 — Refactoring de Código (DX: 3-5 dias)
Risco: Alto — mudanças estruturais podem quebrar funcionalidades. Testes da Fase 1 são pré-requisito.

## Task 5.1: Quebrar `search.service.ts` (2.047 linhas)

**Descrição:** O arquivo contém cache, RF integration, site enrichment, search orchestration. Extrair em módulos.

**Acceptance criteria:**
- [ ] Cache layer extraído para `search/cache.ts`
- [ ] RF (Receita Federal) integration extraído para `search/rf-integration.ts`
- [ ] Site enrichment extraído para `search/enrichment.ts`
- [ ] Orchestration permanece em `search.service.ts` (reduzido)
- [ ] Nenhuma mudança de comportamento

**Files likely touched:**
- `backend/src/modules/search/application/search.service.ts`
- `backend/src/modules/search/application/cache.ts`
- `backend/src/modules/search/application/rf-integration.ts`
- `backend/src/modules/search/application/enrichment.ts`

**Estimated scope:** Large (vários arquivos)

## Task 5.2: Eliminar casts `as unknown as T`

**Descrição:** 30+ casts que anulam TypeScript. Substituir por discriminated unions, Zod parsing, ou type guards.

**Acceptance criteria:**
- [ ] `rdstation-oauth.ts` sem casts
- [ ] `hubspot-oauth.ts` sem casts
- [ ] `contact-intelligence.ts` sem casts
- [ ] `billing/webhook/route.ts` sem casts

**Files likely touched:**
- `backend/src/lib/rdstation-oauth.ts`
- `backend/src/lib/hubspot-oauth.ts`
- `backend/src/lib/contact-intelligence.ts`
- `backend/src/app/api/billing/webhook/route.ts`

**Estimated scope:** Medium (4-5 files)

## Task 5.3: Corrigir `cn()` para usar `tailwind-merge`

**Descrição:** `cn()` atual só faz `.join(' ')`, sem resolver classes conflitantes. `tailwind-merge` já está nas deps.

**Acceptance criteria:**
- [ ] `utils.ts` usa `twMerge(clsx(inputs))`
- [ ] Teste unitário comprova que classes conflitantes são resolvidas

**Files likely touched:**
- `frontend/src/lib/utils.ts`
- `frontend/src/lib/utils.test.ts`

**Estimated scope:** Small (2 files)

## Task 5.4: Remover `App.css` morto

**Descrição:** `App.css` (42 linhas, boilerplate Vite) é incluído no build de produção mas nunca importado.

**Acceptance criteria:**
- [ ] `App.css` deletado
- [ ] Nenhum import para `App.css` em `main.tsx` ou qualquer arquivo
- [ ] Build produz sem erros

**Files likely touched:**
- `frontend/src/App.css`
- `frontend/src/main.tsx`

**Estimated scope:** XS (1-2 files)

## Task 5.5: Quebrar `frontend/src/lib/api.ts` (1.780 linhas)

**Descrição:** Um arquivo contém todos os clients API e tipos. Separar por domínio.

**Acceptance criteria:**
- [ ] `api/auth.ts` — autenticação
- [ ] `api/search.ts` — busca e análise
- [ ] `api/billing.ts` — cobrança
- [ ] `api/types.ts` — interfaces compartilhadas
- [ ] `api.ts` vira barrel export

**Files likely touched:**
- `frontend/src/lib/api.ts`
- `frontend/src/lib/api/*.ts`

**Estimated scope:** Medium (vários arquivos)

### Checkpoint: Fase 5
- [ ] Todos os testes passam
- [ ] Build de produção bem-sucedido
- [ ] `search.service.ts` reduzido significativamente
- [ ] Nenhum `as unknown as` novo adicionado

---

# FASE 6 — Code Quality e TypeScript (DX: 2-3 dias)
Risco: Médio — mudanças de tipo podem expor bugs existentes.

## Task 6.1: Harmonizar versões do Zod

**Descrição:** Frontend usa Zod v3, backend usa Zod v4. Unificar em uma versão.

**Acceptance criteria:**
- [ ] Monorepo usa mesma versão de Zod (definir v3 ou v4)
- [ ] `package.json` hoisted no root
- [ ] Nenhum import quebrado

**Files likely touched:**
- `frontend/package.json`
- `backend/package.json`
- `package.json` (root)

**Estimated scope:** Small (3 files)

## Task 6.2: Habilitar strict mode adicional no TypeScript

**Descrição:** Adicionar `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` nos tsconfigs.

**Acceptance criteria:**
- [ ] `tsconfig.json` tem `noUncheckedIndexedAccess: true`
- [ ] `exactOptionalPropertyTypes: true`
- [ ] Build passa sem erros novos

**Files likely touched:**
- `frontend/tsconfig.json`
- `backend/tsconfig.json`
- `admin/tsconfig.json`

**Estimated scope:** Medium (3 files + correções nos fontes)

## Task 6.3: Substituir `speakeasy` por `otplib`

**Descrição:** `speakeasy@^2.0.0` está sem manutenção. Migrar para `otplib`.

**Acceptance criteria:**
- [ ] `otplib` adicionado como dependência
- [ ] `speakeasy` removido
- [ ] 2FA (TOTP) continua funcionando
- [ ] Testes de 2FA passam

**Files likely touched:**
- `backend/package.json`
- `backend/src/lib/twofa.ts`
- `backend/src/app/api/auth/2fa/*.ts`

**Estimated scope:** Small (3-4 files)

### Checkpoint: Fase 6
- [ ] Build passa sem erros
- [ ] Lint passa
- [ ] 2FA testado manualmente
- [ ] Zod unificado

---

# FASE 7 — Experiência do Usuário e Conversão (DX: 3-5 dias)
Risco: Baixo — mudanças de conteúdo e CTA.

## Task 7.1: Corrigir CTA hero da landing page

**Descrição:** CTA mostra "Começar — a partir de $19/mês" em vez de "Começar grátis". Meta description diz "Teste grátis".

**Acceptance criteria:**
- [ ] CTA principal: "Começar grátis"
- [ ] "A partir de $19/mês" movido para sub-texto
- [ ] Consistente entre BR e US

**Files likely touched:**
- `frontend/src/components/landing/LandingPage.tsx`
- `frontend/src/lib/i18n/bundles/pt.ts`
- `frontend/src/lib/i18n/bundles/en.ts`

**Estimated scope:** Small (3 files)

## Task 7.2: Substituir spinners por skeletons

**Descrição:** `Skeleton.tsx` existe mas não é usado. Substituir spinners por skeletons nos dashboards.

**Acceptance criteria:**
- [ ] `DashboardIndex.tsx` usa skeleton durante loading
- [ ] `LeadsPage.tsx` usa skeleton
- [ ] `ResultadosPage.tsx` usa skeleton

**Files likely touched:**
- `frontend/src/pages/dashboard/DashboardIndex.tsx`
- `frontend/src/pages/dashboard/LeadsPage.tsx`
- `frontend/src/pages/dashboard/ResultadosPage.tsx`

**Estimated scope:** Medium (3-4 files)

## Task 7.3: Adicionar seção FAQ na landing page

**Descrição:** Landing page não tem FAQ. Adicionar com perguntas comuns sobre prospecção B2B.

**Acceptance criteria:**
- [ ] Seção FAQ com 4-6 perguntas
- [ ] Schema.org FAQPage no JSON-LD
- [ ] Accordion expande/recolhe com `aria-expanded`

**Files likely touched:**
- `frontend/src/components/landing/LandingPage.tsx`
- `frontend/src/lib/i18n/bundles/pt.ts`
- `frontend/src/lib/i18n/bundles/en.ts`

**Estimated scope:** Small (3 files)

### Checkpoint: Fase 7
- [ ] Landing page revisada e aprovada
- [ ] Skeletons substituem spinners
- [ ] FAQ visível e funcional

---

# FASE 8 — Monitoramento e Observabilidade (DX: 1-2 dias)
Risco: Baixo — ferramentas adicionais, sem mudança de comportamento.

## Task 8.1: Adicionar Web Vitals monitoring (RUM)

**Descrição:** Sem monitoramento de performance real do usuário. Adicionar `web-vitals` library.

**Acceptance criteria:**
- [ ] `web-vitals` adicionado
- [ ] LCP, FID, CLS reportados para analytics
- [ ] Dados visíveis no dashboard GA4

**Files likely touched:**
- `frontend/package.json`
- `frontend/src/main.tsx`
- `frontend/src/lib/analytics.ts`

**Estimated scope:** Small (3 files)

## Task 8.2: Adicionar CSP report-uri

**Descrição:** CSP sem `report-uri` ou `report-to`. Adicionar endpoint de relatório.

**Acceptance criteria:**
- [ ] `report-uri /api/csp-report` adicionado ao CSP
- [ ] Backend tem endpoint que recebe e loga violações
- [ ] Dashboard de violações (opcional)

**Files likely touched:**
- `frontend/security-headers.conf`
- `backend/src/app/api/csp-report/route.ts`

**Estimated scope:** Small (2 files)

## Task 8.3: Adicionar APM (Sentry ou similar)

**Descrição:** Sem rastreamento de erros em produção além de logs.

**Acceptance criteria:**
- [ ] Sentry integrado no backend
- [ ] Erros não-tratados capturados
- [ ] Performance traces para endpoints críticos (search, analyze)

**Files likely touched:**
- `backend/package.json`
- `backend/src/lib/sentry.ts`
- `backend/src/app/api/*/route.ts`

**Estimated scope:** Medium (vários arquivos)

### Checkpoint: Fase 8
- [ ] Web Vitals sendo coletados
- [ ] CSP violation reports chegando
- [ ] Erros monitorados via Sentry

---

# Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Mudança de senha Redis derruba serviço | Alto | Fazer em janela de manutenção, testar em staging |
| Refactoring de `search.service.ts` introduz bug | Alto | Testes da Fase 1 são pré-requisito, deploy com feature flag |
| SSR aumenta complexidade do deploy | Médio | Implementar como serviço separado, não modificar o SPA existente |
| PgBouncer adiciona latência se mal configurado | Médio | Benchmark antes/depois, pool size configurável |
| Mudança de contraste `text-muted` afeta UX existente | Baixo | Revisão visual em light/dark mode antes do deploy |
| Migração `speakeasy` → `otplib` quebra 2FA | Alto | Testar com token real, ter rollback preparado |

# Perguntas em Aberto

1. Devo criar um ambiente de staging separado para testar as fases?
2. Qual a janela de manutenção aceitável para mudanças de infra (Fase 2)?
3. Preferência por `vite-plugin-ssr` vs serviço externo de prerender?
4. Sentry self-hosted ou cloud?

# Estratégia de Deploy

1. **Cada fase é um commit atômico** com mensagem descritiva
2. **Feature flags** para mudanças de comportamento (Fase 5, 6)
3. **Rollback plan**: `git revert <commit>` + `docker compose down && docker compose up -d --build`
4. **Deploy em horário comercial** (seg-sex, 10h-16h) para resposta rápida
5. **Notificar usuários** via toast/app se houver downtime planejado
