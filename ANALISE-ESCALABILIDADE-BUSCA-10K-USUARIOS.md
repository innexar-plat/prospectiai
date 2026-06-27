# Analise Completa de Escalabilidade do Modulo de Busca

Data: 2026-04-12
Escopo: backend de busca, modulos integrados e pontos de persistencia/infra para suportar crescimento para mais de 10 mil usuarios.

## 1. Resumo executivo

Situacao atual:
- O modulo de busca esta funcional e com boa cobertura de fluxo de negocio.
- Existem gargalos importantes de escalabilidade no caminho critico da requisicao.
- Com aumento forte de usuarios, ha risco de aumento de latencia, saturacao de banco e indisponibilidade parcial/total em cenarios de falha de dependencias.

Conclusao objetiva:
- O sistema esta bom para operacao atual, mas ainda nao esta endurecido para 10k+ usuarios concorrentes sem ajustes estruturais.
- Prioridade maxima: desacoplar processamento pesado da resposta da busca, controlar concorrencia e reforcar resiliencia operacional.

## 2. Escopo analisado

Arquivos e modulos revisados:
- backend/src/modules/search/application/search.service.ts
- backend/src/app/api/search/route.ts
- backend/src/app/api/v1/search/route.ts
- backend/src/lib/db-sync.ts
- backend/src/lib/google-places.ts
- backend/src/lib/fetch-http.ts
- backend/src/lib/ratelimit.ts
- backend/src/lib/redis.ts
- backend/src/lib/team-credits.ts
- backend/src/app/api/search/history/route.ts
- backend/src/app/api/search/history/[id]/route.ts
- backend/src/app/api/team/dashboard/route.ts
- backend/prisma/schema.prisma

## 3. Arquitetura atual do fluxo de busca

Fluxo principal atual (simplificado):
1. Requisicao chega em POST /api/search.
2. Valida rate limit por IP em Redis.
3. Valida sessao e limites de workspace/membro.
4. Tenta cache ou fallback em banco local.
5. Se necessario, consulta Google Places.
6. Persiste historico, uso e atualiza contador de workspace.
7. Executa sincronizacao de leads e enriquecimento.
8. Retorna resposta ao cliente.

Observacao critica:
- Parte do enriquecimento/sync roda dentro do ciclo da requisicao em pontos centrais, aumentando custo por chamada.

## 4. Diagnostico tecnico detalhado

### 4.1 Gargalo critico: trabalho pesado dentro da requisicao

Sintoma:
- A busca aguarda sincronizacao de leads e consolidacoes antes de responder em caminhos importantes.

Impacto esperado em escala:
- Aumento de p95/p99.
- Maior chance de timeout em horario de pico.
- Efeito cascata quando APIs externas degradam.

Risco de negocio:
- Experiencia ruim para usuario final.
- Queda de conversao no funil comercial por resposta lenta.

### 4.2 Gargalo critico: paralelismo sem controle no sync

Sintoma:
- Processamento em lote com Promise.all para varios leads simultaneos, incluindo chamadas externas e upserts.

Impacto esperado:
- Rajadas de concorrencia no Postgres e servicos externos.
- Possibilidade de exaustao de conexoes e aumento de lock contention.

Risco:
- Instabilidade sob picos e recuperacao lenta apos incidente.

### 4.3 Risco alto: rota legada com comportamento diferente

Sintoma:
- A rota v1 de busca segue fluxo diferente do endpoint principal.
- Pode haver diferencas de governanca operacional (protecao, consistencia de cache, persistencia e enriquecimento).

Impacto:
- Comportamento inconsistente entre clientes antigos e novos.
- Superficie extra para bug/regressao operacional.

### 4.4 Risco alto: rate limit fail-closed dependente de Redis

Sintoma:
- Em falha do Redis, requisicoes de busca sao negadas.

Impacto:
- Falha de um componente de infra pode causar indisponibilidade ampla do endpoint.

Risco:
- Incidente de disponibilidade com impacto direto em receita.

### 4.5 Risco alto: ponto quente no contador de workspace

Sintoma:
- Incremento sincronizado em leadsUsed por busca no mesmo registro.

Impacto:
- Contencao em workspaces com alto volume.
- Possiveis waits/locks em concorrencia elevada.

### 4.6 Risco medio: estrategia de indices ainda insuficiente para grande volume

Sintoma:
- Existem indices basicos, mas faltam compostos alinhados aos filtros mais frequentes.

