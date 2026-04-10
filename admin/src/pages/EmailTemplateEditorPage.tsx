import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { emailMarketingApi, type EmailTemplateCreateBody } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ArrowLeft, Save, Eye, Trash2, Plus, GripVertical } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  PROMOTION: 'Promoção',
  WEEKLY_REPORT: 'Relatório Semanal',
  FEATURE_ANNOUNCEMENT: 'Nova Feature',
  REENGAGEMENT: 'Reengajamento',
  CUSTOM: 'Customizado',
};

export function EmailTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState('PROMOTION');
  const [status, setStatus] = useState('DRAFT');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [paragraphs, setParagraphs] = useState<string[]>(['']);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [badge, setBadge] = useState('');
  const [badgeColor, setBadgeColor] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [accentColor, setAccentColor] = useState('#8B5CF6');
  const [legalNote, setLegalNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    emailMarketingApi.templates
      .get(id)
      .then(({ data: t }) => {
        setName(t.name);
        setSlug(t.slug);
        setType(t.type);
        setStatus(t.status);
        setSubject(t.subject);
        setPreheader(t.preheader ?? '');
        setParagraphs(t.body?.paragraphs?.length ? t.body.paragraphs : ['']);
        setBenefits(t.body?.benefits ?? []);
        setBadge(t.body?.badge ?? '');
        setBadgeColor(t.body?.badgeColor ?? '');
        setSubtitle(t.body?.subtitle ?? '');
        setCtaLabel(t.ctaLabel ?? '');
        setCtaUrl(t.ctaUrl ?? '');
        setAccentColor(t.accentColor ?? '#8B5CF6');
        setLegalNote(t.body?.legalNote ?? '');
        setExpiresAt(t.body?.expiresAt ?? '');
      })
      .catch(() => setToast({ type: 'error', message: 'Erro ao carregar template.' }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    try {
      const body: Partial<EmailTemplateCreateBody> = {
        name: name.trim(),
        slug: slug.trim(),
        type: type as EmailTemplateCreateBody['type'],
        status: status as EmailTemplateCreateBody['status'],
        subject: subject.trim(),
        preheader: preheader.trim() || null,
        body: {
          paragraphs: paragraphs.filter(p => p.trim()),
          benefits: benefits.filter(b => b.trim()),
          badge: badge.trim() || undefined,
          badgeColor: badgeColor.trim() || undefined,
          subtitle: subtitle.trim() || undefined,
          legalNote: legalNote.trim() || undefined,
          expiresAt: expiresAt || undefined,
        },
        ctaLabel: ctaLabel.trim() || null,
        ctaUrl: ctaUrl.trim() || null,
        accentColor: accentColor.trim() || null,
      };

      await emailMarketingApi.templates.update(id!, body);
      setToast({ type: 'success', message: 'Template salvo!' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = useCallback(async () => {
    if (!id) return;
    try {
      // Save first then generate preview
      await handleSave();
      const html = await emailMarketingApi.templates.preview(id, 'Usuário Teste');
      setPreviewHtml(html);
      setShowPreview(true);
    } catch {
      setToast({ type: 'error', message: 'Erro ao gerar preview.' });
    }
  }, [id, name, slug, type, subject, paragraphs, benefits, badge, ctaLabel, ctaUrl, accentColor]);

  const addParagraph = () => setParagraphs([...paragraphs, '']);
  const removeParagraph = (i: number) => setParagraphs(paragraphs.filter((_, idx) => idx !== i));
  const updateParagraph = (i: number, val: string) => {
    const copy = [...paragraphs]; copy[i] = val; setParagraphs(copy);
  };

  const addBenefit = () => setBenefits([...benefits, '']);
  const removeBenefit = (i: number) => setBenefits(benefits.filter((_, idx) => idx !== i));
  const updateBenefit = (i: number, val: string) => {
    const copy = [...benefits]; copy[i] = val; setBenefits(copy);
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/email-templates')} className="p-2 rounded-lg hover:bg-gray-100 shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Editar Template</h1>
            <p className="text-sm text-gray-500 truncate">{name || 'Sem nome'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" onClick={handlePreview} className="flex items-center gap-2">
            <Eye className="w-4 h-4" /> Preview
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-4">
          {/* Meta */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Informações</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Slug</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <Select value={type} onChange={(e) => setType(e.target.value)}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="DRAFT">Rascunho</option>
                  <option value="ACTIVE">Ativo</option>
                  <option value="ARCHIVED">Arquivado</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Email Content */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Conteúdo do Email</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assunto</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto do email" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preheader (preview na inbox)</label>
                <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Texto de preview" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Subtítulo</label>
                <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtítulo opcional" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Badge (chip acima do título)</label>
                <div className="flex gap-2">
                  <Input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Ex: Oferta Especial" className="flex-1" />
                  <input type="color" value={badgeColor || '#8B5CF6'} onChange={(e) => setBadgeColor(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer" />
                </div>
              </div>
            </div>
          </div>

          {/* Paragraphs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Parágrafos</h2>
              <button onClick={addParagraph} className="text-violet-600 hover:text-violet-700 text-sm flex items-center gap-1">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {paragraphs.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-gray-300 mt-3 shrink-0" />
                  <textarea
                    value={p}
                    onChange={(e) => updateParagraph(i, e.target.value)}
                    placeholder={`Parágrafo ${i + 1}`}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                  />
                  {paragraphs.length > 1 && (
                    <button onClick={() => removeParagraph(i)} className="p-1.5 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Benefícios (lista com check)</h2>
              <button onClick={addBenefit} className="text-violet-600 hover:text-violet-700 text-sm flex items-center gap-1">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
            {benefits.length === 0 && <p className="text-sm text-gray-400">Nenhum benefício adicionado.</p>}
            <div className="space-y-2">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <Input value={b} onChange={(e) => updateBenefit(i, e.target.value)} placeholder={`Benefício ${i + 1}`} className="flex-1" />
                  <button onClick={() => removeBenefit(i)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CTA & Style */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">CTA e Estilo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Texto do Botão</label>
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Ex: Aproveitar oferta" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">URL do Botão</label>
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/dashboard/plans" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cor de Destaque</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer" />
                  <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Validade (promoção)</label>
                <Input type="date" value={expiresAt ? expiresAt.split('T')[0] : ''} onChange={(e) => setExpiresAt(e.target.value ? `${e.target.value}T23:59:59Z` : '')} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nota Legal (rodapé)</label>
              <Input value={legalNote} onChange={(e) => setLegalNote(e.target.value)} placeholder="Ex: Oferta válida para novos assinantes." />
            </div>
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="lg:sticky lg:top-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Preview</span>
              <Button variant="ghost" size="sm" onClick={handlePreview} className="text-xs">
                <Eye className="w-3.5 h-3.5 mr-1" /> Atualizar
              </Button>
            </div>
            <div className="h-[400px] lg:h-[700px] overflow-auto bg-gray-100">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Clique em &ldquo;Preview&rdquo; para ver o email renderizado
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">Preview do Email</h2>
              <button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-gray-700 text-lg font-bold">×</button>
            </div>
            <div className="flex-1 overflow-auto">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full min-h-[500px] border-0"
                title="Full Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
