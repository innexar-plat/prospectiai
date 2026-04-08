import { useEffect, useState } from 'react';
import { adminApi, type CrmConfigPublic } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Activity, CheckCircle2, Save, Users } from 'lucide-react';

export function CrmIntegrationsPage() {
  const [rdConfig, setRdConfig] = useState<CrmConfigPublic | null>(null);
  const [hubspotConfig, setHubspotConfig] = useState<CrmConfigPublic | null>(null);
  const [agendorObs, setAgendorObs] = useState<{ connectedUsers: number; totalUsers: number; percentConnected: number; usesEnvFallback: boolean } | null>(null);
  const [hubspotObs, setHubspotObs] = useState<{ connectedUsers: number; totalUsers: number; percentConnected: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRd, setSavingRd] = useState(false);
  const [savingHubspot, setSavingHubspot] = useState(false);
  const [rdClientId, setRdClientId] = useState('');
  const [rdClientSecret, setRdClientSecret] = useState('');
  const [hsClientId, setHsClientId] = useState('');
  const [hsClientSecret, setHsClientSecret] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadConfig = () => {
    setLoading(true);
    Promise.all([
      adminApi.crmConfig.getConfig('rdstation'),
      adminApi.crmConfig.getConfig('hubspot'),
      adminApi.agendorObservability.get(),
      adminApi.hubspotObservability.get(),
    ])
      .then(([rd, hs, agObs, hsObs]) => {
        setRdConfig(rd);
        setHubspotConfig(hs);
        setAgendorObs(agObs);
        setHubspotObs(hsObs);
        setRdClientId(rd.clientId ?? '');
        setRdClientSecret('');
        setHsClientId(hs.clientId ?? '');
        setHsClientSecret('');
      })
      .catch((err) => {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao carregar integração.' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleSaveRd = async () => {
    setSavingRd(true);
    setToast(null);
    try {
      const updated = await adminApi.crmConfig.updateConfig({
        provider: 'rdstation',
        clientId: rdClientId.trim(),
        clientSecret: rdClientSecret.trim() || undefined,
      });
      setRdConfig(updated);
      setRdClientSecret('');
      setToast({ type: 'success', message: 'App do RD salvo com sucesso.' });
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar configuração.' });
    } finally {
      setSavingRd(false);
    }
  };

  const handleSaveHubspot = async () => {
    setSavingHubspot(true);
    setToast(null);
    try {
      const updated = await adminApi.crmConfig.updateConfig({
        provider: 'hubspot',
        clientId: hsClientId.trim(),
        clientSecret: hsClientSecret.trim() || undefined,
      });
      setHubspotConfig(updated);
      setHsClientSecret('');
      setToast({ type: 'success', message: 'App do HubSpot salvo com sucesso.' });
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar configuração.' });
    } finally {
      setSavingHubspot(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Integrações CRM</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure o OAuth do RD Station e HubSpot. Acompanhe a observabilidade de conexões Agendor e HubSpot.
        </p>
        {toast && (
          <p className={toast.type === 'success' ? 'text-sm text-emerald-600 mt-2' : 'text-sm text-red-600 mt-2'}>
            {toast.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* RD Station OAuth Config */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3 text-gray-900 font-medium mb-1">
            <img src="/rd-station-default.svg" alt="RD Station" className="h-8 w-8 rounded-md bg-white p-1" />
            RD Station
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Configure o app OAuth do RD para habilitar conexão por usuário no painel principal.
          </p>

          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-900 mb-2">Passos rápidos no RD</p>
                <ol className="list-decimal pl-5 space-y-1 text-gray-500">
                  <li>Acesse o painel de apps do RD Station.</li>
                  <li>Crie um app para a Precision IA.</li>
                  <li>Use callback: <span className="text-gray-700">/api/integrations/rdstation/oauth/callback</span>.</li>
                  <li>Copie Client ID e Client Secret abaixo.</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Client ID</label>
                <Input
                  value={rdClientId}
                  onChange={(e) => setRdClientId(e.target.value)}
                  placeholder="Cole o Client ID do app"
                  className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Client Secret</label>
                <Input
                  type="password"
                  value={rdClientSecret}
                  onChange={(e) => setRdClientSecret(e.target.value)}
                  placeholder={rdConfig?.hasClientSecret ? '•••••••• (deixe em branco para manter)' : 'Cole o Client Secret do app'}
                  className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 placeholder-gray-400"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle2 className={rdConfig?.configured ? 'w-4 h-4 text-emerald-600' : 'w-4 h-4 text-gray-400'} />
                {rdConfig?.configured ? 'App configurado e pronto para conexão dos usuários.' : 'App ainda não configurado.'}
              </div>

              <Button
                onClick={handleSaveRd}
                disabled={savingRd || !rdClientId.trim()}
                isLoading={savingRd}
                className="bg-violet-600 hover:bg-violet-500 text-white border-0"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar app RD
              </Button>
            </div>
          )}
        </div>

        {/* HubSpot OAuth Config */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3 text-gray-900 font-medium mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#ff7a59] text-white text-xs font-bold">HS</span>
            HubSpot
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Configure o app OAuth do HubSpot para habilitar conexão por usuário no painel principal.
          </p>

          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-900 mb-2">Passos rápidos no HubSpot</p>
                <ol className="list-decimal pl-5 space-y-1 text-gray-500">
                  <li>Acesse o <a href="https://developers.hubspot.com/" target="_blank" rel="noopener noreferrer" className="text-[#ff7a59] underline">Portal de Desenvolvedores</a> do HubSpot.</li>
                  <li>Crie um app público para a Precision IA.</li>
                  <li>Use callback: <span className="text-gray-700">/api/integrations/hubspot/oauth/callback</span>.</li>
                  <li>Copie Client ID e Client Secret abaixo.</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Client ID</label>
                <Input
                  value={hsClientId}
                  onChange={(e) => setHsClientId(e.target.value)}
                  placeholder="Cole o Client ID do app"
                  className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Client Secret</label>
                <Input
                  type="password"
                  value={hsClientSecret}
                  onChange={(e) => setHsClientSecret(e.target.value)}
                  placeholder={hubspotConfig?.hasClientSecret ? '•••••••• (deixe em branco para manter)' : 'Cole o Client Secret do app'}
                  className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 placeholder-gray-400"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle2 className={hubspotConfig?.configured ? 'w-4 h-4 text-emerald-600' : 'w-4 h-4 text-gray-400'} />
                {hubspotConfig?.configured ? 'App configurado e pronto para conexão dos usuários.' : 'App ainda não configurado.'}
              </div>

              <Button
                onClick={handleSaveHubspot}
                disabled={savingHubspot || !hsClientId.trim()}
                isLoading={savingHubspot}
                className="bg-[#ff7a59] hover:bg-[#ff8f73] text-gray-900 border-0"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar app HubSpot
              </Button>
            </div>
          )}
        </div>

        {/* Agendor Observabilidade */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3 text-gray-900 font-medium mb-1">
            <img src="/agendorlogo.svg" alt="Agendor" className="h-8 w-8 rounded-md bg-white p-1" />
            Agendor Observabilidade
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Tokens são gerenciados por cada cliente no Dashboard &gt; Integrações. Acompanhe adoção da integração.
          </p>

          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
                    <Users className="h-4 w-4" />
                    Usuários conectados
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{agendorObs?.connectedUsers ?? 0}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
                    <Activity className="h-4 w-4" />
                    Adoção
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{agendorObs?.percentConnected ?? 0}%</p>
                  <p className="text-xs text-gray-500 mt-1">de {agendorObs?.totalUsers ?? 0} usuários totais</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-900 mb-1">Fluxo atual</p>
                <p className="text-gray-500">
                  Cada cliente informa seu próprio token da Agendor na página de Integrações do painel principal.
                </p>
                {agendorObs?.usesEnvFallback && (
                  <p className="text-amber-600 mt-2">
                    Ambiente com AGENDOR_API_TOKEN ativo: funciona como fallback global.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* HubSpot Observabilidade */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3 text-gray-900 font-medium mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#ff7a59] text-white text-xs font-bold">HS</span>
            HubSpot Observabilidade
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Conexão OAuth gerenciada por cada cliente no Dashboard &gt; Integrações. Acompanhe adoção.
          </p>

          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
                    <Users className="h-4 w-4" />
                    Usuários conectados
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{hubspotObs?.connectedUsers ?? 0}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
                    <Activity className="h-4 w-4" />
                    Adoção
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{hubspotObs?.percentConnected ?? 0}%</p>
                  <p className="text-xs text-gray-500 mt-1">de {hubspotObs?.totalUsers ?? 0} usuários totais</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-900 mb-1">Fluxo atual</p>
                <p className="text-gray-500">
                  Cada cliente conecta via OAuth na página de Integrações do painel principal.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}