# Relatório de Alterações — Landing Page, Pricing e Integração Representante

## 1. Landing Page BR (`frontend/src/components/landing/LandingPage.tsx`)

### Hero Section
- **Subtítulo**: Substituído "Teste com 10 créditos grátis e dados de 27 milhões..." por descrição sem free/trial: "Acesse dados de 27 milhões de empresas brasileiras com análise de concorrência, viabilidade de negócio e scripts de abordagem prontos."
- **Pills (tags)**: Trocado "10 créditos grátis" → "Score IA por lead", "Sem cartão" → "Análise de concorrência"
- **Preço abaixo do CTA**: "A partir de $19/mês · Sem cartão de crédito" → "A partir de **R$ 97/mês** · Cancele quando quiser"
- **Subtitle hero**: "Pare de perder tempo. Comece agora." → "Prospecção inteligente com IA."
- **CTA hero**: Usa `t('landing.ctaHero')` que agora traduz "Começar agora" (pt), "Get started" (en), "Empezar ahora" (es)

### Schema.org
- **Removido**: Objeto `softwareAppSchema` (que tinha `lowPrice: '0'`) e sua tag `<script>` — eliminada referência a preço zero no schema estruturado.

### Grid de Planos
- **Free removido**: Grade alterada de `grid-cols-5` para `grid-cols-4` (max-w-4xl mx-auto)
- **Planos**: Free removido, Starter de R$ 129 → R$ 97/mês
- Grid final: Starter (R$ 97), Growth (R$ 397, destaque), Business (R$ 997), Enterprise (R$ 2.497)

### Seção CTA Meio
- **Subtítulo**: "Comece grátis. 5 análises completas. Sem cartão de crédito." → "Descubra empresas, qualifique leads e feche mais negócios com IA."
- **CTA**: "Criar conta grátis" → "Criar conta"

### Seção CTA Final (roxo)
- **CTA**: "Começar agora — é grátis" → "Começar agora"
- **Sub-texto**: "5 análises grátis · Sem cartão · Setup em 30 segundos" → "Starter a partir de R$ 97/mês · Cancele quando quiser"

### FAQ
- Pergunta "Preciso de cartão de crédito para testar?" substituída por "Qual plano devo escolher para começar?"
- Resposta alterada de "O plano gratuito oferece 10 créditos/mês sem cartão..." para "O plano Starter a partir de R$ 97/mês é ideal para começar..."

---

## 2. Pricing Page (`frontend/src/pages/public/PricingPage.tsx`)

### Badge de Trial Removido
- Bloco condicional `{isTrialEnabled() ? (... trial badge ...) : (...)}` substituído por sempre mostrar o starter badge verde
- Badge exibe: `{t('pricing.starterBadge')} — $19 · 50 {t('pricing.creditsMonth')}`

### CTA Button
- `{isTrialEnabled() ? t('pricing.ctaTrial') : t('pricing.ctaSubscribe')}` → sempre `{t('pricing.ctaSubscribe')}` ("Assinar agora")

### Imports Limpos
- `isTrialEnabled` removido do import de `@/lib/market`
- `Sparkles` removido do import de `lucide-react`

---

## 3. Traduções (`frontend/src/lib/i18n/landing-messages.ts`)

### pt (Português)
| Chave | Antes | Depois |
|-------|-------|--------|
| `landing.ctaHero` | "Começar grátis" | "Começar agora" |
| `landing.ctaStart` | "Começar trial de 7 dias" | "Começar agora" |
| `landing.ctaMidSub` | "Crie sua conta em 2 minutos e comece o trial de 7 dias com 50 créditos." | "Crie sua conta em 2 minutos e comece a buscar leads com IA." |
| `landing.plansSubtitle` | "7 dias de trial com 50 créditos..." | "Planos a partir de R$ 97/mês. Todos incluem score IA..." |
| `landing.planFree` | "Trial — 7 dias, 50 créditos" | removido |
| `trial.expiredTitle` | "Seu trial de 7 dias encerrou" | "Seu período de acesso encerrou" |
| `trial.activeTitle` | mantido (usado pelo TrialBanner) | mantido |
| `pricing.ctaTrial` | "Começar trial grátis" | "Começar agora" |
| `pricing.trialBadge` | "Trial {days} dias · {credits} créditos grátis" | "Starter · {credits} créditos/mês" |
| `pricing.subtitle` | "Preços acessíveis... Comece com trial completo." | "Preços acessíveis... Planos a partir de R$ 97/mês." |

