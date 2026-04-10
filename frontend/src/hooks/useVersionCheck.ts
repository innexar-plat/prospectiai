import { useEffect, useRef, useCallback, useState } from 'react';
import { APP_VERSION } from '@/lib/version';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Periodically polls /version.json to detect new deployments.
 * When a mismatch is found, shows a non-intrusive prompt to reload.
 * Also triggers a check on window focus (user comes back to tab).
 */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== APP_VERSION) {
        setUpdateAvailable(true);
      }
    } catch {
      // Network errors are fine — user is offline
    }
  }, []);

  useEffect(() => {
    // Initial check after 30 seconds (let the app settle)
    const timeout = setTimeout(checkVersion, 30_000);

    // Periodic checks
    intervalRef.current = setInterval(checkVersion, CHECK_INTERVAL_MS);

    // Check on window focus (user comes back to the tab)
    const onFocus = () => checkVersion();
    window.addEventListener('focus', onFocus);

    return () => {
      clearTimeout(timeout);
      clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkVersion]);

  const reload = useCallback(() => {
    // Clear SW cache then reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
      caches.keys().then((keys) => {
        for (const key of keys) caches.delete(key);
      });
    }
    window.location.reload();
  }, []);

  return { updateAvailable, reload };
}
