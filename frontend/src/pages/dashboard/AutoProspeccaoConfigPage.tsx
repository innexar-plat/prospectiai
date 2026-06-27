import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Save } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { EmptyState } from '@/components/dashboard/shared/DashboardUI';
import type { AutoProspConfig } from '@/lib/api';
import { autoProspApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const TABS = ['schedule', 'limits', 'scoring', 'crm', 'email'] as const;
type Tab = (typeof TABS)[number];

export default function AutoProspeccaoConfigPage() {
    const { t } = useI18n();
    const [config, setConfig] = useState<AutoProspConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeTab, setActiveTab] = useState<Tab>('schedule');

    useEffect(() => {
        autoProspApi
            .getConfig()
            .then((r) => setConfig(r.data))
            .catch((e) => setError(e instanceof Error ? e.message : t('common.error')))
            .finally(() => setLoading(false));
    }, [t]);

    const set = <K extends keyof AutoProspConfig>(key: K, value: AutoProspConfig[K]) => {
        setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const updated = await autoProspApi.updateConfig(config);
            setConfig(updated.data);
            setSuccess(t('page.autoProspeccaoConfig.saved'));
            setTimeout(() => setSuccess(''), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : t('page.autoProspeccaoConfig.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (day: number) => {
        if (!config) return;
        const days = config.scheduleDays.includes(day)
            ? config.scheduleDays.filter((d) => d !== day)
            : [...config.scheduleDays, day].sort();
        set('scheduleDays', days);
    };

    const scoringHelpLines = t('page.autoProspeccaoConfig.scoring.help').split('\n');

    return (
        <>
            <HeaderDashboard
                title={t('page.autoProspeccaoConfig.title')}
                subtitle={t('page.autoProspeccaoConfig.subtitle')}
                breadcrumb={t('page.autoProspeccaoConfig.breadcrumb')}
            />

            <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : error && !config ? (
                    <EmptyState icon={AlertCircle} title={t('common.error')} description={error} />
                ) : config ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                            <div>
                                <div className="font-medium text-sm">{t('page.autoProspeccaoConfig.moduleTitle')}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {config.isActive ? t('page.autoProspeccaoConfig.moduleActive') : t('page.autoProspeccaoConfig.moduleInactive')}
                                </div>
                            </div>
                            <button
                                onClick={() => set('isActive', !config.isActive)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                    config.isActive ? 'bg-green-500' : 'bg-muted'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                        config.isActive ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        <div className="border-b border-border flex gap-4 overflow-x-auto">
                            {TABS.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`pb-2 text-sm whitespace-nowrap transition border-b-2 -mb-px ${
                                        activeTab === tab
                                            ? 'border-primary text-foreground font-medium'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {t(`page.autoProspeccaoConfig.tab.${tab}`)}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-5">
                            {activeTab === 'schedule' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">{t('page.autoProspeccaoConfig.schedule.days')}</label>
                                        <div className="flex gap-2">
                                            {DAYS.map((value) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => toggleDay(value)}
                                                    className={`w-10 h-10 rounded-lg text-xs font-medium border transition ${
                                                        config.scheduleDays.includes(value)
                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                            : 'border-border hover:bg-muted/60'
                                                    }`}
                                                >
                                                    {t(`page.autoProspeccaoConfig.day.${value}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoConfig.schedule.timeStart')}</label>
                                            <input
                                                type="time"
                                                value={config.scheduleTimeStart}
                                                onChange={(e) => set('scheduleTimeStart', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoConfig.schedule.timeEnd')}</label>
                                            <input
                                                type="time"
                                                value={config.scheduleTimeEnd}
                                                onChange={(e) => set('scheduleTimeEnd', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'limits' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {([
                                        { key: 'maxLeadsPerRun', labelKey: 'page.autoProspeccaoConfig.limits.maxLeadsPerRun', min: 10, max: 500 },
                                        { key: 'maxEmailsPerDay', labelKey: 'page.autoProspeccaoConfig.limits.maxEmailsPerDay', min: 1, max: 200 },
                                        { key: 'maxCrmPushPerDay', labelKey: 'page.autoProspeccaoConfig.limits.maxCrmPushPerDay', min: 1, max: 100 },
                                    ] as const).map(({ key, labelKey, min, max }) => (
                                        <div key={key}>
                                            <label className="block text-xs text-muted-foreground mb-1">{t(labelKey)}</label>
                                            <input
                                                type="number"
                                                min={min}
                                                max={max}
                                                value={(config as AutoProspConfig)[key] as number}
                                                onChange={(e) => set(key, Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'scoring' && (
                                <div className="space-y-6">
                                    {([
                                        { key: 'hotScoreMin', labelKey: 'page.autoProspeccaoConfig.scoring.hotMin', color: 'text-red-400' },
                                        { key: 'warmScoreMin', labelKey: 'page.autoProspeccaoConfig.scoring.warmMin', color: 'text-orange-400' },
                                    ] as const).map(({ key, labelKey, color }) => (
                                        <div key={key}>
                                            <div className="flex justify-between text-sm mb-2">
                                                <label className={`font-medium ${color}`}>{t(labelKey)}</label>
                                                <span className="font-mono text-sm">{(config as AutoProspConfig)[key]}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                step={5}
                                                value={(config as AutoProspConfig)[key] as number}
                                                onChange={(e) => set(key, Number(e.target.value))}
                                                className="w-full accent-primary"
                                            />
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>0</span><span>50</span><span>100</span>
                                            </div>
                                        </div>
                                    ))}
                                    <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                                        {scoringHelpLines.map((line, i) => (
                                            <span key={line}>
                                                {line}
                                                {i < scoringHelpLines.length - 1 && <br />}
                                            </span>
                                        ))}
                                    </p>
                                </div>
                            )}

                            {activeTab === 'crm' && (
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium">{t('page.autoProspeccaoConfig.crm.autoSend')}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{t('page.autoProspeccaoConfig.crm.autoSendDesc')}</div>
                                        </div>
                                        <button
                                            onClick={() => set('crmAutoSend', !config.crmAutoSend)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                                config.crmAutoSend ? 'bg-green-500' : 'bg-muted'
                                            }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${config.crmAutoSend ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoConfig.crm.provider')}</label>
                                        <select
                                            value={config.crmProvider ?? ''}
                                            onChange={(e) => set('crmProvider', e.target.value || null)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="">{t('page.autoProspeccaoConfig.crm.select')}</option>
                                            <option value="rdstation">RD Station</option>
                                            <option value="hubspot">HubSpot</option>
                                            <option value="agendor">Agendor</option>
                                        </select>
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        {t('page.autoProspeccaoConfig.crm.credentialsHint')}
                                    </p>
                                </div>
                            )}

                            {activeTab === 'email' && (
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium">{t('page.autoProspeccaoConfig.email.autoSend')}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{t('page.autoProspeccaoConfig.email.autoSendDesc')}</div>
                                        </div>
                                        <button
                                            onClick={() => set('emailAutoSend', !config.emailAutoSend)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                                config.emailAutoSend ? 'bg-green-500' : 'bg-muted'
                                            }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${config.emailAutoSend ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                                        {t('page.autoProspeccaoConfig.email.templatesHint')}
                                    </p>
                                </div>
                            )}
                        </div>

                        {error && <p className="text-sm text-red-400">{error}</p>}
                        {success && <p className="text-sm text-green-400">{success}</p>}

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {t('page.autoProspeccaoConfig.saveButton')}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    );
}
