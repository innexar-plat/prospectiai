#!/usr/bin/env bash
set -euo pipefail
# Sobe a stack completa (frontend, admin, backend, redis, db) a partir da raiz do projeto
cd "$(dirname "$0")/../.." && docker compose up -d
