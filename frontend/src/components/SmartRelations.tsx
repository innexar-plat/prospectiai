import { useEffect, useState } from 'react';
import { Building2, MapPin, Phone, Mail, Network, Users, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { smartRelationsApi, type SmartRelationsResult, type RelatedCompany } from '@/lib/api';

interface SmartRelationsProps {
    placeId: string;
}

const RELATION_LABELS: Record<string, { label: string; color: string; icon: typeof Building2 }> = {
    shared_phone: { label: 'Mesmo Telefone', color: 'text-red-600 bg-red-50 dark:bg-red-900/30', icon: Phone },
    shared_email: { label: 'Mesmo Email', color: 'text-red-600 bg-red-50 dark:bg-red-900/30', icon: Mail },
    same_city_cnae: { label: 'Mesmo Setor + Cidade', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30', icon: Building2 },
    same_cnae: { label: 'Mesmo Setor (Estado)', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30', icon: Building2 },
    same_neighbourhood: { label: 'Mesmo Bairro', color: 'text-green-600 bg-green-50 dark:bg-green-900/30', icon: MapPin },
    same_sector_lead: { label: 'Lead Similar', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30', icon: Users },
};

function formatCnpj(cnpj: string): string {
    if (!cnpj || cnpj.length !== 14) return cnpj;
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatCapital(value: number | null): string {
    if (!value) return '—';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function CompanyCard({ company }: { company: RelatedCompany }) {
    const rel = RELATION_LABELS[company.relation] || { label: company.relation, color: 'text-gray-600 bg-gray-50', icon: Building2 };
    const Icon = rel.icon;

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                        {company.tradeName || company.name}
                    </p>
                    {company.tradeName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{company.name}</p>
                    )}
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${rel.color}`}>
                    <Icon size={10} />
                    {rel.label}
                </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                {company.cnpj && (
                    <span className="flex items-center gap-1">
                        <Building2 size={10} className="shrink-0" />
                        {formatCnpj(company.cnpj)}
                    </span>
                )}
                {company.city && (
                    <span className="flex items-center gap-1">
                        <MapPin size={10} className="shrink-0" />
                        {company.city}{company.uf ? ` - ${company.uf}` : ''}
                    </span>
                )}
                {company.phone && (
                    <span className="flex items-center gap-1">
                        <Phone size={10} className="shrink-0" />
                        {company.phone}
                    </span>
                )}
                {company.email && (
                    <span className="flex items-center gap-1 truncate">
                        <Mail size={10} className="shrink-0" />
                        {company.email}
                    </span>
                )}
            </div>

            <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-500">
                {company.porte && <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{company.porte}</span>}
                {company.capitalSocial != null && company.capitalSocial > 0 && (
                    <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{formatCapital(company.capitalSocial)}</span>
                )}
                {company.cnae && (
                    <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded truncate max-w-[200px]">{company.cnae}</span>
                )}
            </div>
        </div>
    );
}

function ClusterSection({ title, icon: Icon, companies, color, emptyText }: {
    title: string;
    icon: typeof Building2;
    companies: RelatedCompany[];
    color: string;
    emptyText: string;
}) {
    const [expanded, setExpanded] = useState(companies.length <= 3);
    const visible = expanded ? companies : companies.slice(0, 3);

    if (companies.length === 0) {
        return (
            <div className="text-center py-4 text-xs text-gray-400 dark:text-gray-600">
                {emptyText}
            </div>
        );
    }

    return (
        <div>
            <div className={`flex items-center gap-2 mb-2 ${color}`}>
                <Icon size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">{title}</span>
                <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-full font-mono">
                    {companies.length}
                </span>
            </div>
            <div className="space-y-2">
                {visible.map((c, i) => <CompanyCard key={`${c.cnpj}-${i}`} company={c} />)}
            </div>
            {companies.length > 3 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mx-auto"
                >
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {expanded ? 'Ver menos' : `Ver mais ${companies.length - 3} empresas`}
                </button>
            )}
        </div>
    );
}

export default function SmartRelations({ placeId }: SmartRelationsProps) {
    const [data, setData] = useState<SmartRelationsResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open || data) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        smartRelationsApi.get(placeId)
            .then((res: { data: SmartRelationsResult }) => { if (!cancelled) setData(res.data); })
            .catch((err: Error) => { if (!cancelled) setError(err.message || 'Erro ao buscar relações'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, placeId, data]);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                        <Network size={18} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            Smart Relations
                        </h3>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Rede de conexões • Empresas relacionadas • Grafo de conhecimento
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {data && data.stats.totalFound > 0 && (
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                            {data.stats.totalFound} conexões
                        </span>
                    )}
                    {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
            </button>

            {open && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
                    {loading && (
                        <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-500">
                            <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                            Descobrindo conexões...
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-6 text-sm text-red-500">{error}</div>
                    )}

                    {data && !loading && (
                        <>
                            {/* Stats bar */}
                            {data.stats.totalFound > 0 && (
                                <div className="grid grid-cols-4 gap-2 my-3">
                                    <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                        <p className="text-lg font-bold text-red-600">{data.stats.contactNetwork}</p>
                                        <p className="text-[10px] text-red-500">Rede de Contato</p>
                                    </div>
                                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                        <p className="text-lg font-bold text-blue-600">{data.stats.sameSector}</p>
                                        <p className="text-[10px] text-blue-500">Mesmo Setor</p>
                                    </div>
                                    <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <p className="text-lg font-bold text-green-600">{data.stats.sameRegion}</p>
                                        <p className="text-[10px] text-green-500">Mesma Região</p>
                                    </div>
                                    <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                        <p className="text-lg font-bold text-amber-600">{data.stats.userLeads}</p>
                                        <p className="text-[10px] text-amber-500">Leads Similares</p>
                                    </div>
                                </div>
                            )}

                            {data.stats.totalFound === 0 && (
                                <div className="text-center py-8 text-sm text-gray-400">
                                    <Network size={32} className="mx-auto mb-2 opacity-30" />
                                    <p>Nenhuma conexão encontrada para este lead.</p>
                                    <p className="text-[11px] mt-1">Leads com CNPJ têm mais conexões na Receita Federal.</p>
                                </div>
                            )}

                            <div className="space-y-4 mt-3">
                                <ClusterSection
                                    title="Rede de Contato"
                                    icon={Phone}
                                    companies={data.clusters.contactNetwork}
                                    color="text-red-600 dark:text-red-400"
                                    emptyText="Sem empresas com mesmo telefone/email"
                                />
                                <ClusterSection
                                    title="Mesmo Setor (CNAE)"
                                    icon={TrendingUp}
                                    companies={data.clusters.sameSector}
                                    color="text-blue-600 dark:text-blue-400"
                                    emptyText="Sem empresas no mesmo setor registrado"
                                />
                                <ClusterSection
                                    title="Mesma Região"
                                    icon={MapPin}
                                    companies={data.clusters.sameRegion}
                                    color="text-green-600 dark:text-green-400"
                                    emptyText="Sem empresas no mesmo bairro"
                                />
                                <ClusterSection
                                    title="Seus Leads Similares"
                                    icon={Users}
                                    companies={data.clusters.userLeads}
                                    color="text-amber-600 dark:text-amber-400"
                                    emptyText="Nenhum outro lead no mesmo setor"
                                />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
