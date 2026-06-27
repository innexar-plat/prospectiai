import { useState, useMemo } from 'react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { ChevronDown, Zap, Target, MessageSquare, TrendingUp, CheckCircle, Copy, AlertCircle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';

type AccordionSection = {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

const NICHO_KEYS = [
  'marketingAgencies',
  'b2bConsulting',
  'softwareHouses',
  'accounting',
  'ecommerce',
  'franchisees',
] as const;

const PLAN_KEYS = ['starter', 'growth', 'business', 'enterprise'] as const;

function renderParagraphs(text: string) {
  return text.split('\n\n').map((paragraph) => (
    <p key={paragraph.slice(0, 24)}>{paragraph}</p>
  ));
}

export default function AfiliadoDicasPage() {
  const { t } = useI18n();
  useOutletContext<{ user: SessionUser }>();
  const [expanded, setExpanded] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const sections: AccordionSection[] = useMemo(() => [
    {
      id: 'inicio',
      title: t('page.afiliado.dicas.section.inicio.title'),
      icon: <Zap className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 p-4 rounded-lg border border-violet-200">
            <h4 className="font-semibold text-slate-900 mb-3">{t('page.afiliado.dicas.section.inicio.journeyTitle')}</h4>
            <ol className="space-y-2 text-sm text-slate-700">
              {[1, 2, 3, 4, 5].map((step) => (
                <li key={step} className="flex gap-3">
                  <span className="font-bold text-violet-600 w-6">{step}.</span>
                  <span>{t(`page.afiliado.dicas.section.inicio.step${step}`)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900">{t('page.afiliado.dicas.section.inicio.tip')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'nicho',
      title: t('page.afiliado.dicas.section.nicho.title'),
      icon: <Target className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{t('page.afiliado.dicas.section.nicho.intro')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {NICHO_KEYS.map((key) => (
              <div key={key} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-900 text-sm">{t(`page.afiliado.dicas.nicho.${key}`)}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {t('page.afiliado.dicas.demand')}:{' '}
                  <span className="text-orange-600 font-bold">{t(`page.afiliado.dicas.nicho.${key}.demand`)}</span>
                </p>
                <p className="text-xs text-slate-600">
                  {t('page.afiliado.dicas.clientsPerMonth')}: {t(`page.afiliado.dicas.nicho.${key}.clients`)}
                </p>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-900">{t('page.afiliado.dicas.section.nicho.proTip')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'busca',
      title: t('page.afiliado.dicas.section.busca.title'),
      icon: <Target className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-slate-900 mb-1">{t('page.afiliado.dicas.section.busca.step1.title')}</h4>
              <p className="text-sm text-slate-600">{t('page.afiliado.dicas.section.busca.step1.desc')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-1">{t('page.afiliado.dicas.section.busca.step2.title')}</h4>
              <p className="text-sm text-slate-600">
                <code className="bg-slate-100 px-2 py-1 rounded">{t('page.afiliado.dicas.section.busca.step2.desc')}</code>
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-1">{t('page.afiliado.dicas.section.busca.step3.title')}</h4>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li>{t('page.afiliado.dicas.section.busca.step3.filter1')}</li>
                <li>{t('page.afiliado.dicas.section.busca.step3.filter2')}</li>
                <li>{t('page.afiliado.dicas.section.busca.step3.filter3')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-1">{t('page.afiliado.dicas.section.busca.step4.title')}</h4>
              <p className="text-sm text-slate-600">{t('page.afiliado.dicas.section.busca.step4.desc')}</p>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-900">{t('page.afiliado.dicas.section.busca.result')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'abordagem',
      title: t('page.afiliado.dicas.section.abordagem.title'),
      icon: <MessageSquare className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">{t('page.afiliado.dicas.section.abordagem.email.title')}</h4>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2">
                <p>{t('page.afiliado.dicas.section.abordagem.email.subject')}</p>
                {renderParagraphs(t('page.afiliado.dicas.section.abordagem.email.body'))}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 flex items-center gap-2"
                onClick={() => copyToClipboard(t('page.afiliado.dicas.section.abordagem.email.body'))}
              >
                <Copy className="w-4 h-4" />
                {t('page.afiliado.dicas.copyTemplate')}
              </Button>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">{t('page.afiliado.dicas.section.abordagem.whatsapp.title')}</h4>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700">
                {renderParagraphs(t('page.afiliado.dicas.section.abordagem.whatsapp.body'))}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 flex items-center gap-2"
                onClick={() => copyToClipboard(t('page.afiliado.dicas.section.abordagem.whatsapp.body'))}
              >
                <Copy className="w-4 h-4" />
                {t('page.afiliado.dicas.copyTemplate')}
              </Button>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">{t('page.afiliado.dicas.section.abordagem.followup.title')}</h4>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700">
                <p>{t('page.afiliado.dicas.section.abordagem.followup.body')}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 flex items-center gap-2"
                onClick={() => copyToClipboard(t('page.afiliado.dicas.section.abordagem.followup.body'))}
              >
                <Copy className="w-4 h-4" />
                {t('page.afiliado.dicas.copyTemplate')}
              </Button>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-900">{t('page.afiliado.dicas.section.abordagem.responseRate')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'rotina',
      title: t('page.afiliado.dicas.section.rotina.title'),
      icon: <Lightbulb className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            {(['morning', 'afternoon', 'evening'] as const).map((period) => (
              <div key={period} className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="font-semibold text-slate-900 mb-2">{t(`page.afiliado.dicas.section.rotina.${period}.title`)}</p>
                <ul className="text-sm text-slate-600 space-y-1">
                  {[1, 2, 3].map((item) => (
                    <li key={item}>{t(`page.afiliado.dicas.section.rotina.${period}.item${item}`)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-900">{t('page.afiliado.dicas.section.rotina.goal')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'checklist',
      title: t('page.afiliado.dicas.section.checklist.title'),
      icon: <CheckCircle className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-slate-900 mb-3">{t('page.afiliado.dicas.section.checklist.days1to3')}</h4>
            <div className="space-y-2">
              {(['emailConfirmed', 'programActivated', 'linkCopied', 'nicheDefined'] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-white/50 p-2 rounded">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span>{t(`page.afiliado.dicas.section.checklist.${key}`)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-slate-900 mb-3">{t('page.afiliado.dicas.section.checklist.days4to7')}</h4>
            <div className="space-y-2">
              {(['companiesMapped', 'contactsSent', 'followupsDone', 'conversionsMonitored'] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-white/50 p-2 rounded">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span>{t(`page.afiliado.dicas.section.checklist.${key}`)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'comissoes',
      title: t('page.afiliado.dicas.section.comissoes.title'),
      icon: <TrendingUp className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">{t('page.afiliado.dicas.section.comissoes.percentTitle')}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {PLAN_KEYS.map((plan) => (
                  <div key={plan} className="bg-gradient-to-br from-violet-50 to-indigo-50 p-2 rounded border border-violet-200">
                    <p className="font-bold text-violet-700">{t(`page.afiliado.dicas.plan.${plan}`)}</p>
                    <p className="text-slate-600">
                      {t(`page.afiliado.dicas.plan.${plan}.price`)}
                      {t('page.afiliado.dicas.plan.perMonth')}
                    </p>
                    <p className="text-violet-600 font-bold mt-1">{t(`page.afiliado.dicas.plan.${plan}.commission`)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded">
              <p className="text-sm text-amber-900">{t('page.afiliado.dicas.section.comissoes.example')}</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-slate-900">{t('page.afiliado.dicas.section.comissoes.scheduleTitle')}</h4>
            <div className="text-sm text-slate-600 space-y-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <p key={n}>{t(`page.afiliado.dicas.section.comissoes.schedule${n}`)}</p>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'faq',
      title: t('page.afiliado.dicas.section.faq.title'),
      icon: <AlertCircle className="w-5 h-5" />,
      content: (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="font-semibold text-slate-900 text-sm mb-1">{t(`page.afiliado.dicas.section.faq.q${n}`)}</p>
              <p className="text-sm text-slate-600">{t(`page.afiliado.dicas.section.faq.a${n}`)}</p>
            </div>
          ))}
        </div>
      ),
    },
  ], [t]);

  return (
    <div>
      <HeaderDashboard
        title={t('page.afiliado.dicas.title')}
        subtitle={t('page.afiliado.dicas.subtitle')}
      />

      <div className="p-4 md:p-6 max-w-4xl">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-2">{t('page.afiliado.dicas.hero.title')}</h2>
          <p className="text-violet-100">{t('page.afiliado.dicas.hero.desc')}</p>
        </div>

        <div className="space-y-2">
          {sections.map((section) => (
            <div key={section.id} className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(expanded === section.id ? null : section.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-surface transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-violet-600">{section.icon}</div>
                  <h3 className="font-semibold text-slate-900 text-left">{section.title}</h3>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-muted transition-transform ${
                    expanded === section.id ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {expanded === section.id && (
                <div className="px-4 pb-4 border-t border-border bg-white/50">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 rounded-lg text-center">
          <h3 className="font-bold text-slate-900 mb-2">{t('page.afiliado.dicas.footer.title')}</h3>
          <p className="text-sm text-slate-700 mb-4">{t('page.afiliado.dicas.footer.desc')}</p>
          <div className="text-sm text-green-700 font-semibold">{t('page.afiliado.dicas.footer.stat')}</div>
        </div>
      </div>
    </div>
  );
}
