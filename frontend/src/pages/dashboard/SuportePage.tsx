import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HelpCircle, ChevronDown, MessageSquare, CheckCircle2, ExternalLink, Mail, BookOpen, Compass, Plug, Search, Target, BarChart3, Star, Users, Shield, CreditCard } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from '@/lib/support';
import { clearAllTourFlags } from '@/lib/tour-steps';

const SYSTEM_INSTRUCTIONS = [
    { step: 1, title: 'Nova Busca', icon: Search, body: 'Em Prospecção > Nova Busca, defina país, estado, cidade e raio. Escolha o nicho ou use um template rápido. Filtre por website e telefone para leads mais qualificados.' },
    { step: 2, title: 'Resultados com IA', icon: Star, body: 'Cada lead recebe um Score de Oportunidade (0-100) e classificação hot/warm/cold. Cards mostram avaliação Google, website, telefone e endereço. Filtre por "Com site", "Com tel." ou "Score ≥60".' },
    { step: 3, title: 'Leads salvos', icon: Target, body: 'Salve os melhores leads com um clique. Em Leads Salvos, gerencie status (novo, contactado, convertido), veja análises de IA e exporte para CSV.' },
    { step: 4, title: 'Inteligência IA', icon: BarChart3, body: 'Concorrência (Growth), Relatórios e Análise da empresa (Business), Viabilidade (Enterprise): módulos avançados por plano para decisões estratégicas.' },
    { step: 5, title: 'Integrações CRM', icon: Plug, body: 'Conecte RD Station (OAuth) ou Agendor (token) para enviar leads com dados enriquecidos, negociações, notas com análise de IA e tarefas de follow-up automáticas.' },
    { step: 6, title: 'Equipe', icon: Users, body: 'No plano Enterprise, convide vendedores, distribua territórios e acompanhe performance no Dashboard da equipe.' },
];

