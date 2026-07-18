import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import type { SessionUser, RepPaymentDTO } from '@/lib/api';
import { representativeApi } from '@/lib/api/representative';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PAID: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  PENDING: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PAID: 'Pago',
  PENDING: 'Pendente',
  CANCELLED: 'Cancelado',
};

export default function RepPayments() {
  useOutletContext<{ user: SessionUser }>();
  const [items, setItems] = useState<RepPaymentDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    setLoading(true);
    representativeApi.getPayments({ page: 1, limit: 100, year, month })
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const canGoNext = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="Pagamentos" breadcrumb="Representante" />
      <div className="p-4 md:p-6 space-y-4 max-w-5xl">
        <div className="flex items-center gap-3">
          <button type="button" onClick={prevMonth} className="p-2 rounded-lg border border-border hover:bg-surface transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-foreground">
            {String(month).padStart(2, '0')}/{year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            disabled={!canGoNext}
            className={cn('p-2 rounded-lg border border-border transition-colors', canGoNext ? 'hover:bg-surface' : 'opacity-40 cursor-not-allowed')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="text-muted py-8">Nenhum pagamento neste período.</p>
        )}

        {!loading && items.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Data</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Valor</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Método</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((p) => (
                    <tr key={p.id} className="bg-card hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 text-foreground">
                        {new Date(p.paidAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">
                        {p.currency === 'USD' ? '$' : 'R$'} {(p.amountCents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-muted">{p.method || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', PAYMENT_STATUS_BADGE[p.status] || '')}>
                          {PAYMENT_STATUS_LABEL[p.status] || p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border text-xs text-muted">
              {total} pagamento(s) encontrado(s)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
