import { useEffect, useState } from 'react';
import { emailMarketingApi, type WeeklyReportConfigItem } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { BarChart3, Save, Eye, Settings } from 'lucide-react';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function WeeklyReportConfigPage() {
  const [config, setConfig] = useState<WeeklyReportConfigItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Form
  const [enabled, setEnabled] = useState(true);
  const [sendDay, setSendDay] = useState(1);
  const [sendHour, setSendHour] = useState(8);
  const [customTitle, setCustomTitle] = useState('');
  const [customHighlight, setCustomHighlight] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [footerPromo, setFooterPromo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await emailMarketingApi.weeklyReport.get();
      setConfig(res.data);
      setEnabled(res.data.enabled);
      setSendDay(res.data.sendDay);
      setSendHour(res.data.sendHour);
      setCustomTitle(res.data.customTitle ?? '');
      setCustomHighlight(res.data.customHighlight ?? '');
      setCtaLabel(res.data.ctaLabel ?? '');
      setCtaUrl(res.data.ctaUrl ?? '');
      setFooterPromo(res.data.footerPromo ?? '');
    } catch {
      setToast({ type: 'error', message: 'Erro ao carregar configuração.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await emailMarketingApi.weeklyReport.update({
        enabled,
        sendDay,
        sendHour,
        customTitle: customTitle || null,
        customHighlight: customHighlight || null,
        ctaLabel: ctaLabel || null,
        ctaUrl: ctaUrl || null,
        footerPromo: footerPromo || null,
      });
      setConfig(updated.data);
      setToast({ type: 'success', message: 'Configuração salva!' });
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      const html = await emailMarketingApi.weeklyReport.preview();
      setPreviewHtml(html as unknown as string);
      setShowPreview(true);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao gerar preview.' });
    } finally {
      setLoadingPreview(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-100 rounded w-64" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
            Relatório Semanal
          </h1>
          <p className="text-sm text-gray-500 mt-1">Configure o envio automático de relatórios semanais</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="ghost" onClick={handlePreview} disabled={loadingPreview} className="flex items-center gap-2 flex-1 sm:flex-initial justify-center">
            <Eye className="w-4 h-4" /> {loadingPreview ? 'Gerando...' : 'Preview'}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2 flex-1 sm:flex-initial justify-center">
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" /> Configurações Gerais
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Envio ativo</span>
                <p className="text-xs text-gray-500">Controla se os relatórios são enviados automaticamente</p>
              </div>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dia da semana</label>
                <Select value={sendDay} onChange={(e) => setSendDay(Number(e.target.value))}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horário (UTC)</label>
                <Select value={sendHour} onChange={(e) => setSendHour(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </Select>
              </div>
            </div>

          </div>
        </div>

        {/* Content Customization */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Personalização do Conteúdo</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título do relatório</label>
              <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Padrão: Resumo da Semana" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texto de destaque</label>
              <Input value={customHighlight} onChange={(e) => setCustomHighlight(e.target.value)} placeholder="Ex: Novidade! Agora com integração WhatsApp" />
              <p className="text-xs text-gray-400 mt-1">Aparece em destaque no topo do relatório</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto do CTA</label>
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Ver relatório completo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL do CTA</label>
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://app.prospector.com.br/reports" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promoção no rodapé</label>
              <Input value={footerPromo} onChange={(e) => setFooterPromo(e.target.value)} placeholder="Ex: Upgrade para o plano Pro com 20% OFF" />
              <p className="text-xs text-gray-400 mt-1">Mensagem promocional exibida no final do relatório (apenas para free users)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
        <strong>Como funciona:</strong> O relatório semanal é enviado automaticamente para todos os usuários com <code className="bg-blue-100 px-1 rounded">notifyWeeklyReport = true</code>.
        Cada usuário recebe métricas personalizadas com base na sua atividade da semana.
        {config && (
          <p className="mt-2 text-xs text-blue-600">
            Último update: {new Date(config.updatedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Preview — Relatório Semanal</h3>
              <button onClick={() => setShowPreview(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                srcDoc={previewHtml}
                className="w-full border border-gray-200 rounded-lg"
                style={{ height: '600px' }}
                title="Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
