#!/bin/sh
set -e
if command -v prisma >/dev/null 2>&1; then
    prisma migrate deploy --schema=/app/prisma/schema.prisma
fi
exec node backend/server.js
