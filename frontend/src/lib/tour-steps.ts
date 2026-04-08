/**
 * Tour de boas-vindas: exibido uma única vez na primeira visita ao dashboard.
 * O usuário pode concluir ou pular; em ambos os casos o tour não é mais exibido.
 */

export type TourStep = {
  /** CSS selector or data-tour id. null = centered modal (no highlight). */
  target: string | null;
  title: string;
  body: string;
  /** Preferred tooltip placement relative to the target element. Default: 'bottom'. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Emoji or icon hint shown before the title. */
  icon?: string;
};

/** Tour unificado — 8 passos cobrindo toda a interface */
export const WELCOME_TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Bem-vindo ao Precision IA!',
    body: 'Vamos fazer um tour rápido pela plataforma. Você vai descobrir como encontrar leads qualificados com inteligência artificial em poucos cliques.',
    icon: '👋',
  },
  {
    target: 'sidebar-nav',
    title: 'Menu de navegação',
    body: 'Aqui fica o menu principal. Suas seções: Prospecção, Inteligência, Equipe e Suporte. Clique no botão no rodapé para recolher e ganhar mais espaço.',
    placement: 'right',
    icon: '📋',
  },
  {
    target: 'nova-busca',
    title: 'Busca inteligente',
    body: 'O coração da plataforma. Escolha país, estado, cidade e raio de busca. Logo abaixo defina o nicho (ex: "Restaurantes") e a IA encontrará leads qualificados na região.',
    placement: 'bottom',
    icon: '🔍',
  },
  {
    target: 'quick-templates',
    title: 'Templates rápidos',
    body: 'Sem tempo? Clique em um template pronto — Restaurantes, Salões, Academias, Clínicas e mais. A busca é preenchida automaticamente.',
    placement: 'top',
    icon: '⚡',
  },
  {
    target: 'header-credits',
    title: 'Seus créditos',
    body: 'Aqui você vê quantos créditos restam no seu plano. Cada análise de lead consome 1 crédito. Os créditos renovam todo mês.',
    placement: 'bottom',
    icon: '✨',
  },
  {
    target: 'header-notifications',
    title: 'Notificações',
    body: 'Fique por dentro! Aqui aparecem alertas de análises concluídas, novos recursos e atualizações do sistema.',
    placement: 'bottom',
    icon: '🔔',
  },
  {
    target: 'sidebar-integracoes',
    title: 'Integrações CRM',
    body: 'Conecte seu RD Station ou Agendor para enviar leads diretamente ao CRM com dados enriquecidos, negociações e tarefas — tudo automático.',
    placement: 'right',
    icon: '🔗',
  },
  {
    target: null,
    title: 'Tudo pronto para começar!',
    body: 'Faça sua primeira busca agora. A IA vai analisar cada empresa encontrada e dar um score de oportunidade. Você pode refazer este tour a qualquer momento em Ajuda e Suporte.',
    icon: '🚀',
  },
];

/** Steps por seção (usado em Suporte "Ver tour do sistema" — refaz por seção) */
const PROSPECAO_STEPS: TourStep[] = [
  { target: 'nova-busca', title: 'Busca inteligente', body: 'Defina localização, nicho e filtros. Clique em "Buscar" para encontrar leads na região com score de oportunidade.', placement: 'bottom', icon: '🔍' },
  { target: 'quick-templates', title: 'Templates rápidos', body: 'Nichos pré-configurados para buscar com um clique. Restaurantes, Clínicas, Academias e mais.', placement: 'top', icon: '⚡' },
  { target: 'sidebar-historico', title: 'Histórico de buscas', body: 'Todas as suas buscas ficam salvas aqui. Clique para ver os resultados novamente ou refazer a busca.', placement: 'right', icon: '📜' },
  { target: 'sidebar-leads', title: 'Leads salvos', body: 'Leads que você salvou para contato. Veja score de IA, telefone, e-mail e status (novo, contactado, convertido).', placement: 'right', icon: '🎯' },
];

const INTELIGENCIA_STEPS: TourStep[] = [
  { target: 'sidebar-inteligencia', title: 'Módulo de inteligência', body: 'Análises avançadas por plano: Concorrência, Relatórios, Análise da sua empresa e Viabilidade de mercado.', placement: 'right', icon: '🧠' },
];

const EQUIPE_STEPS: TourStep[] = [
  { target: 'sidebar-equipe', title: 'Gestão de equipe', body: 'No plano Enterprise, convide vendedores, distribua territórios e acompanhe performance no Dashboard da equipe.', placement: 'right', icon: '👥' },
];

const CONTA_STEPS: TourStep[] = [
  { target: 'header-avatar', title: 'Sua conta', body: 'Acesse Perfil, Empresa, Planos e Configurações pelo menu do avatar. Em Suporte você encontra FAQ e pode refazer este tour.', placement: 'bottom', icon: '👤' },
];

export const TOUR_STEPS_BY_SECTION: Record<string, TourStep[]> = {
  prospecao: PROSPECAO_STEPS,
  inteligencia: INTELIGENCIA_STEPS,
  equipe: EQUIPE_STEPS,
  conta: CONTA_STEPS,
};

export const TOUR_STORAGE_PREFIX = 'prospector_tour_';
export const WELCOME_TOUR_STORAGE_KEY = 'prospector_tour_welcome_done';

export function getSectionIdFromPath(pathname: string): string | null {
  const p = pathname.replace(/^\/dashboard\/?/, '') || 'index';
  if (p === '' || p === 'index') return 'prospecao';
  if (p.startsWith('historico') || p.startsWith('leads') || p.startsWith('listas') || p.startsWith('resultados') || p.startsWith('lead/')) return 'prospecao';
  if (p.startsWith('concorrencia') || p.startsWith('relatorios') || p.startsWith('minha-empresa') || p.startsWith('viabilidade')) return 'inteligencia';
  if (p.startsWith('equipe')) return 'equipe';
  if (p.startsWith('perfil') || p.startsWith('empresa') || p.startsWith('planos') || p.startsWith('configuracoes') || p.startsWith('suporte')) return 'conta';
  return null;
}

export function getTourStorageKey(sectionId: string): string {
  return `${TOUR_STORAGE_PREFIX}${sectionId}`;
}

export function wasTourSeen(sectionId: string): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(getTourStorageKey(sectionId)) === '1';
}

export function markTourSeen(sectionId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getTourStorageKey(sectionId), '1');
}

export function wasWelcomeTourDone(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(WELCOME_TOUR_STORAGE_KEY) === '1';
}

export function markWelcomeTourDone(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WELCOME_TOUR_STORAGE_KEY, '1');
}

export function clearAllTourFlags(): void {
  if (typeof window === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(TOUR_STORAGE_PREFIX) || k === WELCOME_TOUR_STORAGE_KEY) keys.push(k);
  }
  keys.forEach((k) => window.localStorage.removeItem(k));
}
