import { useState, useCallback } from 'react';
import { Lock, Loader2, Search, Link as LinkIcon, Star, AlertTriangle, CheckCircle2, Lightbulb, Share2, User, Globe } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser, CompanyAnalysisReport } from '@/lib/api';
import { companyAnalysisApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { EmptyState, StatCard } from '@/components/dashboard/shared/DashboardUI';
import {
    INTELLIGENCE_CONTENT_CLASS,
    INTELLIGENCE_STAT_GRID_CLASS,
    IntelligenceFormCard,
    IntelligenceErrorBanner,
    IntelligenceLoadingSkeleton,
    IntelligenceSectionCard,
} from '@/components/dashboard/shared/IntelligenceUI';
import { LocationFields, createDefaultLocationValue, type LocationFieldsValue } from '@/components/dashboard/LocationFields';
import { useI18n } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/locale';
import { isMarketFeatureEnabled } from '@/lib/market';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type AnalysisMode = 'profile' | 'search';

function buildProfileRequestBody(profile: { companyName: string; location: LocationFieldsValue }, locale: SupportedLocale) {
    return {
        useProfile: true as const,
        companyName: profile.companyName.trim() || undefined,
        city: profile.location.city.trim() || undefined,
        state: profile.location.state && profile.location.state !== 'Todos' ? profile.location.state : undefined,
        country: profile.location.country || undefined,
        locale,
    };
}

function buildSearchRequestBody(search: {
    companyName: string;
    location: LocationFieldsValue;
    productService: string;
    websiteUrl: string;
    linkedInUrl: string;
    instagramUrl: string;
    facebookUrl: string;
}, locale: SupportedLocale) {
    return {
        useProfile: false as const,
        companyName: search.companyName.trim(),
        city: search.location.city.trim() || undefined,
        state: search.location.state && search.location.state !== 'Todos' ? search.location.state : undefined,
        country: search.location.country || undefined,
        locale,
        productService: search.productService.trim() || undefined,
        websiteUrl: search.websiteUrl.trim() || undefined,
        linkedInUrl: search.linkedInUrl.trim() || undefined,
        instagramUrl: search.instagramUrl.trim() || undefined,
        facebookUrl: search.facebookUrl.trim() || undefined,
    };
}

function buildAnalysisRequestBody(
    mode: AnalysisMode,
    profile: { companyName: string; location: LocationFieldsValue },
    search: Parameters<typeof buildSearchRequestBody>[0],
    locale: SupportedLocale,
) {
    return mode === 'profile' ? buildProfileRequestBody(profile, locale) : buildSearchRequestBody(search, locale);
}

type MinhaEmpresaFormProps = {
    mode: AnalysisMode;
    setMode: (m: AnalysisMode) => void;
    companyName: string;
    setCompanyName: (v: string) => void;
    profileLocation: LocationFieldsValue;
    setProfileLocation: (v: Partial<LocationFieldsValue>) => void;
    searchCompanyName: string;
    setSearchCompanyName: (v: string) => void;
    searchLocation: LocationFieldsValue;
    setSearchLocation: (v: Partial<LocationFieldsValue>) => void;
    searchProductService: string;
    setSearchProductService: (v: string) => void;
    searchWebsiteUrl: string;
    setSearchWebsiteUrl: (v: string) => void;
    searchLinkedInUrl: string;
    setSearchLinkedInUrl: (v: string) => void;
    searchInstagramUrl: string;
    setSearchInstagramUrl: (v: string) => void;
    searchFacebookUrl: string;
    setSearchFacebookUrl: (v: string) => void;
    loading: boolean;
    onAnalyze: (e: React.SyntheticEvent<HTMLFormElement>) => void;
    canSubmit: boolean;
    profileEmpty: boolean;
    workspaceName: string;
    t: TranslateFn;
};

function MinhaEmpresaFormAndReport(props: MinhaEmpresaFormProps & { t: TranslateFn }) {
    const {
        mode, setMode,
        companyName, setCompanyName,
        profileLocation, setProfileLocation,
        searchCompanyName, setSearchCompanyName,
        searchLocation, setSearchLocation,
        searchProductService, setSearchProductService, searchWebsiteUrl, setSearchWebsiteUrl,
        searchLinkedInUrl, setSearchLinkedInUrl, searchInstagramUrl, setSearchInstagramUrl, searchFacebookUrl, setSearchFacebookUrl,
        loading, onAnalyze, canSubmit, profileEmpty, workspaceName, t,
    } = props;
    return (
        <IntelligenceFormCard>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.minhaEmpresa.formTitle')}</h3>
                <Link to="/dashboard/historico?tab=intelligence&module=MY_COMPANY" className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium">
                    {t('page.minhaEmpresa.viewHistory')}
                </Link>
            </div>
            <p className="text-xs text-muted mb-4">
                {t('page.minhaEmpresa.formDescPart1')}{' '}
                <strong>{t('page.minhaEmpresa.formProfile')}</strong>{' '}
                {t('page.minhaEmpresa.formDescPart2')}{' '}
                <strong>{t('page.minhaEmpresa.formSearch')}</strong>{' '}
                {t('page.minhaEmpresa.formDescPart3')}
            </p>

            <div className="flex gap-2 mb-6 p-1 rounded-xl bg-surface border border-border w-fit">
                <button
                    type="button"
                    onClick={() => setMode('profile')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === 'profile' ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-muted hover:text-foreground'}`}
                >
                    <User size={16} />
                    {t('page.minhaEmpresa.modeProfile')}
                </button>
                <button
                    type="button"
                    onClick={() => setMode('search')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === 'search' ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-muted hover:text-foreground'}`}
                >
                    <Globe size={16} />
                    {t('page.minhaEmpresa.modeSearch')}
                </button>
            </div>

            {mode === 'profile' && (
                <>
                    {profileEmpty && (
                        <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-muted">
                            <p className="font-bold text-foreground mb-1">{t('page.minhaEmpresa.profileEmptyTitle')}</p>
                            <p className="mb-3">{t('page.minhaEmpresa.profileEmptyDesc')}</p>
                            <Link to="/dashboard/empresa" className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-400 font-bold hover:underline">
                                {t('page.minhaEmpresa.goToProfile')}
                            </Link>
                        </div>
                    )}
                    {!profileEmpty && (
                        <p className="text-sm text-muted mb-4">
                            {t('page.minhaEmpresa.currentProfile')} <span className="font-bold text-foreground">{workspaceName}</span>
                        </p>
                    )}
                    <form onSubmit={onAnalyze} className="space-y-4">
                        <input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder={profileEmpty ? t('page.minhaEmpresa.placeholder.companyName') : t('page.minhaEmpresa.placeholder.overrideName')}
                            className="h-12 w-full bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                        <LocationFields value={profileLocation} onChange={setProfileLocation} disabled={loading} accent="violet" gridClass="grid-cols-1 sm:grid-cols-3" />
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={loading || !canSubmit}
                            icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                            className="h-12 w-full px-6 rounded-xl font-bold whitespace-nowrap bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-lg shadow-violet-500/25 border-0"
                        >
                            {loading ? t('page.minhaEmpresa.generating') : t('page.minhaEmpresa.generate')}
                        </Button>
                    </form>
                </>
            )}

            {mode === 'search' && (
                <form onSubmit={onAnalyze} className="space-y-4">
                    <input
                        value={searchCompanyName}
                        onChange={(e) => setSearchCompanyName(e.target.value)}
                        placeholder={t('page.minhaEmpresa.placeholder.companyName')}
                        className="h-12 w-full bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        required
                    />
                    <LocationFields value={searchLocation} onChange={setSearchLocation} disabled={loading} accent="violet" gridClass="grid-cols-1 sm:grid-cols-3" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                            value={searchProductService}
                            onChange={(e) => setSearchProductService(e.target.value)}
                            placeholder={t('page.minhaEmpresa.placeholder.productService')}
                            className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                        <input
                            value={searchWebsiteUrl}
                            onChange={(e) => setSearchWebsiteUrl(e.target.value)}
                            placeholder={t('page.minhaEmpresa.placeholder.website')}
                            type="url"
                            className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <input
                            value={searchLinkedInUrl}
                            onChange={(e) => setSearchLinkedInUrl(e.target.value)}
                            placeholder={t('page.minhaEmpresa.placeholder.linkedIn')}
                            type="url"
                            className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                        <input
                            value={searchInstagramUrl}
                            onChange={(e) => setSearchInstagramUrl(e.target.value)}
                            placeholder={t('page.minhaEmpresa.placeholder.instagram')}
                            type="url"
                            className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                        <input
                            value={searchFacebookUrl}
                            onChange={(e) => setSearchFacebookUrl(e.target.value)}
                            placeholder={t('page.minhaEmpresa.placeholder.facebook')}
                            type="url"
                            className="h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={loading || !canSubmit}
                        icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                        className="h-12 px-6 rounded-xl font-bold whitespace-nowrap bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-lg shadow-violet-500/25 border-0"
                    >
                        {loading ? t('page.minhaEmpresa.generating') : t('page.minhaEmpresa.generate')}
                    </Button>
                </form>
            )}
        </IntelligenceFormCard>
    );
}

function MinhaEmpresaReportView({ report, t, showReclameAqui }: { report: CompanyAnalysisReport; t: TranslateFn; showReclameAqui: boolean }) {
    const strengthCount = report.strengths?.length ?? 0;
    const weaknessCount = report.weaknesses?.length ?? 0;
    const opportunityCount = report.opportunities?.length ?? 0;

    return (
        <>
            <IntelligenceSectionCard className="border-violet-500/20 bg-violet-500/5 space-y-2.5">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">{t('page.minhaEmpresa.summary')}</h3>
                <div className="flex flex-wrap gap-1.5">
                    {strengthCount > 0 && (
                        <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            {strengthCount} {t('page.minhaEmpresa.strengths').toLowerCase()}
                        </span>
                    )}
                    {weaknessCount > 0 && (
                        <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                            {weaknessCount} {t('page.minhaEmpresa.weaknesses').toLowerCase()}
                        </span>
                    )}
                    {opportunityCount > 0 && (
                        <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                            {opportunityCount} {t('page.minhaEmpresa.opportunities').toLowerCase()}
                        </span>
                    )}
                </div>
                <p className="text-sm text-muted leading-relaxed break-words [overflow-wrap:anywhere]">{report.summary}</p>
            </IntelligenceSectionCard>

            {(report.googlePresenceScore != null || (showReclameAqui && report.reclameAquiSummary)) && (
                <div className={INTELLIGENCE_STAT_GRID_CLASS}>
                    {report.googlePresenceScore != null && (
                        <StatCard compact value={report.googlePresenceScore} label={t('page.minhaEmpresa.googlePresence')} color="amber" suffix="/10" icon={Star} />
                    )}
                    {report.googleRating != null && (
                        <StatCard compact value={report.googleRating.toFixed(1)} label={t('page.minhaEmpresa.googleRating', { rating: report.googleRating, count: report.googleReviewCount ?? 0 })} color="blue" icon={Star} />
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <IntelligenceSectionCard>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />{t('page.minhaEmpresa.strengths')}
                    </h3>
                    <ul className="space-y-2">
                        {(report.strengths ?? []).map((s) => (
                            <li key={`strength-${String(s).slice(0, 80)}`} className="flex items-start gap-2 text-sm text-muted">
                                <span className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                                </span>
                                {s}
                            </li>
                        ))}
                    </ul>
                </IntelligenceSectionCard>
                <IntelligenceSectionCard>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />{t('page.minhaEmpresa.weaknesses')}
                    </h3>
                    <ul className="space-y-2">
                        {(report.weaknesses ?? []).map((w) => (
                            <li key={`weak-${String(w).slice(0, 80)}`} className="flex items-start gap-2 text-sm text-muted">
                                <span className="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                                </span>
                                {w}
                            </li>
                        ))}
                    </ul>
                </IntelligenceSectionCard>
            </div>

            {(report.opportunities?.length ?? 0) > 0 && (
                <IntelligenceSectionCard>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Lightbulb size={14} className="text-violet-600 dark:text-violet-400" />{t('page.minhaEmpresa.opportunities')}
                    </h3>
                    <ul className="space-y-2">
                        {(report.opportunities ?? []).map((o, i) => (
                            <li key={`opp-${String(o).slice(0, 80)}`} className="text-sm text-muted flex items-start gap-2">
                                <span className="text-violet-600 dark:text-violet-400 font-bold shrink-0">{i + 1}.</span>
                                {o}
                            </li>
                        ))}
                    </ul>
                </IntelligenceSectionCard>
            )}

            {showReclameAqui && report.reclameAquiSummary && (
                <IntelligenceSectionCard>
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.minhaEmpresa.reclameAqui')}</h4>
                    <p className="text-sm text-muted leading-relaxed">{report.reclameAquiSummary}</p>
                </IntelligenceSectionCard>
            )}

            {report.socialNetworks?.presence && (
                <IntelligenceSectionCard>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Share2 size={16} className="text-blue-600 dark:text-blue-400" />{t('page.minhaEmpresa.socialNetworks')}
                    </h3>
                    <p className="text-sm text-muted mb-4">{report.socialNetworks.presence}</p>
                    {report.socialNetworks.perNetwork && report.socialNetworks.perNetwork.length > 0 && (
                        <div className="space-y-3">
                            {report.socialNetworks.perNetwork.map((n) => (
                                <div key={`network-${n.network}-${n.link ?? ''}`} className="p-4 bg-surface rounded-xl border border-border/50">
                                    <p className="font-bold text-foreground text-sm mb-1">{n.network}</p>
                                    {n.link && <p className="text-xs text-muted flex items-center gap-1 mb-1"><LinkIcon size={10} /> {n.link}</p>}
                                    {n.found && <p className="text-sm text-muted mb-1">{n.found}</p>}
                                    {n.suggestions && <p className="text-xs text-violet-600 dark:text-violet-400">{n.suggestions}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                    {report.socialNetworks.consistency && (
                        <p className="text-sm text-muted mt-3 pt-3 border-t border-border">{t('page.minhaEmpresa.consistency')} {report.socialNetworks.consistency}</p>
                    )}
                    {report.socialNetworks.recommendations && report.socialNetworks.recommendations.length > 0 && (
                        <ul className="mt-3 space-y-1 text-sm text-muted">
                            {report.socialNetworks.recommendations.map((r) => (
                                <li key={`rec-${String(r).slice(0, 80)}`}>• {r}</li>
                            ))}
                        </ul>
                    )}
                </IntelligenceSectionCard>
            )}

            {(report.suggestedNiche || report.suggestedBusinessModel) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {report.suggestedNiche && (
                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                            <h4 className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">{t('page.minhaEmpresa.suggestedNiche')}</h4>
                            <p className="text-sm font-bold text-foreground">{report.suggestedNiche}</p>
                        </div>
                    )}
                    {report.suggestedBusinessModel && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">{t('page.minhaEmpresa.suggestedBusinessModel')}</h4>
                            <p className="text-sm font-bold text-foreground">{report.suggestedBusinessModel}</p>
                        </div>
                    )}
                </div>
            )}

            <IntelligenceSectionCard>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Lightbulb size={14} className="text-amber-600 dark:text-amber-400" />{t('page.minhaEmpresa.recommendations')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {report.recommendations.map((rec, i) => (
                        <div key={`recommendation-${String(rec).slice(0, 80)}`} className="flex items-start gap-3 p-3 bg-surface rounded-lg border border-border/50">
                            <span className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center font-bold text-xs text-amber-600 dark:text-amber-400 shrink-0">{i + 1}</span>
                            <p className="text-sm text-muted">{rec}</p>
                        </div>
                    ))}
                </div>
            </IntelligenceSectionCard>
        </>
    );
}

function MinhaEmpresaNoAccess({ onUpgrade, t, showReclameAqui }: { onUpgrade: () => void; t: TranslateFn; showReclameAqui: boolean }) {
    return (
        <>
            <HeaderDashboard compact title={t('page.minhaEmpresa.title')} subtitle={t('page.minhaEmpresa.subtitleLocked')} breadcrumb={t('page.minhaEmpresa.breadcrumb')} />
            <div className={INTELLIGENCE_CONTENT_CLASS}>
                <EmptyState
                    icon={Lock}
                    title={t('page.minhaEmpresa.title')}
                    description={
                        showReclameAqui
                            ? t('page.minhaEmpresa.lockedDesc', {
                                reclameAqui: t('page.minhaEmpresa.lockedReclameAqui'),
                                socialMedia: t('page.minhaEmpresa.lockedSocialMedia'),
                            })
                            : t('page.minhaEmpresa.lockedDescNoRa', {
                                socialMedia: t('page.minhaEmpresa.lockedSocialMedia'),
                            })
                    }
                    actionLabel={t('page.minhaEmpresa.upgrade')}
                    onAction={onUpgrade}
                />
            </div>
        </>
    );
}

export default function MinhaEmpresaPage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { t, locale } = useI18n();
    const showReclameAqui = isMarketFeatureEnabled('reclameAqui');

    const [mode, setMode] = useState<AnalysisMode>('profile');
    const [companyName, setCompanyName] = useState('');
    const [profileLocation, setProfileLocation] = useState<LocationFieldsValue>(() => createDefaultLocationValue());
    const [searchCompanyName, setSearchCompanyName] = useState('');
    const [searchLocation, setSearchLocation] = useState<LocationFieldsValue>(() => createDefaultLocationValue());
    const [searchProductService, setSearchProductService] = useState('');
    const [searchWebsiteUrl, setSearchWebsiteUrl] = useState('');
    const [searchLinkedInUrl, setSearchLinkedInUrl] = useState('');
    const [searchInstagramUrl, setSearchInstagramUrl] = useState('');
    const [searchFacebookUrl, setSearchFacebookUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<CompanyAnalysisReport | null>(null);
    const [error, setError] = useState('');

    const hasAccess = user.plan === 'BUSINESS' || user.plan === 'SCALE';
    const workspaceName = user.companyName ?? '';
    const profileEmpty = !workspaceName?.trim();

    const canSubmitProfile = !profileEmpty || companyName.trim().length > 0;
    const canSubmitSearch = searchCompanyName.trim().length > 0;
    const canSubmit = mode === 'profile' ? canSubmitProfile : canSubmitSearch;

    const runAnalyze = useCallback(async () => {
        if (!canSubmit) return;
        setLoading(true);
        setReport(null);
        setError('');
        try {
            const body = buildAnalysisRequestBody(
                mode,
                { companyName, location: profileLocation },
                {
                    companyName: searchCompanyName,
                    location: searchLocation,
                    productService: searchProductService,
                    websiteUrl: searchWebsiteUrl,
                    linkedInUrl: searchLinkedInUrl,
                    instagramUrl: searchInstagramUrl,
                    facebookUrl: searchFacebookUrl,
                },
                locale,
            );
            const result = await companyAnalysisApi.run(body);
            setReport(result);
            addToast('success', t('page.minhaEmpresa.toast.success'));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('page.minhaEmpresa.toast.error');
            setError(message);
            addToast('error', message);
        } finally {
            setLoading(false);
        }
    }, [canSubmit, mode, companyName, profileLocation, searchCompanyName, searchLocation, searchProductService, searchWebsiteUrl, searchLinkedInUrl, searchInstagramUrl, searchFacebookUrl, addToast, t, locale]);

    const handleAnalyze = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        await runAnalyze();
    };

    if (!hasAccess) {
        return <MinhaEmpresaNoAccess onUpgrade={() => navigate('/dashboard/planos')} t={t} showReclameAqui={showReclameAqui} />;
    }

    const subtitleKey = showReclameAqui ? 'page.minhaEmpresa.subtitle' : 'page.minhaEmpresa.subtitleNoRa';

    return (
        <>
            <HeaderDashboard compact title={t('page.minhaEmpresa.title')} subtitle={t(subtitleKey)} breadcrumb={t('page.minhaEmpresa.breadcrumb')} />
            <div className={INTELLIGENCE_CONTENT_CLASS}>
                <MinhaEmpresaFormAndReport
                    mode={mode}
                    setMode={setMode}
                    companyName={companyName}
                    setCompanyName={setCompanyName}
                    profileLocation={profileLocation}
                    setProfileLocation={(v) => setProfileLocation((prev) => ({ ...prev, ...v }))}
                    searchCompanyName={searchCompanyName}
                    setSearchCompanyName={setSearchCompanyName}
                    searchLocation={searchLocation}
                    setSearchLocation={(v) => setSearchLocation((prev) => ({ ...prev, ...v }))}
                    searchProductService={searchProductService}
                    setSearchProductService={setSearchProductService}
                    searchWebsiteUrl={searchWebsiteUrl}
                    setSearchWebsiteUrl={setSearchWebsiteUrl}
                    searchLinkedInUrl={searchLinkedInUrl}
                    setSearchLinkedInUrl={setSearchLinkedInUrl}
                    searchInstagramUrl={searchInstagramUrl}
                    setSearchInstagramUrl={setSearchInstagramUrl}
                    searchFacebookUrl={searchFacebookUrl}
                    setSearchFacebookUrl={setSearchFacebookUrl}
                    loading={loading}
                    onAnalyze={handleAnalyze}
                    canSubmit={canSubmit}
                    profileEmpty={profileEmpty}
                    workspaceName={workspaceName}
                    t={t}
                />
                {error && !loading && !report && (
                    <IntelligenceErrorBanner message={error} onRetry={runAnalyze} />
                )}
                {loading && <IntelligenceLoadingSkeleton statCount={2} />}
                {report && !loading && <MinhaEmpresaReportView report={report} t={t} showReclameAqui={showReclameAqui} />}
            </div>
        </>
    );
}
