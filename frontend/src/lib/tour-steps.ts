/**
 * Tour de boas-vindas: exibido uma única vez na primeira visita ao dashboard.
 * O usuário pode concluir ou pular; em ambos os casos o tour não é mais exibido.
 */

import { getActiveMarket, type Market } from '@/lib/market';

export type TourTranslateFn = (key: string) => string;

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

type TourStepDef = {
  target: string | null;
  titleKey: string;
  bodyKey: string;
  placement?: TourStep['placement'];
  icon?: string;
  /** If set, step is only included for these markets. */
  markets?: Market[];
};

function resolveTourSteps(defs: TourStepDef[], t: TourTranslateFn, market: Market): TourStep[] {
  return defs
    .filter((def) => !def.markets || def.markets.includes(market))
    .map(({ titleKey, bodyKey, ...rest }) => ({
      target: rest.target,
      placement: rest.placement,
      icon: rest.icon,
      title: t(titleKey),
      body: t(bodyKey),
    }));
}

const WELCOME_TOUR_DEFS: TourStepDef[] = [
  {
    target: null,
    titleKey: 'common.tour.welcome.1.title',
    bodyKey: 'common.tour.welcome.1.body',
    icon: '👋',
  },
  {
    target: 'sidebar-nav',
    titleKey: 'common.tour.welcome.2.title',
    bodyKey: 'common.tour.welcome.2.body',
    placement: 'right',
    icon: '📋',
  },
  {
    target: 'nova-busca',
    titleKey: 'common.tour.welcome.3.title',
    bodyKey: 'common.tour.welcome.3.body',
    placement: 'bottom',
    icon: '🔍',
  },
  {
    target: 'search-filters',
    titleKey: 'common.tour.welcome.4.title',
    bodyKey: 'common.tour.welcome.4.body',
    placement: 'bottom',
    icon: '🎯',
  },
  {
    target: 'quick-templates',
    titleKey: 'common.tour.welcome.5.title',
    bodyKey: 'common.tour.welcome.5.body',
    placement: 'top',
    icon: '⚡',
  },
  {
    target: 'advanced-filters',
    titleKey: 'common.tour.welcome.6.title',
    bodyKey: 'common.tour.welcome.6.body.br',
    placement: 'top',
    icon: '🏷️',
    markets: ['BR'],
  },
  {
    target: 'advanced-filters',
    titleKey: 'common.tour.welcome.6.title',
    bodyKey: 'common.tour.welcome.6.body.us',
    placement: 'top',
    icon: '🌐',
    markets: ['US'],
  },
  {
    target: 'sidebar-historico',
    titleKey: 'common.tour.welcome.7.title',
    bodyKey: 'common.tour.welcome.7.body',
    placement: 'right',
    icon: '📊',
  },
  {
    target: null,
    titleKey: 'common.tour.welcome.8.title',
    bodyKey: 'common.tour.welcome.8.body',
    icon: '🤖',
  },
  {
    target: 'header-credits',
    titleKey: 'common.tour.welcome.9.title',
    bodyKey: 'common.tour.welcome.9.body',
    placement: 'bottom',
    icon: '✨',
  },
  {
    target: 'sidebar-planos',
    titleKey: 'common.tour.welcome.10.title',
    bodyKey: 'common.tour.welcome.10.body',
    placement: 'right',
    icon: '💳',
  },
  {
    target: 'sidebar-inteligencia',
    titleKey: 'common.tour.welcome.11.title',
    bodyKey: 'common.tour.welcome.11.body',
    placement: 'right',
    icon: '🧠',
  },
  {
    target: null,
    titleKey: 'common.tour.welcome.12.title',
    bodyKey: 'common.tour.welcome.12.body',
    icon: '🚀',
  },
];

