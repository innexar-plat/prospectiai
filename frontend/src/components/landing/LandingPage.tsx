import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Brain, Rocket, Zap, ArrowRight, Shield, Globe, Download, Users, FileOutput, Lock, MapPin, BarChart3, Target, MessageSquare, TrendingUp, Tag, Swords, ChevronDown, Quote } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const HERO_YOUTUBE_EMBED_URL = 'https://www.youtube.com/embed/N9pBT12i7nQ?si=iOe5HcG0qRz9fBvm';

const TOOLS = [
    { keyTitle: 'landing.toolSearch', keyDesc: 'landing.toolSearchDesc', icon: Search },
    { keyTitle: 'landing.toolAnalyze', keyDesc: 'landing.toolAnalyzeDesc', icon: Brain },
    { keyTitle: 'landing.toolLeads', keyDesc: 'landing.toolLeadsDesc', icon: Download },
    { keyTitle: 'landing.toolExport', keyDesc: 'landing.toolExportDesc', icon: FileOutput },
    { keyTitle: 'landing.toolTeam', keyDesc: 'landing.toolTeamDesc', icon: Users },
    { keyTitle: 'landing.toolSecurity', keyDesc: 'landing.toolSecurityDesc', icon: Lock },
] as const;

const NEW_FEATURES = [
    { icon: Swords, title: 'Análise de Concorrência', desc: 'Rankings por avaliação, presença digital e oportunidades de mercado.' },
    { icon: TrendingUp, title: 'Viabilidade de Negócio', desc: 'IA analisa se vale a pena abrir um negócio em determinada região — Score 0-10.' },
    { icon: Tag, title: 'Smart Tags', desc: 'Classifique leads como Quente, Morno ou Frio. Crie tags customizadas para seu pipeline.' },
    { icon: Users, title: 'Gestão de Equipe', desc: 'Convide vendedores, defina metas e acompanhe o ranking de performance.' },
    { icon: BarChart3, title: 'Inteligência de Mercado', desc: 'Segmentação, maturidade digital e índice de saturação por região.' },
    { icon: Target, title: 'Activity Tracking', desc: 'Rastreie cliques em Ligar, WhatsApp e Email para cada lead.' },
] as const;

const SERVICES = [
    { keyName: 'landing.service1Name', keyDesc: 'landing.service1Desc', icon: MapPin },
    { keyName: 'landing.service2Name', keyDesc: 'landing.service2Desc', icon: BarChart3 },
    { keyName: 'landing.service3Name', keyDesc: 'landing.service3Desc', icon: Target },
    { keyName: 'landing.service4Name', keyDesc: 'landing.service4Desc', icon: Brain },
    { keyName: 'landing.service5Name', keyDesc: 'landing.service5Desc', icon: MessageSquare },
] as const;

const LANDING_FAQ = [
    { keyQ: 'landing.faq1Q', keyA: 'landing.faq1A' },
    { keyQ: 'landing.faq2Q', keyA: 'landing.faq2A' },
    { keyQ: 'landing.faq3Q', keyA: 'landing.faq3A' },
    { keyQ: 'landing.faq4Q', keyA: 'landing.faq4A' },
] as const;

