/** SuportePage — instructions, FAQ, integration guides (pt / en / es). */

import type { Market } from '@/lib/market';

export type FaqItemDef = {
    qKey: string;
    aKey: string;
    /** Omit for all markets; otherwise shown only for listed markets. */
    markets?: Market[];
};

export type FaqGroupDef = {
    groupKey: string;
    iconName: string;
    items: FaqItemDef[];
};

export const INSTRUCTION_KEYS = [
    { step: 1, titleKey: 'support.instr.1.title', bodyKey: 'support.instr.1.body', iconName: 'Search' },
    { step: 2, titleKey: 'support.instr.2.title', bodyKey: 'support.instr.2.body', iconName: 'Star' },
    { step: 3, titleKey: 'support.instr.3.title', bodyKey: 'support.instr.3.body', iconName: 'Target' },
    { step: 4, titleKey: 'support.instr.4.title', bodyKey: 'support.instr.4.body', iconName: 'BarChart3' },
    { step: 5, titleKey: 'support.instr.5.title', bodyKey: 'support.instr.5.body', iconName: 'Plug' },
    { step: 6, titleKey: 'support.instr.6.title', bodyKey: 'support.instr.6.body', iconName: 'Users' },
] as const;

export const FAQ_STRUCTURE: FaqGroupDef[] = [
    {
        groupKey: 'support.faq.group.search',
        iconName: 'Search',
        items: [
            { qKey: 'support.faq.search.q1', aKey: 'support.faq.search.a1' },
            { qKey: 'support.faq.search.q2', aKey: 'support.faq.search.a2' },
            { qKey: 'support.faq.search.q3', aKey: 'support.faq.search.a3' },
            { qKey: 'support.faq.search.q4', aKey: 'support.faq.search.a4' },
            { qKey: 'support.faq.search.q5', aKey: 'support.faq.search.a5.br', markets: ['BR'] },
            { qKey: 'support.faq.search.q5.us', aKey: 'support.faq.search.a5.us', markets: ['US'] },
        ],
    },
    {
        groupKey: 'support.faq.group.leads',
        iconName: 'Target',
        items: [
            { qKey: 'support.faq.leads.q1', aKey: 'support.faq.leads.a1' },
            { qKey: 'support.faq.leads.q2', aKey: 'support.faq.leads.a2' },
            { qKey: 'support.faq.leads.q3', aKey: 'support.faq.leads.a3' },
            { qKey: 'support.faq.leads.q4', aKey: 'support.faq.leads.a4' },
        ],
    },
    {
        groupKey: 'support.faq.group.credits',
        iconName: 'CreditCard',
        items: [
            { qKey: 'support.faq.credits.q1', aKey: 'support.faq.credits.a1' },
            { qKey: 'support.faq.credits.q2', aKey: 'support.faq.credits.a2' },
            { qKey: 'support.faq.credits.q3', aKey: 'support.faq.credits.a3' },
            { qKey: 'support.faq.credits.q4', aKey: 'support.faq.credits.a4.br', markets: ['BR'] },
            { qKey: 'support.faq.credits.q5', aKey: 'support.faq.credits.a5.br', markets: ['BR'] },
            { qKey: 'support.faq.credits.q4.us', aKey: 'support.faq.credits.a4.us', markets: ['US'] },
            { qKey: 'support.faq.credits.q5.us', aKey: 'support.faq.credits.a5.us', markets: ['US'] },
        ],
    },
    {
        groupKey: 'support.faq.group.integrations',
        iconName: 'Plug',
        items: [
            { qKey: 'support.faq.integrations.q1', aKey: 'support.faq.integrations.a1' },
            { qKey: 'support.faq.integrations.q2', aKey: 'support.faq.integrations.a2' },
            { qKey: 'support.faq.integrations.q3', aKey: 'support.faq.integrations.a3' },
            { qKey: 'support.faq.integrations.q4', aKey: 'support.faq.integrations.a4' },
            { qKey: 'support.faq.integrations.q5', aKey: 'support.faq.integrations.a5' },
            { qKey: 'support.faq.integrations.q6', aKey: 'support.faq.integrations.a6' },
        ],
    },
    {
        groupKey: 'support.faq.group.score',
        iconName: 'Star',
        items: [
            { qKey: 'support.faq.score.q1', aKey: 'support.faq.score.a1' },
            { qKey: 'support.faq.score.q2', aKey: 'support.faq.score.a2' },
            { qKey: 'support.faq.score.q3', aKey: 'support.faq.score.a3' },
        ],
    },
    {
        groupKey: 'support.faq.group.team',
        iconName: 'Users',
        items: [
            { qKey: 'support.faq.team.q1', aKey: 'support.faq.team.a1' },
            { qKey: 'support.faq.team.q2', aKey: 'support.faq.team.a2' },
        ],
    },
    {
        groupKey: 'support.faq.group.security',
        iconName: 'Shield',
        items: [
            { qKey: 'support.faq.security.q1', aKey: 'support.faq.security.a1' },
            { qKey: 'support.faq.security.q2', aKey: 'support.faq.security.a2' },
            { qKey: 'support.faq.security.q3', aKey: 'support.faq.security.a3' },
        ],
    },
];

