import { useEffect, useState } from 'react';
import { adminApi, type EmailConfigPublic } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Mail, CheckCircle, XCircle, Save } from 'lucide-react';

export function EmailPage() {
  const [config, setConfig] = useState<EmailConfigPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state (provider + credentials)
  const [provider, setProvider] = useState<'resend' | 'smtp'>('resend');
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');

  const loadConfig = () => {
    setLoading(true);
    Promise.all([adminApi.email.status(), adminApi.email.getConfig()])
      .then(([statusRes, configRes]) => {
        setConfig({ ...configRes, configured: statusRes.configured });
        setProvider(configRes.provider ?? 'resend');
        setFromEmail(configRes.fromEmail ?? '');
        setSmtpHost(configRes.smtpHost ?? '');
        setSmtpPort(configRes.smtpPort != null ? String(configRes.smtpPort) : '587');
        setSmtpUser(configRes.smtpUser ?? '');
        setApiKey('');
        setSmtpPassword('');
      })
      .catch(() => setConfig({ configured: false }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    setToast(null);
    try {
      const body: Parameters<typeof adminApi.email.updateConfig>[0] = {
        provider,
        fromEmail: fromEmail.trim() || undefined,
      };
      if (provider === 'resend') {
        if (apiKey.trim()) body.apiKey = apiKey.trim();
      } else {
        body.smtpHost = smtpHost.trim() || undefined;
        body.smtpPort = smtpPort.trim() ? parseInt(smtpPort, 10) : 587;
        body.smtpUser = smtpUser.trim() || undefined;
        if (smtpPassword.trim()) body.smtpPassword = smtpPassword;
      }
      const updated = await adminApi.email.updateConfig(body);
      setConfig(updated);
      setToast({ type: 'success', message: 'Configuração salva.' });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao salvar configuração.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    const email = testEmail.trim();
    if (!email) {
      setToast({ type: 'error', message: 'Informe um email para envio de teste.' });
      return;
    }
    setSending(true);
    setToast(null);
    try {
      const res = await adminApi.email.test(email);
      if (res.sent) {
        setToast({ type: 'success', message: 'Email de teste enviado com sucesso.' });
      } else {
        setToast({ type: 'error', message: res.error ?? 'Falha ao enviar.' });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao enviar email de teste.',
      });
    } finally {
      setSending(false);
    }
  };

  const configured = config?.configured ?? false;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Email</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configuração Resend ou SMTP no painel e envio de email de teste. Fallback: variável RESEND_API_KEY.
        </p>
        {toast && (
          <p
            className={
              toast.type === 'success'
                ? 'text-sm text-emerald-600 mt-2'
                : 'text-sm text-red-400 mt-2'
            }
          >
            {toast.message}
          </p>
        )}
      </div>

      {/* Config form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 mb-6">
        <h2 className="text-white font-medium mb-1">Configuração</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Defina o provedor e as credenciais. Chaves e senhas são armazenadas criptografadas.
        </p>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Provedor</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'resend' | 'smtp')}
                className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 w-full max-w-xs"
              >
                <option value="resend">Resend (API key)</option>
                <option value="smtp">SMTP (servidor próprio)</option>
              </select>
            </div>

            {provider === 'resend' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">API Key Resend</label>
                  <Input
                    type="password"
                    placeholder={config?.hasResendApiKey ? '•••••••• (deixe em branco para manter)' : 're_...'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="rounded-lg border-zinc-700 bg-zinc-800/80 text-zinc-200 placeholder-zinc-500"
                  />
                </div>
              </>
            )}

            {provider === 'smtp' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Host SMTP</label>
                  <Input
                    placeholder="smtp.exemplo.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="rounded-lg border-zinc-700 bg-zinc-800/80 text-zinc-200 placeholder-zinc-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Porta</label>
                    <Input
                      type="number"
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="rounded-lg border-zinc-700 bg-zinc-800/80 text-zinc-200 placeholder-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Usuário</label>
                    <Input
                      placeholder="user@exemplo.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="rounded-lg border-zinc-700 bg-zinc-800/80 text-zinc-200 placeholder-zinc-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Senha SMTP</label>
                  <Input
                    type="password"
                    placeholder={config?.smtpHost ? '•••••••• (deixe em branco para manter)' : '••••••••'}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    className="rounded-lg border-zinc-700 bg-zinc-800/80 text-zinc-200 placeholder-zinc-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Remetente (From)</label>
              <Input
                type="text"
                placeholder="Prospector &lt;noreply@seudominio.com&gt;"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="rounded-lg border-zinc-700 bg-zinc-800/80 text-zinc-200 placeholder-zinc-500"
              />
            </div>

            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              isLoading={saving}
              className="bg-violet-600 hover:bg-violet-500 text-white border-0"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar configuração
            </Button>
          </div>
        )}
      </div>

      {/* Status + test */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <h2 className="text-white font-medium flex items-center gap-2 mb-1">
          <Mail className="w-5 h-5" />
          Status
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Envio usa a configuração do painel ou a variável RESEND_API_KEY. Chaves não são exibidas.
        </p>
        <div className="space-y-4">
          {(() => {
            if (loading) return <p className="text-sm text-zinc-500">Carregando...</p>;
            if (configured) {
              return (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>Configurado</span>
                </div>
              );
            }
            return (
              <div className="flex items-center gap-2 text-amber-600">
                <XCircle className="w-5 h-5" />
                <span>Não configurado. Defina Resend ou SMTP acima ou use RESEND_API_KEY.</span>
              </div>
            );
          })()}

          <div className="pt-2 border-t border-zinc-800">
            <label className="block text-sm font-medium text-zinc-300 mb-2">Enviar teste para</label>
            <div className="flex gap-2 max-w-md">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                disabled={!configured}
                className="rounded-lg border-zinc-700 bg-zinc-800/80 text-zinc-200 placeholder-zinc-500"
              />
              <Button
                onClick={handleSendTest}
                disabled={!configured || sending}
                isLoading={sending}
                className="bg-violet-600 hover:bg-violet-500 text-white border-0"
              >
                Enviar teste
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
