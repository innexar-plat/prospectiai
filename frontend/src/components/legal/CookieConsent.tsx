'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

const STORAGE_KEY = 'prospector_cookie_consent';

export default function CookieConsent({ t }: { t: (key: string) => string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-label={t('cookie.bannerLabel')}
      className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 bg-card border-t border-border shadow-2xl"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-foreground flex-1">
          {t('cookie.message')}{' '}
          <Link to="/privacy" className="underline text-violet-500 hover:text-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
            {t('cookie.privacyLink')}
          </Link>
          .
        </p>
        <div className="flex gap-3 w-full sm:w-auto shrink-0">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={accept}
            aria-label={t('cookie.accept')}
          >
            {t('cookie.accept')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={accept}
            aria-label={t('cookie.accept')}
          >
            {t('cookie.essentialOnly')}
          </Button>
        </div>
      </div>
    </aside>
  );
}
