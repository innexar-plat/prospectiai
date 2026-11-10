/**
 * First-touch attribution: what brought the visitor the very first time (UTM, external
 * referrer, landing page). Captured on the first page load, kept in localStorage and sent once
 * after login, so a sale can be traced back to SEO, cold e-mail, ads or a referral.
 */
import { radarApi, type FirstTouch } from '@/lib/api';

const KEY = 'precision:first-touch';
const sentKey = (userId: string) => `precision:first-touch-sent:${userId}`;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

export function captureFirstTouch(loc: Pick<Location, 'search' | 'pathname' | 'hostname'> = window.location, referrer = document.referrer): void {
  if (safeGet(KEY)) return;
  const params = new URLSearchParams(loc.search);
  let externalReferrer: string | null = null;
  if (referrer) {
    try {
      const host = new URL(referrer).hostname;
      if (host && host !== loc.hostname) externalReferrer = referrer.slice(0, 300);
    } catch { /* ignore */ }
  }
  const touch: FirstTouch = {
    source: params.get('utm_source') ?? (params.get('gclid') ? 'google-ads' : params.get('fbclid') ? 'facebook-ads' : null),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    referrer: externalReferrer,
    landing: loc.pathname.slice(0, 300),
    at: new Date().toISOString(),
  };
  safeSet(KEY, JSON.stringify(touch));
}

export function readFirstTouch(): FirstTouch | null {
  const raw = safeGet(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as FirstTouch; } catch { return null; }
}

/** Sends the stored first touch once per user (server keeps the first one it receives). */
export function flushFirstTouch(userId: string): void {
  if (safeGet(sentKey(userId))) return;
  const firstTouch = readFirstTouch();
  if (!firstTouch) return;
  radarApi.saveAttribution({ firstTouch })
    .then(() => safeSet(sentKey(userId), '1'))
    .catch(() => undefined);
}
