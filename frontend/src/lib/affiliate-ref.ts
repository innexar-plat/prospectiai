/**
 * Persiste e lê o código de afiliado (ref) via cookie para atribuição no cadastro e checkout.
 * Cookie: affiliate_ref, duração 30 dias.
 */
const COOKIE_NAME = 'affiliate_ref';
const MAX_AGE_DAYS = 30;

export function setAffiliateRef(code: string): void {
  if (typeof document === 'undefined' || !code?.trim()) return;
  const value = code.trim().toUpperCase().slice(0, 50);
  if (!value) return;
  const expires = new Date();
  expires.setDate(expires.getDate() + MAX_AGE_DAYS);
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)};path=/;max-age=${MAX_AGE_DAYS * 24 * 60 * 60};samesite=lax`;
}

export function getAffiliateRef(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  return raw?.trim() || null;
}

export function clearAffiliateRef(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=;path=/;max-age=0`;
}

/** Lê ?ref= da URL atual e persiste no cookie. Chamar no mount de páginas públicas. */
export function captureRefFromUrl(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) setAffiliateRef(ref);
}

/** Cookie para captura de representante via ?rep= */
const REP_COOKIE_NAME = 'rep_code';
const REP_MAX_AGE_DAYS = 30;

export function setRepCode(code: string): void {
  if (typeof document === 'undefined' || !code?.trim()) return;
  // Representative "code" is the rep's lowercase cuid id — do NOT uppercase it (unlike
  // affiliate codes, which are human-chosen and case-insensitive).
  const value = code.trim().slice(0, 50);
  if (!value) return;
  const expires = new Date();
  expires.setDate(expires.getDate() + REP_MAX_AGE_DAYS);
  document.cookie = `${REP_COOKIE_NAME}=${encodeURIComponent(value)};path=/;max-age=${REP_MAX_AGE_DAYS * 24 * 60 * 60};samesite=lax`;
}

export function getRepCode(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${REP_COOKIE_NAME}=([^;]*)`));
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  return raw?.trim() || null;
}

export function clearRepCode(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${REP_COOKIE_NAME}=;path=/;max-age=0`;
}

/** Lê ?rep= da URL atual, persiste no cookie e conta o clique pra métricas do representante. */
export function captureRepFromUrl(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const rep = params.get('rep');
  if (!rep) return;
  setRepCode(rep);
  fetch('/api/representative/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: rep.trim().slice(0, 50) }),
  }).catch(() => {
    // Best-effort click counter — never block or surface errors to the visitor.
  });
}
