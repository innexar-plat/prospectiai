/**
 * Tour por seção do dashboard. sectionId vem do pathname; steps são exibidos na primeira visita à seção.
 */

export type TourStep = {
  target: string | null;
  title: string;
  body: string;
};

const PROSPECAO_STEPS: TourStep[] = [
  { target: 'nova-busca', title: 'Nova Busca', body: 'Aqui você define cidade, nicho e opcionalmente bairros. Clique em "Buscar" para encontrar leads na região.' },
  { target: null, title: 'Histórico e Leads', body: 'No menu à esquerda: Histórico mostra todas as buscas; Leads Salvos reúne os negócios que você salvou para contato.' },
];

const INTELIGENCIA_STEPS: TourStep[] = [
  { target: null, title: 'Inteligência', body: 'Concorrência, Relatórios, Análise minha empresa e Viabilidade: análises por plano para entender o mercado e se diferenciar.' },
];

const EQUIPE_STEPS: TourStep[] = [
  { target: null, title: 'Equipe', body: 'No plano Enterprise você pode convidar membros em Minha Equipe e acompanhar uso no Dashboard da equipe.' },
];

const CONTA_STEPS: TourStep[] = [
  { target: null, title: 'Conta', body: 'Perfil e Empresa para seus dados; Planos para upgrade; Configurações para preferências; Suporte para dúvidas e contato.' },
];

export const TOUR_STEPS_BY_SECTION: Record<string, TourStep[]> = {
  prospecao: PROSPECAO_STEPS,
  inteligencia: INTELIGENCIA_STEPS,
  equipe: EQUIPE_STEPS,
  conta: CONTA_STEPS,
};

export const TOUR_STORAGE_PREFIX = 'prospector_tour_';

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

export function clearAllTourFlags(): void {
  if (typeof window === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(TOUR_STORAGE_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => window.localStorage.removeItem(k));
}