export default function LandingPage({ onViewPlans, t }: { locale: string, onViewPlans: () => void, t: (key: string, options?: Record<string, unknown>) => string }) {
    const navigate = useNavigate();
    const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-violet-500/30 overflow-x-hidden" role="document">
            {/* Background Decorative Elements – mais cor no tema claro */}
            <div className="absolute top-0 left-0 right-0 h-[80vh] bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.18)_0%,transparent_65%)] pointer-events-none" />
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/10 blur-[120px] rounded-full pointer-events-none animate-float" />
            <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none animate-float animation-delay-200" />

            {/* HERO SECTION */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4" aria-labelledby="hero-title">
                <div className="max-w-5xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 text-xs font-bold mb-8 animate-fade card-shadow" role="status">
                        <Zap size={14} className="fill-current" aria-hidden />
                        <span className="tracking-widest uppercase">{t('landing.heroBadge')}</span>
                    </div>

                    <h1 id="hero-title" className="text-5xl md:text-8xl font-black leading-[0.95] tracking-tight mb-8 animate-slide">
                        <span className="text-foreground inline-block">{t('landing.heroTitle')}</span>
                        <br />
                        <span className="accent-gradient">
                            {t('landing.heroTitleHighlight')}
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-12 leading-relaxed animate-fade animation-delay-200 animation-fill-both">
                        {t('landing.subtitle')}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide animation-delay-300 animation-fill-both">
                        <Button
                            onClick={() => navigate('/auth/signup')}
                            variant="primary"
                            size="lg"
                            className="w-full sm:w-auto h-16 px-10 text-lg group"
                            icon={<Rocket size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" aria-hidden />}
                            aria-label={t('landing.ctaStart')}
                        >
                            {t('landing.ctaStart')}
                        </Button>
                        <Button
                            onClick={onViewPlans}
                            variant="secondary"
                            size="lg"
                            className="w-full sm:w-auto h-16 px-10 text-lg"
                            aria-label={t('landing.ctaPlans')}
                        >
                            {t('landing.ctaPlans')}
                        </Button>
                    </div>
                </div>

                {/* Dashboard Preview Mockup */}
                <div className="mt-20 md:mt-32 max-w-6xl mx-auto px-4 animate-slide animation-delay-500 animation-fill-both">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-[2rem] blur opacity-30 group-hover:opacity-50 transition-all duration-500" />
                        <div className="relative bg-card border border-border rounded-[2rem] aspect-[16/10] sm:aspect-[16/9] overflow-hidden card-shadow group-hover:shadow-[var(--theme-shadow-card-hover)] transition-all duration-500">
                            <div className="absolute top-0 left-0 right-0 h-10 border-b border-border bg-surface flex items-center px-4 gap-2 z-10">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                            </div>
                            <div className="pt-10 h-full flex items-center justify-center p-4 sm:p-8 absolute inset-0">
                                <div className="w-full h-full min-h-0 rounded-xl overflow-hidden">
                                    <iframe
                                        className="w-full h-full min-h-0 rounded-lg"
                                        src={HERO_YOUTUBE_EMBED_URL}
                                        title="YouTube video player - ProspectorAI"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        referrerPolicy="strict-origin-when-cross-origin"
                                        allowFullScreen
                                    />
                                </div>
                            </div>
                        </div>
                        <p className="mt-4 text-center text-sm text-muted font-medium max-w-xl mx-auto">
                            {t('landing.videoCaption')}
                        </p>
                    </div>
                </div>
            </section>

            {/* FEATURES SECTION */}
            <section className="py-24 md:py-40 px-4 relative overflow-hidden" aria-labelledby="features-heading">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 id="features-heading" className="text-3xl md:text-5xl font-black mb-6 text-foreground">Porque escolher o <span className="text-violet-500">ProspectorAI</span>?</h2>
                        <p className="text-muted max-w-xl mx-auto">Tecnologia de ponta para automatizar sua prospecção e multiplicar suas vendas.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { icon: <Search size={28} aria-hidden />, title: t('landing.feature1Title'), desc: t('landing.feature1Desc') },
                            { icon: <Brain size={28} aria-hidden />, title: t('landing.feature2Title'), desc: t('landing.feature2Desc'), highlight: true },
                            { icon: <Download size={28} aria-hidden />, title: t('landing.feature3Title'), desc: t('landing.feature3Desc') }
                        ].map((item, idx) => (
                            <div
                                key={item.title}
                                className={`group p-8 md:p-12 rounded-[2.5rem] border transition-all duration-300 card-shadow card-shadow-hover ${item.highlight
                                    ? 'bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15 md:-translate-y-2'
                                    : 'bg-card border-border hover:border-violet-500/20'
                                    }`}
                                style={{ animationDelay: `${idx * 80}ms` }}
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all duration-300 group-hover:scale-110 shadow-lg ${item.highlight ? 'bg-violet-600 text-white shadow-violet-500/40' : 'bg-violet-500/10 text-violet-600'
                                    }`}>
                                    {item.icon}
                                </div>
                                <h3 className="text-2xl font-black mb-4 text-foreground">{item.title}</h3>
                                <p className="text-muted leading-relaxed font-medium">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* BENEFITS - Como o Prospector AI resolve seu problema */}
            <section className="py-24 md:py-32 px-4 bg-surface/30" aria-labelledby="benefits-heading">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 id="benefits-heading" className="text-3xl md:text-5xl font-black mb-4 text-foreground">{t('landing.servicesTitle')}</h2>
                        <p className="text-muted max-w-2xl mx-auto">{t('landing.servicesSubtitle')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[
                            { num: '1', keyTitle: 'landing.benefit1Title', keyDesc: 'landing.benefit1Desc', icon: MapPin },
                            { num: '2', keyTitle: 'landing.benefit2Title', keyDesc: 'landing.benefit2Desc', icon: Target },
                            { num: '3', keyTitle: 'landing.benefit3Title', keyDesc: 'landing.benefit3Desc', icon: MessageSquare },
                            { num: '4', keyTitle: 'landing.benefit4Title', keyDesc: 'landing.benefit4Desc', icon: BarChart3 },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.num} className="p-6 md:p-8 rounded-2xl border border-border bg-card hover:border-violet-500/25 transition-all duration-300 card-shadow card-shadow-hover flex gap-6">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-600 text-white font-black text-lg shrink-0">{item.num}</div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-2 text-foreground flex items-center gap-2">
                                            <Icon size={22} className="text-violet-500" aria-hidden />
                                            {t(item.keyTitle)}
                                        </h3>
                                        <p className="text-muted text-sm leading-relaxed">{t(item.keyDesc)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="py-20 md:py-28 px-4" aria-labelledby="how-heading">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 id="how-heading" className="text-3xl md:text-5xl font-black mb-4 text-foreground">Como funciona?</h2>
                        <p className="text-muted max-w-xl mx-auto">3 passos para transformar sua prospecção.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { step: '01', title: 'Busque', desc: 'Informe o nicho e a região. Nossa IA busca empresas reais via Google Places.' },
                            { step: '02', title: 'Analise', desc: 'Score IA, concorrência, viabilidade — tudo automatizado com dados reais.' },
                            { step: '03', title: 'Converta', desc: 'Scripts personalizados, WhatsApp automatizado e pipeline completo.' },
                        ].map((item) => (
                            <div key={item.step} className="text-center p-8 rounded-3xl bg-card border border-border card-shadow">
                                <div className="w-14 h-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-black text-xl mx-auto mb-6">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-black text-foreground mb-2">{item.title}</h3>
                                <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* NEW FEATURES SECTION */}
            <section className="py-24 md:py-32 px-4 bg-surface/30" aria-labelledby="new-features-heading">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-6">
                            <Zap size={14} className="fill-current" /> NOVIDADES
                        </span>
                        <h2 id="new-features-heading" className="text-3xl md:text-5xl font-black text-foreground">Funcionalidades Exclusivas</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {NEW_FEATURES.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.title} className="p-6 md:p-8 rounded-2xl border border-border bg-card hover:border-violet-500/25 transition-all duration-300 card-shadow card-shadow-hover">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-violet-500/15 text-violet-600">
                                        <Icon size={24} aria-hidden />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 text-foreground">{item.title}</h3>
                                    <p className="text-muted text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* SERVIÇOS QUE OFERECEMOS */}
            <section className="py-24 md:py-32 px-4 relative overflow-hidden" aria-labelledby="services-heading">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 id="services-heading" className="text-3xl md:text-5xl font-black mb-6 text-foreground">{t('landing.servicesTitle')}</h2>
                        <p className="text-muted max-w-2xl mx-auto text-lg">{t('landing.servicesSubtitle')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {SERVICES.slice(0, 3).map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.keyName}
                                    className="p-6 md:p-8 rounded-2xl border border-border bg-card hover:border-violet-500/25 transition-all duration-300 card-shadow card-shadow-hover"
                                >
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-violet-500/15 text-violet-600">
                                        <Icon size={24} aria-hidden />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 text-foreground">{t(item.keyName)}</h3>
                                    <p className="text-muted text-sm leading-relaxed">{t(item.keyDesc)}</p>
                                </div>
                            );
                        })}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-4xl mx-auto">
                        {SERVICES.slice(3, 5).map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.keyName}
                                    className="p-6 md:p-8 rounded-2xl border border-border bg-card hover:border-violet-500/25 transition-all duration-300 card-shadow card-shadow-hover"
                                >
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-violet-500/15 text-violet-600">
                                        <Icon size={24} aria-hidden />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 text-foreground">{t(item.keyName)}</h3>
                                    <p className="text-muted text-sm leading-relaxed">{t(item.keyDesc)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* FERRAMENTAS DA PLATAFORMA */}
            <section className="py-24 md:py-32 px-4 bg-surface/30 relative overflow-hidden" aria-labelledby="tools-heading">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 id="tools-heading" className="text-3xl md:text-5xl font-black mb-6 text-foreground">{t('landing.toolsTitle')}</h2>
                        <p className="text-muted max-w-2xl mx-auto text-lg">{t('landing.toolsSubtitle')}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {TOOLS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.keyTitle}
                                    className="p-6 md:p-8 rounded-2xl border border-border bg-card hover:border-violet-500/25 transition-all duration-300 card-shadow card-shadow-hover"
                                >
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-violet-500/15 text-violet-600">
                                        <Icon size={24} aria-hidden />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 text-foreground">{t(item.keyTitle)}</h3>
                                    <p className="text-muted text-sm leading-relaxed">{t(item.keyDesc)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* PLANOS (TEASER) */}
            <section className="py-24 md:py-32 px-4 bg-surface/30 relative overflow-hidden" aria-labelledby="plans-heading">
                <div className="max-w-5xl mx-auto text-center">
                    <h2 id="plans-heading" className="text-3xl md:text-5xl font-black mb-6 text-foreground">{t('landing.plansTitle')}</h2>
                    <p className="text-muted max-w-xl mx-auto mb-12 text-lg">{t('landing.plansSubtitle')}</p>
                    <div className="flex flex-wrap justify-center gap-4 mb-12">
                        <span className="px-4 py-2 rounded-full bg-card border border-border text-sm font-medium text-foreground card-shadow">{t('landing.planFree')}</span>
                        <span className="px-4 py-2 rounded-full bg-card border border-border text-sm font-medium text-foreground card-shadow">{t('landing.planStarter')}</span>
                        <span className="px-4 py-2 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-700 text-sm font-medium card-shadow dark:bg-violet-600/20 dark:text-violet-300">{t('landing.planGrowth')}</span>
                        <span className="px-4 py-2 rounded-full bg-card border border-border text-sm font-medium text-foreground card-shadow">{t('landing.planScale')}</span>
                    </div>
                    <Button
                        onClick={onViewPlans}
                        variant="primary"
                        size="lg"
                        className="h-14 px-10"
                        aria-label={t('landing.viewAllPlans')}
                    >
                        {t('landing.viewAllPlans')}
                    </Button>
                </div>
            </section>

            {/* SOCIAL PROOF - Empresas que já usam + Depoimentos + Case study */}
            <section className="py-24 md:py-32 px-4" aria-labelledby="social-proof-heading">
                <div className="max-w-6xl mx-auto">
                    <h2 id="social-proof-heading" className="text-3xl md:text-5xl font-black mb-12 text-center text-foreground">{t('landing.socialProofTitle')}</h2>
                    <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 mb-20 opacity-70 text-muted">
                        <span className="text-lg font-semibold">B2B</span>
                        <span className="text-lg font-semibold">Vendas</span>
                        <span className="text-lg font-semibold">Prospecção</span>
                        <span className="text-lg font-semibold">Franquias</span>
                        <span className="text-lg font-semibold">Agências</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                        {[
                            { keyQuote: 'landing.testimonial1Quote', keyName: 'landing.testimonial1Name', keyRole: 'landing.testimonial1Role' },
                            { keyQuote: 'landing.testimonial2Quote', keyName: 'landing.testimonial2Name', keyRole: 'landing.testimonial2Role' },
                            { keyQuote: 'landing.testimonial3Quote', keyName: 'landing.testimonial3Name', keyRole: 'landing.testimonial3Role' },
                        ].map((item) => (
                            <div key={item.keyName} className="p-6 rounded-2xl border border-border bg-card">
                                <Quote size={24} className="text-violet-500/60 mb-4" aria-hidden />
                                <p className="text-foreground font-medium mb-4">&ldquo;{t(item.keyQuote)}&rdquo;</p>
                                <p className="text-sm font-bold text-foreground">{t(item.keyName)}</p>
                                <p className="text-xs text-muted">{t(item.keyRole)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 md:p-8 rounded-2xl border border-violet-500/20 bg-violet-500/5">
                        <h3 className="text-xl font-black text-foreground mb-6">{t('landing.caseStudyTitle')}</h3>
                        <ul className="space-y-3 text-muted">
                            <li><strong className="text-foreground">Problema:</strong> {t('landing.caseStudyProblem')}</li>
                            <li><strong className="text-foreground">Solução:</strong> {t('landing.caseStudySolution')}</li>
                            <li><strong className="text-foreground">Resultado:</strong> {t('landing.caseStudyResult')}</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* COMPARAÇÃO ANTES / DEPOIS */}
            <section className="py-24 md:py-32 px-4 bg-surface/30" aria-labelledby="comparison-heading">
                <div className="max-w-4xl mx-auto">
                    <h2 id="comparison-heading" className="text-3xl md:text-5xl font-black mb-12 text-center text-foreground">{t('landing.comparisonTitle')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 md:p-8 rounded-2xl border border-border bg-card">
                            <h3 className="text-lg font-bold text-muted mb-4">{t('landing.comparisonWithoutTitle')}</h3>
                            <ul className="space-y-2 text-muted text-sm">
                                <li className="flex items-center gap-2">× {t('landing.comparisonWithout1')}</li>
                                <li className="flex items-center gap-2">× {t('landing.comparisonWithout2')}</li>
                                <li className="flex items-center gap-2">× {t('landing.comparisonWithout3')}</li>
                            </ul>
                        </div>
                        <div className="p-6 md:p-8 rounded-2xl border border-violet-500/30 bg-violet-500/10">
                            <h3 className="text-lg font-bold text-violet-700 dark:text-violet-300 mb-4">{t('landing.comparisonWithTitle')}</h3>
                            <ul className="space-y-2 text-foreground text-sm">
                                <li className="flex items-center gap-2">✓ {t('landing.comparisonWith1')}</li>
                                <li className="flex items-center gap-2">✓ {t('landing.comparisonWith2')}</li>
                                <li className="flex items-center gap-2">✓ {t('landing.comparisonWith3')}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ OBEJÇÕES */}
            <section className="py-24 md:py-32 px-4" aria-labelledby="faq-heading">
                <div className="max-w-3xl mx-auto">
                    <h2 id="faq-heading" className="text-3xl md:text-5xl font-black mb-12 text-center text-foreground">{t('landing.faqTitle')}</h2>
                    <div className="space-y-2">
                        {LANDING_FAQ.map((item, index) => (
                            <div key={item.keyQ} className="border border-border rounded-xl bg-card overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setFaqOpenIndex(faqOpenIndex === index ? null : index)}
                                    className="w-full flex items-center justify-between p-4 text-left font-medium text-foreground hover:bg-surface/50 transition-colors"
                                    aria-expanded={faqOpenIndex === index}
                                >
                                    <span>{t(item.keyQ)}</span>
                                    <ChevronDown size={20} className={`shrink-0 transition-transform ${faqOpenIndex === index ? 'rotate-180' : ''}`} aria-hidden />
                                </button>
                                {faqOpenIndex === index && (
                                    <div className="px-4 pb-4 text-muted text-sm leading-relaxed border-t border-border pt-2">
                                        {t(item.keyA)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA MEIO - baixo atrito */}
            <section className="py-24 md:py-32 px-4" aria-labelledby="cta-mid-heading">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 id="cta-mid-heading" className="text-3xl md:text-4xl font-black mb-4 text-foreground">{t('landing.ctaMidTitle')}</h2>
                    <p className="text-muted mb-8">{t('landing.ctaMidSub')}</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            onClick={() => navigate('/auth/signup')}
                            variant="primary"
                            size="lg"
                            className="w-full sm:w-auto"
                            icon={<Rocket size={18} aria-hidden />}
                            aria-label={t('landing.ctaStart')}
                        >
                            {t('landing.ctaStart')}
                        </Button>
                        <Button onClick={onViewPlans} variant="secondary" size="lg" className="w-full sm:w-auto" aria-label={t('landing.ctaPlans')}>
                            {t('landing.ctaPlans')}
                        </Button>
                    </div>
                </div>
            </section>

            {/* TRUST BAR */}
            <section className="py-20 px-4 border-y border-border bg-surface/50" aria-label="Diferenciais">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-20 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500 text-foreground">
                        <div className="flex items-center gap-3 font-black text-xl"><Shield size={24} aria-hidden /> SEGURANÇA</div>
                        <div className="flex items-center gap-3 font-black text-xl"><Globe size={24} aria-hidden /> GLOBAL</div>
                        <div className="flex items-center gap-3 font-black text-xl"><Zap size={24} aria-hidden /> VELOCIDADE</div>
                        <div className="flex items-center gap-3 font-black text-xl"><Brain size={24} aria-hidden /> INTELIGÊNCIA</div>
                    </div>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="py-24 md:py-48 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="relative overflow-hidden rounded-[3rem] p-12 md:p-24 text-center shadow-[var(--theme-shadow-glow)]">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-700" />
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                        <div className="relative z-10">
                            <h2 className="text-4xl md:text-6xl font-black text-white mb-8 leading-tight">
                                {t('landing.finalCtaTitle')}
                            </h2>
                            <p className="text-xl text-white/90 max-w-2xl mx-auto mb-12">
                                {t('landing.finalCtaSub')}
                            </p>
                            <Button
                                variant="secondary"
                                size="lg"
                                onClick={() => navigate('/auth/signup')}
                                className="bg-white text-violet-600 h-16 px-12 text-xl hover:bg-white/90 hover:scale-105"
                                icon={<ArrowRight size={20} />}
                            >
                                {t('landing.finalCtaBtn')}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}
