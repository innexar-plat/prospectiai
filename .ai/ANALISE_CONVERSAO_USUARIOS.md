# Análise de Conversão — Precision IA (Prospector AI)

**Data:** 25/06/2026  
**Domínio:** https://precisionia.com.br  
**Contexto:** ~100 usuários cadastrados, **zero compras reais** via gateway de pagamento.

---

## 1. Resumo executivo

| Métrica | Valor |
|---------|-------|
| Usuários totais | **102** |
| Usuários reais (excl. testes/benchmarks/internos) | **87** |
| Pagamentos concluídos (MercadoPago/Stripe) | **0** |
| `subscriptionId` preenchido | **0** (users e workspaces) |
| Tentativas de checkout nos logs do backend | **0** |
| Taxa cadastro → busca | **63%** |
| Taxa cadastro → análise IA | **23%** |
| Retorno após 7 dias (quem buscou) | **10%** (6 de 59) |
| Usuários que esgotaram créditos free | **3** |

**Conclusão principal:** o problema **não é falha de pagamento** (gateways configurados, health OK). É um **funil de produto e conversão**: a maioria experimenta pouco, não percebe valor suficiente para pagar R$ 129+/mês, e quase ninguém chega ao checkout.

---

## 2. Estado dos containers

| Container | Status | CPU | Memória |
|-----------|--------|-----|---------|
| `prospector-frontend` | healthy | ~0% | 8 MB |
| `prospector-backend` | healthy | ~0% | 102 MB |
| `prospector-db` | up | ~0% | 192 MB |
| `prospector-redis` | up | ~0.8% | 4 MB |

- **API pública:** `GET /api/health` → **200**
- **MercadoPago:** token configurado (`MP_TOKEN=SET`)
- **Stripe:** configurado (`STRIPE=SET`)
- **Webhook MP:** responde (401 sem assinatura — esperado)
- Infraestrutura **estável e saudável**; não há indício de problema técnico bloqueando vendas.

---

## 3. Estatísticas do banco de dados

### 3.1 Usuários

| Indicador | Total | Reais* |
|-----------|-------|--------|
| Cadastrados | 102 | 87 |
| Onboarding concluído | 88 (86%) | 76 (87%) |
| Onboarding pendente | 14 | 11 |
| Plano FREE | 96 | ~85 |
| Plano pago (User.plan) | 6 | 2 |
| Conta desabilitada | 1 | — |
| Login Google (OAuth) | 40 | — |
| Senha própria | 51 | — |
| E-mail verificado | 56 | — |

\*Exclui `@example.com`, benchmarks, load tests e contas internas Innexar.

### 3.2 Workspaces (onde créditos e billing são aplicados)

| Plano | Qtd | Com `subscriptionId` | Status ativo |
|-------|-----|------------------------|--------------|
| FREE | 85 | 0 | — |
| BASIC | 1 | 0 | 1 (`active`)* |
| BUSINESS | 1 | 0 | — |
| SCALE | 13 | 0 | 1 (`active`)* |

\*Status `active` **sem** `subscriptionId` → concessão manual pelo admin, não pagamento.

- **62 workspaces** com uso de créditos (`leadsUsed > 0`)
- **6 workspaces** no limite do plano
- Média de uso: **~30 créditos/workspace** (máx. 1.473 em conta interna)

### 3.3 Engajamento

| Métrica | Valor |
|---------|-------|
| Buscas totais (`SearchHistory`) | 12.728* |
| Usuários que buscaram | 66 (102 totais) / 55 (87 reais) |
| Análises IA (`LeadAnalysis`) | 293 |
| Usuários com análise IA | 24 / 20 reais |
| Leads no banco (`Lead`) | 6.943 |
| Relatórios de inteligência | — |
| Usuários que **nunca usaram** | 36 total / **32 reais (37%)** |

\*Inflado por contas de benchmark/stress (~1,4M buscas de uma conta de teste).

**Distribuição de buscas (usuários reais):**

| Faixa de buscas | Usuários |
|-----------------|----------|
| 0 | 32 (37%) |
| 1–5 | 51 (59%) |
| 6–20 | 4 |
| 21+ | 0 |

### 3.4 Funil de conversão (usuários reais)

```
Cadastro (87)
    ↓ 87% onboarding
Onboarding OK (76)
    ↓ 72% primeira busca
Buscou (55)
    ↓ 35% análise IA
Análise IA (19)
    ↓ 16% esgotou free
Bateu limite free (3)
    ↓ 0%
Pagou (0)
```

### 3.5 Cadastros por mês

| Mês | Signups (reais) |
|-----|-----------------|
| Fev/2026 | 13 |
| Mar/2026 | 11 |
| Abr/2026 | 35 ← pico |
| Mai/2026 | 26 |
| Jun/2026 | 7 ← queda |

### 3.6 Planos e preços (PlanConfig)

