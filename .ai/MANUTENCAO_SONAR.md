# Manutenção Sonar — Prospector AI

## Objetivo

Manter o projeto com **0 issues** no SonarQube (bugs e code smells resolvidos), garantindo qualidade estática e facilitando evolução do código.

## Como rodar o Sonar localmente

1. **Token:** Obtenha um token no Sonar (User → My Account → Security → Generate Token). Não commite o token; use variável de ambiente.

2. **Scanner (Docker):** Na raiz do repositório:

   ```bash
   docker run --rm -e SONAR_HOST_URL=https://sonar.innexar.com.br \
     -e SONAR_TOKEN=seu_token \
     -v "$(pwd):/usr/src" \
     -w /usr/src \
     sonarsource/sonar-scanner-cli
   ```

   Ou com `sonar-scanner` instalado localmente:

   ```bash
   export SONAR_HOST_URL=https://sonar.innexar.com.br
   export SONAR_TOKEN=seu_token
   sonar-scanner
   ```

3. **Autenticação:** A API do Sonar usa HTTP Basic Auth: usuário = token, senha vazia. Em scripts: `curl -u "$SONAR_TOKEN": ...`

## Onde ver o resultado

- **Dashboard:** https://sonar.innexar.com.br/dashboard?id=Prospector-AI
- Quality Gate e lista de issues por arquivo/linha ficam no projeto.

## Checklist antes de merge

- [ ] Lint e formatação: `npm run lint` (backend/frontend conforme workspace)
- [ ] Testes: `npm run test` onde houver
- [ ] Build: `npm run build` (backend e frontend)
- [ ] Sonar: rodar o scanner e conferir 0 issues (ou garantir que o CI passou)

## Regras que mais geram issues (e como evitar)

| Regra   | Descrição breve | Evitar |
|--------|------------------|--------|
| **S3358** | Ternários aninhados | Extrair para variáveis ou funções auxiliares; evitar `a ? b : (c ? d : e)`. |
| **S3776** | Complexidade cognitiva alta | Funções menores, early returns, extrair helpers. |
| **S3735** | Uso do operador `void` | Usar `.catch(() => {})` ou `.catch(noop)` em promises “fire-and-forget”. |
| **S1874** | APIs deprecadas (Zod, React) | Usar `z.email()` em vez de `z.string().email()` (Zod v4); `z.flattenError(err)` em vez de `err.flatten()`; `React.FormEvent<HTMLFormElement>` em handlers de form. |
| **S1128** | Imports não utilizados | Remover imports não usados. |
| **S3863** | Imports duplicados do mesmo módulo | Unificar em um único `import { a, b } from 'mod'`. |
| **S1854** | Atribuição inútil a variável | Usar o valor diretamente ou eliminar a variável. |
| **S3696** | Lançar objeto em vez de Error | Lançar `new Error()` ou subclasse; não `throw { message: '...' }`. |

## Configuração do projeto

- **Arquivo:** `sonar-project.properties` na raiz.
- **Exclusão atual:** Regra `css:S4662` em `**/index.css` (Tailwind v4 `@theme` não reconhecido pelo parser CSS do Sonar).
