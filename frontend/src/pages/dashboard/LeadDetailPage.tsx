import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, ExternalLink, Phone, MapPin, Globe, Tag, Plus, X, MessageCircle, Copy, Check, Star, ChevronDown, ChevronUp, Target, AlertTriangle, TrendingUp, Share2, Zap, Mail } from 'lucide-react';
import type { Place, PlaceDetail, Analysis, LeadTagItem, LeadAnalysisListItem, AnalyzeProgressStep, SessionUser } from '@/lib/api';
import { searchApi, activityApi, tagsApi, leadsApi, analyzeStream } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { HeaderDashboard, COMPACT_HEADER_STICKY_TOP } from '@/components/dashboard/HeaderDashboard';
import { ProfileCompletenessBanner } from '@/components/dashboard/ProfileCompletenessBanner';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/lib/i18n';
import { buildAnalyzePayload } from '@/lib/analyze-payload';
import { getActiveMarket, isMarketFeatureEnabled } from '@/lib/market';
import { buildMapsUrl, buildWhatsAppNumber, getPrimaryPhone, getPrimaryEmail, buildMailtoUrl } from '@/lib/lead-contact-utils';
import { CrmSidePanel } from '@/components/dashboard/CrmSidePanel';
import { representativeApi } from '@/lib/api/representative';
import SmartRelations from '@/components/SmartRelations';
import { FollowUpBar } from '@/components/dashboard/FollowUpBar';
import { cn } from '@/lib/utils';

/**
 * Rebuilds the full analysis from a saved LeadAnalysis row. Only a handful of fields used to be
 * copied, so strengths, gaps, strategy, social links, full report and message variants vanished
 * when an analysed lead was reopened.
 */
function analysisFromSavedRecord(item: LeadAnalysisListItem): Analysis {
  const row = item as unknown as Record<string, unknown>;
  const extras = (row.extras && typeof row.extras === 'object' ? row.extras : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : undefined);
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : undefined);
  return {
    score: typeof row.score === 'number' ? row.score : undefined,
    scoreLabel: str('scoreLabel'),
    summary: str('summary'),
    strengths: arr(row.strengths),
    weaknesses: arr(row.weaknesses),
    painPoints: arr(row.painPoints),
    gaps: arr(row.gaps),
    approach: str('approach'),
    contactStrategy: str('contactStrategy'),
    firstContactMessage: str('firstContactMessage'),
    suggestedWhatsAppMessage: str('suggestedWhatsAppMessage'),
    fullReport: str('fullReport'),
    socialMedia: { instagram: str('socialInstagram'), facebook: str('socialFacebook'), linkedin: str('socialLinkedin') },
    closeProbability: row.closeProbability,
    estimatedDealValue: row.estimatedDealValue,
    bestContactWindow: str('bestContactWindow'),
    reviewTrend: str('reviewTrend'),
    suggestedContactTime: str('suggestedContactTime'),
    reclameAquiAnalysis: str('reclameAquiAnalysis'),
    jusBrasilAnalysis: str('jusBrasilAnalysis'),
    cnpjAnalysis: str('cnpjAnalysis'),
    reviewAnalysis: typeof extras.reviewAnalysis === 'string' ? extras.reviewAnalysis : undefined,
    quickActions: arr(extras.quickActions),
    keyMetrics: Array.isArray(extras.keyMetrics) ? (extras.keyMetrics as Analysis['keyMetrics']) : undefined,
    messageVariants: extras.messageVariants && typeof extras.messageVariants === 'object'
      ? (extras.messageVariants as Analysis['messageVariants'])
      : undefined,
  };
}

/** Rótulo amigável do provedor de IA (não expõe Cloudflare ao usuário). */
function getAnalysisProviderLabel(provider: string | undefined, t: (key: string) => string): string | undefined {
  if (!provider) return undefined;
  if (provider === 'CLOUDFLARE') return t('page.leadDetail.aiProvider');
  return provider;
}

const TAG_COLORS: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  red: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30',
  gray: 'bg-surface text-muted border-border',
};

function personalizeMessage(template: string, ownerName: string): string {
  return template
    .replace(/\[Nome\]/gi, ownerName)
    .replace(/\[NOME\]/g, ownerName)
    .replace(/\{name\}/gi, ownerName)
    .replace(/\{owner\}/gi, ownerName)
    .replace(/\{\{owner\}\}/gi, ownerName);
}

type MessageTab = 'whatsapp' | 'email' | 'linkedin';

