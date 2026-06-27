# Plano de Implementacao - Contact Intelligence (Google + Receita + Website)

## 1. Objetivo

Resolver a baixa qualidade de contatos (telefone/email de contador, ausencia falsa de website, conflito entre fontes) com uma camada de consolidacao inteligente, auditavel e orientada a conversao.

Metas de negocio:
- Aumentar taxa de resposta no primeiro contato.
- Reduzir tentativas em contatos intermediarios (contador/BPO).
- Reduzir falsos "sem website".
- Expor confianca por contato para decisao comercial.

## 2. Escopo da Solucao

A solucao cria uma camada de "Contact Intelligence" entre a coleta de dados e a exibicao no produto:
- Ingestao multi-fonte (Google Places, Receita Federal/RfCompany, website scraper, social/public web).
- Normalizacao e deduplicacao de telefone, email e website.
- Scoring de confianca por contato.
- Classificacao de papel do contato (owner, central, accountant, unknown).
- Selecao de contato recomendado + alternativas com explicabilidade.

## 3. Modelo de Dados (Fase 1)

### 3.1 Nova tabela: LeadContact

Campos principais:
- id (UUID/cuid)
- leadId (FK -> Lead)
- type (PHONE | EMAIL | WEBSITE)
- valueRaw (valor original da fonte)
- valueNormalized (E164 para phone, lowercase para email, host canonico para website)
- source (GOOGLE | RECEITA | WEBSITE_SCRAPER | WEB_SEARCH | MANUAL)
- confidenceScore (0-100)
- roleHint (OWNER | COMMERCIAL | CENTRAL | ACCOUNTANT | UNKNOWN)
- isPrimary (boolean)
- evidence (JSON: razoes, origem, sinais)
- firstSeenAt / lastSeenAt
- createdAt / updatedAt

Indices recomendados:
- idx_lead_contacts_lead_id
- idx_lead_contacts_type
- idx_lead_contacts_value_normalized
- idx_lead_contacts_source
- uq_lead_contacts_unique_source_value (leadId + type + valueNormalized + source)

### 3.2 Ajustes no Lead

Adicionar campos espelho para consumo rapido da UI/API:
- recommendedPhone
- recommendedEmail
- recommendedWebsite
- contactsHealthScore (0-100)

Observacao: os campos atuais (`phone`, `email`, `website`) permanecem por compatibilidade e serao preenchidos por fallback durante migracao.

## 4. Regras de Confianca (Scoring)

### 4.1 Base por fonte
- WEBSITE_SCRAPER: 80
- GOOGLE: 70
- RECEITA: 55
- WEB_SEARCH: 60
- MANUAL: 90

### 4.2 Sinais positivos
- +15 se email tem dominio do website recomendado.
- +10 se contato aparece em 2+ fontes diferentes.
- +10 se website contem CNPJ igual ao lead.
- +8 se telefone aparece no Google e no website.

### 4.3 Sinais negativos
- -35 se email/telefone aparece em muitos CNPJs (shared contact suspeito).
- -20 se padrao semantico de contador (contabil, fiscal, assessoria, escritorio).
- -15 se dominio de email generico sem correlacao com marca.
- -10 se website em agregador/diretorio sem prova de titularidade.

### 4.4 Faixas operacionais
- 75-100: Alta confianca (contato recomendado)
- 50-74: Media confianca (alternativa util)
- 0-49: Baixa confianca (provavel intermediario)

## 5. Detecao de Contato de Contador/BPO

Usar dados ja existentes do projeto (smart-relations e RF):
- Se telefone/email estiver compartilhado por varios CNPJs -> flag `shared_with_many_cnpjs`.
- Se maioria dos CNPJs relacionados tiver CNAE de contabilidade/escritorio -> flag `accountant_pattern`.
- Se nome do email sugerir escritorio contabil -> flag `accountant_email_pattern`.

Saida esperada por contato:
- riskFlags: ["shared_with_many_cnpjs", "accountant_pattern", ...]
- explanation: texto curto para UI e API.

## 6. Descoberta Inteligente de Website (quando Google nao traz)

