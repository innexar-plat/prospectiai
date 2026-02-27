# Admin APIs (SaaS)

Acesso: sessão autenticada + e-mail em **ADMIN_EMAILS** (env: emails separados por vírgula). Senão: 403.

## Endpoints

- **GET /api/admin/stats** — Contagens: users, workspaces, searchHistory, leadAnalyses.
- **GET /api/admin/users** — Lista usuários. Query: limit (default 20), offset (default 0).
- **GET /api/admin/users/[id]** — Usuário por id com workspaces.
- **GET /api/admin/workspaces** — Lista workspaces. Query: limit, offset.
- **GET /api/admin/workspaces/[id]** — Workspace por id com members.
- **GET /api/admin/search-history** — Histórico de buscas. Query: limit, offset, workspaceId (opcional).
- **GET /api/admin/leads** — Análises de leads. Query: limit, offset, workspaceId (opcional).

Respostas: 401 Unauthorized, 403 Forbidden, 404 Not found, 500 Internal server error.

## Utilidade operacional

| Endpoint | Uso em suporte/operação |
|----------|-------------------------|
| **stats** | Visão geral do tenant: total de usuários, workspaces, buscas e análises. |
| **users** / **users/[id]** | Identificar usuário, plano e workspaces; suporte a tickets e auditoria de acesso. |
| **workspaces** / **workspaces/[id]** | Ver plano, limites, uso (leadsUsed/leadsLimit) e membros do workspace. |
| **search-history** | Auditoria de buscas por workspace; filtrar por `workspaceId` para isolar um cliente. |
| **leads** | Listar análises de leads por workspace; suporte e revisão de uso do produto. |

Todos os endpoints são **somente leitura** (GET). Paginação (`limit`, `offset`) e filtro opcional (`workspaceId` em history e leads) permitem consultas grandes sem sobrecarga. Para rastrear ações de suporte, usar logs da aplicação e listagens acima; extensão futura pode incluir audit log de ações admin.
