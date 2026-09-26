# Testing Policy

## Obrigatório

Toda alteração DEVE incluir testes. Sem exceção.

## Quality Gates

- [ ] Tests passando
- [ ] Coverage ≥ 80% lines/functions/branches
- [ ] Testes de borda incluídos
- [ ] Testes de integração quando aplicável
- [ ] Testes de regressão para bugs

## Commands

- Frontend: `vitest run`
- Admin: `vitest run`
- Backend: `jest`
- Full suite: `make test` (inicia DB Docker + roda todos)

## Cobertura

- Verifique `sonar-project.properties` e `jest.config.js` antes de adicionar testes
- make test usa DB dedicado em docker/docker-compose.yml