type FaqItem = { q: string; a: string };
const FAQ_GROUPS: { title: string; icon: typeof Search; items: FaqItem[] }[] = [
    {
        title: 'Busca e prospecção',
        icon: Search,
        items: [
            { q: 'Como funciona a busca de leads?', a: 'O Precision IA usa o Google Places para buscar empresas reais por nicho e região. Defina país, estado, cidade, raio de busca e o tipo de negócio. A IA classifica cada resultado com um score de oportunidade de 0 a 100.' },
            { q: 'O que são os templates rápidos?', a: 'São nichos pré-configurados (Restaurantes, Salões, Academias, etc.) que preenchem a busca com um clique. Ideal para prospectar rapidamente sem configurar filtros manualmente.' },
            { q: 'Para que servem os filtros de website e telefone?', a: 'Os filtros "Com site" e "Com telefone" ajudam a encontrar leads mais qualificados. Empresas sem site são ótimas oportunidades para agências digitais. Empresas com telefone facilitam o contato direto.' },
            { q: 'O que significa o Score de Oportunidade?', a: 'O Score IA analisa presença digital, avaliações Google, volume de reviews e outros fatores para gerar uma pontuação de 0 a 100. Classificação: Hot (≥70), Warm (40-69), Cold (<40). Quanto maior, mais fácil converter.' },
        ],
    },
    {
        title: 'Leads e resultados',
        icon: Target,
        items: [
            { q: 'Como salvar um lead?', a: 'Nos resultados da busca, clique no ícone de bookmark ao lado do lead. Ele será salvo em Prospecção > Leads Salvos com todos os dados (telefone, website, score, endereço).' },
            { q: 'Os filtros rápidos dos resultados afetam a busca?', a: 'Não. Os chips "Com site", "Com tel." e "Score ≥60" são filtros visuais que organizam os resultados já carregados. A busca no servidor não é refeita.' },
            { q: 'Posso comparar leads lado a lado?', a: 'Sim! Selecione até 3 leads usando os checkboxes e clique em "Comparar". Uma tabela comparativa mostra score, avaliação, reviews, website, telefone e mais.' },
            { q: 'Como exportar resultados para CSV?', a: 'Nos resultados da busca, clique em "Exportar CSV" (disponível a partir do plano Starter). O arquivo inclui todos os dados dos leads exibidos.' },
        ],
    },
    {
        title: 'Créditos e planos',
        icon: CreditCard,
        items: [
            { q: 'Como funcionam os créditos?', a: 'Cada análise de lead com IA consome 1 crédito. O número depende do plano: Free (5/mês), Starter R$129 (100/mês), Growth R$397 (400/mês), Business R$997 (1.200/mês). Créditos renovam automaticamente.' },
            { q: 'Posso cancelar a qualquer momento?', a: 'Sim! Cancele em Planos a qualquer momento. O acesso continua até o fim do período já pago. Não há multa de cancelamento.' },
            { q: 'A busca consome créditos?', a: 'As buscas por leads são gratuitas. Apenas a análise detalhada com IA (que gera score, classificação e estratégia) consome créditos.' },
        ],
    },
    {
        title: 'Integrações CRM',
        icon: Plug,
        items: [
            { q: 'Como conectar o RD Station?', a: 'Vá em Integrações > RD Station > Conectar com OAuth. Você será redirecionado para autorizar o acesso. A conexão é feita com um clique, sem código. Detalhes completos na nossa página de integração.' },
            { q: 'Como conectar o Agendor?', a: 'Vá em Integrações > Agendor e cole seu Token de API. Para obter o token: acesse web.agendor.com.br > Configurações > Integrações > copie o token. Cole no Precision IA e salve.' },
            { q: 'O que é enviado ao CRM quando envio um lead?', a: 'No modo "Contato + Negócio": cria contato com dados completos, organização, negociação com análise de IA na descrição (resumo, pontos fortes/fracos, scripts de abordagem, mensagem WhatsApp) e tarefa de follow-up automática.' },
            { q: 'Os contatos são duplicados se eu enviar duas vezes?', a: 'No Agendor, usamos upsert (deduplicação por e-mail). No RD Station CRM, o contato é atualizado se já existir. Não há duplicação.' },
            { q: 'Meu token/credenciais ficam seguros?', a: 'Sim. Tokens do Agendor são criptografados no banco de dados. O RD Station usa OAuth 2.0 com HMAC-SHA256 e refresh automático. Nenhuma credencial é exposta no frontend.' },
            { q: 'Posso escolher funil e etapa da negociação?', a: 'Sim! No painel lateral CRM, selecione o funil, etapa e responsável antes de enviar. Funciona tanto para RD Station quanto Agendor.' },
        ],
    },
    {
        title: 'Score e análises',
        icon: Star,
        items: [
            { q: 'Como funciona a Análise de Concorrência?', a: 'O sistema busca concorrentes na região e gera rankings por avaliação Google, volume de reviews e presença digital. Identifica gaps de mercado (empresas sem site). Disponível no plano Growth.' },
            { q: 'O que é a Análise de Viabilidade?', a: 'Informe tipo de negócio e cidade. A IA analisa dados reais (concorrentes, saturação, maturidade digital) e gera um score de viabilidade com recomendações de diferenciação. Plano Enterprise.' },
            { q: 'O que é a Análise "Minha Empresa"?', a: 'Cadastre sua empresa e a IA analisa seu posicionamento digital: avaliações, presença online, posição vs. concorrentes. Gera recommendations para melhorar. Plano Business.' },
        ],
    },
    {
        title: 'Equipe',
        icon: Users,
        items: [
            { q: 'Como convido membros para minha equipe?', a: 'Na página Equipe > Minha Equipe (plano Enterprise), clique em "Convidar Membro" e insira o e-mail. O usuário recebe um convite e se junta à equipe após aceitar.' },
            { q: 'Posso controlar o que cada membro vê?', a: 'Membros compartilham o mesmo plano e créditos da equipe. O admin acompanha uso individual no Dashboard da equipe.' },
        ],
    },
    {
        title: 'Conta e segurança',
        icon: Shield,
        items: [
            { q: 'Os dados são reais?', a: 'Sim! Usamos o Google Places API para dados reais e atualizados de empresas. Avaliações, telefones, websites e endereços são dados oficiais do Google. As análises são feitas com Gemini AI.' },
            { q: 'Como altero minha senha?', a: 'Em Conta > Configurações você encontra a opção de alterar senha. Se esqueceu, use "Esqueci minha senha" na tela de login.' },
            { q: 'Meus dados estão seguros?', a: 'Sim. Usamos HTTPS em todas as comunicações, headers de segurança (CSP, HSTS), rate limiting, tokens criptografados e autenticação OAuth 2.0. Seguimos as melhores práticas OWASP.' },
        ],
    },
];

