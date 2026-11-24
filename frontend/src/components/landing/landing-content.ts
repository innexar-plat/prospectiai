/**
 * Brazilian landing content as plain data — rendered by LandingPage.tsx and by the build-time
 * static HTML for crawlers (src/seo/static-bodies.tsx), so both always say the same thing.
 */
import { Brain, MessageSquare, Network, Search, Swords, TrendingUp } from 'lucide-react';

/** Monthly BRL prices — keep in sync with PlanConfig (admin › Planos). */
export const BR_PLANS = [
    { key: 'BASIC', name: 'Starter', leads: 100, price: 99 },
    { key: 'PRO', name: 'Growth', leads: 400, price: 297, highlight: true },
    { key: 'BUSINESS', name: 'Business', leads: 1200, price: 797 },
    { key: 'SCALE', name: 'Enterprise', leads: 5000, price: 1997 },
] as const;

export const formatBrl = (n: number): string => `R$ ${n.toLocaleString('pt-BR')}`;

export const HERO_TITLE = 'Encontre empresas e';
export const HERO_HIGHLIGHT = 'priorize os melhores leads';
export const HERO_SUB_PLAIN = 'Busque por nicho e região, receba score IA em segundos e descubra quem vale seu tempo antes de entrar em contato. Acesse dados de 27 milhões de empresas brasileiras com análise de concorrência, viabilidade de negócio e scripts de abordagem prontos.';

export const HERO_CARDS = [
    {
        icon: Search,
        title: 'Mapeamento Inteligente',
        desc: 'Encontre milhares de empresas por nicho e região em segundos com Google Places + base RF.',
        gradient: 'from-violet-600 to-indigo-600',
    },
    {
        icon: Brain,
        title: 'Score IA por Lead',
        desc: 'Análise completa com score 0-100, probabilidade de fechamento, dores, gaps e scripts prontos.',
        gradient: 'from-cyan-600 to-blue-600',
    },
    {
        icon: Swords,
        title: 'Análise de Concorrência',
        desc: 'Rankings, presença digital, gaps de mercado e playbook competitivo gerado por IA.',
        gradient: 'from-emerald-600 to-teal-600',
    },
    {
        icon: TrendingUp,
        title: 'Viabilidade de Negócio',
        desc: 'Score 0-10 com veredito GO/NO-GO. Investimento, riscos e oportunidades por região.',
        gradient: 'from-amber-600 to-orange-600',
    },
    {
        icon: Network,
        title: 'Smart Relations',
        desc: 'Descubra conexões invisíveis: sócios, grupos empresariais e clusters de mercado.',
        gradient: 'from-pink-600 to-rose-600',
    },
    {
        icon: MessageSquare,
        title: 'Scripts IA Prontos',
        desc: 'Email, WhatsApp e telefone personalizados pela IA. Copie e envie em 1 clique.',
        gradient: 'from-violet-600 to-purple-600',
    },
] as const;

export const BEFORE_AFTER = [
    { before: 'Pesquisar empresas no Google: 2-3h', after: 'Busca inteligente: 30 segundos', saving: '95%' },
    { before: 'Qualificar 1 lead manualmente: 30 min', after: 'Score IA automático: 10 segundos', saving: '95%' },
    { before: 'Escrever email de abordagem: 15 min', after: 'Gerado pela IA: 0 min', saving: '100%' },
    { before: 'Pesquisar CNPJ na Receita: 10 min/empresa', after: 'Match automático com 27M empresas', saving: '100%' },
    { before: 'Analisar concorrência: 3-5 horas', after: 'Relatório IA: 2 minutos', saving: '97%' },
    { before: 'Estudar viabilidade de mercado: 1-2 dias', after: 'Score + relatório: 3 minutos', saving: '99%' },
] as const;

export const CRM_INTEGRATIONS = [
    { name: 'RD Station', desc: 'OAuth nativo', logo: '/brands/rdstation.svg' },
    { name: 'Agendor', desc: 'Token API', logo: '/brands/agendor.svg' },
    { name: 'HubSpot', desc: 'OAuth nativo', logo: '/brands/hubspot.svg' },
    { name: 'CSV/JSON', desc: 'Exportação', logo: null },
] as const;

export const LANDING_FAQ = [
    {
        q: 'O que é o Precision?',
        a: 'Precision é uma plataforma de prospecção B2B com inteligência artificial. Ela encontra empresas por nicho e região, analisa o potencial de cada lead com score IA, gera scripts de abordagem prontos e oferece inteligência de mercado — tudo em um só lugar.'
    },
    {
        q: 'Preciso de conhecimento técnico para usar?',
        a: 'Não. A plataforma foi projetada para vendedores e equipes comerciais. Basta digitar o nicho, a região e clicar em buscar — a IA faz o resto.'
    },
    {
        q: 'Quanto tempo leva para ver resultados?',
        a: 'Imediatamente. Em poucos segundos você encontra empresas, recebe o score IA e já sai com contexto para abordar os leads com muito mais precisão.'
    },
    {
        q: 'A IA é confiável? De onde vêm os dados?',
        a: 'Usamos as IAs mais modernas do mercado. Os dados vêm de fontes oficiais: Google Places (avaliações, localização), Receita Federal (27M empresas, CNPJ, CNAE, porte), Reclame Aqui e Jus Brasil.'
    },
    {
        q: 'Qual plano devo escolher para começar?',
        a: `O plano Starter, por ${formatBrl(BR_PLANS[0].price)}/mês, é ideal para começar. Você pode fazer upgrade, downgrade ou cancelar a qualquer momento, sem burocracia.`
    },
    {
        q: 'Posso integrar com o CRM que já uso?',
        a: 'Sim. Integramos nativamente com RD Station (OAuth), Agendor (Token API) e HubSpot. Também exportamos em CSV e JSON.'
    },
    {
        q: 'Qual a diferença para ferramentas como Econodata ou Speedio?',
        a: 'Nós combinamos busca + qualificação IA + scripts de abordagem + análise de mercado + integrações CRM em uma única plataforma. Não é só uma lista de empresas — é inteligência comercial completa.'
    },
    {
        q: 'Posso cancelar a qualquer momento?',
        a: 'Sim, sem multa e sem burocracia. Cancele direto na plataforma. Seu plano continua ativo até o fim do período pago.'
    },
    {
        q: 'O sistema é seguro?',
        a: 'Sim. Autenticação 2FA, criptografia de dados sensíveis, HTTPS obrigatório, rate limiting, tokens CRM criptografados em repouso e conformidade com LGPD.'
    },
] as const;
