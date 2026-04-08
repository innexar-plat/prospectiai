export interface BlogPost {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  keywords: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'como-encontrar-empresas-para-vender',
    title: 'Como Encontrar Empresas para Vender: Guia Completo 2026',
    metaTitle: 'Como Encontrar Empresas para Vender Seus Produtos e Serviços [2026]',
    metaDescription: 'Aprenda como encontrar empresas para vender seus produtos e serviços. 7 estratégias práticas de prospecção B2B para encontrar clientes ideais por nicho e região.',
    excerpt: 'Encontrar as empresas certas para vender é o maior desafio de quem trabalha com vendas B2B. Neste guia, mostramos 7 estratégias práticas para localizar clientes ideais.',
    date: '2026-04-07',
    readTime: '8 min',
    category: 'Prospecção',
    keywords: ['encontrar empresas para vender', 'como achar empresas', 'prospecção de clientes', 'vendas B2B'],
  },
  {
    slug: 'como-prospectar-clientes-b2b',
    title: 'Como Prospectar Clientes B2B: 10 Técnicas que Funcionam',
    metaTitle: 'Como Prospectar Clientes B2B: 10 Técnicas Comprovadas [Guia 2026]',
    metaDescription: 'Descubra como prospectar clientes B2B com 10 técnicas comprovadas. Do cold call ao uso de IA para qualificação de leads. Dicas práticas para vendedores.',
    excerpt: 'A prospecção B2B evoluiu. Conheça 10 técnicas modernas que combinam abordagem tradicional com inteligência artificial para encontrar e qualificar leads.',
    date: '2026-04-07',
    readTime: '10 min',
    category: 'Vendas B2B',
    keywords: ['prospectar clientes B2B', 'prospecção ativa', 'técnicas de prospecção', 'qualificação de leads'],
  },
  {
    slug: 'como-vender-para-empresas',
    title: 'Como Vender para Empresas: O Guia Definitivo de Vendas B2B',
    metaTitle: 'Como Vender para Empresas: Guia Definitivo de Vendas B2B [2026]',
    metaDescription: 'Aprenda como vender para empresas com estratégias B2B comprovadas. Da prospecção ao fechamento: ciclo de vendas, abordagem, proposta e negociação.',
    excerpt: 'Vender para empresas é diferente de vender para consumidores. Este guia cobre todo o ciclo: da identificação do lead ao fechamento do negócio.',
    date: '2026-04-07',
    readTime: '12 min',
    category: 'Vendas B2B',
    keywords: ['vender para empresas', 'vendas B2B', 'ciclo de vendas', 'negociação empresarial'],
  },
  {
    slug: 'geracao-de-leads-b2b-guia-completo',
    title: 'Geração de Leads B2B: Guia Completo para 2026',
    metaTitle: 'Geração de Leads B2B: Guia Completo com Estratégias e Ferramentas [2026]',
    metaDescription: 'Tudo sobre geração de leads B2B: estratégias inbound e outbound, ferramentas, métricas e como usar IA para gerar leads qualificados automaticamente.',
    excerpt: 'Geração de leads é o combustível das vendas B2B. Conheça as melhores estratégias, ferramentas e métricas para construir um pipeline sólido.',
    date: '2026-04-07',
    readTime: '11 min',
    category: 'Marketing B2B',
    keywords: ['geração de leads B2B', 'gerar leads', 'leads qualificados', 'pipeline de vendas'],
  },
  {
    slug: 'ferramentas-prospeccao-comercial',
    title: '7 Melhores Ferramentas de Prospecção Comercial em 2026',
    metaTitle: '7 Melhores Ferramentas de Prospecção Comercial para Vendas B2B [2026]',
    metaDescription: 'Compare as 7 melhores ferramentas de prospecção comercial do mercado. Funcionalidades, preços e para quem é indicada cada plataforma de geração de leads.',
    excerpt: 'Comparamos as principais ferramentas de prospecção comercial do mercado brasileiro para ajudar você a escolher a ideal para seu negócio.',
    date: '2026-04-07',
    readTime: '9 min',
    category: 'Ferramentas',
    keywords: ['ferramentas de prospecção', 'plataforma de leads', 'software vendas B2B', 'prospecção comercial'],
  },
  {
    slug: 'dicas-vendas-b2b',
    title: '15 Dicas de Vendas B2B para Vender Mais em 2026',
    metaTitle: '15 Dicas de Vendas B2B para Aumentar suas Vendas [2026]',
    metaDescription: '15 dicas práticas de vendas B2B para vender mais. Técnicas de abordagem, follow-up, negociação e fechamento para vendedores e equipes comerciais.',
    excerpt: 'Reunimos 15 dicas práticas de vendas B2B testadas por equipes comerciais de sucesso. Da primeira abordagem ao fechamento.',
    date: '2026-04-07',
    readTime: '7 min',
    category: 'Dicas de Vendas',
    keywords: ['dicas vendas B2B', 'como vender mais', 'técnicas de vendas', 'fechamento de vendas'],
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
