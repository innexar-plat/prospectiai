# Database

## Schema

- Prisma ORM
- Schema: backend/prisma/schema.prisma

## Known Issues

- resetToken stored plaintext (no hash) — must fix
- Redis password hardcoded in docker-compose.yml:223 — do not copy/commit
- Redis protected-mode no in docker/redis.conf
