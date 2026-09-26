# Backend Policy

## Stack

Next.js 16 (API-only) + Prisma + Zod 4.

## Auto-Verify Checklist

- [ ] N+1 queries? Usar Prisma `include` ou `batch`
- [ ] Indexes adequados no schema?
- [ ] Cache implementado onde necessário?
- [ ] Memory leaks? Streams fechados?
- [ ] Slow queries no log?
- [ ] Connection pool configurado?

## API

- Zod para validação de input
- JWT 30-day expiry (sem revogação — pendente)
- Health check em GET /api/health
- Testes com Jest (coverage: lines 85%, branches 79%, funcs 82%)