| Plano | Nome | Créditos/mês | Mensal (BRL) | Anual (BRL) |
|-------|------|--------------|--------------|-------------|
| FREE | Free | 10 | R$ 0 | R$ 0 |
| BASIC | Starter | 100 | **R$ 129** | R$ 1.315 |
| PRO | Growth | 400 | R$ 397 | R$ 4.049 |
| BUSINESS | Business | 1.200 | R$ 997 | R$ 10.169 |
| SCALE | Enterprise | 5.000 | R$ 2.497 | R$ 25.469 |

### 3.7 Custos de API (UsageEvent)

| Tipo | Volume |
|------|--------|
| Serper (web search) | 3.086 |
| Google Places Search | 1.998 |
| AI Tokens | 333 eventos |
| Google Places Details | 79 |

Tokens IA estimados: ~2,4M input + ~1M output (admin stats).

### 3.8 Afiliados

| Métrica | Valor |
|---------|-------|
| Afiliados cadastrados | 6 (5 aprovados) |
| Cliques em links | 772 |
| Referrals (cadastros atribuídos) | 4 |
| Conversões pagas | **0** |

### 3.9 E-mail marketing

| Métrica | Valor |
|---------|-------|
| Campanhas enviadas | 6 |
| Campanhas em rascunho | 12 |
| E-mails enviados | 778 |
| Falhas transacionais | 94 (17%) — **cota diária Resend esgotada** |
| Falhas de campanha | 6 (rate limit) |

### 3.10 Auditoria admin

- **18 alterações manuais de plano** via `admin.workspaces.update` (SCALE, BASIC, limites customizados)
- Planos pagos existentes no banco são em grande parte **cortesias/admin**, não receita

---

## 4. Por que 100 usuários e ninguém comprou?

### 4.1 Evidência direta: zero intenção de compra

- Nenhum `subscriptionId` no banco
- **Zero** logs de `Checkout`, `MP Preference` ou `MP PreApproval` no backend
- Os 3 usuários que **esgotaram os 10 créditos free** não iniciaram checkout

### 4.2 Ativação fraca — maioria “passa e sai”

- **37%** dos usuários reais nunca fizeram uma busca
- **59%** fizeram apenas 1–5 buscas (curiosidade, não uso recorrente)
- Apenas **23%** usaram análise IA (diferencial do produto pago)
- **10%** de retenção D+7 entre quem buscou

### 4.3 Valor percebido insuficiente antes do paywall

- Plano free entrega busca + score básico por **10 créditos**
- Muitos recursos premium (concorrência, scripts WhatsApp, viabilidade) estão **bloqueados por plano**, mas o usuário pode não chegar a tentar usá-los
- Apenas **7 usuários** preencheram perfil de empresa no onboarding — baixa personalização da IA

### 4.4 Paywall tardio e fraco

- Só **3 usuários reais** bateram no limite de 10 créditos
- 82% dos usuários free usaram **menos de 10 créditos** — nunca sentiram bloqueio
- Quem bate no limite vê modal de upgrade na busca, mas **não há sequência de e-mail/WhatsApp** de recuperação

### 4.5 Preço de entrada alto sem trial

- Primeiro plano pago: **R$ 129/mês** (Starter, 100 créditos)
- Sem trial de 7/14 dias, sem plano intermediário de entrada (ex. R$ 49)
- Cancelamento via WhatsApp com suporte — pode transmitir fricção, mas não explica zero tentativas

### 4.6 Landing → cadastro, não → valor

- Botões de “Planos/Assinar” na landing levam ao **signup**, não mostram checkout
- Usuário precisa: cadastrar → onboarding → usar → esgotar créditos → ir em Planos → pagar (muitos passos)

### 4.7 Aquisição sem conversão

- Afiliados geram cliques (772) mas quase não convertem em cadastro (4) e **nunca em pagamento**
- Pico de cadastros em abril (+35) não se traduziu em receita — provável campanha/tráfego sem fit

### 4.8 O que NÃO é o problema

- Containers e banco saudáveis
- MercadoPago e Stripe configurados
- API de billing implementada e testável
- Créditos rastreados corretamente no **workspace** (API `/user/me` expõe `workspace.leadsUsed`)

---

## 5. Propostas de melhoria (priorizadas)

### 🔴 Prioridade 1 — Quick wins (1–2 semanas)

| # | Ação | Impacto esperado |
|---|------|------------------|
| 1 | **Contatar os 3 usuários que esgotaram créditos** (evandro.martins@embracon.com.br, tanaaaa_@hotmail.com, vasques.innexar@gmail.com) — oferta personalizada 7 dias PRO | Conversão imediata possível |
| 2 | **E-mail automático ao atingir 80% e 100% dos créditos** com CTA para `/dashboard/planos` | Ativa paywall para os 62 workspaces com uso |
| 3 | **Aumentar cota Resend** ou implementar fila — 94 e-mails transacionais falharam por quota diária | Recupera confiança e onboarding |
| 4 | **Banner persistente** no dashboard quando `leadsUsed >= 8` (80% do free) com preço Starter e benefício | Pressão suave antes do bloqueio |
| 5 | **Tour guiado** até primeira análise IA (só 23% chegam lá) | Aumenta percepção de valor |

### 🟠 Prioridade 2 — Funil de produto (2–4 semanas)

