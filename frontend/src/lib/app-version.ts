/**
 * Canonical app version — keep in sync with frontend/package.json and backend/package.json.
 */
export const APP_VERSION = '2.2.0';

/** localStorage key prefix for the per-version "what's new" banner dismiss flag. */
export const WHATS_NEW_SEEN_KEY_PREFIX = 'prospector-whats-new-seen-v';

export function getWhatsNewSeenKey(version: string = APP_VERSION): string {
  return `${WHATS_NEW_SEEN_KEY_PREFIX}${version}`;
}

export function hasSeenWhatsNew(version: string = APP_VERSION): boolean {
  try {
    return window.localStorage.getItem(getWhatsNewSeenKey(version)) === '1';
  } catch {
    return false;
  }
}

export function markWhatsNewSeen(version: string = APP_VERSION): void {
  try {
    window.localStorage.setItem(getWhatsNewSeenKey(version), '1');
  } catch {
    // Ignore storage issues (private mode, quota, etc.).
  }
}
