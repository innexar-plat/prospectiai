import { Layers, Sparkles } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useI18n } from '@/lib/i18n';

export default function ListasPage() {
    const { t } = useI18n();

    return (
        <>
            <HeaderDashboard
                title={t('page.listas.title')}
                subtitle={t('page.listas.subtitle')}
                breadcrumb={t('page.listas.breadcrumb')}
            />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
                <div className="rounded-[2.4rem] bg-gradient-to-br from-violet-900/20 to-card border border-violet-500/10 p-12 sm:p-16 flex flex-col items-center justify-center gap-6 min-h-[420px] text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/5 blur-[100px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

                    <div className="relative z-10 w-20 h-20 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Layers size={36} className="text-violet-600 dark:text-violet-400" />
                    </div>

                    <div className="relative z-10 space-y-3 max-w-lg">
                        <h2 className="text-2xl font-black text-foreground">{t('page.listas.comingTitle')}</h2>
                        <p className="text-sm text-muted leading-relaxed">
                            {t('page.listas.comingDesc')}
                        </p>
                    </div>

                    <div className="relative z-10 flex items-center gap-2 mt-4 px-5 py-3 rounded-2xl bg-violet-500/5 border border-violet-500/10">
                        <Sparkles size={16} className="text-violet-600 dark:text-violet-400" />
                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">{t('page.listas.inDevelopment')}</span>
                    </div>
                </div>
            </div>
        </>
    );
}
