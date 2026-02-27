#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:-}"
cd "$(dirname "$0")/../.."
if [ -z "$SERVICE" ]; then
  docker compose logs -f --tail=200
else
  docker compose logs -f --tail=200 "$SERVICE"
fi
