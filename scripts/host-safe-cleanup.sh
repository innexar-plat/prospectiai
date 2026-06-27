#!/usr/bin/env bash
set -euo pipefail

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

echo "[$(date -Is)] host-safe-cleanup start"

if command -v docker >/dev/null 2>&1; then
  docker builder prune -af --filter 'until=168h' || true
fi

find /tmp -mindepth 1 -mtime +7 -exec rm -rf {} + 2>/dev/null || true
find /var/tmp -mindepth 1 -mtime +14 -exec rm -rf {} + 2>/dev/null || true

if command -v apt-get >/dev/null 2>&1; then
  apt-get clean || true
  rm -rf /var/cache/apt/archives/* /var/cache/apt/*.bin 2>/dev/null || true
fi

rm -rf /root/.npm/_npx /root/.npm/_cacache 2>/dev/null || true
find /root/.npm/_logs -type f -mtime +14 -delete 2>/dev/null || true

rm -rf /root/.cache/ms-playwright /root/.cache/ms-playwright-go 2>/dev/null || true
rm -rf /root/.cache/puppeteer /root/.cache/pip /root/.cache/pnpm 2>/dev/null || true
rm -rf /root/.local/share/pnpm/store /root/.local/share/pnpm/store/v3 2>/dev/null || true

echo "[$(date -Is)] host-safe-cleanup done"