import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Search, Brain, Rocket, Zap, ArrowRight, Shield, Globe, Download, Users,
    FileOutput, Lock, BarChart3, Target, MessageSquare, TrendingUp,
    Tag, Swords, ChevronDown, Quote, CheckCircle2, XCircle, Play, Star,
    Clock, DollarSign, TrendingDown, Network, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const STATS = [
    { value: '27M+', label: 'Empresas na base', icon: Globe },
    { value: '60%', label: 'Redução de tempo', icon: Clock },
    { value: 'R$ 0,99', label: 'Custo por lead', icon: DollarSign },
    { value: '10s', label: 'Análise completa', icon: Zap },
] as const;

const HERO_CARDS = [
    {
        icon: Search,
        title: 'Mapeamento Inteligente',
        desc: 'Encontre milhares de empresas por nicho e região em segundos com Google Places + base RF.',
        gradient: 'from-violet-600 to-indigo-600',
    },
    {
        icon: Brain,
        title: 'Score IA por Lead',
        desc: 'Análise completa com score 0-100, probabilidade de fechamento, dores, gaps e scripts prontos.',
        gradient: 'from-cyan-600 to-blue-600',
    },
    {
        icon: Swords,
        title: 'Análise de Concorrência',
        desc: 'Rankings, presença digital, gaps de mercado e playbook competitivo gerado por IA.',
        gradient: 'from-emerald-600 to-teal-600',
    },
    {
        icon: TrendingUp,
        title: 'Viabilidade de Negócio',
        desc: 'Score 0-10 com veredito GO/NO-GO. Investimento, riscos e oportunidades por região.',
        gradient: 'from-amber-600 to-orange-600',
    },
    {
        icon: Network,
        title: 'Smart Relations',
        desc: 'Descubra conexões invisíveis: sócios, grupos empresariais e clusters de mercado.',
        gradient: 'from-pink-600 to-rose-600',
    },
    {
        icon: MessageSquare,
        title: 'Scripts IA Prontos',
        desc: 'Email, WhatsApp e telefone personalizados pela IA. Copie e envie em 1 clique.',
        gradient: 'from-violet-600 to-purple-600',
    },
] as const;

const BEFORE_AFTER = [
    { before: 'Pesquisar empresas no Google: 2-3h', after: 'Busca inteligente: 30 segundos', saving: '95%' },
    { before: 'Qualificar 1 lead manualmente: 30 min', after: 'Score IA automático: 10 segundos', saving: '95%' },
    { before: 'Escrever email de abordagem: 15 min', after: 'Gerado pela IA: 0 min', saving: '100%' },
    { before: 'Pesquisar CNPJ na Receita: 10 min/empresa', after: 'Match automático com 27M empresas', saving: '100%' },
    { before: 'Analisar concorrência: 3-5 horas', after: 'Relatório IA: 2 minutos', saving: '97%' },
    { before: 'Estudar viabilidade de mercado: 1-2 dias', after: 'Score + relatório: 3 minutos', saving: '99%' },
] as const;

const AI_BRANDS = [
    { name: 'OpenAI', logo: '/brands/openai.svg' },
    { name: 'Google AI', logo: '/brands/google.svg' },
    { name: 'Anthropic', logo: '/brands/anthropic.svg' },
    { name: 'Meta AI', logo: '/brands/meta.svg' },
    { name: 'Mistral AI', logo: '/brands/mistral.svg' },
    { name: 'Gemini', logo: '/brands/gemini.svg' },
    { name: 'Claude', logo: '/brands/claude.svg' },
    { name: 'DeepSeek', logo: '/brands/deepseek.svg' },
] as const;

const TECH_LOGOS = [
    { name: 'Google', logo: '/brands/google.svg' },
    { name: 'Microsoft', logo: '/brands/microsoft.svg' },
    { name: 'Meta', logo: '/brands/meta.svg' },
    { name: 'Amazon AWS', logo: '/brands/aws.svg' },
    { name: 'Cloudflare', logo: '/brands/cloudflare.svg' },
    { name: 'Stripe', logo: '/brands/stripe.svg' },
    { name: 'PostgreSQL', logo: '/brands/postgresql.svg' },
    { name: 'Redis', logo: '/brands/redis.svg' },
] as const;

