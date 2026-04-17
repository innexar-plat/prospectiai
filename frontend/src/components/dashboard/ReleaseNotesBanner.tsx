import { useMemo, useState } from 'react';
import { CheckCircle2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

const DISMISS_KEY_PREFIX = 'release-notes-banner-dismissed';

function getDismissKey(version: string): string {
  return `${DISMISS_KEY_PREFIX}:${version}`;
}

function hasSeenCurrentVersion(version: string): boolean {
  try {
    return window.localStorage.getItem(getDismissKey(version)) === '1';
  } catch {
    return false;
  }
}

function markSeen(version: string): void {
  try {
    window.localStorage.setItem(getDismissKey(version), '1');
  } catch {
    // Ignore storage issues.
  }
}

export function ReleaseNotesBanner() {
  const [dismissed, setDismissed] = useState(() => hasSeenCurrentVersion(APP_VERSION));

  const highlights = useMemo(
    () => [
      'Mais contexto e precisão nas análises dos leads',
      'Resultados e detalhes com dados empresariais mais úteis',
      'Melhorias contínuas de desempenho, estabilidade e segurança',
    ],
    [],
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    markSeen(APP_VERSION);
    setDismissed(true);
  };

  return (
    <div className="shrink-0 border-b border-emerald-500/20 bg-[linear-gradient(90deg,rgba(16,185,129,0.08),rgba(59,130,246,0.08))]">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 sm:px-6">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:bg-card/70 dark:text-emerald-300">
              Novidades da versao {APP_VERSION}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/15 bg-white/70 px-2.5 py-1 text-[11px] text-muted dark:bg-card/70">
              <ShieldCheck size={12} /> Beneficios para sua operacao
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            Refinamos a experiencia para deixar a prospeccao mais confiavel, contextual e objetiva no uso diario.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            {highlights.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-white/75 px-2.5 py-1 dark:bg-card/75"
              >
                <CheckCircle2 size={12} className="text-emerald-500" />
                {item}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-white/70 text-muted transition-colors hover:text-foreground dark:bg-card/70"
          aria-label="Fechar novidades"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}