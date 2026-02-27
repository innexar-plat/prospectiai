# Procedimento Operacional (DEV/QA) - OBRIGATÓRIO

Este projeto roda 100% em Docker. Nenhuma validação é considerada "feita" se não rodou no container.

## Fluxo padrão para qualquer mudança
1. Atualizar branch e garantir working tree limpa
2. Planejar mudanças (arquivos + impacto)
3. Implementar em commits pequenos
4. Build no container
5. Rodar testes no container
6. Subir stack via compose
7. Verificar logs por serviço
8. Validar healthchecks + rotas críticas
9. Registrar evidências (comandos e outputs relevantes)

## Comandos padrão (via Makefile)
- **Subir:** `make up` — sobe a **stack completa** em containers (frontend:5173, admin:5174, backend:3010, redis, db) a partir do `docker-compose.yml` da raiz.
- **Build:** `make build` — build de todos os serviços (frontend, admin, backend).
- **Testes:** `make test` — roda testes Jest do backend no container (com DB).
- **Check (build sem regressão):** `make check` — executa `make test` e depois `make build`; falha se testes ou build falharem. Use antes de PR ou em CI.
- **E2E:** `make test-e2e` — roda testes Playwright (backend/e2e). A stack deve estar up (`make up`) e saudável (`make health`). Use `E2E_BASE_URL` para override (ex.: `E2E_BASE_URL=http://localhost:3010` para apontar ao backend diretamente).
- **Logs:** `make logs` ou `make logs SERVICE=backend` (ou `frontend`, `admin`, `db`, `redis`).
- **Health:** `make health` — checa o backend em http://localhost:3010/api/health (aguardar ~30s após `make up`).
- **Parar:** `make down`

**Rede externa:** O `docker-compose.yml` da raiz usa a rede `fixelo_fixelo-network` (Traefik). Em ambiente local sem Traefik, crie a rede antes de `make up`: `docker network create fixelo_fixelo-network`.

## Regras de validação
- Sempre executar `make build` após mudança que afete deps/build
- Sempre executar `make up` e `make health` antes de dizer "pronto"
- Se houver erro: primeiro olhar `make logs SERVICE=...`

## Padrão de evidência mínima (cole no PR)
- Resultado do `make build` (ou `make check` para build sem regressão)
- Resultado do `make test` (ou testes aplicáveis)
- Resultado do `make health`
- Trecho curto do log mostrando serviço healthy (sem segredos)

## Admin panel e `/api/admin/*`
- O admin (Vite, porta 5174) faz proxy de `/api` para o backend. A variável `VITE_API_TARGET` define o alvo (no Docker: `http://backend:4000`).
- Se o admin rodar **fora do Docker** (ex.: `npm run dev` no host), use `VITE_API_TARGET=http://localhost:4000` e garanta que o backend esteja rodando na porta 4000. Caso contrário, requisições como `/api/admin/plans` retornarão 404 ou falha de conexão.
- Em produção, o Traefik envia requisições do domínio para o frontend; o nginx do frontend faz proxy de `/api/*` para o backend. O endpoint `GET/POST /api/admin/plans` existe no backend; em caso de 404 em produção, verificar se o roteamento envia `/api/*` para o container correto e se o backend está saudável (`make health`).