Impacto:
- Crescimento de latencia em historico, dashboards e checagem de limites com aumento de dados.

### 4.7 Risco medio: persistencia excessiva de resultados brutos por busca

Sintoma:
- Historico salva payload completo de resultados.

Impacto:
- Crescimento acelerado de armazenamento e I/O.
- Aumento de custo de backup e manutencao.

### 4.8 Risco medio: retries HTTP sem jitter

Sintoma:
- Backoff exponencial sem jitter.

Impacto:
- Sincronizacao de retries em massa durante degradacao externa.

### 4.9 Risco medio: consultas agregadas multiplicadas por membro

Sintoma:
- Rotinas de dashboard/creditos fazem varias contagens por periodo e por usuario.

Impacto:
- Custo de query cresce com o tamanho da equipe e frequencia de acesso.

## 5. Matriz de riscos

Criticidade alta:
- Trabalho pesado no caminho da requisicao.
- Paralelismo sem limite no sync.
- Divergencia de fluxo entre busca principal e v1.
- Dependencia fail-closed de Redis no rate limit.
- Contencao no update de contador por workspace.

Criticidade media:
- Indices compostos incompletos para padroes de consulta.
- Persistencia de payload completo de resultados.
- Retry sem jitter.
- Agregacoes de uso sem camada de pre-agrupamento/cache curto.

## 6. Plano de melhoria priorizado (implementacao)

### Fase 0 (hotfix de resiliencia, 1-3 dias)

Objetivo:
- Reduzir risco de indisponibilidade imediata.

Acoes:
1. Introduzir fallback controlado no rate limit quando Redis indisponivel.
2. Adicionar timeout e guardrails para operacoes secundarias nao essenciais.
3. Definir circuit breaker para chamadas externas mais criticas.
4. Alinhar logs de erro com tags padronizadas por rota e dependencia.

Entregavel:
- Endpoint de busca sem queda total por oscilacao isolada de Redis.

### Fase 1 (latencia e throughput, 1 sprint)

Objetivo:
- Tirar processamento pesado do caminho sincrono.

Acoes:
1. Migrar sync/enriquecimento de leads para fila assincrona.
2. Retornar resposta da busca sem aguardar processamento pesado.
3. Implementar concorrencia controlada no worker (pool pequeno e ajustavel).
4. Adicionar idempotencia por lead/place para evitar reprocessamento duplicado.

Entregavel:
- Reducao significativa de p95 e estabilidade em picos.

### Fase 2 (banco e consultas, 1 sprint)

Objetivo:
- Sustentar crescimento de volume de dados com previsibilidade.

Acoes:
1. Criar indices compostos para SearchHistory e UsageEvent conforme padroes reais.
2. Revisar queries mais frequentes com EXPLAIN ANALYZE.
3. Limitar e/ou normalizar resultadosData em historico.
4. Definir politica de retencao de historico detalhado.

Entregavel:
- Menor custo de query, melhor estabilidade sob carga e menor crescimento de storage.

### Fase 3 (consistencia de API e governanca, 1 sprint)

Objetivo:
- Eliminar divergencias de comportamento.

Acoes:
1. Unificar fluxo de /api/v1/search com o modulo principal ou deprecar v1 com rollout seguro.
2. Garantir paridade de rate limit, regras de credito e enriquecimento.
3. Monitorar diferencas por endpoint durante periodo de transicao.

Entregavel:
- Contrato unico e previsivel de busca para todos os clientes.

### Fase 4 (observabilidade e operacao continua)

Objetivo:
- Operacao orientada por SLO e alertas proativos.

Acoes:
1. Definir SLO por endpoint (latencia, erro e disponibilidade).
2. Painel com p50/p95/p99, taxa de erro e tempo de fila.
3. Alertas de saturacao de pool de conexao, fila e dependencia externa.
4. Runbooks de incidente testados em simulacao.

Entregavel:
- Operacao previsivel e com resposta rapida a incidentes.

## 7. Recomendacoes de modelagem e banco

Indices recomendados (prioridade alta):
1. SearchHistory:
- workspaceId + createdAt desc
- workspaceId + userId + createdAt

2. UsageEvent:
- workspaceId + type + createdAt

3. Lead (se houver crescimento forte por filtros dinamicos):
- avaliar indice para lastSearchedAt + workspace context (quando aplicavel ao modelo)

4. Particionamento (futuro, quando volume justificar):
- SearchHistory e UsageEvent por mes.

