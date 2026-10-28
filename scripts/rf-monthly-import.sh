#!/usr/bin/env bash
# Atualiza a base da Receita Federal (RfCompany) com o mês mais recente publicado.
# Seguro para rodar toda semana: o import sai sem fazer nada se o mês já foi importado.
# Roda num container descartável na rede do Docker (o .env usa o host interno prospector-db),
# com CPU/memória limitadas e prioridade baixa para não disputar com o app.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LOG=/var/log/prospector-rf-import.log

exec 9>/tmp/prospector-rf-import.lock
if ! flock -n 9; then
  echo "$(date '+%F %T') import já em execução — saindo" >> "$LOG"
  exit 0
fi

echo "=== $(date '+%F %T') início ===" >> "$LOG"
nice -n 15 docker run --rm \
  --name prospector-rf-import \
  --network prospector-ai_prospector-net \
  --env-file "$ROOT/.env" \
  --cpus 1.5 --memory 1g \
  -v "$ROOT:/repo" -w /repo/backend \
  node:20-alpine \
  sh -c 'apk add --no-cache unzip >/dev/null 2>&1; node scripts/import-rf-data.mjs' >> "$LOG" 2>&1 || {
    echo "$(date '+%F %T') import falhou (ver acima)" >> "$LOG"; exit 1; }
echo "=== $(date '+%F %T') fim ===" >> "$LOG"
