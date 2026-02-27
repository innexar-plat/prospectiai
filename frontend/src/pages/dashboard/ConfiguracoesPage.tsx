import { useState, useEffect } from 'react';
import { Bell, Shield, AlertTriangle } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import { userApi, type SessionUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

export default function ConfiguracoesPage() {
  const { user } = useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();

  const [emailNotifs, setEmailNotifs] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [leadAlerts, setLeadAlerts] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEmailNotifs(user.notifyByEmail ?? true);
      setWeeklyReport(user.notifyWeeklyReport ?? false);
      setLeadAlerts(user.notifyLeadAlerts ?? false);
    }
  }, [user]);

  const savePref = async (field: 'notifyByEmail' | 'notifyWeeklyReport' | 'notifyLeadAlerts', value: boolean) => {
    setSaving(true);
    try {
      await userApi.updateProfile({ [field]: value });
      addToast('success', 'Preferência salva!');
    } catch {
      addToast('error', 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <HeaderDashboard title="Configurações" subtitle="Notificações, segurança e preferências." breadcrumb="Conta / Configurações" />
      <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full space-y-6">

        {/* Notifications */}
        <div className="rounded-3xl bg-card border border-border p-6 space-y-5">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Bell size={16} className="text-violet-400" /> Notificações
          </h3>

          <div className="space-y-4">
            <ToggleRow
              label="Notificações por email"
              description="Receba atualizações sobre sua conta e novos recursos."
              enabled={emailNotifs}
              disabled={saving}
              onToggle={() => {
                const next = !emailNotifs;
                setEmailNotifs(next);
                void savePref('notifyByEmail', next);
              }}
            />
            <ToggleRow
              label="Relatório semanal"
              description="Receba um resumo semanal com suas métricas de prospecção."
              enabled={weeklyReport}
              disabled={saving}
              onToggle={() => {
                const next = !weeklyReport;
                setWeeklyReport(next);
                void savePref('notifyWeeklyReport', next);
              }}
            />
            <ToggleRow
              label="Alertas de leads"
              description="Seja notificado quando novos leads forem encontrados na sua região."
              enabled={leadAlerts}
              disabled={saving}
              onToggle={() => {
                const next = !leadAlerts;
                setLeadAlerts(next);
                void savePref('notifyLeadAlerts', next);
              }}
            />
          </div>
        </div>

        {/* Security */}
        <div className="rounded-3xl bg-card border border-border p-6 space-y-5">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Shield size={16} className="text-emerald-400" /> Segurança
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-foreground">Autenticação em dois fatores</p>
                <p className="text-xs text-muted mt-0.5">
                  {user.twoFactorEnabled ? 'Ativo — sua conta está protegida' : 'Desativado'}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${user.twoFactorEnabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-surface text-muted border border-border'}`}>
                {user.twoFactorEnabled ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-foreground">Email verificado</p>
                <p className="text-xs text-muted mt-0.5">{user.email}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Verificado
              </span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-3xl bg-card border border-rose-500/20 p-6 space-y-4">
          <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle size={16} /> Zona de Perigo
          </h3>
          <p className="text-xs text-muted">
            Ao excluir sua conta, todos os seus dados, leads, análises e histórico serão permanentemente removidos.
            Esta ação não pode ser desfeita.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            onClick={() => addToast('error', 'Funcionalidade disponível em breve.')}
          >
            Excluir minha conta
          </Button>
        </div>
      </div>
    </>
  );
}

function ToggleRow({ label, description, enabled, disabled, onToggle }: {
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
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
        aria-label={`${enabled ? 'Desativar' : 'Ativar'} ${label}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
