# Deployment Policy

## Production Checklist

- [ ] Build passa? (`make build`)
- [ ] Lint ok?
- [ ] Tests passando? (`make test`)
- [ ] Docker compose funciona?
- [ ] Docs atualizadas?
- [ ] Security review feito?
- [ ] Changelog gerado?

## Estratégia

- Deploy gradual (canary) sempre que possível
- Blue-green para mudanças grandes
- Zero downtime migration para banco
- Rollback plan documentado

## Make Targets

- `make build` — docker compose build
- `make up` — sobe stack
- `make down` — derruba
- `make deploy` — pull → build → restart → health → Telegram
- `make health` — health check
