import { getActiveMarket, type Market } from '@/lib/market';

export const FIRST_SEARCH_HINT_DISMISSED_KEY = 'prospector-first-search-hint-dismissed';
export const POST_ONBOARDING_VISIT_KEY = 'prospector-post-onboarding-visit';
export const FIRST_SEARCH_HINT_DELAY_MS = 30_000;

export interface FirstSearchExample {
  country: string;
  state: string;
  niches: string[];
  includedType: string;
  /** i18n key for the "Try: …" label */
  exampleLabelKey: string;
}

const US_EXAMPLE: FirstSearchExample = {
  country: 'US',
  state: 'FL',
  niches: ['barbershop'],
  includedType: 'barber_shop',
  exampleLabelKey: 'dash.firstSearchHint.exampleUs',
};

const BR_EXAMPLE: FirstSearchExample = {
  country: 'BR',
  state: 'SP',
  niches: ['barbearia'],
  includedType: 'barber_shop',
  exampleLabelKey: 'dash.firstSearchHint.exampleBr',
};

export function getFirstSearchExample(market: Market = getActiveMarket()): FirstSearchExample {
  return market === 'US' ? US_EXAMPLE : BR_EXAMPLE;
}

export function isFirstSearchHintDismissed(): boolean {
  try {
    return window.localStorage.getItem(FIRST_SEARCH_HINT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissFirstSearchHint(): void {
  try {
    window.localStorage.setItem(FIRST_SEARCH_HINT_DISMISSED_KEY, '1');
  } catch {
    // Ignore storage issues.
  }
}

export function isPostOnboardingVisit(): boolean {
  try {
    return window.sessionStorage.getItem(POST_ONBOARDING_VISIT_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPostOnboardingVisit(): void {
  try {
    window.sessionStorage.setItem(POST_ONBOARDING_VISIT_KEY, '1');
  } catch {
    // Ignore storage issues.
  }
}

export function clearPostOnboardingVisit(): void {
  try {
    window.sessionStorage.removeItem(POST_ONBOARDING_VISIT_KEY);
  } catch {
    // Ignore storage issues.
  }
}
