/**
 * sessionStorage persistence for the last search results, so the list survives navigation and
 * full-page reloads (e.g. onboarding → first results).
 */
import type { LastSearchResults } from '@/contexts/SearchResultsContext';

const SESSION_KEY = 'prospector:lastSearch';

export function loadFromSession(): LastSearchResults | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastSearchResults;
  } catch {
    return null;
  }
}

export function saveToSession(results: LastSearchResults | null): void {
  try {
    if (results === null) {
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(results));
    }
  } catch {
    // sessionStorage might be unavailable (private mode restrictions)
  }
}
