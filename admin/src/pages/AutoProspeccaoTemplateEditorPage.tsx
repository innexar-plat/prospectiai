import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { autoProspeccaoAdminApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Save, Eye, Code2, RefreshCw } from 'lucide-react';

const PREVIEW_COMPANY = 'Empresa Exemplo Ltda';

function interpolateVars(text: string, company: string) {
  return text
    .replace(/\{\{razaoSocial\}\}/g, company)
    .replace(/\{\{empresa\}\}/g, company)
    .replace(/\{\{nome\}\}/g, company);
}

function buildPreviewDoc(bodyHtml: string, subject: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${subject}</title><style>body{margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222;background:#fff}a{color:#7c3aed}img{max-width:100%;height:auto}table{border-collapse:collapse}</style></head><body>${bodyHtml}</body></html>`;
}

const TEMPLATE_TYPES = [
  { value: 'HOT_COLD_INTRO', label: 'HOT — Intro (D+0)' },
  { value: 'HOT_FOLLOW_NO_OPEN', label: 'HOT — Follow-up se não abriu (D+3)' },
  { value: 'HOT_FOLLOW_OPENED', label: 'HOT — Follow-up se abriu mas não clicou (D+3)' },
  { value: 'HOT_LAST_ATTEMPT', label: 'HOT — Última tentativa + oferta (D+7)' },
  { value: 'WARM_WEEK1_EDUCATION', label: 'WARM — Semana 1: Educação' },
  { value: 'WARM_WEEK2_VALUE', label: 'WARM — Semana 2: Valor / Insight' },
  { value: 'WARM_WEEK3_SOCIAL', label: 'WARM — Semana 3: Prova Social' },
  { value: 'WARM_WEEK4_OFFER', label: 'WARM — Semana 4: Oferta trial' },
  { value: 'CUSTOM', label: 'Personalizado' },
];

const EMPTY_FORM = {
  name: '',
  type: 'HOT_COLD_INTRO',
  subject: '',
  preheader: '',
  bodyHtml: '',
  bodyText: '',
  targetCnae: '',
  targetSegment: '',
  isSystem: true,
};

export function AutoProspeccaoTemplateEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [previewCompany, setPreviewCompany] = useState(PREVIEW_COMPANY);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (isNew) return;
    autoProspeccaoAdminApi.templates
      .get(id!)
      .then((res) => {
        const t = res.data;
        setForm({
          name: t.name,
          type: t.type,
          subject: t.subject,
          preheader: t.preheader ?? '',
          bodyHtml: t.bodyHtml,
          bodyText: t.bodyText ?? '',
          targetCnae: t.targetCnae ?? '',
          targetSegment: t.targetSegment ?? '',
          isSystem: t.isSystem,
        });
      })
      .catch(() => showToast('error', 'Erro ao carregar template.'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Sync iframe when preview tab is active
  useEffect(() => {
    if (activeTab !== 'preview') return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = buildPreviewDoc(
      interpolateVars(form.bodyHtml, previewCompany),
      interpolateVars(form.subject, previewCompany),
    );
  }, [activeTab, form.bodyHtml, form.subject, previewCompany]);

  const handleSave = async () => {
    if (!form.name.trim()) return showToast('error', 'Nome é obrigatório.');
    if (!form.subject.trim()) return showToast('error', 'Assunto é obrigatório.');
    if (!form.bodyHtml.trim()) return showToast('error', 'Corpo HTML é obrigatório.');

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type as import('@/lib/api').AutoProspTemplateType,
        subject: form.subject.trim(),
        preheader: form.preheader.trim() || null,
        bodyHtml: form.bodyHtml,
        bodyText: form.bodyText.trim() || null,
        targetCnae: form.targetCnae.trim() || null,
        targetSegment: form.targetSegment.trim() || null,
        isSystem: form.isSystem,
      };
      if (isNew) {
        await autoProspeccaoAdminApi.templates.create(payload);
        showToast('success', 'Template criado com sucesso!');
        setTimeout(() => navigate('..'), 1200);
      } else {
        await autoProspeccaoAdminApi.templates.update(id!, payload);
        showToast('success', 'Template salvo com sucesso!');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Carregando template...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('..')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {isNew ? 'Novo Template' : `Editar: ${form.name || 'Template'}`}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : 'Salvar Template'}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* Name + Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Nome interno do template"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {TEMPLATE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject + Preheader */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assunto *</label>
            <input
              value={form.subject}
              onChange={(e) => set('subject', e.target.value)}
              placeholder="Assunto do email (suporta {{razaoSocial}})"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preheader</label>
            <input
              value={form.preheader}
              onChange={(e) => set('preheader', e.target.value)}
              placeholder="Texto de pré-visualização"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Segmentation */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNAE alvo</label>
            <input
              value={form.targetCnae}
              onChange={(e) => set('targetCnae', e.target.value)}
              placeholder="ex: 7020400"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segmento alvo</label>
            <input
              value={form.targetSegment}
              onChange={(e) => set('targetSegment', e.target.value)}
              placeholder="ex: consultorias, saas, agencias"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Is System */}
        <div className="flex items-center gap-3">
          <input
            id="isSystem"
            type="checkbox"
            checked={form.isSystem}
            onChange={(e) => set('isSystem', e.target.checked)}
            className="w-4 h-4 rounded accent-violet-600"
          />
          <label htmlFor="isSystem" className="text-sm font-medium text-gray-700">
            Template do sistema <span className="text-gray-400 font-normal">(visível para todos os workspaces)</span>
          </label>
        </div>
      </div>

      {/* Editor / Preview tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center border-b border-gray-200 px-4 pt-3 gap-1">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'editor'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            HTML Editor
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Pré-visualização
          </button>

          {activeTab === 'preview' && (
            <div className="ml-auto flex items-center gap-2 pb-1">
              <span className="text-xs text-gray-500">Empresa:</span>
              <input
                value={previewCompany}
                onChange={(e) => setPreviewCompany(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>
          )}
        </div>

        {/* Editor panel */}
        {activeTab === 'editor' && (
          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Corpo HTML *</label>
                <span className="text-xs text-gray-400">Variáveis: {'{{razaoSocial}}'}</span>
              </div>
              <textarea
                value={form.bodyHtml}
                onChange={(e) => set('bodyHtml', e.target.value)}
                rows={16}
                placeholder={'<p>Olá, {{razaoSocial}}!</p>\n<p>Seu texto aqui...</p>'}
                className="w-full text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plain Text <span className="text-gray-400 font-normal">(fallback — opcional)</span>
              </label>
              <textarea
                value={form.bodyText}
                onChange={(e) => set('bodyText', e.target.value)}
                rows={4}
                placeholder="Versão sem HTML para clientes que não suportam HTML"
                className="w-full text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {/* Preview panel */}
        {activeTab === 'preview' && (
          <div className="p-5">
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {/* Email client header mockup */}
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-16 shrink-0">De:</span>
                  <span className="text-gray-700 font-medium">Sua Empresa &lt;contato@suaempresa.com.br&gt;</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-16 shrink-0">Para:</span>
                  <span className="text-gray-700">contato@{previewCompany.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com.br</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-16 shrink-0">Assunto:</span>
                  <span className="text-gray-900 font-semibold">
                    {interpolateVars(form.subject, previewCompany) || <span className="text-gray-400 italic">Sem assunto</span>}
                  </span>
                </div>
                {form.preheader && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 w-16 shrink-0">Preheader:</span>
                    <span className="text-gray-500 italic">{interpolateVars(form.preheader, previewCompany)}</span>
                  </div>
                )}
              </div>
              {/* Email body */}
              {form.bodyHtml ? (
                <iframe
                  ref={iframeRef}
                  title="preview"
                  className="w-full border-0"
                  style={{ height: '500px' }}
                  sandbox="allow-same-origin"
                  srcDoc={buildPreviewDoc(
                    interpolateVars(form.bodyHtml, previewCompany),
                    interpolateVars(form.subject, previewCompany),
                  )}
                />
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  <Eye className="w-5 h-5 mr-2 opacity-40" />
                  Escreva o HTML no editor para ver a pré-visualização
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
