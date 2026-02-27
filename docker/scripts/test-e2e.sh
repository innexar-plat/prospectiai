#!/usr/bin/env bash
set -euo pipefail
# E2E Playwright: stack deve estar up. Roda testes contra E2E_BASE_URL (default: frontend 5173).
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:5173}"
BACKEND_HEALTH="${BACKEND_HEALTH_URL:-http://localhost:3010/api/health}"

echo "== E2E: checking backend health at $BACKEND_HEALTH =="
if ! curl -sf "$BACKEND_HEALTH" > /dev/null; then
  echo "Backend not healthy. Run: make up && make health"
  exit 1
fi

echo "== E2E: running Playwright (E2E_BASE_URL=$E2E_BASE_URL) =="
(cd backend && E2E_BASE_URL="$E2E_BASE_URL" npx playwright test)