Pipeline de descoberta:
1. Google `websiteUri` (se existir).
2. Busca web por nome + cidade + CNPJ.
3. Extracao de dominio em redes sociais oficiais.
4. Validacao de titularidade por sinais:
- Nome fantasia/razao social no HTML.
- CNPJ no HTML e match com lead.
- Cidade/UF consistente.

Regra final:
- Se score de website >= limiar (ex: 70), marcar `recommendedWebsite`.
- Nao marcar "sem website" enquanto houver candidato em validacao assicrona.

## 7. API (Fase 2)

### 7.1 Novo endpoint
GET /api/leads/:id/contact-intelligence

Resposta:
- recommendedContacts: { phone, email, website }
- alternatives: lista ordenada por score
- riskFlags globais
- evidence por contato
- contactsHealthScore

### 7.2 Endpoint de override manual
PATCH /api/leads/:id/contact-intelligence/primary

Uso:
- Permitir operacao comercial definir contato principal manualmente.
- Registrar auditoria (quem alterou, quando, motivo).

## 8. Integracao com Fluxos Atuais

Pontos de integracao existentes:
- Ingestao principal: `src/lib/db-sync.ts`
- Relacoes compartilhadas: `src/lib/smart-relations.ts`
- Scraper de website: `src/lib/website-scraper.ts`
- Match Receita: `src/lib/rf-fuzzy-match.ts`

Mudanca principal:
- `syncLead` deixa de sobrescrever contato unico diretamente e passa a alimentar `LeadContact`.
- Um consolidator escolhe recomendados e atualiza espelho no `Lead`.

## 9. Rollout em Fases

### Fase 1 - Fundacao de dados (1 sprint)
- Criar migration Prisma (`LeadContact` + campos recomendados em `Lead`).
- Implementar normalizadores (phone/email/website).
- Implementar ingestao multi-fonte sem mudar UI.
- Backfill inicial para leads existentes.

Criterio de aceite:
- 100% dos novos leads com ao menos 1 registro em `LeadContact` quando houver dados.

### Fase 2 - Consolidacao e scoring (1 sprint)
- Implementar motor de score e role hints.
- Implementar escolha de contato recomendado.
- Expor endpoint `contact-intelligence`.

Criterio de aceite:
- API retorna recomendados + alternativas + explicacao.

### Fase 3 - UX comercial (1 sprint)
- UI mostra contato recomendado, confianca e alternativas.
- Badge de risco para possivel contador/intermediario.
- Acao de override manual.

Criterio de aceite:
- Usuario consegue trocar contato primario e salvar justificativa.

### Fase 4 - Observabilidade e tuning (continuo)
- Dashboard de qualidade por fonte.
- Experimentos A/B de score threshold.
- Ajustes por taxa de resposta real.

## 10. Observabilidade e KPIs

Metrica tecnica:
- parse/ingest success rate por fonte
- latencia do consolidator
- erros de normalizacao

Metrica de qualidade de dado:
- percentual de contatos com score >= 75
- percentual de contatos marcados como compartilhados
- percentual de leads com website recomendado

Metrica de negocio:
- taxa de resposta por faixa de score
- taxa de bounce de email por fonte
- taxa de conversao por contato recomendado vs fallback

## 11. Testes Obrigatorios

- Unitarios:
  - normalizacao phone/email/website
  - score positivo e negativo
  - detector de contato compartilhado
- Integracao:
  - `syncLead` criando multiplos contatos por fonte
  - endpoint de intelligence retornando ordenacao correta
- Regressao:
  - compatibilidade com campos legados de `Lead`

Cobertura alvo para escopo alterado: >= 90%.

## 12. Riscos e Mitigacoes

Risco: falso positivo de "contador".
Mitigacao: manter como flag de risco, nao bloquear contato automaticamente.

Risco: aumento de custo/latencia com descoberta web.
Mitigacao: pipeline assicrono com timeout curto e cache por dominio.

Risco: conflito entre recomendacao automatica e operacao.
Mitigacao: permitir override manual auditado.

## 13. Checklist de Execucao

- [ ] Migration Prisma criada e validada em staging
- [ ] Repositorio/servico de LeadContact implementado
- [ ] Consolidator com scoring habilitado
- [ ] Endpoint GET contact-intelligence entregue
- [ ] Endpoint PATCH override entregue
- [ ] UI com recomendados + alternativas
- [ ] Dashboard de metricas e alertas
- [ ] Documentacao API atualizada

