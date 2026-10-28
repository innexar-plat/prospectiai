#!/usr/bin/env bash
set -euo pipefail

# ── Database Backup Script ────────────────────────────────────────────────────
# Creates compressed PostgreSQL backups with configurable retention.
# Sends Telegram alerts on success/failure.
# Usage: ./scripts/backup-db.sh
# Intended to run via cron:
#   0 3 * * * cd /opt/prospector-ai && ./scripts/backup-db.sh >> /var/log/prospector-backup.log 2>&1

BACKUP_DIR="${BACKUP_DIR:-/opt/prospector-ai/backups}"
# RfCompany rows are excluded (public Receita data, re-importable via rf-monthly-import.sh).
RETENTION_DAYS="${RETENTION_DAYS:-7}"
CONTAINER_NAME="${DB_CONTAINER:-prospector-db}"
DB_NAME="${POSTGRES_DB:-prospector_db}"
DB_USER="${POSTGRES_USER:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/prospector_${TIMESTAMP}.sql.gz"

# Read only the keys we need from .env — sourcing it breaks on values like "Name <a@b.c>".
ENV_FILE="$(dirname "$0")/../.env"
env_get() {
    [[ -f "$ENV_FILE" ]] || return 0
    grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}
DB_USER="${POSTGRES_USER:-$(env_get POSTGRES_USER)}"
DB_NAME="${POSTGRES_DB:-$(env_get POSTGRES_DB)}"
DB_NAME="${DB_NAME:-prospector_db}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-$(env_get TELEGRAM_BOT_TOKEN)}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-$(env_get TELEGRAM_CHAT_ID)}"

# ── Telegram alert helper ─────────────────────────────────────────────────────
send_telegram() {
    local emoji="$1" title="$2" body="$3"
    local token="${TELEGRAM_BOT_TOKEN:-}"
    local chat="${TELEGRAM_CHAT_ID:-}"
    [[ -z "$token" || -z "$chat" ]] && return 0
    local text="${emoji} *${title}*%0A%0A${body}%0A%0A🕐 $(date -Iseconds)%0A🏷 PrecisionAI"
    curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" \
        -d "chat_id=${chat}" \
        -d "text=${text}" \
        -d "parse_mode=Markdown" \
        -d "disable_web_page_preview=true" > /dev/null 2>&1 || true
}

if [[ -z "$DB_USER" ]]; then
    echo "[ERROR] POSTGRES_USER not set. Export it or add to .env"
    send_telegram "🔴" "Backup FALHOU" "POSTGRES_USER não configurado"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup → ${BACKUP_FILE}"

if ! docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --exclude-table-data='"RfCompany"' | gzip > "$BACKUP_FILE"; then
    echo "[ERROR] pg_dump failed"
    rm -f "$BACKUP_FILE"
    send_telegram "🔴" "Backup FALHOU" "pg_dump retornou erro para ${DB_NAME}"
    exit 1
fi

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup completed: ${BACKUP_FILE} (${SIZE})"

# Prune old backups
DELETED=0
while IFS= read -r old; do
    rm -f "$old"
    DELETED=$((DELETED + 1))
done < <(find "$BACKUP_DIR" -name "prospector_*.sql.gz" -mtime +"$RETENTION_DAYS" -type f 2>/dev/null)

if [[ $DELETED -gt 0 ]]; then
    echo "[$(date -Iseconds)] Pruned ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
fi

echo "[$(date -Iseconds)] Done. Backups in ${BACKUP_DIR}:"
ls -lh "$BACKUP_DIR"/prospector_*.sql.gz 2>/dev/null | tail -5

TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "prospector_*.sql.gz" -type f 2>/dev/null | wc -l)
send_telegram "✅" "Backup OK" "Tamanho: ${SIZE}%0ABackups retidos: ${TOTAL_BACKUPS}%0ARetenção: ${RETENTION_DAYS} dias"