## 8. Recomendacoes de cache

Cache de busca:
- Manter chave deterministica por filtros.
- Introduzir stale-while-revalidate para reduzir misses em picos.
- Definir invalidacao controlada para dados sensiveis a atualizacao.

Cache de agregacoes:
- Dashboard e limites com cache curto (30-120s).
- Evitar recalculo pesado repetido em janelas pequenas.

## 9. Recomendacoes de filas e processamento assincrono

Padrao sugerido:
1. API busca publica resultado rapido.
2. Publica job de sync/enriquecimento.
3. Worker processa com concorrencia limitada.
4. Retry com backoff + jitter.
5. Dead-letter queue para falhas persistentes.
6. Telemetria por tipo de falha e tempo de processamento.

Controles obrigatorios:
- Idempotencia de job.
- Deduplicacao por placeId/leadId.
- Limites de throughput por dependencia externa.

## 10. Recomendacoes de resiliencia

1. Retry com jitter em chamadas externas.
2. Timeouts estritos por dependencia.
3. Circuit breaker por provedor externo.
4. Bulkhead para evitar que uma dependencia degrade o sistema inteiro.
5. Fallbacks com degradacao graciosa e mensagens claras para o cliente.

## 11. Testes obrigatorios para gate de 10k+

### 11.1 Carga

Cenarios:
1. Busca padrao com cache hit e miss.
2. Busca com filtros e paginacao.
3. Picos curtos (burst) e carga sustentada.
4. Falha parcial de Redis e API externa.

Metas sugeridas:
- p95 < 800 ms no endpoint principal em carga nominal.
- p99 < 1500 ms.
- taxa de erro < 1% em carga nominal.

### 11.2 Stress

Objetivo:
- Descobrir limite real de saturacao e comportamento de degradacao.

Saida esperada:
- Curva de throughput x latencia.
- Ponto de saturacao por recurso (CPU, DB, Redis, fila).

### 11.3 Resiliencia

Testes:
1. Redis indisponivel.
2. Google Places com 429/5xx intermitente.
3. Banco com latencia elevada.
4. Worker de sync com falha em lote.

## 12. Observabilidade e SLO

Metricas minimas:
- Latencia p50/p95/p99 por endpoint.
- Taxa de erro por endpoint e por causa.
- Fila: tamanho, idade media, retries, DLQ.
- Dependencias externas: latencia, erro, timeout, throttling.
- Banco: tempo de query, locks, conexoes ativas, filas.

SLO inicial sugerido para busca:
- Disponibilidade: 99.9% mensal.
- Latencia p95: < 800 ms.
- Erro 5xx: < 0.5%.

## 13. Runbook operacional

Incidente: aumento de latencia na busca
1. Verificar p95/p99 por endpoint.
2. Verificar tamanho da fila de sync.
3. Verificar latencia e erro de Google Places.
4. Verificar lock contention e conexoes no Postgres.
5. Ativar modo degradado (reduzir enriquecimento sincrono se existir).
6. Escalar workers com limite de concorrencia seguro.

Incidente: Redis indisponivel
1. Confirmar impacto em rate limit e cache.
2. Habilitar fallback controlado (modo emergencia).
3. Monitorar taxa de abuso e estabilidade.
4. Restaurar Redis e retornar politica normal.

Incidente: crescimento abrupto de erros externos
1. Reduzir taxa de chamadas por circuito.
2. Aumentar cache de resultados recentes.
3. Ativar retry com jitter e teto de tentativas.
4. Comunicar degradacao controlada no status interno.

## 14. KPI de acompanhamento da evolucao

Tecnicos:
- p95/p99 de busca.
- throughput maximo sustentado sem degradacao.
- percentual de cache hit.
- tempo medio de processamento da fila.
- erro por dependencia externa.

Produto/negocio:
- tempo medio para usuario obter lista util.
- taxa de sucesso de prospeccao por lote.
- estabilidade percebida em horario de pico.

## 15. Checklist de readiness para 10k+ usuarios

Infra e aplicacao:
- [ ] Fila assincrona ativa para sync e enrichment.
- [ ] Concorrencia controlada em workers.
- [ ] Retry com jitter e circuit breaker.
- [ ] Fallback de rate limit validado para falha de Redis.

Banco e dados:
- [ ] Indices compostos aplicados e validados.
- [ ] Politica de retencao de historico definida.
- [ ] EXPLAIN ANALYZE das queries criticas aprovado.

