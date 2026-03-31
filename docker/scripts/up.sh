#!/usr/bin/env bash
set -euo pipefail
# Sobe a stack completa (frontend nginx prod, backend, redis, db) a partir da raiz do projeto
# --remove-orphans: remove containers de serviços removidos do compose (ex.: admin dev antigo)
cd "$(dirname "$0")/../.." && docker compose up -d --remove-orphans
