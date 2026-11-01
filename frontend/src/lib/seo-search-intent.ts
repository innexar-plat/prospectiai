/**
 * What a visitor came for on a public SEO page ("Restaurantes em São Paulo"). Saved when they
 * click the CTA and used by onboarding's first search, so the first screen after sign-up is the
 * list they were promised — not a generic suggestion.
 */
const KEY = 'precision:seo-search-intent';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SeoSearchIntent {
  term: string;
  city: string;
  uf: string;
}

export function saveSeoSearchIntent(intent: SeoSearchIntent): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...intent, savedAt: Date.now() }));
  } catch { /* storage optional */ }
}

export function readSeoSearchIntent(): SeoSearchIntent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SeoSearchIntent & { savedAt?: number };
    if (!parsed.term || !parsed.city || !parsed.savedAt || Date.now() - parsed.savedAt > TTL_MS) return null;
    return { term: parsed.term, city: parsed.city, uf: parsed.uf };
  } catch {
    return null;
  }
}

export function clearSeoSearchIntent(): void {
  try { localStorage.removeItem(KEY); } catch { /* storage optional */ }
}
