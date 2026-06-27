# Enriquecimento do Perfil da Empresa

## Objetivo

Este pacote amplia o perfil compartilhado da empresa/workspace para melhorar a qualidade dos módulos de inteligência, com foco imediato em:

- viabilidade de negócio
- análise da minha empresa
- preparação de contexto para concorrência e outras análises futuras

## O que foi implementado

### 1. Novos campos persistidos no workspace

Campos adicionados ao modelo `Workspace`:

- `legalName`
- `tradeName`
- `cnpj`
- `primaryCnaeCode`
- `primaryCnaeDescription`
- `companySize`
- `foundingDate`
- `postalCode`
- `street`
- `number`
- `complement`
- `neighborhood`
- `city`
- `state`
- `serviceModel`
- `averageTicket`
- `operationRadiusKm`
- `knownCompetitors`

Migration criada em:

- `backend/prisma/migrations/20260417113000_enrich_workspace_company_profile/migration.sql`

### 2. API de perfil da empresa expandida

Endpoint existente ampliado:

- `GET /api/workspace/current/profile`
- `PATCH /api/workspace/current/profile`

Os endpoints agora retornam e aceitam o perfil estruturado completo, incluindo identificação, localização e dados operacionais.

### 3. Lookup por CNPJ

Novo endpoint:

- `GET /api/workspace/current/profile/cnpj?cnpj=...`

Fonte de dados:

- tabela `RfCompany`
- tabela `CnaeCode`

Esse endpoint retorna:

- `cnpj`
- `legalName`
- `tradeName`
- `primaryCnaeCode`
- `primaryCnaeDescription`
- `companySize`
- `foundingDate`
- `postalCode`
- `street`
- `number`
- `neighborhood`
- `city`
- `state`
- `address`

### 4. Tela de perfil da empresa enriquecida

Arquivo principal:

- `frontend/src/pages/dashboard/EmpresaPerfilPage.tsx`

Melhorias de UX:

- seção de identificação da empresa
- preenchimento por CNPJ
- seção de oferta e operação
- seção de endereço estruturado
- preenchimento por CEP via ViaCEP
- estado em lista controlada
- autocomplete de cidade por UF
- seção de canais digitais

### 5. Helpers de normalização e CEP

Novo arquivo:

- `frontend/src/lib/company-profile.ts`

Responsabilidades:

- normalização e máscara de CNPJ
- normalização e máscara de CEP
- consulta de CEP via ViaCEP
- normalização de números opcionais

### 6. Módulos que passaram a usar o contexto enriquecido

#### Viabilidade

Arquivos principais:

- `backend/src/app/api/viability/route.ts`
- `backend/src/modules/viability/domain/types.ts`
- `backend/src/modules/viability/application/viability.service.ts`

Melhorias:

- `my_business` agora envia contexto enriquecido do workspace para a análise
- `expand` e outros modos também podem se beneficiar do contexto do workspace já carregado no backend
- o prompt passa a incluir CNAE, porte, CNPJ, ticket médio, modelo de atendimento, raio de operação e concorrentes conhecidos

#### Análise da minha empresa

Arquivos principais:

- `backend/src/app/api/company-analysis/route.ts`
- `backend/src/modules/company-analysis/domain/types.ts`
- `backend/src/modules/company-analysis/application/company-analysis.service.ts`

Melhorias:

- `useProfile=true` agora aproveita os novos campos do workspace
- o prompt recebe bloco de perfil mais rico com identificação, localização e dados operacionais
- cidade e estado podem vir automaticamente do perfil salvo

## Contrato de frontend

Arquivo atualizado:

- `frontend/src/lib/api.ts`

Tipos ampliados:

- `WorkspaceProfile`
- `SessionUser`
- `CompanyAnalysisParams`

Novo método:

- `workspaceProfileApi.lookupCnpj(cnpj)`

## Cobertura de testes

### Backend

Arquivos cobertos:

- `backend/src/__tests__/workspace-profile.test.ts`
- `backend/src/__tests__/workspace-profile-cnpj.test.ts`
- `backend/src/__tests__/viability-route.test.ts`
- `backend/src/__tests__/user-me.test.ts`

Casos cobertos:

- leitura e atualização do perfil expandido
- lookup de CNPJ válido, inválido e não encontrado
- propagação do contexto enriquecido para viabilidade
- retorno do `user/me` com workspace profile enriquecido

### Frontend

Arquivos cobertos:

- `frontend/src/lib/api.test.ts`
- `frontend/src/lib/company-profile.test.ts`

Casos cobertos:

- contrato expandido de `workspaceProfileApi`
- lookup de CNPJ no cliente
- máscara e normalização de CNPJ e CEP
- consulta de CEP
- normalização de valores numéricos

## Validação executada

Backend:

- `npx prisma generate`
- `npm test -- --runInBand workspace-profile.test.ts workspace-profile-cnpj.test.ts viability-route.test.ts user-me.test.ts`

Frontend:

- `npm run test -- src/lib/api.test.ts src/lib/company-profile.test.ts`
- `npm run typecheck`

## Limitações atuais

- o autocomplete de CEP depende do ViaCEP no cliente
- o módulo de concorrência ainda não usa explicitamente os novos campos do perfil em seu contrato, embora agora exista contexto persistido suficiente para essa evolução
- o lookup de CNPJ usa a base local `RfCompany`; se o CNPJ não estiver nela, o preenchimento automático não ocorre

## Próximo passo recomendado

Evoluir o módulo de concorrência para usar diretamente:

- `primaryCnaeCode` / `primaryCnaeDescription`
- `knownCompetitors`
- `city` / `state`
- `serviceModel`
- `averageTicket`

Isso permite diferenciar concorrência por setor, praça, posicionamento e modelo operacional.