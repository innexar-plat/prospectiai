import { useState } from 'react';
import { BellRing, Check, Trophy, XCircle } from 'lucide-react';
import { leadsApi, type LeadAnalysisListItem } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const REMIND_OPTIONS = [1, 3, 7] as const;

type Status = NonNullable<LeadAnalysisListItem['status']>;

/** Status + next follow-up for a saved lead: the bridge between the analysis and the sales routine. */
export function FollowUpBar({ item, onUpdated }: { item: LeadAnalysisListItem; onUpdated: (next: LeadAnalysisListItem) => void }) {
  const { t, locale } = useI18n();
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  const status: Status = item.status ?? 'NEW';
  const closed = status === 'CONVERTED' || status === 'LOST';

  const apply = async (call: () => Promise<LeadAnalysisListItem>, patch: Partial<LeadAnalysisListItem>, toast: string) => {
    setBusy(true);
    try {
      const updated = await call();
      onUpdated({ ...item, ...patch, ...updated, lead: item.lead });
      addToast('success', toast);
    } catch {
      addToast('error', t('dash.today.toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const remindIn = (days: number) => {
    const at = new Date(Date.now() + days * DAY_MS).toISOString();
    void apply(() => leadsApi.setFollowUp(item.id, at), { nextFollowUpAt: at }, t('page.leadDetail.followUp.scheduled', { days }));
  };

  const setStatus = (next: Status) => {
    const at = next === 'CONTACTED' ? new Date(Date.now() + 3 * DAY_MS).toISOString() : null;
    void apply(
      () => leadsApi.updateStatus(item.id, next, next === 'CONTACTED' ? { nextFollowUpAt: at } : undefined),
      { status: next, nextFollowUpAt: at },
      t(`page.leadDetail.followUp.toast.${next}`),
    );
  };

  const due = item.nextFollowUpAt ? new Date(item.nextFollowUpAt) : null;
  const overdue = due != null && due.getTime() < Date.now();
  const dueLabel = due?.toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es' : 'pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

  return (
    <section aria-label={t('page.leadDetail.followUp.title')} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
      <span className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        status === 'NEW' && 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
        status === 'CONTACTED' && 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
        status === 'CONVERTED' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        status === 'LOST' && 'bg-red-500/10 text-red-700 dark:text-red-300',
      )}>
        {t(`page.leadDetail.followUp.status.${status}`)}
      </span>

      {!closed && (
        <span className={cn('inline-flex items-center gap-1 text-xs', overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted')}>
          <BellRing size={13} aria-hidden />
          {due ? t('page.leadDetail.followUp.next', { date: dueLabel ?? '' }) : t('page.leadDetail.followUp.none')}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
        {!closed && (
          <>
            <button type="button" disabled={busy} onClick={() => setStatus('CONTACTED')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
              <Check size={14} aria-hidden /> {t('page.leadDetail.followUp.contactedToday')}
            </button>
            <span className="text-[11px] text-muted pl-1">{t('page.leadDetail.followUp.remind')}</span>
            {REMIND_OPTIONS.map((d) => (
              <button key={d} type="button" disabled={busy} onClick={() => remindIn(d)} className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground hover:bg-surface disabled:opacity-50">
                {t('page.leadDetail.followUp.days', { days: d })}
              </button>
            ))}
            <button type="button" disabled={busy} onClick={() => setStatus('CONVERTED')} title={t('page.leadDetail.followUp.status.CONVERTED')} aria-label={t('page.leadDetail.followUp.status.CONVERTED')} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50">
              <Trophy size={14} aria-hidden />
            </button>
            <button type="button" disabled={busy} onClick={() => setStatus('LOST')} title={t('page.leadDetail.followUp.status.LOST')} aria-label={t('page.leadDetail.followUp.status.LOST')} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-red-600 hover:bg-red-500/10 disabled:opacity-50">
              <XCircle size={14} aria-hidden />
            </button>
          </>
        )}
        {closed && (
          <button type="button" disabled={busy} onClick={() => setStatus('NEW')} className="h-8 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-surface disabled:opacity-50">
            {t('page.leadDetail.followUp.reopen')}
          </button>
        )}
      </div>
    </section>
  );
}
