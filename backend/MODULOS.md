# Módulos e features (Prospector AI)

## Módulos do produto

Definidos em `src/lib/product-modules.ts`. **Ofertados:** MAPEAMENTO + INTELIGENCIA_LEADS em todos; PRO+ inclui ANALISE_CONCORRENCIA e ACAO_COMERCIAL; BUSINESS+ inclui INTELIGENCIA_MERCADO.

| Módulo | Descrição | Status backend |
|--------|-----------|-----------------|
| MAPEAMENTO | Busca por nicho/região, lista, histórico | done |
| INTELIGENCIA_LEADS | Score, classificação frio/morno/quente, potencial | partial |
| ACAO_COMERCIAL | Abordagem, e-mail pronto, WhatsApp, pitch | partial |
| ANALISE_CONCORRENCIA | Ranking por rating/reviews, gaps, presença digital | partial |
| INTELIGENCIA_MERCADO | Segmentos, maturidade digital, saturação | partial |

## APIs por área (backend)

- **Health:** GET /api/health
- **Auth:** register, session, forgot-password, reset-password, [...nextauth]
- **User:** me, profile
- **Onboarding:** complete
- **Search:** POST search, GET search/history
- **Analyze:** POST analyze
- **Competitors:** POST /api/competitors (ANALISE_CONCORRENCIA — PRO+)
- **Market Report:** POST /api/market-report (INTELIGENCIA_MERCADO — BUSINESS+)
- **Leads:** GET leads, PATCH leads/[id]
- **Details:** GET details?placeId=
- **Billing:** checkout, webhook, webhook/mercadopago, process-payment
- **Team:** members, invite, remove
- **Product:** GET product/modules
- **Sistema:** migrate-workspace
- **Admin:** stats, users, users/[id], workspaces, workspaces/[id], search-history, leads

## Diagramas

### Fluxo de Search (crítico)

```mermaid
sequenceDiagram
  participant C as Cliente
  participant R as Rota /api/search
  participant S as search.service
  participant Redis
  participant DB
  participant Google

  C->>R: POST { textQuery }
  R->>R: auth + Zod
  R->>S: runSearch()
  S->>Redis: getCached(key)
  alt cache hit
    Redis-->>S: places
    S-->>R: { places, fromCache: true }
  else cache miss
    S->>DB: lead.findMany (busca local)
    alt >= 5 leads
      S-->>R: { places, fromLocalDb: true }
    else
      S->>Google: textSearch()
      Google-->>S: places
      S->>DB: $transaction (usage + SearchHistory)
      S-->>R: { places, nextPageToken? }
    end
  end
  R-->>C: 200 + x-request-id
```

### Fluxo de Analyze (crítico)

```mermaid
sequenceDiagram
  participant C as Cliente
  participant R as Rota /api/analyze
  participant A as analyze.service
  participant DB
  participant Gemini

  C->>R: POST { placeId, name }
  R->>R: auth + rateLimit + Zod
  R->>A: runAnalyze()
  A->>DB: leadAnalysis.findFirst(placeId)
  alt análise já existe
    DB-->>A: existing
    A-->>R: análise em cache (não chama Gemini)
  else nova análise
    A->>DB: workspace.leadsUsed >= limit?
    A->>Gemini: analyzeLead()
    Gemini-->>A: score, summary, gaps...
    A->>DB: create/update LeadAnalysis + workspace
    A-->>R: análise
  end
  R-->>C: 200 + x-request-id
```

### Webhooks (billing)

```mermaid
flowchart LR
  subgraph Stripe
    S[Checkout Session] --> W1[POST /api/billing/webhook]
  end
  subgraph Mercado Pago
    MP[Notificação] --> W2[POST /api/billing/webhook/mercadopago]
  end
  W1 --> DB[(Prisma)]
  W2 --> DB
  DB --> Workspace[Workspace plan/limits]
```

- **Stripe:** evento `checkout.session.completed` → valida assinatura → atualiza workspace (plan, subscriptionId, currentPeriodEnd).
- **Mercado Pago:** query `topic` + `id` → valida token → busca pagamento → atualiza workspace. Ambos só atualizam após validação; erros são logados.

## Documentação

- **API.md** — Contrato completo das APIs (body, query, respostas e exemplos).
- **ADMIN.md** — APIs admin e ADMIN_EMAILS.
- **TESTING.md** — Testes, cobertura, meta 80%.
