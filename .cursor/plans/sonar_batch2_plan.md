# Plano: Correções SonarQube (batch 2) — sem retrocesso

## Fase 1 — Assertions redundantes
- **admin** `UsersPage.tsx` L116, L118: remover `(u as SupportUserListItem)` / `(u as AdminUserListItem)` onde a união já permite acesso (u.disabledAt, u.onboardingCompletedAt, _count via optional).
- **backend** `auth.ts` L85, L86, L89, L132: remover `as string` / `as Session` se tipo já correto.
- **backend** `v1/billing/webhook/route.ts` L54: remover assertion redundante em `event.data.object`.
- **frontend** `EquipePage.tsx` L192: `res.pendingInvite!` → usar `res.pendingInvite` (já dentro de `if (res.pendingInvite)`).
- **frontend** `LeadDetailPage.tsx` L148: simplificar assertion em placeDetail.
- **frontend** `HistoricoPage.tsx` L322: remover assertion redundante.

## Fase 2 — Array index como key
- **frontend** `Pricing.tsx` L187: key estável (ex: `${plan.id}-feat-${f}`).
- **frontend** `ConcorrenciaPage.tsx` L241, 253, 265: keys estáveis (ex: `seo-${item}-${i}` ou conteúdo estável).
- **frontend** `LeadDetailPage.tsx` L453, 466, 481: keys estáveis.
- **frontend** `MinhaEmpresaPage.tsx`, `PlanosPage.tsx`, `RelatoriosPage.tsx`: keys estáveis.

## Fase 3 — Ternários aninhados (extrair)
- **backend** `gemini.ts`: extrair ternários para variáveis/helpers.
- **frontend** `EquipePage.tsx`, `EquipeDashboardPage.tsx`, `HistoricoPage.tsx`, `LeadsPage.tsx`, `PlanosPage.tsx`: extrair ternários.

## Fase 4 — Complexidade cognitiva (≤15)
- Funções “quase no limite” primeiro: 16→15 (onboarding/complete, team/invite, workspace/current/profile, competitors).
- Depois: 17–22 (UserDetailPage, ai-config [id], email/config, reset-password, apply-pending, process-payment, team/route, user/profile, v1/search, google-places, schedule-downgrade, resolve.ts, MinhaEmpresaPage, Header, EmpresaPerfilPage).
- Por último: funções maiores (checkout, webhooks, company-analysis, team/dashboard, user/me, gemini, cloudflare, email, analyze.service, company-analysis.service, market.service, search.service, viability.service, HistoricoPage, LeadDetailPage, EquipePage, PlanosPage).

## Fase 5 — Outros
- **frontend** `index.css` @theme: já excluído em sonar (e1, css:S4662).
- **frontend** `HistoricoPage.tsx` L279: template literal aninhado; L293: “always truthy” — refatorar condição.
- **backend** `viability.service.ts` L42: template literal aninhado.

## Validação
- `make build` e `make test` (ou npm run lint/typecheck em cada pacote).
- Commit e push após cada fase ou em um único commit consolidado.
