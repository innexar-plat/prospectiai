import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, MessageCircle, Unlink, Send } from 'lucide-react';
import { adminWhatsappApi, type WhatsAppConversationItem, type WhatsAppMessageItem } from '@/lib/api/whatsapp';
import { cn } from '@/lib/utils';

type WhatsAppStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
type Provider = 'EVOLUTION' | 'META';

const STATUS_LABEL: Record<WhatsAppStatus, string> = {
  DISCONNECTED: 'Não conectado',
  CONNECTING: 'Conectando…',
  CONNECTED: 'Conectado',
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function WhatsAppPage() {
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

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

  const [conversations, setConversations] = useState<WhatsAppConversationItem[]>([]);
  const [selected, setSelected] = useState<WhatsAppConversationItem | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const chatPollRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const refreshStatus = useCallback(() => {
    return adminWhatsappApi.status()
      .then((r) => {
        setStatus(r.status);
        setNumber(r.number);
        if (r.provider) setProvider(r.provider);
        if (r.status === 'CONNECTED') { setQrCode(null); stopPolling(); }
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
    adminWhatsappApi.getConversations({ limit: 50 }).then((r) => setConversations(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (status !== 'CONNECTED') return;
    loadConversations();
    const interval = window.setInterval(loadConversations, 15000);
    return () => window.clearInterval(interval);
  }, [status, loadConversations]);

  const loadMessages = useCallback((conversationId: string) => {
    return adminWhatsappApi.getMessages(conversationId, { limit: 100 }).then((r) => setMessages(r.items)).catch(() => setMessages([]));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const stopChatPolling = useCallback(() => {
    if (chatPollRef.current) { window.clearInterval(chatPollRef.current); chatPollRef.current = null; }
  }, []);
  useEffect(() => () => stopChatPolling(), [stopChatPolling]);

  const handleSelectConversation = (c: WhatsAppConversationItem) => {
    setSelected(c);
    setMessagesLoading(true);
    loadMessages(c.id).finally(() => setMessagesLoading(false));
    if (c.unreadCount > 0) {
      adminWhatsappApi.markRead(c.id).then(() => {
        setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
      }).catch(() => {});
    }
    stopChatPolling();
    chatPollRef.current = window.setInterval(() => { void loadMessages(c.id); }, 8000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await adminWhatsappApi.send(selected.contactNumber, text);
      await loadMessages(selected.id);
      loadConversations();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleConnectEvolution = async () => {
    setConnecting(true);
    try {
      const res = await adminWhatsappApi.connect();
      setQrCode(res.qrCode);
      setStatus('CONNECTING');
      stopPolling();
      pollRef.current = window.setInterval(() => { void refreshStatus(); }, 3000);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao conectar WhatsApp.');
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectMeta = async () => {
    if (!metaPhoneNumberId.trim()) return;
    setConnecting(true);
    try {
      await adminWhatsappApi.connectMeta({ phoneNumberId: metaPhoneNumberId.trim(), phoneNumber: metaPhoneNumber.trim() || undefined });
      showToast('success', 'WhatsApp (Meta) conectado.');
      await refreshStatus();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao conectar via Meta.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await adminWhatsappApi.disconnect();
      stopPolling();
      setStatus('DISCONNECTED');
      setNumber(null);
      setQrCode(null);
      setSelected(null);
      setConversations([]);
      showToast('success', 'WhatsApp desconectado.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao desconectar.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">WhatsApp</h1>
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${toast.type === 'success' ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' : 'bg-red-50 border border-red-300 text-red-700'}`}>
          {toast.message}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-900">Número institucional</h2>
              <p className="text-xs text-gray-500 mt-0.5">Conecte o WhatsApp oficial da Precision IA para suporte e contato institucional.</p>
            </div>
          </div>
          {!checkingStatus && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border text-gray-600 bg-gray-50 border-gray-200">
              {STATUS_LABEL[status]}{status === 'CONNECTED' ? (provider === 'META' ? ' · Meta' : ' · Evolution') : ''}
            </span>
          )}
        </div>

        {checkingStatus ? (
          <div className="flex items-center gap-2 text-gray-500 py-4 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando status...
          </div>
        ) : status === 'CONNECTED' ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">Número conectado: <strong>{number ?? '—'}</strong></p>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Unlink size={16} /> {disconnecting ? 'Desconectando…' : 'Desconectar'}
            </button>
          </div>
        ) : qrCode ? (
          <div className="space-y-3">
            <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="rounded-xl border border-gray-200 w-56 h-56 object-contain bg-white p-2" />
            <p className="text-xs text-gray-500">Abra o WhatsApp no celular, vá em Aparelhos conectados e escaneie o código.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-0.5 p-1 bg-gray-100 rounded-lg border border-gray-200 w-fit">
              <button type="button" onClick={() => setConnectMode('EVOLUTION')} className={cn('text-xs font-bold px-3 py-1.5 rounded-md transition-all', connectMode === 'EVOLUTION' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-900')}>
                Número via QR (Evolution)
              </button>
              <button type="button" onClick={() => setConnectMode('META')} className={cn('text-xs font-bold px-3 py-1.5 rounded-md transition-all', connectMode === 'META' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-900')}>
                Número oficial (Meta)
              </button>
            </div>

            {connectMode === 'EVOLUTION' ? (
              <button
                type="button"
                onClick={handleConnectEvolution}
                disabled={connecting}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {connecting ? 'Gerando QR Code…' : 'Conectar WhatsApp'}
              </button>
            ) : (
              <div className="space-y-3 max-w-sm">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">ID do número (phone_number_id)</label>
                  <input value={metaPhoneNumberId} onChange={(e) => setMetaPhoneNumberId(e.target.value)} className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Número (opcional, para exibição)</label>
                  <input value={metaPhoneNumber} onChange={(e) => setMetaPhoneNumber(e.target.value)} placeholder="5511999999999" className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700" />
                </div>
                <button
                  type="button"
                  onClick={handleConnectMeta}
                  disabled={connecting || !metaPhoneNumberId.trim()}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {connecting ? 'Conectando…' : 'Conectar via Meta'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {status === 'CONNECTED' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr] h-[600px]">
          <div className="border-b md:border-b-0 md:border-r border-gray-200 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-gray-200 shrink-0">
              <h3 className="text-sm font-bold text-gray-900">Conversas</h3>
            </div>
            <div className="overflow-y-auto divide-y divide-gray-100">
              {conversations.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Nenhuma conversa ainda.</div>
              ) : conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectConversation(c)}
                  className={cn('w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors', selected?.id === c.id && 'bg-gray-50')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm truncate">{c.contactName ?? c.contactNumber}</p>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatRelativeTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs text-gray-500 truncate">{c.lastMessagePreview ?? '—'}</p>
                    {c.unreadCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex flex-col">
            {selected ? (
              <>
                <div className="px-4 py-3 border-b border-gray-200 shrink-0">
                  <p className="font-semibold text-gray-900 text-sm">{selected.contactName ?? selected.contactNumber}</p>
                  <p className="text-xs text-gray-500">{selected.contactNumber}</p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                  {messagesLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Carregando mensagens…</div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhuma mensagem ainda.</p>
                  ) : messages.map((m) => (
                    <div key={m.id} className={cn('flex', m.direction === 'OUT' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[75%] rounded-2xl px-3 py-2 text-sm', m.direction === 'OUT' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm')}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={cn('text-[10px] mt-1', m.direction === 'OUT' ? 'text-white/70' : 'text-gray-500')}>
                          {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <form onSubmit={handleSend} className="p-3 border-t border-gray-200 flex items-center gap-2 shrink-0">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Digite uma mensagem…"
                    className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={!draft.trim() || sending} className="p-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500 p-6 text-center">
                Selecione uma conversa ao lado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
