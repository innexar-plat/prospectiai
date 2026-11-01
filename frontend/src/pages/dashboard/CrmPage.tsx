import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlarmClock, ArrowDown, ArrowUp, Calendar, CheckCircle2, Circle, Download, ExternalLink, Mail, MessageCircle,
  Pencil, Phone, Plus, Search, Settings2, StickyNote, Trash2, Trophy, Users, X, XCircle,
} from 'lucide-react';
import {
  crmApi,
  type CrmActivity,
  type CrmActivityType,
  type CrmBoard,
  type CrmDealCard,
  type CrmDealDetail,
  type CrmMember,
  type CrmStage,
  type CrmStageKind,
} from '@/lib/api';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { getActiveMarket } from '@/lib/market';
import { whatsappLink } from '@/lib/lead-contact-utils';
import { cn } from '@/lib/utils';

// ── Texts (pt for BR/es, en for US) ─────────────────────────────────────────

const TXT = {
  pt: {
    title: 'CRM', subtitle: 'Seu funil de vendas: arraste as negociações entre as etapas.', breadcrumb: 'Vendas / CRM',
    openValue: 'Em aberto', forecast: 'Receita prevista', wonMonth: 'Ganho no mês', winRate: 'Taxa de ganho (90d)', cycle: 'Ciclo médio', overdue: 'Tarefas atrasadas',
    days: 'dias', newDeal: 'Nova negociação', stages: 'Etapas', export: 'Exportar CSV', search: 'Buscar negociação, empresa ou contato', allOwners: 'Todos os responsáveis',
    empty: 'Arraste negociações para cá', weighted: 'ponderado', deals: 'negociações',
    titleField: 'Negociação', company: 'Empresa', contact: 'Contato', phone: 'Telefone', email: 'E-mail', value: 'Valor', closeDate: 'Previsão de fechamento',
    stage: 'Etapa', owner: 'Responsável', save: 'Salvar', cancel: 'Cancelar', create: 'Criar negociação', delete: 'Excluir negociação', confirmDelete: 'Excluir esta negociação e o histórico?',
    lostReason: 'Motivo da perda', lostReasonPh: 'Ex.: preço, sem orçamento, escolheu concorrente', confirmLost: 'Marcar como perdida',
    timeline: 'Histórico', addActivity: 'Registrar', activityPh: 'O que aconteceu ou o que precisa ser feito?', dueAt: 'Para quando', openLead: 'Ver análise do lead',
    won: 'Ganho', lost: 'Perdido', markWon: 'Ganhar', markLost: 'Perder', task: 'Tarefa', noActivity: 'Nenhuma atividade ainda.',
    stagesTitle: 'Etapas do funil', addStage: 'Adicionar etapa', probability: 'Chance (%)', kindOpen: 'Em aberto', kindWon: 'Ganho', kindLost: 'Perdido',
    saved: 'Salvo.', error: 'Não foi possível concluir. Tente de novo.', created: 'Negociação criada.', next: 'Próxima', overdueShort: 'atrasada',
    types: { NOTE: 'Nota', CALL: 'Ligação', WHATSAPP: 'WhatsApp', EMAIL: 'E-mail', MEETING: 'Reunião', TASK: 'Tarefa', STAGE_CHANGE: 'Mudou de etapa' },
  },
  en: {
    title: 'CRM', subtitle: 'Your sales pipeline: drag deals between stages.', breadcrumb: 'Sales / CRM',
    openValue: 'Open', forecast: 'Forecast', wonMonth: 'Won this month', winRate: 'Win rate (90d)', cycle: 'Avg. cycle', overdue: 'Overdue tasks',
    days: 'days', newDeal: 'New deal', stages: 'Stages', export: 'Export CSV', search: 'Search deal, company or contact', allOwners: 'All owners',
    empty: 'Drop deals here', weighted: 'weighted', deals: 'deals',
    titleField: 'Deal', company: 'Company', contact: 'Contact', phone: 'Phone', email: 'E-mail', value: 'Value', closeDate: 'Expected close',
    stage: 'Stage', owner: 'Owner', save: 'Save', cancel: 'Cancel', create: 'Create deal', delete: 'Delete deal', confirmDelete: 'Delete this deal and its history?',
    lostReason: 'Lost reason', lostReasonPh: 'e.g. price, no budget, chose a competitor', confirmLost: 'Mark as lost',
    timeline: 'Timeline', addActivity: 'Log', activityPh: 'What happened or what needs to be done?', dueAt: 'Due', openLead: 'Open lead analysis',
    won: 'Won', lost: 'Lost', markWon: 'Win', markLost: 'Lose', task: 'Task', noActivity: 'No activity yet.',
    stagesTitle: 'Pipeline stages', addStage: 'Add stage', probability: 'Chance (%)', kindOpen: 'Open', kindWon: 'Won', kindLost: 'Lost',
    saved: 'Saved.', error: 'Could not complete. Please try again.', created: 'Deal created.', next: 'Next', overdueShort: 'overdue',
    types: { NOTE: 'Note', CALL: 'Call', WHATSAPP: 'WhatsApp', EMAIL: 'E-mail', MEETING: 'Meeting', TASK: 'Task', STAGE_CHANGE: 'Stage change' },
  },
} as const;

