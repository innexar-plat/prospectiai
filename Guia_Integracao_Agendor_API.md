
Guia de Integração
API Agendor v3
Para SaaS de Prospecção — Node.js
Base URL
https://api.agendor.com.br/v3
Autenticação via token no header Authorization

Sumário
1. Autenticação e Configuração
2. Conexão do Cliente (Token Flow)
3. Recursos Disponíveis
4. Fluxo de Prospecção — Envio de Leads
5. Deals e Funil de Vendas
6. Tarefas (Tasks)
7. Upsert — Sem Duplicatas
8. Limites e Boas Práticas
9. Códigos de Retorno HTTP

1. Autenticação e Configuração
O Agendor usa autenticação por Token estático. Não há OAuth 2.0 — cada usuário possui um token pessoal gerado no painel.

Como o cliente obtém o token
    1. Acesse web.agendor.com.br e faça login
    2. Vá em Menu → Integrações → API Token
    3. Copie o token exibido (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    4. Cole no campo de integração do seu SaaS
⚠️  Atenção — Token por usuário
Cada cliente conecta a própria conta Agendor individualmente.
Armazene tokens criptografados no banco (AES-256 ou secrets manager).
Somente administradores da conta Agendor conseguem gerar tokens.
Token não expira automaticamente, mas pode ser regenerado pelo usuário.

Header de autenticação
Todas as requisições devem incluir o header:

Authorization: Token SEU_TOKEN_AQUI
Content-Type: application/json

Validar token (GET /users/me)
Use este endpoint para verificar se o token é válido antes de salvar:

// Node.js — validar token do cliente
async function validateAgendorToken(token) {
  const res = await fetch('https://api.agendor.com.br/v3/users/me', {
    headers: { 'Authorization': `Token ${token}` }
  });
  if (!res.ok) throw new Error('Token inválido');
  const { data } = await res.json();
  return { id: data.id, name: data.name, accountId: data.accountId };
}

2. Conexão do Cliente (Token Flow)
Como o Agendor não possui OAuth 2.0, o fluxo de conexão é feito manualmente pelo cliente, mas pode ser otimizado com boa UX.

Fluxo recomendado no seu SaaS
// Passo 1 — Cliente cola o token na tela de integrações
// Passo 2 — Seu backend valida e salva

async function connectAgendor(userId, token) {
  // Valida o token na API do Agendor
  const agendorUser = await validateAgendorToken(token);

  // Salva criptografado associado ao userId do seu SaaS
  await db.integrations.upsert({
    userId,
    provider: 'agendor',
    token: encrypt(token),
    agendorUserId: agendorUser.id,
    agendorAccountId: agendorUser.accountId,
    connectedAt: new Date(),
    status: 'active'
  });

  return agendorUser; // Retorna { id, name } para exibir na UI
}

✅  Dica de UX — Mostre confirmação imediata
Após validar, exiba: "Conectado como [nome do usuário] — Conta Agendor #[accountId]"
Coloque um link direto para web.agendor.com.br/integracoes para facilitar a cópia do token.
Mostre um badge de status na tela principal: verde = conectado, vermelho = token inválido.

3. Recursos Disponíveis
A API v3 do Agendor oferece os seguintes recursos principais para um SaaS de prospecção:

Método	Endpoint	Descrição
GET	/users/me	Validar token e obter dados do usuário autenticado
GET	/users	Listar usuários da conta
POST	/people	Criar contato (pessoa física / lead B2C)
POST	/people/upsert	Criar ou atualizar pessoa por CPF ou email
GET	/people	Listar e buscar pessoas
PUT	/people/{id}	Atualizar pessoa existente
DELETE	/people/{id}	Remover pessoa
POST	/organizations	Criar empresa (lead B2B)
POST	/organizations/upsert	Criar ou atualizar empresa por nome ou CNPJ
GET	/organizations	Listar e buscar empresas
PUT	/organizations/{id}	Atualizar empresa existente
POST	/people/{id}/deals	Criar negócio vinculado a pessoa
POST	/organizations/{id}/deals	Criar negócio vinculado a empresa
PUT	/deals/{id}/stage	Mover negócio de etapa no funil
PUT	/deals/{id}/status	Marcar negócio como ganho, perdido ou reabrir
GET	/deals	Listar e filtrar negócios
POST	/people/{id}/tasks	Criar tarefa vinculada a pessoa
POST	/organizations/{id}/tasks	Criar tarefa vinculada a empresa
POST	/deals/{id}/tasks	Criar tarefa vinculada a negócio
GET	/funnels	Listar funis da conta
GET	/deal_stages	Listar etapas do funil
GET	/lead_origins	Listar origens de lead configuradas
GET	/categories	Listar categorias

4. Fluxo de Prospecção — Envio de Leads
O fluxo principal do seu SaaS é enviar leads prospectados para o Agendor do cliente. Existem dois caminhos dependendo do modelo de negócio (B2B ou B2C).

B2B — Criar empresa + pessoa de contato
Para prospecção B2B, crie primeiro a organização (empresa) e depois vincule a pessoa (contato) a ela:

async function sendB2BLeadToAgendor(userId, lead) {
  const token = decrypt(await getAgendorToken(userId));
  const headers = {
    'Authorization': `Token ${token}`,
    'Content-Type': 'application/json'
  };

  // 1. Criar a empresa
  const orgRes = await fetch('https://api.agendor.com.br/v3/organizations/upsert', {
    method: 'POST', headers,
    body: JSON.stringify({
      name: lead.companyName,
      cnpj: lead.cnpj?.replace(/\D/g, ''),   // apenas dígitos
      legalName: lead.razaoSocial,
      contact: { email: lead.companyEmail },
      address: { state: lead.state, cityName: lead.city }
    })
  });
  const { data: org } = await orgRes.json();

  // 2. Criar o contato vinculado à empresa
  const personRes = await fetch('https://api.agendor.com.br/v3/people/upsert', {
    method: 'POST', headers,
    body: JSON.stringify({
      name: lead.contactName,
      organization: org.id,
      role: lead.jobTitle,
      contact: {
        email: lead.email,
        mobile: lead.phone,
        whatsapp: lead.whatsapp,
        linked_in: lead.linkedin
      }
    })
  });
  const { data: person } = await personRes.json();
  return { org, person };
}

B2C — Criar apenas pessoa
async function sendB2CLeadToAgendor(userId, lead) {
  const token = decrypt(await getAgendorToken(userId));
  const res = await fetch('https://api.agendor.com.br/v3/people/upsert', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: lead.name,
      cpf: lead.cpf?.replace(/\D/g, ''),
      contact: {
        email: lead.email,
        mobile: lead.phone,
        whatsapp: lead.whatsapp
      }
    })
  });
  const { data } = await res.json();
  return data;
}

