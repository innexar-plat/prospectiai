# Performance Policy

## Auto-Checklist

- [ ] Bundle size monitorado? Lazy import onde possível
- [ ] N+1 queries? (especialmente Prisma)
- [ ] Cache strategy definida?
- [ ] Render loops evitados?
- [ ] Imagens otimizadas?
- [ ] Code splitting onde aplicável?

## Conhecido

- framer-motion ~140KB na critical bundle — usar lazy import obrigatório
