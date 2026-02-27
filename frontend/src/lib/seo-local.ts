/**
 * Configuração para landing pages de SEO local.
 * Usado para gerar URLs, títulos e metadados por cidade/nicho.
 * Ver .ai/SEO_LOCAL_PLAN.md
 */

export type SeoLandingType = 'cidade' | 'cidade-nicho' | 'bairro';

export interface SeoLandingSlug {
  /** Slug da URL (ex: geracao-de-leads-b2b-praia-grande) */
  slug: string;
  type: SeoLandingType;
  /** Nome para título/H1 (ex: Praia Grande) */
  city?: string;
  /** Nome do bairro se type = bairro */
  neighborhood?: string;
  /** Nicho (ex: dentistas, imobiliárias) */
  niche?: string;
  /** Região para meta geo (ex: BR-SP) */
  region?: string;
}

/** Primeira onda: cidades âncora (Mês 1) */
const CIDADES_ANCHOR: string[] = [
  'praia-grande',
  'santos',
  'sao-paulo',
  'guaruja',
  'sao-vicente',
];

/** Nichos para combinar com cidade (Mês 1–3) */
const NICHOS: string[] = [
  'dentistas',
  'imobiliarias',
  'contadores',
  'clinicas',
  'restaurantes',
];

const BASE = 'geracao-de-leads-b2b';
const BASE_NICHO = 'prospeccao-b2b';
const BASE_BAIRRO = 'lista-de-empresas-por-bairro';

function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Gera slug para página por cidade (ex: geracao-de-leads-b2b-praia-grande)
 */
export function slugCidade(cidadeSlug: string): string {
  return `${BASE}-${cidadeSlug}`;
}

/**
 * Gera slug para página cidade + nicho (ex: prospeccao-b2b-dentistas-santos)
 */
export function slugCidadeNicho(nichoSlug: string, cidadeSlug: string): string {
  return `${BASE_NICHO}-${nichoSlug}-${cidadeSlug}`;
}

/**
 * Gera slug para página por bairro (ex: lista-de-empresas-por-bairro-vila-mariana)
 */
export function slugBairro(bairroSlug: string): string {
  return `${BASE_BAIRRO}-${bairroSlug}`;
}

/**
 * Lista de slugs da primeira onda (Mês 1) para sitemap e rotas
 */
export function getWave1Slugs(): SeoLandingSlug[] {
  const list: SeoLandingSlug[] = [];
  for (const c of CIDADES_ANCHOR) {
    list.push({
      slug: slugCidade(c),
      type: 'cidade',
      city: slugToTitle(c),
      region: 'BR-SP',
    });
  }
  for (const n of NICHOS.slice(0, 3)) {
    for (const c of CIDADES_ANCHOR.slice(0, 3)) {
      list.push({
        slug: slugCidadeNicho(n, c),
        type: 'cidade-nicho',
        city: slugToTitle(c),
        niche: slugToTitle(n),
        region: 'BR-SP',
      });
    }
  }
  return list;
}

/**
 * Título SEO da página (para <title> e H1)
 */
export function getSeoTitle(entry: SeoLandingSlug): string {
  if (entry.type === 'cidade' && entry.city) {
    return `Geração de Leads B2B em ${entry.city} | Innexar`;
  }
  if (entry.type === 'cidade-nicho' && entry.city && entry.niche) {
    return `Prospecção B2B para ${entry.niche} em ${entry.city} | Innexar`;
  }
  if (entry.type === 'bairro' && entry.neighborhood) {
    return `Lista de Empresas por Bairro: ${entry.neighborhood} | Innexar`;
  }
  return 'Geração de Leads B2B e Prospecção com IA | Innexar';
}

/**
 * Descrição meta (única por página)
 */
export function getSeoDescription(entry: SeoLandingSlug): string {
  if (entry.type === 'cidade' && entry.city) {
    return `Ferramenta de inteligência comercial B2B para empresas em ${entry.city}. Busca por nicho, análise de concorrência e leads qualificados.`;
  }
  if (entry.type === 'cidade-nicho' && entry.city && entry.niche) {
    return `Prospecção B2B para ${entry.niche} em ${entry.city}. Encontre empresas, analise concorrência e gere leads com IA.`;
  }
  if (entry.type === 'bairro' && entry.neighborhood) {
    return `Lista de empresas por bairro: ${entry.neighborhood}, São Paulo. Mapeamento e prospecção B2B com dados reais.`;
  }
  return 'Plataforma B2B para encontrar, analisar e converter empresas por nicho e região.';
}

