import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/contexts/ToastContext';
import { integrationsApi, type SessionUser } from '@/lib/api';
import { CheckCircle2, Loader2 } from 'lucide-react';

type ProviderCardProps = {
  name: string;
  description: string;
  status: 'connected' | 'not_connected' | 'coming_soon';
  logo: React.ReactNode;
  children?: React.ReactNode;
};

function ProviderCard({ name, description, status, logo, children }: ProviderCardProps) {
  return (
    <div className="rounded-3xl bg-card border border-border p-6 space-y-5 card-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {logo}
          <div>
            {name && <h3 className="text-base font-semibold text-foreground">{name}</h3>}
            <p className="text-xs text-muted mt-1">{description}</p>
          </div>
        </div>
        <span
          className={
            status === 'connected'
              ? 'inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full'
              : status === 'coming_soon'
                ? 'inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full'
                : 'inline-flex items-center gap-1 text-[10px] font-bold text-muted bg-surface border border-border px-2 py-0.5 rounded-full'
          }
        >
          {status === 'connected' ? 'Conectado' : status === 'coming_soon' ? 'Em breve' : 'Não conectado'}
        </span>
      </div>

      {children}
    </div>
  );
}

function RdLogo() {
  return (
    <div className="h-12 w-36 rounded-2xl overflow-hidden shadow-sm shrink-0 bg-white p-2">
      <img src="/logos/RD_Station_idYP8zaxIA_2.png" alt="RD Station" className="w-full h-full object-contain" />
    </div>
  );
}

function HubSpotLogo() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ffd8cc] bg-[#fff3eb] text-[#ff7a59] shadow-sm">
      <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="6" fill="currentColor" />
        <circle cx="37" cy="12" r="4" fill="currentColor" opacity="0.95" />
        <path d="M28 20L34 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 30V40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M18 24H9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function AgendorLogo() {
  return (
    <div className="h-12 w-36 rounded-2xl overflow-hidden shadow-sm shrink-0 bg-white p-2">
      <img src="/logos/Agendor_idi8FvRR_k_0.png" alt="Agendor" className="w-full h-full object-contain" />
    </div>
  );
}

