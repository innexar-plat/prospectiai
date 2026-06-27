# Manutenção Docker no host (Prospector AI)

## Cron semanal — prune de build e imagens

- **Script:** `/etc/cron.weekly/docker-prune-prospector` (executável, root)
- **Agendamento:** `cron.weekly` do sistema (tipicamente domingo)
- **Ações:** `docker builder prune -af`, `docker image prune -af`
- **Não executa:** `docker volume prune` (volumes de DB/Redis preservados)
- **Log:** mensagem via `logger` com tag `docker-prune-weekly: done`

Teste manual (cuidado: remove cache/imagens não usadas):

```bash
sudo /etc/cron.weekly/docker-prune-prospector
```

## Limite de logs dos containers (compose)

Opção **B** — apenas serviços Prospector em `docker-compose.yml` (não altera `/etc/docker/daemon.json` do host, que permanece com default global 10m/3).

Serviços `frontend`, `backend`, `redis`, `db`:

```yaml
logging:
  driver: json-file
  options:
    max-size: "50m"
    max-file: "3"
```

Alterações de `logging` exigem **recriar** o container:

```bash
cd /srv/innexar/production/prospector-ai
docker compose up -d --force-recreate frontend backend redis db
```

Validar compose: `docker compose config -q`