Campos de contato disponíveis
Campo	Tipo	Descrição
email	string (email)	Email principal
work	string	Telefone comercial
mobile	string	Celular
fax	string	Fax
whatsapp	string	WhatsApp
facebook	string	Perfil Facebook
twitter	string	Perfil Twitter/X
instagram	string	Perfil Instagram
linked_in	string	Perfil LinkedIn
skype	string	Usuário Skype

5. Deals e Funil de Vendas
Após criar o lead, você pode criar um Deal (negócio) para rastrear a oportunidade no funil de vendas do Agendor do cliente.

Criar deal vinculado a uma pessoa
async function createDeal(userId, personId, dealData) {
  const token = decrypt(await getAgendorToken(userId));
  const res = await fetch(
    `https://api.agendor.com.br/v3/people/${personId}/deals`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: dealData.title,          // Ex: 'Proposta Empresa XYZ'
        value: dealData.value,          // Valor monetário (float)
        dealStage: 1,                   // Etapa inicial do funil (começa em 1)
        dealStatusText: 'ongoing',      // 'ongoing' | 'won' | 'lost'
        description: dealData.notes
      })
    }
  );
  const { data } = await res.json();
  return data; // Retorna o deal criado com id
}

Mover deal no funil
// Avançar para a próxima etapa
async function moveDealStage(userId, dealId, stage) {
  const token = decrypt(await getAgendorToken(userId));
  await fetch(`https://api.agendor.com.br/v3/deals/${dealId}/stage`, {
    method: 'PUT',
    headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealStage: stage }) // Número da etapa (1, 2, 3...)
  });
}

// Marcar como ganho
async function wonDeal(userId, dealId) {
  const token = decrypt(await getAgendorToken(userId));
  await fetch(`https://api.agendor.com.br/v3/deals/${dealId}/status`, {
    method: 'PUT',
    headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealStatusText: 'won' })
  });
}

6. Tarefas (Tasks)
Crie tarefas de follow-up diretamente no Agendor para que o time comercial do cliente saiba o próximo passo com cada lead.

