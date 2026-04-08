#!/usr/bin/env bash
set -euo pipefail
# Build de todos os serviços (frontend, admin, backend) a partir da raiz do projeto
cd "$(dirname "$0")/../.." && docker compose build
