# Estratégia USA — Precision IA

**Data:** 25/06/2026  
**Pergunta:** Adaptar o projeto atual ou subir sistema dedicado só para EUA?

---

## Recomendação executiva

**Usar o mesmo projeto (monorepo), com configuração de mercado (`MARKET=BR` | `MARKET=US`) e dois deploys Docker** (domínios diferentes, env diferentes).

Não forkar o repositório. Não reescrever do zero. O núcleo de busca Google Places **já suporta EUA**; o que falta é UX, defaults, dados enriquecidos e i18n — não uma arquitetura nova.

| Abordagem | Veredito |
|-----------|----------|
| **Mesmo código + 2 deploys** | ✅ Recomendado |
| Fork / repo separado | ❌ Duplica manutenção |
| Microserviço só de busca US | ❌ Over-engineering nesta fase |
| Um deploy multi-país sem config | ⚠️ Confunde UX (CNAE, RF, PT default) |

---

## O que já funciona para EUA (hoje)

| Área | Status | Evidência no código |
|------|--------|---------------------|
| Busca Google Places | ✅ | `resolveCountryLocale()` → `US` + `en`; testes em `search-service.test.ts` |
| Lista de estados US | ✅ | `US_STATES` em `locationData.ts` (50 estados + DC) |
| Seletor de país | ✅ | `US` na lista de países |
| Filtros globais | ✅ | `hasWebsite`, `hasPhone`, raio km, `includedType` (Google types) |
| Billing USD | ✅ | Checkout Stripe quando `locale !== 'pt'` |
| i18n landing | ✅ Parcial | `i18n.ts` tem bloco `en`; toggle PT/EN no header |
| Geocoding | ✅ | Usa `country-locale` por país |

**Conclusão:** Um usuário US *consegue* buscar empresas hoje se mudar país manualmente para "Estados Unidos" — mas a experiência está claramente desenhada para Brasil.

---

## O que NÃO funciona / é só Brasil

| Área | Impacto US | Detalhe |
|------|------------|---------|
| **Default país** | Alto | `DEFAULT_SEARCH_VALUES.country = 'BR'` em todo dashboard |
| **Autocomplete de cidade** | Alto | API `/location/cities` só IBGE; US retorna `[]` |
| **Templates de nicho** | Alto | `DashboardIndex` — 50+ categorias com CNAE brasileiro |
| **Filtro CNAE** | Alto | Campo e busca RF cruzada são Receita Federal |
| **Cruzamento RF** | Alto | `SEARCH_RF_CROSS` merge Google + 27M empresas BR |
| **Análise IA profunda** | Alto | Reclame Aqui, JusBrasil, CNPJ nos prompts (`gemini.ts`) |
| **Auto-prospecção** | Total | Módulo inteiro em `RfCompany` |
| **SEO local** | Total | 42 páginas BR (São Paulo, Praia Grande, etc.) |
| **MercadoPago** | N/A US | Só BRL; US usa Stripe |
| **UI do dashboard** | Médio | ~80% strings hardcoded em PT |
| **WhatsApp IA** | Médio | Contexto BR; US usa SMS/email/call scripts |
| **Empresa perfil** | Médio | CNPJ, CNAE no onboarding/perfil |
| **Integrações CRM BR** | Baixo | RD Station, Agendor são BR; HubSpot funciona global |

---

## Comparativo: mesmo sistema vs dedicado

### Opção A — Mesmo código, 2 deploys (recomendado)

```
precisionia.com.br          precisionia.com (ou .us)
     │                              │
     ├─ MARKET=BR                   ├─ MARKET=US
     ├─ DEFAULT_LOCALE=pt           ├─ DEFAULT_LOCALE=en
     ├─ MercadoPago + Stripe        ├─ Stripe only
     ├─ RF + CNAE ON                ├─ RF + CNAE OFF
     └─ Postgres BR (ou shared)      └─ Postgres US (recomendado separar)
```

**Prós**
- Um time, um PR, features compartilhadas (busca, IA, billing core)
- Correções de bug beneficiam ambos mercados
- Stripe/USD já implementado
- Time to market: 3–5 semanas para MVP US

**Contras**
- Código com `if (market === 'US')` em alguns pontos (controlável com `lib/market.ts`)
- Testes precisam cobrir 2 mercados
- i18n do dashboard é trabalho contínuo

**Custo infra:** ~igual a 1 deploy extra (frontend + backend + db), ~$50–150/mês dependendo do host.

---

### Opção B — Sistema dedicado (fork ou repo novo)

**Prós**
- UX 100% US sem compromissos
- DB e compliance isolados desde o dia 1
- Branding independente (ex: "Precision AI" vs "Precision IA")

**Contras**
- **2x** manutenção de busca, IA, billing, auth, CRM
- Bugs corrigidos em um não vão para o outro
- Features novas (trial, funnel) precisam ser portadas manualmente
- Custo de engenharia 2–3x maior no primeiro ano

**Quando faz sentido:** receita US > 50% da receita, equipe separada, ou requisito legal de dados 100% em território US.

---

### Opção C — Um deploy, multi-país na mesma URL

**Não recomendado agora.** Usuário US veria CNAE, templates em português, defaults BR. Gera confusão e baixa conversão — mesmo problema atual.

---

## Arquitetura proposta (Opção A)

### 1. Camada de mercado (`lib/market.ts`)