Operacao:
- [ ] Dashboards e alertas configurados.
- [ ] SLO definido e acompanhado.
- [ ] Runbooks testados em simulacao.
- [ ] Testes de carga e stress aprovados.

## 16. Roadmap sugerido (30-60-90 dias)

30 dias:
- Hotfix de resiliencia.
- Fila para sync com concorrencia controlada.
- Primeiros dashboards de latencia/erro.

60 dias:
- Indices compostos e otimizacao de queries.
- Unificacao/deprecacao da rota legada v1.
- Testes de carga recorrentes no pipeline.

90 dias:
- Particionamento/retencao de historico (se volume exigir).
- Afinacao de threshold de fila e throughput.
- Governanca SLO madura com revisao semanal.

## 17. Decisao recomendada

Recomendacao final:
- Prosseguir com plano em fases, iniciando imediatamente por desacoplamento assincrono e resiliencia de dependencias.
- Esse conjunto de acoes e o menor caminho para suportar crescimento para 10k+ usuarios com estabilidade real.

## 18. Arquitetura alvo profissional (recomendada)

Decisao de arquitetura para escala:
1. PostgreSQL como banco transacional principal (source of truth).
2. Redis para cache quente, rate limit e dados efemeros.
3. Fila assincrona para sync/enrichment/scoring fora do caminho da requisicao.
4. Replica(s) de leitura para dashboards e consultas analiticas de alta frequencia.
5. Pool de conexao (PgBouncer) + observabilidade forte (SLO, p95/p99, locks, queue depth).

Quando adicionar banco de grafo:
- Adicionar apenas quando houver necessidade comprovada de consultas multi-hop em tempo real com alta cardinalidade de relacionamento.
- Antes disso, manter complexidade controlada na stack atual reduz risco, custo e tempo de entrega.

Beneficios desta arquitetura:
- Escala horizontal mais previsivel.
- Menor latencia no endpoint de busca.
- Melhor isolamento entre trafego online e processamento pesado.
- Evolucao incremental sem migracao de alto risco do banco principal.

## 19. Plano de migracao sem regressao

Passo 1:
- Introduzir fila em paralelo ao fluxo atual com feature flag.

Passo 2:
- Rodar processamento duplicado (shadow mode) comparando consistencia entre resultados.

Passo 3:
- Mudar escrita principal para fila, mantendo fallback controlado.

Passo 4:
- Validar SLO por 2 semanas, remover caminho legado sincronizado.

Guardrails obrigatorios:
- Rollback simples por feature flag.
- Telemetria comparativa antes/depois.
- Testes de regressao automatizados no pipeline.

## 20. Atualizacoes aplicadas nesta rodada

Melhorias tecnicas implementadas agora:
1. Retry HTTP com jitter no backoff para reduzir tempestade sincronizada de tentativas.
2. Sincronizacao de leads com concorrencia limitada para reduzir pressao em banco e dependencias externas.
3. Extracao robusta do IP do cliente para chave de rate limit em ambientes com proxy.
4. Desacoplamento de sync pesado do caminho sincrono da busca via fila interna com concorrencia controlada.
5. Unificacao da rota legada `/api/v1/search` com o mesmo caso de uso da busca principal (consistencia operacional).
6. Modo configuravel de fail-open no rate limit para preservar disponibilidade em incidentes de Redis.
7. Exposicao de metricas da fila de sync no healthcheck (`leadSyncQueue`) para operacao e alertas.
8. Script de carga versionado para medir p50/p95/p99 de busca em `/api/search` e `/api/v1/search`.

Comandos de carga adicionados:
- `cd backend && npm run load:search`
- `cd backend && npm run load:search:v1`

Variaveis uteis para o script:
- `SEARCH_BASE_URL` (default: `http://localhost:4000`)
- `SEARCH_TOTAL_REQUESTS` (default: `500`)
- `SEARCH_CONCURRENCY` (default: `25`)
- `SEARCH_TIMEOUT_MS` (default: `15000`)
- `SEARCH_COOKIE` (sessao autenticada)
- `SEARCH_QUERY` (default: `restaurantes sao paulo`)

Objetivo das melhorias aplicadas:
- Aumentar resiliencia sob pico sem alterar contrato funcional de busca.
- Reduzir risco de regressao e preparar base para fases seguintes.

---

Documento preparado para servir como base de execucao tecnica, alinhamento de arquitetura e gate operacional de escalabilidade do modulo de busca.
