import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { affiliateApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/lib/i18n';

export default function AfiliadoPagamentoPage() {
  const { t } = useI18n();
  useOutletContext<{ user: SessionUser }>();
  const [payoutType, setPayoutType] = useState<'PIX' | 'BANK_TRANSFER'>('PIX');
  const [payoutPayload, setPayoutPayload] = useState('');
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    affiliateApi.me().then((a) => {
      if (a.payoutType) setPayoutType(a.payoutType as 'PIX' | 'BANK_TRANSFER');
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await affiliateApi.updatePayout({ payoutType, payoutPayload: payoutPayload || undefined });
      addToast('success', t('page.afiliadoPagamento.saved'));
    } catch {
      addToast('error', t('page.afiliadoPagamento.saveError'));
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title={t('page.afiliadoPagamento.title')} />
      <div className="p-4 md:p-6 max-w-md">
        <Link to="/dashboard/afiliado" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> {t('page.afiliadoPagamento.back')}
        </Link>
        <p className="text-sm text-muted mb-4">{t('page.afiliadoPagamento.policy')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('page.afiliadoPagamento.payoutMethod')}</label>
            <select
              value={payoutType}
              onChange={(e) => setPayoutType(e.target.value as 'PIX' | 'BANK_TRANSFER')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            >
              <option value="PIX">{t('page.afiliadoPagamento.pix')}</option>
              <option value="BANK_TRANSFER">{t('page.afiliadoPagamento.bankTransfer')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {payoutType === 'PIX' ? t('page.afiliadoPagamento.pixKeyLabel') : t('page.afiliadoPagamento.bankDataLabel')}
            </label>
            <Input
              value={payoutPayload}
              onChange={(e) => setPayoutPayload(e.target.value)}
              placeholder={payoutType === 'PIX' ? t('page.afiliadoPagamento.pixPlaceholder') : t('page.afiliadoPagamento.bankPlaceholder')}
            />
          </div>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </form>
      </div>
    </div>
  );
}