export default function IntegracoesPage() {
  const { user } = useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rdConnecting, setRdConnecting] = useState(false);
  const [rdDisconnecting, setRdDisconnecting] = useState(false);
  const [rdStatus, setRdStatus] = useState<'connected' | 'not_connected'>('not_connected');
  const [agendorStatus, setAgendorStatus] = useState<'connected' | 'not_connected'>('not_connected');
  const [agendorSource, setAgendorSource] = useState<'env' | 'user' | null>(null);
  const [agendorToken, setAgendorToken] = useState('');
  const [agendorSaving, setAgendorSaving] = useState(false);
  const [agendorDisconnecting, setAgendorDisconnecting] = useState(false);
  const [hubspotConnecting, setHubspotConnecting] = useState(false);
  const [hubspotDisconnecting, setHubspotDisconnecting] = useState(false);
  const [hubspotStatus, setHubspotStatus] = useState<'connected' | 'not_connected'>('not_connected');
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const rdResult = searchParams.get('rd');
    if (!rdResult) return;

    if (rdResult === 'connected') {
      addToast('success', 'RD Station conectado com sucesso.');
    } else if (rdResult === 'error') {
      addToast('error', 'Não foi possível concluir a conexão com o RD Station.');
    }

    const hubspotResult = searchParams.get('hubspot');
    if (hubspotResult === 'connected') {
      addToast('success', 'HubSpot conectado com sucesso.');
    } else if (hubspotResult === 'error') {
      addToast('error', 'Não foi possível concluir a conexão com o HubSpot.');
    }

    const next = new URLSearchParams(searchParams);
    next.delete('rd');
    next.delete('hubspot');
    next.delete('mode');
    next.delete('reason');
    setSearchParams(next, { replace: true });
  }, [addToast, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setCheckingStatus(true);
    Promise.allSettled([integrationsApi.rdStationTest(), integrationsApi.agendorTest(), integrationsApi.hubspotTest()])
      .then(([rdRes, agendorRes, hubspotRes]) => {
        if (cancelled) return;

        if (rdRes.status === 'fulfilled') {
          setRdStatus(rdRes.value.ok ? 'connected' : 'not_connected');
        } else {
          setRdStatus('not_connected');
        }

        if (agendorRes.status === 'fulfilled') {
          setAgendorStatus(agendorRes.value.ok ? 'connected' : 'not_connected');
          setAgendorSource(agendorRes.value.source ?? null);
        } else {
          setAgendorStatus('not_connected');
          setAgendorSource(null);
        }

        if (hubspotRes.status === 'fulfilled') {
          setHubspotStatus(hubspotRes.value.ok ? 'connected' : 'not_connected');
        } else {
          setHubspotStatus('not_connected');
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectOAuth = async () => {
    setRdConnecting(true);
    try {
      const res = await integrationsApi.rdStationOauthConnectUrl();
      window.location.href = res.url;
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Falha ao iniciar conexão OAuth.');
      setRdConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setRdDisconnecting(true);
    try {
      await integrationsApi.rdStationDisconnect();
      setRdStatus('not_connected');
      addToast('success', 'Integração RD Station desconectada.');
    } catch {
      addToast('error', 'Não foi possível desconectar RD Station.');
    } finally {
      setRdDisconnecting(false);
    }
  };

  const handleConnectHubspot = async () => {
    setHubspotConnecting(true);
    try {
      const res = await integrationsApi.hubspotOauthConnectUrl();
      window.location.href = res.url;
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Falha ao iniciar conexão HubSpot.');
      setHubspotConnecting(false);
    }
  };

  const handleDisconnectHubspot = async () => {
    setHubspotDisconnecting(true);
    try {
      await integrationsApi.hubspotDisconnect();
      setHubspotStatus('not_connected');
      addToast('success', 'Integração HubSpot desconectada.');
    } catch {
      addToast('error', 'Não foi possível desconectar HubSpot.');
    } finally {
      setHubspotDisconnecting(false);
    }
  };

  const handleSaveAgendorToken = async () => {
    const token = agendorToken.trim();
    if (!token) {
      addToast('error', 'Informe o token da Agendor.');
      return;
    }

    setAgendorSaving(true);
    try {
      await integrationsApi.agendorSaveToken(token);
      setAgendorToken('');
      const status = await integrationsApi.agendorTest();
      setAgendorStatus(status.ok ? 'connected' : 'not_connected');
      setAgendorSource(status.source ?? null);
      addToast('success', 'Token da Agendor salvo com sucesso.');
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Não foi possível salvar o token da Agendor.');
    } finally {
      setAgendorSaving(false);
    }
  };

  const handleDisconnectAgendor = async () => {
    setAgendorDisconnecting(true);
    try {
      await integrationsApi.agendorDisconnect();
      setAgendorStatus('not_connected');
      setAgendorSource(null);
      addToast('success', 'Token da Agendor removido.');
    } catch {
      addToast('error', 'Não foi possível remover o token da Agendor.');
    } finally {
      setAgendorDisconnecting(false);
    }
  };

  return (
    <>
      <HeaderDashboard
        title="Integrações"
        subtitle="Conecte seus CRMs para enviar leads sem sair da Precision IA."
        breadcrumb="Conta / Integrações"
      />

      <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-foreground">Como conectar</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-foreground">1. Clique em <strong>Conectar</strong>.</div>
            <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-foreground">2. Faça login e autorize no CRM.</div>
            <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-foreground">3. Volte com a conta conectada.</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProviderCard
            name=""
            description="Conecte sua conta CRM para enviar e organizar leads automaticamente."
            status={rdStatus}
            logo={<RdLogo />}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                {checkingStatus ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />}
                {checkingStatus
                  ? 'Verificando conexão...'
                  : rdStatus === 'connected'
                    ? 'Sua conta RD está conectada.'
                    : 'Ainda não conectado.'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[auto_auto] gap-2">
                <Button variant="primary" size="sm" onClick={handleConnectOAuth} disabled={rdConnecting || rdDisconnecting}>
                  {rdConnecting ? 'Redirecionando...' : rdStatus === 'connected' ? 'Reconectar' : 'Conectar'}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDisconnect} disabled={rdStatus !== 'connected' || rdDisconnecting || rdConnecting}>
                  {rdDisconnecting ? 'Desconectando...' : 'Desconectar'}
                </Button>
              </div>

              <p className="text-[12px] leading-relaxed text-muted">
                Ao clicar em conectar, você será levado para a tela de login e autorização do RD Station CRM.
              </p>
            </div>
          </ProviderCard>

          <ProviderCard
            name="HubSpot CRM"
            description="Sincronize contatos e oportunidades direto no pipeline comercial."
            status={hubspotStatus}
            logo={<HubSpotLogo />}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                {checkingStatus ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />}
                {checkingStatus
                  ? 'Verificando conexão...'
                  : hubspotStatus === 'connected'
                    ? 'Sua conta HubSpot está conectada.'
                    : 'Ainda não conectado.'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[auto_auto] gap-2">
                <Button variant="primary" size="sm" onClick={handleConnectHubspot} disabled={hubspotConnecting || hubspotDisconnecting}>
                  {hubspotConnecting ? 'Redirecionando...' : hubspotStatus === 'connected' ? 'Reconectar' : 'Conectar'}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDisconnectHubspot} disabled={hubspotStatus !== 'connected' || hubspotDisconnecting || hubspotConnecting}>
                  {hubspotDisconnecting ? 'Desconectando...' : 'Desconectar'}
                </Button>
              </div>

              <p className="text-[12px] leading-relaxed text-muted">
                Ao clicar em conectar, você será levado para a tela de login e autorização do HubSpot.
              </p>
            </div>
          </ProviderCard>

          <ProviderCard
            name=""
            description="Distribua leads para o time comercial com poucos cliques."
            status={agendorStatus}
            logo={<AgendorLogo />}
          >
            <div className="space-y-3">
              <p className="text-xs text-muted">
                {agendorStatus === 'connected'
                  ? `Conectado ${agendorSource === 'user' ? 'com seu token' : agendorSource === 'env' ? 'via ambiente' : ''}.`
                  : <>Cole seu token da Agendor para habilitar envio de contatos e negócios. <a href="https://beta.agendor.com.br/settings/integrations/api_token" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline font-semibold">Obter token →</a></>}
              </p>

              <Input
                type="password"
                value={agendorToken}
                onChange={(e) => setAgendorToken(e.target.value)}
                placeholder="Token da Agendor"
              />

              <div className="grid grid-cols-1 sm:grid-cols-[auto_auto] gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAgendorToken}
                  disabled={agendorSaving || agendorDisconnecting || !agendorToken.trim()}
                >
                  {agendorSaving ? 'Salvando...' : agendorStatus === 'connected' ? 'Atualizar token' : 'Salvar token'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDisconnectAgendor}
                  disabled={agendorDisconnecting || agendorSaving || agendorStatus !== 'connected' || agendorSource !== 'user'}
                >
                  {agendorDisconnecting ? 'Removendo...' : 'Remover token'}
                </Button>
              </div>

              {agendorSource === 'env' && (
                <p className="text-[12px] leading-relaxed text-muted">
                  Sua instância está com token global em ambiente. Para usar token individual, salve o seu acima.
                </p>
              )}
            </div>
          </ProviderCard>
        </div>

        {user.plan === 'FREE' && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 text-foreground text-xs px-4 py-3">
            Alguns conectores avançados (sync bidirecional e automações) serão liberados em planos superiores.
          </div>
        )}
      </div>
    </>
  );
}
