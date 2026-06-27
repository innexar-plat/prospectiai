import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/contexts/ToastContext';
import { integrationsApi, type SessionUser } from '@/lib/api';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type ProviderCardProps = {
    name: string;
    description: string;
    status: 'connected' | 'not_connected' | 'coming_soon';
    logo: React.ReactNode;
    statusLabel: string;
    children?: React.ReactNode;
};

function ProviderCard({ name, description, status, logo, statusLabel, children }: ProviderCardProps) {
    return (
        <div className="rounded-3xl bg-card border border-border p-6 space-y-5 card-shadow">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    {logo}
                    <div>
                        {name && <h3 className="text-base font-semibold text-foreground">{name}</h3>}
                        <p className="text-xs text-muted mt-1">{description}</p>
                    </div>
                </div>
                <span
                    className={
                        status === 'connected'
                            ? 'inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full'
                            : status === 'coming_soon'
                                ? 'inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full'
                                : 'inline-flex items-center gap-1 text-[10px] font-bold text-muted bg-surface border border-border px-2 py-0.5 rounded-full'
                    }
                >
                    {statusLabel}
                </span>
            </div>

            {children}
        </div>
    );
}

function RdLogo() {
    return (
        <div className="h-12 w-36 rounded-2xl overflow-hidden shadow-sm shrink-0 bg-white p-2">
            <img src="/logos/RD_Station_idYP8zaxIA_2.png" alt="RD Station" className="w-full h-full object-contain" />
        </div>
    );
}

function HubSpotLogo() {
    return (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ffd8cc] bg-[#fff3eb] text-[#ff7a59] shadow-sm">
            <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="6" fill="currentColor" />
                <circle cx="37" cy="12" r="4" fill="currentColor" opacity="0.95" />
                <path d="M28 20L34 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M24 30V40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M18 24H9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
        </div>
    );
}

function AgendorLogo() {
    return (
        <div className="h-12 w-36 rounded-2xl overflow-hidden shadow-sm shrink-0 bg-white p-2">
            <img src="/logos/Agendor_idi8FvRR_k_0.png" alt="Agendor" className="w-full h-full object-contain" />
        </div>
    );
}

