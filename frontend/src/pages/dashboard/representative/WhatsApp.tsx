import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import type { SessionUser } from '@/lib/api';
import type { WhatsAppConversationDTO, WhatsAppMessageDTO } from '@/lib/api/types';
import { representativeApi } from '@/lib/api/representative';
import { useToast } from '@/contexts/ToastContext';
import { Loader2, MessageCircle, Unlink, Send, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type WhatsAppStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
type Provider = 'EVOLUTION' | 'META';

const STATUS_LABEL: Record<WhatsAppStatus, string> = {
  DISCONNECTED: 'Não conectado',
  CONNECTING: 'Conectando…',
  CONNECTED: 'Conectado',
};

const STATUS_BADGE: Record<WhatsAppStatus, string> = {
  DISCONNECTED: 'text-muted bg-surface border-border',
  CONNECTING: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20',
  CONNECTED: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: WhatsAppConversationDTO[];
  selectedId: string | null;
  onSelect: (c: WhatsAppConversationDTO) => void;
}) {
  if (conversations.length === 0) {
    return <div className="p-4 text-sm text-muted">Nenhuma conversa ainda.</div>;
  }
  return (
    <div className="divide-y divide-border overflow-y-auto">
      {conversations.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c)}
          className={cn(
            'w-full text-left px-4 py-3 hover:bg-surface transition-colors',
            selectedId === c.id && 'bg-surface',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-foreground text-sm truncate">
              {c.repClientName ?? c.contactName ?? c.contactNumber}
            </p>
            <span className="text-[10px] text-muted shrink-0">{formatRelativeTime(c.lastMessageAt)}</span>
          </div>
          {c.repClientCompany && (
            <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5 truncate">
              <Building2 className="w-3 h-3 shrink-0" /> {c.repClientCompany}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs text-muted truncate">{c.lastMessagePreview ?? '—'}</p>
            {c.unreadCount > 0 && (
              <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                {c.unreadCount}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function MessageThread({
  conversation,
  messages,
  loading,
  onSend,
  sending,
}: {
  conversation: WhatsAppConversationDTO;
  messages: WhatsAppMessageDTO[];
  loading: boolean;
  onSend: (text: string) => Promise<void>;
  sending: boolean;
}) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    await onSend(text);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border">
        <p className="font-semibold text-foreground text-sm">
          {conversation.repClientName ?? conversation.contactName ?? conversation.contactNumber}
        </p>
        <p className="text-xs text-muted">{conversation.contactNumber}</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Carregando mensagens…</div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.direction === 'OUT' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                m.direction === 'OUT' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-surface text-foreground rounded-bl-sm',
              )}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('text-[10px] mt-1', m.direction === 'OUT' ? 'text-white/70' : 'text-muted')}>
                  {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-3 border-t border-border flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Digite uma mensagem…"
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

export default function RepWhatsApp() {
  useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();
  const [status, setStatus] = useState<WhatsAppStatus>('DISCONNECTED');
  const [provider, setProvider] = useState<Provider>('EVOLUTION');
  const [number, setNumber] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectMode, setConnectMode] = useState<Provider>('EVOLUTION');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaPhoneNumber, setMetaPhoneNumber] = useState('');
  const pollRef = useRef<number | null>(null);

  const [conversations, setConversations] = useState<WhatsAppConversationDTO[]>([]);
  const [selected, setSelected] = useState<WhatsAppConversationDTO | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessageDTO[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const chatPollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(() => {
    return representativeApi.getWhatsAppStatus()
      .then((r) => {
        setStatus(r.status);
        setNumber(r.number);
        if (r.provider) setProvider(r.provider);
        if (r.status === 'CONNECTED') {
          setQrCode(null);
          stopPolling();
        }
        return r.status;
      })
      .catch(() => 'DISCONNECTED' as WhatsAppStatus);
  }, [stopPolling]);

  useEffect(() => {
    setCheckingStatus(true);
    refreshStatus().finally(() => setCheckingStatus(false));
    return () => stopPolling();
  }, [refreshStatus, stopPolling]);

  const loadConversations = useCallback(() => {
    representativeApi.getChatConversations({ limit: 50 })
      .then((r) => setConversations(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status !== 'CONNECTED') return;
    loadConversations();
    const interval = window.setInterval(loadConversations, 15000);
    return () => window.clearInterval(interval);
  }, [status, loadConversations]);

  const loadMessages = useCallback((conversationId: string) => {
    return representativeApi.getChatMessages(conversationId, { limit: 100 })
      .then((r) => setMessages(r.items))
      .catch(() => setMessages([]));
  }, []);

  const stopChatPolling = useCallback(() => {
    if (chatPollRef.current) {
      window.clearInterval(chatPollRef.current);
      chatPollRef.current = null;
    }
  }, []);

  const handleSelectConversation = (c: WhatsAppConversationDTO) => {
    setSelected(c);
    setMessagesLoading(true);
    loadMessages(c.id).finally(() => setMessagesLoading(false));
    if (c.unreadCount > 0) {
      representativeApi.markChatRead(c.id).then(() => {
        setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
      }).catch(() => {});
    }
    stopChatPolling();
    chatPollRef.current = window.setInterval(() => { void loadMessages(c.id); }, 8000);
  };

  useEffect(() => () => stopChatPolling(), [stopChatPolling]);

  const handleSendMessage = async (text: string) => {
    if (!selected) return;
    setSending(true);
    try {
      await representativeApi.sendChatMessage(selected.contactNumber, text);
      await loadMessages(selected.id);
      loadConversations();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleConnectEvolution = async () => {
    setConnecting(true);
    try {
      const res = await representativeApi.connectWhatsApp();
      setQrCode(res.qrCode);
      setStatus('CONNECTING');
      stopPolling();
      pollRef.current = window.setInterval(() => { void refreshStatus(); }, 3000);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao conectar WhatsApp.');
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectMeta = async () => {
    if (!metaPhoneNumberId.trim()) return;
    setConnecting(true);
    try {
      await representativeApi.connectMetaWhatsApp({ phoneNumberId: metaPhoneNumberId.trim(), phoneNumber: metaPhoneNumber.trim() || undefined });
      addToast('success', 'WhatsApp (Meta) conectado.');
      await refreshStatus();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao conectar via Meta.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await representativeApi.disconnectWhatsApp();
      stopPolling();
      setStatus('DISCONNECTED');
      setNumber(null);
      setQrCode(null);
      setSelected(null);
      setConversations([]);
      addToast('success', 'WhatsApp desconectado.');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao desconectar.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="WhatsApp" breadcrumb="Representante" />
      <div className="p-4 md:p-6 space-y-4 flex-1 min-h-0 flex flex-col">
        <div className="rounded-3xl bg-card border border-border p-6 space-y-5 card-shadow shrink-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">WhatsApp</h3>
                <p className="text-xs text-muted mt-1">Conecte seu número para conversar direto com seus clientes.</p>
              </div>
            </div>
            {!checkingStatus && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[status]}`}>
                {STATUS_LABEL[status]}{status === 'CONNECTED' && provider === 'META' ? ' · Meta' : status === 'CONNECTED' ? ' · Evolution' : ''}
              </span>
            )}
          </div>

          {checkingStatus ? (
            <div className="flex items-center gap-2 text-muted py-4 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando status...
            </div>
          ) : status === 'CONNECTED' ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">Número conectado: <strong>{number ?? '—'}</strong></p>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/30 text-red-600 hover:bg-red-500/10 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Unlink size={16} /> {disconnecting ? 'Desconectando…' : 'Desconectar'}
              </button>
            </div>
          ) : qrCode ? (
            <div className="space-y-3 text-center">
              <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="mx-auto rounded-xl border border-border w-56 h-56 object-contain bg-white p-2" />
              <p className="text-xs text-muted">Abra o WhatsApp no celular, vá em Aparelhos conectados e escaneie o código.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-0.5 p-1 bg-surface rounded-xl border border-border w-fit">
                <button type="button" onClick={() => setConnectMode('EVOLUTION')} className={cn('text-xs font-bold px-3 py-1.5 rounded-lg transition-all', connectMode === 'EVOLUTION' ? 'bg-violet-600 text-white shadow-lg' : 'text-muted hover:text-foreground')}>
                  Número pessoal (QR)
                </button>
                <button type="button" onClick={() => setConnectMode('META')} className={cn('text-xs font-bold px-3 py-1.5 rounded-lg transition-all', connectMode === 'META' ? 'bg-violet-600 text-white shadow-lg' : 'text-muted hover:text-foreground')}>
                  Número oficial (Meta)
                </button>
              </div>

              {connectMode === 'EVOLUTION' ? (
                <button
                  type="button"
                  onClick={handleConnectEvolution}
                  disabled={connecting}
                  className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {connecting ? 'Gerando QR Code…' : 'Conectar WhatsApp'}
                </button>
              ) : (
                <div className="space-y-3 max-w-sm">
                  <p className="text-xs text-muted">
                    O número precisa já estar cadastrado na conta oficial do WhatsApp Business da empresa (Meta Business Suite). Peça o ID do número ao administrador.
                  </p>
                  <div>
                    <label className="text-xs text-muted block mb-1">ID do número (phone_number_id)</label>
                    <input value={metaPhoneNumberId} onChange={(e) => setMetaPhoneNumberId(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Número (opcional, para exibição)</label>
                    <input value={metaPhoneNumber} onChange={(e) => setMetaPhoneNumber(e.target.value)} placeholder="5511999999999" className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm" />
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectMeta}
                    disabled={connecting || !metaPhoneNumberId.trim()}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {connecting ? 'Conectando…' : 'Conectar via Meta'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {status === 'CONNECTED' && (
          <div className="flex-1 min-h-0 rounded-3xl bg-card border border-border card-shadow overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr]">
            <div className="border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-border shrink-0">
                <h4 className="text-sm font-bold text-foreground">Conversas</h4>
              </div>
              <ConversationList conversations={conversations} selectedId={selected?.id ?? null} onSelect={handleSelectConversation} />
            </div>
            <div className="min-h-0">
              {selected ? (
                <MessageThread conversation={selected} messages={messages} loading={messagesLoading} onSend={handleSendMessage} sending={sending} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted p-6 text-center">
                  Selecione uma conversa ao lado, ou envie uma mensagem pela aba Clientes pra começar uma nova.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
