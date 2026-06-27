import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    HelpCircle,
    ChevronDown,
    MessageSquare,
    CheckCircle2,
    ExternalLink,
    Mail,
    BookOpen,
    Compass,
    Plug,
    Search,
    Target,
    BarChart3,
    Star,
    Users,
    Shield,
    CreditCard,
    Link2,
    FileText,
    type LucideIcon,
} from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from '@/lib/support';
import { clearAllTourFlags } from '@/lib/tour-steps';
import { useI18n } from '@/lib/i18n';
import { getActiveMarket } from '@/lib/market';
import { FAQ_STRUCTURE, INSTRUCTION_KEYS } from '@/lib/i18n/support-messages';

const LUCIDE_ICONS: Record<string, LucideIcon> = {
    Search,
    Star,
    Target,
    BarChart3,
    Plug,
    Users,
    Shield,
    CreditCard,
};

function getLucideIcon(iconName: string): LucideIcon {
    return LUCIDE_ICONS[iconName] ?? HelpCircle;
}

function resolveFaqAnswer(aKey: string, t: (key: string) => string): string {
    if (aKey === 'support.faq.credits.a1') {
        const suffix = getActiveMarket() === 'US' ? 'us' : 'br';
        return t(`support.faq.credits.a1.${suffix}`);
    }
    return t(aKey);
}

const RD_STEP_KEYS = [
    'support.integr.rd.step1',
    'support.integr.rd.step2',
    'support.integr.rd.step3',
    'support.integr.rd.step4',
] as const;

const AGENDOR_STEP_KEYS = [
    'support.integr.agendor.step1',
    'support.integr.agendor.step2',
    'support.integr.agendor.step3',
    'support.integr.agendor.step4',
] as const;

