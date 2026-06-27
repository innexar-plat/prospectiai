import { useState, useEffect, useMemo } from 'react';
import { Building2, Save, Loader2, Search, MapPinned } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { searchApi, workspaceProfileApi, type WorkspaceProfile } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { getStatesByCountry } from '@/lib/locationData';
import { getActiveMarket, getMarketConfig } from '@/lib/market';
import { fetchAddressByCep, formatCnpj, formatPostalCode, normalizeCnpj, normalizePostalCode, toOptionalInteger, toOptionalNumber } from '@/lib/company-profile';
import { useI18n } from '@/lib/i18n';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type CompanyProfileFormState = {
  [K in keyof WorkspaceProfile]: string;
};

const emptyProfile: CompanyProfileFormState = {
  companyName: '',
  legalName: '',
  tradeName: '',
  cnpj: '',
  primaryCnaeCode: '',
  primaryCnaeDescription: '',
  companySize: '',
  foundingDate: '',
  productService: '',
  targetAudience: '',
  mainBenefit: '',
  address: '',
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  linkedInUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  websiteUrl: '',
  logoUrl: '',
  serviceModel: '',
  averageTicket: '',
  operationRadiusKm: '',
  knownCompetitors: '',
};

function profileToForm(profile: WorkspaceProfile): CompanyProfileFormState {
  return {
    companyName: profile.companyName ?? '',
    legalName: profile.legalName ?? '',
    tradeName: profile.tradeName ?? '',
    cnpj: profile.cnpj ? formatCnpj(profile.cnpj) : '',
    primaryCnaeCode: profile.primaryCnaeCode ?? '',
    primaryCnaeDescription: profile.primaryCnaeDescription ?? '',
    companySize: profile.companySize ?? '',
    foundingDate: profile.foundingDate ?? '',
    productService: profile.productService ?? '',
    targetAudience: profile.targetAudience ?? '',
    mainBenefit: profile.mainBenefit ?? '',
    address: profile.address ?? '',
    postalCode: profile.postalCode ? formatPostalCode(profile.postalCode) : '',
    street: profile.street ?? '',
    number: profile.number ?? '',
    complement: profile.complement ?? '',
    neighborhood: profile.neighborhood ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    linkedInUrl: profile.linkedInUrl ?? '',
    instagramUrl: profile.instagramUrl ?? '',
    facebookUrl: profile.facebookUrl ?? '',
    websiteUrl: profile.websiteUrl ?? '',
    logoUrl: profile.logoUrl ?? '',
    serviceModel: profile.serviceModel ?? '',
    averageTicket: profile.averageTicket != null ? String(profile.averageTicket) : '',
    operationRadiusKm: profile.operationRadiusKm != null ? String(profile.operationRadiusKm) : '',
    knownCompetitors: profile.knownCompetitors ?? '',
  };
}

function getProfileLoadErrorMessage(err: unknown, t: TranslateFn): string {
  const msg = err instanceof Error ? err.message : '';
  return msg.includes('404') || msg.includes('Not Found')
    ? t('page.empresaPerfil.toast.loadNotFound')
    : t('page.empresaPerfil.toast.loadError');
}

function buildAddressSummary(form: CompanyProfileFormState): string {
  return [form.street, form.number, form.complement, form.neighborhood, form.city, form.state].filter(Boolean).join(', ');
}

