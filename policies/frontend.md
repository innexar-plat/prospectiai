# Frontend Policy

## Stack

Vite 7 + React 19 + Tailwind 4. TypeScript strict mode.

## Quality Scores

Toda entrega frontend relevante deve ser avaliada:

### Motion Score (0-100)
- Animações suaves, timing consistente, easing adequado
- prefers-reduced-motion respeitado
- Sem animações desnecessárias

### UX Score (0-100)
- Navegação intuitiva, contraste adequado
- Responsividade, estados vazios, loading, erros
- Formulários com validação clara

### Design Score (0-100)
- Alinhamento, espaçamento consistente
- Tipografia, grid, cores do design system
- Consistência visual entre pages/components

## Convenções

- Lazy import framer-motion (~140KB)
- Sem App.css (dead code)
- cn() em frontend/src/lib/utils.ts (twMerge disponível)
- Testes com Vitest
