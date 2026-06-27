# Relatorio de Capacidade e Lancamento (2026-04-12)

## 1. Objetivo

Garantir estabilidade para lancamento com meta operacional de no minimo 500 usuarios simultaneos na plataforma, reconhecendo que nem todos executam busca ao mesmo tempo.

## 2. Diagnostico consolidado

### 2.1 Gargalo inicial identificado

- Erro recorrente no backend durante picos:
  - `Timed out fetching a new connection from the connection pool` (Prisma/Postgres).
- Sintoma observado em carga alta:
  - timeouts de cliente (`status 0`) e erros 500.

### 2.2 Mitigacoes aplicadas no backend

- Persistencia de historico de busca movida para fila assincrona.
- Sincronizacao de leads mantida em fila assincrona.
- Coalescencia de chamadas para reduzir tempestade de requests repetidas.
- Lock distribuido via Redis para anti-stampede entre instancias.
- Ajustes de rate limit autenticado vs anonimo.

### 2.3 Gargalo de borda identificado

- Mensagem de erro observada: `max connections reached: 120`.
- Causa raiz confirmada: middlewares globais do Traefik (`global-edge-inflight` e `global-edge-rate`) com teto em 120.

## 3. Ajustes aplicados na borda (Traefik)

No stack `/opt/traefik`:

- `traefik.http.middlewares.global-edge-inflight.inflightreq.amount=600`
- `traefik.http.middlewares.global-edge-rate.ratelimit.average=400`
- `traefik.http.middlewares.global-edge-rate.ratelimit.burst=600`

## 4. Ajustes aplicados para lancamento (runtime app)

Arquivo `.env` e defaults no `docker-compose.yml` do projeto:

- `SEARCH_RATE_LIMIT_AUTH_MAX=6000`
- `SEARCH_RATE_LIMIT_ANON_MAX=120`
- `SEARCH_HISTORY_QUEUE_CONCURRENCY=3`
- `SEARCH_HISTORY_QUEUE_MAX_SIZE=5000`
- `LEAD_SYNC_QUEUE_CONCURRENCY=2`
- `LEAD_SYNC_QUEUE_MAX_SIZE=1000`

Motivacao:

- reduzir drop de tarefas assincronas em pico;
- absorver bursts reais de usuarios autenticados sem 429 prematuro;
- manter protecao para trafego anonimo.

## 5. Evidencias de teste (resumo)

### 5.1 Busca apos tuning de borda e backend

Rodadas limpas (usuarios de benchmark dedicados) validaram:

- 150 concorrentes: 100% sucesso
- 200 concorrentes: 100% sucesso
- 250 concorrentes: 100% sucesso
- 300 concorrentes: 100% sucesso (rodada curta)
- 350 concorrentes: 100% sucesso (rodada curta)
- 400 concorrentes: 100% sucesso (rodada curta)

Observacao:

- Falhas pontuais com `LIMIT_EXCEEDED` foram de cota do usuario de teste, nao colapso de infraestrutura.

## 6. Interpretacao para base de 10k usuarios

- 10k usuarios cadastrados: viavel.
- O que limita e taxa efetiva de busca por minuto dos usuarios ativos.
- Faixa observada de throughput de busca durante os testes: ~16 a 20 req/s.

Heuristica operacional:

- 5% da base buscando 1x/min: confortavel.
- 10% da base buscando 1x/min: proximo do limite, porem viavel com monitoramento.
- Acima disso: risco crescente de fila alta e degradacao de latencia.

## 7. Politica de custo (Google Places)

- Requisicoes em producao sao reais e podem consumir Google Places em cache miss.
- Para testes de estresse com custo controlado, priorizar:
  - cenarios com cache aquecido;
  - usuarios de benchmark dedicados;
  - janela curta e monitorada.

## 8. Monitoracao recomendada no lancamento

Usar `/api/health` com alertas:

- `services.postgres.latencyMs`
- `services.redis.latencyMs`
- `searchHistoryQueue.queueLength`
- `searchHistoryQueue.droppedTasks`
- `leadSyncQueue.queueLength`
- `leadSyncQueue.droppedTasks`
- `searchBulkhead.timedOut`

### Semaforo sugerido

- Verde:
  - p95 busca < 8s
  - filas sem crescimento continuo
  - droppedTasks = 0 ou residual baixo
- Amarelo:
  - p95 entre 8s e 12s
  - fila crescendo por mais de 10 min
- Vermelho:
  - p95 > 12s sustentado
  - droppedTasks aumentando continuamente
  - timeouts/5xx em crescimento

## 9. Proximos passos (pos-lancamento)

1. Expandir teste multirrota para "todos os modulos" (misto: busca, analise, historico, export, integracoes).
2. Definir SLO formal por modulo (latencia e erro).
3. Ajustar concorrencias de workers por modulo conforme telemetria real da primeira semana.
4. Revisar custo/beneficio de cache adicional para reduzir chamadas externas.

## 10. Decisao atual

- Seguir com lancamento com o estado atual e tuning aplicado.
- Revisar escala apos dados reais de producao.
- Manter plano de reacao rapida baseado nos alertas acima.