const PROSPECAO_TOUR_DEFS: TourStepDef[] = [
  { target: 'nova-busca', titleKey: 'common.tour.prospecao.1.title', bodyKey: 'common.tour.prospecao.1.body', placement: 'bottom', icon: '🔍' },
  { target: 'search-filters', titleKey: 'common.tour.prospecao.2.title', bodyKey: 'common.tour.prospecao.2.body', placement: 'bottom', icon: '🎯' },
  { target: 'quick-templates', titleKey: 'common.tour.prospecao.3.title', bodyKey: 'common.tour.prospecao.3.body', placement: 'top', icon: '⚡' },
  { target: 'advanced-filters', titleKey: 'common.tour.prospecao.4.title', bodyKey: 'common.tour.prospecao.4.body.br', placement: 'top', icon: '🏷️', markets: ['BR'] },
  { target: 'advanced-filters', titleKey: 'common.tour.prospecao.4.title', bodyKey: 'common.tour.prospecao.4.body.us', placement: 'top', icon: '🌐', markets: ['US'] },
  { target: 'sidebar-historico', titleKey: 'common.tour.prospecao.5.title', bodyKey: 'common.tour.prospecao.5.body', placement: 'right', icon: '📜' },
  { target: 'sidebar-leads', titleKey: 'common.tour.prospecao.6.title', bodyKey: 'common.tour.prospecao.6.body', placement: 'right', icon: '🎯' },
];

const INTELIGENCIA_TOUR_DEFS: TourStepDef[] = [
  { target: 'sidebar-inteligencia', titleKey: 'common.tour.inteligencia.1.title', bodyKey: 'common.tour.inteligencia.1.body', placement: 'right', icon: '🧠' },
  { target: null, titleKey: 'common.tour.inteligencia.2.title', bodyKey: 'common.tour.inteligencia.2.body', icon: '📈' },
];

const EQUIPE_TOUR_DEFS: TourStepDef[] = [
  { target: 'sidebar-equipe', titleKey: 'common.tour.equipe.1.title', bodyKey: 'common.tour.equipe.1.body', placement: 'right', icon: '👥' },
];

const CONTA_TOUR_DEFS: TourStepDef[] = [
  { target: 'header-avatar', titleKey: 'common.tour.conta.1.title', bodyKey: 'common.tour.conta.1.body', placement: 'bottom', icon: '👤' },
  { target: 'sidebar-planos', titleKey: 'common.tour.conta.2.title', bodyKey: 'common.tour.conta.2.body', placement: 'right', icon: '💳' },
];

const TOUR_DEFS_BY_SECTION: Record<string, TourStepDef[]> = {
  prospecao: PROSPECAO_TOUR_DEFS,
  inteligencia: INTELIGENCIA_TOUR_DEFS,
  equipe: EQUIPE_TOUR_DEFS,
  conta: CONTA_TOUR_DEFS,
};

const CHECKOUT_CREDITS_TOUR_DEFS: TourStepDef[] = [
  {
    target: null,
    titleKey: 'common.tour.checkout.1.title',
    bodyKey: 'common.tour.checkout.1.body',
    icon: '💳',
  },
  {
    target: 'header-credits',
    titleKey: 'common.tour.checkout.2.title',
    bodyKey: 'common.tour.checkout.2.body',
    placement: 'bottom',
    icon: '✨',
  },
  {
    target: null,
    titleKey: 'common.tour.checkout.3.title',
    bodyKey: 'common.tour.checkout.3.body',
    icon: '🤖',
  },
];

export function getCheckoutCreditsTourSteps(t: TourTranslateFn): TourStep[] {
  return resolveTourSteps(CHECKOUT_CREDITS_TOUR_DEFS, t, getActiveMarket());
}

export function getWelcomeTourSteps(t: TourTranslateFn, market: Market = getActiveMarket()): TourStep[] {
  return resolveTourSteps(WELCOME_TOUR_DEFS, t, market);
}

export function getTourStepsBySection(t: TourTranslateFn, market: Market = getActiveMarket()): Record<string, TourStep[]> {
  return Object.fromEntries(
    Object.entries(TOUR_DEFS_BY_SECTION).map(([sectionId, defs]) => [
      sectionId,
      resolveTourSteps(defs, t, market),
    ]),
  );
}

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
