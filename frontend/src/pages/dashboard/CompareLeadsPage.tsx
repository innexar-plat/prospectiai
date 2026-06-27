import { useMemo } from 'react';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import type { Place, SessionUser } from '@/lib/api';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';

export default function CompareLeadsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { t } = useI18n();
    useOutletContext<{ user: SessionUser }>();
    const location = useLocation();

    const placesFromState = useMemo(
        () => ((location.state as { places?: Place[] } | null)?.places ?? []) as Place[],
        [location.state],
    );
    const ids = useMemo(() => {
        const raw = searchParams.get('ids') ?? '';
        return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }, [searchParams]);

    const places = useMemo(() => {
        if (!ids.length) return placesFromState.slice(0, 3);
        const map = new Map(placesFromState.map((p) => [p.id, p]));
        return ids.map((id) => map.get(id)).filter((v): v is Place => !!v).slice(0, 3);
    }, [ids, placesFromState]);

    return (
        <>
            <HeaderDashboard
                title={t('page.compareLeads.title')}
                subtitle={t('page.compareLeads.subtitle')}
                breadcrumb={t('page.compareLeads.breadcrumb')}
            />
            <div className="p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-4">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                    <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
                        {t('page.compareLeads.back')}
                    </Button>
                    <p className="text-xs text-muted">{t('page.compareLeads.selected', { count: places.length })}</p>
                </div>

                {places.length < 2 ? (
                    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted">
                        {t('page.compareLeads.minSelect')}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {places.map((p) => (
                            <article key={p.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                                <h3 className="font-bold text-foreground">{p.displayName?.text ?? p.id}</h3>
                                <p className="text-sm text-muted">{p.formattedAddress ?? '—'}</p>
                                <div className="space-y-1 text-sm">
                                    <p><span className="text-muted">{t('page.compareLeads.opportunity')}</span> <span className="text-violet-600 dark:text-violet-400 font-semibold">{p.opportunityScore ?? 0}</span></p>
                                    <p><span className="text-muted">{t('page.compareLeads.rating')}</span> {p.rating ?? '—'} {p.userRatingCount != null ? `(${p.userRatingCount})` : ''}</p>
                                    <p><span className="text-muted">{t('page.compareLeads.phone')}</span> {p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? '—'}</p>
                                    <p><span className="text-muted">{t('page.compareLeads.website')}</span> {p.websiteUri ? t('common.yes') : t('common.no')}</p>
                                    <p><span className="text-muted">{t('page.compareLeads.type')}</span> {p.primaryType ?? p.types?.[0] ?? '—'}</p>
                                </div>
                                <div className="pt-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => navigate(`/dashboard/lead/${encodeURIComponent(p.id)}`, { state: { place: p } })}
                                    >
                                        {t('page.compareLeads.viewDetail')}
                                    </Button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
