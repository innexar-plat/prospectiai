#!/bin/sh
set -e

# Fail fast if required env vars are missing (production readiness)
if [ -z "$AUTH_SECRET" ]; then
    echo "FATAL: AUTH_SECRET is not set. Required for NextAuth in production."
    exit 1
fi
if [ -z "$DATABASE_URL" ]; then
    echo "FATAL: DATABASE_URL is not set."
    exit 1
fi
if [ -z "$NEXTAUTH_URL" ] && [ -z "$AUTH_URL" ]; then
    echo "FATAL: NEXTAUTH_URL or AUTH_URL must be set (public app URL)."
    exit 1
fi

if command -v prisma >/dev/null 2>&1; then
    prisma migrate deploy --schema=/app/prisma/schema.prisma
fi
exec node backend/server.js
