import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LifeBuoy, Loader2, RefreshCw, Send } from 'lucide-react';
import { supportAdminApi, type AdminSupportTicket, type AdminSupportTicketDetail, type SupportTicketStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<SupportTicketStatus, string> = { OPEN: 'Aguardando equipe', ANSWERED: 'Respondido', CLOSED: 'Encerrado' };
const STATUS_STYLE: Record<SupportTicketStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  ANSWERED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-gray-100 text-gray-600',
};
const CATEGORY_LABEL: Record<AdminSupportTicket['category'], string> = {
  QUESTION: 'Dúvida', PROBLEM: 'Problema', BILLING: 'Pagamento / plano', SUGGESTION: 'Sugestão',
};
const FILTERS: Array<{ value: SupportTicketStatus | ''; label: string }> = [
  { value: 'OPEN', label: 'Aguardando equipe' },
  { value: 'ANSWERED', label: 'Respondidos' },
  { value: 'CLOSED', label: 'Encerrados' },
  { value: '', label: 'Todos' },
];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Badge({ status }: { status: SupportTicketStatus }) {
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

/** Customer tickets: queue (waiting on us first), conversation, reply and status. */
export function SupportTicketsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<SupportTicketStatus | ''>('OPEN');
  const [list, setList] = useState<{ tickets: AdminSupportTicket[]; counts: Partial<Record<SupportTicketStatus, number>> } | null>(null);
  const [ticket, setTicket] = useState<AdminSupportTicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(() => {
    supportAdminApi.list(filter || undefined)
      .then((r) => { setList(r); setError(null); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro ao carregar chamados'));
  }, [filter]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!id) { setTicket(null); return; }
    let cancelled = false;
    supportAdminApi.get(id)
      .then((r) => { if (!cancelled) setTicket(r.ticket); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Chamado não encontrado'); });
    return () => { cancelled = true; };
  }, [id]);

  const send = async (close: boolean) => {
    if (!ticket || !reply.trim()) return;
    setBusy(true);
    try {
      const r = await supportAdminApi.reply(ticket.id, reply.trim(), close);
      setTicket(r.ticket);
      setReply('');
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao responder');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: SupportTicketStatus) => {
    if (!ticket) return;
    setBusy(true);
    try {
      const r = await supportAdminApi.setStatus(ticket.id, status);
      setTicket(r.ticket);
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao alterar status');
    } finally {
      setBusy(false);
    }
  };

  const context = ticket?.context ?? null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <LifeBuoy className="w-6 h-6 text-indigo-600" aria-hidden />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Suporte</h1>
          <p className="text-sm text-gray-500">Chamados abertos pelos clientes em /dashboard/suporte. Cada resposta avisa o cliente por e-mail e notificação.</p>
        </div>
        <button type="button" onClick={loadList} className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" aria-label="Atualizar">
          <RefreshCw size={14} />
        </button>
      </header>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap gap-1 border-b border-gray-100 p-2">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium', filter === f.value ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50')}
              >
                {f.label}{f.value && list?.counts[f.value] ? ` (${list.counts[f.value]})` : ''}
              </button>
            ))}
          </div>
          {!list ? <p className="p-4 text-sm text-gray-500">Carregando…</p> : list.tickets.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Nenhum chamado aqui.</p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {list.tickets.map((tk) => (
                <li key={tk.id}>
                  <Link to={`/suporte/${tk.id}`} className={cn('block px-4 py-3 hover:bg-gray-50', tk.id === id && 'bg-indigo-50')}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-gray-400">#{tk.number}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{tk.subject}</span>
                      <Badge status={tk.status} />
                    </div>
                    <div className="mt-0.5 flex gap-2 text-xs text-gray-500">
                      <span className="truncate">{tk.user.name ?? tk.user.email}</span>
                      <span>· {CATEGORY_LABEL[tk.category]}</span>
                      <span className="ml-auto shrink-0">{fmt(tk.lastMessageAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          {!ticket ? (
            <p className="text-sm text-gray-500">Selecione um chamado para ver a conversa.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => navigate('/suporte')} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 lg:hidden">
                  <ArrowLeft size={14} aria-hidden /> Voltar
                </button>
                <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-gray-900">#{ticket.number} · {ticket.subject}</h2>
                <Badge status={ticket.status} />
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-0.5">
                <div><strong>{ticket.user.name ?? 'Cliente'}</strong> · {ticket.user.email} · {CATEGORY_LABEL[ticket.category]}</div>
                {context && (
                  <div className="text-gray-500">
                    {typeof context.plan === 'string' && <>Plano: {context.plan} · </>}
                    {typeof context.page === 'string' && <>Página: {context.page}</>}
                  </div>
                )}
                <Link to={`/users/${ticket.user.id}`} className="text-indigo-700 hover:underline">Ver usuário</Link>
              </div>

              <ol className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {ticket.messages.map((msg) => {
                  const team = msg.authorType === 'ADMIN';
                  return (
                    <li key={msg.id} className={cn('flex', team ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm', team ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm')}>
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <p className={cn('mt-1 text-[10px]', team ? 'text-white/70' : 'text-gray-500')}>{team ? 'Equipe' : 'Cliente'} · {fmt(msg.createdAt)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                maxLength={5000}
                placeholder="Escreva a resposta para o cliente…"
                className="w-full min-h-[110px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <div className="flex flex-wrap items-center gap-2">
                {ticket.status === 'CLOSED' ? (
                  <button type="button" disabled={busy} onClick={() => { void changeStatus('OPEN'); }} className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Reabrir</button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => { void changeStatus('CLOSED'); }} className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Encerrar sem responder</button>
                )}
                <button type="button" disabled={busy || !reply.trim()} onClick={() => { void send(true); }} className="ml-auto h-9 rounded-lg border border-indigo-200 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
                  Responder e encerrar
                </button>
                <button type="button" disabled={busy || !reply.trim()} onClick={() => { void send(false); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />} Responder
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