## 14. Plano de Execucao Tatico (prioridade atual)

### Sprint 1 - Fundacao de dados e compatibilidade

Objetivo:
- Criar base de dados para consolidacao de contatos sem quebrar fluxo atual.

Entregaveis:
- Migration Prisma com tabela `LeadContact` e campos espelho no `Lead`.
- Normalizadores utilitarios (`phone`, `email`, `website`).
- Ingestao inicial em `syncLead` mantendo campos legados.

Criterio de aceite:
- 100% dos novos leads com ao menos um contato persistido quando existir dado de origem.
- Nenhuma regressao em `phone/email/website` nos endpoints atuais.

KPI de controle:
- erro de ingestao < 1%
- tempo medio de persistencia por lead < 150ms adicional

### Sprint 2 - Consolidator e confianca

Objetivo:
- Definir contato recomendado com score e explicacao.

Entregaveis:
- Motor de scoring com sinais positivos e negativos.
- Regras de `roleHint` e `riskFlags` (contador/intermediario).
- Atualizacao automatica de `recommendedPhone`, `recommendedEmail`, `recommendedWebsite`, `contactsHealthScore`.

Criterio de aceite:
- Lead com multiplas fontes retorna recomendado consistente e reproducivel.
- Flags de risco aparecem quando contato e compartilhado por muitos CNPJs.

KPI de controle:
- >= 80% dos leads com score calculado quando houver dados suficientes
- <= 5% de falha no consolidator

### Sprint 3 - API e observabilidade

Objetivo:
- Expor dados para produto e monitorar qualidade em producao.

Entregaveis:
- GET `/api/leads/:id/contact-intelligence`.
- PATCH `/api/leads/:id/contact-intelligence/primary` com auditoria.
- Logs estruturados e metricas de qualidade por fonte.

Criterio de aceite:
- API retorna recomendado, alternativas, risk flags e evidencias.
- Override manual persiste e sobrescreve recomendacao automatica de forma auditavel.

KPI de controle:
- p95 do GET < 400ms
- sucesso do endpoint >= 99%

### Sprint 4 - UX comercial e calibracao

Objetivo:
- Tornar inteligencia acionavel no fluxo comercial.

Entregaveis:
- Exibicao de recomendado + alternativas + badge de confianca/risco no frontend.
- Ajustes de threshold com base em dados reais de resposta.
- Dashboard operacional de qualidade de contatos.

Criterio de aceite:
- Time comercial consegue escolher e justificar contato primario.
- Relatorios mostram distribuicao de score por fonte.

KPI de resultado:
- +15% de taxa de resposta em primeiro contato (baseline vs 30 dias)
- -20% de contatos classificados como intermediarios no topo da recomendacao

## 15. Gate para iniciar Auto-Prospeccao

Auto-prospeccao so inicia apos estes gates:
- [ ] Endpoint de contact intelligence estavel por 14 dias
- [ ] Erro 5xx nas rotas de lead < 1%
- [ ] Dashboard de qualidade ativo e revisado semanalmente
- [ ] Taxa de resposta melhorou de forma comprovada vs baseline

## 16. Status de Implementacao (codigo atual)

Status backend entregue nesta etapa:
- [x] Tabela `LeadContact` e campos espelho em `Lead`.
- [x] Consolidacao com score por contato e `riskFlags` globais no resultado.
- [x] Endpoint GET `/api/leads/:id/contact-intelligence`.
- [x] Endpoint PATCH `/api/leads/:id/contact-intelligence/primary` com auditoria em `AuditLog`.
- [x] Compatibilidade mantida com PATCH legado em `/api/leads/:id/contact-intelligence`.
- [x] Busca e details retornam snapshot recomendado quando disponivel (`recommendedPhone`, `recommendedEmail`, `recommendedWebsite`, `contactsHealthScore`).

Itens ainda pendentes para fechamento total do plano macro:
- [ ] UI comercial completa com recomendados + alternativas + override com justificativa.
- [ ] Dashboard operacional de qualidade por fonte e alertas.
- [ ] Ajuste continuo de thresholds com dados reais de resposta.
