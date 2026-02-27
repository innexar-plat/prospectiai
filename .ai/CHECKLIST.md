# Checklist de Entrega (OBRIGATÓRIO)

## Planejamento
- [ ] Escopo definido (o que entra / o que não entra)
- [ ] Arquivos afetados listados
- [ ] Risco identificado (migração, breaking changes, etc.)

## Implementação
- [ ] Tipagem ok (sem any / sem gambiarra)
- [ ] Erros tratados
- [ ] Logs úteis adicionados (sem segredos)
- [ ] Healthcheck mantido/atualizado

## Docker / Execução
- [ ] `make build` OK
- [ ] `make test` OK (ou justificativa)
- [ ] `make up` OK
- [ ] `make health` OK
- [ ] `make logs SERVICE=<svc>` sem erros críticos

## Documentação
- [ ] README/Runbook atualizado (se necessário)
- [ ] Evidências coladas no PR (outputs curtos)

## Final
- [ ] Não quebrou backward compatibility (ou documentou)
- [ ] Rollback possível
