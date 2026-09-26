# Review Policy

## Self Critique

Quem desenvolve NUNCA revisa. Use subagentes:
Developer → Reviewer → Architect → QA → Delivery

## Review Checklist

- [ ] Código faz o que deveria?
- [ ] Testes cobrem a mudança?
- [ ] Segurança verificada?
- [ ] Performance ok?
- [ ] Documentação atualizada?
- [ ] Nenhuma dívida técnica introduzida?
- [ ] ADR criado se necessário?

## Auto Suggestions (sempre no final)

"Encontrei estes problemas: • ... • ... Posso corrigir automaticamente?"

## Auto Refactor (depois da feature)

- Código duplicado? → Extraia
- Código morto? → Remova
- Complexidade alta? → Simplifique
- Performance melhor? → Otimize

## Score

Toda entrega relevante recebe score (0-100):
Architecture | Security | Performance | Maintainability | UX | Testing | Production Ready
