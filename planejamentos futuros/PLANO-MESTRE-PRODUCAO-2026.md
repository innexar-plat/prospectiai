# Plano Mestre de Producao 2026

## 1. Objetivo

Consolidar um roadmap unico para estabilidade, qualidade de dados, observabilidade e crescimento do produto.

Resultado esperado:
- reduzir falhas operacionais (timeouts, 5xx, parsing, integracoes)
- aumentar confianca dos dados de lead e taxa de resposta comercial
- criar monitoramento proativo com alertas acionaveis
- manter escala com padrao de producao

## 2. Frentes Estrategicas

### Frente A — Estabilidade de API e Backend

Escopo:
- hardening de rotas criticas (`/api/analyze`, `/api/details`, `/api/leads/[id]/relations`, `/api/search`)
- padronizacao de validacao, timeout, fallback e erro
- politica de retry e circuito de degradacao para provedores externos

Entregas:
- timeouts por operacao dependente
- fallback parcial em consultas complexas
- payload de erro padrao com `requestId`
- logs estruturados com contexto minimo (route, userId, requestId, durationMs)

KPI:
- erro 5xx < 1% diario
- p95 de rotas criticas < 1200ms

### Frente B — Contact Intelligence (Google + Receita + Website)

Escopo:
- consolidacao de contatos por fonte
- score de confianca por contato
- deteccao de contato intermediario (contador/BPO)
- descoberta inteligente de website ausente

Entregas:
- tabela de contatos por lead com origem e confianca
- recomendado primario + alternativas explicaveis
- flags de risco (`shared_contact`, `accountant_pattern`, `domain_mismatch`)

KPI:
- aumento da taxa de resposta em primeiro contato
- reducao de tentativas em contato de baixa confianca

### Frente C — Observabilidade de Producao

Escopo:
- telemetria de aplicacao (metricas e logs)
- dashboard operacional
- alertas Telegram por regra de SLO

Entregas:
- endpoint de metricas de aplicacao
- dashboards Grafana para API, banco, redis, AI
- regras de alerta com severidade (critico, warning)
- roteamento de alertas para Telegram

KPI:
- MTTR < 30 min
- cobertura de alertas para 100% das rotas criticas

### Frente D — Operacao e Qualidade Continua

Escopo:
- playbooks de incidente
- testes automatizados para regressao de rotas criticas
- gate de qualidade no CI

Entregas:
- playbook para incidentes de API, banco, redis, AI provider
- suites de teste para cenarios de timeout e fallback
- checklist de release com health/ready e smoke tests

KPI:
- 0 rollback por erro evitavel em release
- cobertura >= 90% no escopo alterado

## 3. Cronograma (90 dias)

### Fase 1 (Semanas 1-3) — Estabilizacao
- finalizar hardening de rotas criticas
- eliminar erros recorrentes de details/relations/analyze
- definir e padronizar contrato de erro

### Fase 2 (Semanas 4-7) — Data Intelligence
- implementar camada de contatos multi-fonte
- publicar API de contato recomendado
- habilitar override manual auditavel

### Fase 3 (Semanas 8-10) — Observabilidade
- subir stack de metricas e dashboards
- configurar alertas Telegram por severidade
- validar thresholds em carga real

### Fase 4 (Semanas 11-13) — Operacao madura
- consolidar playbooks
- hardening final de CI/CD
- auditoria de performance e seguranca

## 4. Alertas Minimos de Producao

- taxa de erro 5xx > 2% por 5 min
- p95 de `/api/leads/[id]/relations` > 2s por 10 min
- indisponibilidade de Postgres ou Redis em 2 checks seguidos
- queda anormal de sucesso de analise por provider
- aumento de timeout por provider AI

## 5. Donos por Frente

- Backend/API: Engenharia Backend
- Data Intelligence: Engenharia + Produto
- Observabilidade: Engenharia + DevOps
- Operacao/Playbook: Engenharia + Suporte

## 6. Dependencias Criticas

- variaveis de ambiente de alerta (Telegram)
- stack de monitoramento (Grafana/Prometheus/Loki ou equivalente)
- capacidade de migrations controladas em producao

## 7. Criterio de Sucesso Final

- sistema resiliente com degradacao controlada
- monitoramento ativo com alertas acionaveis
- contatos de lead priorizados por confianca real
- operacao com visibilidade ponta-a-ponta e resposta rapida a incidentes
