import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import LegalFooterLinks from '@/components/legal/LegalFooterLinks';
import SeoMeta from '@/components/layout/SeoMeta';
import BreadcrumbJsonLd from '@/components/layout/BreadcrumbJsonLd';
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
  Key,
  Copy,
  ClipboardCheck,
} from 'lucide-react';
import { useState } from 'react';

/* ─── Accordion ────────────────────────────────────────────────────── */
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
      <div className="w-11 h-11 rounded-xl bg-[#4400CC]/15 flex items-center justify-center">
        <Icon size={22} className="text-[#7C5CFC]" />
      </div>
      <h3 className="font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─── Step card ────────────────────────────────────────────────────── */
function Step({ n, title, desc, highlight }: { n: number; title: string; desc: string; highlight?: boolean }) {
  return (
    <div className={`flex gap-4 items-start ${highlight ? 'bg-[#4400CC]/5 -mx-2 px-2 py-3 rounded-xl border border-[#4400CC]/20' : ''}`}>
      <div className="w-10 h-10 rounded-full bg-[#4400CC] text-white flex items-center justify-center font-bold text-lg shrink-0">
        {n}
      </div>
      <div>
        <h4 className="font-bold text-foreground">{title}</h4>
        <p className="text-sm text-muted mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Token guide step ─────────────────────────────────────────────── */
function TokenStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
        {n}
      </div>
      <div>
        <h4 className="font-semibold text-foreground text-sm">{title}</h4>
        <div className="text-sm text-muted mt-1 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function AgendorIntegration() {
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoMeta
        title="Integração Precision + Agendor CRM"
        description="Conecte o Precision ao Agendor e envie leads prospectados direto para seu CRM. Integração com token de API, upsert de contatos e negociações enriquecidas."
        path="/integracoes/agendor"
      />
      <BreadcrumbJsonLd items={[
        { name: 'Início', path: '/' },
        { name: 'Integração Agendor', path: '/integracoes/agendor' },
      ]} />
      {/* ── Header ─────────────────────────────────────────────── */}
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
              className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors"
            >
              Começar grátis <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#4400CC]/5 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center relative">
          {/* Partner logos */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-10">
            <div className="flex flex-col items-center gap-2">
              <Logo height={48} className="sm:h-[4.5rem] w-auto shrink-0" />
              <span className="text-xs font-bold text-muted">Precision</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Handshake size={32} className="text-[#7C5CFC]" />
              <span className="text-[10px] font-bold text-[#7C5CFC] uppercase tracking-wider">Parceria</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <img
                src="/logos/Agendor_idi8FvRR_k_0.png"
                alt="Agendor"
                className="h-14 sm:h-20 object-contain bg-white rounded-2xl p-2"
              />
              <span className="text-xs font-bold text-muted">Agendor</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
            Prospecte com <span className="text-violet-500">IA</span> e venda
            <br className="hidden sm:block" /> pelo <span className="text-[#4400CC]">Agendor</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            O Precision encontra empresas com perfil do seu cliente ideal, analisa com inteligência artificial
            e envia contatos, organizações, negociações e tarefas direto para o Agendor — pronto para vender.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-[#4400CC] hover:bg-[#3800AA] text-white font-bold transition-colors shadow-lg shadow-[#4400CC]/25"
            >
              Começar grátis <ArrowRight size={16} />
            </Link>
            <a
              href="#como-obter-token"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full border border-border hover:border-[#4400CC]/40 text-foreground font-semibold transition-colors"
            >
              <Key size={16} /> Como obter o token
            </a>
          </div>
        </div>
      </section>

      {/* ── O que é criado automaticamente ────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-[#4400CC]/15 text-[#7C5CFC] text-[11px] font-bold uppercase tracking-wider mb-3">
            Integração completa
          </span>
          <h2 className="text-2xl sm:text-3xl font-black">Tudo que a integração cria no Agendor</h2>
          <p className="text-muted mt-2 max-w-xl mx-auto">
            Cada lead enviado pode gerar até 4 recursos automaticamente no Agendor.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Feature
            icon={Users}
            title="Pessoa (contato)"
            desc="Nome, celular, WhatsApp, e-mail, Facebook, Instagram, LinkedIn — tudo preenchido automaticamente com deduplicação por e-mail."
          />
          <Feature
            icon={Target}
            title="Organização"
            desc="Empresa criada via upsert com nome, website, endereço (estado, cidade, país), e-mail de contato e segmento."
          />
          <Feature
            icon={MessageSquare}
            title="Negociação enriquecida"
            desc="Título, valor calculado pelo score de IA, funil, etapa e responsável configuráveis. Descrição com resumo de IA, estratégia de abordagem e mensagem pronta."
          />
          <Feature
            icon={RefreshCw}
            title="Tarefa de follow-up"
            desc="Tarefa tipo WhatsApp criada automaticamente com prazo para o dia seguinte, vinculada à pessoa."
          />
        </div>
      </section>

      {/* ── Como obter o Token do Agendor ────────────────────── */}
      <section id="como-obter-token" className="bg-card border-y border-border scroll-mt-20">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-3">
              <Key size={12} className="inline mr-1 -mt-0.5" /> Passo a passo
            </span>
            <h2 className="text-2xl sm:text-3xl font-black">Como obter seu Token de API do Agendor</h2>
            <p className="text-muted mt-2 max-w-lg mx-auto">
              O token é necessário para conectar o Precision ao seu Agendor. Leva menos de 1 minuto.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-6 sm:p-8 space-y-6">
            <TokenStep n={1} title="Acesse o Agendor">
              Faça login em{' '}
              <a
                href="https://web.agendor.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4400CC] dark:text-[#7C5CFC] font-semibold underline underline-offset-2"
              >
                web.agendor.com.br
              </a>
              {' '}com sua conta.
            </TokenStep>

            <TokenStep n={2} title="Vá em Configurações">
              No menu lateral esquerdo, clique no ícone de <strong>engrenagem</strong> (Configurações) ou acesse diretamente{' '}
              <a
                href="https://web.agendor.com.br/configuracoes/integracao"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4400CC] dark:text-[#7C5CFC] font-semibold underline underline-offset-2"
              >
                Configurações → Integrações
              </a>.
            </TokenStep>

            <TokenStep n={3} title="Encontre o Token de API">
              Na seção <strong>&quot;Integrações&quot;</strong> ou <strong>&quot;API / Tokens&quot;</strong>, você verá o seu token de API pessoal.
              Ele é uma string longa parecida com esta:
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground truncate">
                  a1b2c3d4-e5f6-7890-abcd-ef1234567890
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('a1b2c3d4-e5f6-7890-abcd-ef1234567890').catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="shrink-0 p-2 rounded-lg bg-surface border border-border hover:border-amber-500/40 transition-colors"
                  title="Copiar exemplo"
                >
                  {copied ? <ClipboardCheck size={16} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={16} className="text-muted" />}
                </button>
              </div>
            </TokenStep>

            <TokenStep n={4} title="Copie o token">
              Clique no botão <strong>&quot;Copiar&quot;</strong> ao lado do token ou selecione e copie manualmente (Ctrl+C).
            </TokenStep>

            <TokenStep n={5} title="Cole no Precision">
              No Precision, acesse{' '}
              <strong>Painel → Integrações → Agendor</strong>, cole o token no campo indicado e clique em <strong>&quot;Salvar&quot;</strong>.
              A conexão será validada automaticamente.
            </TokenStep>

            <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-emerald-600 dark:text-emerald-400">Pronto!</p>
                <p className="text-muted mt-0.5">
                  Após salvar, o status mudará para <strong>&quot;Conectado&quot;</strong> e você já pode enviar leads diretamente para o Agendor.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-surface border border-border flex items-start gap-3">
            <Shield size={18} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">
              <strong className="text-foreground">Seu token é seguro.</strong>{' '}
              O Precision armazena seu token de forma criptografada no banco de dados.
              Ele nunca é exposto no frontend nem compartilhado com terceiros. Você pode desconectar a qualquer momento.
            </p>
          </div>
        </div>
      </section>

      {/* ── Funcionalidades do Precision ──────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[11px] font-bold uppercase tracking-wider mb-3">
            Plataforma
          </span>
          <h2 className="text-2xl sm:text-3xl font-black">O poder do Precision + Agendor</h2>
          <p className="text-muted mt-2 max-w-xl mx-auto">
            Prospecção inteligente que alimenta direto o seu CRM.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Globe, t: 'Mapeamento por região', d: 'Busca empresas por nicho e localização usando Google Places com filtros de website e telefone.' },
            { icon: Star, t: 'Score de oportunidade', d: 'IA classifica leads como hot/warm/cold com score de 0 a 100. O valor da negociação é calculado automaticamente.' },
            { icon: BarChart3, t: 'Análise de concorrência', d: 'Ranking por avaliações Google, presença digital e gaps de mercado da região.' },
            { icon: MessageSquare, t: 'Abordagem pronta', d: 'Scripts de telefone, e-mail e WhatsApp adaptados ao nicho — enviados na descrição da negociação.' },
            { icon: BrainCircuit, t: 'Inteligência de mercado', d: 'Segmentação, maturidade digital e índice de saturação por região.' },
            { icon: Users, t: 'Gestão de equipe', d: 'Distribua leads entre vendedores, e escolha o responsável na hora de enviar para o Agendor.' },
            { icon: Phone, t: 'Filtros avançados', d: 'Filtre por presença de website, telefone, score mínimo e tipo de negócio antes de enviar.' },
            { icon: Zap, t: 'Análise em lote', d: 'Analise dezenas de leads com IA em background e envie os melhores para o Agendor.' },
          ].map(({ icon, t, d }) => (
            <Feature key={t} icon={icon} title={t} desc={d} />
          ))}
        </div>
      </section>

      {/* ── Como funciona (passo a passo) ────────────────────── */}
      <section className="bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-[#4400CC]/15 text-[#7C5CFC] text-[11px] font-bold uppercase tracking-wider mb-3">
              Fluxo completo
            </span>
            <h2 className="text-2xl sm:text-3xl font-black">Do lead ao CRM em 5 passos</h2>
            <p className="text-muted mt-2">Conecte, prospecte e venda — tudo integrado.</p>
          </div>
          <div className="space-y-6 bg-background border border-border rounded-2xl p-6 sm:p-8">
            <Step n={1} title="Conecte seu Agendor" desc="Cole o token de API nas configurações de integração do Precision." highlight />
            <Step n={2} title="Busque por nicho e região" desc="Ex: 'Restaurantes em São Paulo' — o Precision mapeia todas as empresas usando Google Places." />
            <Step n={3} title="Analise com inteligência artificial" desc="Cada lead recebe um score de oportunidade, classificação e estratégia de abordagem personalizada." />
            <Step n={4} title="Envie para o Agendor com um clique" desc="Abra o painel lateral CRM, escolha modo automático ou manual, selecione funil e etapa, e clique em enviar." />
            <Step n={5} title="Encontre tudo organizado no Agendor" desc="Pessoa, organização, negociação com descrição rica e tarefa de follow-up — tudo criado automaticamente." />
          </div>
        </div>
      </section>

      {/* ── Modos de envio ───────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black">Dois modos de envio</h2>
          <p className="text-muted mt-2">Escolha o que melhor se encaixa no seu processo.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Contato */}
          <div className="rounded-2xl border-2 border-[#4400CC]/40 p-6 sm:p-8 space-y-4 bg-[#4400CC]/5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4400CC]/15 text-[#7C5CFC] text-xs font-bold">
              <Users size={14} /> Apenas Contato
            </div>
            <h3 className="text-xl font-black text-foreground">Pessoa + Organização</h3>
            <ul className="space-y-2 text-sm text-muted">
              {[
                'Cria pessoa com dados completos',
                'Celular, WhatsApp e telefone comercial',
                'E-mail, Facebook, Instagram, LinkedIn',
                'Organização vinculada via upsert',
                'Deduplicação automática por e-mail',
                'Descrição com resumo de IA e dados estruturados',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-[#7C5CFC] mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          {/* Contato + Negociação */}
          <div className="rounded-2xl border-2 border-violet-500/40 p-6 sm:p-8 space-y-4 bg-violet-500/5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-xs font-bold">
              <Target size={14} /> Contato + Negociação
            </div>
            <h3 className="text-xl font-black text-foreground">O pacote completo</h3>
            <ul className="space-y-2 text-sm text-muted">
              {[
                'Tudo do modo Contato +',
                'Negociação com título e valor automáticos',
                'Funil e etapa configuráveis',
                'Responsável selecionável',
                'Descrição rica: resumo IA, pontos fortes/fracos, scripts, mensagem WhatsApp',
                'Tarefa de follow-up para o dia seguinte',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── O que vai na descrição da negociação ─────────────── */}
      <section className="bg-card border-y border-border">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-[11px] font-bold uppercase tracking-wider mb-3">
              Dados enriquecidos
            </span>
            <h2 className="text-2xl sm:text-3xl font-black">O que é enviado na negociação</h2>
            <p className="text-muted mt-2 max-w-lg mx-auto">
              A descrição da negociação no Agendor recebe até 4.000 caracteres com informações estruturadas pela IA.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { t: 'Resumo da análise de IA', d: 'Visão geral gerada pela IA sobre o potencial do lead.' },
              { t: 'Dados estruturados', d: 'Endereço, telefone, website, avaliação Google, nº de reviews, segmento, Place ID.' },
              { t: 'Pontos fortes e gaps', d: 'Fortalezas e lacunas identificadas pela IA para a abordagem comercial.' },
              { t: 'Pontos de dor', d: 'Pain points mapeados para personalizar o pitch de vendas.' },
              { t: 'Mensagem para primeiro contato', d: 'Texto pronto para e-mail ou ligação, adaptado ao nicho.' },
              { t: 'Mensagem WhatsApp', d: 'Texto pronto para WhatsApp com abordagem consultiva.' },
              { t: 'Relatório completo', d: 'Análise detalhada com estratégia de prospecção e timing ideal.' },
              { t: 'Redes sociais', d: 'Links de Facebook, Instagram e LinkedIn do lead prospectado.' },
            ].map(({ t, d }) => (
              <div key={t} className="flex gap-3 p-4 rounded-xl bg-background border border-border">
                <CheckCircle2 size={18} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground text-sm">{t}</p>
                  <p className="text-xs text-muted mt-0.5">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-black text-center mb-10">Perguntas frequentes</h2>
        <div className="space-y-3">
          <Accordion title="Onde encontro o token de API do Agendor?">
            Acesse{' '}
            <a href="https://web.agendor.com.br/configuracoes/integracao" target="_blank" rel="noopener noreferrer" className="text-[#7C5CFC] underline">
              web.agendor.com.br → Configurações → Integrações
            </a>. O token é uma string que começa com letras e números separados por hífens.
            Copie e cole no campo de token do Precision em Integrações → Agendor → Salvar.
          </Accordion>
          <Accordion title="Preciso instalar alguma coisa no Agendor?">
            Não. A integração usa a API REST oficial do Agendor (v3). Basta o token de API — sem instalar apps,
            plugins ou extensões. Funciona com qualquer plano do Agendor que tenha acesso à API.
          </Accordion>
          <Accordion title="Os contatos são duplicados se eu enviar duas vezes?">
            Não. O Precision usa a funcionalidade de <strong>upsert</strong> do Agendor. Se o e-mail já existir,
            a pessoa é atualizada em vez de duplicada. Organizações também são deduplicadas pelo nome.
          </Accordion>
          <Accordion title="Posso escolher o funil e a etapa da negociação?">
            Sim. No painel lateral CRM, você pode selecionar o funil, a etapa e o responsável antes de enviar.
            Se não selecionar, o Precision usa os valores padrão configurados.
          </Accordion>
          <Accordion title="Como é calculado o valor da negociação?">
            O valor é calculado automaticamente pelo score de oportunidade da IA:{' '}
            <code className="bg-surface px-1.5 py-0.5 rounded text-xs">score × 100</code>.
            Por exemplo, um lead com score 85 gera uma negociação com valor R$ 8.500.
            Você pode editar o valor no modo manual antes de enviar.
          </Accordion>
          <Accordion title="Meu token fica seguro?">
            Sim. O token é criptografado antes de ser salvo no banco de dados e nunca é exposto no frontend após o salvamento.
            Toda comunicação é via HTTPS. Você pode revogar o acesso a qualquer momento clicando em &quot;Desconectar&quot;.
          </Accordion>
          <Accordion title="Funciona com qualquer plano do Agendor?">
            A integração utiliza a API v3 do Agendor. Verifique se o seu plano inclui acesso à API.
            Planos Pro e Enterprise geralmente incluem. Em caso de dúvida, consulte o suporte do Agendor.
          </Accordion>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#4400CC]/10 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center relative">
          <h2 className="text-2xl sm:text-4xl font-black">
            Prospecção com <span className="text-violet-500">IA</span> + vendas no <span className="text-[#4400CC]">Agendor</span>
          </h2>
          <p className="mt-4 text-muted max-w-lg mx-auto">
            Encontre leads qualificados, analise com inteligência artificial e envie direto para o Agendor — com dados enriquecidos e abordagem pronta.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-[#4400CC] hover:bg-[#3800AA] text-white font-bold transition-colors shadow-lg shadow-[#4400CC]/25"
            >
              Criar conta grátis <ArrowRight size={16} />
            </Link>
            <Link
              to="/auth/signin"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full border border-border hover:border-[#4400CC]/40 text-foreground font-semibold transition-colors"
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
            <Logo height={30} />
            <span className="text-xs text-muted">Precision</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <a href="https://precisionia.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              precisionia.com.br
            </a>
            <LegalFooterLinks />
          </div>
        </div>
      </footer>
    </div>
  );
}
