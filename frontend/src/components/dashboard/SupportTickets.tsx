import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, LifeBuoy, Loader2, MessageSquarePlus, Send } from 'lucide-react';
import {
  supportApi,
  type SupportTicketCategory,
  type SupportTicketDetail,
  type SupportTicketStatus,
  type SupportTicketSummary,
} from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

const CATEGORIES: SupportTicketCategory[] = ['QUESTION', 'PROBLEM', 'BILLING', 'SUGGESTION'];

const STATUS_STYLE: Record<SupportTicketStatus, string> = {
  OPEN: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ANSWERED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  CLOSED: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

function StatusBadge({ status }: { status: SupportTicketStatus }) {
  const { t } = useI18n();
  return (
    <span className={cn('inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', STATUS_STYLE[status])}>
      {t(`support.tickets.status.${status}`)}
    </span>
  );
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es' : 'pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Open a ticket, follow the conversation and reply — the support channel that never bounces. */
export function SupportTickets() {
  const { t, locale } = useI18n();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicketSummary[] | null>(null);
  const [open, setOpen] = useState<SupportTicketDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'QUESTION' as SupportTicketCategory, message: '' });
  const [reply, setReply] = useState('');

  const reload = useCallback(() => {
    supportApi.list().then((r) => setTickets(r.tickets)).catch(() => setTickets([]));
  }, []);

  const openTicket = useCallback((id: string) => {
    setBusy(true);
    supportApi.get(id)
      .then((r) => { setOpen(r.ticket); setCreating(false); })
      .catch(() => addToast('error', t('support.tickets.toast.loadError')))
      .finally(() => setBusy(false));
  }, [addToast, t]);

  useEffect(() => { reload(); }, [reload]);

  // Deep link from the reply e-mail / notification: /dashboard/suporte?chamado=<id>.
  // Runs only when the link changes (openTicket's identity follows `t`, which may change per render).
  const deepLink = searchParams.get('chamado');
  const openTicketRef = useRef(openTicket);
  openTicketRef.current = openTicket;
  useEffect(() => {
    if (deepLink) openTicketRef.current(deepLink);
  }, [deepLink]);

  const closeView = () => {
    setOpen(null);
    if (deepLink) {
      searchParams.delete('chamado');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.subject.trim().length < 3 || form.message.trim().length < 5) {
      addToast('error', t('support.tickets.toast.tooShort'));
      return;
    }
    setBusy(true);
    try {
      const { ticket } = await supportApi.create({
        ...form,
        context: { page: document.referrer || window.location.pathname, userAgent: navigator.userAgent.slice(0, 300) },
      });
      setForm({ subject: '', category: 'QUESTION', message: '' });
      addToast('success', t('support.tickets.toast.created', { number: ticket.number }));
      reload();
      openTicket(ticket.id);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('support.tickets.toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!open || !reply.trim()) return;
    setBusy(true);
    try {
      const { ticket } = await supportApi.reply(open.id, reply.trim());
      setOpen(ticket);
      setReply('');
      reload();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('support.tickets.toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const closeTicket = async () => {
    if (!open) return;
    setBusy(true);
    try {
      const { ticket } = await supportApi.close(open.id);
      setOpen(ticket);
      reload();
    } catch {
      addToast('error', t('support.tickets.toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-violet-500/30';

  return (
    <section id="chamados" aria-label={t('support.tickets.title')} className="rounded-3xl bg-card border border-border overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 p-5 sm:p-6 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
          <LifeBuoy size={18} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-foreground">{t('support.tickets.title')}</h3>
          <p className="text-xs text-muted">{t('support.tickets.subtitle')}</p>
        </div>
        {!open && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <MessageSquarePlus size={16} aria-hidden /> {t('support.tickets.new')}
          </button>
        )}
      </header>

      {creating && !open && (
        <form onSubmit={submitNew} className="p-5 sm:p-6 space-y-3 border-b border-border">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{t('support.tickets.subject')}</span>
              <input className={inputClass} maxLength={140} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={t('support.tickets.subjectPlaceholder')} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{t('support.tickets.category')}</span>
              <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SupportTicketCategory })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`support.tickets.cat.${c}`)}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t('support.tickets.message')}</span>
            <textarea className={cn(inputClass, 'min-h-[120px] resize-y')} maxLength={5000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t('support.tickets.messagePlaceholder')} />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="h-9 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-surface">
              {t('support.tickets.cancel')}
            </button>
            <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />} {t('support.tickets.send')}
            </button>
          </div>
        </form>
      )}

      {open ? (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={closeView} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground">
              <ArrowLeft size={14} aria-hidden /> {t('support.tickets.back')}
            </button>
            <h4 className="min-w-0 truncate text-sm font-bold text-foreground">#{open.number} · {open.subject}</h4>
            <StatusBadge status={open.status} />
          </div>
          <ol className="space-y-3">
            {open.messages.map((msg) => {
              const mine = msg.authorType === 'USER';
              return (
                <li key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm', mine ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-surface border border-border text-foreground rounded-bl-sm')}>
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p className={cn('mt-1 text-[10px]', mine ? 'text-white/70' : 'text-muted')}>
                      {mine ? t('support.tickets.you') : t('support.tickets.team')} · {formatDate(msg.createdAt, locale)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {open.status === 'OPEN' && (
            <p className="text-xs text-muted">{t('support.tickets.waiting')}</p>
          )}
          <div className="space-y-2">
            <textarea className={cn(inputClass, 'min-h-[90px] resize-y')} maxLength={5000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={open.status === 'CLOSED' ? t('support.tickets.reopenPlaceholder') : t('support.tickets.replyPlaceholder')} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {open.status !== 'CLOSED' && (
                <button type="button" disabled={busy} onClick={() => { void closeTicket(); }} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50">
                  <CheckCircle2 size={15} aria-hidden /> {t('support.tickets.resolved')}
                </button>
              )}
              <button type="button" disabled={busy || !reply.trim()} onClick={() => { void sendReply(); }} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />} {t('support.tickets.reply')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {tickets === null ? (
            <p className="p-6 text-sm text-muted">{t('support.tickets.loading')}</p>
          ) : tickets.length === 0 ? (
            !creating && <p className="p-6 text-sm text-muted">{t('support.tickets.empty')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((tk) => (
                <li key={tk.id}>
                  <button type="button" onClick={() => openTicket(tk.id)} className="flex w-full items-center gap-3 px-5 sm:px-6 py-3.5 text-left hover:bg-surface/40">
                    <span className="text-xs tabular-nums text-muted">#{tk.number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{tk.subject}</span>
                    <span className="hidden sm:inline text-[11px] text-muted">{formatDate(tk.lastMessageAt, locale)}</span>
                    <StatusBadge status={tk.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
