#!/usr/bin/env bash
set -euo pipefail

echo "== Health app (Next.js) =="
curl -fsS http://localhost:3010/api/health >/dev/null && echo "OK" || (echo "FAIL" && exit 1)

echo "== Backend root (200/307/308/404 accepted) =="
CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3010/ || true)
echo "$CODE" | grep -qE '^(200|307|308|404)$' && echo "OK ($CODE)" || (echo "FAIL ($CODE)" && exit 1)
echo "== Backend /pt (200/404 accepted) =="
CODE_PT=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3010/pt || true)
echo "$CODE_PT" | grep -qE '^(200|404)$' && echo "OK ($CODE_PT)" || (echo "FAIL ($CODE_PT)" && exit 1)

if [[ "${SKIP_US_HEALTH:-}" != "1" ]]; then
  echo "== Health US (public) =="
  US_URL="${US_HEALTH_URL:-https://precisionai.innexar.app/api/health}"
  curl -fsS "$US_URL" >/dev/null && echo "OK ($US_URL)" || (echo "FAIL ($US_URL)" && exit 1)
fi
