'use client';

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const SECTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export default function Privacy() {
  const { t } = useI18n();

  useEffect(() => {
    document.title = `${t('legal.privacy.title')} | Precision`;
  }, [t]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">
        <Link to="/" className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-8 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
          <ArrowLeft size={18} aria-hidden />
          {t('legal.back')}
        </Link>
        <h1 className="text-3xl md:text-4xl font-black mb-2">{t('legal.privacy.title')}</h1>
        <p className="text-muted text-sm mb-12">{t('legal.privacy.updated')}</p>
        <article className="space-y-8 text-muted">
          {SECTIONS.map((n) => (
            <section key={n} id={n === 4 ? 'cookies' : undefined}>
              <h2 className="text-xl font-bold text-foreground">{t(`legal.privacy.s${n}.title`)}</h2>
              <p>{t(`legal.privacy.s${n}.body`)}</p>
            </section>
          ))}
        </article>
        <div className="mt-12 pt-8 border-t border-border flex gap-6 text-sm">
          <Link to="/terms" className="text-violet-500 hover:underline">{t('legal.linkTerms')}</Link>
          <Link to="/" className="text-muted hover:text-foreground">{t('legal.home')}</Link>
        </div>
      </div>
    </div>
  );
}
