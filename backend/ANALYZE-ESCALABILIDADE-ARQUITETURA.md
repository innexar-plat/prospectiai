# Analyze API - Arquitetura Escalavel (2026-04)

## Objetivo

Padronizar o modulo `analyze` para alta concorrencia, resiliencia de provedor e experiencia sem erro para o usuario final.

## Arquitetura Aplicada

Fluxo:

`Route -> PreChecks -> Cache -> AI Router -> Parser -> Persistencia -> Cache`

Camadas:

- HTTP: `src/app/api/analyze/route.ts`
- Application service: `src/modules/analyze/application/analyze.service.ts`
- AI orchestration: `src/lib/gemini.ts`
- AI routing/resolution: `src/lib/ai/resolve.ts`
- Concurrency control by model: `src/lib/ai/model-bulkhead.ts`

## Estrategias de Escalabilidade

### 1) Multi-model routing

- Busca todos os configs habilitados de `AiProviderConfig` para o role.
- Aplica fallback de role (`company_analysis -> viability -> lead_analysis` quando necessario).
- Adiciona fallback de ambiente (`GEMINI_API_KEY`) ao pool.
- Ordena candidatos por prioridade (configs DB antes de fallback env).

### 2) Limite de concorrencia por modelo

- Chave: `provider:model`.
- Controle em memoria do processo para `inFlight` e `rejected`.
- Excesso acima do limite por modelo: tentativa rejeitada e roteador tenta outro modelo.

### 3) Circuit breaker por modelo

- Conta falhas consecutivas por modelo.
- Ao atingir threshold, abre circuito por janela configuravel.
- Modelo aberto sai temporariamente da selecao.

### 4) Cache resiliente de resultado

- Chave Redis: `analyze:result:{userId}:{placeId}`.
- Leitura no pre-check e no run principal.
- Repovoamento automatico quando resultado vem do banco.
- Reduz custo de token e latencia em repeticao de analise.

## Contratos de Falha e UX

- Rota assíncrona de analyze continua retornando status de job sem bloquear UI.
- Em degradacao de provedor, o roteador tenta candidatos alternativos antes de falhar.
- Quando tudo falha, resposta final preserva contrato do endpoint e evita stack trace ao usuario.

## Variaveis de Ambiente

- `AI_MODEL_MAX_IN_FLIGHT` (default: `4`)
- `AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD` (default: `3`)
- `AI_CIRCUIT_BREAKER_OPEN_MS` (default: `30000`)
- `ANALYZE_RESULT_CACHE_TTL_SECONDS` (default: `86400`)

## Testes Entregues

- `src/__tests__/ai-resolve.test.ts`
  - fallback para env
  - priorizacao de DB
  - fallback para segundo modelo quando o primeiro falha
- `src/__tests__/analyze.service.test.ts`
  - cache hit em Redis sem bater DB/IA

## Operacao

Checklist rapido:

1. Confirmar health `status=ok`.
2. Verificar `analyzeBulkhead` e `aiModelBulkhead` em `GET /api/health`.
3. Monitorar taxa de fallback e 429/503 em janela de 30-60 min apos deploy.
4. Ajustar `AI_MODEL_MAX_IN_FLIGHT` conforme saturacao observada.
