import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { X, Loader2, AlertTriangle, Zap, PencilLine, Send, Globe, Phone, MapPin, User, Hash, FileText, Share2, Target, Mail, Building2, ChevronDown, Plug } from 'lucide-react';
import type { Place, PlaceDetail, Analysis } from '@/lib/api';
import { integrationsApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CrmProvider = 'rd' | 'agendor' | 'hubspot';
type SendMode = 'contact' | 'contact_and_deal';
type FlowMode = 'auto' | 'manual';

interface CrmSidePanelProps {
  place: PlaceDetail | Place;
  analysis: Analysis | null;
  analyzing: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onWarning: (msg: string) => void;
  /** Inline compact mode for sticky action bars. */
  embed?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Address parser                                                     */
/* ------------------------------------------------------------------ */

function parseAddress(raw?: string): { city?: string; state?: string; country?: string } {
  if (!raw) return {};
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length < 3) return {};
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  const cityStateMatch = secondLast?.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
  if (cityStateMatch) {
    return { city: cityStateMatch[1].trim(), state: cityStateMatch[2].trim(), country: /brasil|brazil/i.test(last) ? last : 'Brasil' };
  }
  const thirdLast = parts[parts.length - 3];
  const stateMatch = secondLast?.match(/^([A-Z]{2})$/);
  if (stateMatch && thirdLast) {
    return { city: thirdLast.replace(/^.*-\s*/, '').trim(), state: stateMatch[1], country: /brasil|brazil/i.test(last) ? last : 'Brasil' };
  }
  return {};
}

/* ------------------------------------------------------------------ */
/*  Field definitions for manual mode                                  */
/* ------------------------------------------------------------------ */

interface FormField {
  key: string;
  labelKey: string;
  icon: React.ReactNode;
  type: 'text' | 'textarea';
  groupKey: string;
  getValue: (place: PlaceDetail | Place, analysis: Analysis | null, t: TranslateFn) => string;
}

function getRdFields(): FormField[] {
  return [
    { key: 'name', labelKey: 'page.crm.field.name', icon: <User size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.displayName?.text ?? '' },
    { key: 'phone', labelKey: 'page.crm.field.phone', icon: <Phone size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? '' },
    { key: 'email', labelKey: 'page.crm.field.email', icon: <Mail size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: () => '' },
    { key: 'website', labelKey: 'page.crm.field.website', icon: <Globe size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.websiteUri ?? (p as PlaceDetail).website ?? '' },
    { key: 'address', labelKey: 'page.crm.field.address', icon: <MapPin size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.formattedAddress ?? '' },
    { key: 'primaryType', labelKey: 'page.crm.field.segment', icon: <Hash size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.primaryType ?? '' },
    { key: 'facebook', labelKey: 'page.crm.field.facebook', icon: <Share2 size={14} />, type: 'text', groupKey: 'page.crm.group.social', getValue: (_p, a) => (a?.socialMedia as Record<string, string> | undefined)?.facebook ?? '' },
    { key: 'linkedin', labelKey: 'page.crm.field.linkedin', icon: <Share2 size={14} />, type: 'text', groupKey: 'page.crm.group.social', getValue: (_p, a) => (a?.socialMedia as Record<string, string> | undefined)?.linkedin ?? '' },
    { key: 'instagram', labelKey: 'page.crm.field.instagram', icon: <Share2 size={14} />, type: 'text', groupKey: 'page.crm.group.social', getValue: (_p, a) => (a?.socialMedia as Record<string, string> | undefined)?.instagram ?? '' },
    { key: 'summary', labelKey: 'page.crm.field.summaryBio', icon: <FileText size={14} />, type: 'textarea', groupKey: 'page.crm.group.analysis', getValue: (_p, a) => a?.summary ? String(a.summary) : '' },
    { key: 'dealName', labelKey: 'page.crm.field.dealName', icon: <Target size={14} />, type: 'text', groupKey: 'page.crm.group.deal', getValue: (p, _a, tr) => `${p.displayName?.text ?? ''} - ${tr('page.crm.dealSuffixPrecision')}` },
  ];
}

function getAgendorFields(): FormField[] {
  return [
    { key: 'name', labelKey: 'page.crm.field.nameCompany', icon: <Building2 size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.displayName?.text ?? '' },
    { key: 'phone', labelKey: 'page.crm.field.phone', icon: <Phone size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? '' },
    { key: 'email', labelKey: 'page.crm.field.email', icon: <Mail size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: () => '' },
    { key: 'website', labelKey: 'page.crm.field.website', icon: <Globe size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.websiteUri ?? (p as PlaceDetail).website ?? '' },
    { key: 'address', labelKey: 'page.crm.field.address', icon: <MapPin size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.formattedAddress ?? '' },
    { key: 'facebook', labelKey: 'page.crm.field.facebook', icon: <Share2 size={14} />, type: 'text', groupKey: 'page.crm.group.social', getValue: (_p, a) => (a?.socialMedia as Record<string, string> | undefined)?.facebook ?? '' },
    { key: 'instagram', labelKey: 'page.crm.field.instagram', icon: <Share2 size={14} />, type: 'text', groupKey: 'page.crm.group.social', getValue: (_p, a) => (a?.socialMedia as Record<string, string> | undefined)?.instagram ?? '' },
    { key: 'linkedin', labelKey: 'page.crm.field.linkedin', icon: <Share2 size={14} />, type: 'text', groupKey: 'page.crm.group.social', getValue: (_p, a) => (a?.socialMedia as Record<string, string> | undefined)?.linkedin ?? '' },
    { key: 'summary', labelKey: 'page.crm.field.summary', icon: <FileText size={14} />, type: 'textarea', groupKey: 'page.crm.group.analysis', getValue: (_p, a) => a?.summary ? String(a.summary) : '' },
    { key: 'dealName', labelKey: 'page.crm.field.dealNameAgendor', icon: <Target size={14} />, type: 'text', groupKey: 'page.crm.group.deal', getValue: (p, _a, tr) => `${p.displayName?.text ?? ''} - ${tr('page.crm.dealSuffix')}` },
  ];
}

function getHubspotFields(): FormField[] {
  return [
    { key: 'name', labelKey: 'page.crm.field.nameCompanyOnly', icon: <Building2 size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.displayName?.text ?? '' },
    { key: 'phone', labelKey: 'page.crm.field.phone', icon: <Phone size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? '' },
    { key: 'email', labelKey: 'page.crm.field.email', icon: <Mail size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: () => '' },
    { key: 'website', labelKey: 'page.crm.field.website', icon: <Globe size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.websiteUri ?? (p as PlaceDetail).website ?? '' },
    { key: 'address', labelKey: 'page.crm.field.address', icon: <MapPin size={14} />, type: 'text', groupKey: 'page.crm.group.lead', getValue: (p) => p.formattedAddress ?? '' },
    { key: 'facebook', labelKey: 'page.crm.field.facebook', icon: <Share2 size={14} />, type: 'text', groupKey: 'page.crm.group.social', getValue: (_p, a) => (a?.socialMedia as Record<string, string> | undefined)?.facebook ?? '' },
    { key: 'instagram', labelKey: 'page.crm.field.instagram', icon: <Share2 size={14} />, type: 'text', groupKey: 'page.crm.group.social', getValue: (_p, a) => (a?.socialMedia as Record<string, string> | undefined)?.instagram ?? '' },
    { key: 'linkedin', labelKey: 'page.crm.field.linkedin', icon: <Share2 size={14} />, type: 'text', groupKey: 'page.crm.group.social', getValue: (_p, a) => (a?.socialMedia as Record<string, string> | undefined)?.linkedin ?? '' },
    { key: 'summary', labelKey: 'page.crm.field.summary', icon: <FileText size={14} />, type: 'textarea', groupKey: 'page.crm.group.analysis', getValue: (_p, a) => a?.summary ? String(a.summary) : '' },
    { key: 'dealName', labelKey: 'page.crm.field.dealName', icon: <Target size={14} />, type: 'text', groupKey: 'page.crm.group.deal', getValue: (p, _a, tr) => `${p.displayName?.text ?? ''} - ${tr('page.crm.dealSuffixPrecision')}` },
  ];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildRdPayload(place: PlaceDetail | Place, analysis: Analysis | null, mode: SendMode, overrides: Record<string, string>, crmSelections?: { sourceId?: string; campaignId?: string }) {
  const socialMedia = analysis?.socialMedia && typeof analysis.socialMedia === 'object' && !Array.isArray(analysis.socialMedia)
    ? (analysis.socialMedia as { instagram?: string; facebook?: string; linkedin?: string })
    : undefined;

  return {
    mode, placeId: place.id,
    name: overrides.name || place.displayName?.text || place.id,
    phone: overrides.phone || place.nationalPhoneNumber || place.internationalPhoneNumber,
    email: overrides.email || undefined,
    website: overrides.website || place.websiteUri || (place as PlaceDetail).website,
    address: overrides.address || place.formattedAddress,
    rating: place.rating, reviewCount: place.userRatingCount,
    primaryType: overrides.primaryType || place.primaryType,
    businessStatus: place.businessStatus,
    score: analysis?.score, scoreLabel: analysis?.scoreLabel,
    summary: overrides.summary || (analysis?.summary ? String(analysis.summary) : undefined),
    strengths: Array.isArray(analysis?.strengths) ? (analysis.strengths as string[]) : undefined,
    weaknesses: Array.isArray(analysis?.weaknesses) ? (analysis.weaknesses as string[]) : undefined,
    opportunities: Array.isArray(analysis?.opportunities) ? (analysis.opportunities as string[]) : undefined,
    painPoints: Array.isArray(analysis?.painPoints) ? (analysis.painPoints as string[]) : undefined,
    gaps: Array.isArray(analysis?.gaps) ? (analysis.gaps as string[]) : undefined,
    reviewAnalysis: analysis?.reviewAnalysis ? String(analysis.reviewAnalysis) : undefined,
    reviewTrend: analysis?.reviewTrend ? String(analysis.reviewTrend) : undefined,
    suggestedContactTime: analysis?.suggestedContactTime ? String(analysis.suggestedContactTime) : undefined,
    contactStrategy: analysis?.contactStrategy ? String(analysis.contactStrategy) : undefined,
    firstContactMessage: analysis?.firstContactMessage ? String(analysis.firstContactMessage) : undefined,
    suggestedWhatsAppMessage: analysis?.suggestedWhatsAppMessage ? String(analysis.suggestedWhatsAppMessage) : undefined,
    fullReport: analysis?.fullReport ? String(analysis.fullReport) : undefined,
    socialMedia: {
      instagram: overrides.instagram || socialMedia?.instagram,
      facebook: overrides.facebook || socialMedia?.facebook,
      linkedin: overrides.linkedin || socialMedia?.linkedin,
    },
    dealName: overrides.dealName || undefined,
    sourceId: crmSelections?.sourceId || undefined,
    campaignId: crmSelections?.campaignId || undefined,
  };
}

function buildAgendorPayload(place: PlaceDetail | Place, analysis: Analysis | null, mode: SendMode, overrides: Record<string, string>, crmSelections?: { funnel?: number; dealStage?: number; ownerUser?: number }) {
  const socialMedia = analysis?.socialMedia && typeof analysis.socialMedia === 'object' && !Array.isArray(analysis.socialMedia)
    ? (analysis.socialMedia as { instagram?: string; facebook?: string; linkedin?: string })
    : undefined;

  return {
    mode, placeId: place.id,
    name: overrides.name || place.displayName?.text || place.id,
    phone: overrides.phone || place.nationalPhoneNumber || place.internationalPhoneNumber,
    email: overrides.email || undefined,
    website: overrides.website || place.websiteUri || (place as PlaceDetail).website,
    address: overrides.address || place.formattedAddress,
    rating: place.rating, reviewCount: place.userRatingCount,
    primaryType: place.primaryType, businessStatus: place.businessStatus,
    score: analysis?.score, scoreLabel: analysis?.scoreLabel,
    summary: overrides.summary || (analysis?.summary ? String(analysis.summary) : undefined),
    strengths: Array.isArray(analysis?.strengths) ? (analysis.strengths as string[]) : undefined,
    gaps: Array.isArray(analysis?.gaps) ? (analysis.gaps as string[]) : undefined,
    painPoints: Array.isArray(analysis?.painPoints) ? (analysis.painPoints as string[]) : undefined,
    firstContactMessage: analysis?.firstContactMessage ? String(analysis.firstContactMessage) : undefined,
    suggestedWhatsAppMessage: analysis?.suggestedWhatsAppMessage ? String(analysis.suggestedWhatsAppMessage) : undefined,
    fullReport: analysis?.fullReport ? String(analysis.fullReport) : undefined,
    socialMedia: {
      instagram: overrides.instagram || socialMedia?.instagram,
      facebook: overrides.facebook || socialMedia?.facebook,
      linkedin: overrides.linkedin || socialMedia?.linkedin,
    },
    dealName: overrides.dealName || `${place.displayName?.text ?? place.id} - Oportunidade`,
    dealValue: typeof analysis?.score === 'number' ? Math.round(analysis.score * 100) : undefined,
    funnel: crmSelections?.funnel || undefined,
    dealStage: crmSelections?.dealStage || undefined,
    ownerUser: crmSelections?.ownerUser || undefined,
  };
}

function buildHubspotPayload(place: PlaceDetail | Place, analysis: Analysis | null, mode: SendMode, overrides: Record<string, string>, crmSelections?: { pipelineId?: string; stageId?: string; ownerId?: string }) {
  const socialMedia = analysis?.socialMedia && typeof analysis.socialMedia === 'object' && !Array.isArray(analysis.socialMedia)
    ? (analysis.socialMedia as { instagram?: string; facebook?: string; linkedin?: string })
    : undefined;

  return {
    mode, placeId: place.id,
    name: overrides.name || place.displayName?.text || place.id,
    phone: overrides.phone || place.nationalPhoneNumber || place.internationalPhoneNumber,
    email: overrides.email || undefined,
    website: overrides.website || place.websiteUri || (place as PlaceDetail).website,
    address: overrides.address || place.formattedAddress,
    rating: place.rating, reviewCount: place.userRatingCount,
    primaryType: overrides.primaryType || place.primaryType,
    businessStatus: place.businessStatus,
    score: analysis?.score, scoreLabel: analysis?.scoreLabel,
    summary: overrides.summary || (analysis?.summary ? String(analysis.summary) : undefined),
    strengths: Array.isArray(analysis?.strengths) ? (analysis.strengths as string[]) : undefined,
    weaknesses: Array.isArray(analysis?.weaknesses) ? (analysis.weaknesses as string[]) : undefined,
    opportunities: Array.isArray(analysis?.opportunities) ? (analysis.opportunities as string[]) : undefined,
    painPoints: Array.isArray(analysis?.painPoints) ? (analysis.painPoints as string[]) : undefined,
    gaps: Array.isArray(analysis?.gaps) ? (analysis.gaps as string[]) : undefined,
    reviewAnalysis: analysis?.reviewAnalysis ? String(analysis.reviewAnalysis) : undefined,
    reviewTrend: analysis?.reviewTrend ? String(analysis.reviewTrend) : undefined,
    suggestedContactTime: analysis?.suggestedContactTime ? String(analysis.suggestedContactTime) : undefined,
    contactStrategy: analysis?.contactStrategy ? String(analysis.contactStrategy) : undefined,
    firstContactMessage: analysis?.firstContactMessage ? String(analysis.firstContactMessage) : undefined,
    suggestedWhatsAppMessage: analysis?.suggestedWhatsAppMessage ? String(analysis.suggestedWhatsAppMessage) : undefined,
    fullReport: analysis?.fullReport ? String(analysis.fullReport) : undefined,
    socialMedia: {
      instagram: overrides.instagram || socialMedia?.instagram,
      facebook: overrides.facebook || socialMedia?.facebook,
      linkedin: overrides.linkedin || socialMedia?.linkedin,
    },
    dealName: overrides.dealName || `${place.displayName?.text ?? place.id} - Oportunidade Precision`,
    dealValue: typeof analysis?.score === 'number' ? Math.round(analysis.score * 100) : undefined,
    pipelineId: crmSelections?.pipelineId || undefined,
    stageId: crmSelections?.stageId || undefined,
    ownerId: crmSelections?.ownerId || undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function AnalysisWarning({ analyzing }: { analyzing: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-50 border border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30">
      <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed">
        <p className="font-bold text-amber-800 dark:text-amber-200">{t('page.crm.analysisNotDone')}</p>
        <p className="mt-1 text-amber-700 dark:text-amber-300/80">
          {analyzing ? t('page.crm.analysisInProgress') : t('page.crm.analysisRecommend')}
        </p>
      </div>
    </div>
  );
}

function FlowModeSelector({ flow, onChange }: { flow: FlowMode; onChange: (v: FlowMode) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => onChange('auto')}
        className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 text-xs font-medium transition-all ${
          flow === 'auto'
            ? 'border-violet-600 bg-violet-50 text-violet-900 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500'
            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:border-border dark:bg-surface/50 dark:text-muted dark:hover:text-foreground'
        }`}>
        <Zap size={22} className={flow === 'auto' ? 'text-violet-600 dark:text-violet-400' : 'text-neutral-400'} />
        <span className="font-bold text-sm">{t('page.crm.flowAuto')}</span>
        <span className="text-[10px] leading-tight opacity-70 text-center">{t('page.crm.flowAutoDesc')}</span>
      </button>
      <button type="button" onClick={() => onChange('manual')}
        className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 text-xs font-medium transition-all ${
          flow === 'manual'
            ? 'border-violet-600 bg-violet-50 text-violet-900 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500'
            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:border-border dark:bg-surface/50 dark:text-muted dark:hover:text-foreground'
        }`}>
        <PencilLine size={22} className={flow === 'manual' ? 'text-violet-600 dark:text-violet-400' : 'text-neutral-400'} />
        <span className="font-bold text-sm">{t('page.crm.flowManual')}</span>
        <span className="text-[10px] leading-tight opacity-70 text-center">{t('page.crm.flowManualDesc')}</span>
      </button>
    </div>
  );
}

function SendModeSelector({ mode, onChange }: { mode: SendMode; onChange: (v: SendMode) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange('contact')}
        className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-bold transition-all border-2 ${
          mode === 'contact'
            ? 'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-500/20 dark:border-blue-500/40 dark:text-blue-300'
            : 'bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900 dark:bg-surface/50 dark:border-border dark:text-muted'
        }`}>
        {t('page.crm.sendContactOnly')}
      </button>
      <button type="button" onClick={() => onChange('contact_and_deal')}
        className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-bold transition-all border-2 ${
          mode === 'contact_and_deal'
            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300'
            : 'bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900 dark:bg-surface/50 dark:border-border dark:text-muted'
        }`}>
        {t('page.crm.sendContactAndDeal')}
      </button>
    </div>
  );
}

