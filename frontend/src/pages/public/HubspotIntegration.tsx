import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Handshake, BrainCircuit, BarChart3, Users, MessageSquare, Target, Shield, Zap } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

function Feature({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-6 flex flex-col gap-3 card-shadow hover:card-shadow-hover transition-shadow">
      <div className="w-11 h-11 rounded-xl bg-[#ff7a59]/15 flex items-center justify-center">
        <Icon size={22} className="text-[#ff7a59]" />
      </div>
      <h3 className="font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

export default function HubspotIntegration() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center shrink-0">
            <Logo height={36} className="shrink-0" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/auth/signin"
              className="text-sm font-semibold text-muted hover:text-foreground transition-colors hidden sm:inline"
            >
              Entrar
            </Link>
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-[#ff7a59] hover:bg-[#e66b4d] text-white text-sm font-bold transition-colors"
            >
              Comecar gratis <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ff7a59]/10 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center relative">
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-10">
            <div className="flex flex-col items-center gap-2">
              <Logo height={48} className="sm:h-[4.5rem] w-auto shrink-0" />
              <span className="text-xs font-bold text-muted">Precision</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Handshake size={32} className="text-[#ff7a59]" />
              <span className="text-[10px] font-bold text-[#ff7a59] uppercase tracking-wider">Integracao</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <img src="/brands/hubspot.svg" alt="HubSpot" className="h-14 sm:h-20 object-contain bg-white rounded-2xl p-2" />
              <span className="text-xs font-bold text-muted">HubSpot</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
            Integre o Precision ao <span className="text-[#ff7a59]">HubSpot CRM</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Prospecte empresas com IA, qualifique automaticamente e envie contatos e negocios para o HubSpot em um clique.
            Fluxo nativo via OAuth com mapeamento de pipeline, stage e owner.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-[#ff7a59] hover:bg-[#e66b4d] text-white font-bold transition-colors shadow-lg"
            >
              Testar gratis <ArrowRight size={16} />
            </Link>
            <Link
              to="/mapa-do-site"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full border border-border hover:border-[#ff7a59]/40 text-foreground font-semibold transition-colors"
            >
              Ver mapa do site
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-[#ff7a59]/15 text-[#ff7a59] text-[11px] font-bold uppercase tracking-wider mb-3">
            HubSpot + Precision
          </span>
          <h2 className="text-2xl sm:text-3xl font-black">O que a integracao entrega</h2>
          <p className="text-muted mt-2 max-w-xl mx-auto">
            Menos trabalho manual e mais velocidade para o time comercial.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Feature icon={Users} title="Contato no HubSpot" desc="Cria ou atualiza contato com telefone, email, website e dados enriquecidos." />
          <Feature icon={Target} title="Negocio com contexto" desc="Envia negocio com pipeline e etapa selecionados, incluindo score e resumo de IA." />
          <Feature icon={MessageSquare} title="Abordagem pronta" desc="Anexa resumo de abordagem com sugestao para email, ligacao e WhatsApp." />
          <Feature icon={BarChart3} title="Priorizacao comercial" desc="Lead scoring para o time atacar primeiro quem tem maior chance de conversao." />
          <Feature icon={BrainCircuit} title="Dados acionaveis" desc="Consolida sinais de mercado, presenca digital e maturidade do lead." />
          <Feature icon={Zap} title="Envio rapido" desc="Fluxo em 1 clique no painel para mover leads qualificados para o HubSpot." />
        </div>
      </section>

      <section className="bg-card border-y border-border">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-8">Conexao segura</h2>
          <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" />OAuth nativo para autorizacao da conta HubSpot.</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" />Permissoes minimas para envio de contato e negocio.</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" />Dados sensiveis protegidos e criptografados em repouso.</li>
              <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-500 mt-0.5" />Desconexao a qualquer momento no painel de Integracoes.</li>
            </ul>
            <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
              <Shield size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-muted leading-relaxed">
                Esta pagina existe para documentar a integracao publica e ajudar buscadores a entenderem o fluxo real
                de envio de leads entre Precision e HubSpot CRM.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
