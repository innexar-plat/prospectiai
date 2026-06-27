import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { affiliateApi, type AffiliateMe, type AffiliateStats } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Copy, Link2, Users, TrendingUp, Wallet, Loader2, CheckCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const APP_URL = typeof window !== 'undefined' ? window.location.origin : '';

export default function AfiliadoPage() {
  const { t } = useI18n();
  useOutletContext<{ user: SessionUser }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromCadastro = searchParams.get('from') === 'afiliado-cadastro';
  const didAutoRegister = useRef(false);

  const [affiliate, setAffiliate] = useState<AffiliateMe | null | undefined>(undefined);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    affiliateApi
      .me()
      .then((data) => {
        if (!cancelled) setAffiliate(data);
      })
      .catch(() => {
        if (!cancelled) setAffiliate(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || affiliate !== null || !fromCadastro || didAutoRegister.current) return;
    didAutoRegister.current = true;
    let cancelled = false;
    const run = async () => {
      queueMicrotask(() => {
        if (!cancelled) setRegistering(true);
      });
      try {
        const data = await affiliateApi.register();
        if (cancelled) return;
        setAffiliate({
          id: data.id,
          code: data.code,
          status: data.status as 'PENDING' | 'APPROVED' | 'SUSPENDED',
          commissionRatePercent: 20,
          payoutType: null,
          approvedAt: null,
          createdAt: new Date().toISOString(),
          referralCount: 0,
          commissionCount: 0,
        });
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('from');
          return next;
        }, { replace: true });
      } catch {
        // ignore
      } finally {
        if (!cancelled) setRegistering(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [loading, affiliate, fromCadastro, setSearchParams]);

  useEffect(() => {
    if (affiliate?.id && affiliate.status === 'APPROVED') {
      affiliateApi.stats().then(setStats).catch(() => setStats(null));
    }
  }, [affiliate?.id, affiliate?.status]);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const data = await affiliateApi.register();
      setAffiliate({
        id: data.id,
        code: data.code,
        status: data.status as 'PENDING' | 'APPROVED' | 'SUSPENDED',
        commissionRatePercent: 20,
        payoutType: null,
        approvedAt: null,
        createdAt: new Date().toISOString(),
        referralCount: 0,
        commissionCount: 0,
      });
    } catch {
      setRegistering(false);
    }
    setRegistering(false);
  };

  const shareUrl = affiliate?.code ? `${APP_URL}/api/affiliate/click?ref=${encodeURIComponent(affiliate.code)}` : '';
  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <HeaderDashboard title={t('page.afiliado.title')} />
        <div className="flex items-center justify-center flex-1 gap-2 text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          {t('page.afiliado.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title={t('page.afiliado.title')} />
      <div className="p-4 md:p-6 space-y-6 max-w-3xl">
        {affiliate == null && (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <h2 className="text-lg font-bold text-foreground">{t('page.afiliado.programTitle')}</h2>
            <p className="text-muted text-sm">{t('page.afiliado.programDesc')}</p>
            <Button onClick={handleRegister} disabled={registering} className="gap-2">
              {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {t('page.afiliado.register')}
            </Button>
          </div>
        )}

        {affiliate?.status === 'PENDING' && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 flex items-center gap-4">
            <CheckCircle className="w-10 h-10 text-amber-500 shrink-0" />
            <div>
              <h3 className="font-bold text-foreground">{t('page.afiliado.pendingTitle')}</h3>
              <p className="text-sm text-muted">{t('page.afiliado.pendingDesc', { code: affiliate.code })}</p>
            </div>
          </div>
        )}

        {affiliate?.status === 'APPROVED' && (
          <>
            <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">{t('page.afiliado.yourLink')}</span>
              <code className="flex-1 min-w-0 text-sm bg-muted/50 px-2 py-1 rounded truncate">{shareUrl}</code>
              <Button variant="secondary" size="sm" onClick={copyLink} className="gap-1 shrink-0">
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t('page.afiliado.copied') : t('page.afiliado.copy')}
              </Button>
            </div>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <Users className="w-5 h-5 text-muted mb-2" />
                  <p className="text-2xl font-bold text-foreground">{stats.referralCount}</p>
                  <p className="text-xs text-muted">{t('page.afiliado.stat.signups')}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <TrendingUp className="w-5 h-5 text-muted mb-2" />
                  <p className="text-2xl font-bold text-foreground">{stats.convertedCount}</p>
                  <p className="text-xs text-muted">{t('page.afiliado.stat.conversions')}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <Wallet className="w-5 h-5 text-muted mb-2" />
                  <p className="text-2xl font-bold text-foreground">R$ {((stats.commissionPendingCents ?? 0) / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted">{t('page.afiliado.stat.pending')}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <Wallet className="w-5 h-5 text-muted mb-2" />
                  <p className="text-2xl font-bold text-foreground">R$ {((stats.commissionPaidCents ?? 0) / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted">{t('page.afiliado.stat.paid')}</p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Link to="/dashboard/afiliado/materiais">
                <Button variant="secondary" size="sm">{t('page.afiliado.link.materials')}</Button>
              </Link>
              <Link to="/dashboard/afiliado/conversoes">
                <Button variant="secondary" size="sm">{t('page.afiliado.link.conversions')}</Button>
              </Link>
              <Link to="/dashboard/afiliado/comissoes">
                <Button variant="secondary" size="sm">{t('page.afiliado.link.commissions')}</Button>
              </Link>
              <Link to="/dashboard/afiliado/pagamento">
                <Button variant="secondary" size="sm">{t('page.afiliado.link.payment')}</Button>
              </Link>
            </div>
          </>
        )}

        {affiliate?.status === 'SUSPENDED' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
            <h3 className="font-bold text-foreground">{t('page.afiliado.suspendedTitle')}</h3>
            <p className="text-sm text-muted">{t('page.afiliado.suspendedDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
