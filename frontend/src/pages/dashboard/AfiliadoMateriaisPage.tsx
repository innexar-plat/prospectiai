import { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import type { SessionUser } from '@/lib/api';
import { affiliateApi, type AffiliateMe } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Copy, Loader2, CheckCircle, ImageIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

function buildAffiliateUrl(code: string, utm?: { source?: string; medium?: string; campaign?: string }): string {
  const params = new URLSearchParams();
  params.set('ref', code);
  if (utm?.source) params.set('utm_source', utm.source);
  if (utm?.medium) params.set('utm_medium', utm.medium);
  if (utm?.campaign) params.set('utm_campaign', utm.campaign);
  return `${APP_ORIGIN}/api/affiliate/click?${params.toString()}`;
}

export default function AfiliadoMateriaisPage() {
  const { t } = useI18n();
  useOutletContext<{ user: SessionUser }>();
  const [affiliate, setAffiliate] = useState<AffiliateMe | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'link' | 'utm' | 'whatsapp' | 'email' | null>(null);
  const [utm, setUtm] = useState({ source: '', medium: '', campaign: '' });

  useEffect(() => {
    affiliateApi
      .me()
      .then(setAffiliate)
      .catch(() => setAffiliate(null))
      .finally(() => setLoading(false));
  }, []);

  const code = affiliate?.code ?? '';
  const baseLink = code ? buildAffiliateUrl(code) : '';
  const utmLink = code ? buildAffiliateUrl(code, utm) : baseLink;

  const whatsappText = useMemo(
    () => t('page.afiliadoMateriais.whatsappMessage', { link: utmLink }),
    [t, utmLink],
  );
  const emailText = useMemo(
    () => t('page.afiliadoMateriais.emailMessage', { link: utmLink }),
    [t, utmLink],
  );

  const copyToClipboard = (text: string, key: 'link' | 'utm' | 'whatsapp' | 'email') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <HeaderDashboard title={t('page.afiliadoMateriais.title')} />
        <div className="flex items-center justify-center flex-1 gap-2 text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          {t('page.afiliado.loading')}
        </div>
      </div>
    );
  }

  if (affiliate == null || affiliate.status !== 'APPROVED') {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <HeaderDashboard title={t('page.afiliadoMateriais.title')} />
        <div className="p-4 md:p-6 max-w-3xl">
          <Link to="/dashboard/afiliado" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> {t('page.afiliadoMateriais.back')}
          </Link>
          <p className="text-muted">{t('page.afiliadoMateriais.notApproved')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title={t('page.afiliadoMateriais.title')} />
      <div className="p-4 md:p-6 max-w-3xl space-y-8">
        <Link to="/dashboard/afiliado" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> {t('page.afiliadoMateriais.back')}
        </Link>

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold text-foreground">{t('page.afiliadoMateriais.yourLink')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 text-sm bg-muted/50 px-2 py-1.5 rounded truncate">{baseLink}</code>
            <Button variant="secondary" size="sm" onClick={() => copyToClipboard(baseLink, 'link')} className="gap-1 shrink-0">
              {copied === 'link' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'link' ? t('page.afiliado.copied') : t('page.afiliado.copy')}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="font-semibold text-foreground">{t('page.afiliadoMateriais.utmTitle')}</h2>
          <p className="text-sm text-muted">{t('page.afiliadoMateriais.utmDesc')}</p>
          <div className="grid gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">utm_source</label>
              <input
                type="text"
                value={utm.source}
                onChange={(e) => setUtm((u) => ({ ...u, source: e.target.value }))}
                placeholder={t('page.afiliadoMateriais.utmSourcePlaceholder')}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">utm_medium</label>
              <input
                type="text"
                value={utm.medium}
                onChange={(e) => setUtm((u) => ({ ...u, medium: e.target.value }))}
                placeholder={t('page.afiliadoMateriais.utmMediumPlaceholder')}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">utm_campaign</label>
              <input
                type="text"
                value={utm.campaign}
                onChange={(e) => setUtm((u) => ({ ...u, campaign: e.target.value }))}
                placeholder={t('page.afiliadoMateriais.utmCampaignPlaceholder')}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 text-sm bg-muted/50 px-2 py-1.5 rounded truncate">{utmLink}</code>
            <Button variant="secondary" size="sm" onClick={() => copyToClipboard(utmLink, 'utm')} className="gap-1 shrink-0">
              {copied === 'utm' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'utm' ? t('page.afiliado.copied') : t('page.afiliadoMateriais.copyLink')}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="font-semibold text-foreground">{t('page.afiliadoMateriais.readyTexts')}</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted mb-1">{t('page.afiliadoMateriais.whatsapp')}</p>
              <textarea readOnly value={whatsappText} rows={3} className="w-full rounded border border-border bg-muted/30 px-3 py-2 text-sm resize-none" />
              <Button variant="secondary" size="sm" onClick={() => copyToClipboard(whatsappText, 'whatsapp')} className="mt-1 gap-1">
                {copied === 'whatsapp' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === 'whatsapp' ? t('page.afiliado.copied') : t('page.afiliadoMateriais.copyText')}
              </Button>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">{t('page.afiliadoMateriais.email')}</p>
              <textarea readOnly value={emailText} rows={5} className="w-full rounded border border-border bg-muted/30 px-3 py-2 text-sm resize-none" />
              <Button variant="secondary" size="sm" onClick={() => copyToClipboard(emailText, 'email')} className="mt-1 gap-1">
                {copied === 'email' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === 'email' ? t('page.afiliado.copied') : t('page.afiliadoMateriais.copyText')}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 text-center text-muted">
          <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('page.afiliadoMateriais.bannersSoon')}</p>
        </section>
      </div>
    </div>
  );
}
