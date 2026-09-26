# Cost Policy

## Model Routing

O Planner escolhe o modelo mais barato que atende a tarefa:

| Tarefa | Modelo |
|--------|--------|
| CSS, ajuste simples | Barato (Qwen, Haiku) |
| Feature moderada | Médio (Sonnet, GPT-4o) |
| Arquitetura, revisão | Forte (Opus, Sonnet Thinking) |
| Documentação | Barato |
| Raciocínio profundo | Modelo com reasoning |

## Context Optimization

- Nunca mande >20 arquivos por vez
- Use `memory/` como resumo
- Prefira `grep` e `glob` seletivamente
- Resuma antes de passar para subagente

## Token Budget

- FAST: <5K tokens de contexto
- NORMAL: <20K tokens
- DEEP: <50K tokens
- ARCHITECT: <100K tokens
