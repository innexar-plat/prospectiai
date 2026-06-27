# Plano de Transformação — Conversão & Produto

**Data:** 25/06/2026  
**Status:** Em execução (Fase 1 implementada)

---

## Visão geral

Transformar o Precision IA de um produto com plano free permanente (0% conversão) para um modelo **trial-first** com funil otimizado, preços revisados e UX orientada a valor.

---

## Fase 1 — Trial + desativar Free ✅ (implementado)

### O que mudou

| Item | Antes | Depois |
|------|-------|--------|
| Novo cadastro | Plano FREE (10 créditos) | **Trial 7 dias** (50 créditos, módulos Growth) |
| Plano FREE | Ativo na UI | **Desativado** (`isActive: false`) |
| Preços Starter | R$ 129/mês | **R$ 97/mês** |
| Preços Growth | R$ 397/mês | **R$ 297/mês** |
| Preços Business | R$ 997/mês | **R$ 797/mês** |
| Preços Enterprise | R$ 2.497/mês | **R$ 1.997/mês** |
| Trial expirado | — | Bloqueio busca/análise + redirect `/dashboard/planos` |

### Arquivos principais

- `backend/src/lib/trial.ts` — lógica de trial
- `backend/prisma/migrations/20250625120000_add_trial_plan/`
- `backend/scripts/cleanup-test-accounts.mjs` — limpeza de contas teste
- `frontend/src/components/dashboard/TrialBanner.tsx`
- `frontend/src/pages/dashboard/DashboardIndex.tsx` — quick start + créditos

### Validar

```bash
# Migration (no container backend)
docker exec prospector-backend npx prisma migrate deploy

# Limpar contas teste (dry-run primeiro)
docker exec prospector-backend node scripts/cleanup-test-accounts.mjs --dry-run
docker exec prospector-backend node scripts/cleanup-test-accounts.mjs --execute

# Cron trial expiry (agendar diário)
curl -H "Authorization: Bearer $CRON_SECRET" https://precisionia.com.br/api/cron/trial-expiry

make build && make test && make health
```

---

## Fase 2 — Funil de conversão (próxima)

| # | Tarefa | Prioridade |
|---|--------|------------|
| 1 | E-mail automático D-3, D-1, D0 do trial (`trialExpiringTemplate` já existe) | Alta |
| 2 | E-mail ao atingir 80% dos créditos do trial | Alta |
| 3 | Eventos GA4: `trial_started`, `trial_expired`, `checkout_started` | Alta |
| 4 | Onboarding com primeira busca sugerida (auto-fill do perfil) | Média |
| 5 | Sequência reengajamento para quem não buscou em 24h | Média |
| 6 | Página pública de preços (sem só redirect signup) | Média |

---

## Fase 3 — Módulos e análise IA

### Diagnóstico atual

| Módulo | Status backend | Problema |
|--------|----------------|----------|
| Mapeamento | ✅ done | OK — core do produto |
| Inteligência Leads | ⚠️ partial | Só 23% dos usuários usam análise IA |
| Análise Concorrência | ⚠️ partial | Bloqueado até PRO — trial agora libera |
| Ação Comercial | ⚠️ partial | Scripts existem mas poucos chegam lá |
| Inteligência Mercado | ⚠️ partial | Só Business+ |
| Análise Minha Empresa | ✅ done | Poucos preenchem perfil |

### Melhorias propostas

1. **Análise IA one-click** — botão "Analisar melhor lead" na tela de resultados
2. **Preview parcial no trial** — mostrar score + 2 linhas do relatório antes de gastar crédito
3. **Módulo cards na sidebar** — indicar o que está disponível no trial vs pago
4. **Relatório pós-busca** — resumo automático "3 leads quentes encontrados"
5. **Quality gate Sonar** — reduzir complexidade em `analyze.service.ts` e `search.service.ts`

---

## Fase 4 — Redesign de telas

### Tela de busca (`DashboardIndex`)

**Implementado nesta fase:**
- Card "Primeiros passos" para novos usuários
- Faixa de créditos restantes
- Quick link para planos quando créditos ≤ 10

**Próximo:**
- Modo simplificado vs avançado (colapsar categorias por default)
- Busca por voz / templates do perfil de onboarding
- Resultados inline (sem navegar para outra página)

### Outras telas

| Tela | Melhoria proposta |
|------|-------------------|
| Resultados | CTA "Analisar top 3 com IA" em lote |
| Lead Detail | Tabs: Score → Abordagem → Concorrência |
| Planos | Destaque Starter para ex-trial |
| Onboarding | Busca demo ao final do fluxo |
| Pipeline | Só para pagos — trial vê preview borrado |

---

## Fase 5 — Bloqueadores restantes (análise)

| Bloqueador | Impacto | Ação |
|------------|---------|------|
| Zero tentativas de checkout | Crítico | Trial cria urgência + preço menor |
| 37% nunca usaram | Alto | Quick start + e-mail D+1 |
| 10% retenção D+7 | Alto | Push + relatório semanal |
| E-mails Resend com quota | Médio | Aumentar plano Resend |
| Afiliados 772 cliques / 0 pago | Médio | Revisar landing afiliado |
| Admin grants SCALE confundem métricas | Baixo | Flag `isComp` no workspace |
| Onboarding sem empresa (81/88) | Alto | Tornar CNAE/produto obrigatório |

---

## Cronograma sugerido

| Semana | Entrega |
|--------|---------|
| 1 | Fase 1 deploy + cleanup testes + contatar 3 usuários no limite |
| 2 | E-mails trial + GA4 events |
| 3 | Análise IA one-click + preview |
| 4 | Redesign resultados + onboarding com demo |

---

## Métricas de sucesso (30 dias)

| KPI | Baseline | Meta |
|-----|----------|------|
| Taxa cadastro → 1ª busca | 63% | 80% |
| Taxa cadastro → análise IA | 23% | 45% |
| Trial → checkout iniciado | 0% | 15% |
| Trial → pagamento | 0% | 5% |
| Retenção D+7 | 10% | 25% |

---

*Ver também: `.ai/ANALISE_CONVERSAO_USUARIOS.md`*