type Texts = (typeof TXT)['pt'] | (typeof TXT)['en'];

const STAGE_COLORS: Record<string, string> = {
  slate: 'bg-slate-400', sky: 'bg-sky-500', violet: 'bg-violet-500', amber: 'bg-amber-500', orange: 'bg-orange-500', emerald: 'bg-emerald-500', red: 'bg-red-500',
};

const LOGGABLE: Array<Exclude<CrmActivityType, 'STAGE_CHANGE'>> = ['NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'TASK'];

const ACTIVITY_ICON: Record<CrmActivityType, typeof StickyNote> = {
  NOTE: StickyNote, CALL: Phone, WHATSAPP: MessageCircle, EMAIL: Mail, MEETING: Users, TASK: AlarmClock, STAGE_CHANGE: ArrowDown,
};

function useMoney() {
  const us = getActiveMarket() === 'US';
  return useCallback((n: number) => n.toLocaleString(us ? 'en-US' : 'pt-BR', { style: 'currency', currency: us ? 'USD' : 'BRL', maximumFractionDigits: 0 }), [us]);
}

function fmtDate(iso: string | null, locale: string, withTime = false): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR', withTime
    ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-violet-500/30';

// ── Page ────────────────────────────────────────────────────────────────────

export default function CrmPage() {
  const { locale } = useI18n();
  const T: Texts = locale === 'en' ? TXT.en : TXT.pt;
  const { addToast } = useToast();
  const money = useMoney();
  const [searchParams, setSearchParams] = useSearchParams();
  const [board, setBoard] = useState<CrmBoard | null>(null);
  const [members, setMembers] = useState<CrmMember[]>([]);
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState('');
  const [openDealId, setOpenDealId] = useState<string | null>(searchParams.get('deal'));
  const [creating, setCreating] = useState(false);
  const [editingStages, setEditingStages] = useState(false);
  const [pendingLost, setPendingLost] = useState<{ deal: CrmDealCard; stageId: string } | null>(null);
  const dragId = useRef<string | null>(null);

  const load = useCallback(() => {
    crmApi.board({ q: q.trim() || undefined, owner: owner || undefined })
      .then(setBoard)
      .catch(() => addToast('error', T.error));
  }, [q, owner, addToast, T.error]);

  useEffect(() => {
    const id = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  useEffect(() => {
    crmApi.members().then((r) => setMembers(r.members)).catch(() => undefined);
  }, []);

  const memberName = useCallback((id: string | null) => {
    const m = members.find((x) => x.userId === id);
    return m ? ((m.name || m.email || '').split(' ')[0] ?? '') : '';
  }, [members]);

  const openDeal = (id: string | null) => {
    setOpenDealId(id);
    if (id) searchParams.set('deal', id); else searchParams.delete('deal');
    setSearchParams(searchParams, { replace: true });
  };

  /** Optimistic move; the server records the stage change. */
  const move = async (deal: CrmDealCard, stageId: string, lostReason?: string) => {
    if (!board) return;
    const target = board.stages.find((s) => s.id === stageId);
    if (!target || (deal.stageId === stageId && !lostReason)) return;
    if (target.kind === 'LOST' && lostReason === undefined) {
      setPendingLost({ deal, stageId });
      return;
    }
    const position = (target.deals[0]?.position ?? 1) - 1;
    const previous = board;
    setBoard({
      ...board,
      stages: board.stages.map((s) => {
        const without = s.deals.filter((d) => d.id !== deal.id);
        const deals = s.id === stageId ? [{ ...deal, stageId, position }, ...without] : without;
        const value = deals.reduce((sum, d) => sum + d.value, 0);
        return { ...s, deals, count: deals.length, value, weighted: (value * s.probability) / 100 };
      }),
    });
    try {
      await crmApi.moveDeal(deal.id, stageId, position, lostReason);
      load();
    } catch {
      setBoard(previous);
      addToast('error', T.error);
    }
  };

  const metrics = board?.metrics;
  const metricCards = metrics ? [
    { label: T.openValue, value: money(metrics.openValue), hint: `${metrics.openCount} ${T.deals}` },
    { label: T.forecast, value: money(metrics.forecast) },
    { label: T.wonMonth, value: money(metrics.wonThisMonthValue), hint: `${metrics.wonThisMonthCount} ${T.deals}` },
    { label: T.winRate, value: metrics.winRate90d == null ? '—' : `${metrics.winRate90d}%` },
    { label: T.cycle, value: metrics.avgCycleDays == null ? '—' : `${metrics.avgCycleDays} ${T.days}` },
    { label: T.overdue, value: String(metrics.overdueTasks), alert: metrics.overdueTasks > 0 },
  ] : [];

  return (
    <>
      <HeaderDashboard title={T.title} subtitle={T.subtitle} breadcrumb={T.breadcrumb} />
      <div className="px-4 sm:px-6 py-5 space-y-4 w-full">
        <section aria-label="Métricas" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {(metricCards.length ? metricCards : Array.from({ length: 6 }, () => null)).map((c, i) => (
            <div key={c?.label ?? i} className="rounded-2xl border border-border bg-card p-3.5">
              {c ? (
                <>
                  <p className="text-[11px] font-medium text-muted">{c.label}</p>
                  <p className={cn('mt-1 text-lg font-black tabular-nums', c.alert ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{c.value}</p>
                  {c.hint && <p className="text-[11px] text-muted">{c.hint}</p>}
                </>
              ) : <div className="h-12 animate-pulse rounded bg-surface" />}
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.search} className={cn(inputCls, 'pl-9')} aria-label={T.search} />
          </div>
          {members.length > 1 && (
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={cn(inputCls, 'w-auto')} aria-label={T.owner}>
              <option value="">{T.allOwners}</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}
            </select>
          )}
          <div className="ml-auto flex items-center gap-2">
            <a href="/api/crm/export" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-surface">
              <Download size={15} aria-hidden /> <span className="hidden sm:inline">{T.export}</span>
            </a>
            <button type="button" onClick={() => setEditingStages(true)} disabled={!board} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-surface disabled:opacity-50">
              <Settings2 size={15} aria-hidden /> <span className="hidden sm:inline">{T.stages}</span>
            </button>
            <button type="button" onClick={() => setCreating(true)} disabled={!board} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
              <Plus size={16} aria-hidden /> {T.newDeal}
            </button>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-3" role="list" aria-label={T.title}>
          {board?.stages.map((stage) => (
            <section
              key={stage.id}
              role="listitem"
              aria-label={stage.name}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragId.current ?? e.dataTransfer.getData('text/plain');
                const deal = board.stages.flatMap((s) => s.deals).find((d) => d.id === id);
                dragId.current = null;
                if (deal) void move(deal, stage.id);
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-2xl border bg-surface/40',
                stage.kind === 'WON' ? 'border-emerald-500/30' : stage.kind === 'LOST' ? 'border-red-500/25' : 'border-border',
              )}
            >
              <header className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', STAGE_COLORS[stage.color] ?? 'bg-violet-500')} aria-hidden />
                  <h3 className="flex-1 truncate text-sm font-bold text-foreground">{stage.name}</h3>
                  <span className="rounded-full bg-card px-2 text-[11px] font-semibold text-muted">{stage.count}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted tabular-nums">
                  {money(stage.value)}
                  {stage.kind === 'OPEN' && <> · {money(stage.weighted)} {T.weighted} ({stage.probability}%)</>}
                </p>
              </header>
              <ol className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">
                {stage.deals.map((deal) => (
                  <DealCardView
                    key={deal.id}
                    deal={deal}
                    T={T}
                    money={money}
                    owner={memberName(deal.ownerUserId)}
                    locale={locale}
                    onOpen={() => openDeal(deal.id)}
                    onDragStart={(e) => { dragId.current = deal.id; e.dataTransfer.setData('text/plain', deal.id); e.dataTransfer.effectAllowed = 'move'; }}
                  />
                ))}
                {stage.deals.length === 0 && (
                  <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted">{T.empty}</li>
                )}
              </ol>
            </section>
          ))}
          {!board && Array.from({ length: 5 }, (_, i) => <div key={i} className="h-80 w-72 shrink-0 animate-pulse rounded-2xl bg-surface" />)}
        </div>
      </div>

      {creating && board && (
        <DealForm
          T={T}
          stages={board.stages}
          members={members}
          onClose={() => setCreating(false)}
          onSaved={(deal) => { setCreating(false); addToast('success', T.created); load(); openDeal(deal.id); }}
        />
      )}
      {openDealId && board && (
        <DealDrawer
          id={openDealId}
          T={T}
          locale={locale}
          money={money}
          stages={board.stages}
          members={members}
          onClose={() => openDeal(null)}
          onChanged={load}
          onMove={(deal, stageId) => void move(deal, stageId)}
        />
      )}
      {editingStages && board && (
        <StagesEditor
          T={T}
          pipelineId={board.pipeline.id}
          stages={board.stages}
          onClose={() => setEditingStages(false)}
          onSaved={() => { setEditingStages(false); addToast('success', T.saved); load(); }}
        />
      )}
      {pendingLost && (
        <LostReasonDialog
          T={T}
          onCancel={() => setPendingLost(null)}
          onConfirm={(reason) => { const p = pendingLost; setPendingLost(null); void move(p.deal, p.stageId, reason); }}
        />
      )}
    </>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function DealCardView({ deal, T, money, owner, locale, onOpen, onDragStart }: {
  deal: CrmDealCard; T: Texts; money: (n: number) => string; owner: string; locale: string;
  onOpen: () => void; onDragStart: (e: React.DragEvent) => void;
}) {
  const [now] = useState(() => Date.now());
  const next = deal.nextActivity;
  const overdue = next?.dueAt ? new Date(next.dueAt).getTime() < now : false;
  return (
    <li>
      <button
        type="button"
        draggable
        onDragStart={onDragStart}
        onClick={onOpen}
        className="w-full cursor-grab rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-violet-500/40 hover:shadow-md active:cursor-grabbing"
      >
        <p className="truncate text-sm font-semibold text-foreground">{deal.title}</p>
        {deal.companyName && deal.companyName !== deal.title && <p className="truncate text-xs text-muted">{deal.companyName}</p>}
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="font-bold tabular-nums text-foreground">{money(deal.value)}</span>
          {owner && <span className="ml-auto truncate rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted">{owner}</span>}
        </div>
        {next?.dueAt && (
          <p className={cn('mt-2 flex items-center gap-1 text-[11px]', overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted')}>
            <AlarmClock size={11} aria-hidden /> {T.next}: {next.title || T.types[next.type]} · {fmtDate(next.dueAt, locale, true)}{overdue ? ` (${T.overdueShort})` : ''}
          </p>
        )}
      </button>
    </li>
  );
}

// ── New deal ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={cn('max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl', wide ? 'max-w-2xl' : 'max-w-lg')} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="flex-1 text-lg font-bold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-muted hover:bg-surface"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function DealForm({ T, stages, members, onClose, onSaved }: {
  T: Texts; stages: CrmStage[]; members: CrmMember[]; onClose: () => void; onSaved: (deal: CrmDealCard) => void;
}) {
  const { addToast } = useToast();
  const openStages = stages.filter((s) => s.kind === 'OPEN');
  const [f, setF] = useState({ title: '', companyName: '', contactName: '', contactPhone: '', contactEmail: '', value: '', expectedCloseAt: '', stageId: openStages[0]?.id ?? '', ownerUserId: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { deal } = await crmApi.createDeal({
        title: f.title || undefined,
        companyName: f.companyName || null,
        contactName: f.contactName || null,
        contactPhone: f.contactPhone || null,
        contactEmail: f.contactEmail || null,
        value: f.value ? Number(f.value.replace(/\./g, '').replace(',', '.')) || 0 : 0,
        expectedCloseAt: f.expectedCloseAt || null,
        stageId: f.stageId || undefined,
        ownerUserId: f.ownerUserId || undefined,
      });
      onSaved(deal);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : T.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={T.newDeal} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label={T.titleField}><input className={inputCls} value={f.title} onChange={set('title')} placeholder="Ex.: Plano anual — Padaria Sol" autoFocus /></Field></div>
        <Field label={T.company}><input className={inputCls} value={f.companyName} onChange={set('companyName')} /></Field>
        <Field label={T.contact}><input className={inputCls} value={f.contactName} onChange={set('contactName')} /></Field>
        <Field label={T.phone}><input className={inputCls} value={f.contactPhone} onChange={set('contactPhone')} inputMode="tel" /></Field>
        <Field label={T.email}><input className={inputCls} value={f.contactEmail} onChange={set('contactEmail')} type="email" /></Field>
        <Field label={T.value}><input className={inputCls} value={f.value} onChange={set('value')} inputMode="decimal" placeholder="0" /></Field>
        <Field label={T.closeDate}><input className={inputCls} value={f.expectedCloseAt} onChange={set('expectedCloseAt')} type="date" /></Field>
        <Field label={T.stage}>
          <select className={inputCls} value={f.stageId} onChange={set('stageId')}>{openStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </Field>
        {members.length > 1 && (
          <Field label={T.owner}>
            <select className={inputCls} value={f.ownerUserId} onChange={set('ownerUserId')}>
              <option value="">—</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}
            </select>
          </Field>
        )}
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm">{T.cancel}</button>
          <button type="submit" disabled={busy || (!f.title.trim() && !f.companyName.trim())} className="h-9 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{T.create}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Lost reason ─────────────────────────────────────────────────────────────

function LostReasonDialog({ T, onCancel, onConfirm }: { T: Texts; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={T.confirmLost} onClose={onCancel}>
      <Field label={T.lostReason}>
        <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={T.lostReasonPh} autoFocus />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-border px-4 text-sm">{T.cancel}</button>
        <button type="button" onClick={() => onConfirm(reason)} className="h-9 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700">{T.confirmLost}</button>
      </div>
    </Modal>
  );
}

// ── Deal drawer ─────────────────────────────────────────────────────────────

function DealDrawer({ id, T, locale, money, stages, members, onClose, onChanged, onMove }: {
  id: string; T: Texts; locale: string; money: (n: number) => string; stages: CrmStage[]; members: CrmMember[];
  onClose: () => void; onChanged: () => void; onMove: (deal: CrmDealCard, stageId: string) => void;
}) {
  const { addToast } = useToast();
  const [deal, setDeal] = useState<CrmDealDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [actType, setActType] = useState<Exclude<CrmActivityType, 'STAGE_CHANGE'>>('NOTE');
  const [actBody, setActBody] = useState('');
  const [actDue, setActDue] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    crmApi.getDeal(id).then((r) => setDeal(r.deal)).catch(() => { addToast('error', T.error); onClose(); });
  }, [id, addToast, T.error, onClose]);
  useEffect(() => { reload(); }, [reload]);

  const startEdit = () => {
    if (!deal) return;
    setForm({
      title: deal.title, companyName: deal.companyName ?? '', contactName: deal.contactName ?? '', contactPhone: deal.contactPhone ?? '',
      contactEmail: deal.contactEmail ?? '', value: String(deal.value || ''), expectedCloseAt: deal.expectedCloseAt?.slice(0, 10) ?? '', ownerUserId: deal.ownerUserId ?? '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await crmApi.updateDeal(id, {
        title: form.title, companyName: form.companyName || null, contactName: form.contactName || null, contactPhone: form.contactPhone || null,
        contactEmail: form.contactEmail || null, value: Number((form.value ?? '').replace(/\./g, '').replace(',', '.')) || 0,
        expectedCloseAt: form.expectedCloseAt || null, ownerUserId: form.ownerUserId || null,
      });
      setEditing(false);
      reload();
      onChanged();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : T.error);
    } finally {
      setBusy(false);
    }
  };

  const logActivity = async () => {
    if (!actBody.trim()) return;
    setBusy(true);
    try {
      await crmApi.addActivity(id, {
        type: actType,
        body: actBody.trim(),
        dueAt: actDue ? new Date(actDue).toISOString() : null,
      });
      setActBody('');
      setActDue('');
      reload();
      onChanged();
    } catch {
      addToast('error', T.error);
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = async (a: CrmActivity) => {
    try {
      await crmApi.setActivityDone(a.id, !a.doneAt);
      reload();
      onChanged();
    } catch {
      addToast('error', T.error);
    }
  };

  const remove = async () => {
    if (!window.confirm(T.confirmDelete)) return;
    try {
      await crmApi.deleteDeal(id);
      onChanged();
      onClose();
    } catch {
      addToast('error', T.error);
    }
  };

  const wonStage = stages.find((s) => s.kind === 'WON');
  const lostStage = stages.find((s) => s.kind === 'LOST');
  const wa = deal ? whatsappLink(deal.contactPhone, null) : null;
  const pending = useMemo(() => deal?.activities.filter((a) => a.dueAt && !a.doneAt) ?? [], [deal]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label={deal?.title ?? T.titleField}>
        {!deal ? <div className="p-6 text-sm text-muted">…</div> : (
          <>
            <header className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold text-foreground">{deal.title}</h2>
                  <p className="text-sm text-muted">{money(deal.value)} · {deal.stage.name}</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-muted hover:bg-surface"><X size={18} /></button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={deal.stageId}
                  onChange={(e) => onMove(deal, e.target.value)}
                  className={cn(inputCls, 'w-auto py-1.5')}
                  aria-label={T.stage}
                >
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {deal.stage.kind === 'OPEN' && wonStage && (
                  <button type="button" onClick={() => onMove(deal, wonStage.id)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"><Trophy size={14} aria-hidden /> {T.markWon}</button>
                )}
                {deal.stage.kind === 'OPEN' && lostStage && (
                  <button type="button" onClick={() => onMove(deal, lostStage.id)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600 hover:bg-red-500/10"><XCircle size={14} aria-hidden /> {T.markLost}</button>
                )}
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs text-foreground hover:bg-surface"><MessageCircle size={14} aria-hidden /> WhatsApp</a>}
                {deal.contactEmail && <a href={`mailto:${deal.contactEmail}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs text-foreground hover:bg-surface"><Mail size={14} aria-hidden /> E-mail</a>}
                {deal.leadPlaceId && <Link to={`/dashboard/lead/${deal.leadPlaceId}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs text-foreground hover:bg-surface"><ExternalLink size={14} aria-hidden /> {T.openLead}</Link>}
              </div>
            </header>

            <section className="border-b border-border px-5 py-4">
              {editing ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field label={T.titleField}><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field></div>
                  {(['companyName', 'contactName', 'contactPhone', 'contactEmail', 'value'] as const).map((k) => (
                    <Field key={k} label={{ companyName: T.company, contactName: T.contact, contactPhone: T.phone, contactEmail: T.email, value: T.value }[k]}>
                      <input className={inputCls} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    </Field>
                  ))}
                  <Field label={T.closeDate}><input type="date" className={inputCls} value={form.expectedCloseAt ?? ''} onChange={(e) => setForm({ ...form, expectedCloseAt: e.target.value })} /></Field>
                  {members.length > 1 && (
                    <Field label={T.owner}>
                      <select className={inputCls} value={form.ownerUserId ?? ''} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}>
                        <option value="">—</option>
                        {members.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}
                      </select>
                    </Field>
                  )}
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg border border-border px-4 text-sm">{T.cancel}</button>
                    <button type="button" disabled={busy} onClick={() => { void saveEdit(); }} className="h-9 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{T.save}</button>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    [T.company, deal.companyName], [T.contact, deal.contactName], [T.phone, deal.contactPhone], [T.email, deal.contactEmail],
                    [T.value, money(deal.value)], [T.closeDate, fmtDate(deal.expectedCloseAt, locale)],
                    [T.owner, members.find((m) => m.userId === deal.ownerUserId)?.name ?? '—'],
                    ...(deal.lostReason ? [[T.lostReason, deal.lostReason]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[11px] text-muted">{label}</dt>
                      <dd className="truncate text-foreground">{value || '—'}</dd>
                    </div>
                  ))}
                  <div className="col-span-2 flex justify-between pt-1">
                    <button type="button" onClick={startEdit} className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline"><Pencil size={12} aria-hidden /> {T.save === 'Save' ? 'Edit' : 'Editar'}</button>
                    <button type="button" onClick={() => { void remove(); }} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash2 size={12} aria-hidden /> {T.delete}</button>
                  </div>
                </dl>
              )}
            </section>

            <section className="border-b border-border px-5 py-4 space-y-2">
              <div className="flex flex-wrap gap-1">
                {LOGGABLE.map((type) => {
                  const Icon = ACTIVITY_ICON[type];
                  return (
                    <button key={type} type="button" onClick={() => setActType(type)} className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium', actType === type ? 'bg-violet-600 text-white' : 'border border-border text-muted hover:bg-surface')}>
                      <Icon size={12} aria-hidden /> {T.types[type]}
                    </button>
                  );
                })}
              </div>
              <textarea value={actBody} onChange={(e) => setActBody(e.target.value)} placeholder={T.activityPh} className={cn(inputCls, 'min-h-[70px] resize-y')} maxLength={5000} />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <Calendar size={13} aria-hidden /> {T.dueAt}
                  <input type="datetime-local" value={actDue} onChange={(e) => setActDue(e.target.value)} className={cn(inputCls, 'w-auto py-1 text-xs')} />
                </label>
                <button type="button" disabled={busy || !actBody.trim()} onClick={() => { void logActivity(); }} className="ml-auto h-8 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{T.addActivity}</button>
              </div>
            </section>

            {pending.length > 0 && (
              <section className="border-b border-border px-5 py-3 space-y-1.5">
                {pending.map((a) => <ActivityRow key={a.id} a={a} T={T} locale={locale} onToggle={() => { void toggleDone(a); }} />)}
              </section>
            )}

            <section className="px-5 py-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{T.timeline}</h3>
              {deal.activities.filter((a) => !(a.dueAt && !a.doneAt)).length === 0 ? (
                <p className="text-sm text-muted">{T.noActivity}</p>
              ) : (
                <ol className="space-y-2">
                  {deal.activities.filter((a) => !(a.dueAt && !a.doneAt)).map((a) => <ActivityRow key={a.id} a={a} T={T} locale={locale} onToggle={a.type === 'STAGE_CHANGE' || !a.dueAt ? undefined : () => { void toggleDone(a); }} />)}
                </ol>
              )}
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

function ActivityRow({ a, T, locale, onToggle }: { a: CrmActivity; T: Texts; locale: string; onToggle?: () => void }) {
  const [now] = useState(() => Date.now());
  const Icon = ACTIVITY_ICON[a.type];
  const overdue = a.dueAt && !a.doneAt && new Date(a.dueAt).getTime() < now;
  return (
    <li className="flex list-none gap-2.5 text-sm">
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-label={a.doneAt ? 'Reabrir' : 'Concluir'} className="mt-0.5 shrink-0 text-muted hover:text-emerald-600">
          {a.doneAt ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Circle size={16} />}
        </button>
      ) : <Icon size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className={cn('text-foreground', a.doneAt && a.dueAt && 'line-through text-muted')}>
          <span className="font-semibold">{a.type === 'STAGE_CHANGE' ? a.title : T.types[a.type]}</span>
          {a.type !== 'STAGE_CHANGE' && a.title ? ` · ${a.title}` : ''}
        </p>
        {a.body && <p className="whitespace-pre-wrap break-words text-muted">{a.body}</p>}
        <p className={cn('text-[11px]', overdue ? 'text-red-600 font-semibold' : 'text-muted')}>
          {a.dueAt ? `${T.dueAt}: ${fmtDate(a.dueAt, locale, true)}` : fmtDate(a.createdAt, locale, true)}
        </p>
      </div>
    </li>
  );
}

// ── Stages editor ───────────────────────────────────────────────────────────

function StagesEditor({ T, pipelineId, stages, onClose, onSaved }: {
  T: Texts; pipelineId: string; stages: CrmStage[]; onClose: () => void; onSaved: () => void;
}) {
  const { addToast } = useToast();
  const [rows, setRows] = useState(stages.map((s) => ({ id: s.id as string | undefined, name: s.name, probability: s.probability, kind: s.kind, color: s.color })));
  const [busy, setBusy] = useState(false);

  const moveRow = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setRows(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      await crmApi.saveStages(pipelineId, rows);
      onSaved();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : T.error);
    } finally {
      setBusy(false);
    }
  };

  const kindLabel: Record<CrmStageKind, string> = { OPEN: T.kindOpen, WON: T.kindWon, LOST: T.kindLost };

  return (
    <Modal title={T.stagesTitle} onClose={onClose} wide>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id ?? `new-${i}`} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button type="button" onClick={() => moveRow(i, -1)} aria-label="Subir" className="text-muted hover:text-foreground"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => moveRow(i, 1)} aria-label="Descer" className="text-muted hover:text-foreground"><ArrowDown size={14} /></button>
            </div>
            <input className={cn(inputCls, 'flex-1')} value={r.name} maxLength={60} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} aria-label="Nome" />
            <input className={cn(inputCls, 'w-20')} type="number" min={0} max={100} value={r.probability} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, probability: Number(e.target.value) } : x)))} aria-label={T.probability} />
            <span className="w-20 text-xs text-muted">{kindLabel[r.kind]}</span>
            <button type="button" disabled={r.kind !== 'OPEN'} onClick={() => setRows(rows.filter((_, k) => k !== i))} aria-label="Remover" className="text-muted hover:text-red-600 disabled:opacity-30"><Trash2 size={15} /></button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => {
          const firstClosed = rows.findIndex((r) => r.kind !== 'OPEN');
          const at = firstClosed === -1 ? rows.length : firstClosed;
          setRows([...rows.slice(0, at), { id: undefined, name: '', probability: 50, kind: 'OPEN', color: 'violet' }, ...rows.slice(at)]);
        }}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-700 dark:text-violet-300 hover:underline"
      >
        <Plus size={14} aria-hidden /> {T.addStage}
      </button>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm">{T.cancel}</button>
        <button type="button" disabled={busy} onClick={() => { void save(); }} className="h-9 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{T.save}</button>
      </div>
    </Modal>
  );
}
