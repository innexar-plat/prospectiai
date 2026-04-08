import { useEffect, useState, useCallback } from 'react';
import { adminApi, type AdminNotificationListItem, type NotificationChannelItem } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function NotificationsPage() {
  const [items, setItems] = useState<AdminNotificationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<NotificationChannelItem[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelUpdating, setChannelUpdating] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadChannels = useCallback(() => {
    setChannelsLoading(true);
    adminApi.notificationChannels
      .list()
      .then((res) => setChannels(res.channels))
      .catch(() => setChannels([]))
      .finally(() => setChannelsLoading(false));
  }, []);

  const loadList = () => {
    setLoading(true);
    adminApi.notifications
      .list({ limit: 50, offset: 0 })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
  }, []);
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleChannelToggle = async (
    key: string,
    field: 'appEnabled' | 'emailEnabled',
    value: boolean
  ) => {
    setChannelUpdating(key);
    setToast(null);
    try {
      const updated = await adminApi.notificationChannels.update({ key, [field]: value });
      setChannels((prev) => prev.map((c) => (c.key === key ? { ...c, ...updated } : c)));
      setToast('Canal atualizado.');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Erro ao atualizar.');
    } finally {
      setChannelUpdating(null);
    }
  };

  const handleSendAll = async () => {
    const t = title.trim();
    const m = message.trim();
    if (!t || !m) {
      setToast('Preencha título e mensagem.');
      return;
    }
    setConfirmOpen(false);
    setSending(true);
    setToast(null);
    try {
      const res = await adminApi.notifications.sendAll({
        title: t,
        message: m,
        link: link.trim() || undefined,
      });
      setToast(`Enviado para ${res.sent} usuário(s).`);
      setTitle('');
      setMessage('');
      setLink('');
      loadList();
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Erro ao enviar.');
    } finally {
      setSending(false);
    }
  };

  const openConfirm = () => {
    if (!title.trim() || !message.trim()) {
      setToast('Preencha título e mensagem.');
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Notificações</h1>
        <p className="text-sm text-gray-500 mt-1">Canais, listar notificações e enviar para todos os usuários.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm mb-6">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-gray-900 font-medium">Canais de notificação</h2>
          <p className="text-sm text-gray-500 mt-1">
            Ligar ou desligar notificação no app e por email para cada tipo.
          </p>
        </div>
        <div className="overflow-x-auto">
          {(() => {
            if (channelsLoading) return <p className="p-4 text-sm text-gray-500">Carregando canais...</p>;
            if (channels.length === 0) return <p className="p-4 text-sm text-gray-500">Nenhum canal configurado.</p>;
            return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 pr-4 pt-2 pl-4">Canal</th>
                    <th className="pb-2 pr-4 pt-2">Notificação no app</th>
                    <th className="pb-2 pr-4 pt-2">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((ch) => (
                    <tr key={ch.key} className="border-b border-gray-200">
                      <td className="py-3 pr-4 pl-4 text-gray-600 font-medium">{ch.name}</td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          disabled={channelUpdating === ch.key}
                          onClick={() => handleChannelToggle(ch.key, 'appEnabled', !ch.appEnabled)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            ch.appEnabled
                              ? 'bg-violet-600 text-white hover:bg-violet-500'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {ch.appEnabled ? 'Ligado' : 'Desligado'}
                        </button>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          disabled={channelUpdating === ch.key}
                          onClick={() => handleChannelToggle(ch.key, 'emailEnabled', !ch.emailEnabled)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            ch.emailEnabled
                              ? 'bg-violet-600 text-white hover:bg-violet-500'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {ch.emailEnabled ? 'Ligado' : 'Desligado'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
        {toast && <p className="p-4 pt-0 text-sm text-gray-500">{toast}</p>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6 shadow-sm">
        <h2 className="text-gray-900 font-medium mb-1">Enviar para todos</h2>
        <p className="text-sm text-gray-500 mb-4">
          Cria uma notificação in-app para cada usuário (sem envio de email).
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Título</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da notificação"
              disabled={sending}
              className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Mensagem</label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensagem"
              disabled={sending}
              className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Link (opcional)</label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/dashboard ou URL"
              disabled={sending}
              className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 placeholder-gray-400"
            />
          </div>
          <Button
            onClick={openConfirm}
            disabled={sending}
            isLoading={sending}
            className="bg-violet-600 hover:bg-violet-500 text-white border-0"
          >
            Enviar para todos os usuários
          </Button>
          {toast && <p className="text-sm text-gray-500">{toast}</p>}
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar envio"
        >
          <div className="rounded-xl border border-gray-200 bg-white shadow-xl max-w-md w-full p-6">
            <p className="text-gray-900 font-medium mb-2">Enviar notificação para todos os usuários?</p>
            <p className="text-sm text-gray-500 mb-4">
              Será criada uma notificação in-app para cada usuário. Nenhum email será enviado.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
                className="border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendAll}
                isLoading={sending}
                className="bg-violet-600 hover:bg-violet-500 text-white border-0"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-gray-900 font-medium">Últimas notificações</h2>
          <p className="text-sm text-gray-500">Total: {total}</p>
        </div>
        <div className="overflow-x-auto">
          {(() => {
            if (loading) return <p className="p-4 text-sm text-gray-500">Carregando...</p>;
            if (items.length === 0) return <p className="p-4 text-sm text-gray-500">Nenhuma notificação.</p>;
            return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 pr-2">Data</th>
                    <th className="pb-2 pr-2">Título</th>
                    <th className="pb-2 pr-2">Usuário</th>
                    <th className="pb-2 pr-2">Lida</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((n) => (
                    <tr key={n.id} className="border-b border-gray-200">
                      <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">
                        {new Date(n.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2 pr-2 text-gray-600">{n.title}</td>
                      <td className="py-2 pr-2 text-gray-600">
                        {n.user?.email ?? n.userId}
                      </td>
                      <td className="py-2 pr-2 text-gray-600">{n.readAt ? 'Sim' : 'Não'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
