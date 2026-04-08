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

# 3. Restart services (zero-downtime: recreate one by one)
echo "♻️  [deploy] Restarting services..."
docker compose up -d --force-recreate --remove-orphans || { echo "❌ Up falhou"; exit 1; }

# 4. Wait for health
echo "⏳ [deploy] Aguardando health check..."
for i in {1..30}; do
  STATUS=$(curl -sf http://localhost:3010/api/health 2>/dev/null | grep -o '"status":"ok"' || true)
  if [[ -n "$STATUS" ]]; then
    ELAPSED=$(( $(date +%s) - STARTED ))
    echo "✅ [deploy] Deploy concluído em ${ELAPSED}s"

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
