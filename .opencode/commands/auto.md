/auto — Pipeline autônoma completa

Executa uma pipeline completa de engenharia sem intervenção manual:
plan → architect → implement → test → review → deliver

**Modo de detecção automática de tamanho:**

- PEQUENO (troca de botão, fix typo): implementa direto, sem planejamento
- MÉDIO (feature nova): plan → implement → test → report
- GRANDE (módulo novo): pipeline completa com todas as fases
- CRÍTICO (fix de segurança): implement → test → report (pula planejamento)

**Comandos relacionados:**
- `/mode <tarefa>` — apenas detecta e muda o modo, não executa
- `/pipeline <tarefa>` — pipeline sem auto-detecção de modo
- `/normal <tarefa>` — modo NORMAL forçado

**Permissões:** Tudo autorizado — não pergunta nada.
