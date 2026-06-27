import { describe, expect, it } from 'vitest';
import {
  FIRST_SEARCH_HINT_DISMISSED_KEY,
  POST_ONBOARDING_VISIT_KEY,
  clearPostOnboardingVisit,
  dismissFirstSearchHint,
  getFirstSearchExample,
  isFirstSearchHintDismissed,
  isPostOnboardingVisit,
  markPostOnboardingVisit,
} from './first-search-hint';

describe('first-search-hint', () => {
  it('returns US example for US market', () => {
    const example = getFirstSearchExample('US');
    expect(example.country).toBe('US');
    expect(example.state).toBe('FL');
    expect(example.niches).toEqual(['barbershop']);
    expect(example.includedType).toBe('barber_shop');
  });

  it('returns BR example for BR market', () => {
    const example = getFirstSearchExample('BR');
    expect(example.country).toBe('BR');
    expect(example.state).toBe('SP');
    expect(example.niches).toEqual(['barbearia']);
    expect(example.includedType).toBe('barber_shop');
  });

  it('persists dismiss flag in localStorage', () => {
    localStorage.removeItem(FIRST_SEARCH_HINT_DISMISSED_KEY);
    expect(isFirstSearchHintDismissed()).toBe(false);
    dismissFirstSearchHint();
    expect(isFirstSearchHintDismissed()).toBe(true);
    expect(localStorage.getItem(FIRST_SEARCH_HINT_DISMISSED_KEY)).toBe('1');
  });

  it('tracks post-onboarding visit in sessionStorage', () => {
    sessionStorage.removeItem(POST_ONBOARDING_VISIT_KEY);
    expect(isPostOnboardingVisit()).toBe(false);
    markPostOnboardingVisit();
    expect(isPostOnboardingVisit()).toBe(true);
    clearPostOnboardingVisit();
    expect(isPostOnboardingVisit()).toBe(false);
  });
});
