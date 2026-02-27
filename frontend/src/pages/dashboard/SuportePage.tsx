import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ChevronDown, MessageSquare, CheckCircle2, ExternalLink, Mail, BookOpen, Compass } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from '@/lib/support';
import { clearAllTourFlags } from '@/lib/tour-steps';

const SYSTEM_INSTRUCTIONS = [
    { step: 1, title: 'Nova Busca', body: 'Em Prospecção > Nova Busca, defina cidade, nicho e opcionalmente bairros. Execute a busca para encontrar leads na região.' },
    { step: 2, title: 'Histórico e Leads', body: 'Em Histórico você vê todas as buscas realizadas. Em Leads Salvos ficam os negócios que você salvou para contato. Use o Score IA para priorizar.' },
    { step: 3, title: 'Inteligência', body: 'Concorrência (Growth), Relatórios e Análise minha empresa (Business), Viabilidade (Enterprise): análises por plano para entender o mercado e se diferenciar.' },
    { step: 4, title: 'Equipe', body: 'No plano Enterprise, use Minha Equipe para convidar membros e o Dashboard da equipe para acompanhar uso e resultados.' },
    { step: 5, title: 'Conta', body: 'Perfil e Empresa para seus dados; Planos para upgrade; Configurações para preferências; Suporte para dúvidas e contato.' },
];

type FaqItem = { q: string; a: string };
const FAQ_GROUPS: { title: string; items: FaqItem[] }[] = [
    {
        title: 'Créditos e planos',
        items: [
            { q: 'Como funcionam os créditos?', a: 'Cada busca por leads consome 1 crédito. O número de créditos depende do seu plano. Os créditos renovam automaticamente todo mês.' },
            { q: 'Posso cancelar a qualquer momento?', a: 'Sim! Você pode cancelar seu plano a qualquer momento. O acesso continua até o fim do período já pago.' },
        ],
    },
    {
        title: 'Busca e leads',
        items: [
            { q: 'Onde vejo meu histórico de buscas?', a: 'No menu Prospecção > Histórico. Lá aparecem todas as buscas que você realizou, com data e parâmetros. Clique em uma busca para ver os leads encontrados.' },
            { q: 'O que são Leads Salvos?', a: 'São negócios que você escolheu salvar para contato. Eles ficam em Prospecção > Leads Salvos, com Score IA e dados para WhatsApp e e-mail. Você pode marcar status (novo, contactado, convertido, perdido).' },
        ],
    },
    {
        title: 'Score e análises IA',
        items: [
            { q: 'O que é o Score IA?', a: 'O Score IA analisa o perfil digital do lead (presença online, avaliações, etc.) e gera uma pontuação de 0-100 indicando o potencial de venda. Quanto maior o score, mais fácil é converter.' },
            { q: 'Como funciona a Análise de Concorrência?', a: 'O sistema busca todos os concorrentes na região definida e gera rankings por avaliação, volume de reviews e presença digital. Identifica oportunidades (empresas sem site). Disponível no plano Growth.' },
            { q: 'O que é a Análise de Viabilidade?', a: 'Ao informar tipo de negócio e cidade, a IA analisa dados reais (concorrentes, saturação, maturidade digital) e gera um score de viabilidade com recomendações de como se diferenciar. Disponível no plano Enterprise.' },
        ],
    },
    {
        title: 'Equipe',
        items: [
            { q: 'Como convido membros para minha equipe?', a: 'Na página Equipe > Minha Equipe (plano Enterprise), clique em "Convidar Membro" e insira o e-mail. O usuário precisa já ter uma conta no Prospector AI.' },
        ],
    },
    {
        title: 'Dados e segurança',
        items: [
            { q: 'Os dados são reais?', a: 'Sim! Usamos o Google Places API para buscar dados reais e atualizados de empresas. As análises são feitas com Gemini AI sobre dados reais.' },
            { q: 'Como altero minha senha?', a: 'Em Conta > Configurações você encontra a opção de alterar senha. Se esqueceu a senha, use "Esqueci minha senha" na tela de login.' },
        ],
    },
];

export default function SuportePage() {
    const navigate = useNavigate();
    const [instructionsOpen, setInstructionsOpen] = useState(true);
    const [openFaqKey, setOpenFaqKey] = useState<string | null>(null);

    const handleRefazerTour = () => {
        clearAllTourFlags();
        navigate('/dashboard');
    };

    return (
        <>
            <HeaderDashboard title="Suporte" subtitle="Tire suas dúvidas e entre em contato." breadcrumb="Conta / Suporte" />
            <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full space-y-8">

                {/* System Status */}
                <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-emerald-400">Todos os sistemas operacionais</p>
                        <p className="text-[11px] text-muted">API, busca e IA funcionando normalmente.</p>
                    </div>
                </div>

                {/* Ver tour do sistema */}
                <div className="rounded-2xl bg-card border border-border p-4">
                    <p className="text-sm text-muted mb-3">Quer rever o passo a passo de cada área do dashboard?</p>
                    <button
                        type="button"
                        onClick={handleRefazerTour}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 text-sm font-medium transition-colors border border-violet-500/20"
                    >
                        <Compass size={16} /> Ver tour do sistema
                    </button>
                </div>

                {/* Instruções do sistema */}
                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setInstructionsOpen(!instructionsOpen)}
                        className="w-full p-6 border-b border-border flex items-center justify-between text-left hover:bg-surface/30 transition-colors"
                    >
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <BookOpen size={18} className="text-violet-400" /> Como usar o Prospector AI
                        </h3>
                        <ChevronDown
                            size={16}
                            className={`text-muted shrink-0 transition-transform ${instructionsOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {instructionsOpen && (
                        <div className="p-6 space-y-4">
                            {SYSTEM_INSTRUCTIONS.map(({ step, title, body }) => (
                                <div key={step} className="flex gap-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">
                                        {step}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{title}</p>
                                        <p className="text-sm text-muted leading-relaxed mt-0.5">{body}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FAQ por tema */}
                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <HelpCircle size={18} className="text-violet-400" /> Perguntas Frequentes
                        </h3>
                    </div>
                    <div className="divide-y divide-border/50">
                        {FAQ_GROUPS.map((group, gi) => (
                            <div key={group.title}>
                                <div className="px-6 pt-4 pb-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{group.title}</p>
                                </div>
                                {group.items.map((item, ii) => {
                                    const key = `${gi}-${ii}`;
                                    const isOpen = openFaqKey === key;
                                    return (
                                        <div key={key}>
                                            <button
                                                type="button"
                                                onClick={() => setOpenFaqKey(isOpen ? null : key)}
                                                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface/30 transition-colors"
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
                        ))}
                    </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="rounded-2xl bg-card border border-border p-6 flex items-start gap-4 hover:bg-surface/50 transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                            <Mail size={18} className="text-violet-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-foreground group-hover:text-violet-400 transition-colors">Email</h4>
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
                            <MessageSquare size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-foreground group-hover:text-emerald-400 transition-colors flex items-center gap-1">
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
