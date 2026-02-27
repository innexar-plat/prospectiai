SHELL := /bin/bash

SERVICE ?=

up:
	./docker/scripts/up.sh

down:
	./docker/scripts/down.sh

build:
	./docker/scripts/build.sh

logs:
	./docker/scripts/logs.sh $(SERVICE)

test:
	./docker/scripts/test.sh

# Build sem regressão: testes primeiro, depois build. Falha em qualquer passo.
check: test build

# E2E Playwright: stack deve estar up (make up). Use E2E_BASE_URL para override (ex.: http://localhost:3010 para API direta).
test-e2e:
	./docker/scripts/test-e2e.sh

health:
	./docker/scripts/health.sh

# SonarQube (análise estática). Requer rede fixelo_fixelo-network. DNS: sonar.innexar.com.br → host.
sonar-up:
	docker compose -f docker/sonar-compose.yml up -d
sonar-down:
	docker compose -f docker/sonar-compose.yml down