export default function SuportePage() {
    const navigate = useNavigate();
    const [instructionsOpen, setInstructionsOpen] = useState(true);
    const [openFaqKey, setOpenFaqKey] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleRefazerTour = () => {
        clearAllTourFlags();
        navigate('/dashboard');
    };

    // Filter FAQ by search query
    const filteredGroups = searchQuery.trim().length < 2
        ? FAQ_GROUPS
        : FAQ_GROUPS.map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                const q = searchQuery.toLowerCase();
                return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
            }),
        })).filter((group) => group.items.length > 0);

    return (
        <>
            <HeaderDashboard title="Ajuda e Suporte" subtitle="Guias, perguntas frequentes e contato." breadcrumb="Suporte / Ajuda" />
            <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full space-y-8">

                {/* System Status */}
                <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Todos os sistemas operacionais</p>
                        <p className="text-[11px] text-muted">API, busca e IA funcionando normalmente.</p>
                    </div>
                </div>

                {/* Quick actions row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                        type="button"
                        onClick={handleRefazerTour}
                        className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 hover:bg-surface/50 hover:border-violet-500/30 transition-colors text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                            <Compass size={20} className="text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground">Refazer tour</p>
                            <p className="text-[11px] text-muted">Rever o passo a passo</p>
                        </div>
                    </button>
                    <Link
                        to="/integracoes/rdstation"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 hover:bg-surface/50 hover:border-[#00C4CC]/30 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 p-1">
                            <img src="/logos/RD_Station_idYP8zaxIA_2.png" alt="Logo RD Station" className="h-6 object-contain" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground flex items-center gap-1">Guia RD Station <ExternalLink size={11} className="text-muted" /></p>
                            <p className="text-[11px] text-muted">Integração completa</p>
                        </div>
                    </Link>
                    <Link
                        to="/integracoes/agendor"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 hover:bg-surface/50 hover:border-[#4400CC]/30 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 p-1">
                            <img src="/logos/Agendor_idi8FvRR_k_0.png" alt="Logo Agendor" className="h-6 object-contain" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground flex items-center gap-1">Guia Agendor <ExternalLink size={11} className="text-muted" /></p>
                            <p className="text-[11px] text-muted">Como obter o token</p>
                        </div>
                    </Link>
                </div>

                {/* Como usar — collapsible instructions */}
                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setInstructionsOpen(!instructionsOpen)}
                        className="w-full p-6 border-b border-border flex items-center justify-between text-left hover:bg-surface/30 transition-colors"
                    >
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <BookOpen size={18} className="text-violet-600 dark:text-violet-400" /> Como usar o Precision IA
                        </h3>
                        <ChevronDown
                            size={16}
                            className={`text-muted shrink-0 transition-transform ${instructionsOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {instructionsOpen && (
                        <div className="p-6 grid sm:grid-cols-2 gap-4">
                            {SYSTEM_INSTRUCTIONS.map(({ step, title, icon: Icon, body }) => (
                                <div key={step} className="flex gap-3 p-3 rounded-xl bg-surface/30 border border-border/50">
                                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                                        <Icon size={16} className="text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-foreground">{step}. {title}</p>
                                        <p className="text-xs text-muted leading-relaxed mt-1">{body}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Integration quick guide cards */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <img src="/logos/RD_Station_idYP8zaxIA_2.png" alt="Logo RD Station" className="h-8 object-contain bg-white rounded-lg p-1" />
                            <h4 className="font-bold text-foreground">RD Station</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">OAuth</span>
                        </div>
                        <ol className="space-y-1.5 text-xs text-muted">
                            <li className="flex gap-2"><span className="font-bold text-violet-600 dark:text-violet-400 shrink-0">1.</span> Vá em Integrações</li>
                            <li className="flex gap-2"><span className="font-bold text-violet-600 dark:text-violet-400 shrink-0">2.</span> Clique &quot;Conectar com OAuth&quot;</li>
                            <li className="flex gap-2"><span className="font-bold text-violet-600 dark:text-violet-400 shrink-0">3.</span> Autorize no RD Station</li>
                            <li className="flex gap-2"><span className="font-bold text-violet-600 dark:text-violet-400 shrink-0">4.</span> Pronto! Status ficará &quot;Conectado&quot;</li>
                        </ol>
                        <p className="text-[11px] text-muted">Suporta CRM e Marketing. Cria contatos, negócios, notas e tarefas.</p>
                    </div>
                    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <img src="/logos/Agendor_idi8FvRR_k_0.png" alt="Logo Agendor" className="h-8 object-contain bg-white rounded-lg p-1" />
                            <h4 className="font-bold text-foreground">Agendor</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold">Token</span>
                        </div>
                        <ol className="space-y-1.5 text-xs text-muted">
                            <li className="flex gap-2"><span className="font-bold text-[#7C5CFC] shrink-0">1.</span> No Agendor: Configurações → Integrações</li>
                            <li className="flex gap-2"><span className="font-bold text-[#7C5CFC] shrink-0">2.</span> Copie o Token de API</li>
                            <li className="flex gap-2"><span className="font-bold text-[#7C5CFC] shrink-0">3.</span> No Precision IA: Integrações → Agendor</li>
                            <li className="flex gap-2"><span className="font-bold text-[#7C5CFC] shrink-0">4.</span> Cole o token e clique &quot;Salvar&quot;</li>
                        </ol>
                        <p className="text-[11px] text-muted">Cria pessoa, organização, negociação e tarefa de follow-up.</p>
                    </div>
                </div>

                {/* FAQ Search */}
                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                    <div className="p-6 border-b border-border space-y-3">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <HelpCircle size={18} className="text-violet-600 dark:text-violet-400" /> Perguntas Frequentes
                        </h3>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar nas perguntas..."
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="divide-y divide-border/50">
                        {filteredGroups.length === 0 && (
                            <div className="px-6 py-8 text-center text-sm text-muted">
                                Nenhuma pergunta encontrada para &quot;{searchQuery}&quot;.
                            </div>
                        )}
                        {filteredGroups.map((group, gi) => {
                            const GroupIcon = group.icon;
                            return (
                                <div key={group.title}>
                                    <div className="px-6 pt-4 pb-1 flex items-center gap-2">
                                        <GroupIcon size={13} className="text-violet-600 dark:text-violet-400" />
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{group.title}</p>
                                        <span className="text-[10px] text-muted/50">({group.items.length})</span>
                                    </div>
                                    {group.items.map((item, ii) => {
                                        const key = `${gi}-${ii}`;
                                        const isOpen = openFaqKey === key;
                                        return (
                                            <div key={key}>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenFaqKey(isOpen ? null : key)}
                                                    className="w-full flex items-center justify-between px-6 py-3.5 text-left hover:bg-surface/30 transition-colors"
                                                >
                                                    <span className="text-sm font-medium text-foreground pr-4">{item.q}</span>
                                                    <ChevronDown
                                                        size={16}
                                                        className={`text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                                    />
                                                </button>
                                                {isOpen && (
                                                    <div className="px-6 pb-4 text-sm text-muted leading-relaxed animate-in slide-in-from-top-1">
                                                        {item.a}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="rounded-2xl bg-card border border-border p-6 flex items-start gap-4 hover:bg-surface/50 transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                            <Mail size={18} className="text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-foreground group-hover:text-violet-600 dark:text-violet-400 transition-colors">Email</h4>
                            <p className="text-xs text-muted mt-1">{SUPPORT_EMAIL}</p>
                            <p className="text-[10px] text-muted/60 mt-0.5">Resposta em até 24h</p>
                        </div>
                    </a>
                    <a
                        href={SUPPORT_WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl bg-card border border-border p-6 flex items-start gap-4 hover:bg-surface/50 transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <MessageSquare size={18} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-foreground group-hover:text-emerald-600 dark:text-emerald-400 transition-colors flex items-center gap-1">
                                WhatsApp <ExternalLink size={12} />
                            </h4>
                            <p className="text-xs text-muted mt-1">Suporte via WhatsApp</p>
                            <p className="text-[10px] text-muted/60 mt-0.5">Seg-Sex, 9h às 18h</p>
                        </div>
                    </a>
                </div>
            </div>
        </>
    );
}
