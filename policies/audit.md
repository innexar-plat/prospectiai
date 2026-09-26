# Audit Policy

## External Auditor

Antes de considerar uma entrega completa, rodar auditoria externa:

1. **O que outros agentes podem ter perdido?**
2. **Olhar com olhos de hacker** — falhas de segurança não óbvias
3. **Olhar com olhos de usuário** — atritos de UX
4. **Olhar com olhos de negócio** — a feature resolve o problema?
5. **Olhar com olhos de futuro** — isso escala? Dá manutenção?

## AI Historian

Tudo que for decidido DEVE ser registrado:
- ADRs em `memory/decisions.md`
- RFCs em `memory/rfcs/`
- Lições em `memory/lessons.md`
- Arquitetura em `memory/architecture.md`
- Dívida técnica em `memory/technical-debt.md`

## Scoring

Toda entrega relevante recebe score:
Architecture | Security | Performance | Maintainability | UX | Testing | Production Ready
Cada dimensão 0-100. Média geral calculada.
