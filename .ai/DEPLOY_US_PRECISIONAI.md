# Deploy US — precisionai.innexar.app

## Configuração

O domínio `precisionai.innexar.app` está no `docker-compose.yml` principal (mesmo stack que `precisionia.com.br`). O mercado é detectado pelo **hostname** (backend + frontend).

```bash
docker compose up -d --build
```

Para staging US-only (env `MARKET=US` global):

```bash
docker compose -f docker-compose.yml -f docker-compose.us.yml up -d --build
```

## Variáveis principais

| Variável | Valor US |
|----------|----------|
| `MARKET` | `US` |
| `VITE_MARKET` | `US` |
| `NEXT_PUBLIC_APP_URL` | `https://precisionai.innexar.app` |
| Domínio Traefik | `precisionai.innexar.app` |

## Diferenças vs BR

- **Sem trial** — cadastro cria conta FREE inativa (0 créditos)
- **Starter** — $19/mês · **50 créditos**
- Checkout Stripe USD
- Landing de conversão (`LandingConversion.tsx`)
- Idiomas: pt / en / es (detecção via navegador + `Accept-Language`)
- Módulos BR desativados (CNAE, RF, auto-prospecção, Mercado Pago)

## Fluxo US

1. Landing → CTA "Get started $19/mo"
2. Cadastro → onboarding
3. Redirect para `/dashboard/planos` (assinatura obrigatória)
4. Após pagamento → 50 créditos/mês
