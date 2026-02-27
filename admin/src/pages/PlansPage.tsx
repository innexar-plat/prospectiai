import { useEffect, useState } from 'react';
import { adminApi, type PlanConfigItem, type PlanConfigCreateBody } from '@/lib/api';

const ALL_MODULES = [
    { key: 'MAPEAMENTO', label: 'Mapeamento' },
    { key: 'INTELIGENCIA_MERCADO', label: 'Inteligência de Mercado' },
    { key: 'ANALISE_CONCORRENCIA', label: 'Análise de Concorrência' },
    { key: 'INTELIGENCIA_LEADS', label: 'Inteligência de Leads' },
    { key: 'ACAO_COMERCIAL', label: 'Ação Comercial' },
];

const emptyForm: PlanConfigCreateBody = {
    key: '',
    name: '',
    leadsLimit: 10,
    priceMonthlyBrl: 0,
    priceAnnualBrl: 0,
    priceMonthlyUsd: 0,
    priceAnnualUsd: 0,
    modules: [],
    isActive: true,
    sortOrder: 0,
};

export function PlansPage() {
    const [plans, setPlans] = useState<PlanConfigItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<PlanConfigCreateBody>({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const loadPlans = () => {
        setLoading(true);
        adminApi.plans
            .list()
            .then(setPlans)
            .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadPlans();
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm, sortOrder: plans.length });
        setShowModal(true);
        setError(null);
    };

    const openEdit = (plan: PlanConfigItem) => {
        setEditingId(plan.id);
        setForm({
            key: plan.key,
            name: plan.name,
            leadsLimit: plan.leadsLimit,
            priceMonthlyBrl: plan.priceMonthlyBrl,
            priceAnnualBrl: plan.priceAnnualBrl,
            priceMonthlyUsd: plan.priceMonthlyUsd,
            priceAnnualUsd: plan.priceAnnualUsd,
            modules: plan.modules,
            isActive: plan.isActive,
            sortOrder: plan.sortOrder,
        });
        setShowModal(true);
        setError(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            if (editingId) {
                await adminApi.plans.update(editingId, form);
                setToast('Plano atualizado com sucesso.');
            } else {
                await adminApi.plans.create(form);
                setToast('Plano criado com sucesso.');
            }
            setShowModal(false);
            loadPlans();
            setTimeout(() => setToast(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (plan: PlanConfigItem) => {
        try {
            await adminApi.plans.update(plan.id, { isActive: !plan.isActive });
            loadPlans();
            setToast(`Plano ${plan.isActive ? 'desativado' : 'ativado'}.`);
            setTimeout(() => setToast(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro');
        }
    };

    const handleDelete = async (plan: PlanConfigItem) => {
        if (!confirm(`Desativar plano "${plan.name}"?`)) return;
        try {
            await adminApi.plans.delete(plan.id);
            loadPlans();
            setToast(`Plano "${plan.name}" desativado.`);
            setTimeout(() => setToast(null), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro');
        }
    };

    const toggleModule = (mod: string) => {
        const current = form.modules ?? [];
        setForm({
            ...form,
            modules: current.includes(mod) ? current.filter((m) => m !== mod) : [...current, mod],
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-semibold text-white">Configuração de Planos</h1>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 rounded-lg bg-violet-600/80 text-white text-sm font-medium hover:bg-violet-600"
                >
                    + Novo Plano
                </button>
            </div>

            {toast && (
                <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 text-sm">
                    {toast}
                </div>
            )}

            {error && !showModal && (
                <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {loading && !plans.length ? (
                <div className="h-48 rounded-xl bg-zinc-800/50 animate-pulse" />
            ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 text-left">
                                    <th className="px-4 py-3 text-zinc-500 font-medium">#</th>
                                    <th className="px-4 py-3 text-zinc-500 font-medium">Key</th>
                                    <th className="px-4 py-3 text-zinc-500 font-medium">Nome</th>
                                    <th className="px-4 py-3 text-zinc-500 font-medium text-right">Leads</th>
                                    <th className="px-4 py-3 text-zinc-500 font-medium text-right">BRL/mês</th>
                                    <th className="px-4 py-3 text-zinc-500 font-medium text-right">USD/mês</th>
                                    <th className="px-4 py-3 text-zinc-500 font-medium">Módulos</th>
                                    <th className="px-4 py-3 text-zinc-500 font-medium text-center">Ativo</th>
                                    <th className="px-4 py-3 text-zinc-500 font-medium text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plans.map((plan, i) => (
                                    <tr
                                        key={plan.id}
                                        className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${!plan.isActive ? 'opacity-40' : ''}`}
                                    >
                                        <td className="px-4 py-3 text-zinc-500 tabular-nums">{i + 1}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs font-mono">
                                                {plan.key}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-white font-medium">{plan.name}</td>
                                        <td className="px-4 py-3 text-right text-zinc-300 tabular-nums font-bold">
                                            {plan.leadsLimit.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                                            {plan.priceMonthlyBrl > 0 ? `R$ ${plan.priceMonthlyBrl}` : 'Grátis'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                                            {plan.priceMonthlyUsd > 0 ? `$ ${plan.priceMonthlyUsd}` : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {(plan.modules as string[]).map((m) => (
                                                    <span key={m} className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[10px] font-medium">
                                                        {m.replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleToggleActive(plan)}
                                                className={`w-10 h-5 rounded-full transition-colors relative ${plan.isActive ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                                            >
                                                <span
                                                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${plan.isActive ? 'left-5' : 'left-0.5'}`}
                                                />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => openEdit(plan)}
                                                    className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(plan)}
                                                    className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-semibold text-white mb-4">
                            {editingId ? 'Editar Plano' : 'Novo Plano'}
                        </h2>

                        {error && (
                            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-zinc-500 text-xs mb-1">Key (e.g. SCALE)</label>
                                    <input
                                        value={form.key}
                                        onChange={(e) => setForm({ ...form, key: e.target.value })}
                                        disabled={!!editingId}
                                        placeholder="ENTERPRISE"
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50 font-mono uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-zinc-500 text-xs mb-1">Nome</label>
                                    <input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Enterprise"
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-zinc-500 text-xs mb-1">Limite de Leads</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.leadsLimit ?? 0}
                                    onChange={(e) => setForm({ ...form, leadsLimit: parseInt(e.target.value) || 0 })}
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-zinc-500 text-xs mb-1">BRL/mês</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={form.priceMonthlyBrl ?? 0}
                                        onChange={(e) => setForm({ ...form, priceMonthlyBrl: parseFloat(e.target.value) || 0 })}
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-zinc-500 text-xs mb-1">BRL/ano</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={form.priceAnnualBrl ?? 0}
                                        onChange={(e) => setForm({ ...form, priceAnnualBrl: parseFloat(e.target.value) || 0 })}
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-zinc-500 text-xs mb-1">USD/mês</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={form.priceMonthlyUsd ?? 0}
                                        onChange={(e) => setForm({ ...form, priceMonthlyUsd: parseFloat(e.target.value) || 0 })}
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-zinc-500 text-xs mb-1">USD/ano</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={form.priceAnnualUsd ?? 0}
                                        onChange={(e) => setForm({ ...form, priceAnnualUsd: parseFloat(e.target.value) || 0 })}
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-zinc-500 text-xs mb-2">Módulos</label>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_MODULES.map((mod) => {
                                        const active = (form.modules ?? []).includes(mod.key);
                                        return (
                                            <button
                                                key={mod.key}
                                                type="button"
                                                onClick={() => toggleModule(mod.key)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${active
                                                        ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                                                        : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                                                    }`}
                                            >
                                                {active ? '✓ ' : ''}{mod.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-zinc-500 text-xs mb-1">Ordem de exibição</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.sortOrder ?? 0}
                                    onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                                    className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-200 text-sm font-medium hover:bg-zinc-600"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || !form.key?.trim() || !form.name?.trim()}
                                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Plano'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