function ManualForm({ fields, values, onChange, sendMode }: { fields: FormField[]; values: Record<string, string>; onChange: (key: string, value: string) => void; sendMode: SendMode }) {
  const { t } = useI18n();
  const groups = fields.reduce<Record<string, FormField[]>>((acc, f) => {
    if (f.groupKey === 'page.crm.group.deal' && sendMode === 'contact') return acc;
    (acc[f.groupKey] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([groupKey, groupFields]) => (
        <div key={groupKey} className="space-y-2">
          <h4 className="text-[10px] font-bold text-neutral-500 dark:text-muted uppercase tracking-widest">{t(groupKey)}</h4>
          {groupFields.map((f) => (
            <label key={f.key} className="block">
              <span className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-muted mb-1 font-medium">{f.icon} {t(f.labelKey)}</span>
              {f.type === 'textarea' ? (
                <textarea value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-300 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-none dark:bg-surface dark:border-border dark:text-foreground" />
              ) : (
                <input type="text" value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-300 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:bg-surface dark:border-border dark:text-foreground" />
              )}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CRM Selectors (Agendor funnels/stages/users, RD sources/campaigns) */
/* ------------------------------------------------------------------ */

type SelectOption = { value: string; label: string };

function CrmSelect({ label, icon, options, value, onChange, loading, placeholder }: {
  label: string; icon: React.ReactNode; options: SelectOption[]; value: string;
  onChange: (v: string) => void; loading?: boolean; placeholder?: string;
}) {
  const { t } = useI18n();
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-muted mb-1 font-medium">{icon} {label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={loading}
          className="w-full px-3 py-2 pr-8 rounded-lg bg-white border border-neutral-300 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:bg-surface dark:border-border dark:text-foreground appearance-none disabled:opacity-50">
          <option value="">{loading ? t('page.crm.loading') : (placeholder ?? t('page.crm.select'))}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400" />
      </div>
    </label>
  );
}

function useAgendorSelectors() {
  const [funnels, setFunnels] = useState<Array<{ id: number; name: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: number; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedFunnel, setSelectedFunnel] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [loadingFunnels, setLoadingFunnels] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    setLoadingFunnels(true);
    setLoadingUsers(true);
    integrationsApi.agendorFunnels()
      .then((r) => setFunnels(r?.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingFunnels(false));
    integrationsApi.agendorUsers()
      .then((r) => setUsers(r?.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (!selectedFunnel) { setStages([]); setSelectedStage(''); return; }
    setLoadingStages(true);
    setSelectedStage('');
    integrationsApi.agendorDealStages(Number(selectedFunnel))
      .then((r) => setStages(r?.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingStages(false));
  }, [selectedFunnel]);

  return {
    funnels, stages, users,
    selectedFunnel, selectedStage, selectedUser,
    setSelectedFunnel, setSelectedStage, setSelectedUser,
    loadingFunnels, loadingStages, loadingUsers,
    selections: {
      funnel: selectedFunnel ? Number(selectedFunnel) : undefined,
      dealStage: selectedStage ? Number(selectedStage) : undefined,
      ownerUser: selectedUser ? Number(selectedUser) : undefined,
    },
  };
}

function useRdSelectors() {
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  useEffect(() => {
    setLoadingSources(true);
    setLoadingCampaigns(true);
    integrationsApi.rdStationSources()
      .then((r) => setSources(r?.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingSources(false));
    integrationsApi.rdStationCampaigns()
      .then((r) => setCampaigns(r?.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingCampaigns(false));
  }, []);

  return {
    sources, campaigns,
    selectedSource, selectedCampaign,
    setSelectedSource, setSelectedCampaign,
    loadingSources, loadingCampaigns,
    selections: {
      sourceId: selectedSource || undefined,
      campaignId: selectedCampaign || undefined,
    },
  };
}

function AgendorCrmSelectors({ selectors }: { selectors: ReturnType<typeof useAgendorSelectors> }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-neutral-500 dark:text-muted uppercase tracking-widest">{t('page.crm.dealSettings')}</h4>
      <CrmSelect label={t('page.crm.funnel')} icon={<Target size={14} />}
        options={selectors.funnels.map((f) => ({ value: String(f.id), label: f.name }))}
        value={selectors.selectedFunnel} onChange={selectors.setSelectedFunnel}
        loading={selectors.loadingFunnels} placeholder={t('page.crm.funnelDefault')} />
      {selectors.selectedFunnel && (
        <CrmSelect label={t('page.crm.stage')} icon={<Hash size={14} />}
          options={selectors.stages.map((s) => ({ value: String(s.id), label: s.name }))}
          value={selectors.selectedStage} onChange={selectors.setSelectedStage}
          loading={selectors.loadingStages} placeholder={t('page.crm.stageFirst')} />
      )}
      <CrmSelect label={t('page.crm.owner')} icon={<User size={14} />}
        options={selectors.users.map((u) => ({ value: String(u.id), label: u.name }))}
        value={selectors.selectedUser} onChange={selectors.setSelectedUser}
        loading={selectors.loadingUsers} placeholder={t('page.crm.ownerDefault')} />
    </div>
  );
}

function RdCrmSelectors({ selectors }: { selectors: ReturnType<typeof useRdSelectors> }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-neutral-500 dark:text-muted uppercase tracking-widest">{t('page.crm.dealSettingsRd')}</h4>
      <CrmSelect label={t('page.crm.source')} icon={<Globe size={14} />}
        options={selectors.sources.map((s) => ({ value: s.id, label: s.name }))}
        value={selectors.selectedSource} onChange={selectors.setSelectedSource}
        loading={selectors.loadingSources} placeholder={t('page.crm.noSource')} />
      <CrmSelect label={t('page.crm.campaign')} icon={<Target size={14} />}
        options={selectors.campaigns.map((c) => ({ value: c.id, label: c.name }))}
        value={selectors.selectedCampaign} onChange={selectors.setSelectedCampaign}
        loading={selectors.loadingCampaigns} placeholder={t('page.crm.noCampaign')} />
    </div>
  );
}

function useHubspotSelectors() {
  const [pipelines, setPipelines] = useState<Array<{ id: string; label: string; stages: Array<{ id: string; label: string }> }>>([]);
  const [owners, setOwners] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [loadingOwners, setLoadingOwners] = useState(false);

  useEffect(() => {
    setLoadingPipelines(true);
    setLoadingOwners(true);
    integrationsApi.hubspotPipelines()
      .then((r) => setPipelines(r?.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingPipelines(false));
    integrationsApi.hubspotOwners()
      .then((r) => setOwners(r?.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingOwners(false));
  }, []);

  const stages = pipelines.find((p) => p.id === selectedPipeline)?.stages ?? [];

  return {
    pipelines, owners, stages,
    selectedPipeline, selectedStage, selectedOwner,
    setSelectedPipeline: (v: string) => { setSelectedPipeline(v); setSelectedStage(''); },
    setSelectedStage, setSelectedOwner,
    loadingPipelines, loadingOwners,
    selections: {
      pipelineId: selectedPipeline || undefined,
      stageId: selectedStage || undefined,
      ownerId: selectedOwner || undefined,
    },
  };
}

function HubspotCrmSelectors({ selectors }: { selectors: ReturnType<typeof useHubspotSelectors> }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-neutral-500 dark:text-muted uppercase tracking-widest">{t('page.crm.dealSettingsRd')}</h4>
      <CrmSelect label={t('page.crm.pipeline')} icon={<Target size={14} />}
        options={selectors.pipelines.map((p) => ({ value: p.id, label: p.label }))}
        value={selectors.selectedPipeline} onChange={selectors.setSelectedPipeline}
        loading={selectors.loadingPipelines} placeholder={t('page.crm.pipelineDefault')} />
      {selectors.selectedPipeline && (
        <CrmSelect label={t('page.crm.hubspotStage')} icon={<Hash size={14} />}
          options={selectors.stages.map((s) => ({ value: s.id, label: s.label }))}
          value={selectors.selectedStage} onChange={selectors.setSelectedStage}
          placeholder={t('page.crm.hubspotStageFirst')} />
      )}
      <CrmSelect label={t('page.crm.owner')} icon={<User size={14} />}
        options={selectors.owners.map((o) => ({ value: o.id, label: o.label }))}
        value={selectors.selectedOwner} onChange={selectors.setSelectedOwner}
        loading={selectors.loadingOwners} placeholder={t('page.crm.ownerDefault')} />
    </div>
  );
}

function AutoSummary({ place, analysis, provider }: { place: PlaceDetail | Place; analysis: Analysis | null; provider: CrmProvider }) {
  const { t } = useI18n();
  const addr = parseAddress(place.formattedAddress);
  const socialMedia = analysis?.socialMedia && typeof analysis.socialMedia === 'object' && !Array.isArray(analysis.socialMedia)
    ? (analysis.socialMedia as Record<string, string>) : {};
  const hasSocial = Object.values(socialMedia).some((v) => v && String(v).toLowerCase() !== 'não encontrado' && String(v).toLowerCase() !== 'not found');

  const items: Array<{ label: string; value: string }> = [
    { label: t('page.crm.autoSummary.name'), value: place.displayName?.text ?? '' },
    { label: t('page.crm.autoSummary.phone'), value: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? '' },
    { label: t('page.crm.autoSummary.website'), value: place.websiteUri ?? (place as PlaceDetail).website ?? '' },
    ...(addr.city ? [{ label: t('page.crm.autoSummary.city'), value: `${addr.city}${addr.state ? ` - ${addr.state}` : ''}` }] : []),
    ...(place.primaryType ? [{ label: t('page.crm.autoSummary.segment'), value: place.primaryType }] : []),
  ];

  if (analysis) {
    if (analysis.score != null) items.push({ label: t('page.crm.autoSummary.aiScore'), value: `${analysis.score} (${analysis.scoreLabel ?? ''})` });
    if (analysis.summary) items.push({ label: t('page.crm.autoSummary.summary'), value: String(analysis.summary).slice(0, 80) + '…' });
    if (hasSocial) items.push({ label: t('page.crm.autoSummary.social'), value: Object.entries(socialMedia).filter(([, v]) => v && String(v).toLowerCase() !== 'não encontrado' && String(v).toLowerCase() !== 'not found').map(([k]) => k).join(', ') });
    const extras = [
      analysis.strengths?.length ? t('page.crm.autoSummary.strengths') : '',
      analysis.gaps?.length ? t('page.crm.autoSummary.gaps') : '',
      analysis.painPoints?.length ? t('page.crm.autoSummary.pains') : '',
      analysis.fullReport ? t('page.crm.autoSummary.fullReport') : '',
    ].filter(Boolean);
    if (extras.length) items.push({ label: t('page.crm.autoSummary.extraData'), value: extras.join(', ') });
  }

  if (provider === 'agendor') {
    items.push({ label: t('page.crm.autoSummary.organization'), value: t('page.crm.autoSummary.organizationValue') });
  }

  return (
    <div className="space-y-1.5 p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 dark:bg-surface/50 dark:border-border">
      <p className="text-[10px] font-bold text-neutral-500 dark:text-muted uppercase tracking-widest mb-2">{t('page.crm.autoSummaryTitle')}</p>
      {items.filter((i) => i.value).map((item) => (
        <div key={item.label} className="flex items-start gap-2 text-xs">
          <span className="text-neutral-500 dark:text-muted shrink-0 w-24 font-semibold">{item.label}:</span>
          <span className="text-neutral-900 dark:text-foreground truncate font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CRM action buttons (inline, secondary actions)                     */
/* ------------------------------------------------------------------ */

function CrmLogoButton({ provider, active, onClick, compact = false }: { provider: CrmProvider; active: boolean; onClick: () => void; compact?: boolean }) {
  const sizeClass = compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs';
  const labelClass = compact ? 'hidden sm:inline' : undefined;

  if (provider === 'hubspot') {
    return (
      <button
        type="button"
        onClick={onClick}
        title="HubSpot"
        className={`group inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors shrink-0 ${sizeClass} ${
          active
            ? 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
            : 'border-border bg-card text-muted hover:text-foreground hover:border-orange-400 hover:bg-orange-50/40 dark:hover:bg-orange-500/10'
        }`}
      >
        <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0 text-[#ff7a59]" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="6" fill="currentColor" />
          <circle cx="37" cy="12" r="4" fill="currentColor" opacity="0.95" />
          <path d="M28 20L34 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 30V40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M18 24H9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className={labelClass}>HubSpot</span>
      </button>
    );
  }

  const config = provider === 'rd'
    ? { src: '/logos/RD_Station_idYP8zaxIA_2.png', alt: 'RD Station', activeBorder: 'border-cyan-400', hoverBorder: 'hover:border-cyan-400' }
    : { src: '/logos/Agendor_idi8FvRR_k_0.png', alt: 'Agendor', activeBorder: 'border-violet-400', hoverBorder: 'hover:border-violet-400' };

  return (
    <button
      type="button"
      onClick={onClick}
      title={config.alt}
      className={`group inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors shrink-0 ${sizeClass} ${
        active
          ? `${config.activeBorder} bg-violet-50 text-foreground dark:bg-violet-500/15`
          : `border-border bg-card text-muted hover:text-foreground hover:bg-surface ${config.hoverBorder}`
      }`}
    >
      <img src={config.src} alt={config.alt} className="h-4 w-auto shrink-0 object-contain" />
      <span className={labelClass}>{config.alt}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Drawer Content                                                      */
/* ------------------------------------------------------------------ */

function DrawerContent({ provider, place, analysis, analyzing, onClose, onSuccess, onError, onWarning }: {
  provider: CrmProvider; place: PlaceDetail | Place; analysis: Analysis | null; analyzing: boolean;
  onClose: () => void; onSuccess: (msg: string) => void; onError: (msg: string) => void; onWarning: (msg: string) => void;
}) {
  const { t } = useI18n();
  const [flowMode, setFlowMode] = useState<FlowMode>('auto');
  const [sendMode, setSendMode] = useState<SendMode>('contact_and_deal');
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'not_connected'>('checking');
  const fields = useMemo(
    () => (provider === 'rd' ? getRdFields() : provider === 'hubspot' ? getHubspotFields() : getAgendorFields()),
    [provider, t],
  );

  const providerName = provider === 'rd' ? 'RD Station' : provider === 'hubspot' ? 'HubSpot' : 'Agendor';
  const providerLogo = provider === 'rd' ? '/logos/RD_Station_idYP8zaxIA_2.png' : provider === 'hubspot' ? '' : '/logos/Agendor_idi8FvRR_k_0.png';

  const agendorSelectors = useAgendorSelectors();
  const rdSelectors = useRdSelectors();
  const hubspotSelectors = useHubspotSelectors();

  // Check connection status on mount / provider change
  useEffect(() => {
    let cancelled = false;
    setConnectionStatus('checking');
    const check = provider === 'rd' ? integrationsApi.rdStationTest() : provider === 'hubspot' ? integrationsApi.hubspotTest() : integrationsApi.agendorTest();
    check
      .then((res) => { if (!cancelled) setConnectionStatus(res.ok ? 'connected' : 'not_connected'); })
      .catch(() => { if (!cancelled) setConnectionStatus('not_connected'); });
    return () => { cancelled = true; };
  }, [provider]);

  const initValues = useCallback(() => {
    const vals: Record<string, string> = {};
    for (const f of fields) vals[f.key] = f.getValue(place, analysis, t);
    return vals;
  }, [place, analysis, fields, t]);

  const [formValues, setFormValues] = useState<Record<string, string>>(initValues);
  useEffect(() => { setFormValues(initValues()); }, [initValues]);

  const handleSend = async () => {
    if (sending) return;
    if (analyzing) { onWarning(t('page.crm.waitAnalysis')); return; }
    setSending(true);
    const overrides = flowMode === 'manual' ? formValues : {};

    try {
      if (provider === 'rd') {
        const result = await integrationsApi.rdStationSend(buildRdPayload(place, analysis, sendMode, overrides, rdSelectors.selections));
        if (result?.warning) onWarning(result.warning);
        else onSuccess(sendMode === 'contact_and_deal' ? t('page.crm.success.rdContactDeal') : t('page.crm.success.rdContact'));
      } else if (provider === 'hubspot') {
        const result = await integrationsApi.hubspotSend(buildHubspotPayload(place, analysis, sendMode, overrides, hubspotSelectors.selections));
        if (result?.warning) onWarning(result.warning);
        else onSuccess(sendMode === 'contact_and_deal' ? t('page.crm.success.hubspotContactDeal') : t('page.crm.success.hubspotContact'));
      } else {
        const result = await integrationsApi.agendorSend(buildAgendorPayload(place, analysis, sendMode, overrides, agendorSelectors.selections));
        if (result?.warning) onWarning(result.warning);
        else onSuccess(sendMode === 'contact_and_deal' ? t('page.crm.success.agendorContactDeal') : t('page.crm.success.agendorContact'));
      }
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('page.crm.sendError');
      if (msg.includes('não configurad') || msg.includes('Token') || msg.includes('not configured')) {
        onError(t('page.crm.configureToken', { provider: providerName }));
      } else onError(msg);
    } finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-border shrink-0">
        <div className="flex items-center gap-2.5">
          {providerLogo ? (
            <img src={providerLogo} alt={providerName} className="h-6 object-contain bg-white rounded px-1" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff3eb] text-[#ff7a59]">
              <svg viewBox="0 0 48 48" className="h-5 w-5" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="6" fill="currentColor" />
                <circle cx="37" cy="12" r="4" fill="currentColor" opacity="0.95" />
                <path d="M28 20L34 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M24 30V40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M18 24H9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          )}
          <h3 className="text-base font-bold text-neutral-900 dark:text-foreground">{t('page.crm.sendTo', { provider: providerName })}</h3>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-surface text-neutral-500 hover:text-neutral-900 dark:text-muted dark:hover:text-foreground transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      {connectionStatus === 'checking' ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-violet-500" />
        </div>
      ) : connectionStatus === 'not_connected' ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
              <Plug size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h4 className="text-lg font-bold text-neutral-900 dark:text-foreground">{t('page.crm.notConnected', { provider: providerName })}</h4>
            <p className="text-sm text-neutral-600 dark:text-muted leading-relaxed">
              {provider === 'rd'
                ? t('page.crm.rdConnectHint')
                : provider === 'hubspot'
                  ? t('page.crm.hubspotConnectHint')
                  : t('page.crm.agendorConnectHint')}
            </p>
            <Link
              to="/dashboard/integracoes"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors shadow-lg shadow-violet-600/25"
            >
              <Plug size={16} />
              {t('page.crm.goIntegrations')}
            </Link>
          </div>
        </div>
      ) : (
      <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!analysis && <AnalysisWarning analyzing={analyzing} />}

        {analysis?.score != null && (
          <div className="flex items-center gap-3 p-3.5 rounded-lg bg-violet-50 border border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20">
            <div className="w-11 h-11 rounded-full border-2 border-violet-600 dark:border-violet-500 flex items-center justify-center shrink-0">
              <span className="text-base font-black text-violet-700 dark:text-violet-400">{analysis.score}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-neutral-900 dark:text-foreground">{analysis.scoreLabel ?? t('page.crm.scoreDefault')}</p>
              {analysis.summary && <p className="text-xs text-neutral-600 dark:text-muted truncate">{String(analysis.summary).slice(0, 60)}…</p>}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[10px] font-bold text-neutral-500 dark:text-muted uppercase tracking-widest">{t('page.crm.sendMode')}</p>
          <FlowModeSelector flow={flowMode} onChange={setFlowMode} />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-neutral-500 dark:text-muted uppercase tracking-widest">{t('page.crm.sendType')}</p>
          <SendModeSelector mode={sendMode} onChange={setSendMode} />
        </div>

        {flowMode === 'auto'
          ? <AutoSummary place={place} analysis={analysis} provider={provider} />
          : <ManualForm fields={fields} values={formValues} onChange={(k, v) => setFormValues((p) => ({ ...p, [k]: v }))} sendMode={sendMode} />}

        {sendMode === 'contact_and_deal' && provider === 'agendor' && (
          <AgendorCrmSelectors selectors={agendorSelectors} />
        )}
        {sendMode === 'contact_and_deal' && provider === 'rd' && (
          <RdCrmSelectors selectors={rdSelectors} />
        )}
        {sendMode === 'contact_and_deal' && provider === 'hubspot' && (
          <HubspotCrmSelectors selectors={hubspotSelectors} />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-200 dark:border-border shrink-0">
        <button type="button" onClick={handleSend} disabled={sending || analyzing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25">
          {sending
            ? <><Loader2 size={18} className="animate-spin" /> {t('page.crm.sending')}</>
            : <><Send size={18} /> {flowMode === 'auto' ? t('page.crm.sendAuto') : t('page.crm.send')}</>}
        </button>
      </div>
      </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main exported component                                            */
/* ------------------------------------------------------------------ */

export function CrmSidePanel({ place, analysis, analyzing, onSuccess, onError, onWarning, embed = false }: CrmSidePanelProps) {
  const { t } = useI18n();
  const [activeProvider, setActiveProvider] = useState<CrmProvider | null>(null);
  const toggleProvider = (provider: CrmProvider) => setActiveProvider((c) => (c === provider ? null : provider));
  const handleClose = () => setActiveProvider(null);

  useEffect(() => {
    if (!activeProvider) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveProvider(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeProvider]);

  return (
    <>
      {activeProvider && <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity" onClick={handleClose} />}

      <div className={embed ? 'flex flex-wrap items-center gap-1.5 min-w-0 w-full' : 'pt-2 mt-1 border-t border-border/60'}>
        {!embed && <p className="text-[11px] text-muted mb-2">{t('page.crm.sendToCrm')}</p>}
        <div className={embed ? 'flex flex-wrap items-center gap-1.5 min-w-0' : 'flex flex-wrap gap-1.5'}>
          {embed && (
            <span className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-muted shrink-0" title={t('page.crm.sendToCrm')}>
              <Plug size={12} aria-hidden />
              <span>CRM</span>
            </span>
          )}
          <CrmLogoButton provider="rd" active={activeProvider === 'rd'} onClick={() => toggleProvider('rd')} compact={embed} />
          <CrmLogoButton provider="hubspot" active={activeProvider === 'hubspot'} onClick={() => toggleProvider('hubspot')} compact={embed} />
          <CrmLogoButton provider="agendor" active={activeProvider === 'agendor'} onClick={() => toggleProvider('agendor')} compact={embed} />
        </div>
      </div>

      {/* Slide-in drawer */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] max-w-[100vw] sm:max-w-[90vw] z-50 bg-white dark:bg-card border-l border-neutral-200 dark:border-border shadow-2xl shadow-black/30 transition-transform duration-300 ease-out ${activeProvider ? 'translate-x-0' : 'translate-x-full'}`}>
        {activeProvider && <DrawerContent provider={activeProvider} place={place} analysis={analysis} analyzing={analyzing} onClose={handleClose} onSuccess={onSuccess} onError={onError} onWarning={onWarning} />}
      </div>
    </>
  );
}
