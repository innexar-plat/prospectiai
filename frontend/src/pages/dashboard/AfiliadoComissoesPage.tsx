import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { affiliateApi } from '@/lib/api';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function AfiliadoComissoesPage() {
  useOutletContext<{ user: SessionUser }>();
  const [items, setItems] = useState<Array<{ id: string; amountCents: number; currency: string; status: string; availableAt: string; paidAt: string | null; commissionType: string; createdAt: string }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    affiliateApi.commissions({ page: 1, limit: 50 })
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="Comissões" />
      <div className="p-4 md:p-6 max-w-3xl">
        <Link to="/dashboard/afiliado" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Afiliado
        </Link>
        {loading && <div className="flex items-center gap-2 text-muted py-8"><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>}
        {!loading && items.length === 0 && <p className="text-muted py-8">Nenhuma comissão ainda.</p>}
        {!loading && items.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted mb-2">Total: {total}</p>
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {items.map((c) => (
                <li key={c.id} className="px-4 py-3 bg-card text-sm flex flex-wrap gap-x-4 gap-y-1 items-center">
                  <span className="font-medium">{c.currency === 'BRL' ? 'R$' : '$'} {(c.amountCents / 100).toFixed(2)}</span>
                  <span className="text-muted">{c.status}</span>
                  <span className="text-muted">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                  {c.paidAt && <span className="text-green-600">Pago em {new Date(c.paidAt).toLocaleDateString('pt-BR')}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