```typescript
export type Market = 'BR' | 'US';

export const MARKET = (process.env.MARKET ?? 'BR') as Market;

export const marketConfig = {
  BR: {
    defaultCountry: 'BR',
    defaultLocale: 'pt',
    currency: 'BRL',
    paymentProviders: ['mercadopago', 'stripe'],
    features: { rfSearch: true, cnae: true, autoProspeccao: true, reclameAqui: true },
  },
  US: {
    defaultCountry: 'US',
    defaultLocale: 'en',
    currency: 'USD',
    paymentProviders: ['stripe'],
    features: { rfSearch: false, cnae: false, autoProspeccao: false, reclameAqui: false },
  },
};
```

Frontend espelha via `VITE_MARKET`.

### 2. Busca US — mudanças necessárias

| Componente | Mudança |
|------------|---------|
| `DEFAULT_SEARCH_VALUES` | `country: marketConfig.defaultCountry` |
| `DashboardIndex` templates | Arquivo `searchTemplates.us.ts` (Google types + niches EN, sem CNAE) |
| `CnaeAutocomplete` | Ocultar quando `!features.cnae` |
| `/location/cities` | US: Google Places Autocomplete ou GeoNames/US Census API |
| `search.service.ts` | Já ignora RF quando `!isBrazilCountry()` ✅ |
| `LocationFields` | Placeholder EN, city free-text ou autocomplete US |

### 3. Análise IA US

Substituir no prompt (quando `MARKET=US`):
- Reclame Aqui → **BBB (Better Business Bureau)**
- JusBrasil → **state court records / public filings**
- CNPJ → **EIN / state business registry**

Manter: Google reviews, website scrape, Serper web search.

### 4. Billing US

Já existe fluxo Stripe em `checkout/route.ts` para `locale !== 'pt'`.

Ajustes:
- PlanosPage detecta mercado → mostra USD
- Preços US podem ser diferentes (mercado mais competitivo: ex. $29 / $79 / $199)
- Trial 7 dias igual

### 5. Deploy

```yaml
# docker-compose.usa.yml (override)
services:
  frontend:
    environment:
      - VITE_MARKET=US
      - VITE_DEFAULT_LOCALE=en
    labels:
      - traefik.http.routers.precision-usa.rule=Host(`precisionia.com`)
  backend:
    environment:
      - MARKET=US
      - FRONTEND_URL=https://precisionia.com
```

Banco: **Postgres separado** para US (LGPD/GDPR/CCPA mais simples, backups independentes).

---

## Roadmap sugerido

### Fase 1 — MVP US (3 semanas)

| Semana | Entrega |
|--------|---------|
| 1 | `lib/market.ts`, env, defaults US, esconder CNAE/RF/auto-prospecção |
| 1 | Templates de busca US (20 nichos em inglês) |
| 2 | Cidade US via Google Places Autocomplete |
| 2 | i18n dashboard: busca, resultados, planos, trial banner |
| 3 | Prompts IA US + deploy `precisionia.com` + landing EN |

**MVP US = buscar → listar → analisar lead → pagar (Stripe).** Sem auto-prospecção, sem RF, sem CNAE.

### Fase 2 — Enriquecimento (4–6 semanas)

- NAICS como filtro opcional (equivalente CNAE)
- OpenCorporates / state SOS para dados de empresa US
- SEO US (cidades: Austin, Miami, NYC…)
- Integrações: HubSpot, Salesforce

### Fase 3 — Paridade (se tração)

- Auto-outreach US (email sequences, não WhatsApp)
- Inteligência de mercado US
- Equipe / multi-seat

---

## Preços sugeridos US (referência)

Mercado US de sales intelligence é mais caro (Apollo, ZoomInfo). Posicionamento entry-level:

| Plano | USD/mês | Créditos |
|-------|---------|----------|
| Starter | $29 | 100 |
| Growth | $79 | 400 |
| Business | $199 | 1.200 |
| Enterprise | $499 | 5.000 |

Trial 7 dias com features Growth (igual BR).

---

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Google Places cobertura US vs RF BR | US depende só do Google — qualidade ok para SMB local |
| TCPA / CAN-SPAM em outreach | Disclaimers + não auto-enviar SMS sem opt-in |
| Concorrência (Apollo, Seamless) | Foco em **local SMB + IA de abordagem**, não base de dados gigante |
| i18n incompleto | Lançar US só nas telas do funil core; resto em inglês progressivo |
| Dois deploys = 2x ops | Mesmo compose, profiles Docker, CI matrix |

---

## Decisão

| Critério | Mesmo projeto | Sistema dedicado |
|----------|---------------|------------------|
| Time to market | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Custo engenharia | ⭐⭐⭐⭐ | ⭐⭐ |
| UX US nativa | ⭐⭐⭐ (fase 1) → ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Manutenção longo prazo | ⭐⭐⭐⭐ | ⭐⭐ |
| Isolamento dados | ⭐⭐⭐ (DB separado) | ⭐⭐⭐⭐⭐ |

**Veredito: mesmo projeto + deploy US dedicado + `MARKET` config.**

---

## Próximo passo concreto

1. Criar `lib/market.ts` (backend + frontend)
2. Branch `feat/market-us` com defaults e feature flags
3. Subdomínio/domínio US no Traefik
4. Validar busca end-to-end: "dentists in Miami FL" → resultados → análise IA em inglês

Estimativa MVP navegável: **~15–20 arquivos**, 3 semanas.
