import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { affiliateApi } from '@/lib/api';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function AfiliadoConversoesPage() {
  useOutletContext<{ user: SessionUser }>();
  const [data, setData] = useState<{ items: Array<Record<string, unknown>>; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    affiliateApi.referrals({ page: 1, limit: 50 })
      .then(setData)
      .catch(() => setData({ items: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="Conversões" />
      <div className="p-4 md:p-6 max-w-3xl">
        <Link to="/dashboard/afiliado" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Afiliado
        </Link>
        {loading && <div className="flex items-center gap-2 text-muted py-8"><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>}
        {!loading && items.length === 0 && <p className="text-muted py-8">Nenhuma conversão ainda.</p>}
        {!loading && items.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted mb-2">Total: {total}</p>
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {items.map((r: Record<string, unknown>) => (
                <li key={String(r.id)} className="px-4 py-3 bg-card text-sm flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-muted">{r.landedAt ? new Date(String(r.landedAt)).toLocaleDateString('pt-BR') : ''}</span>
                  {r.emailMasked != null && r.emailMasked !== '' && <span>{String(r.emailMasked)}</span>}
                  <span>{r.convertedAt ? 'Convertido' : 'Cadastro'}</span>
                  {r.planId != null && r.planId !== '' && <span>{String(r.planId)}</span>}
                  {r.valueCents != null && <span>R$ {(Number(r.valueCents) / 100).toFixed(2)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
