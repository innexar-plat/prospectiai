import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import type { SessionUser, RepCommissionDTO } from '@/lib/api';
import { representativeApi } from '@/lib/api/representative';
import { Loader2, Wallet, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  PAID: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
};

export default function RepCommissions() {
  useOutletContext<{ user: SessionUser }>();
  const [items, setItems] = useState<RepCommissionDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    representativeApi.getCommissions({ page: 1, limit: 100, status: statusFilter || undefined })
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const pendingTotal = items.reduce((s, c) => c.status === 'PENDING' ? s + c.amountCents : s, 0);
  const approvedTotal = items.reduce((s, c) => c.status === 'APPROVED' ? s + c.amountCents : s, 0);
  const paidTotal = items.reduce((s, c) => c.status === 'PAID' ? s + c.amountCents : s, 0);
  const symbol = items[0]?.currency === 'USD' ? '$' : 'R$';
  const formatMoney = (cents: number) => `${symbol} ${(cents / 100).toFixed(2)}`;

  const filters = ['', 'PENDING', 'APPROVED', 'PAID', 'CANCELLED'];

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="Comissões" breadcrumb="Representante" />
      <div className="p-4 md:p-6 space-y-4 max-w-5xl">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <Clock className="w-5 h-5 text-amber-500 mb-2" />
            <p className="text-xl font-bold text-foreground">{formatMoney(pendingTotal)}</p>
            <p className="text-xs text-muted">Pendente</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <CheckCircle className="w-5 h-5 text-emerald-500 mb-2" />
            <p className="text-xl font-bold text-foreground">{formatMoney(approvedTotal)}</p>
            <p className="text-xs text-muted">Disponível</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <Wallet className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-xl font-bold text-foreground">{formatMoney(paidTotal)}</p>
            <p className="text-xs text-muted">Pago</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                statusFilter === f
                  ? 'bg-violet-600/15 border-violet-500/40 text-violet-600'
                  : 'border-border bg-surface text-muted hover:text-foreground'
              )}
            >
              {f ? STATUS_LABEL[f] || f : 'Todas'}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="text-muted py-8">Nenhuma comissão encontrada.</p>
        )}

        {!loading && items.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Valor</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">%</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Fonte</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Liberação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((c) => (
                    <tr key={c.id} className="bg-card hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground">
                        {formatMoney(c.amountCents)}
                      </td>
                      <td className="px-4 py-3 text-muted">{c.clientName || '—'}</td>
                      <td className="px-4 py-3 text-muted">{c.commissionPercent}%</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                          c.source === 'DIRECT_CLIENT'
                            ? 'bg-violet-500/10 text-violet-600 border-violet-500/20'
                            : 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'
                        )}>
                          {c.source === 'DIRECT_CLIENT' ? 'Direto' : 'Override'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', STATUS_BADGE[c.status])}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {c.holdUntil ? new Date(c.holdUntil).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border text-xs text-muted">
              {total} comissão(ões) encontrada(s)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
