import { useState, useEffect, useMemo } from 'react';
import { User, Save, Loader2 } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { getPlanDisplayName } from '@/lib/billing-config';
import { userApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/lib/i18n';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface ProfileField {
  key: string;
  labelKey: string;
  placeholderKey: string;
  type?: 'text' | 'email';
  disabled?: boolean;
}

const FIELD_DEFS: ProfileField[] = [
  { key: 'name', labelKey: 'page.perfil.field.name', placeholderKey: 'page.perfil.placeholder.name' },
  { key: 'email', labelKey: 'page.perfil.field.email', placeholderKey: 'page.perfil.placeholder.email', type: 'email', disabled: true },
  { key: 'phone', labelKey: 'page.perfil.field.phone', placeholderKey: 'page.perfil.placeholder.phone' },
  { key: 'address', labelKey: 'page.perfil.field.address', placeholderKey: 'page.perfil.placeholder.address' },
  { key: 'linkedInUrl', labelKey: 'page.perfil.field.linkedin', placeholderKey: 'page.perfil.placeholder.linkedin' },
  { key: 'instagramUrl', labelKey: 'page.perfil.field.instagram', placeholderKey: 'page.perfil.placeholder.instagram' },
  { key: 'facebookUrl', labelKey: 'page.perfil.field.facebook', placeholderKey: 'page.perfil.placeholder.facebook' },
  { key: 'websiteUrl', labelKey: 'page.perfil.field.website', placeholderKey: 'page.perfil.placeholder.website' },
  { key: 'image', labelKey: 'page.perfil.field.image', placeholderKey: 'page.perfil.placeholder.image' },
];

function getProfileFields(t: TranslateFn) {
  return FIELD_DEFS.map((field) => ({
    ...field,
    label: t(field.labelKey),
    placeholder: t(field.placeholderKey),
  }));
}

export default function PerfilPage() {
  const { t } = useI18n();
  const fields = useMemo(() => getProfileFields(t), [t]);
  const { user } = useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      address: user.address ?? '',
      linkedInUrl: user.linkedInUrl ?? '',
      instagramUrl: user.instagramUrl ?? '',
      facebookUrl: user.facebookUrl ?? '',
      websiteUrl: user.websiteUrl ?? '',
      image: user.image ?? '',
    });
  }, [user]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userApi.updateProfile({
        name: form.name || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        linkedInUrl: form.linkedInUrl || undefined,
        instagramUrl: form.instagramUrl || undefined,
        facebookUrl: form.facebookUrl || undefined,
        websiteUrl: form.websiteUrl || undefined,
        image: form.image || undefined,
      });
      window.dispatchEvent(new Event('refresh-user'));
      addToast('success', t('page.perfil.toast.saved'));
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : t('page.perfil.toast.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <HeaderDashboard
        title={t('page.perfil.title')}
        subtitle={t('page.perfil.subtitle')}
        breadcrumb={t('page.perfil.breadcrumb')}
      />
      <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full">
        <form onSubmit={handleSave} className="rounded-3xl bg-card border border-border p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-border">
            {form.image ? (
              <img
                src={form.image}
                alt=""
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover border border-violet-500/20"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <User size={24} className="text-violet-600 dark:text-violet-400" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-foreground">{user.name || t('page.perfil.defaultUser')}</h2>
              <p className="text-xs text-muted">
                {t('page.perfil.plan')} <span className="text-violet-600 dark:text-violet-400 font-bold">{getPlanDisplayName(user.plan)}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {fields.map((field) => (
              <div
                key={field.key}
                className={field.key === 'address' || field.key === 'image' ? 'md:col-span-2' : ''}
              >
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  {field.label}
                </label>
                <input
                  type={field.type || 'text'}
                  value={form[field.key] ?? ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                  className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              className="min-h-[48px] px-8 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25 border-0 transition-all hover:-translate-y-0.5"
            >
              {saving ? t('page.perfil.saving') : t('page.perfil.save')}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
