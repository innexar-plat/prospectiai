# Análise: Convite para equipe quando o convidado não tem conta

## 1. Como funciona hoje

### Fluxo atual (passo a passo)

1. Admin envia convite (email) → backend cria `WorkspaceInvitation` com token e envia email com link: `/accept-invite?token=xxx`.
2. Convidado clica no link → abre **AcceptInvitePage** (`/accept-invite?token=xxx`).
3. Se **não está logado**: a página redireciona para  
   `/auth/signin?callbackUrl=/accept-invite?token=xxx`  
   para que, após o login, o usuário volte para a mesma URL e aceite o convite.
4. Na tela de **login**:
   - Se o usuário **já tem conta** e faz login → o callbackUrl é usado → volta para `/accept-invite?token=xxx` → **POST /api/team/invite/accept** é chamado → entra na equipe. **Funciona.**
   - Se o usuário **não tem conta** e clica em "Criar conta grátis" → vai para **/auth/signup**.
5. **Problema:** o link "Criar conta grátis" em [SignIn.tsx](frontend/src/pages/auth/SignIn.tsx) é:
   - `to="/auth/signup"` — **sem** passar o `callbackUrl`.
   - Ao criar a conta, [SignUp.tsx](frontend/src/pages/auth/SignUp.tsx) faz login e redireciona com **callbackUrl fixo** para `/onboarding`:
   - `await authApi.signIn({ email, password, callbackUrl: '/onboarding' })`.
6. Resultado: o usuário **cria a conta** mas **nunca volta** para `/accept-invite?token=xxx`. O token nunca é enviado ao backend, então **POST /api/team/invite/accept** nunca roda e o usuário **não entra na equipe**.

### Resumo da causa raiz

- O **callbackUrl** (que contém o token do convite) **não é repassado** da tela de login para a tela de cadastro.
- A tela de cadastro **sempre** redireciona para `/onboarding` após o registro, em vez de usar um callback vindo da URL (ex.: voltar para aceitar o convite).

Ou seja: o fluxo “convite → criar conta com o mesmo email” já está quase todo implementado; o que falta é **preservar e usar o callbackUrl no fluxo de signup**.

---

## 2. Opção A: Corrigir o fluxo “convite → criar conta” (recomendado)

**Ideia:** Manter o modelo “convite por email → usuário cria a própria conta com aquele email → ao finalizar o cadastro, voltar para a página de aceitar o convite”.

### O que fazer

1. **SignIn:** no link “Criar conta grátis”, incluir o `callbackUrl` na query da URL de signup, por exemplo:
   - `to={\`/auth/signup?callbackUrl=${encodeURIComponent(callbackUrlParam)}\`}`  
   (quando existir `callbackUrlParam`).
2. **SignUp:**
   - Ler `callbackUrl` da query (ex.: `searchParams.get('callbackUrl')`).
   - Se existir e for path interno (ex.: começar com `/`), após o registro fazer:
     - `authApi.signIn({ email, password, callbackUrl: callbackUrlFromQuery })`  
     em vez de `callbackUrl: '/onboarding'`.
   - Se não existir, manter o comportamento atual: `callbackUrl: '/onboarding'`.
3. **AcceptInvitePage:** sem mudança; quando o usuário voltar com a sessão ativa, o `useEffect` chama **POST /api/team/invite/accept** e a pessoa entra na equipe.

### Vantagens

- Pouca mudança (só frontend, 2 telas).
- Usuário escolhe a própria senha (mais seguro).
- Não é necessário enviar senha por email.
- Padrão usado por **Slack, Notion, Trello, Asana**, etc.: “invite link → sign up with this email → auto-join”.

### Desvantagens

- O usuário precisa concluir o cadastro no mesmo fluxo; se sair no meio, o convite continua pendente (como hoje).

---

## 3. Opção B: Admin “cria a conta” e envia login/senha por email

**Ideia:** No momento do convite, se o email **não** existir na base, o backend **cria** o usuário (User), já o associa ao workspace (WorkspaceMember) e gera uma **senha temporária**, enviando no email o link de acesso e a senha (ou link de “definir senha”).

### O que seria necessário

- **Backend (ex.: POST /api/team ou fluxo de convite):**
  - Se o email não existir: criar `User` (nome pode ser “Convidado” ou extraído do email), definir senha temporária (hash), criar `WorkspaceMember` e marcar o convite como aceito (ou nem criar convite pendente).
  - Enviar email com: link do app, email e senha temporária (ou link único “definir senha” com token de uso único).
- **Segurança:** senha temporária forte e expiração; preferível “link para definir senha” em vez de senha em texto no email.
- **Frontend:** opcionalmente, página “primeiro acesso / definir senha” quando o usuário entrar com token.

### Vantagens

- Convidado “já está na equipe”; só precisa fazer login (ou definir senha).
- Experiência única para “não tenho conta” vs “já tenho conta”.

### Desvantagens

- **Segurança:** enviar senha (mesmo temporária) por email é sensível; link “definir senha” é mais seguro mas exige mais implementação.
- **UX:** email pode cair em spam; usuário pode não ver o email.
- **LGPD/privacidade:** criar conta em nome do usuário pode exigir ajuste em termos e fluxo de consentimento.
- Mais código (backend + email + possivelmente frontend de “definir senha”).

### Onde é mais usado

- Comum em **ambiente corporativo** (Google Workspace, Microsoft 365, etc.), onde o admin “dá” a conta.
- Em SaaS B2B moderno (Slack, Notion, etc.) o padrão mais comum é **Opção A** (convite link → sign up com aquele email → auto-join).

---

## 4. O que empresas grandes costumam fazer

| Abordagem | Quem usa | Observação |
|-----------|----------|------------|
| **Convite link → usuário cria conta com aquele email → auto-join** | Slack, Notion, Trello, Asana, Figma, Miro | Padrão dominante em SaaS; usuário escolhe senha; não envia senha por email. |
| **Admin cria conta e envia senha / link “definir senha”** | Google Workspace, Microsoft 365, algumas ferramentas enterprise | Mais comum quando há diretório central (AD, IdP); em SaaS puro é menos frequente. |

Recomendação para o ProspectorAI: **primeiro implementar a Opção A** (corrigir o callbackUrl no signup). É a solução mais usada, mais segura e com menor esforço. A Opção B pode ser considerada depois, como modo “conta criada pelo admin”, se fizer sentido para planos enterprise.

---

## 5. Resumo de arquivos para a Opção A (correção recomendada)

| Arquivo | Alteração |
|---------|-----------|
| [frontend/src/pages/auth/SignIn.tsx](frontend/src/pages/auth/SignIn.tsx) | No link “Criar conta grátis”, usar `to={\`/auth/signup?callbackUrl=${encodeURIComponent(callbackUrlParam)}\`}` quando houver `callbackUrlParam`. |
| [frontend/src/pages/auth/SignUp.tsx](frontend/src/pages/auth/SignUp.tsx) | Ler `callbackUrl` da query (`useSearchParams`); após registro, chamar `signIn` com esse `callbackUrl` se existir e for path válido; senão manter `/onboarding`. |

Nenhuma alteração no backend ou no fluxo de accept-invite é necessária para essa correção.
