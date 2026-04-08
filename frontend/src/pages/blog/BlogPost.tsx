import React, { useEffect, useRef } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, Clock, Tag } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { BLOG_POSTS, getBlogPostBySlug } from './blogData';

const BASE_URL = 'https://precisionia.com.br';

function setMeta(nameOrProperty: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, nameOrProperty); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

function setCanonical(url: string) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', url);
}

const ARTICLE_CONTENT: Record<string, React.ReactNode> = {
  'como-encontrar-empresas-para-vender': (
    <article className="prose prose-lg dark:prose-invert max-w-none">
      <p className="lead">Encontrar empresas certas para vender seus produtos e serviços é o maior desafio de quem trabalha com <strong>vendas B2B</strong>. Sem uma lista qualificada, sua equipe perde tempo ligando para quem não tem perfil — e o resultado são taxas de conversão baixas e custo de aquisição alto.</p>

      <h2>1. Defina seu Perfil de Cliente Ideal (ICP)</h2>
      <p>Antes de sair buscando empresas, defina quem é seu <strong>cliente ideal</strong>. Considere: setor de atuação, faixa de faturamento, número de funcionários, região geográfica e maturidade digital. Quanto mais específico, mais qualificados serão seus leads.</p>

      <h2>2. Use Ferramentas de Prospecção com IA</h2>
      <p>Plataformas como o <strong>PrecisionAI</strong> permitem buscar empresas por nicho e região em segundos. A IA analisa cada empresa e atribui um <em>Score de Potencial</em> — priorizando quem tem mais chance de comprar.</p>

      <h2>3. Busque por Nicho e Região</h2>
      <p>Em vez de comprar listas genéricas, busque empresas pelo nicho exato (ex: &quot;clínicas odontológicas&quot;) e pela região onde você atua. Isso garante relevância e proximidade — dois fatores que aumentam a taxa de resposta.</p>

      <h2>4. Analise a Presença Digital</h2>
      <p>Empresas com site, Google Meu Negócio e redes sociais ativas tendem a investir mais em crescimento. Use isso como critério de qualificação. O PrecisionAI já verifica automaticamente a presença digital de cada lead.</p>

      <h2>5. Filtre por Dados de Contato</h2>
      <p>Não adianta encontrar empresas sem telefone ou email. Filtre por leads que tenham dados de contato verificados — isso é crucial para prospecção ativa por telefone, email ou WhatsApp.</p>

      <h2>6. Use Score para Priorizar</h2>
      <p>Com centenas de empresas na lista, como decidir para quem ligar primeiro? O <strong>Score IA</strong> ranqueia os leads do mais quente ao mais frio, baseado em dados públicos e sinais de compra.</p>

      <h2>7. Integre com seu CRM</h2>
      <p>Encontrou os leads certos? Envie direto para seu CRM (RD Station, Agendor, HubSpot) com um clique. Sem planilhas, sem digitação manual.</p>

      <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded-2xl p-6 my-8">
        <p className="font-bold text-violet-700 dark:text-violet-400 mb-2">Comece agora — é grátis</p>
        <p className="text-sm">O PrecisionAI oferece 10 créditos grátis para você testar a plataforma. Busque empresas por nicho e região, analise com IA e envie para seu CRM.</p>
      </div>
    </article>
  ),

  'como-prospectar-clientes-b2b': (
    <article className="prose prose-lg dark:prose-invert max-w-none">
      <p className="lead">A <strong>prospecção B2B</strong> é a base de qualquer operação de vendas entre empresas. Sem prospectar ativamente, sua equipe depende apenas de indicações e marketing — o que limita o crescimento.</p>

      <h2>1. Outbound vs. Inbound: Use os Dois</h2>
      <p>Prospecção ativa (outbound) gera resultados rápidos. Marketing de conteúdo (inbound) gera leads a longo prazo. As melhores equipes combinam as duas estratégias.</p>

      <h2>2. Cold Call Inteligente</h2>
      <p>Cold call não morreu — mudou. Pesquise sobre a empresa antes de ligar. Use dados do PrecisionAI para personalizar o script: mencione o nicho, a região e um desafio comum do setor.</p>

      <h2>3. Email de Prospecção</h2>
      <p>Emails frios funcionam quando são curtos, personalizados e oferecem valor. Não venda no primeiro email — ofereça um insight relevante sobre o mercado do prospect.</p>

      <h2>4. Social Selling no LinkedIn</h2>
      <p>Conecte-se com decisores, comente em publicações e compartilhe conteúdo relevante. O LinkedIn é o canal #1 para prospecção B2B no Brasil.</p>

      <h2>5. Cadência de Prospecção</h2>
      <p>Não desista na primeira tentativa. Uma cadência eficiente inclui 7-12 toques em 3 semanas: ligação, email, LinkedIn, WhatsApp. Varie os canais.</p>

      <h2>6. Qualificação com BANT</h2>
      <p>Budget (orçamento), Authority (decisor), Need (necessidade), Timeline (urgência). Qualifique cedo para não perder tempo com leads que não vão fechar.</p>

      <h2>7. Use IA para Qualificação</h2>
      <p>O <strong>Score IA do PrecisionAI</strong> analisa sinais públicos para classificar leads como quente, morno ou frio — antes mesmo do primeiro contato.</p>

      <h2>8. Acompanhe Métricas</h2>
      <p>Taxa de resposta, taxa de agendamento, taxa de conversão. Meça cada etapa do funil para identificar gargalos e melhorar continuamente.</p>

      <h2>9. Treine sua Equipe</h2>
      <p>Prospecção é habilidade — não talento. Invista em treinamento contínuo, role-play e feedback semanal para sua equipe comercial.</p>

      <h2>10. Automatize o Operacional</h2>
      <p>Use ferramentas que automatizam busca de leads, enriquecimento de dados e envio para CRM. Deixe sua equipe focada no que importa: conversar com prospects.</p>
    </article>
  ),

  'como-vender-para-empresas': (
    <article className="prose prose-lg dark:prose-invert max-w-none">
      <p className="lead"><strong>Vender para empresas</strong> (vendas B2B) exige uma abordagem diferente de vendas para consumidores. O ciclo é mais longo, envolve múltiplos decisores e a decisão é racional — baseada em ROI, não em impulso.</p>

      <h2>Entenda o Ciclo de Vendas B2B</h2>
      <p>O ciclo típico de vendas B2B tem 5 etapas: prospecção, qualificação, apresentação/proposta, negociação e fechamento. Cada etapa exige técnicas específicas.</p>

      <h2>Identifique os Decisores</h2>
      <p>Em vendas B2B, raramente uma pessoa decide sozinha. Mapeie o comitê de compra: quem influencia, quem decide, quem assina. Adapte sua mensagem para cada papel.</p>

      <h2>Venda Valor, Não Preço</h2>
      <p>Empresas compram resultados. Mostre ROI, cases de sucesso e projeções. Quanto sua solução vai <em>economizar</em> ou <em>gerar</em> para o cliente? Esse é o argumento que fecha.</p>

      <h2>Construa Confiança</h2>
      <p>Em B2B, confiança é moeda. Demonstre expertise, compartilhe conhecimento, cumpra prazos. A venda acontece quando o prospect confia que você vai entregar.</p>

      <h2>Follow-up Disciplinado</h2>
      <p>80% das vendas precisam de 5+ follow-ups. A maioria dos vendedores desiste no 2º. Tenha um sistema de follow-up consistente — é onde a venda realmente acontece.</p>

      <h2>Use Dados para Personalizar</h2>
      <p>Com ferramentas como o <strong>PrecisionAI</strong>, você chega à reunião sabendo o nicho, região, presença digital e potencial do lead. Isso muda o nível da conversa.</p>
    </article>
  ),

  'geracao-de-leads-b2b-guia-completo': (
    <article className="prose prose-lg dark:prose-invert max-w-none">
      <p className="lead">A <strong>geração de leads B2B</strong> é o processo de identificar e atrair empresas que podem se tornar clientes. É o primeiro passo de qualquer funil de vendas — e o que mais impacta o resultado final.</p>

      <h2>O que é um Lead B2B Qualificado?</h2>
      <p>Um lead qualificado (MQL/SQL) é uma empresa que demonstrou interesse ou tem perfil para comprar sua solução. A qualificação depende de: setor, tamanho, necessidade, orçamento e timing.</p>

      <h2>Estratégias de Geração de Leads</h2>
      <h3>Inbound (Atração)</h3>
      <ul>
        <li>Blog e SEO otimizado para palavras-chave do seu mercado</li>
        <li>Landing pages com ofertas de conteúdo rico (guias, templates, calculadoras)</li>
        <li>Webinars e eventos online sobre temas do setor</li>
      </ul>
      <h3>Outbound (Prospecção Ativa)</h3>
      <ul>
        <li>Busca de empresas por nicho e região (PrecisionAI)</li>
        <li>Cold email e cold call personalizados</li>
        <li>Social selling no LinkedIn</li>
      </ul>

      <h2>Métricas que Importam</h2>
      <p>CPL (custo por lead), taxa de qualificação, velocity (velocidade do funil), taxa de conversão MQL→SQL→Cliente. Acompanhe semanalmente.</p>

      <h2>Ferramentas Essenciais</h2>
      <p>PrecisionAI para busca e qualificação, CRM (RD Station, Agendor) para gestão, ferramenta de email para cadências automatizadas.</p>
    </article>
  ),

  'ferramentas-prospeccao-comercial': (
    <article className="prose prose-lg dark:prose-invert max-w-none">
      <p className="lead">Escolher a <strong>ferramenta de prospecção comercial</strong> certa pode dobrar a produtividade da sua equipe de vendas. Comparamos as principais opções do mercado brasileiro.</p>

      <h2>1. PrecisionAI</h2>
      <p><strong>Melhor para:</strong> busca de empresas por nicho e região com IA.</p>
      <p>Score de potencial, análise de concorrência, integração com RD Station e Agendor. Plano gratuito com 10 créditos/mês. A partir de R$129/mês.</p>

      <h2>2. LinkedIn Sales Navigator</h2>
      <p><strong>Melhor para:</strong> encontrar decisores por cargo e empresa.</p>
      <p>Filtros avançados, InMail, alertas de mudança de cargo. Preço: a partir de US$99/mês.</p>

      <h2>3. Apollo.io</h2>
      <p><strong>Melhor para:</strong> enriquecimento de dados e cadências de email.</p>
      <p>Base global de contatos, sequências automatizadas, analytics. Plano gratuito limitado.</p>

      <h2>4. Econodata</h2>
      <p><strong>Melhor para:</strong> dados de empresas brasileiras (CNPJ, faturamento).</p>
      <p>Base da Receita Federal, filtros por faturamento e porte. Foco no mercado BR.</p>

      <h2>5. RD Station CRM</h2>
      <p><strong>Melhor para:</strong> gestão de funil e pipeline de vendas.</p>
      <p>Gratuito para equipes pequenas. Integra com RD Marketing e PrecisionAI.</p>

      <h2>6. Agendor</h2>
      <p><strong>Melhor para:</strong> CRM simples para PMEs brasileiras.</p>
      <p>Interface intuitiva, app mobile, relatórios. Integração nativa com PrecisionAI.</p>

      <h2>7. HubSpot</h2>
      <p><strong>Melhor para:</strong> operações maiores que precisam de CRM + Marketing.</p>
      <p>Plano gratuito robusto. Suite completa de vendas, marketing e atendimento.</p>

      <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded-2xl p-6 my-8">
        <p className="font-bold text-violet-700 dark:text-violet-400 mb-2">Dica: combine ferramentas</p>
        <p className="text-sm">Use PrecisionAI para encontrar e qualificar leads + CRM para gerenciar o funil. Essa combinação cobre todo o ciclo de prospecção.</p>
      </div>
    </article>
  ),

  'dicas-vendas-b2b': (
    <article className="prose prose-lg dark:prose-invert max-w-none">
      <p className="lead">Reunimos <strong>15 dicas de vendas B2B</strong> testadas por equipes comerciais de sucesso. Da prospecção ao fechamento — táticas práticas para vender mais.</p>

      <h2>Prospecção</h2>
      <ol>
        <li><strong>Pesquise antes de ligar.</strong> 5 minutos de pesquisa economizam 30 min de ligação improdutiva.</li>
        <li><strong>Personalize cada abordagem.</strong> Mencione algo específico da empresa (expansão, novo produto, mudança).</li>
        <li><strong>Use múltiplos canais.</strong> Telefone + email + LinkedIn + WhatsApp. Varie a cadência.</li>
      </ol>

      <h2>Qualificação</h2>
      <ol start={4}>
        <li><strong>Ouça mais do que fala.</strong> A proporção ideal é 60% ouvir, 40% falar na primeira reunião.</li>
        <li><strong>Descubra a dor real.</strong> Pergunte &quot;o que acontece se vocês não resolverem isso?&quot;</li>
        <li><strong>Identifique o decisor cedo.</strong> &quot;Além de você, quem participa dessa decisão?&quot;</li>
      </ol>

      <h2>Apresentação</h2>
      <ol start={7}>
        <li><strong>Mostre ROI, não features.</strong> &quot;Nossos clientes reduzem X% do custo&quot; &gt; &quot;Temos 50 funcionalidades&quot;.</li>
        <li><strong>Use cases do mesmo setor.</strong> Nada convence mais que resultados de empresas similares.</li>
        <li><strong>Crie urgência legítima.</strong> Condição especial com prazo, vaga limitada para onboarding.</li>
      </ol>

      <h2>Negociação</h2>
      <ol start={10}>
        <li><strong>Nunca dê desconto sem receber algo.</strong> Prazo de pagamento, contrato maior, indicação.</li>
        <li><strong>Apresente 3 opções.</strong> Básico, recomendado e premium. O cérebro tende ao meio.</li>
        <li><strong>Silencie após a proposta.</strong> Quem fala primeiro depois do preço, perde.</li>
      </ol>

      <h2>Fechamento e Pós-venda</h2>
      <ol start={13}>
        <li><strong>Peça o fechamento.</strong> &quot;Podemos começar segunda?&quot; — muitos vendedores esquecem de pedir.</li>
        <li><strong>Onboarding impecável.</strong> Os primeiros 30 dias definem se o cliente fica ou cancela.</li>
        <li><strong>Peça indicações.</strong> Cliente satisfeito indica. Mas só se você pedir.</li>
      </ol>
    </article>
  ),
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPostBySlug(slug) : undefined;
  const defaultTitleRef = useRef(document.title);

  useEffect(() => {
    if (!post) return;
    document.title = post.metaTitle;
    setMeta('description', post.metaDescription);
    setMeta('keywords', post.keywords.join(', '));
    setMeta('og:title', post.metaTitle, true);
    setMeta('og:description', post.metaDescription, true);
    setMeta('og:url', `${BASE_URL}/blog/${post.slug}`, true);
    setMeta('og:type', 'article', true);
    setMeta('article:published_time', post.date, true);
    setMeta('twitter:title', post.metaTitle, true);
    setMeta('twitter:description', post.metaDescription, true);
    setCanonical(`${BASE_URL}/blog/${post.slug}`);

    return () => { document.title = defaultTitleRef.current; };
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  const content = ARTICLE_CONTENT[post.slug];
  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center shrink-0"><Logo height={168} /></Link>
          <div className="flex items-center gap-3">
            <Link to="/blog" className="text-sm font-bold text-violet-500">Blog</Link>
            <Link to="/auth/signup" className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors">
              Teste grátis <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pt-12 pb-6">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted hover:text-violet-500 transition-colors mb-6">
          <ArrowLeft size={14} /> Voltar ao blog
        </Link>

        <div className="flex items-center gap-3 mb-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-bold">
            <Tag size={10} /> {post.category}
          </span>
          <span className="inline-flex items-center gap-1"><Calendar size={10} /> {new Date(post.date).toLocaleDateString('pt-BR')}</span>
          <span className="inline-flex items-center gap-1"><Clock size={10} /> {post.readTime}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-black mb-8 leading-tight">{post.title}</h1>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16">{content}</div>

      {/* CTA */}
      <section className="bg-violet-600 text-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-black mb-4">Pronto para encontrar empresas para vender?</h2>
          <p className="text-violet-100 mb-8 max-w-lg mx-auto">Comece grátis com 10 créditos. Busque empresas por nicho e região, analise com IA e envie para seu CRM.</p>
          <Link to="/auth/signup" className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-white text-violet-700 font-bold hover:bg-violet-50 transition-colors">
            Criar conta grátis <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Related */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-xl font-bold mb-6">Leia também</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {relatedPosts.map((r) => (
            <Link key={r.slug} to={`/blog/${r.slug}`} className="p-4 rounded-xl border border-border hover:border-violet-500/50 transition-all">
              <p className="text-xs text-violet-500 font-bold mb-1">{r.category}</p>
              <p className="text-sm font-bold text-foreground leading-snug">{r.title}</p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center shrink-0"><Logo height={120} /></Link>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link to="/blog" className="hover:text-foreground transition-colors font-bold">Blog</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Termos</Link>
          </div>
        </div>
      </footer>

      {/* Article structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.metaDescription,
            datePublished: post.date,
            author: { '@type': 'Organization', name: 'PrecisionAI' },
            publisher: { '@type': 'Organization', name: 'PrecisionAI', url: BASE_URL },
            mainEntityOfPage: `${BASE_URL}/blog/${post.slug}`,
            keywords: post.keywords.join(', '),
          }),
        }}
      />
    </div>
  );
}