/**
 * Resolve slug para entrada (para rota dinâmica)
 */
export function getSeoEntryBySlug(slug: string): SeoLandingSlug | null {
  const wave1 = getWave1Slugs();
  return wave1.find((e) => e.slug === slug) ?? null;
}

/**
 * Todos os slugs conhecidos (para sitemap e 404)
 */
export function getAllSeoSlugs(): string[] {
  return getWave1Slugs().map((e) => e.slug);
}

/** Par de pergunta e resposta para FAQ (conteúdo único por página, evita thin content) */
export interface SeoFaqItem {
  question: string;
  answer: string;
}

/**
 * Bloco de introdução único por tipo (cidade vs cidade-nicho vs bairro).
 * Evita doorway: não é só troca de nome — estrutura e foco mudam.
 */
export function getSeoIntro(entry: SeoLandingSlug): string[] {
  if (entry.type === 'cidade' && entry.city) {
    return [
      `A região de ${entry.city} concentra milhares de empresas ativas. Para quem vende B2B, a dúvida é: onde atacar primeiro, com qual mensagem e como priorizar leads.`,
      `O ProspectorAI reúne busca por nicho e endereço, análise de concorrência local e sugestões de abordagem com IA. Você filtra por segmento, vê quem tem site e telefone, e exporta listas para seu CRM.`,
    ];
  }
  if (entry.type === 'cidade-nicho' && entry.city && entry.niche) {
    return [
      `Prospectar ${entry.niche} em ${entry.city} exige saber quem já atua na região, quem tem presença digital e onde há espaço para novos fornecedores.`,
      `Com o ProspectorAI você mapeia empresas do segmento por área, analisa concorrência e recebe sugestões de primeiro contato (ligação, e-mail, WhatsApp) com base no perfil de cada lead.`,
    ];
  }
  if (entry.type === 'bairro' && entry.neighborhood) {
    return [
      `Trabalhar por bairro permite campanhas mais focadas e mensagens adaptadas ao perfil local. ${entry.neighborhood}, em São Paulo, é um dos bairros com maior concentração de negócios.`,
      `A plataforma permite listar empresas por bairro, filtrar por nicho e priorizar leads com score de potencial. Os dados vêm de fontes estruturadas e são atualizados regularmente.`,
    ];
  }
  return [
    'O ProspectorAI combina busca por nicho e região, análise de concorrência local e inteligência comercial para gerar leads B2B qualificados.',
  ];
}

/**
 * Bloco dinâmico local: contexto e benefício específicos da página.
 * Obrigatório por diretrizes (não só bloco fixo institucional).
 */
export function getSeoLocalBlock(entry: SeoLandingSlug): string[] {
  if (entry.type === 'cidade' && entry.city) {
    return [
      `Em ${entry.city} você pode usar a ferramenta para filtrar empresas por segmento (ex.: saúde, comércio, serviços), ver quantas têm site e telefone cadastrado e exportar listas para campanhas.`,
      `A análise de concorrência mostra quem está mais visível na região e onde há oportunidades para quem está entrando. Os relatórios ajudam a decidir em quais bairros ou nichos concentrar esforço.`,
    ];
  }
  if (entry.type === 'cidade-nicho' && entry.city && entry.niche) {
    return [
      `Para ${entry.niche} em ${entry.city}, a plataforma permite mapear todos os negócios do segmento na área, ver avaliações e presença digital, e ranquear por relevância.`,
      `Você gera scripts de ligação e mensagens de primeiro contato personalizadas por lead, o que reduz tempo de preparação e aumenta a chance de conversão em reunião ou proposta.`,
    ];
  }
  if (entry.type === 'bairro' && entry.neighborhood) {
    return [
      `Em ${entry.neighborhood} é possível listar empresas por categoria, ver quais têm site e telefone e priorizar por potencial de compra.`,
      `O uso de dados reais da plataforma (não inventados) garante que suas campanhas se baseiem em informações atualizadas e acionáveis.`,
    ];
  }
  return [];
}

/**
 * FAQ contextualizado por página (único por cidade/nicho).
 * Ajuda E-E-A-T e evita thin content; permite FAQ schema para rich results.
 */
