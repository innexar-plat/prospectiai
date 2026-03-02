SHELL := /bin/bash

SERVICE ?=

up:
	./docker/scripts/up.sh

down:
	./docker/scripts/down.sh

build:
	./docker/scripts/build.sh

# Rebuild: build images then bring stack up.
rebuild: build up

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
# SONAR_TOKEN: definir no ambiente (My Account → Security → Generate Token).
sonar-up:
	docker compose -f docker/sonar-compose.yml up -d
sonar-down:
	docker compose -f docker/sonar-compose.yml down
sonar:
	@test -n "$$SONAR_TOKEN" || (echo "Defina SONAR_TOKEN no ambiente."; exit 1)
	docker run --rm -e SONAR_HOST_URL=$${SONAR_HOST_URL:-https://sonar.innexar.com.br} -e SONAR_TOKEN=$$SONAR_TOKEN \
		-v "$$(pwd):/usr/src" -w /usr/src sonarsource/sonar-scanner-cli
