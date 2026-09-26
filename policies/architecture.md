# Architecture Policy

## ADR Obrigatório

Toda decisão arquitetural relevante DEVE ter ADR em `memory/decisions.md`.

## Formato ADR

```markdown
## ADR-NNN: Título

**Problema:** ...
**Alternativas:** ...
**Prós/Contras:** ...
**Escolha:** ...
**Impacto:** ...
```

## RFC (mudanças grandes)

Para mudanças cross-cutting: `memory/rfcs/` com:
- Requirements
- Architecture
- Risks
- Migration
- Rollback
- Timeline

## Context Compression

Nunca mande todos os arquivos. Use:
- `memory/repository-index.md` para visão geral
- `memory/architecture.md` para decisões
- Só os arquivos relevantes para a tarefa
