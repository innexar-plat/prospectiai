import { useState, useEffect } from 'react';
import { Building2, Save, Loader2 } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { workspaceProfileApi, type WorkspaceProfile } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

interface ProfileField {
  key: keyof WorkspaceProfile;
  label: string;
  placeholder: string;
  fullWidth?: boolean;
}

const FIELDS: ProfileField[] = [
  { key: 'companyName', label: 'Nome da Empresa', placeholder: 'Minha Empresa LTDA' },
  { key: 'productService', label: 'Produto / Serviço', placeholder: 'Consultoria de marketing digital' },
  { key: 'targetAudience', label: 'Público-Alvo', placeholder: 'Pequenos negócios locais sem presença digital', fullWidth: true },
  { key: 'mainBenefit', label: 'Principal Benefício', placeholder: 'Aumentar vendas com prospecção inteligente', fullWidth: true },
  { key: 'address', label: 'Endereço', placeholder: 'Rua Exemplo, 123 - Cidade', fullWidth: true },
  { key: 'linkedInUrl', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/sua-empresa' },
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://instagram.com/sua-empresa' },
  { key: 'facebookUrl', label: 'Facebook', placeholder: 'https://facebook.com/sua-empresa' },
  { key: 'websiteUrl', label: 'Site', placeholder: 'https://suaempresa.com' },
  { key: 'logoUrl', label: 'URL do logo', placeholder: 'https://exemplo.com/logo.png', fullWidth: true },
];

const emptyProfile: Record<keyof WorkspaceProfile, string> = {
  companyName: '',
  productService: '',
  targetAudience: '',
  mainBenefit: '',
  address: '',
  linkedInUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  websiteUrl: '',
  logoUrl: '',
};

export default function EmpresaPerfilPage() {
  useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<keyof WorkspaceProfile, string>>(emptyProfile);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    workspaceProfileApi
      .get()
      .then((profile) => {
        if (!cancelled) {
          setForm({
            companyName: profile.companyName ?? '',
            productService: profile.productService ?? '',
            targetAudience: profile.targetAudience ?? '',
            mainBenefit: profile.mainBenefit ?? '',
            address: profile.address ?? '',
            linkedInUrl: profile.linkedInUrl ?? '',
            instagramUrl: profile.instagramUrl ?? '',
            facebookUrl: profile.facebookUrl ?? '',
            websiteUrl: profile.websiteUrl ?? '',
            logoUrl: profile.logoUrl ?? '',
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('404') || msg.includes('Not Found')) {
          addToast('error', 'Recurso não encontrado. Faça o deploy da versão mais recente do backend.');
        } else {
          addToast('error', 'Não foi possível carregar o perfil da empresa.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const handleChange = (key: keyof WorkspaceProfile, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await workspaceProfileApi.update({
        companyName: form.companyName || undefined,
        productService: form.productService || undefined,
        targetAudience: form.targetAudience || undefined,
        mainBenefit: form.mainBenefit || undefined,
        address: form.address || undefined,
        linkedInUrl: form.linkedInUrl || undefined,
        instagramUrl: form.instagramUrl || undefined,
        facebookUrl: form.facebookUrl || undefined,
        websiteUrl: form.websiteUrl || undefined,
        logoUrl: form.logoUrl || undefined,
      });
      window.dispatchEvent(new Event('refresh-user'));
      addToast('success', 'Perfil da empresa atualizado com sucesso!');
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <HeaderDashboard
          title="Perfil da Empresa"
          subtitle="Dados do seu negócio e redes sociais."
          breadcrumb="Dashboard / Empresa"
        />
        <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full flex items-center justify-center min-h-[200px]">
          <Loader2 size={32} className="animate-spin text-muted" />
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderDashboard
        title="Perfil da Empresa"
        subtitle="Dados do seu negócio, endereço e redes sociais."
        breadcrumb="Dashboard / Empresa"
      />
      <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full">
        <form onSubmit={handleSave} className="rounded-3xl bg-card border border-border p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-border">
            {form.logoUrl ? (
              <img
                src={form.logoUrl}
                alt="Logo"
                className="w-14 h-14 rounded-2xl object-cover border border-violet-500/20"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Building2 size={24} className="text-violet-400" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-foreground">{form.companyName || 'Empresa'}</h2>
              <p className="text-xs text-muted">Workspace compartilhado com sua equipe</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FIELDS.map((field) => (
              <div
                key={field.key}
                className={field.fullWidth ? 'md:col-span-2' : ''}
              >
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={form[field.key] ?? ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors"
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
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
