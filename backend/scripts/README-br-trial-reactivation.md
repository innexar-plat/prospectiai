# BR trial reactivation promo — runbook

Campanha de e-mail para usuários **BR** com trial expirado, oferecendo o plano Starter promocional (**R$ 59/mês** nos primeiros **6 meses**, plano `STARTER_PROMO_BR` / `promo=reactivation`).

## Pré-requisitos

- `DATABASE_URL` apontando para o banco de produção ou staging
- Provedor de e-mail configurado (Resend ou SMTP no painel admin / env)
- `AUTH_SECRET` definido (para links assinados `checkout?promo=reactivation&token=...`)
- Migração aplicada: coluna `Workspace.reactivationPromoSentAt`

## Quem recebe

Workspace **OWNER** com:

| Critério | Detalhe |
|----------|---------|
| Trial expirado | `plan=TRIAL` + (`subscriptionStatus=trial_expired` OU `currentPeriodEnd < now`) |
| FREE pós-trial | `plan=FREE` + `subscriptionStatus=trial_expired` |
| Mercado | BR (`classifyWorkspaceMarket`) |
| Sem assinatura paga | sem plano BASIC/PRO/BUSINESS/SCALE ativo |
| Ainda não enviado | `reactivationPromoSentAt` é `null` |
| Usuário | e-mail válido, `notifyByEmail=true`, conta não desabilitada |
| Opt-out | sem registro em `EmailUnsubscribe` (MARKETING/PROMOTIONS/ALL) |

Ao enviar com sucesso, o workspace recebe `reactivationPromoSentAt`, `starterPromoEligible=true` e `starterPromoCode=reactivation`.

## Execução manual (recomendado antes do cron)

### 1. Contar elegíveis (padrão — dry-run)

```bash
cd /srv/innexar/production/prospector-ai
npx tsx backend/scripts/send-br-trial-reactivation.ts
```

Saída esperada: `eligible recipients: N`

### 2. Listar destinatários

```bash
npx tsx backend/scripts/send-br-trial-reactivation.ts --verbose
```

### 3. Envio piloto (ex.: 5 usuários)

```bash
npx tsx backend/scripts/send-br-trial-reactivation.ts --send --limit=5
```

### 4. Envio completo

```bash
npx tsx backend/scripts/send-br-trial-reactivation.ts --send
```

## Docker (produção)

```bash
docker compose exec backend npx tsx scripts/send-br-trial-reactivation.ts
docker compose exec backend npx tsx scripts/send-br-trial-reactivation.ts --send --limit=10
```

## Cron HTTP (GitHub Actions ou curl)

Endpoint: `POST /api/cron/br-trial-reactivation`

- **Dry-run (padrão):** sem query params — retorna `{ eligible, sent: 0 }`
- **Enviar:** `?send=1` ou header `x-cron-send: 1`
- **Limite:** `?limit=50`

```bash
curl -sL -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BACKEND_URL/api/cron/br-trial-reactivation"
```

Workflow: `.github/workflows/br-trial-reactivation-cron.yml` (segundas 07:00 BRT, dry-run; use `workflow_dispatch` com `send=true` para enviar).

## Link da promo no e-mail

- Checkout: `https://precisionia.com.br/checkout?promo=reactivation`
- Com token assinado quando `AUTH_SECRET` está disponível
- Plano virtual: `STARTER_PROMO_BR` → BASIC com preço promocional no Mercado Pago

## Arquivos relacionados

| Arquivo | Função |
|---------|--------|
| `backend/scripts/send-br-trial-reactivation.ts` | CLI (dry-run padrão) |
| `backend/src/lib/br-trial-reactivation.ts` | Orquestração envio + DB |
| `backend/src/lib/reactivation-promo-audience.ts` | Query de elegíveis |
| `backend/src/lib/reactivation-promo-email.ts` | Template HTML |
| `backend/src/lib/billing-promo.ts` | `STARTER_PROMO_BR`, token |

## Validação

```bash
cd backend && npm run test -- --testPathPattern="reactivation-promo|br-trial"
cd backend && npm run build
```
