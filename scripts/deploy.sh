#!/usr/bin/env bash
set -euo pipefail
# Deploy one-click: git pull → build → restart → health check → Telegram alert
cd "$(dirname "$0")/.."

STARTED=$(date +%s)

echo "🚀 [deploy] Iniciando deploy — $(date '+%Y-%m-%d %H:%M:%S')"

# 1. Pull latest code
echo "📥 [deploy] git pull..."
git pull --ff-only || { echo "❌ git pull falhou (conflito?)"; exit 1; }

# 2. Build images
echo "🔨 [deploy] docker compose build..."
docker compose build || { echo "❌ Build falhou"; exit 1; }

# 3. Restart only the application. The database, Redis and PgBouncer are never recreated by a normal
#    deploy (recreating Postgres took the site down and forced a crash recovery). To apply a change
#    to them on purpose: scripts/deploy.sh --infra (Postgres gets 2 min to shut down cleanly).
if [[ "${1:-}" == "--infra" ]]; then
  echo "♻️  [deploy] Recriando também banco e Redis (--infra)..."
  docker compose up -d --force-recreate --remove-orphans --timeout 120 || { echo "❌ Up falhou"; exit 1; }
else
  echo "♻️  [deploy] Recriando backend e frontend..."
  docker compose up -d --no-recreate db redis pgbouncer || { echo "❌ Up (infra) falhou"; exit 1; }
  # Frontend nginx resolves the backend at start, so it restarts after the backend is healthy.
  docker compose up -d --no-deps --force-recreate --wait --wait-timeout 180 backend || { echo "❌ Backend não ficou saudável"; docker compose logs --tail=30 backend; exit 1; }
  docker compose up -d --no-deps --force-recreate --wait --wait-timeout 120 frontend || { echo "❌ Frontend não ficou saudável"; exit 1; }
fi

# 4. Wait for health
echo "⏳ [deploy] Aguardando health check..."
for i in {1..30}; do
  STATUS=$(curl -sf http://localhost:3010/api/health 2>/dev/null | grep -o '"status":"ok"' || true)
  if [[ -n "$STATUS" ]]; then
    ELAPSED=$(( $(date +%s) - STARTED ))
    echo "✅ [deploy] Deploy concluído em ${ELAPSED}s"
    for c in prospector-db prospector-redis prospector-pgbouncer prospector-backend prospector-frontend; do
      docker inspect "$c" --format '   {{.Name}} no ar desde {{.State.StartedAt}}' || true
    done
    if docker logs prospector-db --since "$(( ELAPSED + 10 ))s" 2>&1 | grep -E "PANIC|not properly shut down"; then
      echo "⚠️  [deploy] O banco registrou falha durante o deploy"
    fi

    # Telegram alert (optional)
    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
      curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\": ${TELEGRAM_CHAT_ID}, \"text\": \"✅ Deploy concluído em ${ELAPSED}s\", \"disable_notification\": true}" >/dev/null 2>&1 || true
    fi
    exit 0
  fi
  sleep 2
done

echo "❌ [deploy] Health check timeout (60s)"
docker compose logs --tail=30 backend
exit 1