Tipos de tarefa disponíveis
Tipo	Descrição
VISITA	Visita presencial ao cliente
REUNIAO	Reunião (presencial ou online)
LIGACAO	Ligação telefônica
EMAIL	Envio de email
PROPOSTA	Envio de proposta comercial
WHATSAPP	Mensagem via WhatsApp

Criar tarefa de follow-up
async function createFollowUp(userId, personId, followUp) {
  const token = decrypt(await getAgendorToken(userId));
  const res = await fetch(
    `https://api.agendor.com.br/v3/people/${personId}/tasks`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: followUp.description,       // Ex: 'Ligar para apresentar proposta'
        type: followUp.type,              // 'LIGACAO', 'WHATSAPP', etc.
        due_date: followUp.dueDate,       // ISO 8601: '2025-01-15T10:00:00Z'
      })
    }
  );
  const { data } = await res.json();
  return data;
}

7. Upsert — Sem Duplicatas
O Agendor possui endpoints de upsert que criam o registro se não existir, ou atualizam se já existir. Essencial para evitar duplicatas na base do cliente.

Como funciona o upsert
POST /people/upsert   → busca por CPF ou email. Se encontrar, atualiza. Se não, cria.
POST /organizations/upsert → busca por nome (exact match) ou CNPJ. Se encontrar, atualiza. Se não, cria.
Ambos retornam o registro final (criado ou atualizado) com status 200 ou 201.

Estratégia recomendada para prospecção
    • Sempre use /upsert ao invés de /POST direto para evitar duplicatas.
    • Passe o email como identificador para pessoas — é o campo mais confiável.
    • Passe o CNPJ para organizações sempre que disponível.
    • Se não tiver CPF/CNPJ, use nome + email como combinação de busca.

8. Limites e Boas Práticas

Rate limit
⚠️  Limite: 4 requisições por segundo por token
Status 429 (Too Many Requests) é retornado quando o limite é excedido.
Implemente uma fila com delay de 250ms entre requisições (4 req/s = 1 req a cada 250ms).
Para importações em lote, processe em filas assíncronas (Bull, BullMQ, etc.).

Implementar retry com rate limit
async function agendorRequest(token, url, options = {}) {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (res.status === 429) {
      // Rate limit — aguarda e tenta novamente
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      attempt++;
      continue;
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Agendor API error ${res.status}: ${JSON.stringify(err)}`);
    }

    return res.json();
  }
  throw new Error('Rate limit excedido após 3 tentativas');
}

Paginação
Endpoints de listagem retornam paginados (10 itens por padrão, máximo 100 por página):

// Buscar todos os leads de uma vez (paginação automática)
async function getAllPeople(token) {
  let page = 1;
  let allPeople = [];

  while (true) {
    const { data, meta } = await agendorRequest(token,
      `https://api.agendor.com.br/v3/people?page=${page}&per_page=100`
    );
    allPeople = [...allPeople, ...data];
    if (allPeople.length >= meta.totalCount) break;
    page++;
    await new Promise(r => setTimeout(r, 250)); // respeita rate limit
  }
  return allPeople;
}

Boas práticas de segurança
    • Nunca exponha o token no frontend — toda chamada à API do Agendor deve ser feita pelo seu backend.
    • Criptografe tokens no banco de dados (AES-256-GCM ou AWS Secrets Manager / GCP Secret Manager).
    • Crie uma rota de desconexão que apague o token do banco quando o cliente desativar a integração.
    • Monitore erros 401 — token pode ter sido regenerado pelo cliente. Mostre alerta na UI.
    • Separe tokens por ambiente: nunca use token de produção em testes.

9. Códigos de Retorno HTTP

Status	Significado
200 OK	Requisição bem-sucedida (GET, PUT, DELETE)
201 Created	Recurso criado com sucesso (POST)
400 Bad Request	Formato dos dados incorreto — verifique o body JSON
401 Unauthorized	Token inválido, expirado ou ausente no header
404 Not Found	Rota ou recurso não existe (verifique o ID)
429 Too Many Requests	Rate limit atingido (máx. 4 req/s) — implemente retry
500 Internal Server Error	Erro inesperado do Agendor — notifique o suporte
503 Service Unavailable	API temporariamente indisponível — tente novamente em instantes
504 Gateway Timeout	Timeout na requisição — tente novamente e notifique se persistir

📖  Recursos adicionais
Documentação oficial:  api.agendor.com.br/docs
Central de ajuda:      ajuda.agendor.com.br
Biblioteca Postman:    disponível na central de ajuda do Agendor
Email de suporte:      contato@agendor.com.br
