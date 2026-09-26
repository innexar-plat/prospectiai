# API Contracts

## Health

- GET /api/health → { status: "ok" }

## Auth

- JWT 30-day expiry — no revocation mechanism
- API auth middleware: backend/src/lib/api-auth.ts
- NextAuth config: backend/src/auth.ts

<!-- Document API endpoints here as they are created/modified -->