const CRM_INTEGRATIONS = [
    { name: 'RD Station', desc: 'OAuth nativo', logo: '/brands/rdstation.svg' },
    { name: 'Agendor', desc: 'Token API', logo: '/brands/agendor.svg' },
    { name: 'HubSpot', desc: 'OAuth nativo', logo: '/brands/hubspot.svg' },
    { name: 'CSV/JSON', desc: 'Exportação', logo: null },
] as const;

const LANDING_FAQ = [
    {
        q: 'Preciso de conhecimento técnico para usar?',
        a: 'Não. A plataforma foi projetada para vendedores e equipes comerciais. Basta digitar o nicho, a região e clicar em buscar — a IA faz o resto.'
    },
    {
        q: 'Quanto tempo leva para ver resultados?',
        a: 'Imediatamente. Em poucos segundos você encontra empresas, recebe o score IA e já sai com contexto para abordar os leads com muito mais precisão.'
    },
    {
        q: 'A IA é confiável? De onde vêm os dados?',
        a: 'Usamos as IAs mais modernas do mercado. Os dados vêm de fontes oficiais: Google Places (avaliações, localização), Receita Federal (27M empresas, CNPJ, CNAE, porte), Reclame Aqui e Jus Brasil.'
    },
    {
        q: 'Posso integrar com o CRM que já uso?',
        a: 'Sim. Integramos nativamente com RD Station (OAuth), Agendor (Token API) e HubSpot. Também exportamos em CSV e JSON.'
    },
    {
        q: 'Qual a diferença para ferramentas como Econodata ou Speedio?',
        a: 'Nós combinamos busca + qualificação IA + scripts de abordagem + análise de mercado + integrações CRM em uma única plataforma. Não é só uma lista de empresas — é inteligência comercial completa.'
    },
    {
        q: 'Posso cancelar a qualquer momento?',
        a: 'Sim, sem multa e sem burocracia. Cancele direto na plataforma. Seu plano continua ativo até o fim do período pago.'
    },
    {
        q: 'Como funciona o plano gratuito?',
        a: 'Você recebe 10 créditos/mês para testar a plataforma sem cartão de crédito. Dá para buscar empresas, analisar os melhores leads com IA e validar o fluxo antes de assinar.'
    },
    {
        q: 'O sistema é seguro?',
        a: 'Sim. Autenticação 2FA, criptografia de dados sensíveis, HTTPS obrigatório, rate limiting, tokens CRM criptografados em repouso e conformidade com LGPD.'
    },
] as const;

/* ------------------------------------------------------------------ */
/*  Marquee — infinite scroll                                          */
/* ------------------------------------------------------------------ */