export function getSeoFaq(entry: SeoLandingSlug): SeoFaqItem[] {
  const city = entry.city ?? '';
  const niche = entry.niche ?? '';
  const neighborhood = entry.neighborhood ?? '';

  if (entry.type === 'cidade' && city) {
    return [
      {
        question: `Como encontrar empresas em ${city} para prospecção B2B?`,
        answer: `No ProspectorAI você busca por nicho e região. Informe o segmento (ex.: clínicas, escritórios, comércio) e a área (${city} ou bairros). A ferramenta lista empresas com filtros por site, telefone e exportação em CSV ou JSON.`,
      },
      {
        question: `A ferramenta usa dados reais para ${city}?`,
        answer: `Sim. A plataforma utiliza fontes estruturadas e atualizadas. Você vê quantidade de empresas por segmento, presença digital e ranking competitivo na região, sem números inventados.`,
      },
      {
        question: `Posso exportar listas de leads em ${city}?`,
        answer: `Sim. Nos planos pagos você exporta listas em CSV ou JSON para usar no CRM ou em campanhas. A exportação inclui dados de contato e notas da análise de IA quando disponíveis.`,
      },
    ];
  }
  if (entry.type === 'cidade-nicho' && city && niche) {
    return [
      {
        question: `Como prospectar ${niche} em ${city}?`,
        answer: `No ProspectorAI você filtra por segmento "${niche}" e região "${city}". A lista mostra empresas do nicho com opção de ver análise de concorrência, presença digital e sugestão de primeiro contato (ligação, e-mail, WhatsApp).`,
      },
      {
        question: `A plataforma sugere abordagem para cada lead de ${niche} em ${city}?`,
        answer: `Sim. Nos planos Growth e Enterprise a IA gera script de ligação, e-mail e mensagem WhatsApp adaptados ao perfil do lead e ao nicho, para você não começar do zero.`,
      },
      {
        question: `Posso trabalhar em equipe na prospecção de ${niche} em ${city}?`,
        answer: `Sim. O ProspectorAI tem workspaces: você convida membros, divide listas e acompanha resultados. Exportação e 2FA estão disponíveis nos planos pagos.`,
      },
    ];
  }
  if (entry.type === 'bairro' && neighborhood) {
    return [
      {
        question: `Como listar empresas por bairro em ${neighborhood}?`,
        answer: `No ProspectorAI você escolhe o bairro (${neighborhood}) e filtra por segmento. A lista mostra empresas com dados de contato e, quando disponível, análise de concorrência e sugestão de abordagem.`,
      },
      {
        question: `Os dados de ${neighborhood} são reais?`,
        answer: `Sim. A plataforma usa fontes estruturadas; não inventamos endereços nem perfis. Os números e listas refletem dados que você pode validar na ferramenta.`,
      },
    ];
  }
  return [];
}

/**
 * Slugs relacionados para interligação interna (cidade → nichos; nicho → cidades).
 * Cresce autoridade e ajuda o usuário a tomar decisão.
 */
export function getRelatedSeoSlugs(entry: SeoLandingSlug, limit = 6): SeoLandingSlug[] {
  const all = getWave1Slugs();
  const sameSlug = (e: SeoLandingSlug) => e.slug === entry.slug;
  if (entry.type === 'cidade' && entry.city) {
    const sameCity = (e: SeoLandingSlug) => e.type === 'cidade-nicho' && e.city === entry.city;
    return all.filter((e) => !sameSlug(e) && sameCity(e)).slice(0, limit);
  }
  if (entry.type === 'cidade-nicho' && entry.city && entry.niche) {
    const cityPage = (e: SeoLandingSlug) => e.type === 'cidade' && e.city === entry.city;
    const sameNichoOtherCity = (e: SeoLandingSlug) => e.type === 'cidade-nicho' && e.niche === entry.niche && e.city !== entry.city;
    const sameCityNicho = (e: SeoLandingSlug) => e.type === 'cidade-nicho' && e.city === entry.city && e.niche !== entry.niche;
    const related = all.filter((e) => !sameSlug(e) && (cityPage(e) || sameNichoOtherCity(e) || sameCityNicho(e)));
    return related.slice(0, limit);
  }
  return all.filter((e) => !sameSlug(e) && e.type === 'cidade').slice(0, limit);
}