### en (English)
| Chave | Antes | Depois |
|-------|-------|--------|
| `landing.ctaHero` | "Start free" | "Get started" |
| `landing.ctaStart` | "Start 7-day trial" | "Get started" |
| `landing.ctaMidSub` | "start your 7-day trial with 50 credits" | "start searching for leads with AI" |
| `landing.plansSubtitle` | "7-day trial with 50 credits..." | "Plans from $19/mo. All include AI score..." |
| `landing.planFree` | "Trial — 7 days, 50 credits" | removido |
| `trial.expiredTitle` | "Your 7-day trial has ended" | "Your access period has ended" |
| `pricing.ctaTrial` | "Start free trial" | "Get started" |
| `pricing.trialBadge` | "{days}-day trial · {credits} free credits" | "Starter · {credits} credits/month" |
| `pricing.subtitle` | "Starter plan: $19/month with 50 credits." | "Plans from $19/month." |

### es (Español)
| Chave | Antes | Depois |
|-------|-------|--------|
| `landing.ctaHero` | "Empezar gratis" | "Empezar ahora" |
| `landing.ctaStart` | "Empezar trial de 7 días" | "Empezar ahora" |
| `landing.ctaMidSub` | "empieza el trial de 7 días con 50 créditos" | "empieza a buscar leads con IA" |
| `landing.plansSubtitle` | "Trial de 7 días con 50 créditos..." | "Planes desde $19/mes. Todos incluyen score IA..." |
| `landing.planFree` | "Trial — 7 días, 50 créditos" | removido |
| `trial.expiredTitle` | "Tu trial de 7 días terminó" | "Tu período de acceso terminó" |
| `pricing.ctaTrial` | "Empezar trial gratis" | "Empezar ahora" |
| `pricing.trialBadge` | "Trial {days} días · {credits} créditos gratis" | "Starter · {credits} créditos/mes" |

**Obs**: Keys `trial.activeTitle` e `trial.activeDesc` foram preservadas nos 3 locales (usadas pelo `TrialBanner.tsx` no dashboard).

---

## 4. Integração Representante via URL (`frontend/src/lib/affiliate-ref.ts`)

### Novas Funções
- **`setRepCode(code: string)`**: Salva cookie `rep_code` com 30 dias de validade, uppercase, máximo 50 caracteres
- **`getRepCode(): string | null`**: Lê o cookie `rep_code`
- **`clearRepCode()`**: Remove o cookie `rep_code`
- **`captureRepFromUrl()`**: Lê `?rep=` da URL e persiste via `setRepCode`

### Funções Existentes
- `getAffiliateRef`: Corrigido type safety (`match?.[1]` com optional chaining, previnindo `undefined`)
- Demais funções mantidas idênticas

---

## 5. Landing Entry Point (`frontend/src/pages/public/Landing.tsx`)

- **Import**: Adicionado `captureRepFromUrl` junto com `captureRefFromUrl`
- **useEffect**: `captureRepFromUrl()` chamado no mount da página pública, ao lado de `captureRefFromUrl()`
- Agora ambas as URLs funcionam simultaneamente: `?ref=CODE` (afiliado) e `?rep=CODE` (representante)

---

## 6. TypeScript — Correções em `affiliate-ref.ts`

- Linha 20: `match ? decodeURIComponent(match[1])` → `match?.[1] ? decodeURIComponent(match[1])` (elimina TS2345)
- Linha 53: idem para `getRepCode`

### Resultado do Typecheck
- **0 erros novos** introduzidos nos arquivos modificados
- Apenas 2 erros pré-existentes em `affiliate-ref.test.ts` (arquivo de teste não modificado)
- 96 erros pré-existentes no restante do códigobase não relacionados a estas alterações
