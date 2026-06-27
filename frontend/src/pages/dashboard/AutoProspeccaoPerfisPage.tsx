import { useState, useEffect, useCallback } from 'react';
import {
    Loader2, AlertCircle, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { EmptyState } from '@/components/dashboard/shared/DashboardUI';
import type { AutoProspProfile } from '@/lib/api';
import { autoProspApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/locale';

const DATE_LOCALE: Record<SupportedLocale, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const PORTE_OPTIONS = ['ME', 'EPP', 'DEMAIS', 'NAO_INFORMADO'] as const;

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface ProfileFormData {
    name: string;
    description: string;
    cnae: string;
    cnaeList: string;
    uf: string[];
    porte: string[];
    hasEmail: '' | 'true' | 'false';
    minCapital: string;
    priority: string;
}

const EMPTY_FORM: ProfileFormData = {
    name: '', description: '', cnae: '', cnaeList: '', uf: [], porte: [],
    hasEmail: '', minCapital: '', priority: '1',
};

function profileToForm(p: AutoProspProfile): ProfileFormData {
    return {
        name: p.name,
        description: p.description ?? '',
        cnae: p.cnae ?? '',
        cnaeList: (p.cnaeList ?? []).join(', '),
        uf: p.uf ?? [],
        porte: p.porte ?? [],
        hasEmail: p.hasEmail == null ? '' : p.hasEmail ? 'true' : 'false',
        minCapital: '',
        priority: '1',
    };
}

function MultiSelect({ label, options, value, onChange }: {
    label: string;
    options: string[];
    value: string[];
    onChange: (v: string[]) => void;
}) {
    const toggle = (opt: string) => {
        onChange(value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt]);
    };
    return (
        <div>
            <label className="block text-xs text-muted-foreground mb-1">{label}</label>
            <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => toggle(opt)}
                        className={`px-2 py-0.5 rounded text-xs border transition ${
                            value.includes(opt)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border hover:bg-muted/60'
                        }`}
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
}

interface ProfileModalProps {
    editing: AutoProspProfile | null;
    onClose: () => void;
    onSaved: () => void;
    t: TranslateFn;
}

function ProfileModal({ editing, onClose, onSaved, t }: ProfileModalProps) {
    const [form, setForm] = useState<ProfileFormData>(editing ? profileToForm(editing) : EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const set = (field: keyof ProfileFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm((f) => ({ ...f, [field]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setErr(t('page.autoProspeccaoPerfis.form.nameRequired')); return; }
        setSaving(true);
        setErr('');
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                cnae: form.cnae.trim() || null,
                cnaeList: form.cnaeList ? form.cnaeList.split(',').map((s) => s.trim()).filter(Boolean) : null,
                uf: form.uf.length ? form.uf : null,
                porte: form.porte.length ? form.porte : null,
                hasEmail: form.hasEmail === '' ? null : form.hasEmail === 'true',
                priority: Number(form.priority) || 1,
            };
            if (editing) {
                await autoProspApi.updateProfile(editing.id, payload);
            } else {
                await autoProspApi.createProfile(payload);
            }
            onSaved();
            onClose();
        } catch (e) {
            setErr(e instanceof Error ? e.message : t('page.autoProspeccaoPerfis.form.saveError'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="bg-background border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold">
                        {editing ? t('page.autoProspeccaoPerfis.modal.editTitle') : t('page.autoProspeccaoPerfis.modal.createTitle')}
                    </h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoPerfis.form.name')}</label>
                        <input
                            value={form.name}
                            onChange={set('name')}
                            placeholder={t('page.autoProspeccaoPerfis.form.namePlaceholder')}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoPerfis.form.description')}</label>
                        <textarea
                            value={form.description}
                            onChange={set('description')}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoPerfis.form.cnae')}</label>
                        <input
                            value={form.cnae}
                            onChange={set('cnae')}
                            placeholder={t('page.autoProspeccaoPerfis.form.cnaePlaceholder')}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoPerfis.form.cnaeList')}</label>
                        <input
                            value={form.cnaeList}
                            onChange={set('cnaeList')}
                            placeholder={t('page.autoProspeccaoPerfis.form.cnaeListPlaceholder')}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <MultiSelect
                        label={t('page.autoProspeccaoPerfis.form.uf')}
                        options={UF_OPTIONS}
                        value={form.uf}
                        onChange={(v) => setForm((f) => ({ ...f, uf: v }))}
                    />

                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoPerfis.form.porte')}</label>
                        <div className="flex flex-wrap gap-2">
                            {PORTE_OPTIONS.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                        const cur = form.porte;
                                        setForm((f) => ({
                                            ...f,
                                            porte: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt],
                                        }));
                                    }}
                                    className={`px-2 py-0.5 rounded text-xs border transition ${
                                        form.porte.includes(opt)
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'border-border hover:bg-muted/60'
                                    }`}
                                >
                                    {t(`page.autoProspeccaoPerfis.porte.${opt}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoPerfis.form.hasEmail')}</label>
                        <select
                            value={form.hasEmail}
                            onChange={set('hasEmail')}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="">{t('page.autoProspeccaoPerfis.form.emailNone')}</option>
                            <option value="true">{t('page.autoProspeccaoPerfis.form.emailYes')}</option>
                            <option value="false">{t('page.autoProspeccaoPerfis.form.emailNo')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">{t('page.autoProspeccaoPerfis.form.priority')}</label>
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={form.priority}
                            onChange={set('priority')}
                            className="w-24 px-3 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    {err && <p className="text-xs text-red-400">{err}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/60 transition">
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {editing ? t('common.save') : t('page.autoProspeccaoPerfis.form.create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface ProfileCardProps {
    profile: AutoProspProfile;
    readonly?: boolean;
    onToggle: (id: string) => void;
    onEdit?: (p: AutoProspProfile) => void;
    onDelete?: (id: string) => void;
    t: TranslateFn;
    dateLocale: string;
}

function ProfileCard({ profile, readonly = false, onToggle, onEdit, onDelete, t, dateLocale }: ProfileCardProps) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="rounded-xl border border-border bg-card">
            <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{profile.name}</span>
                        {profile.isSystem && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 flex-shrink-0">{t('page.autoProspeccaoPerfis.badge.system')}</span>
                        )}
                    </div>
                    {profile.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{profile.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{t('page.autoProspeccaoPerfis.stats.found')}: <strong>{profile.totalFound}</strong></span>
                        <span>{t('page.autoProspeccaoPerfis.stats.hot')}: <strong>{profile.totalHot}</strong></span>
                        {profile.lastRunAt && (
                            <span>{t('page.autoProspeccaoPerfis.stats.lastRun')}: {new Date(profile.lastRunAt).toLocaleDateString(dateLocale)}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => onToggle(profile.id)}
                        className="text-muted-foreground hover:text-foreground transition"
                        title={profile.isActive ? t('page.autoProspeccaoPerfis.toggleActive') : t('page.autoProspeccaoPerfis.toggleInactive')}
                    >
                        {profile.isActive
                            ? <ToggleRight className="w-6 h-6 text-green-400" />
                            : <ToggleLeft className="w-6 h-6" />}
                    </button>

                    {!readonly && onEdit && (
                        <button onClick={() => onEdit(profile)} className="text-muted-foreground hover:text-foreground transition" title={t('common.edit')}>
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}

                    {!readonly && onDelete && (
                        <button onClick={() => onDelete(profile.id)} className="text-muted-foreground hover:text-red-400 transition" title={t('common.delete')}>
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}

                    <button
                        onClick={() => setExpanded((x) => !x)}
                        className="text-muted-foreground hover:text-foreground transition"
                    >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-border px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    {profile.cnae && <div><span className="text-muted-foreground">{t('page.autoProspeccaoPerfis.field.cnae')}: </span>{profile.cnae}</div>}
                    {profile.cnaeList?.length && <div><span className="text-muted-foreground">{t('page.autoProspeccaoPerfis.field.list')}: </span>{profile.cnaeList.join(', ')}</div>}
                    {profile.uf?.length && <div><span className="text-muted-foreground">{t('page.autoProspeccaoPerfis.field.uf')}: </span>{profile.uf.join(', ')}</div>}
                    {profile.porte?.length && <div><span className="text-muted-foreground">{t('page.autoProspeccaoPerfis.field.porte')}: </span>{profile.porte.join(', ')}</div>}
                    {profile.hasEmail != null && <div><span className="text-muted-foreground">{t('page.autoProspeccaoPerfis.field.hasEmail')}: </span>{profile.hasEmail ? t('common.yes') : t('common.no')}</div>}
                    {profile.nextRunAt && <div><span className="text-muted-foreground">{t('page.autoProspeccaoPerfis.field.nextRun')}: </span>{new Date(profile.nextRunAt).toLocaleString(dateLocale)}</div>}
                </div>
            )}
        </div>
    );
}

export default function AutoProspeccaoPerfisPage() {
    const { t, locale } = useI18n();
    const dateLocale = DATE_LOCALE[locale];
    const [systemProfiles, setSystemProfiles] = useState<AutoProspProfile[]>([]);
    const [workspaceProfiles, setWorkspaceProfiles] = useState<AutoProspProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<AutoProspProfile | null>(null);

    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await autoProspApi.listProfiles();
            setSystemProfiles(res.data.system);
            setWorkspaceProfiles(res.data.workspace);
        } catch (e) {
            setError(e instanceof Error ? e.message : t('page.autoProspeccaoPerfis.loadError'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

    const handleToggle = async (id: string) => {
        try {
            const updated = await autoProspApi.toggleProfile(id);
            setSystemProfiles((prev) => prev.map((p) => (p.id === id ? updated.data : p)));
            setWorkspaceProfiles((prev) => prev.map((p) => (p.id === id ? updated.data : p)));
        } catch (e) {
            alert(e instanceof Error ? e.message : t('page.autoProspeccaoPerfis.toggleError'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('page.autoProspeccaoPerfis.deleteConfirm'))) return;
        try {
            await autoProspApi.deleteProfile(id);
            setWorkspaceProfiles((prev) => prev.filter((p) => p.id !== id));
        } catch (e) {
            alert(e instanceof Error ? e.message : t('page.autoProspeccaoPerfis.deleteError'));
        }
    };

    const openEdit = (p: AutoProspProfile) => {
        setEditing(p);
        setShowModal(true);
    };

    const openCreate = () => {
        setEditing(null);
        setShowModal(true);
    };

    return (
        <>
            <HeaderDashboard
                title={t('page.autoProspeccaoPerfis.title')}
                subtitle={t('page.autoProspeccaoPerfis.subtitle')}
                breadcrumb={t('page.autoProspeccaoPerfis.breadcrumb')}
            />

            <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full space-y-8">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <EmptyState icon={AlertCircle} title={t('common.error')} description={error} />
                ) : (
                    <>
                        <section>
                            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                                {t('page.autoProspeccaoPerfis.systemProfiles')}
                            </h2>
                            {systemProfiles.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t('page.autoProspeccaoPerfis.noSystemProfiles')}</p>
                            ) : (
                                <div className="space-y-3">
                                    {systemProfiles.map((p) => (
                                        <ProfileCard
                                            key={p.id}
                                            profile={p}
                                            readonly
                                            onToggle={handleToggle}
                                            t={t}
                                            dateLocale={dateLocale}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t('page.autoProspeccaoPerfis.myProfiles', { count: workspaceProfiles.length })}
                                </h2>
                                <button
                                    onClick={openCreate}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
                                >
                                    <Plus className="w-4 h-4" /> {t('page.autoProspeccaoPerfis.newProfile')}
                                </button>
                            </div>

                            {workspaceProfiles.length === 0 ? (
                                <EmptyState
                                    icon={Plus}
                                    title={t('page.autoProspeccaoPerfis.empty')}
                                    description={t('page.autoProspeccaoPerfis.emptyDesc')}
                                    actionLabel={t('page.autoProspeccaoPerfis.createProfile')}
                                    onAction={openCreate}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {workspaceProfiles.map((p) => (
                                        <ProfileCard
                                            key={p.id}
                                            profile={p}
                                            onToggle={handleToggle}
                                            onEdit={openEdit}
                                            onDelete={handleDelete}
                                            t={t}
                                            dateLocale={dateLocale}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {showModal && (
                <ProfileModal
                    editing={editing}
                    onClose={() => setShowModal(false)}
                    onSaved={fetchProfiles}
                    t={t}
                />
            )}
        </>
    );
}
