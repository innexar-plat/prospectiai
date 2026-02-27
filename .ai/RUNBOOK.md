# Runbook

## Subir ambiente
- `make up`
- `make health`

## Ver logs
- `make logs`
- `make logs SERVICE=backend` (ou `frontend`, `admin`, `db`, `redis`)

## Variáveis de ambiente
- Lista completa em **`.env.example`** na raiz do repositório.
- Principais: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`.
- Billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e/ou `MERCADOPAGO_ACCESS_TOKEN`.
- Cron de billing: `BILLING_CRON_SECRET` (ver seção abaixo).
- Nunca commitar valores reais; usar `.env` local ou secrets do ambiente de deploy.

## Cron apply-pending-plans (produção)
Quando o billing usa Mercado Pago, planos pendentes (downgrade/upgrade agendados) são aplicados por um job que deve ser chamado periodicamente em produção.

- **Endpoint:** `POST /api/billing/apply-pending-plans`
- **Header obrigatório:** `x-cron-secret: <valor de BILLING_CRON_SECRET>`
- **Frequência sugerida:** a cada 5–15 minutos (ex.: cron ou agendador do provedor).
- **Configuração:** Garantir que `BILLING_CRON_SECRET` esteja definido no ambiente do backend e que o agendador use o mesmo valor no header. Sem esse header, o endpoint retorna 401.

## Problemas comuns
### API não sobe
- Veja logs: `make logs SERVICE=backend`
- Confirme env vars no compose (e `.env` na raiz)
- Confirme conexão com db: `make logs SERVICE=db`

### Banco não inicializa
- Ver logs: `make logs SERVICE=db`
- Ver volume e migrations

## SonarQube
- **URL:** https://sonar.innexar.com.br (apontar DNS para o mesmo host do Traefik).
- **Subir:** `make sonar-up` (ou `docker compose -f docker/sonar-compose.yml up -d`). Requer rede `fixelo_fixelo-network`.
- **Parar:** `make sonar-down`
- **CI:** No GitHub, configurar secrets `SONAR_HOST_URL` (ex.: https://sonar.innexar.com.br) e `SONAR_TOKEN` (token gerado no SonarQube: My Account → Security → Generate Token). No primeiro acesso ao SonarQube, criar o projeto com key `Prospector-AI` (igual a `sonar.projectKey` em `sonar-project.properties`).
- **Permissão "Execute Analysis":** Se o CI falhar com "You're not authorized to run analysis", no SonarQube vá em **Project** → **Prospector AI** → **Project Settings** → **Permissions** e conceda **Execute Analysis** ao usuário dono do token (ou ao grupo em que ele está).
