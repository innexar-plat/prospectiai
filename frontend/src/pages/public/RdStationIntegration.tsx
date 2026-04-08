import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Zap,
  Users,
  BarChart3,
  MessageSquare,
  Globe,
  Phone,
  Star,
  Shield,
  RefreshCw,
  Target,
  BrainCircuit,
  Handshake,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

/* ─── Accordion helper ─────────────────────────────────────────────── */
function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left font-bold text-foreground hover:bg-surface/60 transition-colors"
      >
        {title}
        <ChevronDown size={20} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-6 pb-5 text-sm text-muted leading-relaxed">{children}</div>}
    </div>
  );
}

/* ─── Feature card ─────────────────────────────────────────────────── */
function Feature({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-6 flex flex-col gap-3 card-shadow hover:card-shadow-hover transition-shadow">
      <div className="w-11 h-11 rounded-xl bg-violet-500/15 flex items-center justify-center">
        <Icon size={22} className="text-violet-600 dark:text-violet-400" />
      </div>
      <h3 className="font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─── Step card ────────────────────────────────────────────────────── */
function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
        {n}
      </div>
      <div>
        <h4 className="font-bold text-foreground">{title}</h4>
        <p className="text-sm text-muted mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function RdStationIntegration() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center shrink-0">
            <img src="/precisionai-logo-dark.png" alt="PrecisionAI" className="h-36 shrink-0 hidden dark:block" />
            <img src="/precisionai-logo-light.png" alt="PrecisionAI" className="h-36 shrink-0 block dark:hidden" />
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
              className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors"
            >
              Começar grátis <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center relative">
          {/* Partner logos */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-10">
            <div className="flex flex-col items-center gap-2">
              <img src="/precisionai-logo-dark.png" alt="PrecisionAI" className="h-48 sm:h-72 hidden dark:block" />
              <img src="/precisionai-logo-light.png" alt="PrecisionAI" className="h-48 sm:h-72 block dark:hidden" />
              <span className="text-xs font-bold text-muted">Precision IA</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Handshake size={32} className="text-violet-500" />
              <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Integração</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <img
                src="/logos/RD_Station_idYP8zaxIA_2.png"
                alt="RD Station"
                className="h-14 sm:h-20 object-contain bg-white rounded-2xl p-2"
              />
              <span className="text-xs font-bold text-muted">RD Station</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
            Encontre leads com <span className="text-violet-500">IA</span> e envie
            <br className="hidden sm:block" /> direto para o <span className="text-[#00C4CC]">RD Station</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            O Precision IA prospecta empresas por nicho e região, classifica com inteligência artificial e entrega
            contatos, negócios e tarefas prontas no seu RD Station CRM ou Marketing — sem esforço manual.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold transition-colors shadow-lg shadow-violet-500/25"
            >
              Começar grátis <ArrowRight size={16} />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full border border-border hover:border-violet-500/40 text-foreground font-semibold transition-colors"
            >
              Como funciona
            </a>
          </div>
        </div>
      </section>

      {/* ── O que é criado automaticamente ────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-[11px] font-bold uppercase tracking-wider mb-3">
            Integração completa
          </span>
          <h2 className="text-2xl sm:text-3xl font-black">Tudo que a integração cria para você</h2>
          <p className="text-muted mt-2 max-w-xl mx-auto">
            No modo CRM, cada lead enviado gera até 5 recursos automaticamente no RD Station.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Feature
            icon={Users}
            title="Contato completo"
            desc="Nome, e-mails, telefones e redes sociais (Facebook, LinkedIn, Instagram) — preenchidos automaticamente."
          />
          <Feature
            icon={Target}
            title="Negócio com contexto"
            desc="Estágio, pipeline, responsável, fonte e campanha configuráveis. Rating do lead mapeado de 1 a 5."
          />
          <Feature
            icon={MessageSquare}
            title="Nota detalhada no negócio"
            desc="Resumo de IA, avaliação Google, tendência de reviews, estratégia de abordagem, mensagem pronta para WhatsApp e pontos fortes/fracos."
          />
          <Feature
            icon={RefreshCw}
            title="Tarefa de follow-up"
            desc="Tarefa automática com prazo para o dia seguinte, vinculada ao negócio e ao responsável."
          />
          <Feature
            icon={BarChart3}
            title="Organização vinculada"
            desc="Cria a organização no RD Station e associa ao contato e ao negócio automaticamente."
          />
          <Feature
            icon={BrainCircuit}
            title="Campos customizados (Marketing)"
            desc="Score de oportunidade, classificação hot/warm/cold, resumo de IA, segmento, avaliação Google e 8+ campos personalizados."
          />
        </div>
      </section>

      {/* ── Funcionalidades do Precision IA ──────────────────── */}
      <section className="bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[11px] font-bold uppercase tracking-wider mb-3">
              Plataforma
            </span>
            <h2 className="text-2xl sm:text-3xl font-black">O que o Precision IA faz</h2>
            <p className="text-muted mt-2 max-w-xl mx-auto">
              Uma plataforma completa de prospecção B2B com inteligência artificial.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Globe, t: 'Mapeamento de empresas', d: 'Busca por nicho e região usando Google Places com filtros de website e telefone.' },
              { icon: Star, t: 'Score com IA', d: 'Classificação automática hot/warm/cold com score de oportunidade de 0 a 100.' },
              { icon: BarChart3, t: 'Análise de concorrência', d: 'Ranking por avaliações, presença digital e gaps de mercado.' },
              { icon: MessageSquare, t: 'Scripts prontos', d: 'Abordagem pronta para telefone, e-mail e WhatsApp adaptada por nicho.' },
              { icon: BrainCircuit, t: 'Inteligência de mercado', d: 'Segmentação, maturidade digital e índice de saturação por região.' },
              { icon: Users, t: 'Gestão de equipe', d: 'Distribua leads entre vendedores, atribua territórios e acompanhe performance.' },
              { icon: Phone, t: 'Filtros avançados', d: 'Filtre por presença de website, telefone, score mínimo e tipo de negócio.' },
              { icon: Zap, t: 'Análise em lote', d: 'Analise dezenas de leads simultaneamente com IA em background.' },
            ].map(({ icon, t, d }) => (
              <Feature key={t} icon={icon} title={t} desc={d} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona (passo a passo) ────────────────────── */}
      <section id="como-funciona" className="max-w-3xl mx-auto px-6 py-16 scroll-mt-20">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-[11px] font-bold uppercase tracking-wider mb-3">
            Passo a passo
          </span>
          <h2 className="text-2xl sm:text-3xl font-black">Como conectar</h2>
          <p className="text-muted mt-2">Conecte em menos de 2 minutos — sem código, sem complicação.</p>
        </div>
        <div className="space-y-6 bg-card border border-border rounded-2xl p-6 sm:p-8">
          <Step n={1} title="Crie sua conta no Precision IA" desc="Acesse precisionia.com.br/auth/signup e cadastre-se gratuitamente." />
          <Step n={2} title="Acesse Integrações" desc="No menu lateral do painel, clique em 'Integrações'." />
          <Step n={3} title="Conecte o RD Station" desc="Clique em 'Conectar com OAuth' na seção RD Station. Você será redirecionado para autorizar o acesso." />
          <Step n={4} title="Autorize as permissões" desc="Revise as permissões e clique em 'Autorizar'. Você voltará ao Precision IA com a conexão ativa." />
          <Step n={5} title="Prospecte e envie leads" desc="Faça buscas por nicho, analise com IA e envie contatos + negócios para o RD Station com um clique." />
        </div>
      </section>

      {/* ── Modos de envio ───────────────────────────────────── */}
      <section className="bg-card border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black">Dois modos de envio</h2>
            <p className="text-muted mt-2">Escolha o modo ideal para o seu fluxo de trabalho.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {/* CRM */}
            <div className="rounded-2xl border-2 border-violet-500/40 p-6 sm:p-8 space-y-4 bg-violet-500/5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-xs font-bold">
                <Target size={14} /> Modo CRM
              </div>
              <h3 className="text-xl font-black text-foreground">Contato + Negócio</h3>
              <ul className="space-y-2 text-sm text-muted">
                {[
                  'Cria contato com dados enriquecidos',
                  'Cria organização vinculada',
                  'Cria negócio com pipeline e responsável',
                  'Adiciona nota completa com análise de IA',
                  'Cria tarefa de follow-up automática',
                  'Selecione fonte e campanha do RD',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {/* Marketing */}
            <div className="rounded-2xl border-2 border-[#00C4CC]/40 p-6 sm:p-8 space-y-4 bg-[#00C4CC]/5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C4CC]/15 text-[#00C4CC] text-xs font-bold">
                <BarChart3 size={14} /> Modo Marketing
              </div>
              <h3 className="text-xl font-black text-foreground">Evento de Conversão</h3>
              <ul className="space-y-2 text-sm text-muted">
                {[
                  'Evento "Precision IA — Lead Mapeado"',
                  '11 campos customizados (score, resumo IA…)',
                  'Tags automáticas por classificação',
                  'Dados de contato completos',
                  'Redes sociais do lead',
                  'Segmentação por tipo de negócio',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-[#00C4CC] mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Permissões ───────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider mb-3">
            Transparência
          </span>
          <h2 className="text-2xl sm:text-3xl font-black">Permissões utilizadas</h2>
          <p className="text-muted mt-2 max-w-lg mx-auto">
            Solicitamos apenas o necessário para a integração funcionar. Veja o que cada permissão faz:
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: RefreshCw,
              title: 'Gerenciar webhooks',
              desc: 'Receber notificações de atualização de status de negócios e contatos para manter os dados sincronizados.',
            },
            {
              icon: Users,
              title: 'Gerenciar contatos',
              desc: 'Criar contatos no RD Station com dados enriquecidos dos leads prospectados. Também usada para validar a conexão OAuth.',
            },
            {
              icon: Shield,
              title: 'Gerenciar campos customizados',
              desc: 'Enviar campos personalizados no modo Marketing: score, classificação, resumo de IA, segmento, avaliação Google e mais.',
            },
            {
              icon: Globe,
              title: 'Visualizar código de monitoramento',
              desc: 'Identificar o código de rastreamento do RD Station para correta atribuição de conversões originadas pelo Precision IA.',
            },
          ].map(({ icon: I, title, desc }) => (
            <div key={title} className="flex gap-4 p-5 rounded-2xl bg-card border border-border">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <I size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-sm">{title}</h4>
                <p className="text-xs text-muted mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-10">Perguntas frequentes</h2>
          <div className="space-y-3">
            <Accordion title="Preciso de conhecimento técnico para conectar?">
              Não. A conexão é feita via OAuth com um clique — sem código, sem configurações avançadas. Basta autorizar
              o acesso e o Precision IA faz o resto.
            </Accordion>
            <Accordion title="Funciona com RD Station CRM e Marketing?">
              Sim. A integração suporta ambos os produtos. No modo CRM, cria contatos, negócios, notas e tarefas.
              No modo Marketing, envia eventos de conversão com campos customizados e tags automáticas.
            </Accordion>
            <Accordion title="Os dados dos meus leads ficam seguros?">
              Sim. Utilizamos OAuth 2.0 com HMAC-SHA256 para autenticação, tokens criptografados em banco de dados,
              refresh automático e todas as comunicações são via HTTPS. Seguimos as melhores práticas do OWASP.
            </Accordion>
            <Accordion title="Quantos leads posso enviar por mês?">
              Depende do seu plano Precision IA. O plano Free oferece 10 créditos/mês, Starter 100, Growth 400 e
              Business 1.200. Cada análise de lead consome 1 crédito.
            </Accordion>
            <Accordion title="Como desconectar a integração?">
              Acesse Integrações no menu lateral do Precision IA, clique em &quot;Desconectar&quot; na seção RD Station
              e confirme. Todas as credenciais são removidas imediatamente.
            </Accordion>
            <Accordion title="Posso escolher quais campos são enviados?">
              Sim. No painel lateral CRM, você pode enviar no modo Automático (todos os campos preenchidos pela IA) ou
              Manual (você edita nome, telefone, e-mail, website, redes sociais e demais campos antes de enviar).
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-violet-500/10 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center relative">
          <h2 className="text-2xl sm:text-4xl font-black">
            Pronto para prospectar com <span className="text-violet-500">inteligência</span>?
          </h2>
          <p className="mt-4 text-muted max-w-lg mx-auto">
            Encontre leads qualificados, analise com IA e envie direto para o RD Station — tudo em minutos.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold transition-colors shadow-lg shadow-violet-500/25"
            >
              Criar conta grátis <ArrowRight size={16} />
            </Link>
            <Link
              to="/auth/signin"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full border border-border hover:border-violet-500/40 text-foreground font-semibold transition-colors"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/precisionai-logo-dark.png" alt="PrecisionAI" className="h-30 hidden dark:block" />
            <img src="/precisionai-logo-light.png" alt="PrecisionAI" className="h-30 block dark:hidden" />
            <span className="text-xs text-muted">PrecisionAI</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <a href="https://precisionia.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              precisionia.com.br
            </a>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
