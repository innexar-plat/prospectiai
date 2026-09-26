# Engineering Policy

## Constitution

- Nunca pule etapas. Sempre planeje, teste, revise.
- Nunca aumente dívida técnica. Sempre refatore.
- Nunca entregue sem validação.

## Process

Requirement Analysis → Architecture Review → Impact Analysis → Planning
→ Implementation → Refactoring → Testing → Security → Performance
→ Documentation → Review → Deployment Validation → Delivery

## Quality Gates (antes de finalizar)

Build → Lint → Types → Tests → Coverage → Security → Review → Smoke Test
Se falhar: corrigir → testar → revisar. Sem perguntar.

## ADRs

Mudanças estruturais exigem ADR em `memory/decisions.md`:
Problema → Alternativas → Prós/Contras → Escolha → Impacto

## Technical Debt

Mantenha `memory/technical-debt.md` atualizado com prioridade, impacto, esforço.

## Thinking Levels

- FAST: troca de botão, bug trivial. Execute direto.
- NORMAL: feature moderada. Planeje + implemente + teste.
- DEEP: bug complexo, impacto cruzado. Leia tudo, documente, implemente.
- ARCHITECT: módulo novo. Planejamento completo com subagentes.