function MessageTemplatesPanel({
  analysis,
  ownerName,
  recipientEmail,
  businessName,
  whatsappNumber,
  isRepresentative,
}: {
  analysis: Analysis;
  ownerName: string;
  recipientEmail?: string | null;
  businessName?: string;
  whatsappNumber?: string | null;
  isRepresentative?: boolean;
}) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [length, setLength] = useState<'short' | 'medium'>('medium');
  const variants = analysis.messageVariants ?? {};
  const pick = (channel: MessageTab, fallback: string): { short: string; medium: string } => {
    const v = variants[channel];
    const short = v?.short?.trim() ?? '';
    const medium = v?.medium?.trim() || fallback;
    return { short, medium };
  };
  const whatsapp = pick('whatsapp', analysis.suggestedWhatsAppMessage != null ? String(analysis.suggestedWhatsAppMessage) : '');
  const email = pick('email', analysis.firstContactMessage != null ? String(analysis.firstContactMessage) : '');
  // LinkedIn used to repeat the email text; only show it when the AI wrote a LinkedIn message.
  const linkedin = pick('linkedin', '');

  const tabs = useMemo(() => [
    { key: 'whatsapp' as const, label: t('page.leadDetail.tabWhatsApp'), msg: whatsapp },
    { key: 'email' as const, label: t('page.leadDetail.tabEmail'), msg: email },
    { key: 'linkedin' as const, label: t('page.leadDetail.tabLinkedIn'), msg: linkedin },
  ].filter((tab) => tab.msg.medium || tab.msg.short), [t, whatsapp, email, linkedin]);

  const defaultTab = tabs[0]?.key ?? 'whatsapp';
  const [activeTab, setActiveTab] = useState<MessageTab>(defaultTab);
  const [personalized, setPersonalized] = useState(false);
  const [sendingViaWhatsApp, setSendingViaWhatsApp] = useState(false);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0]!.key);
    }
  }, [tabs, activeTab]);

  if (tabs.length === 0) return null;

  const current = tabs.find((tab) => tab.key === activeTab) ?? tabs[0]!;
  const hasBothLengths = !!current.msg.short && !!current.msg.medium;
  const raw = (length === 'short' && current.msg.short) || current.msg.medium || current.msg.short;
  const displayText = personalized ? personalizeMessage(raw, ownerName) : raw;
  const mailtoUrl = buildMailtoUrl({
    to: recipientEmail,
    subject: businessName ? t('page.leadDetail.sendEmailSubject', { business: businessName }) : undefined,
    body: displayText,
  });
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(displayText)}`
    : null;

  const handlePersonalize = () => {
    setPersonalized(true);
  };

  const handleSendViaConnectedWhatsApp = async () => {
    if (!whatsappNumber || sendingViaWhatsApp) return;
    setSendingViaWhatsApp(true);
    try {
      await representativeApi.sendChatMessage(whatsappNumber, displayText);
      addToast('success', t('page.leadDetail.whatsappSent'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('page.leadDetail.whatsappSendError'));
    } finally {
      setSendingViaWhatsApp(false);
    }
  };

  const actionBtn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface border border-border text-muted hover:text-foreground hover:bg-violet-500/10 transition-colors';

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">{t('page.leadDetail.messageTemplates')}</h3>
          <p className="text-[11px] text-muted mt-0.5">{t('page.leadDetail.templatesHint')}</p>
        </div>
        <button
          type="button"
          onClick={handlePersonalize}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-violet-500/10 border border-violet-500/25 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 transition-colors shrink-0"
        >
          <Sparkles size={12} aria-hidden />
          {t('page.leadDetail.personalize')}
        </button>
      </div>
      <div className="flex gap-1 p-0.5 rounded-lg bg-surface border border-border w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveTab(tab.key); setPersonalized(false); }}
            className={cn(
              'px-3 py-1 rounded-md text-[11px] font-bold transition-colors',
              activeTab === tab.key
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-violet-500/10',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {hasBothLengths && (
        <div className="flex gap-1 p-0.5 rounded-lg bg-surface border border-border w-fit" role="group">
          {(['short', 'medium'] as const).map((len) => (
            <button
              key={len}
              type="button"
              onClick={() => setLength(len)}
              aria-pressed={length === len}
              className={cn(
                'px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors',
                length === len ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted hover:text-foreground',
              )}
            >
              {len === 'short' ? t('page.leadDetail.msgShort') : t('page.leadDetail.msgFull')}
            </button>
          ))}
        </div>
      )}
      <div className="bg-surface/60 p-3 rounded-lg border border-border/30">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{displayText}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={displayText} label={t('page.leadDetail.copyMessage')} />
        {activeTab === 'email' && mailtoUrl && (
          <a href={mailtoUrl} className={cn(actionBtn, 'hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30')}>
            <Mail size={12} aria-hidden />
            {t('page.leadDetail.sendEmail')}
          </a>
        )}
        {activeTab === 'whatsapp' && whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(actionBtn, 'hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30')}>
            <MessageCircle size={12} aria-hidden />
            {t('page.leadDetail.openWhatsApp')}
          </a>
        )}
        {activeTab === 'whatsapp' && whatsappNumber && isRepresentative && (
          <button
            type="button"
            onClick={handleSendViaConnectedWhatsApp}
            disabled={sendingViaWhatsApp}
            className={cn(actionBtn, 'hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 disabled:opacity-50')}
          >
            <MessageCircle size={12} aria-hidden />
            {sendingViaWhatsApp ? t('page.leadDetail.whatsappSending') : t('page.leadDetail.sendViaConnectedWhatsApp')}
          </button>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface border border-border text-muted hover:text-foreground hover:bg-violet-500/10 transition-colors">
      {copied ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={12} />}
      {copied ? t('page.leadDetail.copied') : label}
    </button>
  );
}

/** Simple Markdown to HTML converter for fullReport rendering. */
function renderSimpleMarkdown(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li data-ul>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li data-ol>$1</li>')
    .replace(/(<li data-ul>.*<\/li>\n?)+/g, (match) => `<ul>${match.replace(/ data-ul/g, '')}</ul>`)
    .replace(/(<li data-ol>.*<\/li>\n?)+/g, (match) => `<ol>${match.replace(/ data-ol/g, '')}</ol>`)
    .replace(/<\/(h[1-3]|ul|ol)>\n+/g, '</$1>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function formatCnpj(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatPorteLabel(value: string | null | undefined, t: (key: string) => string): string | null {
  if (!value) return null;
  if (value === 'ME') return t('page.leadDetail.porteME');
  if (value === 'EPP') return t('page.leadDetail.porteEPP');
  return value;
}

function getWebsites(place: PlaceDetail | Place): string[] {
  const all = [place.websiteUri, place.website, ...(place.websites ?? [])].filter(Boolean) as string[];
  return Array.from(new Set(all));
}

function getEmails(place: PlaceDetail | Place): string[] {
  const rfEmail = place.rfData?.email ?? null;
  const all = [place.email, rfEmail, ...(place.emails ?? [])].filter(Boolean) as string[];
  return Array.from(new Set(all));
}

function getOpeningHoursSummary(place: PlaceDetail | Place, t: (key: string) => string): string[] {
  const weekday = place.currentOpeningHours?.weekdayDescriptions ?? [];
  if (!weekday.length) return [];
  const status = place.currentOpeningHours?.openNow == null
    ? t('page.leadDetail.hoursUnavailable')
    : place.currentOpeningHours.openNow
      ? t('page.leadDetail.hoursOpen')
      : t('page.leadDetail.hoursClosed');
  return [status, ...weekday.slice(0, 3)];
}

function LeadDetailAnalysisView({
  analysis,
  ownerName,
  recipientEmail,
  businessName,
  whatsappNumber,
  isRepresentative,
  getProviderLabel,
}: {
  analysis: Analysis;
  ownerName: string;
  recipientEmail?: string | null;
  businessName?: string;
  whatsappNumber?: string | null;
  isRepresentative?: boolean;
  getProviderLabel: (p: string | undefined) => string | undefined;
}) {
  const { t } = useI18n();
  const showBrRegistry = isMarketFeatureEnabled('cnae');
  const showReclameAqui = isMarketFeatureEnabled('reclameAqui');
  const isUsMarket = getActiveMarket() === 'US';
  // The dossier (why now, call script, objections) is the most actionable part — open by default.
  const [showFullReport, setShowFullReport] = useState(true);
  const strengths = Array.isArray(analysis.strengths) ? (analysis.strengths as string[]) : [];
  const gaps = Array.isArray(analysis.gaps) ? (analysis.gaps as string[]) : [];
  const painPoints = Array.isArray(analysis.painPoints) ? (analysis.painPoints as string[]) : [];
  const approach = analysis.approach != null ? String(analysis.approach) : '';
  const contactStrategy = analysis.contactStrategy != null ? String(analysis.contactStrategy) : '';
  const socialMedia = analysis.socialMedia && typeof analysis.socialMedia === 'object' && !Array.isArray(analysis.socialMedia)
    ? (analysis.socialMedia as Record<string, unknown>)
    : {};
  const fullReport = analysis.fullReport != null ? String(analysis.fullReport) : '';
  const reviewTrend = analysis.reviewTrend != null ? String(analysis.reviewTrend) : '';
  const reviewAnalysis = analysis.reviewAnalysis != null ? String(analysis.reviewAnalysis) : '';
  const closeProbability = typeof analysis.closeProbability === 'number' ? analysis.closeProbability : null;
  const estimatedDealValue = typeof analysis.estimatedDealValue === 'number' ? analysis.estimatedDealValue : null;
  const bestContactWindow = analysis.bestContactWindow != null ? String(analysis.bestContactWindow) : '';
  const reclameAquiAnalysis = analysis.reclameAquiAnalysis != null ? String(analysis.reclameAquiAnalysis) : '';
  const jusBrasilAnalysis = analysis.jusBrasilAnalysis != null ? String(analysis.jusBrasilAnalysis) : '';
  const cnpjAnalysis = analysis.cnpjAnalysis != null ? String(analysis.cnpjAnalysis) : '';
  const quickActions = Array.isArray(analysis.quickActions) ? analysis.quickActions.filter((a) => typeof a === 'string' && a.trim()) : [];
  const keyMetrics = Array.isArray(analysis.keyMetrics)
    ? analysis.keyMetrics.filter((m) => m && typeof m.label === 'string' && typeof m.value === 'string' && m.value.trim())
    : [];
  const socialEntries = Object.entries(socialMedia).filter(
    ([, link]) => link && String(link).toLowerCase() !== 'não encontrado' && String(link).toLowerCase() !== 'not found'
  );

  return (
    <div className="stagger-in space-y-6 pt-2 min-w-0 [&_*]:break-words [&_*]:[overflow-wrap:anywhere]">
      {analysis.aiProvider && (
        <p className="text-[11px] text-muted -mt-2">{t('page.leadDetail.aiLabel', { provider: getProviderLabel(analysis.aiProvider) ?? analysis.aiProvider })}</p>
      )}
      {(quickActions.length > 0 || keyMetrics.length > 0) && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 sm:p-4 space-y-3">
          <div>
            <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Target size={14} /> {t('page.leadDetail.nextSteps')}
            </h3>
            <p className="text-[11px] text-muted mt-0.5">{t('page.leadDetail.nextStepsHint')}</p>
          </div>
          {quickActions.length > 0 && (
            <ol className="space-y-2">
              {quickActions.map((action, i) => (
                <li key={`qa-${i}-${action.slice(0, 40)}`} className="flex gap-3 items-start text-sm text-foreground">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
                  <span className="leading-relaxed pt-0.5">{action}</span>
                </li>
              ))}
            </ol>
          )}
          {keyMetrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {keyMetrics.slice(0, 6).map((m) => (
                <div key={`km-${m.label}`} className="rounded-lg bg-card border border-border px-3 py-2 min-w-0" title={m.hint}>
                  <div className="text-base font-bold text-foreground tabular-nums truncate">{m.value}</div>
                  <div className="text-[11px] text-muted leading-tight">{m.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lead Intelligence — kept for contact window emphasis on mobile */}
      {bestContactWindow && (closeProbability == null && estimatedDealValue == null) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 sm:p-4 text-center w-full max-w-full">
            <div className="text-sm sm:text-lg font-bold text-violet-500 break-words [overflow-wrap:anywhere]">{bestContactWindow}</div>
            <div className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mt-1">{t('page.leadDetail.bestSchedule')}</div>
          </div>
        </div>
      )}

      {reviewAnalysis && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:p-4 space-y-2 overflow-visible">
          <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2 flex-wrap">
            {t('page.leadDetail.reviewTrendTitle')}
            {reviewTrend && (
              <span className="normal-case tracking-normal font-semibold text-[11px] px-2 py-0.5 rounded-full bg-card border border-amber-500/30 text-foreground">
                {({ IMPROVING: 'Em alta', STABLE: 'Estável', DECLINING: 'Em queda' } as Record<string, string>)[reviewTrend.toUpperCase()] ?? reviewTrend}
              </span>
            )}
          </h3>
          <p className="text-sm text-foreground leading-relaxed break-words [overflow-wrap:anywhere]">{reviewAnalysis}</p>
        </div>
      )}

      {/* Diagnostic cards — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {strengths.length > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 sm:p-4 space-y-3 w-full max-w-full">
            <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={14} /> {t('page.leadDetail.strengths')}
            </h3>
            <ul className="space-y-2">
              {strengths.map((s) => (
                <li key={`strength-${s.slice(0, 80)}`} className="text-sm text-foreground bg-surface/60 p-2.5 rounded-lg border border-border/30 leading-relaxed break-words [overflow-wrap:anywhere]">{s}</li>
              ))}
            </ul>
          </div>
        )}
        {gaps.length > 0 && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 sm:p-4 space-y-3 w-full max-w-full">
            <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
              <Target size={14} /> {t('page.leadDetail.gaps')}
            </h3>
            <ul className="space-y-2">
              {gaps.map((w) => (
                <li key={`gap-${w.slice(0, 80)}`} className="text-sm text-foreground bg-surface/60 p-2.5 rounded-lg border border-border/30 leading-relaxed break-words [overflow-wrap:anywhere]">{w}</li>
              ))}
            </ul>
          </div>
        )}
        {painPoints.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:p-4 space-y-3 w-full max-w-full">
            <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <AlertTriangle size={14} /> {t('page.leadDetail.customerPains')}
            </h3>
            <ul className="space-y-2">
              {painPoints.map((p) => (
                <li key={`pain-${p.slice(0, 80)}`} className="text-sm text-foreground bg-surface/60 p-2.5 rounded-lg border border-border/30 leading-relaxed break-words [overflow-wrap:anywhere]">{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Approach + Social Media — 2 columns */}
      {(approach || socialEntries.length > 0) && (
        <div className={cn('grid grid-cols-1 gap-4', approach && socialEntries.length > 0 && 'md:grid-cols-2')}>
          {approach && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 sm:p-4 space-y-3">
              <h3 className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <Zap size={14} /> {t('page.leadDetail.approachStrategy')}
              </h3>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{approach}</div>
              {contactStrategy && (
                <div className="pt-2 border-t border-cyan-500/10">
                  <h4 className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest mb-1">{t('page.leadDetail.contactStrategy')}</h4>
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{contactStrategy}</div>
                </div>
              )}
            </div>
          )}
          {socialEntries.length > 0 && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <Share2 size={14} /> {t('page.leadDetail.socialMedia')}
              </h3>
              <div className="flex flex-col gap-2">
                {socialEntries.map(([platform, link]) => (
                  <a key={platform} href={String(link)} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline text-indigo-400 p-2.5 rounded-lg bg-surface/60 border border-border/30 inline-flex items-center justify-between group min-w-0 w-full">
                    <span className="capitalize">{platform}</span>
                    <ExternalLink size={14} className="opacity-50 group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message templates — tabbed with personalize */}
      <MessageTemplatesPanel
        analysis={analysis}
        ownerName={ownerName}
        recipientEmail={recipientEmail}
        businessName={businessName}
        whatsappNumber={whatsappNumber}
        isRepresentative={isRepresentative}
      />

      {/* Deep Analysis — Reclame Aqui, JusBrasil, CNPJ */}
      {((showReclameAqui && reclameAquiAnalysis) || (showBrRegistry && jusBrasilAnalysis) || (cnpjAnalysis && (showBrRegistry || !isUsMarket))) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {showReclameAqui && reclameAquiAnalysis && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 sm:p-4 space-y-2">
              <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{t('page.leadDetail.reclameAqui')}</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{reclameAquiAnalysis}</p>
            </div>
          )}
          {showBrRegistry && jusBrasilAnalysis && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:p-4 space-y-2">
              <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">{t('page.leadDetail.jusBrasil')}</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{jusBrasilAnalysis}</p>
            </div>
          )}
          {cnpjAnalysis && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 sm:p-4 space-y-2">
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">{showBrRegistry ? t('page.leadDetail.cnpjAnalysis') : t('page.leadDetail.registryAnalysis')}</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{cnpjAnalysis}</p>
            </div>
          )}
        </div>
      )}

      {/* Full Report — collapsible */}
      {fullReport && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFullReport((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-sm font-bold text-foreground hover:bg-surface/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-violet-500" />
              {t('page.leadDetail.fullReport')}
            </span>
            {showFullReport ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
          </button>
          {showFullReport && (
            <div className="px-4 pb-4">
              <div
                className="max-w-none text-foreground/90 text-sm leading-relaxed overflow-x-auto [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-violet-700 dark:[&_h2]:text-violet-300 [&_h2]:mt-5 [&_h2]:first:mt-0 [&_h2]:mb-2 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-border [&_h3]:text-[11px] [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted [&_h3]:mt-3 [&_h3]:mb-1 [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:mb-1 [&_li]:marker:text-violet-400"
                dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(fullReport) }}
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
}

/** Score tier colours shared by the hero card. */
function scoreTone(score: number): { ring: string; text: string; label: string } {
  if (score >= 70) return { ring: '#10b981', text: 'text-emerald-600 dark:text-emerald-400', label: 'Lead quente' };
  if (score >= 45) return { ring: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', label: 'Lead morno' };
  return { ring: '#94a3b8', text: 'text-muted', label: 'Lead frio' };
}

/**
 * Result at a glance, next to the lead data: score ring, close chance, deal value, best time and
 * a jump to the full report below (which takes the whole page width).
 */
function AnalysisHeroCard({ analysis, onReanalyze, analyzing }: { analysis: Analysis; onReanalyze: () => void; analyzing: boolean }) {
  const { t } = useI18n();
  const isUs = getActiveMarket() === 'US';
  const score = Math.max(0, Math.min(100, Number(analysis.score ?? 0)));
  const tone = scoreTone(score);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const close = typeof analysis.closeProbability === 'number' ? analysis.closeProbability : null;
  const deal = typeof analysis.estimatedDealValue === 'number' ? analysis.estimatedDealValue : null;
  const window = analysis.bestContactWindow ? String(analysis.bestContactWindow) : analysis.suggestedContactTime ? String(analysis.suggestedContactTime) : '';
  const tiles = [
    close != null ? { label: t('page.leadDetail.closeProb'), value: `${close}%` } : null,
    deal != null ? { label: t('page.leadDetail.estimatedValue'), value: deal.toLocaleString(isUs ? 'en-US' : 'pt-BR', { style: 'currency', currency: isUs ? 'USD' : 'BRL', maximumFractionDigits: 0 }) } : null,
    window ? { label: t('page.leadDetail.bestSchedule'), value: window } : null,
  ].filter((x): x is { label: string; value: string } => x != null);

  return (
    <section className="stagger-in rounded-xl border border-border bg-card p-5 space-y-4 min-w-0">
      <div className="flex items-center gap-4">
        <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0" role="img" aria-label={`Score ${score} de 100`}>
          <circle cx="42" cy="42" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
          <circle
            cx="42" cy="42" r={radius} fill="none" stroke={tone.ring} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}
            transform="rotate(-90 42 42)" style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)' }}
          />
          <text x="42" y="47" textAnchor="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 800 }}>{score}</text>
        </svg>
        <div className="min-w-0">
          <p className={cn('text-xs font-bold uppercase tracking-wider', tone.text)}>{analysis.scoreLabel ? String(analysis.scoreLabel) : tone.label}</p>
          <p className="text-sm text-foreground leading-relaxed mt-1 line-clamp-4">{String(analysis.summary ?? '')}</p>
        </div>
      </div>
      {tiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-lg border border-border bg-surface/50 px-3 py-2 min-w-0">
              <div className="text-sm font-bold text-foreground truncate" title={tile.value}>{tile.value}</div>
              <div className="text-[10px] text-muted leading-tight">{tile.label}</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => document.getElementById('analise-completa')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {t('page.leadDetail.viewFullAnalysis')}
        </Button>
        <Button size="sm" variant="secondary" onClick={onReanalyze} disabled={analyzing} icon={analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
          {t('page.leadDetail.reanalyze')}
        </Button>
      </div>
    </section>
  );
}

function LeadDetailStickyActions({
  place,
  analysis,
  analyzing,
  copiedPhone,
  copiedEmail,
  onCopyPhone,
  onCopyEmail,
  onReanalyze,
  trackAction,
  onCrmSuccess,
  onCrmError,
  onCrmWarning,
}: {
  place: PlaceDetail | Place;
  analysis: Analysis | null;
  analyzing: boolean;
  copiedPhone: boolean;
  copiedEmail: boolean;
  onCopyPhone: () => void;
  onCopyEmail: () => void;
  onReanalyze: () => void;
  trackAction: (action: string) => void;
  onCrmSuccess: (msg: string) => void;
  onCrmError: (msg: string) => void;
  onCrmWarning: (msg: string) => void;
}) {
  const { t } = useI18n();
  const phone = getPrimaryPhone(place);
  const whatsappNumber = buildWhatsAppNumber(place);
  const emails = getEmails(place);
  const primaryEmail = emails[0];
  const mapsUrl = buildMapsUrl(place.formattedAddress);

  const actionBtn = 'inline-flex items-center justify-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold border border-border bg-surface text-foreground hover:bg-violet-500/10 hover:border-violet-500/30 transition-colors shrink-0';
  const actionLabel = 'hidden sm:inline';

  const copyLabel = copiedEmail ? t('page.leadDetail.copied') : t('page.leadDetail.copyEmail');
  const copyPhoneLabel = copiedPhone ? t('page.leadDetail.copied') : t('page.leadDetail.copyPhone');
  const mailtoUrl = primaryEmail ? buildMailtoUrl({ to: primaryEmail }) : null;

  return (
    <div
      className="sticky z-20 w-full border-b border-violet-500/10 bg-violet-500/[0.06]"
      style={{ top: COMPACT_HEADER_STICKY_TOP }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
          {phone && (
            <a href={`tel:${phone}`} onClick={() => trackAction('CALL_CLICK')} title={t('page.leadDetail.call')} className={cn(actionBtn, 'hover:text-blue-600 dark:hover:text-blue-400')}>
              <Phone size={14} aria-hidden />
              <span className={actionLabel}>{t('page.leadDetail.call')}</span>
            </a>
          )}
          {whatsappNumber && (
            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" onClick={() => trackAction('WHATSAPP_CLICK')} title={t('page.leadDetail.whatsapp')} className={cn(actionBtn, 'hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30')}>
              <MessageCircle size={14} aria-hidden />
              <span className={actionLabel}>{t('page.leadDetail.whatsapp')}</span>
            </a>
          )}
          {primaryEmail && (
            <>
              <button type="button" onClick={onCopyEmail} title={t('page.leadDetail.copyEmail')} className={actionBtn}>
                {copiedEmail ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} aria-hidden />}
                <span className={actionLabel}>{copyLabel}</span>
              </button>
              {mailtoUrl && (
                <a href={mailtoUrl} onClick={() => trackAction('EMAIL_CLICK')} title={t('page.leadDetail.sendEmail')} className={cn(actionBtn, 'hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30')}>
                  <Mail size={14} aria-hidden />
                  <span className={actionLabel}>{t('page.leadDetail.sendEmail')}</span>
                </a>
              )}
            </>
          )}
          {phone && !primaryEmail && (
            <button type="button" onClick={onCopyPhone} title={t('page.leadDetail.copyPhone')} className={actionBtn}>
              {copiedPhone ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} aria-hidden />}
              <span className={actionLabel}>{copyPhoneLabel}</span>
            </button>
          )}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackAction('MAPS_CLICK')} title={t('page.leadDetail.viewMap')} className={actionBtn}>
              <MapPin size={14} aria-hidden />
              <span className={actionLabel}>{t('page.leadDetail.viewMap')}</span>
            </a>
          )}
          {analysis && (
            <button type="button" onClick={onReanalyze} disabled={analyzing} title={t('page.leadDetail.reanalyze')} className={cn(actionBtn, 'hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-50')}>
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} aria-hidden />}
              <span className={actionLabel}>{t('page.leadDetail.reanalyze')}</span>
            </button>
          )}
        </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-violet-500/10">
            <CrmSidePanel
              place={place}
              analysis={analysis}
              analyzing={analyzing}
              embed
              onSuccess={onCrmSuccess}
              onError={onCrmError}
              onWarning={onCrmWarning}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadDetailLoading() {
  const { t } = useI18n();
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-3 text-muted">
        <Loader2 size={24} className="animate-spin" />
        <span>{t('page.leadDetail.loading')}</span>
      </div>
    </div>
  );
}

function LeadDetailNotFound({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
      <p className="text-muted mb-4">{t('page.leadDetail.notFound')}</p>
      <Button variant="secondary" onClick={onBack}>
        {t('page.leadDetail.backToResults')}
      </Button>
    </div>
  );
}

interface LeadDetailContentProps {
  user: SessionUser;
  onLeadUpdated: (item: LeadAnalysisListItem) => void;
  place: PlaceDetail | Place;
  analysis: Analysis | null;
  tags: LeadTagItem[];
  leadAnalysisItem: LeadAnalysisListItem | null;
  togglingFavorite: boolean;
  showTagInput: boolean;
  newTag: string;
  analyzing: boolean;
  currentStep: AnalyzeProgressStep | null;
  copiedPhone: boolean;
  copiedEmail: boolean;
  savingLead: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onSaveLead: () => void;
  onCopyPhone: () => void;
  onCopyEmail: () => void;
  onAddTag: (label: string, color: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  setNewTag: (v: string) => void;
  setShowTagInput: (v: boolean) => void;
  onAnalyze: () => void;
  onOpenCompanyProfile: () => void;
  trackAction: (action: string) => void;
  onCrmSuccess: (msg: string) => void;
  onCrmError: (msg: string) => void;
  onCrmWarning: (msg: string) => void;
}

function LeadDetailToolbar({
  onBack,
  leadAnalysisItem,
  togglingFavorite,
  onToggleFavorite,
  onSaveLead,
  saving,
}: {
  onBack: () => void;
  leadAnalysisItem: LeadAnalysisListItem | null;
  togglingFavorite: boolean;
  onToggleFavorite: () => void;
  onSaveLead: () => void;
  saving: boolean;
}) {
  const { t } = useI18n();
  const isFavorite = leadAnalysisItem?.isFavorite ?? false;
  const isSaved = !!leadAnalysisItem;
  const favoriteTitle = isSaved ? (isFavorite ? t('page.leadDetail.removeFromFavorites') : t('page.leadDetail.markFavorite')) : t('page.leadDetail.saveLead');
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <Button variant="ghost" size="sm" className="text-muted hover:text-foreground -ml-2" icon={<ArrowLeft size={16} />} onClick={onBack}>
        {t('page.leadDetail.backToResults')}
      </Button>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Save / Favorite button — always visible */}
        <button
          type="button"
          onClick={isSaved ? onToggleFavorite : onSaveLead}
          disabled={togglingFavorite || saving}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-surface border border-border text-foreground hover:bg-violet-500/10 hover:border-violet-500/30 transition-colors disabled:opacity-50"
          title={favoriteTitle}
          aria-label={favoriteTitle}
        >
          {(togglingFavorite || saving)
            ? <Loader2 size={18} className="animate-spin shrink-0" />
            : isSaved
              ? <Star size={18} className={isFavorite ? 'fill-amber-400 text-amber-600 dark:text-amber-400' : 'shrink-0'} />
              : <Star size={18} className="shrink-0" />}
          {saving ? t('page.leadDetail.saving') : isSaved ? (isFavorite ? t('page.leadDetail.favorited') : t('page.leadDetail.favorite')) : t('page.leadDetail.saveLead')}
        </button>
      </div>
    </div>
  );
}

function LeadDetailInfoSection({ place, trackAction }: { place: PlaceDetail | Place; trackAction: (action: string) => void }) {
  const { t } = useI18n();
  const showCnae = isMarketFeatureEnabled('cnae');
  const websites = getWebsites(place);
  const emails = getEmails(place);
  const openingHours = getOpeningHoursSummary(place, t);
  const companyMeta = [
    { label: t('page.leadDetail.label.legalName'), value: place.companyLegalName },
    { label: t('page.leadDetail.label.tradeName'), value: place.companyTradeName },
    ...(showCnae ? [
      { label: t('page.leadDetail.label.cnpj'), value: formatCnpj(place.cnpj) },
      { label: t('page.leadDetail.label.cnpjStatus'), value: place.cnpjStatus },
      { label: t('page.leadDetail.label.companySize'), value: formatPorteLabel(place.rfData?.porte, t) },
      { label: t('page.leadDetail.label.cnae'), value: place.companyMainCnae ?? place.rfData?.cnaeDescricao },
    ] : [
      ...(place.primaryType ? [{ label: t('page.leadDetail.label.industry'), value: place.primaryType }] : []),
    ]),
    ...(showCnae && place.rfData?.dataAbertura ? [{ label: t('page.leadDetail.label.founded'), value: place.rfData.dataAbertura }] : []),
  ].filter((item) => item.value);

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4 min-w-0 overflow-hidden">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.leadDetail.leadInfo')}</h2>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start">
        <div className="min-w-0 rounded-2xl border border-border bg-surface/40 p-4 space-y-3 text-sm">
          {place.formattedAddress && (
            <div className="flex items-start gap-2 text-muted">
              <MapPin size={16} className="shrink-0 mt-0.5" />
              <span>{place.formattedAddress}</span>
            </div>
          )}
          {(place.nationalPhoneNumber || place.internationalPhoneNumber) && (
            <div className="flex items-center gap-2">
              <Phone size={16} className="shrink-0 text-muted" />
              <a href={`tel:${place.internationalPhoneNumber ?? place.nationalPhoneNumber}`} className="text-violet-500 hover:underline" onClick={() => trackAction('CALL_CLICK')}>
                {place.nationalPhoneNumber ?? place.internationalPhoneNumber}
              </a>
            </div>
          )}
          {websites.length > 0 && (
            <div className="space-y-2">
              {websites.slice(0, 2).map((website) => (
                <div key={website} className="flex items-center gap-2 min-w-0">
                  <Globe size={16} className="shrink-0 text-muted" />
                  <a href={website} target="_blank" rel="noopener noreferrer" title={website} className="min-w-0 flex-1 text-violet-500 hover:underline flex items-center gap-1">
                    {/* Tracking parameters (utm_*) made the URL overflow the card. */}
                    <span className="truncate">{website.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '')}</span>
                    <ExternalLink size={12} className="shrink-0" />
                  </a>
                </div>
              ))}
            </div>
          )}
          {(place.rating != null || place.userRatingCount != null) && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {place.rating != null && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">Google {place.rating.toFixed(1)}</span>}
              {place.userRatingCount != null && <span className="rounded-full border border-border bg-card px-2 py-1 text-muted">{t('page.leadDetail.reviews', { count: place.userRatingCount })}</span>}
              {place.primaryType && <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-700 dark:text-cyan-300">{place.primaryType}</span>}
            </div>
          )}
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {emails.slice(0, 3).map((email) => (
                <span key={email} className="text-[11px] rounded-full border border-border bg-card px-2 py-1 text-muted break-all">{email}</span>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4 space-y-3 text-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">{t('page.leadDetail.businessData')}</h3>
          {companyMeta.length > 0 ? (
            <dl className="divide-y divide-border/60">
              {companyMeta.map((item) => (
                <div key={item.label} className="py-1.5 first:pt-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</dt>
                  <dd className="text-foreground text-[13px] leading-snug break-words [overflow-wrap:anywhere]">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted">{t('page.leadDetail.noBusinessData')}</p>
          )}
          {openingHours.length > 0 && (
            <div className="pt-2 border-t border-border/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{t('page.leadDetail.hours')}</div>
              <ul className="mt-1 space-y-0.5 text-[12px] text-foreground">
                {openingHours.map((line) => (
                  <li key={line} className="break-words [overflow-wrap:anywhere]">{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LeadDetailTagsSection({
  tags,
  showTagInput,
  newTag,
  onAddTag,
  onRemoveTag,
  setNewTag,
  setShowTagInput,
}: {
  tags: LeadTagItem[];
  showTagInput: boolean;
  newTag: string;
  onAddTag: (label: string, color: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  setNewTag: (v: string) => void;
  setShowTagInput: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const tagHot = t('page.leadDetail.tagHot');
  const tagWarm = t('page.leadDetail.tagWarm');
  const tagCold = t('page.leadDetail.tagCold');
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Tag size={14} className="text-violet-600 dark:text-violet-400" /> {t('page.leadDetail.tags')}
      </h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag.id} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${TAG_COLORS[tag.color] || TAG_COLORS.gray}`}>
            {tag.label}
            <button type="button" onClick={() => onRemoveTag(tag.id)} className="hover:opacity-70"><X size={12} /></button>
          </span>
        ))}
        {!tags.find((tag) => tag.label === tagHot) && <button type="button" onClick={() => onAddTag(tagHot, 'green')} className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-emerald-500/30 text-emerald-600 dark:text-emerald-400/60 hover:bg-emerald-500/10 transition-colors">+ {t('page.leadDetail.tagHot')}</button>}
        {!tags.find((tag) => tag.label === tagWarm) && <button type="button" onClick={() => onAddTag(tagWarm, 'amber')} className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-amber-500/30 text-amber-600 dark:text-amber-400/60 hover:bg-amber-500/10 transition-colors">+ {t('page.leadDetail.tagWarm')}</button>}
        {!tags.find((tag) => tag.label === tagCold) && <button type="button" onClick={() => onAddTag(tagCold, 'blue')} className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-blue-500/30 text-blue-600 dark:text-blue-400/60 hover:bg-blue-500/10 transition-colors">+ {t('page.leadDetail.tagCold')}</button>}
        {showTagInput ? (
          <form onSubmit={(e) => { e.preventDefault(); onAddTag(newTag, 'violet'); }} className="flex items-center gap-1">
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={t('page.leadDetail.newTagPlaceholder')} className="h-7 w-28 px-2 bg-surface border border-border rounded-lg text-xs text-foreground placeholder:text-muted focus:outline-none" autoFocus />
            <button type="submit" className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 text-xs font-bold">OK</button>
            <button type="button" onClick={() => setShowTagInput(false)} className="text-muted hover:text-foreground"><X size={14} /></button>
          </form>
        ) : (
          <button type="button" onClick={() => setShowTagInput(true)} className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-violet-500/30 text-violet-600 dark:text-violet-400/60 hover:bg-violet-500/10 transition-colors inline-flex items-center gap-1">
            <Plus size={12} /> {t('page.leadDetail.customTag')}
          </button>
        )}
      </div>
    </section>
  );
}

function LeadDetailAnalysisSection({
  analysis,
  analyzing,
  currentStep,
  onAnalyze,
  ownerName,
  place,
  isRepresentative,
}: {
  analysis: Analysis | null;
  analyzing: boolean;
  currentStep: AnalyzeProgressStep | null;
  onAnalyze: () => void;
  ownerName: string;
  place: PlaceDetail | Place;
  isRepresentative?: boolean;
}) {
  const { t } = useI18n();
  const recipientEmail = getPrimaryEmail(place);
  const businessName = place.displayName?.text ?? place.id;
  const whatsappNumber = buildWhatsAppNumber(place);
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4 min-w-0">
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Sparkles size={16} className="text-violet-500" />
        {t('page.leadDetail.strategicAnalysis')}
      </h2>
      {!analysis ? (
        <div className="flex flex-col items-start gap-4 pb-2">
          {!analyzing && (
            <p className="text-sm text-muted">
              {t('page.leadDetail.analysisIntro')}
            </p>
          )}
          {analyzing && currentStep && <AnalysisProgressMotion currentStep={currentStep} />}
          <Button
            variant="primary"
            onClick={onAnalyze}
            disabled={analyzing}
            icon={analyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            className="w-full sm:w-auto mt-2 min-h-[52px] px-8 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25 border-0 transition-all hover:-translate-y-0.5"
          >
            {analyzing ? t('page.leadDetail.analyzing') : t('page.leadDetail.analyze')}
          </Button>
        </div>
      ) : (
        <LeadDetailAnalysisView
          analysis={analysis}
          ownerName={ownerName}
          recipientEmail={recipientEmail}
          businessName={businessName}
          whatsappNumber={whatsappNumber}
          isRepresentative={isRepresentative}
          getProviderLabel={(p) => getAnalysisProviderLabel(p, t)}
        />
      )}
    </section>
  );
}

function getStepConfig(t: (key: string) => string): Array<{ key: AnalyzeProgressStep; label: string; accent: string }> {
  return [
    { key: 'profile', label: t('page.leadDetail.step.profile'), accent: 'from-violet-500 to-fuchsia-500' },
    { key: 'web_search', label: t('page.leadDetail.step.webSearch'), accent: 'from-sky-500 to-cyan-500' },
    { key: 'conversion', label: t('page.leadDetail.step.conversion'), accent: 'from-emerald-500 to-teal-500' },
    { key: 'prompt', label: t('page.leadDetail.step.prompt'), accent: 'from-amber-500 to-orange-500' },
    { key: 'ai_call', label: t('page.leadDetail.step.aiCall'), accent: 'from-violet-600 to-indigo-600' },
    { key: 'parsing', label: t('page.leadDetail.step.parsing'), accent: 'from-pink-500 to-rose-500' },
    { key: 'saving', label: t('page.leadDetail.step.saving'), accent: 'from-indigo-500 to-blue-500' },
    { key: 'done', label: t('page.leadDetail.step.done'), accent: 'from-emerald-500 to-lime-500' },
  ];
}

function AnalysisProgressMotion({ currentStep }: { currentStep: AnalyzeProgressStep }) {
  const { t } = useI18n();
  const stepConfig = getStepConfig(t);
  const stepIndex = Math.max(0, stepConfig.findIndex((s) => s.key === currentStep));
  const current = (stepConfig[stepIndex] ?? stepConfig[0])!;
  const progress = Math.max(8, ((stepIndex + 1) / stepConfig.length) * 100);

  return (
    <div className="relative w-full overflow-hidden rounded-[2rem] border border-violet-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.16),_transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(245,243,255,0.96))] p-5 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-violet-500/10">
        <div
          className={`h-full bg-gradient-to-r ${current.accent} transition-all duration-700`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="absolute -left-6 top-10 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" aria-hidden />
      <div className="absolute right-10 top-8 h-16 w-16 rounded-full bg-cyan-500/10 blur-2xl" aria-hidden />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full border border-violet-500/20" />
          <div className="absolute h-20 w-20 rounded-full border border-dashed border-violet-500/30 animate-spin [animation-duration:10s]" />
          <div className={`absolute h-12 w-12 rounded-2xl bg-gradient-to-br ${current.accent} shadow-lg shadow-violet-500/20`} />
          <div className="absolute h-3 w-3 -translate-y-11 rounded-full bg-cyan-400 animate-pulse" />
          <div className="absolute h-2.5 w-2.5 translate-x-10 rounded-full bg-fuchsia-400 animate-pulse [animation-delay:250ms]" />
          <div className="absolute h-2 w-2 -translate-x-10 translate-y-8 rounded-full bg-amber-400 animate-pulse [animation-delay:500ms]" />
          <Loader2 size={22} className="relative z-10 animate-spin text-white" />
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full border border-violet-500/15 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700">
            {t('page.leadDetail.progress.inProgress')}
          </div>
          <h3 className="text-lg font-black text-foreground sm:text-xl">{current.label}</h3>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted">
            {t('page.leadDetail.progress.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted">
          <span className="rounded-full border border-border bg-white/70 px-2.5 py-1">{t('page.leadDetail.progress.percentDone', { percent: Math.round(progress) })}</span>
          <span className="rounded-full border border-border bg-white/70 px-2.5 py-1">{t('page.leadDetail.progress.noReload')}</span>
          <span className="rounded-full border border-border bg-white/70 px-2.5 py-1">{t('page.leadDetail.progress.realDataAi')}</span>
        </div>
      </div>
    </div>
  );
}

function LeadDetailContent(props: LeadDetailContentProps) {
  const { t } = useI18n();
  const { user, place, analysis, tags, leadAnalysisItem, togglingFavorite, showTagInput, newTag, analyzing, currentStep, copiedPhone, copiedEmail, savingLead, onBack, onToggleFavorite, onSaveLead, onCopyPhone, onCopyEmail, onAddTag, onRemoveTag, setNewTag, setShowTagInput, onAnalyze, onOpenCompanyProfile, trackAction, onCrmSuccess, onCrmError, onCrmWarning, onLeadUpdated } = props;
  const name = place.displayName?.text ?? place.id;
  const ownerName = place.companyTradeName ?? place.displayName?.text ?? place.id;
  return (
    <>
      <HeaderDashboard compact title={name} subtitle={t('page.leadDetail.subtitle')} breadcrumb={t('page.leadDetail.breadcrumb')} />
      <LeadDetailStickyActions
        place={place}
        analysis={analysis}
        analyzing={analyzing}
        copiedPhone={copiedPhone}
        copiedEmail={copiedEmail}
        onCopyPhone={onCopyPhone}
        onCopyEmail={onCopyEmail}
        onReanalyze={onAnalyze}
        trackAction={trackAction}
        onCrmSuccess={onCrmSuccess}
        onCrmError={onCrmError}
        onCrmWarning={onCrmWarning}
      />
      <div className="px-4 py-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-5 box-border w-full">
        <ProfileCompletenessBanner user={user} onPrimaryAction={onOpenCompanyProfile} />
        <LeadDetailToolbar onBack={onBack} leadAnalysisItem={leadAnalysisItem} togglingFavorite={togglingFavorite} onToggleFavorite={onToggleFavorite} onSaveLead={onSaveLead} saving={savingLead} />
        {leadAnalysisItem && <FollowUpBar item={leadAnalysisItem} onUpdated={onLeadUpdated} />}
        {/* Lead data and the analysis call-to-action side by side; once analysed, the report takes
            the full width (its 3-column diagnostics were unreadable squeezed into half the page). */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 xl:gap-6 items-start">
          <div className="space-y-5 min-w-0">
            <LeadDetailInfoSection place={place} trackAction={trackAction} />
            <LeadDetailTagsSection tags={tags} showTagInput={showTagInput} newTag={newTag} onAddTag={onAddTag} onRemoveTag={onRemoveTag} setNewTag={setNewTag} setShowTagInput={setShowTagInput} />
          </div>
          <div className="space-y-5 min-w-0">
            {analysis?.score != null ? (
              <AnalysisHeroCard analysis={analysis} onReanalyze={onAnalyze} analyzing={analyzing} />
            ) : (
              <LeadDetailAnalysisSection analysis={analysis} analyzing={analyzing} currentStep={currentStep} onAnalyze={onAnalyze} ownerName={ownerName} place={place} isRepresentative={user.isRepresentative} />
            )}
          </div>
        </div>
        {analysis && (
          <div id="analise-completa" className="scroll-mt-24">
          <LeadDetailAnalysisSection analysis={analysis} analyzing={analyzing} currentStep={currentStep} onAnalyze={onAnalyze} ownerName={ownerName} place={place} isRepresentative={user.isRepresentative} />
          </div>
        )}
        {isMarketFeatureEnabled('smartRelations') && <SmartRelations placeId={place.id} />}
      </div>
    </>
  );
}

export default function LeadDetailPage() {
  const { t, locale } = useI18n();
  const { placeId } = useParams<{ placeId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();

  const placeFromState = (location.state as { place?: Place } | null)?.place;
  const [place, setPlace] = useState<PlaceDetail | Place | null>(placeFromState ?? null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(!placeFromState && !!placeId);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState<AnalyzeProgressStep | null>(null);
  const streamAbortRef = useRef<{ abort: () => void } | null>(null);
  const [tags, setTags] = useState<LeadTagItem[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [leadAnalysisItem, setLeadAnalysisItem] = useState<LeadAnalysisListItem | null>(null);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [savingLead, setSavingLead] = useState(false);

  // Load saved lead (analysis) for this place to show favorite state
  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    leadsApi.list().then((list) => {
      if (!cancelled) {
        // Match by placeId (Google Place ID) OR lead.id (Prisma CUID — from pipeline navigation)
        const found = list.find((a) => a.lead?.placeId === placeId || a.lead?.id === placeId);
        setLeadAnalysisItem(found ?? null);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [placeId]);

  // Hydrate existing AI analysis when lead was already analyzed
  useEffect(() => {
    if (!leadAnalysisItem?.id) return;
    let cancelled = false;

    const hydrate = (data: Analysis) => {
      if (!cancelled) setAnalysis(data);
    };

    if (leadAnalysisItem.lead?.analysis) {
      hydrate(leadAnalysisItem.lead.analysis);
      return () => { cancelled = true; };
    }

    if (leadAnalysisItem.score == null) return () => { cancelled = true; };

    leadsApi.get(leadAnalysisItem.id)
      .then((item) => {
        if (cancelled) return;
        if (item.lead?.analysis) {
          hydrate(item.lead.analysis);
          return;
        }
        if (item.score != null) hydrate(analysisFromSavedRecord(item));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [leadAnalysisItem]);

  // After analyzing, refetch to get the new analysis id and favorite state
  useEffect(() => {
    if (!placeId || !analysis) return;
    let cancelled = false;
    leadsApi.list().then((list) => {
      if (!cancelled) {
        const found = list.find((a) => a.lead?.placeId === placeId || a.lead?.id === placeId);
        setLeadAnalysisItem((prev) => found ?? prev);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [placeId, analysis]);

  const handleToggleFavorite = async () => {
    if (!leadAnalysisItem || togglingFavorite) return;
    const next = !leadAnalysisItem.isFavorite;
    const prevFavorite = leadAnalysisItem.isFavorite;
    setTogglingFavorite(true);
    setLeadAnalysisItem((prev) => (prev ? { ...prev, isFavorite: next } : null));
    try {
      const updated = await leadsApi.toggleFavorite(leadAnalysisItem.id, next);
      const newFavorite = Boolean(updated?.isFavorite ?? next);
      setLeadAnalysisItem((prev) => (prev?.id === updated?.id ? { ...prev, isFavorite: newFavorite } : prev));
      addToast('success', newFavorite ? t('page.leadDetail.toast.favoriteAdded') : t('page.leadDetail.toast.favoriteRemoved'));
    } catch {
      setLeadAnalysisItem((prev) => (prev ? { ...prev, isFavorite: prevFavorite } : null));
      addToast('error', t('page.leadDetail.toast.favoriteError'));
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handleSaveLead = async () => {
    if (!place || savingLead) return;
    setSavingLead(true);
    try {
      const saved = await leadsApi.save({
        placeId: place.id,
        name: place.displayName?.text ?? place.id,
        address: place.formattedAddress,
        phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber,
        website: place.websiteUri ?? (place as PlaceDetail).website,
        rating: place.rating,
        reviewCount: place.userRatingCount,
        types: place.types,
        businessStatus: place.businessStatus,
      });
      setLeadAnalysisItem(saved);
      addToast('success', t('page.leadDetail.toast.saved'));
    } catch {
      addToast('error', t('page.leadDetail.toast.saveError'));
    } finally {
      setSavingLead(false);
    }
  };

  // Load tags for this lead
  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    tagsApi.list(placeId).then((data) => {
      if (!cancelled) setTags(data.tags);
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [placeId]);

  const trackAction = (action: string) => {
    activityApi.track({ action, metadata: { placeId, leadName: place?.displayName?.text || placeId } }).catch(() => { });
  };

  const handleCopyEmail = () => {
    const emails = place ? getEmails(place) : [];
    const email = emails[0];
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    });
    trackAction('COPY_EMAIL');
  };

  const handleCopyPhone = () => {
    const phoneRaw = place?.nationalPhoneNumber || place?.internationalPhoneNumber || '';
    if (!phoneRaw) return;
    navigator.clipboard.writeText(phoneRaw).then(() => {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    });
    trackAction('COPY_PHONE');
  };

  const handleAddTag = async (label: string, color: string) => {
    if (!placeId || !label.trim()) return;
    try {
      const { tag } = await tagsApi.add({ leadId: placeId, label: label.trim(), color });
      setTags((prev) => [...prev.filter((t) => t.label !== tag.label), tag]);
      setNewTag('');
      setShowTagInput(false);
    } catch { /* */ }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await tagsApi.remove(tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch { /* */ }
  };

  useEffect(() => {
    if (placeFromState?.id && placeFromState.id === placeId) {
      setPlace(placeFromState);
      return;
    }
    if (!placeId) {
      navigate('/dashboard/resultados', { replace: true });
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    searchApi
      .details(placeId)
      .then((detail) => {
        if (!cancelled) setPlace(detail);
      })
      .catch(() => {
        if (!cancelled) {
          addToast('error', t('page.leadDetail.toast.loadError'));
          setPlace(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [placeId, placeFromState, navigate, addToast]);

  const handleAnalyze = useCallback(() => {
    if (!place?.id || analyzing) return;
    setAnalyzing(true);
    setCurrentStep(null);

    const payload = buildAnalyzePayload(place, locale);

    streamAbortRef.current = analyzeStream(payload as unknown as Record<string, unknown>, {
      onProgress: (step) => {
        setCurrentStep(step);
      },
      onResult: (result) => {
        setAnalysis(result);
        setAnalyzing(false);
        setCurrentStep(null);
        streamAbortRef.current = null;
        window.dispatchEvent(new Event('refresh-user'));
        addToast('success', result.aiProvider ? t('page.leadDetail.toast.analyzeDoneWithProvider', { provider: getAnalysisProviderLabel(result.aiProvider, t) ?? result.aiProvider }) : t('page.leadDetail.toast.analyzeDone'));
      },
      onError: (msg) => {
        setAnalyzing(false);
        setCurrentStep(null);
        streamAbortRef.current = null;
        addToast('error', msg);
      },
    }, { locale, t });
  }, [place, analyzing, addToast, t, locale]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => { streamAbortRef.current?.abort(); };
  }, []);

  if (!placeId) return null;
  if (loadingDetails && !place) return <LeadDetailLoading />;
  if (!place) return <LeadDetailNotFound onBack={() => navigate(-1)} />;

  return (
    <LeadDetailContent
      user={user}
      place={place}
      analysis={analysis}
      tags={tags}
      leadAnalysisItem={leadAnalysisItem}
      togglingFavorite={togglingFavorite}
      showTagInput={showTagInput}
      newTag={newTag}
      analyzing={analyzing}
      currentStep={currentStep}
      copiedPhone={copiedPhone}
      copiedEmail={copiedEmail}
      savingLead={savingLead}
      onBack={() => navigate(-1)}
      onToggleFavorite={handleToggleFavorite}
      onSaveLead={handleSaveLead}
      onCopyPhone={handleCopyPhone}
      onCopyEmail={handleCopyEmail}
      onAddTag={handleAddTag}
      onRemoveTag={handleRemoveTag}
      setNewTag={setNewTag}
      setShowTagInput={setShowTagInput}
      onAnalyze={handleAnalyze}
      onOpenCompanyProfile={() => navigate('/dashboard/empresa')}
      trackAction={trackAction}
      onCrmSuccess={(msg) => addToast('success', msg)}
      onCrmError={(msg) => addToast('error', msg)}
      onCrmWarning={(msg) => addToast('warning', msg)}
      onLeadUpdated={setLeadAnalysisItem}
    />
  );
}