export default function SuportePage() {
    const navigate = useNavigate();
    const { t } = useI18n();
    const [instructionsOpen, setInstructionsOpen] = useState(true);
    const [openFaqKey, setOpenFaqKey] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const market = getActiveMarket();
    const contactHoursKey = market === 'US' ? 'page.suporte.contactHours.us' : 'page.suporte.contactHours.br';

    const faqGroups = useMemo(
        () =>
            FAQ_STRUCTURE.map((group) => ({
                groupKey: group.groupKey,
                icon: getLucideIcon(group.iconName),
                items: group.items
                    .filter((item) => !item.markets || item.markets.includes(market))
                    .map((item) => ({
                        q: t(item.qKey),
                        a: resolveFaqAnswer(item.aKey, t),
                    })),
            })).filter((group) => group.items.length > 0),
        [t, market],
    );

    const filteredGroups = useMemo(() => {
        if (searchQuery.trim().length < 2) return faqGroups;
        const q = searchQuery.toLowerCase();
        return faqGroups
            .map((group) => ({
                ...group,
                items: group.items.filter(
                    (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
                ),
            }))
            .filter((group) => group.items.length > 0);
    }, [faqGroups, searchQuery]);

    const handleRefazerTour = () => {
        clearAllTourFlags();
        navigate('/dashboard');
    };

    return (
        <>
            <HeaderDashboard
                title={t('page.suporte.title')}
                subtitle={t('page.suporte.subtitle')}
                breadcrumb={t('page.suporte.breadcrumb')}
            />
            <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full space-y-8">

                <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{t('page.suporte.statusTitle')}</p>
                        <p className="text-[11px] text-muted">{t('page.suporte.statusDesc')}</p>
                    </div>
                </div>

                <section aria-label={t('page.suporte.quickLinks')}>
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <Link2 size={16} className="text-violet-600 dark:text-violet-400" />
                        {t('page.suporte.quickLinks')}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Link
                            to="/dashboard/planos"
                            className="rounded-xl bg-card border border-border p-3 hover:border-violet-500/30 hover:bg-surface/50 transition-colors text-center"
                        >
                            <CreditCard size={18} className="mx-auto text-violet-600 dark:text-violet-400 mb-1.5" />
                            <p className="text-xs font-semibold text-foreground">{t('page.suporte.linkPlans')}</p>
                        </Link>
                        <Link
                            to="/dashboard/integracoes"
                            className="rounded-xl bg-card border border-border p-3 hover:border-violet-500/30 hover:bg-surface/50 transition-colors text-center"
                        >
                            <Plug size={18} className="mx-auto text-violet-600 dark:text-violet-400 mb-1.5" />
                            <p className="text-xs font-semibold text-foreground">{t('page.suporte.linkIntegrations')}</p>
                        </Link>
                        <button
                            type="button"
                            onClick={handleRefazerTour}
                            className="rounded-xl bg-card border border-border p-3 hover:border-violet-500/30 hover:bg-surface/50 transition-colors text-center"
                        >
                            <Compass size={18} className="mx-auto text-violet-600 dark:text-violet-400 mb-1.5" />
                            <p className="text-xs font-semibold text-foreground">{t('page.suporte.retakeTour')}</p>
                        </button>
                        <a
                            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t('page.suporte.linkDocs'))}`}
                            className="rounded-xl bg-card border border-border p-3 hover:border-violet-500/30 hover:bg-surface/50 transition-colors text-center"
                        >
                            <FileText size={18} className="mx-auto text-violet-600 dark:text-violet-400 mb-1.5" />
                            <p className="text-xs font-semibold text-foreground">{t('page.suporte.linkDocs')}</p>
                        </a>
                    </div>
                </section>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 sm:col-span-1">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                            <Compass size={20} className="text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground">{t('page.suporte.retakeTour')}</p>
                            <p className="text-[11px] text-muted">{t('page.suporte.retakeTourDesc')}</p>
                        </div>
                    </div>
                    <Link
                        to="/integracoes/rdstation"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 hover:bg-surface/50 hover:border-[#00C4CC]/30 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 p-1">
                            <img src="/logos/RD_Station_idYP8zaxIA_2.png" alt="Logo RD Station" className="h-6 object-contain" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground flex items-center gap-1">
                                {t('page.suporte.rdGuide')} <ExternalLink size={11} className="text-muted" />
                            </p>
                            <p className="text-[11px] text-muted">{t('page.suporte.rdGuideDesc')}</p>
                        </div>
                    </Link>
                    <Link
                        to="/integracoes/agendor"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 hover:bg-surface/50 hover:border-[#4400CC]/30 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 p-1">
                            <img src="/logos/Agendor_idi8FvRR_k_0.png" alt="Logo Agendor" className="h-6 object-contain" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground flex items-center gap-1">
                                {t('page.suporte.agendorGuide')} <ExternalLink size={11} className="text-muted" />
                            </p>
                            <p className="text-[11px] text-muted">{t('page.suporte.agendorGuideDesc')}</p>
                        </div>
                    </Link>
                </div>

                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setInstructionsOpen(!instructionsOpen)}
                        className="w-full p-6 border-b border-border flex items-center justify-between text-left hover:bg-surface/30 transition-colors"
                    >
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <BookOpen size={18} className="text-violet-600 dark:text-violet-400" /> {t('page.suporte.howToUse')}
                        </h3>
                        <ChevronDown
                            size={16}
                            className={`text-muted shrink-0 transition-transform ${instructionsOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {instructionsOpen && (
                        <div className="p-6 grid sm:grid-cols-2 gap-4">
                            {INSTRUCTION_KEYS.map(({ step, titleKey, bodyKey, iconName }) => {
                                const Icon = getLucideIcon(iconName);
                                return (
                                    <div key={step} className="flex gap-3 p-3 rounded-xl bg-surface/30 border border-border/50">
                                        <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                                            <Icon size={16} className="text-violet-600 dark:text-violet-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{step}. {t(titleKey)}</p>
                                            <p className="text-xs text-muted leading-relaxed mt-1">{t(bodyKey)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <img src="/logos/RD_Station_idYP8zaxIA_2.png" alt="Logo RD Station" className="h-8 object-contain bg-white rounded-lg p-1" />
                            <h4 className="font-bold text-foreground">RD Station</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">OAuth</span>
                        </div>
                        <ol className="space-y-1.5 text-xs text-muted">
                            {RD_STEP_KEYS.map((key, index) => (
                                <li key={key} className="flex gap-2">
                                    <span className="font-bold text-violet-600 dark:text-violet-400 shrink-0">{index + 1}.</span>
                                    {t(key)}
                                </li>
                            ))}
                        </ol>
                        <p className="text-[11px] text-muted">{t('support.integr.rd.note')}</p>
                    </div>
                    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <img src="/logos/Agendor_idi8FvRR_k_0.png" alt="Logo Agendor" className="h-8 object-contain bg-white rounded-lg p-1" />
                            <h4 className="font-bold text-foreground">Agendor</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold">Token</span>
                        </div>
                        <ol className="space-y-1.5 text-xs text-muted">
                            {AGENDOR_STEP_KEYS.map((key, index) => (
                                <li key={key} className="flex gap-2">
                                    <span className="font-bold text-[#7C5CFC] shrink-0">{index + 1}.</span>
                                    {t(key)}
                                </li>
                            ))}
                        </ol>
                        <p className="text-[11px] text-muted">{t('support.integr.agendor.note')}</p>
                    </div>
                </div>

                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                            <BookOpen size={18} className="text-violet-600 dark:text-violet-400" /> {t('page.suporte.categoriesTitle')}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {FAQ_STRUCTURE.filter((g) => {
                                const visible = g.items.filter((i) => !i.markets || i.markets.includes(market));
                                return visible.length > 0;
                            }).map((group) => {
                                const Icon = getLucideIcon(group.iconName);
                                const count = group.items.filter((i) => !i.markets || i.markets.includes(market)).length;
                                return (
                                    <button
                                        key={group.groupKey}
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setOpenFaqKey(null);
                                            document.getElementById(`faq-group-${group.groupKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}
                                        className="rounded-xl border border-border bg-surface/30 p-3 text-left hover:border-violet-500/30 hover:bg-violet-500/5 transition-colors"
                                    >
                                        <Icon size={14} className="text-violet-600 dark:text-violet-400 mb-1.5" />
                                        <p className="text-[11px] font-semibold text-foreground leading-tight">{t(group.groupKey)}</p>
                                        <p className="text-[10px] text-muted mt-0.5">{count} {t('page.suporte.faqCount')}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                    <div className="p-6 border-b border-border space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <HelpCircle size={18} className="text-violet-600 dark:text-violet-400" /> {t('page.suporte.faqTitle')}
                        </h3>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('page.suporte.faqSearch')}
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="divide-y divide-border/50">
                        {filteredGroups.length === 0 && (
                            <div className="px-6 py-8 text-center text-sm text-muted">
                                {t('page.suporte.faqEmpty', { query: searchQuery })}
                            </div>
                        )}
                        {filteredGroups.map((group, gi) => {
                            const GroupIcon = group.icon;
                            return (
                                <div key={group.groupKey} id={`faq-group-${group.groupKey}`}>
                                    <div className="px-6 pt-4 pb-1 flex items-center gap-2">
                                        <GroupIcon size={13} className="text-violet-600 dark:text-violet-400" />
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{t(group.groupKey)}</p>
                                        <span className="text-[10px] text-muted/50">({group.items.length})</span>
                                    </div>
                                    {group.items.map((item, ii) => {
                                        const key = `${gi}-${ii}`;
                                        const isOpen = openFaqKey === key;
                                        return (
                                            <div key={key}>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenFaqKey(isOpen ? null : key)}
                                                    className="w-full flex items-center justify-between px-6 py-3.5 text-left hover:bg-surface/30 transition-colors"
                                                >
                                                    <span className="text-sm font-medium text-foreground pr-4">{item.q}</span>
                                                    <ChevronDown
                                                        size={16}
                                                        className={`text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                                    />
                                                </button>
                                                {isOpen && (
                                                    <div className="px-6 pb-4 text-sm text-muted leading-relaxed animate-in slide-in-from-top-1">
                                                        {item.a}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="rounded-2xl bg-card border border-border p-6 flex items-start gap-4 hover:bg-surface/50 transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                            <Mail size={18} className="text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-foreground group-hover:text-violet-600 dark:text-violet-400 transition-colors">{t('page.suporte.contactEmail')}</h4>
                            <p className="text-xs text-muted mt-1">{SUPPORT_EMAIL}</p>
                            <p className="text-[10px] text-muted/60 mt-0.5">{t('page.suporte.contactEmailResponse')}</p>
                        </div>
                    </a>
                    <a
                        href={SUPPORT_WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl bg-card border border-border p-6 flex items-start gap-4 hover:bg-surface/50 transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <MessageSquare size={18} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-foreground group-hover:text-emerald-600 dark:text-emerald-400 transition-colors flex items-center gap-1">
                                {t('page.suporte.contactWhatsApp')} <ExternalLink size={12} />
                            </h4>
                            <p className="text-xs text-muted mt-1">{t('page.suporte.contactWhatsAppDesc')}</p>
                            <p className="text-[10px] text-muted/60 mt-0.5">{t(contactHoursKey)}</p>
                        </div>
                    </a>
                </div>
            </div>
        </>
    );
}
