import type { AdminStats } from '@/lib/api';

interface MarketComparisonProps {
  usersByMarket: NonNullable<AdminStats['usersByMarket']>;
  revenueByMarket: NonNullable<AdminStats['revenueByMarket']>;
}

function formatMoney(value: number, currency: 'BRL' | 'USD'): string {
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function BarRow({
  label,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  leftColor,
  rightColor,
}: {
  label: string;
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
  leftColor: string;
  rightColor: string;
}) {
  const total = leftValue + rightValue;
  const leftPct = total > 0 ? (leftValue / total) * 100 : 50;
  const rightPct = total > 0 ? (rightValue / total) * 100 : 50;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">
          {leftValue.toLocaleString()} vs {rightValue.toLocaleString()}
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
        <div
          className="transition-all"
          style={{ width: `${leftPct}%`, backgroundColor: leftColor }}
          title={`${leftLabel}: ${leftValue.toLocaleString()}`}
        />
        <div
          className="transition-all"
          style={{ width: `${rightPct}%`, backgroundColor: rightColor }}
          title={`${rightLabel}: ${rightValue.toLocaleString()}`}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

/** BR vs US market comparison for admin dashboard. */
export function MarketComparison({ usersByMarket, revenueByMarket }: MarketComparisonProps) {
  const brUsers = usersByMarket.BR;
  const usUsers = usersByMarket.US;
  const unknownUsers = usersByMarket.unknown ?? 0;

  return (
    <section className="mb-8" aria-labelledby="market-comparison-heading">
      <h2 id="market-comparison-heading" className="text-lg font-semibold text-gray-700 mb-1">
        Mercados — Brasil vs Estados Unidos
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Usuários classificados pelo workspace principal (provedor de pagamento e padrão de cadastro).
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Usuários por mercado</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg bg-green-50 border border-green-100 p-4">
              <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Brasil</p>
              <p className="text-3xl font-bold text-green-800 mt-1">{brUsers.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Estados Unidos</p>
              <p className="text-3xl font-bold text-blue-800 mt-1">{usUsers.toLocaleString()}</p>
            </div>
          </div>
          {unknownUsers > 0 && (
            <p className="text-xs text-gray-500 mb-3">
              {unknownUsers} usuário(s) sem workspace — não classificados
            </p>
          )}
          <BarRow
            label="Distribuição de usuários"
            leftLabel="BR"
            leftValue={brUsers}
            rightLabel="US"
            rightValue={usUsers}
            leftColor="#059669"
            rightColor="#2563EB"
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Receita por mercado</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-2 font-medium">Mercado</th>
                  <th className="pb-2 font-medium text-right">MRR</th>
                  <th className="pb-2 font-medium text-right">Total pago</th>
                  <th className="pb-2 font-medium text-right">Assinantes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="py-2.5 font-medium text-green-800">Brasil (BRL)</td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">
                    {formatMoney(revenueByMarket.BR.mrr, 'BRL')}
                  </td>
                  <td className="py-2.5 text-right text-gray-700">
                    {formatMoney(revenueByMarket.BR.total, 'BRL')}
                  </td>
                  <td className="py-2.5 text-right text-gray-600">
                    {revenueByMarket.BR.paidWorkspaces}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-blue-800">EUA (USD)</td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">
                    {formatMoney(revenueByMarket.US.mrr, 'USD')}
                  </td>
                  <td className="py-2.5 text-right text-gray-700">
                    {formatMoney(revenueByMarket.US.total, 'USD')}
                  </td>
                  <td className="py-2.5 text-right text-gray-600">
                    {revenueByMarket.US.paidWorkspaces}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            MRR estimado a partir de assinaturas ativas. Total pago soma comissões de afiliados (pagamentos confirmados).
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <BarRow
          label="MRR comparativo (valores normalizados para visualização)"
          leftLabel={`BR ${formatMoney(revenueByMarket.BR.mrr, 'BRL')}`}
          leftValue={revenueByMarket.BR.mrr}
          rightLabel={`US ${formatMoney(revenueByMarket.US.mrr, 'USD')}`}
          rightValue={revenueByMarket.US.mrr}
          leftColor="#059669"
          rightColor="#2563EB"
        />
      </div>
    </section>
  );
}