function EmpresaPerfilForm({
  t,
  form,
  saving,
  loadingCnpj,
  loadingPostalCode,
  citySuggestions,
  stateOptions,
  onChange,
  onLookupCnpj,
  onLookupPostalCode,
  onSave,
}: {
  t: TranslateFn;
  form: CompanyProfileFormState;
  saving: boolean;
  loadingCnpj: boolean;
  loadingPostalCode: boolean;
  citySuggestions: string[];
  stateOptions: readonly { value: string; label: string }[];
  onChange: (key: keyof WorkspaceProfile, value: string) => void;
  onLookupCnpj: () => void;
  onLookupPostalCode: () => void;
  onSave: (e: React.SyntheticEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSave} className="rounded-3xl bg-card border border-border p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-4 pb-4 border-b border-border">
        {form.logoUrl ? (
          <img src={form.logoUrl} alt={t('page.empresaPerfil.logoAlt')} className="w-14 h-14 rounded-2xl object-cover border border-violet-500/20" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Building2 size={24} className="text-violet-600 dark:text-violet-400" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-foreground">{form.companyName || t('page.empresaPerfil.defaultName')}</h2>
          <p className="text-xs text-muted">{t('page.empresaPerfil.workspaceShared')}</p>
        </div>
      </div>
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.empresaPerfil.section.identification')}</h3>
          <p className="text-xs text-muted mt-1">{t('page.empresaPerfil.section.identificationDesc')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.cnpj')}</label>
            <div className="flex gap-2">
              <input value={form.cnpj} onChange={(e) => onChange('cnpj', formatCnpj(e.target.value))} placeholder={t('page.empresaPerfil.placeholder.cnpj')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
              <Button type="button" variant="secondary" onClick={onLookupCnpj} disabled={loadingCnpj} icon={loadingCnpj ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>{t('page.empresaPerfil.lookupCnpj')}</Button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.companyName')}</label>
            <input value={form.companyName} onChange={(e) => onChange('companyName', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.companyName')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.legalName')}</label>
            <input value={form.legalName} onChange={(e) => onChange('legalName', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.legalName')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.tradeName')}</label>
            <input value={form.tradeName} onChange={(e) => onChange('tradeName', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.tradeName')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.cnaeCode')}</label>
            <input value={form.primaryCnaeCode} onChange={(e) => onChange('primaryCnaeCode', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.cnaeCode')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.cnaeDesc')}</label>
            <input value={form.primaryCnaeDescription} onChange={(e) => onChange('primaryCnaeDescription', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.cnaeDesc')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.companySize')}</label>
            <input value={form.companySize} onChange={(e) => onChange('companySize', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.companySize')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.foundingDate')}</label>
            <input value={form.foundingDate} onChange={(e) => onChange('foundingDate', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.foundingDate')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.empresaPerfil.section.offer')}</h3>
          <p className="text-xs text-muted mt-1">{t('page.empresaPerfil.section.offerDesc')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.productService')}</label>
            <input value={form.productService} onChange={(e) => onChange('productService', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.productService')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.serviceModel')}</label>
            <select value={form.serviceModel} onChange={(e) => onChange('serviceModel', e.target.value)} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors">
              <option value="">{t('page.empresaPerfil.select')}</option>
              <option value="presencial">{t('page.empresaPerfil.serviceModel.presencial')}</option>
              <option value="remoto">{t('page.empresaPerfil.serviceModel.remoto')}</option>
              <option value="hibrido">{t('page.empresaPerfil.serviceModel.hibrido')}</option>
              <option value="delivery">{t('page.empresaPerfil.serviceModel.delivery')}</option>
              <option value="visita_tecnica">{t('page.empresaPerfil.serviceModel.visita_tecnica')}</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.targetAudience')}</label>
            <textarea value={form.targetAudience} onChange={(e) => onChange('targetAudience', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.targetAudience')} rows={3} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.mainBenefit')}</label>
            <textarea value={form.mainBenefit} onChange={(e) => onChange('mainBenefit', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.mainBenefit')} rows={3} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.averageTicket')}</label>
            <input value={form.averageTicket} onChange={(e) => onChange('averageTicket', e.target.value)} inputMode="decimal" placeholder={t('page.empresaPerfil.placeholder.averageTicket')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.operationRadius')}</label>
            <input value={form.operationRadiusKm} onChange={(e) => onChange('operationRadiusKm', e.target.value)} inputMode="numeric" placeholder={t('page.empresaPerfil.placeholder.operationRadius')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.knownCompetitors')}</label>
            <textarea value={form.knownCompetitors} onChange={(e) => onChange('knownCompetitors', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.knownCompetitors')} rows={3} className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.empresaPerfil.section.address')}</h3>
          <p className="text-xs text-muted mt-1">{t('page.empresaPerfil.section.addressDesc')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.postalCode')}</label>
            <div className="flex gap-2">
              <input value={form.postalCode} onChange={(e) => onChange('postalCode', formatPostalCode(e.target.value))} placeholder={t('page.empresaPerfil.placeholder.postalCode')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
              <Button type="button" variant="secondary" onClick={onLookupPostalCode} disabled={loadingPostalCode} icon={loadingPostalCode ? <Loader2 size={16} className="animate-spin" /> : <MapPinned size={16} />}>{t('page.empresaPerfil.lookupCep')}</Button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.addressSummary')}</label>
            <input value={form.address} onChange={(e) => onChange('address', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.addressSummary')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.street')}</label>
              <input value={form.street} onChange={(e) => onChange('street', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.street')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.number')}</label>
              <input value={form.number} onChange={(e) => onChange('number', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.number')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.complement')}</label>
              <input value={form.complement} onChange={(e) => onChange('complement', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.complement')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.neighborhood')}</label>
            <input value={form.neighborhood} onChange={(e) => onChange('neighborhood', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.neighborhood')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.state')}</label>
            <select value={form.state} onChange={(e) => onChange('state', e.target.value)} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors">
              <option value="">{t('page.empresaPerfil.selectState')}</option>
              {stateOptions.map((state) => (
                <option key={state.value} value={state.value}>{state.label} ({state.value})</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.city')}</label>
            <input value={form.city} onChange={(e) => onChange('city', e.target.value)} list="empresa-cidades" placeholder={form.state ? t('page.empresaPerfil.placeholder.city') : t('page.empresaPerfil.placeholder.citySelectState')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
            <datalist id="empresa-cidades">
              {citySuggestions.map((city) => <option key={city} value={city} />)}
            </datalist>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.empresaPerfil.section.digital')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.linkedIn')}</label>
            <input value={form.linkedInUrl} onChange={(e) => onChange('linkedInUrl', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.linkedIn')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.instagram')}</label>
            <input value={form.instagramUrl} onChange={(e) => onChange('instagramUrl', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.instagram')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.facebook')}</label>
            <input value={form.facebookUrl} onChange={(e) => onChange('facebookUrl', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.facebook')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.website')}</label>
            <input value={form.websiteUrl} onChange={(e) => onChange('websiteUrl', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.website')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">{t('page.empresaPerfil.label.logoUrl')}</label>
            <input value={form.logoUrl} onChange={(e) => onChange('logoUrl', e.target.value)} placeholder={t('page.empresaPerfil.placeholder.logoUrl')} className="w-full h-11 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors" />
          </div>
        </div>
      </section>
      <div className="flex justify-end pt-4 border-t border-border">
        <Button
          type="submit"
          variant="primary"
          disabled={saving}
          icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          className="min-h-[48px] px-8 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25 border-0 transition-all hover:-translate-y-0.5"
        >
          {saving ? t('page.empresaPerfil.saving') : t('page.empresaPerfil.save')}
        </Button>
      </div>
    </form>
  );
}

export default function EmpresaPerfilPage() {
  useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();
  const { t } = useI18n();
  const market = getActiveMarket();
  const profileCountry = getMarketConfig(market).defaultCountry;
  const stateOptions = useMemo(
    () => getStatesByCountry(profileCountry).filter((state) => state.value !== 'Todos'),
    [profileCountry],
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingPostalCode, setLoadingPostalCode] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [form, setForm] = useState<CompanyProfileFormState>(emptyProfile);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    workspaceProfileApi
      .get()
      .then((profile) => {
        if (!cancelled) setForm(profileToForm(profile));
      })
      .catch((err: unknown) => {
        if (!cancelled) addToast('error', getProfileLoadErrorMessage(err, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [addToast]);

  const handleChange = (key: keyof WorkspaceProfile, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'street' || key === 'number' || key === 'neighborhood' || key === 'city' || key === 'state') {
        next.address = buildAddressSummary(next);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!form.state || form.city.trim().length < 3) {
      setCitySuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      searchApi.citySuggestions({ state: form.state, country: profileCountry, q: form.city.trim() })
        .then((res) => {
          if (!cancelled) setCitySuggestions(res.cities ?? []);
        })
        .catch(() => {
          if (!cancelled) setCitySuggestions([]);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [form.city, form.state, profileCountry]);

  const handleLookupCnpj = async () => {
    const cnpj = normalizeCnpj(form.cnpj);
    if (cnpj.length !== 14) {
      addToast('error', t('page.empresaPerfil.toast.cnpjInvalid'));
      return;
    }

    setLoadingCnpj(true);
    try {
      const data = await workspaceProfileApi.lookupCnpj(cnpj);
      setForm((prev) => {
        const next = {
          ...prev,
          cnpj: formatCnpj(data.cnpj),
          legalName: data.legalName ?? prev.legalName,
          tradeName: data.tradeName ?? prev.tradeName,
          companyName: data.tradeName ?? data.legalName ?? prev.companyName,
          primaryCnaeCode: data.primaryCnaeCode ?? prev.primaryCnaeCode,
          primaryCnaeDescription: data.primaryCnaeDescription ?? prev.primaryCnaeDescription,
          companySize: data.companySize ?? prev.companySize,
          foundingDate: data.foundingDate ?? prev.foundingDate,
          postalCode: data.postalCode ? formatPostalCode(data.postalCode) : prev.postalCode,
          street: data.street ?? prev.street,
          number: data.number ?? prev.number,
          neighborhood: data.neighborhood ?? prev.neighborhood,
          city: data.city ?? prev.city,
          state: data.state ?? prev.state,
        };
        next.address = buildAddressSummary(next) || data.address || prev.address;
        return next;
      });
      addToast('success', t('page.empresaPerfil.toast.cnpjFilled'));
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : t('page.empresaPerfil.toast.cnpjError'));
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleLookupPostalCode = async () => {
    const postalCode = normalizePostalCode(form.postalCode);
    if (postalCode.length !== 8) {
      addToast('error', t('page.empresaPerfil.toast.cepInvalid'));
      return;
    }

    setLoadingPostalCode(true);
    try {
      const data = await fetchAddressByCep(postalCode);
      setForm((prev) => {
        const next = {
          ...prev,
          postalCode: data.postalCode,
          street: data.street || prev.street,
          complement: data.complement || prev.complement,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
          state: data.state || prev.state,
        };
        next.address = buildAddressSummary(next);
        return next;
      });
      addToast('success', t('page.empresaPerfil.toast.cepFilled'));
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : t('page.empresaPerfil.toast.cepError'));
    } finally {
      setLoadingPostalCode(false);
    }
  };

  const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await workspaceProfileApi.update({
        companyName: form.companyName || undefined,
        legalName: form.legalName || undefined,
        tradeName: form.tradeName || undefined,
        cnpj: normalizeCnpj(form.cnpj) || undefined,
        primaryCnaeCode: form.primaryCnaeCode || undefined,
        primaryCnaeDescription: form.primaryCnaeDescription || undefined,
        companySize: form.companySize || undefined,
        foundingDate: form.foundingDate || undefined,
        productService: form.productService || undefined,
        targetAudience: form.targetAudience || undefined,
        mainBenefit: form.mainBenefit || undefined,
        address: buildAddressSummary(form) || form.address || undefined,
        postalCode: normalizePostalCode(form.postalCode) || undefined,
        street: form.street || undefined,
        number: form.number || undefined,
        complement: form.complement || undefined,
        neighborhood: form.neighborhood || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        linkedInUrl: form.linkedInUrl || undefined,
        instagramUrl: form.instagramUrl || undefined,
        facebookUrl: form.facebookUrl || undefined,
        websiteUrl: form.websiteUrl || undefined,
        logoUrl: form.logoUrl || undefined,
        serviceModel: form.serviceModel || undefined,
        averageTicket: toOptionalNumber(form.averageTicket),
        operationRadiusKm: toOptionalInteger(form.operationRadiusKm),
        knownCompetitors: form.knownCompetitors || undefined,
      });
      window.dispatchEvent(new Event('refresh-user'));
      addToast('success', t('page.empresaPerfil.toast.saved'));
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : t('page.empresaPerfil.toast.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <HeaderDashboard
          title={t('page.empresaPerfil.title')}
          subtitle={t('page.empresaPerfil.subtitleLoading')}
          breadcrumb={t('page.empresaPerfil.breadcrumb')}
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
        title={t('page.empresaPerfil.title')}
        subtitle={t('page.empresaPerfil.subtitle')}
        breadcrumb={t('page.empresaPerfil.breadcrumb')}
      />
      <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full">
        <EmpresaPerfilForm form={form} saving={saving} loadingCnpj={loadingCnpj} loadingPostalCode={loadingPostalCode} citySuggestions={citySuggestions} stateOptions={stateOptions} onChange={handleChange} onLookupCnpj={handleLookupCnpj} onLookupPostalCode={handleLookupPostalCode} onSave={handleSave} t={t} />
      </div>
    </>
  );
}
