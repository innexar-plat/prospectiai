import { useState, useEffect } from 'react';
import { Bell, Shield, AlertTriangle, Plug, Lock, Eye, EyeOff } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Link, useOutletContext } from 'react-router-dom';
import { userApi, type SessionUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/lib/i18n';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export default function ConfiguracoesPage() {
  const { t } = useI18n();
  const { user } = useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();

  const [emailNotifs, setEmailNotifs] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEmailNotifs(user.notifyByEmail ?? true);
    }
  }, [user]);

  const savePref = async (value: boolean) => {
    setSaving(true);
    try {
      await userApi.updateProfile({ notifyByEmail: value });
      addToast('success', t('page.configuracoes.toast.prefSaved'));
    } catch {
      addToast('error', t('page.configuracoes.toast.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <HeaderDashboard title={t('page.configuracoes.title')} subtitle={t('page.configuracoes.subtitle')} breadcrumb={t('page.configuracoes.breadcrumb')} />
      <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full space-y-6">

        <div className="rounded-3xl bg-card border border-border p-6 space-y-5">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Bell size={16} className="text-violet-600 dark:text-violet-400" /> {t('page.configuracoes.notifications')}
          </h3>
          <div className="space-y-4">
            <ToggleRow
              label={t('page.configuracoes.emailNotifs')}
              description={t('page.configuracoes.emailNotifsDesc')}
              enabled={emailNotifs}
              disabled={saving}
              onToggle={() => {
                const next = !emailNotifs;
                setEmailNotifs(next);
                savePref(next).catch(() => {});
              }}
              t={t}
            />
          </div>
        </div>

        <div className="rounded-3xl bg-card border border-border p-6 space-y-5">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Shield size={16} className="text-emerald-600 dark:text-emerald-400" /> {t('page.configuracoes.security')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-foreground">{t('page.configuracoes.twoFactor')}</p>
                <p className="text-xs text-muted mt-0.5">
                  {user.twoFactorEnabled ? t('page.configuracoes.twoFactorActive') : t('page.configuracoes.twoFactorInactive')}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${user.twoFactorEnabled ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-surface text-muted border border-border'}`}>
                {user.twoFactorEnabled ? t('page.configuracoes.statusActive') : t('page.configuracoes.statusInactive')}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-foreground">{t('page.configuracoes.emailVerified')}</p>
                <p className="text-xs text-muted mt-0.5">{user.email}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                {t('page.configuracoes.verified')}
              </span>
            </div>
          </div>
        </div>

        <ChangePasswordSection t={t} />

        <div className="rounded-3xl bg-card border border-border p-6 space-y-5">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Plug size={16} className="text-violet-600 dark:text-violet-400" /> {t('page.configuracoes.integrations')}
          </h3>
          <p className="text-xs text-muted">
            {t('page.configuracoes.integrationsDesc')}
          </p>
          <Link to="/dashboard/integracoes" className="inline-flex">
            <Button variant="secondary" size="sm">{t('page.configuracoes.openIntegrations')}</Button>
          </Link>
        </div>

        <div className="rounded-3xl bg-card border border-rose-500/20 p-6 space-y-4">
          <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle size={16} /> {t('page.configuracoes.dangerZone')}
          </h3>
          <p className="text-xs text-muted">
            {t('page.configuracoes.deleteAccountDesc')}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            onClick={() => addToast('error', t('page.configuracoes.toast.comingSoon'))}
          >
            {t('page.configuracoes.deleteAccount')}
          </Button>
        </div>
      </div>
    </>
  );
}

function ToggleRow({ label, description, enabled, disabled, onToggle, t }: {
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
  t: TranslateFn;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`relative w-10 h-6 rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-surface border border-border'} disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={`${enabled ? t('common.deactivate') : t('common.activate')} ${label}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function ChangePasswordSection({ t }: { t: TranslateFn }) {
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      addToast('error', t('page.configuracoes.toast.passwordMin'));
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('error', t('page.configuracoes.toast.passwordMismatch'));
      return;
    }
    setSaving(true);
    try {
      await userApi.changePassword({ currentPassword, newPassword });
      addToast('success', t('page.configuracoes.toast.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('page.configuracoes.toast.passwordError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl bg-card border border-border p-6 space-y-5">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Lock size={16} className="text-violet-600 dark:text-violet-400" /> {t('page.configuracoes.changePassword')}
      </h3>
      <p className="text-xs text-muted">
        {t('page.configuracoes.socialLoginNote')}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t('page.configuracoes.currentPassword')}</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground pr-10 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t('page.configuracoes.newPassword')}</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground pr-10 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-muted mt-1">{t('page.configuracoes.passwordMinHint')}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t('page.configuracoes.confirmPassword')}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <Button type="submit" size="sm" disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
          {saving ? t('page.configuracoes.saving') : t('page.configuracoes.savePassword')}
        </Button>
      </form>
    </div>
  );
}
