import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Check, Clock, Flame, MessageCircle, PartyPopper } from 'lucide-react';
import { leadsApi, type AgendaItem, type TodayAgenda as TodayAgendaData } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { whatsappLink } from '@/lib/lead-contact-utils';
import { cn } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const VISIBLE = 6;

function inDays(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

/**
 * "Hoje": the rep's daily list — due follow-ups first, then the best saved leads nobody has
 * contacted. Each action reschedules the lead so it leaves today's list.
 */
export function TodayAgenda() {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [data, setData] = useState<TodayAgendaData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    leadsApi.today().then((d) => { if (!cancelled) setData(d); }).catch(() => { /* agenda is optional */ });
    return () => { cancelled = true; };
  }, []);

  const finish = useCallback((item: AgendaItem, contacted: boolean) => {
    setData((prev) => prev && {
      items: prev.items.filter((i) => i.analysisId !== item.analysisId),
      stats: {
        ...prev.stats,
        dueCount: Math.max(0, prev.stats.dueCount - (item.nextFollowUpAt ? 1 : 0)),
        contactedToday: prev.stats.contactedToday + (contacted ? 1 : 0),
        contactedThisWeek: prev.stats.contactedThisWeek + (contacted ? 1 : 0),
      },
    });
  }, []);

  const markContacted = useCallback(async (item: AgendaItem) => {
    setBusy(item.analysisId);
    try {
      await leadsApi.updateStatus(item.analysisId, 'CONTACTED', { nextFollowUpAt: inDays(3) });
      finish(item, true);
      addToast('success', t('dash.today.toast.contacted'));
    } catch {
      addToast('error', t('dash.today.toast.error'));
    } finally {
      setBusy(null);
    }
  }, [addToast, finish, t]);

  /**
   * Leads already contacted get the next cadence message (2nd, 3rd, breakup) written by the AI.
   * The tab is opened synchronously so popup blockers allow it, then pointed at WhatsApp.
   */
  const openFollowUpWhatsApp = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>, item: AgendaItem) => {
    if (item.status !== 'CONTACTED') { void markContacted(item); return; }
    e.preventDefault();
    const tab = window.open('', '_blank');
    let message = item.whatsappMessage;
    try {
      message = (await leadsApi.followUpMessage(item.analysisId)).message;
    } catch { /* fall back to the original message */ }
    const link = whatsappLink(item.phone, message);
    if (link) {
      if (tab) tab.location.href = link; else window.location.href = link;
    } else {
      tab?.close();
    }
    void markContacted(item);
  }, [markContacted]);

  const snooze = useCallback(async (item: AgendaItem) => {
    setBusy(item.analysisId);
    try {
      await leadsApi.setFollowUp(item.analysisId, inDays(2));
      finish(item, false);
      addToast('info', t('dash.today.toast.snoozed'));
    } catch {
      addToast('error', t('dash.today.toast.error'));
    } finally {
      setBusy(null);
    }
  }, [addToast, finish, t]);

  if (!data || (data.items.length === 0 && data.stats.activeLeads === 0)) return null;

  const { items, stats } = data;

  return (
    <section id="hoje" aria-label={t('dash.today.title')} className="rounded-2xl border border-border bg-card p-4 sm:p-5 stagger-in">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <CalendarCheck size={18} className="text-violet-600 dark:text-violet-400" aria-hidden />
          {t('dash.today.title')}
        </h2>
        <p className="text-xs text-muted">
          {t('dash.today.stats', { today: stats.contactedToday, week: stats.contactedThisWeek })}
        </p>
        <Link to="/dashboard/leads" className="ml-auto text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline">
          {t('dash.today.allLeads')}
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          <PartyPopper size={16} aria-hidden /> {t('dash.today.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.slice(0, VISIBLE).map((item) => {
            const wa = whatsappLink(item.phone, item.whatsappMessage);
            const disabled = busy === item.analysisId;
            return (
              <li key={item.analysisId} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link to={`/dashboard/lead/${item.placeId}`} className="block truncate text-sm font-semibold text-foreground hover:text-violet-700 dark:hover:text-violet-300">
                    {item.name}
                  </Link>
                  <ReasonChip item={item} />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { void openFollowUpWhatsApp(e, item); }}
                      title={item.status === 'CONTACTED' ? t('dash.today.nextMessageHint') : undefined}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                    >
                      <MessageCircle size={14} aria-hidden /> {item.status === 'CONTACTED' ? t('dash.today.nextMessage') : 'WhatsApp'}
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => { void markContacted(item); }}
                    title={t('dash.today.markContacted')}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground hover:bg-surface disabled:opacity-50"
                  >
                    <Check size={14} aria-hidden /> <span className="hidden sm:inline">{t('dash.today.done')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => { void snooze(item); }}
                    title={t('dash.today.snooze')}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-muted hover:bg-surface disabled:opacity-50"
                  >
                    <Clock size={14} aria-hidden /> <span className="hidden sm:inline">{t('dash.today.snoozeShort')}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > VISIBLE && (
        <p className="mt-2 text-xs text-muted">{t('dash.today.more', { count: items.length - VISIBLE })}</p>
      )}
    </section>
  );
}

function ReasonChip({ item }: { item: AgendaItem }) {
  const { t } = useI18n();
  const base = 'mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium';
  if (item.reason === 'overdue') {
    return <span className={cn(base, 'text-red-600 dark:text-red-400')}><Clock size={11} aria-hidden />{t('dash.today.reason.overdue', { days: item.overdueDays })}</span>;
  }
  if (item.reason === 'due_today') {
    return <span className={cn(base, 'text-amber-700 dark:text-amber-400')}><Clock size={11} aria-hidden />{t('dash.today.reason.dueToday')}</span>;
  }
  const window = item.bestContactWindow ? ` · ${item.bestContactWindow}` : '';
  if (item.reason === 'hot_new') {
    return <span className={cn(base, 'text-violet-700 dark:text-violet-300')}><Flame size={11} aria-hidden />{t('dash.today.reason.hot', { score: item.score ?? 0 })}{window}</span>;
  }
  return <span className={cn(base, 'text-muted')}>{t('dash.today.reason.new')}{window}</span>;
}
