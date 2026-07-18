import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import type { SessionUser, RepClientDTO } from '@/lib/api';
import { representativeApi, type RepClientInput } from '@/lib/api/representative';
import { REP_CLIENT_STATUSES, REP_CLIENT_STATUS_LABEL, type RepClientStatus } from '@/lib/rep-client-status';
import { Loader2, Plus, X, Trash2, Building2, Phone, Mail, MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

function formatValue(cents: number | null, currency?: string): string {
  if (cents == null) return '—';
  const symbol = currency === 'USD' ? '$' : 'R$';
  return `${symbol} ${(cents / 100).toFixed(2)}`;
}

function ClientCard({ client }: { client: RepClientDTO }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
      <p className="font-medium text-foreground text-sm truncate">{client.name}</p>
      {client.company && (
        <p className="text-xs text-muted flex items-center gap-1 mt-1 truncate">
          <Building2 className="w-3 h-3 shrink-0" /> {client.company}
        </p>
      )}
      <p className="text-xs font-semibold text-violet-600 mt-1.5">{formatValue(client.valueCents, client.currency)}</p>
    </div>
  );
}

function DraggableCard({ client, onOpen }: { client: RepClientDTO; onOpen: (client: RepClientDTO) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: client.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onOpen(client);
      }}
    >
      <ClientCard client={client} />
    </div>
  );
}

function Column({
  status,
  clients,
  onOpen,
}: {
  status: RepClientStatus;
  clients: RepClientDTO[];
  onOpen: (client: RepClientDTO) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[240px] w-[240px] rounded-xl border transition-colors',
        isOver ? 'border-violet-500/50 bg-violet-500/5' : 'border-border bg-surface/30'
      )}
    >
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {REP_CLIENT_STATUS_LABEL[status]}
        </span>
        <span className="text-xs text-muted bg-surface rounded-full px-2 py-0.5">{clients.length}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto">
        {clients.map((c) => (
          <DraggableCard key={c.id} client={c} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function ClientFormModal({
  initial,
  currency,
  onClose,
  onSave,
  onDelete,
  onSendWhatsApp,
  whatsappConnected,
  saving,
}: {
  initial?: RepClientDTO;
  currency?: string;
  onClose: () => void;
  onSave: (data: RepClientInput) => void;
  onDelete?: () => void;
  onSendWhatsApp?: (message: string) => Promise<void>;
  whatsappConnected: boolean;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [company, setCompany] = useState(initial?.company ?? '');
  const [value, setValue] = useState(initial?.valueCents != null ? String(initial.valueCents / 100) : '');
  const [status, setStatus] = useState<RepClientStatus>((initial?.status as RepClientStatus) ?? 'LEAD');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [waMessage, setWaMessage] = useState('');
  const [sendingWa, setSendingWa] = useState(false);

  const handleSendWhatsApp = async () => {
    if (!onSendWhatsApp || !waMessage.trim()) return;
    setSendingWa(true);
    try {
      await onSendWhatsApp(waMessage.trim());
      setWaMessage('');
    } finally {
      setSendingWa(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      valueCents: value.trim() ? Math.round(parseFloat(value.replace(',', '.')) * 100) : undefined,
      status,
      notes: notes.trim() || undefined,
    });
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 10001 }} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative rounded-2xl border border-border bg-card shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">{initial ? 'Editar cliente' : 'Adicionar cliente'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-surface transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-xs text-muted block mb-1">Nome *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Empresa</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Valor ({currency === 'USD' ? '$' : 'R$'})</label>
              <input type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as RepClientStatus)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
                {REP_CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{REP_CLIENT_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
          </div>

          {initial && onSendWhatsApp && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <label className="text-xs text-muted flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Enviar WhatsApp</label>
              {!phone.trim() ? (
                <p className="text-xs text-muted">Adicione um telefone para enviar mensagens.</p>
              ) : !whatsappConnected ? (
                <p className="text-xs text-muted">Conecte seu WhatsApp na aba "WhatsApp" do menu Comercial para enviar por aqui.</p>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    rows={2}
                    placeholder="Escreva a mensagem..."
                    className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    disabled={sendingWa || !waMessage.trim()}
                    className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors shrink-0"
                    aria-label="Enviar"
                  >
                    {sendingWa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-2 rounded-lg border border-red-500/30 text-red-600 hover:bg-red-500/10 transition-colors"
              aria-label="Excluir cliente"
            >
              <Trash2 size={16} />
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50 transition-colors">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function RepClients() {
  useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();
  const [items, setItems] = useState<RepClientDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RepClientDTO | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(() => {
    setLoading(true);
    representativeApi.getClients({ page: 1, limit: 100 })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    representativeApi.getWhatsAppStatus()
      .then((r) => setWhatsappConnected(r.status === 'CONNECTED'))
      .catch(() => setWhatsappConnected(false));
  }, []);

  const columns = useMemo(() => {
    const grouped: Record<RepClientStatus, RepClientDTO[]> = { LEAD: [], CONVERTED: [], ACTIVE: [], CANCELED: [], REFUNDED: [] };
    for (const item of items) {
      const status = (item.status in grouped ? item.status : 'LEAD') as RepClientStatus;
      grouped[status].push(item);
    }
    return grouped;
  }, [items]);

  const activeClient = items.find((i) => i.id === activeId) ?? null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as RepClientStatus;
    const client = items.find((i) => i.id === active.id);
    if (!client || client.status === newStatus) return;

    const prevItems = items;
    setItems((prev) => prev.map((i) => (i.id === client.id ? { ...i, status: newStatus } : i)));
    representativeApi.updateClient(client.id, { status: newStatus }).catch(() => setItems(prevItems));
  };

  const handleSave = async (data: RepClientInput) => {
    setSaving(true);
    try {
      if (editing && editing !== 'new') {
        const updated = await representativeApi.updateClient(editing.id, data);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const created = await representativeApi.createClient(data);
        setItems((prev) => [created, ...prev]);
      }
      setEditing(null);
    } catch {
      // keep modal open on failure so the rep can retry
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || editing === 'new') return;
    const id = editing.id;
    setSaving(true);
    try {
      await representativeApi.deleteClient(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="Clientes" breadcrumb="Representante" />
      <div className="p-4 md:p-6 flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted">Arraste os cards entre as colunas para atualizar o status.</p>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Adicionar cliente
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto flex-1 min-h-0 pb-2">
              {REP_CLIENT_STATUSES.map((status) => (
                <Column key={status} status={status} clients={columns[status]} onOpen={setEditing} />
              ))}
            </div>
            <DragOverlay>{activeClient ? <ClientCard client={activeClient} /> : null}</DragOverlay>
          </DndContext>
        )}
      </div>

      {editing && (
        <ClientFormModal
          initial={editing === 'new' ? undefined : editing}
          currency={editing !== 'new' ? editing.currency : items[0]?.currency}
          saving={saving}
          whatsappConnected={whatsappConnected}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={editing !== 'new' ? handleDelete : undefined}
          onSendWhatsApp={editing !== 'new' ? (message) => {
            const client = editing;
            return representativeApi.sendWhatsApp(client.id, message)
              .then(() => { addToast('success', 'Mensagem enviada.'); })
              .catch((err) => { addToast('error', err instanceof Error ? err.message : 'Erro ao enviar mensagem.'); });
          } : undefined}
        />
      )}
    </div>
  );
}