export default function IntegracoesPage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const { addToast } = useToast();
    const { t } = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();

    const [rdConnecting, setRdConnecting] = useState(false);
    const [rdDisconnecting, setRdDisconnecting] = useState(false);
    const [rdStatus, setRdStatus] = useState<'connected' | 'not_connected'>('not_connected');
    const [agendorStatus, setAgendorStatus] = useState<'connected' | 'not_connected'>('not_connected');
    const [agendorSource, setAgendorSource] = useState<'env' | 'user' | null>(null);
    const [agendorToken, setAgendorToken] = useState('');
    const [agendorSaving, setAgendorSaving] = useState(false);
    const [agendorDisconnecting, setAgendorDisconnecting] = useState(false);
    const [hubspotConnecting, setHubspotConnecting] = useState(false);
    const [hubspotDisconnecting, setHubspotDisconnecting] = useState(false);
    const [hubspotStatus, setHubspotStatus] = useState<'connected' | 'not_connected'>('not_connected');
    const [checkingStatus, setCheckingStatus] = useState(true);

    const statusLabel = (status: 'connected' | 'not_connected' | 'coming_soon') =>
        status === 'connected' ? t('common.connected') : status === 'coming_soon' ? t('common.comingSoon') : t('common.notConnected');

    useEffect(() => {
        const rdResult = searchParams.get('rd');
        if (!rdResult) return;

        if (rdResult === 'connected') {
            addToast('success', t('page.integracoes.toast.rdConnected'));
        } else if (rdResult === 'error') {
            addToast('error', t('page.integracoes.toast.rdError'));
        }

        const hubspotResult = searchParams.get('hubspot');
        if (hubspotResult === 'connected') {
            addToast('success', t('page.integracoes.toast.hubspotConnected'));
        } else if (hubspotResult === 'error') {
            addToast('error', t('page.integracoes.toast.hubspotError'));
        }

        const next = new URLSearchParams(searchParams);
        next.delete('rd');
        next.delete('hubspot');
        next.delete('mode');
        next.delete('reason');
        setSearchParams(next, { replace: true });
    }, [addToast, searchParams, setSearchParams, t]);

    useEffect(() => {
        let cancelled = false;
        setCheckingStatus(true);
        Promise.allSettled([integrationsApi.rdStationTest(), integrationsApi.agendorTest(), integrationsApi.hubspotTest()])
            .then(([rdRes, agendorRes, hubspotRes]) => {
                if (cancelled) return;

                if (rdRes.status === 'fulfilled') {
                    setRdStatus(rdRes.value.ok ? 'connected' : 'not_connected');
                } else {
                    setRdStatus('not_connected');
                }

                if (agendorRes.status === 'fulfilled') {
                    setAgendorStatus(agendorRes.value.ok ? 'connected' : 'not_connected');
                    setAgendorSource(agendorRes.value.source ?? null);
                } else {
                    setAgendorStatus('not_connected');
                    setAgendorSource(null);
                }

                if (hubspotRes.status === 'fulfilled') {
                    setHubspotStatus(hubspotRes.value.ok ? 'connected' : 'not_connected');
                } else {
                    setHubspotStatus('not_connected');
                }
            })
            .finally(() => {
                if (!cancelled) setCheckingStatus(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const handleConnectOAuth = async () => {
        setRdConnecting(true);
        try {
            const res = await integrationsApi.rdStationOauthConnectUrl();
            window.location.href = res.url;
        } catch (e) {
            addToast('error', e instanceof Error ? e.message : t('page.integracoes.toast.rdError'));
            setRdConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setRdDisconnecting(true);
        try {
            await integrationsApi.rdStationDisconnect();
            setRdStatus('not_connected');
            addToast('success', t('page.integracoes.toast.rdDisconnected'));
        } catch {
            addToast('error', t('common.saveError'));
        } finally {
            setRdDisconnecting(false);
        }
    };

    const handleConnectHubspot = async () => {
        setHubspotConnecting(true);
        try {
            const res = await integrationsApi.hubspotOauthConnectUrl();
            window.location.href = res.url;
        } catch (e) {
            addToast('error', e instanceof Error ? e.message : t('page.integracoes.toast.hubspotError'));
            setHubspotConnecting(false);
        }
    };

    const handleDisconnectHubspot = async () => {
        setHubspotDisconnecting(true);
        try {
            await integrationsApi.hubspotDisconnect();
            setHubspotStatus('not_connected');
            addToast('success', t('page.integracoes.toast.hubspotDisconnected'));
        } catch {
            addToast('error', t('common.saveError'));
        } finally {
            setHubspotDisconnecting(false);
        }
    };

    const handleSaveAgendorToken = async () => {
        const token = agendorToken.trim();
        if (!token) {
            addToast('error', t('page.integracoes.toast.tokenRequired'));
            return;
        }

        setAgendorSaving(true);
        try {
            await integrationsApi.agendorSaveToken(token);
            setAgendorToken('');
            const status = await integrationsApi.agendorTest();
            setAgendorStatus(status.ok ? 'connected' : 'not_connected');
            setAgendorSource(status.source ?? null);
            addToast('success', t('page.integracoes.toast.agendorSaved'));
        } catch (e) {
            addToast('error', e instanceof Error ? e.message : t('page.integracoes.toast.agendorError'));
        } finally {
            setAgendorSaving(false);
        }
    };

    const handleDisconnectAgendor = async () => {
        setAgendorDisconnecting(true);
        try {
            await integrationsApi.agendorDisconnect();
            setAgendorStatus('not_connected');
            setAgendorSource(null);
            addToast('success', t('page.integracoes.toast.agendorRemoved'));
        } catch {
            addToast('error', t('common.saveError'));
        } finally {
            setAgendorDisconnecting(false);
        }
    };

    return (
        <>
            <HeaderDashboard
                title={t('page.integracoes.title')}
                subtitle={t('page.integracoes.subtitle')}
                breadcrumb={t('page.integracoes.breadcrumb')}
            />

            <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
                <div className="rounded-3xl border border-border bg-card p-6">
                    <p className="text-sm font-semibold text-foreground">{t('page.integracoes.howToConnect')}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-foreground">{t('page.integracoes.step1')}</div>
                        <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-foreground">{t('page.integracoes.step2')}</div>
                        <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-foreground">{t('page.integracoes.step3')}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ProviderCard
                        name=""
                        description={t('page.integracoes.rdDesc')}
                        status={rdStatus}
                        statusLabel={statusLabel(rdStatus)}
                        logo={<RdLogo />}
                    >
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs text-muted">
                                {checkingStatus ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />}
                                {checkingStatus
                                    ? t('page.integracoes.checking')
                                    : rdStatus === 'connected'
                                        ? t('page.integracoes.rdConnected')
                                        : t('page.integracoes.notConnected')}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[auto_auto] gap-2">
                                <Button variant="primary" size="sm" onClick={handleConnectOAuth} disabled={rdConnecting || rdDisconnecting}>
                                    {rdConnecting ? t('page.integracoes.redirecting') : rdStatus === 'connected' ? t('page.integracoes.reconnect') : t('page.integracoes.connect')}
                                </Button>
                                <Button variant="secondary" size="sm" onClick={handleDisconnect} disabled={rdStatus !== 'connected' || rdDisconnecting || rdConnecting}>
                                    {rdDisconnecting ? t('page.integracoes.disconnecting') : t('page.integracoes.disconnect')}
                                </Button>
                            </div>

                            <p className="text-[12px] leading-relaxed text-muted">
                                {t('page.integracoes.rdOAuthNote')}
                            </p>
                        </div>
                    </ProviderCard>

                    <ProviderCard
                        name="HubSpot CRM"
                        description={t('page.integracoes.hubspotDesc')}
                        status={hubspotStatus}
                        statusLabel={statusLabel(hubspotStatus)}
                        logo={<HubSpotLogo />}
                    >
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs text-muted">
                                {checkingStatus ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />}
                                {checkingStatus
                                    ? t('page.integracoes.checking')
                                    : hubspotStatus === 'connected'
                                        ? t('page.integracoes.hubspotConnected')
                                        : t('page.integracoes.notConnected')}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[auto_auto] gap-2">
                                <Button variant="primary" size="sm" onClick={handleConnectHubspot} disabled={hubspotConnecting || hubspotDisconnecting}>
                                    {hubspotConnecting ? t('page.integracoes.redirecting') : hubspotStatus === 'connected' ? t('page.integracoes.reconnect') : t('page.integracoes.connect')}
                                </Button>
                                <Button variant="secondary" size="sm" onClick={handleDisconnectHubspot} disabled={hubspotStatus !== 'connected' || hubspotDisconnecting || hubspotConnecting}>
                                    {hubspotDisconnecting ? t('page.integracoes.disconnecting') : t('page.integracoes.disconnect')}
                                </Button>
                            </div>

                            <p className="text-[12px] leading-relaxed text-muted">
                                {t('page.integracoes.hubspotOAuthNote')}
                            </p>
                        </div>
                    </ProviderCard>

                    <ProviderCard
                        name=""
                        description={t('page.integracoes.agendorDesc')}
                        status={agendorStatus}
                        statusLabel={statusLabel(agendorStatus)}
                        logo={<AgendorLogo />}
                    >
                        <div className="space-y-3">
                            <p className="text-xs text-muted">
                                {agendorStatus === 'connected'
                                    ? t('common.connected')
                                    : (
                                        <>
                                            {t('page.integracoes.agendorTokenHint')}{' '}
                                            <a href="https://beta.agendor.com.br/settings/integrations/api_token" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline font-semibold">{t('page.integracoes.getToken')}</a>
                                        </>
                                    )}
                            </p>

                            <Input
                                type="password"
                                value={agendorToken}
                                onChange={(e) => setAgendorToken(e.target.value)}
                                placeholder={t('page.integracoes.agendorTokenPlaceholder')}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-[auto_auto] gap-2">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleSaveAgendorToken}
                                    disabled={agendorSaving || agendorDisconnecting || !agendorToken.trim()}
                                >
                                    {agendorSaving ? t('page.perfil.saving') : agendorStatus === 'connected' ? t('page.integracoes.updateToken') : t('page.integracoes.saveToken')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleDisconnectAgendor}
                                    disabled={agendorDisconnecting || agendorSaving || agendorStatus !== 'connected' || agendorSource !== 'user'}
                                >
                                    {agendorDisconnecting ? t('page.integracoes.removing') : t('page.integracoes.removeToken')}
                                </Button>
                            </div>

                            {agendorSource === 'env' && (
                                <p className="text-[12px] leading-relaxed text-muted">
                                    {t('page.integracoes.envTokenNote')}
                                </p>
                            )}
                        </div>
                    </ProviderCard>
                </div>

                {user.plan === 'FREE' && (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 text-foreground text-xs px-4 py-3">
                        {t('page.integracoes.freePlanNote')}
                    </div>
                )}
            </div>
        </>
    );
}