| # | Ação | Detalhe |
|---|------|---------|
| 6 | **Trial 7 dias do plano PRO** no cadastro (cartão ou sem cartão) | Reduz barreira dos R$ 129 iniciais |
| 7 | **Ajustar plano free**: 10 → 15 créditos OU 10 buscas + 3 análises IA grátis | Força experimentar o diferencial IA |
| 8 | **Plano de entrada** (~R$ 49–79/mês, 50 créditos) | Preço psicológico mais acessível no BR |
| 9 | **Onboarding com “busca mágica”** — primeira busca automática com dados do perfil | Reduz os 37% que nunca buscam |
| 10 | **Reengajamento D+1, D+3, D+7** para quem cadastrou e não buscou (32 usuários) | Ativação |
| 11 | **Página pública de preços** com comparativo (hoje redireciona só para signup) | Transparência pré-cadastro |

### 🟡 Prioridade 3 — Métricas e growth (1–2 meses)

| # | Ação | Detalhe |
|---|------|---------|
| 12 | **Eventos de funil no GA4**: `signup`, `onboarding_complete`, `first_search`, `first_analysis`, `credit_80pct`, `checkout_started`, `payment_success` | Hoje não há visibilidade de onde o funil quebra |
| 13 | **Dashboard admin de conversão** (cadastros → ativos → limite → checkout → pago) | Decisões baseadas em dados |
| 14 | **Revisar programa de afiliados** — 772 cliques / 4 cadastros = landing ou tracking com problema | CAC alto, ROI zero |
| 15 | **Campanhas de e-mail**: ativar os 12 rascunhos (reengajamento FREE, feature PRO) | 6 campanhas enviadas é pouco para 87 usuários |
| 16 | **Case studies na landing** — mostrar resultado real (lead → análise → venda) | Prova social |

### 🟢 Prioridade 4 — Produto e retenção

| # | Ação | Detalhe |
|---|------|---------|
| 17 | **Notificação push** quando análise IA termina (já existe infra de push) | Traz usuário de volta |
| 18 | **Relatório semanal** ativado (`WeeklyReportConfig` está `enabled: false`) | Reengajamento recorrente |
| 19 | **WhatsApp de suporte proativo** para usuários com 5+ buscas e plano FREE | Venda consultiva |
| 20 | **Bloquear concessão manual de SCALE** sem flag `isComp` — separar métricas reais de cortesias | Dados limpos para decisão |

---

## 6. Segmentos acionáveis agora

### 🎯 “Quentes” — esgotaram créditos (converter primeiro)

| E-mail | Uso | Limite |
|--------|-----|--------|
| evandro.martins@embracon.com.br | 11 | 10 |
| tanaaaa_@hotmail.com | 10 | 10 |
| vasques.innexar@gmail.com | 10 | 10 |

### 🎯 “Mornos” — usaram bastante, ainda no free

| E-mail | Buscas | Análises |
|--------|--------|----------|
| francineyvc@gmail.com | 104 | 104 |
| lericubatao@gmail.com | 60 | 60 |
| tanaaaa_@hotmail.com | 24 | 24 |
| flaviocama@gmail.com | — | 7 créditos ws |

### 🎯 “Frios” — cadastraram, nunca usaram (32 usuários)

Exemplos recentes: willconer@gmail.com, wagnermarcellus@gmail.com, contato@tellecomnet.com.br, filipealvesr@gmail.com

→ Campanha de ativação: “Sua primeira busca de leads em 2 minutos”

### 🎯 “Travados” — onboarding incompleto (11 reais)

viniciusecovias@gmail.com, milianemilianemachado@gmail.com, revendapecuaria@gmail.com, etc.

→ E-mail com link direto para retomar onboarding

---

## 7. Hipóteses para validar (A/B test)

1. **Trial 7d PRO** vs **desconto 50% primeiro mês** — qual converte mais no BR?
2. **10 créditos** vs **5 buscas + 5 análises IA** no free — qual gera mais upgrade?
3. **Preço Starter R$ 129** vs **R$ 79** — elasticidade de demanda
4. **Checkout na landing** (logado) vs **só no dashboard** — reduz fricção?

---

## 8. Comandos de validação

```bash
# Health dos serviços
curl -s https://precisionia.com.br/api/health

# Contagem rápida no banco
docker exec prospector-db psql -U prospector -d prospector_db -c \
  "SELECT COUNT(*) users, COUNT(*) FILTER (WHERE plan!='FREE') paid FROM \"User\";"

# Logs de billing (deve aparecer após primeira tentativa real)
docker logs prospector-backend 2>&1 | grep -iE 'checkout|MP Preference|MP PreApproval'
```

---

## 9. Próximo passo recomendado

**Esta semana:** implementar e-mail + banner de créditos (itens 2 e 4) e contatar manualmente os 3 usuários no limite. São mudanças de baixo esforço com os únicos usuários que já demonstraram intenção de uso além do free.

**Em paralelo:** ativar trial de 7 dias do PRO no cadastro — maior alavanca para sair de 0 vendas.

---

*Relatório gerado por análise direta do PostgreSQL (`prospector-db`), containers Docker e código do repositório prospector-ai.*
