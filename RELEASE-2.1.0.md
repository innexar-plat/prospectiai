# Release 2.1.0

## Resumo

Esta release consolida a evolucao recente do perfil empresarial enriquecido, melhora a experiencia de analise no dashboard e adiciona comunicacao in-app controlada por versao para clientes.

## Entregas principais

- Banner de novidades exibido uma unica vez por versao no dashboard do cliente.
- Mensagens orientadas a beneficios de produto, estabilidade e seguranca, sem expor detalhes internos de infraestrutura.
- Cobertura de testes para o novo banner de release e para o banner de completude de perfil.
- Cobertura adicional para o fluxo de analise usar corretamente dados enriquecidos do workspace.
- Correcao de fallback no backend para combinar `userProfile` parcial com o perfil empresarial do workspace.

## Impacto funcional

- Clientes veem um resumo profissional das melhorias da versao atual apenas uma vez.
- Leads e analises passam a aproveitar de forma mais consistente os campos enriquecidos do perfil da empresa, inclusive quando o `userProfile` chega incompleto.
- O dashboard continua mostrando o alerta de perfil incompleto quando faltam dados importantes para contextualizar a IA.

## Testes adicionados

- `frontend/src/components/dashboard/ReleaseNotesBanner.test.tsx`
- `frontend/src/components/dashboard/ProfileCompletenessBanner.test.tsx`
- Extensoes em `backend/src/__tests__/analyze.service.test.ts`
- Extensoes em `backend/src/__tests__/ai-prompts-builder.test.ts`
- Extensoes em `backend/src/__tests__/gemini.test.ts`

## Validacao prevista

- Lint em frontend, backend e admin.
- Testes de frontend.
- Testes direcionados de backend para os modulos alterados.
- Build de frontend, backend e admin.
- Rebuild dos containers com `docker compose -f docker-compose.yml up -d --build backend frontend`.