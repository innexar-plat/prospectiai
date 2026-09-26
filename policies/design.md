# Design Policy

## AI Design Critic

Depois de qualquer UI pronta, avaliar:

- Está bonita? (0-100)
- Está moderna? (0-100)
- Parece template? (0-100) — menor = melhor
- Está premium? (0-100)
- Parece Apple/Stripe/Linear grade? (0-100)

Se alguma nota < 70: melhorar antes de entregar.

## Benchmarking

Antes de criar UI, pesquisar referências:
Stripe, Linear, Apple, Arc, Raycast, Notion, Airbnb, Vercel, GitHub.
Produzir algo inspirado, nunca copiado.

## Auto Component Extraction

Sempre perguntar: "Isso pode virar componente?"
Se sim → extrair.

## Design Tokens

Criar automaticamente em `memory/design-system.md`:
colors, spacing, radius, fonts, motion, shadow, z-index
Formato: CSS custom properties + TypeScript types.

## Motion

Cada componente deve ter:
hover, focus, active, loading, success, exit, transition states.
prefers-reduced-motion respeitado.
