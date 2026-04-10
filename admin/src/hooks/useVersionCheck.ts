import { useEffect, useRef, useCallback, useState } from 'react';

declare const __APP_VERSION__: string;
const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch('/admin/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== APP_VERSION) {
        setUpdateAvailable(true);
      }
    } catch {
      // offline — ignore
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(checkVersion, 30_000);
    intervalRef.current = setInterval(checkVersion, CHECK_INTERVAL_MS);
    const onFocus = () => checkVersion();
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(timeout);
      clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkVersion]);

  const reload = useCallback(() => {
    caches.keys().then((keys) => { for (const key of keys) caches.delete(key); });
    window.location.reload();
  }, []);

  return { updateAvailable, reload };
}
