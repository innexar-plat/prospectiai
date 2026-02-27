#!/usr/bin/env bash
set -euo pipefail
# Run backend tests inside container (builder stage + db)
docker compose -f docker/docker-compose.yml --profile test run --rm test