export const SUPPORT_MESSAGES: Record<string, Record<string, string>> = {
    pt: {
        'support.instr.1.title': 'Nova Busca',
        'support.instr.1.body':
            'Em Prospecção > Nova Busca, defina país, estado, cidade e raio. Escolha o nicho ou use um template rápido. Filtre por website e telefone para leads mais qualificados.',
        'support.instr.2.title': 'Resultados com IA',
        'support.instr.2.body':
            'Cada lead recebe um Score de Oportunidade (0-100) e classificação hot/warm/cold. Cards mostram avaliação Google, website, telefone e endereço. Filtre por "Com site", "Com tel." ou "Score ≥60".',
        'support.instr.3.title': 'Leads salvos',
        'support.instr.3.body':
            'Salve os melhores leads com um clique. Em Leads Salvos, gerencie status (novo, contactado, convertido), veja análises de IA e exporte para CSV.',
        'support.instr.4.title': 'Inteligência IA',
        'support.instr.4.body':
            'Concorrência (Growth), Relatórios e Análise da empresa (Business), Viabilidade (Enterprise): módulos avançados por plano para decisões estratégicas.',
        'support.instr.5.title': 'Integrações CRM',
        'support.instr.5.body':
            'Conecte RD Station (OAuth) ou Agendor (token) para enviar leads com dados enriquecidos, negociações, notas com análise de IA e tarefas de follow-up automáticas.',
        'support.instr.6.title': 'Equipe',
        'support.instr.6.body':
            'No plano Enterprise, convide vendedores, distribua territórios e acompanhe performance no Dashboard da equipe.',

        'support.integr.rd.step1': 'Vá em Integrações',
        'support.integr.rd.step2': 'Clique "Conectar com OAuth"',
        'support.integr.rd.step3': 'Autorize no RD Station',
        'support.integr.rd.step4': 'Pronto! Status ficará "Conectado"',
        'support.integr.rd.note':
            'Suporta CRM e Marketing. Cria contatos, negócios, notas e tarefas.',

        'support.integr.agendor.step1': 'No Agendor: Configurações → Integrações',
        'support.integr.agendor.step2': 'Copie o Token de API',
        'support.integr.agendor.step3': 'No Precision: Integrações → Agendor',
        'support.integr.agendor.step4': 'Cole o token e clique "Salvar"',
        'support.integr.agendor.note':
            'Cria pessoa, organização, negociação e tarefa de follow-up.',

        'support.faq.group.search': 'Busca e prospecção',
        'support.faq.search.q1': 'Como funciona a busca de leads?',
        'support.faq.search.a1':
            'O Precision usa o Google Places para buscar empresas reais por nicho e região. Defina país, estado, cidade, raio de busca e o tipo de negócio. A IA classifica cada resultado com um score de oportunidade de 0 a 100.',
        'support.faq.search.q2': 'O que são os templates rápidos?',
        'support.faq.search.a2':
            'São nichos pré-configurados (Restaurantes, Salões, Academias, etc.) que preenchem a busca com um clique. Ideal para prospectar rapidamente sem configurar filtros manualmente.',
        'support.faq.search.q3': 'Para que servem os filtros de website e telefone?',
        'support.faq.search.a3':
            'Os filtros "Com site" e "Com telefone" ajudam a encontrar leads mais qualificados. Empresas sem site são ótimas oportunidades para agências digitais. Empresas com telefone facilitam o contato direto.',
        'support.faq.search.q4': 'O que significa o Score de Oportunidade?',
        'support.faq.search.a4':
            'O Score IA analisa presença digital, avaliações Google, volume de reviews e outros fatores para gerar uma pontuação de 0 a 100. Classificação: Hot (≥70), Warm (40-69), Cold (<40). Quanto maior, mais fácil converter.',
        'support.faq.search.q5': 'O que é CNAE e como usar na busca?',
        'support.faq.search.a5.br':
            'CNAE é o código de atividade econômica da Receita Federal. Nos filtros avançados você pode buscar por CNAE específico (ex.: 5611201 para restaurantes) para segmentar empresas com precisão fiscal. Templates rápidos já sugerem CNAEs comuns por nicho.',
        'support.faq.search.a5.us':
            'Use city, state, category, and radius filters to narrow results. Advanced filters let you target businesses with or without a website and phone number — ideal for outbound sales. Results come from Google Places with real ratings and contact data.',

        'support.faq.group.leads': 'Leads e resultados',
        'support.faq.leads.q1': 'Como salvar um lead?',
        'support.faq.leads.a1':
            'Nos resultados da busca, clique no ícone de bookmark ao lado do lead. Ele será salvo em Prospecção > Leads Salvos com todos os dados (telefone, website, score, endereço).',
        'support.faq.leads.q2': 'Os filtros rápidos dos resultados afetam a busca?',
        'support.faq.leads.a2':
            'Não. Os chips "Com site", "Com tel." e "Score ≥60" são filtros visuais que organizam os resultados já carregados. A busca no servidor não é refeita.',
        'support.faq.leads.q3': 'Posso comparar leads lado a lado?',
        'support.faq.leads.a3':
            'Sim! Selecione até 3 leads usando os checkboxes e clique em "Comparar". Uma tabela comparativa mostra score, avaliação, reviews, website, telefone e mais.',
        'support.faq.leads.q4': 'Como exportar resultados para CSV?',
        'support.faq.leads.a4':
            'Nos resultados da busca, clique em "Exportar CSV" (disponível a partir do plano Starter). O arquivo inclui todos os dados dos leads exibidos.',

        'support.faq.group.credits': 'Créditos e planos',
        'support.faq.credits.q1': 'Como funcionam os créditos?',
        'support.faq.credits.a1.br':
            'Cada análise de lead com IA consome 1 crédito. O número depende do plano: Free (10/mês), Starter R$129 (100/mês), Growth R$397 (400/mês), Business R$997 (1.200/mês) e Enterprise (5.000/mês). Créditos renovam automaticamente.',
        'support.faq.credits.a1.us':
            'Cada análise de lead com IA consome 1 crédito. O plano Starter custa $19/mês e inclui 50 créditos. Créditos renovam automaticamente a cada ciclo de cobrança.',
        'support.faq.credits.q2': 'Posso cancelar a qualquer momento?',
        'support.faq.credits.a2':
            'Sim! Cancele em Planos a qualquer momento. O acesso continua até o fim do período já pago. Não há multa de cancelamento.',
        'support.faq.credits.q3': 'A busca consome créditos?',
        'support.faq.credits.a3':
            'As buscas por leads são gratuitas. Apenas a análise detalhada com IA (que gera score, classificação e estratégia) consome créditos.',
        'support.faq.credits.q4': 'Como funciona o período de teste?',
        'support.faq.credits.a4.br':
            'Novos usuários no Brasil recebem créditos gratuitos para testar análises de IA. O trial permite explorar buscas, resultados e análises antes de assinar. Após o trial, escolha um plano em Planos — pagamento via Mercado Pago (cartão, Pix ou boleto).',
        'support.faq.credits.q5': 'Como pagar com Mercado Pago?',
        'support.faq.credits.a5.br':
            'Em Planos, selecione o plano desejado e clique em Assinar. Você será redirecionado ao checkout Mercado Pago com opções de cartão de crédito, Pix e boleto. A assinatura renova automaticamente; cancele a qualquer momento em Planos.',
        'support.faq.credits.q4.us': 'Como funciona a cobrança com Stripe?',
        'support.faq.credits.a4.us':
            'Assinaturas nos EUA são processadas com segurança via Stripe. Escolha um plano em Planos, informe os dados do cartão no checkout Stripe e a assinatura renova automaticamente a cada mês. Atualize o cartão ou cancele a qualquer momento em Planos.',
        'support.faq.credits.q5.us': 'Quais planos e créditos estão disponíveis nos EUA?',
        'support.faq.credits.a5.us':
            'Starter ($19/mês) inclui 50 créditos de análise IA. Growth ($49/mês) inclui 200 créditos. Business ($99/mês) inclui 600 créditos. Enterprise oferece limites personalizados. Buscas são sempre gratuitas; apenas análises IA consomem créditos.',
        'support.faq.search.q5.us': 'Como refinar buscas nos EUA?',

        'support.faq.group.integrations': 'Integrações CRM',
        'support.faq.integrations.q1': 'Como conectar o RD Station?',
        'support.faq.integrations.a1':
            'Vá em Integrações > RD Station > Conectar com OAuth. Você será redirecionado para autorizar o acesso. A conexão é feita com um clique, sem código. Detalhes completos na nossa página de integração.',
        'support.faq.integrations.q2': 'Como conectar o Agendor?',
        'support.faq.integrations.a2':
            'Vá em Integrações > Agendor e cole seu Token de API. Para obter o token: acesse web.agendor.com.br > Configurações > Integrações > copie o token. Cole no Precision e salve.',
        'support.faq.integrations.q3': 'O que é enviado ao CRM quando envio um lead?',
        'support.faq.integrations.a3':
            'No modo "Contato + Negócio": cria contato com dados completos, organização, negociação com análise de IA na descrição (resumo, pontos fortes/fracos, scripts de abordagem, mensagem WhatsApp) e tarefa de follow-up automática.',
        'support.faq.integrations.q4': 'Os contatos são duplicados se eu enviar duas vezes?',
        'support.faq.integrations.a4':
            'No Agendor, usamos upsert (deduplicação por e-mail). No RD Station CRM, o contato é atualizado se já existir. Não há duplicação.',
        'support.faq.integrations.q5': 'Meu token/credenciais ficam seguros?',
        'support.faq.integrations.a5':
            'Sim. Tokens do Agendor são criptografados no banco de dados. O RD Station usa OAuth 2.0 com HMAC-SHA256 e refresh automático. Nenhuma credencial é exposta no frontend.',
        'support.faq.integrations.q6': 'Posso escolher funil e etapa da negociação?',
        'support.faq.integrations.a6':
            'Sim! No painel lateral CRM, selecione o funil, etapa e responsável antes de enviar. Funciona tanto para RD Station quanto Agendor.',

        'support.faq.group.score': 'Score e análises',
        'support.faq.score.q1': 'Como funciona a Análise de Concorrência?',
        'support.faq.score.a1':
            'O sistema busca concorrentes na região e gera rankings por avaliação Google, volume de reviews e presença digital. Identifica gaps de mercado (empresas sem site). Disponível no plano Growth.',
        'support.faq.score.q2': 'O que é a Análise de Viabilidade?',
        'support.faq.score.a2':
            'Informe tipo de negócio e cidade. A IA analisa dados reais (concorrentes, saturação, maturidade digital) e gera um score de viabilidade com recomendações de diferenciação. Plano Enterprise.',
        'support.faq.score.q3': 'O que é a Análise "Minha Empresa"?',
        'support.faq.score.a3':
            'Cadastre sua empresa e a IA analisa seu posicionamento digital: avaliações, presença online, posição vs. concorrentes. Gera recommendations para melhorar. Plano Business.',

        'support.faq.group.team': 'Equipe',
        'support.faq.team.q1': 'Como convido membros para minha equipe?',
        'support.faq.team.a1':
            'Na página Equipe > Minha Equipe (plano Enterprise), clique em "Convidar Membro" e insira o e-mail. O usuário recebe um convite e se junta à equipe após aceitar.',
        'support.faq.team.q2': 'Posso controlar o que cada membro vê?',
        'support.faq.team.a2':
            'Membros compartilham o mesmo plano e créditos da equipe. O admin acompanha uso individual no Dashboard da equipe.',

        'support.faq.group.security': 'Conta e segurança',
        'support.faq.security.q1': 'Os dados são reais?',
        'support.faq.security.a1':
            'Sim! Usamos o Google Places API para dados reais e atualizados de empresas. Avaliações, telefones, websites e endereços são dados oficiais do Google. As análises são feitas com Gemini AI.',
        'support.faq.security.q2': 'Como altero minha senha?',
        'support.faq.security.a2':
            'Em Conta > Configurações você encontra a opção de alterar senha. Se esqueceu, use "Esqueci minha senha" na tela de login.',
        'support.faq.security.q3': 'Meus dados estão seguros?',
        'support.faq.security.a3':
            'Sim. Usamos HTTPS em todas as comunicações, headers de segurança (CSP, HSTS), rate limiting, tokens criptografados e autenticação OAuth 2.0. Seguimos as melhores práticas OWASP.',
    },

    en: {
        'support.instr.1.title': 'New Search',
        'support.instr.1.body':
            'Under Prospecting > New Search, set country, state, city, and radius. Choose a niche or use a quick template. Filter by website and phone for more qualified leads.',
        'support.instr.2.title': 'AI Results',
        'support.instr.2.body':
            'Each lead gets an Opportunity Score (0–100) and hot/warm/cold classification. Cards show Google rating, website, phone, and address. Filter by "With website", "With phone", or "Score ≥60".',
        'support.instr.3.title': 'Saved leads',
        'support.instr.3.body':
            'Save your best leads with one click. In Saved Leads, manage status (new, contacted, converted), view AI analyses, and export to CSV.',
        'support.instr.4.title': 'AI Intelligence',
        'support.instr.4.body':
            'Competition (Growth), Reports and Company Analysis (Business), Viability (Enterprise): advanced modules by plan for strategic decisions.',
        'support.instr.5.title': 'CRM Integrations',
        'support.instr.5.body':
            'Connect RD Station (OAuth) or Agendor (token) to send leads with enriched data, deals, notes with AI analysis, and automatic follow-up tasks.',
        'support.instr.6.title': 'Team',
        'support.instr.6.body':
            'On the Enterprise plan, invite sales reps, assign territories, and track performance on the Team Dashboard.',

        'support.integr.rd.step1': 'Go to Integrations',
        'support.integr.rd.step2': 'Click "Connect with OAuth"',
        'support.integr.rd.step3': 'Authorize in RD Station',
        'support.integr.rd.step4': 'Done! Status will show "Connected"',
        'support.integr.rd.note':
            'Supports CRM and Marketing. Creates contacts, deals, notes, and tasks.',

        'support.integr.agendor.step1': 'In Agendor: Settings → Integrations',
        'support.integr.agendor.step2': 'Copy the API Token',
        'support.integr.agendor.step3': 'In Precision: Integrations → Agendor',
        'support.integr.agendor.step4': 'Paste the token and click "Save"',
        'support.integr.agendor.note':
            'Creates person, organization, deal, and follow-up task.',

        'support.faq.group.search': 'Search & prospecting',
        'support.faq.search.q1': 'How does lead search work?',
        'support.faq.search.a1':
            'Precision uses Google Places to find real businesses by niche and region. Set country, state, city, search radius, and business type. AI scores each result with an opportunity score from 0 to 100.',
        'support.faq.search.q2': 'What are quick templates?',
        'support.faq.search.a2':
            'Pre-configured niches (Restaurants, Salons, Gyms, etc.) that fill the search with one click. Ideal for fast prospecting without manual filter setup.',
        'support.faq.search.q3': 'What are the website and phone filters for?',
        'support.faq.search.a3':
            'The "With website" and "With phone" filters help find more qualified leads. Businesses without a website are great opportunities for digital agencies. Businesses with a phone make direct outreach easier.',
        'support.faq.search.q4': 'What does the Opportunity Score mean?',
        'support.faq.search.a4':
            'The AI Score analyzes digital presence, Google ratings, review volume, and other factors to produce a 0–100 score. Classification: Hot (≥70), Warm (40–69), Cold (<40). Higher scores mean easier conversion.',
        'support.faq.search.q5': 'What is CNAE and how do I use it in search?',
        'support.faq.search.a5.br':
            'CNAE is the Brazilian economic activity code. In advanced filters you can search by specific CNAE (e.g. 5611201 for restaurants) to segment businesses with tax precision. Quick templates already suggest common CNAEs per niche.',
        'support.faq.search.q5.us': 'How do I refine searches in the US?',
        'support.faq.search.a5.us':
            'Use city, state, category, and radius filters to narrow results. Advanced filters let you target businesses with or without a website and phone number — ideal for outbound sales. Results come from Google Places with real ratings and contact data.',

        'support.faq.group.leads': 'Leads & results',
        'support.faq.leads.q1': 'How do I save a lead?',
        'support.faq.leads.a1':
            'In search results, click the bookmark icon next to the lead. It will be saved under Prospecting > Saved Leads with all data (phone, website, score, address).',
        'support.faq.leads.q2': 'Do quick result filters affect the search?',
        'support.faq.leads.a2':
            'No. The "With website", "With phone", and "Score ≥60" chips are visual filters that organize already loaded results. The server search is not re-run.',
        'support.faq.leads.q3': 'Can I compare leads side by side?',
        'support.faq.leads.a3':
            'Yes! Select up to 3 leads using the checkboxes and click "Compare". A comparison table shows score, rating, reviews, website, phone, and more.',
        'support.faq.leads.q4': 'How do I export results to CSV?',
        'support.faq.leads.a4':
            'In search results, click "Export CSV" (available from the Starter plan). The file includes all data for displayed leads.',

        'support.faq.group.credits': 'Credits & plans',
        'support.faq.credits.q1': 'How do credits work?',
        'support.faq.credits.a1.br':
            'Each AI lead analysis uses 1 credit. Amount depends on plan: Free (10/month), Starter R$129 (100/month), Growth R$397 (400/month), Business R$997 (1,200/month), and Enterprise (5,000/month). Credits renew automatically.',
        'support.faq.credits.a1.us':
            'Each AI lead analysis uses 1 credit. The Starter plan costs $19/month and includes 50 credits. Credits renew automatically each billing cycle.',
        'support.faq.credits.q2': 'Can I cancel anytime?',
        'support.faq.credits.a2':
            'Yes! Cancel under Plans at any time. Access continues until the end of the paid period. There is no cancellation fee.',
        'support.faq.credits.q3': 'Does search consume credits?',
        'support.faq.credits.a3':
            'Lead searches are free. Only detailed AI analysis (which generates score, classification, and strategy) consumes credits.',
        'support.faq.credits.q4': 'How does the free trial work?',
        'support.faq.credits.a4.br':
            'New users in Brazil receive free credits to test AI analyses. The trial lets you explore searches, results, and analyses before subscribing. After the trial, choose a plan under Plans — payment via Mercado Pago (card, Pix, or boleto).',
        'support.faq.credits.q5': 'How do I pay with Mercado Pago?',
        'support.faq.credits.a5.br':
            'Under Plans, select your plan and click Subscribe. You will be redirected to Mercado Pago checkout with credit card, Pix, and boleto options. Subscription renews automatically; cancel anytime under Plans.',
        'support.faq.credits.q4.us': 'How does billing work with Stripe?',
        'support.faq.credits.a4.us':
            'US subscriptions are processed securely via Stripe. Choose a plan under Plans, enter your card on the Stripe checkout page, and your subscription renews automatically each month. Update payment method or cancel anytime from Plans.',
        'support.faq.credits.q5.us': 'What plans and credits are available in the US?',
        'support.faq.credits.a5.us':
            'Starter ($19/mo) includes 50 AI analysis credits. Growth ($49/mo) includes 200 credits. Business ($99/mo) includes 600 credits. Enterprise offers custom limits. Searches are always free; only AI lead analyses consume credits.',

        'support.faq.group.integrations': 'CRM integrations',
        'support.faq.integrations.q1': 'How do I connect RD Station?',
        'support.faq.integrations.a1':
            'Go to Integrations > RD Station > Connect with OAuth. You will be redirected to authorize access. Connection is one-click, no code required. Full details on our integration page.',
        'support.faq.integrations.q2': 'How do I connect Agendor?',
        'support.faq.integrations.a2':
            'Go to Integrations > Agendor and paste your API Token. To get the token: visit web.agendor.com.br > Settings > Integrations > copy the token. Paste it in Precision and save.',
        'support.faq.integrations.q3': 'What is sent to the CRM when I send a lead?',
        'support.faq.integrations.a3':
            'In "Contact + Deal" mode: creates a contact with full data, organization, deal with AI analysis in the description (summary, strengths/weaknesses, outreach scripts, WhatsApp message), and an automatic follow-up task.',
        'support.faq.integrations.q4': 'Are contacts duplicated if I send twice?',
        'support.faq.integrations.a4':
            'In Agendor, we use upsert (deduplication by email). In RD Station CRM, the contact is updated if it already exists. No duplication.',
        'support.faq.integrations.q5': 'Are my token/credentials secure?',
        'support.faq.integrations.a5':
            'Yes. Agendor tokens are encrypted in the database. RD Station uses OAuth 2.0 with HMAC-SHA256 and automatic refresh. No credentials are exposed in the frontend.',
        'support.faq.integrations.q6': 'Can I choose pipeline and deal stage?',
        'support.faq.integrations.a6':
            'Yes! In the CRM side panel, select pipeline, stage, and owner before sending. Works for both RD Station and Agendor.',

        'support.faq.group.score': 'Score & analysis',
        'support.faq.score.q1': 'How does Competitive Analysis work?',
        'support.faq.score.a1':
            'The system finds competitors in the region and generates rankings by Google rating, review volume, and digital presence. Identifies market gaps (businesses without a website). Available on the Growth plan.',
        'support.faq.score.q2': 'What is Viability Analysis?',
        'support.faq.score.a2':
            'Enter business type and city. AI analyzes real data (competitors, saturation, digital maturity) and generates a viability score with differentiation recommendations. Enterprise plan.',
        'support.faq.score.q3': 'What is "My Company" Analysis?',
        'support.faq.score.a3':
            'Register your company and AI analyzes your digital positioning: ratings, online presence, position vs. competitors. Generates recommendations to improve. Business plan.',

        'support.faq.group.team': 'Team',
        'support.faq.team.q1': 'How do I invite members to my team?',
        'support.faq.team.a1':
            'On Team > My Team (Enterprise plan), click "Invite Member" and enter the email. The user receives an invite and joins the team after accepting.',
        'support.faq.team.q2': 'Can I control what each member sees?',
        'support.faq.team.a2':
            'Members share the same plan and team credits. The admin tracks individual usage on the Team Dashboard.',

        'support.faq.group.security': 'Account & security',
        'support.faq.security.q1': 'Is the data real?',
        'support.faq.security.a1':
            'Yes! We use the Google Places API for real, up-to-date business data. Ratings, phones, websites, and addresses are official Google data. Analyses are powered by Gemini AI.',
        'support.faq.security.q2': 'How do I change my password?',
        'support.faq.security.a2':
            'Under Account > Settings you will find the change password option. If you forgot it, use "Forgot password" on the login screen.',
        'support.faq.security.q3': 'Is my data secure?',
        'support.faq.security.a3':
            'Yes. We use HTTPS for all communications, security headers (CSP, HSTS), rate limiting, encrypted tokens, and OAuth 2.0 authentication. We follow OWASP best practices.',
    },

    es: {
        'support.instr.1.title': 'Nueva Búsqueda',
        'support.instr.1.body':
            'En Prospección > Nueva Búsqueda, define país, estado, ciudad y radio. Elige el nicho o usa una plantilla rápida. Filtra por sitio web y teléfono para leads más calificados.',
        'support.instr.2.title': 'Resultados con IA',
        'support.instr.2.body':
            'Cada lead recibe un Score de Oportunidad (0-100) y clasificación hot/warm/cold. Las tarjetas muestran valoración de Google, sitio web, teléfono y dirección. Filtra por "Con sitio", "Con tel." o "Score ≥60".',
        'support.instr.3.title': 'Leads guardados',
        'support.instr.3.body':
            'Guarda los mejores leads con un clic. En Leads Guardados, gestiona el estado (nuevo, contactado, convertido), ve análisis de IA y exporta a CSV.',
        'support.instr.4.title': 'Inteligencia IA',
        'support.instr.4.body':
            'Competencia (Growth), Informes y Análisis de empresa (Business), Viabilidad (Enterprise): módulos avanzados por plan para decisiones estratégicas.',
        'support.instr.5.title': 'Integraciones CRM',
        'support.instr.5.body':
            'Conecta RD Station (OAuth) o Agendor (token) para enviar leads con datos enriquecidos, negociaciones, notas con análisis de IA y tareas de seguimiento automáticas.',
        'support.instr.6.title': 'Equipo',
        'support.instr.6.body':
            'En el plan Enterprise, invita vendedores, distribuye territorios y sigue el rendimiento en el Dashboard del equipo.',

        'support.integr.rd.step1': 'Ve a Integraciones',
        'support.integr.rd.step2': 'Haz clic en "Conectar con OAuth"',
        'support.integr.rd.step3': 'Autoriza en RD Station',
        'support.integr.rd.step4': '¡Listo! El estado mostrará "Conectado"',
        'support.integr.rd.note':
            'Compatible con CRM y Marketing. Crea contactos, negocios, notas y tareas.',

        'support.integr.agendor.step1': 'En Agendor: Configuración → Integraciones',
        'support.integr.agendor.step2': 'Copia el Token de API',
        'support.integr.agendor.step3': 'En Precision: Integraciones → Agendor',
        'support.integr.agendor.step4': 'Pega el token y haz clic en "Guardar"',
        'support.integr.agendor.note':
            'Crea persona, organización, negociación y tarea de seguimiento.',

        'support.faq.group.search': 'Búsqueda y prospección',
        'support.faq.search.q1': '¿Cómo funciona la búsqueda de leads?',
        'support.faq.search.a1':
            'Precision usa Google Places para buscar empresas reales por nicho y región. Define país, estado, ciudad, radio de búsqueda y tipo de negocio. La IA clasifica cada resultado con un score de oportunidad de 0 a 100.',
        'support.faq.search.q2': '¿Qué son las plantillas rápidas?',
        'support.faq.search.a2':
            'Son nichos preconfigurados (Restaurantes, Salones, Gimnasios, etc.) que completan la búsqueda con un clic. Ideal para prospectar rápido sin configurar filtros manualmente.',
        'support.faq.search.q3': '¿Para qué sirven los filtros de sitio web y teléfono?',
        'support.faq.search.a3':
            'Los filtros "Con sitio" y "Con teléfono" ayudan a encontrar leads más calificados. Empresas sin sitio son grandes oportunidades para agencias digitales. Empresas con teléfono facilitan el contacto directo.',
        'support.faq.search.q4': '¿Qué significa el Score de Oportunidad?',
        'support.faq.search.a4':
            'El Score IA analiza presencia digital, valoraciones de Google, volumen de reseñas y otros factores para generar una puntuación de 0 a 100. Clasificación: Hot (≥70), Warm (40-69), Cold (<40). Cuanto mayor, más fácil convertir.',
        'support.faq.search.q5': '¿Qué es CNAE y cómo usarlo en la búsqueda?',
        'support.faq.search.a5.br':
            'CNAE es el código de actividad económica brasileño. En filtros avanzados puedes buscar por CNAE específico (ej.: 5611201 para restaurantes). Las plantillas rápidas ya sugieren CNAEs comunes por nicho.',
        'support.faq.search.q5.us': '¿Cómo refinar búsquedas en EE.UU.?',
        'support.faq.search.a5.us':
            'Usa filtros de ciudad, estado, categoría y radio. Los filtros avanzados permiten segmentar empresas con o sin sitio web y teléfono — ideal para ventas outbound. Los resultados vienen de Google Places con valoraciones y contactos reales.',

        'support.faq.group.leads': 'Leads y resultados',
        'support.faq.leads.q1': '¿Cómo guardar un lead?',
        'support.faq.leads.a1':
            'En los resultados de búsqueda, haz clic en el icono de bookmark junto al lead. Se guardará en Prospección > Leads Guardados con todos los datos (teléfono, sitio web, score, dirección).',
        'support.faq.leads.q2': '¿Los filtros rápidos de resultados afectan la búsqueda?',
        'support.faq.leads.a2':
            'No. Los chips "Con sitio", "Con tel." y "Score ≥60" son filtros visuales que organizan los resultados ya cargados. La búsqueda en el servidor no se repite.',
        'support.faq.leads.q3': '¿Puedo comparar leads lado a lado?',
        'support.faq.leads.a3':
            '¡Sí! Selecciona hasta 3 leads con los checkboxes y haz clic en "Comparar". Una tabla comparativa muestra score, valoración, reseñas, sitio web, teléfono y más.',
        'support.faq.leads.q4': '¿Cómo exportar resultados a CSV?',
        'support.faq.leads.a4':
            'En los resultados de búsqueda, haz clic en "Exportar CSV" (disponible desde el plan Starter). El archivo incluye todos los datos de los leads mostrados.',

        'support.faq.group.credits': 'Créditos y planes',
        'support.faq.credits.q1': '¿Cómo funcionan los créditos?',
        'support.faq.credits.a1.br':
            'Cada análisis de lead con IA consume 1 crédito. La cantidad depende del plan: Free (10/mes), Starter R$129 (100/mes), Growth R$397 (400/mes), Business R$997 (1.200/mes) y Enterprise (5.000/mes). Los créditos se renuevan automáticamente.',
        'support.faq.credits.a1.us':
            'Cada análisis de lead con IA consume 1 crédito. El plan Starter cuesta $19/mes e incluye 50 créditos. Los créditos se renuevan automáticamente en cada ciclo de facturación.',
        'support.faq.credits.q2': '¿Puedo cancelar en cualquier momento?',
        'support.faq.credits.a2':
            '¡Sí! Cancela en Planes en cualquier momento. El acceso continúa hasta el fin del período ya pagado. No hay penalización por cancelación.',
        'support.faq.credits.q3': '¿La búsqueda consume créditos?',
        'support.faq.credits.a3':
            'Las búsquedas de leads son gratuitas. Solo el análisis detallado con IA (que genera score, clasificación y estrategia) consume créditos.',
        'support.faq.credits.q4': '¿Cómo funciona el período de prueba?',
        'support.faq.credits.a4.br':
            'Los nuevos usuarios en Brasil reciben créditos gratuitos para probar análisis de IA. El trial permite explorar búsquedas, resultados y análisis antes de suscribirse. Después, elige un plan en Planes — pago vía Mercado Pago (tarjeta, Pix o boleto).',
        'support.faq.credits.q5': '¿Cómo pagar con Mercado Pago?',
        'support.faq.credits.a5.br':
            'En Planes, selecciona el plan deseado y haz clic en Suscribirse. Serás redirigido al checkout de Mercado Pago con opciones de tarjeta, Pix y boleto. La suscripción se renueva automáticamente; cancela en cualquier momento en Planes.',
        'support.faq.credits.q4.us': '¿Cómo funciona la facturación con Stripe?',
        'support.faq.credits.a4.us':
            'Las suscripciones en EE.UU. se procesan de forma segura vía Stripe. Elige un plan en Planes, ingresa tu tarjeta en el checkout de Stripe y la suscripción se renueva automáticamente cada mes. Actualiza el método de pago o cancela en cualquier momento.',
        'support.faq.credits.q5.us': '¿Qué planes y créditos hay disponibles en EE.UU.?',
        'support.faq.credits.a5.us':
            'Starter ($19/mes) incluye 50 créditos de análisis IA. Growth ($49/mes) incluye 200 créditos. Business ($99/mes) incluye 600 créditos. Enterprise ofrece límites personalizados. Las búsquedas son siempre gratuitas; solo los análisis IA consumen créditos.',

        'support.faq.group.integrations': 'Integraciones CRM',
        'support.faq.integrations.q1': '¿Cómo conectar RD Station?',
        'support.faq.integrations.a1':
            'Ve a Integraciones > RD Station > Conectar con OAuth. Serás redirigido para autorizar el acceso. La conexión es con un clic, sin código. Detalles completos en nuestra página de integración.',
        'support.faq.integrations.q2': '¿Cómo conectar Agendor?',
        'support.faq.integrations.a2':
            'Ve a Integraciones > Agendor y pega tu Token de API. Para obtener el token: accede a web.agendor.com.br > Configuración > Integraciones > copia el token. Pégalo en Precision y guarda.',
        'support.faq.integrations.q3': '¿Qué se envía al CRM cuando envío un lead?',
        'support.faq.integrations.a3':
            'En modo "Contacto + Negocio": crea contacto con datos completos, organización, negociación con análisis de IA en la descripción (resumen, puntos fuertes/débiles, scripts de abordaje, mensaje WhatsApp) y tarea de seguimiento automática.',
        'support.faq.integrations.q4': '¿Se duplican los contactos si envío dos veces?',
        'support.faq.integrations.a4':
            'En Agendor, usamos upsert (deduplicación por email). En RD Station CRM, el contacto se actualiza si ya existe. No hay duplicación.',
        'support.faq.integrations.q5': '¿Mi token/credenciales están seguros?',
        'support.faq.integrations.a5':
            'Sí. Los tokens de Agendor están cifrados en la base de datos. RD Station usa OAuth 2.0 con HMAC-SHA256 y refresh automático. Ninguna credencial se expone en el frontend.',
        'support.faq.integrations.q6': '¿Puedo elegir embudo y etapa de la negociación?',
        'support.faq.integrations.a6':
            '¡Sí! En el panel lateral CRM, selecciona embudo, etapa y responsable antes de enviar. Funciona tanto para RD Station como Agendor.',

        'support.faq.group.score': 'Score y análisis',
        'support.faq.score.q1': '¿Cómo funciona el Análisis de Competencia?',
        'support.faq.score.a1':
            'El sistema busca competidores en la región y genera rankings por valoración de Google, volumen de reseñas y presencia digital. Identifica brechas de mercado (empresas sin sitio). Disponible en el plan Growth.',
        'support.faq.score.q2': '¿Qué es el Análisis de Viabilidad?',
        'support.faq.score.a2':
            'Indica tipo de negocio y ciudad. La IA analiza datos reales (competidores, saturación, madurez digital) y genera un score de viabilidad con recomendaciones de diferenciación. Plan Enterprise.',
        'support.faq.score.q3': '¿Qué es el Análisis "Mi Empresa"?',
        'support.faq.score.a3':
            'Registra tu empresa y la IA analiza tu posicionamiento digital: valoraciones, presencia online, posición vs. competidores. Genera recomendaciones para mejorar. Plan Business.',

        'support.faq.group.team': 'Equipo',
        'support.faq.team.q1': '¿Cómo invito miembros a mi equipo?',
        'support.faq.team.a1':
            'En Equipo > Mi Equipo (plan Enterprise), haz clic en "Invitar Miembro" e ingresa el email. El usuario recibe una invitación y se une al equipo tras aceptar.',
        'support.faq.team.q2': '¿Puedo controlar lo que ve cada miembro?',
        'support.faq.team.a2':
            'Los miembros comparten el mismo plan y créditos del equipo. El admin sigue el uso individual en el Dashboard del equipo.',

        'support.faq.group.security': 'Cuenta y seguridad',
        'support.faq.security.q1': '¿Los datos son reales?',
        'support.faq.security.a1':
            '¡Sí! Usamos Google Places API para datos reales y actualizados de empresas. Valoraciones, teléfonos, sitios web y direcciones son datos oficiales de Google. Los análisis se hacen con Gemini AI.',
        'support.faq.security.q2': '¿Cómo cambio mi contraseña?',
        'support.faq.security.a2':
            'En Cuenta > Configuración encontrarás la opción de cambiar contraseña. Si la olvidaste, usa "Olvidé mi contraseña" en la pantalla de inicio de sesión.',
        'support.faq.security.q3': '¿Mis datos están seguros?',
        'support.faq.security.a3':
            'Sí. Usamos HTTPS en todas las comunicaciones, headers de seguridad (CSP, HSTS), rate limiting, tokens cifrados y autenticación OAuth 2.0. Seguimos las mejores prácticas OWASP.',
    },
};
