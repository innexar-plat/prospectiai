# Patterns

## Code Patterns

- TypeScript strict mode, no `any`, prefer `unknown` + type guards
- Tests required for new features
- Commit: feat/fix/chore prefix, imperative mood

## Project Patterns

- Branches: feat/<name>, fix/<name>, chore/<name>
- Docker compose build (no cache by default)
- `make test` starts dedicated test DB via docker/docker-compose.yml
