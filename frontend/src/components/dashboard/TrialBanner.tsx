import { Link } from 'react-router-dom';
import { Clock, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/api';
import { isTrialEnabled } from '@/lib/market';
import { getPlanDisplayName, isTrialExpiredUser, isTrialingUser } from '@/lib/billing-config';
import { useI18n } from '@/lib/i18n';

interface TrialBannerProps {
    user: SessionUser;
    className?: string;
}

export function TrialBanner({ user, className }: TrialBannerProps) {
    const { t } = useI18n();
    if (!isTrialEnabled()) return null;
    const expired = isTrialExpiredUser(user);
    const trialing = isTrialingUser(user);

    if (!trialing && !expired && user.plan !== 'TRIAL') return null;

    if (expired) {
        return (
            <div
                className={cn(
                    'flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-2xl border border-amber-500/30 bg-amber-500/10',
                    className,
                )}
                role="status"
            >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-foreground">{t('trial.expiredTitle')}</p>
                        <p className="text-xs text-muted mt-0.5">{t('trial.expiredDesc')}</p>
                    </div>
                </div>
                <Link
                    to="/dashboard/planos"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shrink-0 transition-colors"
                >
                    {t('trial.viewPlans')}
                    <ArrowRight size={14} />
                </Link>
            </div>
        );
    }

    const days = user.trialDaysRemaining ?? 0;
    const usagePct = user.leadsLimit > 0 ? Math.round((user.leadsUsed / user.leadsLimit) * 100) : 0;

    return (
        <div
            className={cn(
                'flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-600/10 to-indigo-600/10',
                className,
            )}
            role="status"
        >
            <div className="flex items-start gap-3 flex-1 min-w-0">
                <Sparkles size={20} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-bold text-foreground">
                        {t('trial.activeTitle', { plan: getPlanDisplayName('TRIAL'), days })}
                    </p>
                    <p className="text-xs text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                            <Clock size={12} />
                            {t('trial.activeDesc')}
                        </span>
                        <span className="text-muted/50">·</span>
                        <span>{t('trial.credits', { used: user.leadsUsed, limit: user.leadsLimit, pct: usagePct })}</span>
                    </p>
                </div>
            </div>
            <Link
                to="/dashboard/planos"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold shrink-0 transition-colors"
            >
                {t('trial.subscribe')}
                <ArrowRight size={14} />
            </Link>
        </div>
    );
}