function InfiniteMarquee({ items, speed = 30, reverse = false }: { items: readonly { name: string; logo: string }[]; speed?: number; reverse?: boolean }) {
    const doubled = [...items, ...items];
    return (
        <div className="overflow-hidden relative" aria-hidden="true">
            <span className="sr-only">{items.map(i => i.name).join(', ')}</span>
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div
                className={`flex items-center gap-8 whitespace-nowrap ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}
                style={{ animationDuration: `${speed}s` }}
            >
                {doubled.map((item, i) => (
                    <div key={`${item.name}-${i}`} className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border shrink-0 card-shadow hover:border-violet-500/30 transition-colors">
                        <img src={item.logo} alt={item.name} className="w-8 h-8 object-contain" loading="lazy" />
                        <span className="font-semibold text-sm text-foreground">{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Animated stat                                                      */
/* ------------------------------------------------------------------ */

function AnimatedStat({ value, label, icon: Icon }: { value: string; label: string; icon: typeof Zap }) {
    return (
        <div className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-card border border-border card-shadow hover:border-violet-500/25 transition-all duration-300 card-shadow-hover">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-600 mb-1">
                <Icon size={20} aria-hidden />
            </div>
            <span className="text-3xl md:text-4xl font-black accent-gradient">{value}</span>
            <span className="text-sm text-muted font-medium">{label}</span>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function LandingPage({ onViewPlans, t }: { locale: string; onViewPlans: () => void; t: (key: string, options?: Record<string, unknown>) => string }) {
    const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

    const landingFaqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: LANDING_FAQ.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
    };

    const softwareAppSchema = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Precision',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
            '@type': 'AggregateOffer',
            lowPrice: '0',
            highPrice: '2497',
            priceCurrency: 'BRL',
            offerCount: '5',
        },
        description: 'Como encontrar empresas para vender: plataforma de prospecção B2B com IA. Busca por nicho, região, score de leads e análise de mercado.',
        featureList: 'Busca por nicho e região, Score de leads com IA, Análise de concorrência, Viabilidade de negócio, Smart Relations, Smart Tags, Gestão de equipe, Integração RD Station, Agendor e HubSpot, Activity Tracking, Exportação CSV/JSON, Scripts de abordagem com IA',
        inLanguage: 'pt-BR',
        url: 'https://precisionia.com.br',
    };

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-violet-500/30 overflow-x-hidden" role="document">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(landingFaqSchema) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 right-0 h-[80vh] bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.18)_0%,transparent_65%)] pointer-events-none" />
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/10 blur-[120px] rounded-full pointer-events-none animate-float" />
            <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none animate-float animation-delay-200" />

            {/* ═══════════════════════════════════════════════ */}
            {/* HERO SECTION                                   */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="relative pt-32 pb-16 md:pt-48 md:pb-24 px-4" aria-labelledby="hero-title">
                <div className="max-w-5xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 text-xs font-bold mb-8 animate-fade card-shadow" role="status">
                        <Zap size={14} className="fill-current" aria-hidden />
                        <span className="tracking-widest uppercase">PLATAFORMA DE PROSPECÇÃO COM IA</span>
                    </div>

                    <h1 id="hero-title" className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-6 animate-slide">
                        <span className="text-foreground">Encontre empresas e</span>
                        <br />
                        <span className="accent-gradient">priorize os melhores leads</span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted max-w-3xl mx-auto mb-10 leading-relaxed animate-fade animation-delay-200 animation-fill-both">
                        Busque por nicho e região, receba score IA em segundos e descubra quem vale seu tempo antes de entrar em contato. Teste com <strong className="text-foreground">10 créditos grátis</strong> e dados de <strong className="text-foreground">27 milhões de empresas brasileiras</strong>.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 mb-10 text-xs md:text-sm font-semibold text-muted animate-fade animation-delay-300 animation-fill-both">
                        <span className="px-3 py-1.5 rounded-full bg-card border border-border">10 créditos grátis</span>
                        <span className="px-3 py-1.5 rounded-full bg-card border border-border">Sem cartão</span>
                        <span className="px-3 py-1.5 rounded-full bg-card border border-border">Busca por nicho e região</span>
                    </div>

                    {/* STATS BAR */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-10 animate-fade animation-delay-300 animation-fill-both">
                        {STATS.map(s => (
                            <AnimatedStat key={s.label} value={s.value} label={s.label} icon={s.icon} />
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide animation-delay-300 animation-fill-both">
                        <Link
                            to="/auth/signup"
                            className="inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 motion-safe:active:scale-95 bg-[#7c3aed] text-white shadow-[0_4px_14px_0_rgba(124,58,237,0.3)] hover:bg-[#6d28d9] hover:shadow-[0_6px_20px_rgba(109,40,217,0.4)] hover:-translate-y-0.5 w-full sm:w-auto h-16 px-10 text-lg group"
                        >
                            <Rocket size={20} className="mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" aria-hidden />
                            Testar agora — 10 créditos grátis
                        </Link>
                        <Button onClick={onViewPlans} variant="secondary" size="lg" className="w-full sm:w-auto h-16 px-10 text-lg">
                            {t('landing.ctaPlans')}
                        </Button>
                    </div>
                    <p className="mt-4 text-sm text-muted animate-fade animation-delay-400 animation-fill-both">
                        Sem cartão de crédito · Cancele quando quiser ·{' '}
                        <Link to="/auth/afiliado/cadastro" className="font-semibold underline decoration-violet-500/50 hover:decoration-violet-500 transition-colors">
                            Seja um afiliado
                        </Link>
                    </p>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* AI & TECH TRUST BANNER                         */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-10 px-4 border-y border-border bg-surface/30" aria-label="Tecnologias">
                <p className="text-center text-xs font-bold uppercase tracking-widest text-muted mb-6">Powered by as IAs mais modernas do mercado</p>
                <InfiniteMarquee items={AI_BRANDS} speed={25} />
                <div className="mt-6">
                    <InfiniteMarquee items={TECH_LOGOS} speed={35} reverse />
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* VIDEO PLACEHOLDER CARDS (2 grandes)            */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-20 md:py-28 px-4" aria-labelledby="demo-heading">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 id="demo-heading" className="text-3xl md:text-5xl font-black mb-4 text-foreground">Veja o <span className="accent-gradient">Precision</span> em ação</h2>
                        <p className="text-muted max-w-xl mx-auto">Busca real, score IA e decisão mais rápida sobre quais leads abordar primeiro.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Video Card 1 */}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition-all duration-500" />
                            <div className="relative bg-card border border-border rounded-[2rem] aspect-video overflow-hidden card-shadow group-hover:shadow-[var(--theme-shadow-card-hover)] transition-all duration-500 flex items-center justify-center cursor-pointer"
                                id="video-slot-1"
                            >
                                <div className="text-center p-8">
                                    <div className="w-20 h-20 rounded-full bg-violet-600/20 border-2 border-violet-500/40 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <Play size={32} className="text-violet-500 ml-1" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">Como encontrar leads em 30 segundos</h3>
                                    <p className="text-muted text-sm">Busca inteligente + Score IA + priorização comercial</p>
                                </div>
                            </div>
                        </div>
                        {/* Video Card 2 */}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-emerald-600 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition-all duration-500" />
                            <div className="relative bg-card border border-border rounded-[2rem] aspect-video overflow-hidden card-shadow group-hover:shadow-[var(--theme-shadow-card-hover)] transition-all duration-500 flex items-center justify-center cursor-pointer"
                                id="video-slot-2"
                            >
                                <div className="text-center p-8">
                                    <div className="w-20 h-20 rounded-full bg-cyan-600/20 border-2 border-cyan-500/40 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <Play size={32} className="text-cyan-500 ml-1" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">Análise de mercado e concorrência</h3>
                                    <p className="text-muted text-sm">Viabilidade + Concorrência + Inteligência de Mercado</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* 6 FEATURE CARDS                                */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-20 md:py-28 px-4 bg-surface/30" aria-labelledby="modules-heading">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 text-xs font-bold mb-6">
                            <Sparkles size={14} className="fill-current" /> 8 MÓDULOS DE INTELIGÊNCIA COMERCIAL
                        </span>
                        <h2 id="modules-heading" className="text-3xl md:text-5xl font-black text-foreground">Tudo que você precisa em <span className="accent-gradient">1 plataforma</span></h2>
                        <p className="text-muted max-w-2xl mx-auto mt-4">Da descoberta de empresas ao score IA, você valida o potencial do lead antes de gastar tempo comercial.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {HERO_CARDS.map((card) => {
                            const Icon = card.icon;
                            return (
                                <div key={card.title} className="group p-6 md:p-8 rounded-2xl border border-border bg-card hover:border-violet-500/25 transition-all duration-300 card-shadow card-shadow-hover">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-gradient-to-br ${card.gradient} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                                        <Icon size={22} aria-hidden />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 text-foreground">{card.title}</h3>
                                    <p className="text-muted text-sm leading-relaxed">{card.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                    {/* Extra features grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                        {[
                            { icon: Tag, label: 'Smart Tags' },
                            { icon: Users, label: 'Gestão de Equipe' },
                            { icon: Target, label: 'Activity Tracking' },
                            { icon: BarChart3, label: 'Inteligência de Mercado' },
                            { icon: Download, label: 'Exportação CSV/JSON' },
                            { icon: Lock, label: 'Segurança 2FA' },
                            { icon: Star, label: 'Leads Favoritos' },
                            { icon: FileOutput, label: 'Pipeline Visual' },
                        ].map(f => {
                            const Icon = f.icon;
                            return (
                                <div key={f.label} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground card-shadow">
                                    <Icon size={18} className="text-violet-500 shrink-0" aria-hidden />
                                    {f.label}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* HOW IT WORKS — 3 passos                        */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-20 md:py-28 px-4" aria-labelledby="how-heading">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 id="how-heading" className="text-3xl md:text-5xl font-black mb-4 text-foreground">Como funciona?</h2>
                        <p className="text-muted max-w-xl mx-auto">3 passos para sair da busca manual e chegar nos leads certos mais rápido.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        {/* Connection line */}
                        <div className="hidden md:block absolute top-1/2 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 -translate-y-1/2 opacity-30" />
                        {[
                            { step: '01', title: 'Busque', desc: 'Informe o nicho e a região. Nossa IA busca empresas reais via Google Places + Receita Federal.', icon: Search, color: 'bg-violet-600' },
                            { step: '02', title: 'Analise', desc: 'Veja score IA, sinais de maturidade e contexto suficiente para decidir quem priorizar primeiro.', icon: Brain, color: 'bg-cyan-600' },
                            { step: '03', title: 'Aborde', desc: 'Use scripts, CRM e histórico para entrar em contato com mais contexto e menos achismo.', icon: Rocket, color: 'bg-emerald-600' },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.step} className="relative text-center p-8 rounded-3xl bg-card border border-border card-shadow hover:border-violet-500/20 transition-all card-shadow-hover">
                                    <div className={`w-16 h-16 rounded-2xl ${item.color} text-white flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                                        <Icon size={28} aria-hidden />
                                    </div>
                                    <span className="text-4xl font-black accent-gradient">{item.step}</span>
                                    <h3 className="text-xl font-black text-foreground mt-2 mb-2">{item.title}</h3>
                                    <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* ANTES vs DEPOIS — com animação                 */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-20 md:py-28 px-4 bg-surface/30" aria-labelledby="comparison-heading">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs font-bold mb-6">
                            <TrendingDown size={14} /> CHEGA DE PERDER TEMPO
                        </span>
                        <h2 id="comparison-heading" className="text-3xl md:text-5xl font-black text-foreground">Antes vs Depois do <span className="accent-gradient">Precision</span></h2>
                        <p className="text-muted mt-4 max-w-xl mx-auto">Veja quanto tempo você economiza em cada etapa da prospecção.</p>
                    </div>

                    <div className="space-y-4">
                        {BEFORE_AFTER.map((item, idx) => (
                            <div
                                key={idx}
                                className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-center p-4 md:p-6 rounded-2xl border border-border bg-card card-shadow hover:border-violet-500/20 transition-all card-shadow-hover"
                            >
                                {/* BEFORE */}
                                <div className="flex items-center gap-3">
                                    <XCircle size={20} className="text-red-500 shrink-0" aria-hidden />
                                    <span className="text-sm text-muted line-through decoration-red-400/50">{item.before}</span>
                                </div>
                                {/* ARROW */}
                                <div className="hidden md:flex items-center justify-center">
                                    <ArrowRight size={20} className="text-violet-500" aria-hidden />
                                </div>
                                {/* AFTER */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 size={20} className="text-emerald-500 shrink-0" aria-hidden />
                                        <span className="text-sm text-foreground font-medium">{item.after}</span>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold shrink-0">-{item.saving}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary stat */}
                    <div className="mt-10 p-8 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                        <div className="relative z-10">
                            <p className="text-5xl md:text-7xl font-black text-white mb-2">60-70%</p>
                            <p className="text-white/90 text-lg font-medium">de redução no tempo de prospecção comercial</p>
                            <p className="text-white/60 text-sm mt-2">De 6-8h/dia para 2-3h/dia com 20 leads qualificados</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* ROI / CUSTO POR LEAD                            */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-20 md:py-28 px-4" aria-labelledby="roi-heading">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 id="roi-heading" className="text-3xl md:text-5xl font-black text-foreground">Quanto custa <span className="accent-gradient">não automatizar</span>?</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Manual */}
                        <div className="p-8 rounded-3xl border-2 border-red-500/20 bg-red-500/5">
                            <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-6 flex items-center gap-2">
                                <XCircle size={22} aria-hidden /> Prospecção manual
                            </h3>
                            <ul className="space-y-4 text-sm text-muted">
                                <li className="flex justify-between"><span>SDR júnior (salário + encargos)</span><span className="font-bold text-red-700 dark:text-red-400">R$ 4.000/mês</span></li>
                                <li className="flex justify-between"><span>Capacidade</span><span className="font-bold text-foreground">~15-20 leads/dia</span></li>
                                <li className="flex justify-between"><span>Custo por lead qualificado</span><span className="font-bold text-red-700 dark:text-red-400">R$ 10-20/lead</span></li>
                                <li className="flex justify-between"><span>Scripts de abordagem</span><span className="text-muted">Manuais, genéricos</span></li>
                                <li className="flex justify-between"><span>Análise de mercado</span><span className="text-muted">Não faz</span></li>
                            </ul>
                        </div>
                        {/* Precision */}
                        <div className="p-8 rounded-3xl border-2 border-violet-500/30 bg-violet-500/5 relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-violet-600 text-white text-xs font-bold">RECOMENDADO</div>
                            <h3 className="text-xl font-bold text-violet-700 dark:text-violet-300 mb-6 flex items-center gap-2">
                                <CheckCircle2 size={22} aria-hidden /> Precision (Growth)
                            </h3>
                            <ul className="space-y-4 text-sm">
                                <li className="flex justify-between text-muted"><span>Investimento</span><span className="font-bold text-violet-700 dark:text-violet-300">R$ 397/mês</span></li>
                                <li className="flex justify-between text-muted"><span>Capacidade</span><span className="font-bold text-foreground">400 leads/mês</span></li>
                                <li className="flex justify-between text-muted"><span>Custo por lead qualificado</span><span className="font-bold text-emerald-600">R$ 0,99/lead</span></li>
                                <li className="flex justify-between text-muted"><span>Scripts de abordagem</span><span className="font-bold text-foreground">IA personalizados</span></li>
                                <li className="flex justify-between text-muted"><span>Análise de mercado</span><span className="font-bold text-foreground">Automática</span></li>
                            </ul>
                        </div>
                    </div>
                    <p className="text-center text-muted text-sm mt-6">* Economia de até <strong className="text-foreground">90%</strong> comparado com prospecção manual. ROI positivo desde o primeiro mês.</p>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* INTEGRATIONS — CRM logos                        */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-20 md:py-28 px-4 bg-surface/30" aria-labelledby="integrations-heading">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 id="integrations-heading" className="text-3xl md:text-5xl font-black mb-4 text-foreground">Integra com o CRM que você <span className="accent-gradient">já usa</span></h2>
                    <p className="text-muted mb-12 max-w-xl mx-auto">Envie leads qualificados direto para seu CRM em 1 clique. Sem copiar e colar.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {CRM_INTEGRATIONS.map(crm => (
                            <div key={crm.name} className="p-6 rounded-2xl border border-border bg-card card-shadow hover:border-violet-500/25 transition-all card-shadow-hover text-center">
                                <div className="w-20 h-20 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4 border border-border">
                                    {crm.logo ? (
                                        <img src={crm.logo} alt={crm.name} className="w-12 h-12 object-contain" loading="lazy" />
                                    ) : (
                                        <FileOutput size={36} className="text-muted" />
                                    )}
                                </div>
                                <h3 className="font-bold text-foreground text-sm">{crm.name}</h3>
                                <p className="text-xs text-muted mt-1">{crm.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* SOCIAL PROOF — Depoimentos                     */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-20 md:py-28 px-4" aria-labelledby="social-proof-heading">
                <div className="max-w-6xl mx-auto">
                    <h2 id="social-proof-heading" className="text-3xl md:text-5xl font-black mb-4 text-center text-foreground">Quem usa, <span className="accent-gradient">recomenda</span></h2>
                    <p className="text-center text-muted mb-12">Vendedores, agências e equipes B2B já prospectam com inteligência artificial.</p>

                    {/* Segment tags */}
                    <div className="flex flex-wrap justify-center items-center gap-3 mb-12">
                        {['Vendas B2B', 'Agências de Marketing', 'Consultorias', 'SaaS & Tech', 'Franquias', 'SDR Teams'].map(tag => (
                            <span key={tag} className="px-4 py-2 rounded-full bg-card border border-border text-xs font-bold text-foreground card-shadow">{tag}</span>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        {[
                            { keyQuote: 'landing.testimonial1Quote', keyName: 'landing.testimonial1Name', keyRole: 'landing.testimonial1Role' },
                            { keyQuote: 'landing.testimonial2Quote', keyName: 'landing.testimonial2Name', keyRole: 'landing.testimonial2Role' },
                            { keyQuote: 'landing.testimonial3Quote', keyName: 'landing.testimonial3Name', keyRole: 'landing.testimonial3Role' },
                        ].map((item) => (
                            <div key={item.keyName} className="p-6 rounded-2xl border border-border bg-card card-shadow hover:border-violet-500/20 transition-all card-shadow-hover">
                                <div className="flex gap-1 mb-3">
                                    {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} className="text-amber-500 fill-amber-500" />)}
                                </div>
                                <Quote size={20} className="text-violet-500/40 mb-3" aria-hidden />
                                <p className="text-foreground font-medium mb-4 text-sm leading-relaxed">&ldquo;{t(item.keyQuote)}&rdquo;</p>
                                <p className="text-sm font-bold text-foreground">{t(item.keyName)}</p>
                                <p className="text-xs text-muted">{t(item.keyRole)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Case study */}
                    <div className="p-6 md:p-8 rounded-3xl border border-violet-500/20 bg-violet-500/5">
                        <h3 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">
                            <TrendingUp size={22} className="text-violet-500" aria-hidden />
                            {t('landing.caseStudyTitle')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <span className="text-xs font-bold text-red-500 uppercase">Problema</span>
                                <p className="text-muted text-sm mt-1">{t('landing.caseStudyProblem')}</p>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-violet-500 uppercase">Solução</span>
                                <p className="text-muted text-sm mt-1">{t('landing.caseStudySolution')}</p>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-emerald-500 uppercase">Resultado</span>
                                <p className="text-foreground text-sm mt-1 font-medium">{t('landing.caseStudyResult')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* PLANOS                                         */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-20 md:py-28 px-4 bg-surface/30" aria-labelledby="plans-heading">
                <div className="max-w-5xl mx-auto text-center">
                    <h2 id="plans-heading" className="text-3xl md:text-5xl font-black mb-4 text-foreground">Escolha o plano <span className="accent-gradient">ideal</span></h2>
                    <p className="text-muted max-w-xl mx-auto mb-10">{t('landing.plansSubtitle')}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-10">
                        {[
                            { name: 'Free', leads: '10 leads', price: 'R$ 0' },
                            { name: 'Starter', leads: '100 leads', price: 'R$ 129/mês' },
                            { name: 'Growth', leads: '400 leads', price: 'R$ 397/mês', highlight: true },
                            { name: 'Business', leads: '1.200 leads', price: 'R$ 997/mês' },
                            { name: 'Enterprise', leads: '5.000 leads', price: 'R$ 2.497/mês' },
                        ].map(plan => (
                            <div key={plan.name} className={`p-4 rounded-2xl border text-center transition-all card-shadow card-shadow-hover ${plan.highlight ? 'border-violet-500/40 bg-violet-500/10 ring-2 ring-violet-500/20' : 'border-border bg-card'}`}>
                                <p className="font-bold text-foreground text-sm">{plan.name}</p>
                                <p className="text-xs text-muted mt-1">{plan.leads}</p>
                                <p className="text-sm font-black text-violet-600 mt-2">{plan.price}</p>
                            </div>
                        ))}
                    </div>

                    <p className="text-xs text-muted mb-6">15% de desconto no plano anual · Todos os planos incluem busca por nicho e score IA</p>
                    <Button onClick={onViewPlans} variant="primary" size="lg" className="h-14 px-10">
                        {t('landing.viewAllPlans')}
                    </Button>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* TRUST BAR — Segurança e confiabilidade          */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-16 px-4 border-y border-border bg-surface/50" aria-label="Confiabilidade">
                <div className="max-w-6xl mx-auto">
                    <p className="text-center text-xs font-bold uppercase tracking-widest text-muted mb-8">Confiabilidade e Segurança</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { icon: Shield, title: 'Criptografia', desc: '2FA + dados criptografados em repouso' },
                            { icon: Lock, title: 'LGPD', desc: 'Conformidade total com LGPD' },
                            { icon: Globe, title: 'Uptime 99.9%', desc: 'Infraestrutura redundante' },
                            { icon: Zap, title: 'Rate Limiting', desc: 'Proteção contra abuso e DDoS' },
                        ].map(item => {
                            const Icon = item.icon;
                            return (
                                <div key={item.title} className="text-center p-4">
                                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
                                        <Icon size={22} className="text-violet-600" aria-hidden />
                                    </div>
                                    <p className="font-bold text-foreground text-sm">{item.title}</p>
                                    <p className="text-xs text-muted mt-1">{item.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* FAQ                                            */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-20 md:py-28 px-4" aria-labelledby="faq-heading">
                <div className="max-w-3xl mx-auto">
                    <h2 id="faq-heading" className="text-3xl md:text-5xl font-black mb-12 text-center text-foreground">Perguntas <span className="accent-gradient">frequentes</span></h2>
                    <div className="space-y-2">
                        {LANDING_FAQ.map((item, index) => (
                            <div key={index} className="border border-border rounded-xl bg-card overflow-hidden card-shadow">
                                <button
                                    type="button"
                                    onClick={() => setFaqOpenIndex(faqOpenIndex === index ? null : index)}
                                    className="w-full flex items-center justify-between p-4 md:p-5 text-left font-medium text-foreground hover:bg-surface/50 transition-colors"
                                    aria-expanded={faqOpenIndex === index}
                                >
                                    <span className="text-sm md:text-base">{item.q}</span>
                                    <ChevronDown size={20} className={`shrink-0 ml-4 transition-transform duration-200 ${faqOpenIndex === index ? 'rotate-180' : ''}`} aria-hidden />
                                </button>
                                {faqOpenIndex === index && (
                                    <div className="px-4 md:px-5 pb-4 md:pb-5 text-muted text-sm leading-relaxed border-t border-border pt-3">
                                        {item.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* MID CTA                                        */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-16 md:py-20 px-4 bg-surface/30" aria-labelledby="cta-mid-heading">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 id="cta-mid-heading" className="text-3xl md:text-4xl font-black mb-4 text-foreground">Pronto para prospectar com <span className="accent-gradient">inteligência</span>?</h2>
                    <p className="text-muted mb-8">Comece grátis. 5 análises completas. Sem cartão de crédito.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            to="/auth/signup"
                            className="inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 motion-safe:active:scale-95 bg-[#7c3aed] text-white shadow-[0_4px_14px_0_rgba(124,58,237,0.3)] hover:bg-[#6d28d9] hover:shadow-[0_6px_20px_rgba(109,40,217,0.4)] hover:-translate-y-0.5 h-14 px-10 text-base w-full sm:w-auto"
                        >
                            <Rocket size={18} className="mr-2" aria-hidden />
                            Criar conta grátis
                        </Link>
                        <Button onClick={onViewPlans} variant="secondary" size="lg" className="w-full sm:w-auto">
                            {t('landing.ctaPlans')}
                        </Button>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* FINAL CTA                                      */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="py-24 md:py-48 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="relative overflow-hidden rounded-[3rem] p-12 md:p-24 text-center shadow-[var(--theme-shadow-glow)]">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-700" />
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                        <div className="relative z-10">
                            <p className="text-white/70 text-sm font-bold uppercase tracking-widest mb-6">Pare de perder tempo. Comece agora.</p>
                            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                                27 milhões de empresas.<br />
                                <span className="text-white/90">1 plataforma inteligente.</span>
                            </h2>
                            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
                                Encontre, analise e converta leads B2B com a IA mais poderosa do mercado.
                            </p>
                            <Link
                                to="/auth/signup"
                                className="inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 motion-safe:active:scale-95 bg-white text-violet-600 h-16 px-12 text-xl hover:bg-white/90 hover:scale-105 shadow-lg"
                            >
                                <ArrowRight size={20} className="mr-2" />
                                Começar agora — é grátis
                            </Link>
                            <p className="text-white/50 text-sm mt-4">5 análises grátis · Sem cartão · Setup em 30 segundos</p>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}
