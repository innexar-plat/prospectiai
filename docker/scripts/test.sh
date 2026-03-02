#!/usr/bin/env bash
set -euo pipefail
# Run tests on host with only DB in Docker (no app image build)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

docker compose -f docker/docker-compose.yml up -d db
timeout 60 bash -c 'until docker compose -f docker/docker-compose.yml exec -T db pg_isready -U app -d app; do sleep 2; done'

export DATABASE_URL="${DATABASE_URL:-postgres://app:app@localhost:5433/app}"

(cd backend && npx prisma generate && npm run test)
npm run test -w frontend
npm run test -w admin
