# Architecture

## Stack

- Frontend: Vite 7 + React 19 + Tailwind 4
- Admin: Vite 5 + React 19 + Tailwind 4
- Backend: Next.js 16 (API-only) + Prisma + Zod 4

## Docker Architecture

Traefik → frontend (Nginx :80) → backend (Next.js :4000) → PostgreSQL / Redis

## Domains

- BR: precisionia.com.br
- US: precisionai.innexar.app

## Key Decisions

<!-- ADRs will be added here as they are made -->
