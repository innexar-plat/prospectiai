import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import type { SessionUser, RepAffiliateDTO } from '@/lib/api';
import { representativeApi } from '@/lib/api/representative';
import { Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RepAffiliates() {
  useOutletContext<{ user: SessionUser }>();
  const [items, setItems] = useState<RepAffiliateDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    representativeApi.getAffiliates({ page: 1, limit: 100 })
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="Afiliados" breadcrumb="Representante" />
      <div className="p-4 md:p-6 space-y-4 max-w-5xl">
        {loading && (
          <div className="flex items-center gap-2 text-muted py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-muted">
            <Users className="w-10 h-10" />
            <p>Você ainda não possui afiliados.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Nome / Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Taxa de Comissão</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Referrals / Comissões</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((a) => (
                    <tr key={a.id} className="bg-card hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{a.name || a.code}</p>
                        {a.email && <p className="text-xs text-muted">{a.email}</p>}
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">
                        {a.commissionRatePercent}%
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">
                        {a.referralCount} / {a.commissionCount}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                          a.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : a.status === 'PENDING' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                        )}>
                          {a.status === 'ACTIVE' ? 'Ativo' : a.status === 'PENDING' ? 'Pendente' : a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border text-xs text-muted">
              {total} afiliado(s)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
