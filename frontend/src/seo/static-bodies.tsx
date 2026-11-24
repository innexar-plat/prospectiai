/* eslint-disable react-refresh/only-export-components -- build-time renderer (scripts/generate-seo-html.mjs), never hot-reloaded */
/**
 * Build-time static HTML for crawlers (BR market). scripts/generate-seo-html.mjs bundles this
 * module with esbuild and puts each body inside <div id="root"> of the matching route's HTML, so
 * crawlers that do not run JavaScript still get the H1, the text and the internal links. React
 * replaces the markup on mount (createRoot, no hydration), so it never shows twice.
 *
 * Everything comes from the same data the React pages render — blog articles, local landing
 * texts, landing content and plan prices — so the two versions cannot drift apart.
 */
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BLOG_POSTS } from '@/pages/blog/blogData';
import { ARTICLE_CONTENT } from '@/pages/blog/blogContent';
import {
  getRelatedLinkLabel,
  getRelatedSeoSlugs,
  getSeoDescription,
  getSeoFaq,
  getSeoH1Title,
  getSeoIntro,
  getSeoLocalBlock,
  getWave1Slugs,
  type SeoLandingSlug,
} from '@/lib/seo-local';
import {
  companyLinkForLocalEntry,
  formatCount,
  getCityHubLinks,
  getSegmentHubLinks,
} from '@/lib/seo-company-stats';
import {
  BEFORE_AFTER,
  BR_PLANS,
  CRM_INTEGRATIONS,
  HERO_CARDS,
  HERO_HIGHLIGHT,
  HERO_SUB_PLAIN,
  HERO_TITLE,
  LANDING_FAQ,
  formatBrl,
} from '@/components/landing/landing-content';

export { localLandingForCompanyPage } from '@/lib/seo-company-stats';

const SIGNUP = '/auth/signup?utm_source=seo&utm_medium=static';

const NAV: Array<[string, string]> = [
  ['/', 'Início'],
  ['/empresas', 'Listas de empresas'],
  ['/amostra', 'Amostra grátis'],
  ['/pricing', 'Preços'],
  ['/blog', 'Blog'],
  ['/mapa-do-site', 'Mapa do site'],
];

function faqJsonLd(items: Array<{ q: string; a: string }>): ReactNode {
  const json = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2>Perguntas frequentes</h2>
      {items.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}
      {faqJsonLd(items)}
    </section>
  );
}

/** Header + footer with links on every page: no public page is an orphan. */
function Page({ children }: { children: ReactNode }) {
  const cities = getCityHubLinks().slice(0, 12);
  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <nav aria-label="Principal">
        {NAV.map(([href, label], i) => (
          <span key={href}>{i > 0 ? ' · ' : ''}<a href={href}>{label}</a></span>
        ))}
      </nav>
      <main>{children}</main>
      <footer>
        <p><a href={SIGNUP}>Teste grátis por 7 dias — sem cartão de crédito</a></p>
        <p>
          Empresas por cidade:{' '}
          {cities.map((c, i) => <span key={c.slug}>{i > 0 ? ', ' : ''}<a href={`/empresas/${c.slug}`}>{c.label}</a></span>)}
        </p>
        <p><a href="/privacy">Privacidade</a> · <a href="/terms">Termos de uso</a> · <a href="/mapa-do-site">Mapa do site</a></p>
      </footer>
    </div>
  );
}

const html = (node: ReactNode): string => renderToStaticMarkup(<Page>{node}</Page>);

function Home() {
  const faq = LANDING_FAQ.map((f) => ({ q: f.q, a: f.a }));
  return (
    <>
      <h1>{HERO_TITLE} {HERO_HIGHLIGHT}</h1>
      <p>{HERO_SUB_PLAIN}</p>
      <p><a href={SIGNUP}>Começar grátis</a> · <a href="/amostra">Ver 20 empresas grátis agora</a></p>
      <h2>Tudo que você precisa em 1 plataforma</h2>
      <ul>{HERO_CARDS.map((c) => <li key={c.title}><strong>{c.title}:</strong> {c.desc}</li>)}</ul>
      <h2>Antes vs depois do Precision</h2>
      <ul>{BEFORE_AFTER.map((b) => <li key={b.before}>{b.before} → {b.after} ({b.saving} menos tempo)</li>)}</ul>
      <h2>Integra com o CRM que você já usa</h2>
      <ul>
        {CRM_INTEGRATIONS.map((c) => (
          <li key={c.name}>
            {c.name === 'RD Station' ? <a href="/integracoes/rdstation">RD Station</a>
              : c.name === 'Agendor' ? <a href="/integracoes/agendor">Agendor</a>
                : c.name === 'HubSpot' ? <a href="/integracoes/hubspot">HubSpot</a> : c.name} — {c.desc}
          </li>
        ))}
      </ul>
      <h2>Planos</h2>
      <ul>{BR_PLANS.map((p) => <li key={p.key}>{p.name}: {formatBrl(p.price)}/mês — {p.leads.toLocaleString('pt-BR')} leads</li>)}</ul>
      <p><a href="/pricing">Ver todos os detalhes dos planos</a></p>
      <h2>Listas de empresas por segmento</h2>
      <ul>{getSegmentHubLinks().map((s) => <li key={s.slug}><a href={`/empresas/${s.slug}`}>{s.label}</a> — {formatCount(s.total)} empresas</li>)}</ul>
      <h2>Do blog</h2>
      <ul>{BLOG_POSTS.map((p) => <li key={p.slug}><a href={`/blog/${p.slug}`}>{p.title}</a></li>)}</ul>
      <Faq items={faq} />
    </>
  );
}

function Pricing() {
  return (
    <>
      <h1>Planos e preços do Precision</h1>
      <p>Prospecção B2B com IA a partir de {formatBrl(BR_PLANS[0].price)}/mês. Pagamento por PIX ou cartão pelo Mercado Pago. Cancele quando quiser, sem multa.</p>
      <ul>
        {BR_PLANS.map((p) => (
          <li key={p.key}><strong>{p.name}</strong> — {formatBrl(p.price)}/mês, {p.leads.toLocaleString('pt-BR')} leads por mês</li>
        ))}
      </ul>
      <h2>O que todos os planos incluem</h2>
      <ul>
        <li>Busca B2B por nicho e região, com base de 27 milhões de empresas</li>
        <li>Score IA por lead e scripts de abordagem prontos</li>
        <li>Rotina de vendas, CRM com funil e radar de empresas recém-abertas</li>
        <li>Exportação CSV/JSON e integração com RD Station, Agendor e HubSpot</li>
      </ul>
      <p><a href={SIGNUP}>Testar grátis por 7 dias</a> · <a href="/amostra">Ver uma amostra de 20 empresas</a></p>
      <Faq items={LANDING_FAQ.filter((f) => /plano|cancelar|seguro/i.test(f.q)).map((f) => ({ q: f.q, a: f.a }))} />
    </>
  );
}

function BlogIndex() {
  return (
    <>
      <h1>Blog Precision — vendas B2B, prospecção e geração de leads</h1>
      {BLOG_POSTS.map((p) => (
        <article key={p.slug}>
          <h2><a href={`/blog/${p.slug}`}>{p.title}</a></h2>
          <p>{p.excerpt}</p>
          <p><small>{p.category} · {p.readTime} de leitura</small></p>
        </article>
      ))}
    </>
  );
}

function BlogArticle({ slug }: { slug: string }) {
  const post = BLOG_POSTS.find((p) => p.slug === slug)!;
  const others = BLOG_POSTS.filter((p) => p.slug !== slug);
  return (
    <>
      <p><a href="/blog">Blog</a> / {post.category}</p>
      <h1>{post.title}</h1>
      <p><small>{new Date(`${post.date}T12:00:00Z`).toLocaleDateString('pt-BR')} · {post.readTime} de leitura</small></p>
      {ARTICLE_CONTENT[slug] ?? <p>{post.excerpt}</p>}
      <h2>Encontre essas empresas na prática</h2>
      <p>Veja <a href="/empresas">listas de empresas por cidade e segmento</a> ou <a href="/amostra">receba 20 empresas grátis</a> do seu nicho.</p>
      <h2>Leia também</h2>
      <ul>{others.map((p) => <li key={p.slug}><a href={`/blog/${p.slug}`}>{p.title}</a></li>)}</ul>
    </>
  );
}

function LocalLanding({ entry }: { entry: SeoLandingSlug }) {
  const data = companyLinkForLocalEntry(entry);
  const related = getRelatedSeoSlugs(entry);
  const faq = getSeoFaq(entry).map((f) => ({ q: f.question, a: f.answer }));
  const local = getSeoLocalBlock(entry);
  return (
    <>
      <h1>{getSeoH1Title(entry)}</h1>
      <p>{getSeoDescription(entry)}</p>
      {data && <p><a href={data.href}>{data.label}</a> — {formatCount(data.total)} empresas ativas na Receita Federal, com bairros e porte.</p>}
      {getSeoIntro(entry).map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
      {local.length > 0 && (
        <>
          <h2>O que você pode fazer aqui</h2>
          {local.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
        </>
      )}
      <h2>Como funciona</h2>
      <p>Você filtra por nicho e região, vê quantidade de empresas por segmento, presença digital (site e telefone) e ranking competitivo. A IA sugere script de ligação, e-mail e WhatsApp por lead, e você exporta em CSV ou envia ao CRM.</p>
      <Faq items={faq} />
      {related.length > 0 && (
        <>
          <h2>Páginas relacionadas</h2>
          <ul>{related.map((r) => <li key={r.slug}><a href={`/${r.slug}`}>{getRelatedLinkLabel(r)}</a></li>)}</ul>
        </>
      )}
    </>
  );
}

const INTEGRATIONS: Record<string, { h1: string; intro: string; items: string[] }> = {
  rdstation: {
    h1: 'Encontre leads com IA e envie direto para o RD Station',
    intro: 'O Precision prospecta empresas por nicho e região, classifica com inteligência artificial e entrega contatos, negócios e tarefas prontas no seu RD Station CRM ou Marketing — sem esforço manual.',
    items: ['Conexão nativa via OAuth', 'Contatos criados com dados enriquecidos dos leads', 'Campos personalizados: score, classificação, resumo de IA, segmento e avaliação Google', 'Envio manual ou automático pela auto-prospecção'],
  },
  agendor: {
    h1: 'Prospecte com IA e venda pelo Agendor',
    intro: 'O Precision encontra empresas com perfil do seu cliente ideal, analisa com inteligência artificial e envia contatos, organizações, negociações e tarefas direto para o Agendor — pronto para vender.',
    items: ['Conexão por token de API', 'Organizações, pessoas, negociações e tarefas criadas automaticamente', 'Score e resumo da IA no histórico do cliente'],
  },
  hubspot: {
    h1: 'Integre o Precision ao HubSpot CRM',
    intro: 'Prospecte empresas com IA, qualifique automaticamente e envie contatos e negócios para o HubSpot em um clique. Fluxo nativo via OAuth com mapeamento de pipeline, estágio e responsável.',
    items: ['Conexão nativa via OAuth', 'Contatos, empresas e negócios no pipeline escolhido', 'Mapeamento de estágio e responsável'],
  },
};

function Integration({ id }: { id: string }) {
  const i = INTEGRATIONS[id]!;
  return (
    <>
      <h1>{i.h1}</h1>
      <p>{i.intro}</p>
      <h2>O que a integração faz</h2>
      <ul>{i.items.map((t) => <li key={t}>{t}</li>)}</ul>
      <p>Outras integrações: {Object.keys(INTEGRATIONS).filter((k) => k !== id).map((k, n) => <span key={k}>{n > 0 ? ', ' : ''}<a href={`/integracoes/${k}`}>{INTEGRATIONS[k]!.h1.match(/(RD Station|Agendor|HubSpot)/)?.[0] ?? k}</a></span>)}</p>
    </>
  );
}

function SiteMap() {
  return (
    <>
      <h1>Mapa do site</h1>
      <h2>Principais páginas</h2>
      <ul>{NAV.map(([href, label]) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
      <h2>Blog</h2>
      <ul>{BLOG_POSTS.map((p) => <li key={p.slug}><a href={`/blog/${p.slug}`}>{p.title}</a></li>)}</ul>
      <h2>Integrações</h2>
      <ul>{Object.entries(INTEGRATIONS).map(([k, v]) => <li key={k}><a href={`/integracoes/${k}`}>{v.h1}</a></li>)}</ul>
      <h2>Prospecção B2B por cidade e nicho</h2>
      <ul>{getWave1Slugs().map((e) => <li key={e.slug}><a href={`/${e.slug}`}>{getSeoH1Title(e)}</a></li>)}</ul>
      <h2>Listas de empresas por cidade</h2>
      <ul>{getCityHubLinks().map((c) => <li key={c.slug}><a href={`/empresas/${c.slug}`}>{c.label}</a></li>)}</ul>
      <h2>Listas de empresas por segmento</h2>
      <ul>{getSegmentHubLinks().map((s) => <li key={s.slug}><a href={`/empresas/${s.slug}`}>{s.label}</a></li>)}</ul>
    </>
  );
}

function Legal({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p>{text}</p>
      <p>Dúvidas: <a href="mailto:suporte@precisionia.com.br">suporte@precisionia.com.br</a></p>
    </>
  );
}

/** Route path (no leading slash; '' = home) → static body HTML. */
export function buildBrStaticBodies(): Record<string, string> {
  const bodies: Record<string, string> = {
    '': html(<Home />),
    pricing: html(<Pricing />),
    blog: html(<BlogIndex />),
    'mapa-do-site': html(<SiteMap />),
    privacy: html(<Legal title="Política de Privacidade" text="Como o Precision coleta, usa e protege seus dados, em conformidade com a LGPD: dados de conta, cookies, seus direitos e como exercê-los." />),
    terms: html(<Legal title="Termos de Uso" text="Condições de uso da plataforma Precision: cadastro, assinatura e pagamentos, uso aceitável dos dados, cancelamento e responsabilidades." />),
  };
  for (const p of BLOG_POSTS) bodies[`blog/${p.slug}`] = html(<BlogArticle slug={p.slug} />);
  for (const e of getWave1Slugs()) bodies[e.slug] = html(<LocalLanding entry={e} />);
  for (const id of Object.keys(INTEGRATIONS)) bodies[`integracoes/${id}`] = html(<Integration id={id} />);
  return bodies;
}

/** Same header/footer around the /empresas bodies built by the generator. */
export function wrapStaticBody(innerHtml: string): string {
  const shell = renderToStaticMarkup(<Page><div data-static-slot="" /></Page>);
  return shell.replace('<div data-static-slot=""></div>', innerHtml);
}

// ── US market (us.precisionia.com.br) ─────────────────────────────────────────

const US_PLANS = [
  { name: 'Starter', price: 19, credits: 50 },
  { name: 'Growth', price: 49, credits: 400 },
  { name: 'Business', price: 99, credits: 1200 },
  { name: 'Enterprise', price: 249, credits: 5000 },
] as const;

const US_SIGNUP = '/auth/signup?utm_source=seo&utm_medium=static';
const US_NAV: Array<[string, string]> = [['/', 'Home'], ['/pricing', 'Pricing'], [US_SIGNUP, 'Start free trial']];

function UsPage({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <nav aria-label="Main">{US_NAV.map(([href, label], i) => <span key={href}>{i > 0 ? ' · ' : ''}<a href={href}>{label}</a></span>)}</nav>
      <main>{children}</main>
      <footer>
        <p><a href={US_SIGNUP}>Start your 7-day free trial</a> — cancel before day 8 and pay nothing.</p>
        <p><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/integracoes/hubspot">HubSpot integration</a></p>
      </footer>
    </div>
  );
}

const usHtml = (node: ReactNode): string => renderToStaticMarkup(<UsPage>{node}</UsPage>);

function UsHome({ m }: { m: Record<string, string> }) {
  const t = (k: string) => m[`landing.conv.${k}`] ?? '';
  return (
    <>
      <h1>{t('heroTitle')} {t('heroHighlight')}</h1>
      <p>{t('heroSub')}</p>
      <p><a href={US_SIGNUP}>{t('ctaPrimary')}</a> · {t('heroNote')}</p>
      <h2>{t('problemTitle')} {t('problemTitleHighlight')}</h2>
      <ul>{[1, 2, 3, 4].map((i) => <li key={i}>{t(`problem${i}`)}</li>)}</ul>
      <h2>{t('solutionCardTitle')}</h2>
      <ul>{[1, 2, 3, 4].map((i) => <li key={i}>{t(`solution${i}`)}</li>)}</ul>
      <h2>{t('howTitle')}</h2>
      <ol>{[1, 2, 3].map((i) => <li key={i}><strong>{t(`step${i}Title`)}:</strong> {t(`step${i}Desc`)}</li>)}</ol>
      <h2>{t('featuresTitle')}</h2>
      <ul>{[1, 2, 3, 4, 5, 6].map((i) => <li key={i}><strong>{t(`feature${i}Title`)}:</strong> {t(`feature${i}Desc`)}</li>)}</ul>
      <h2>Plans</h2>
      <ul>{US_PLANS.map((p) => <li key={p.name}>{p.name}: ${p.price}/mo — {p.credits.toLocaleString('en-US')} credits</li>)}</ul>
      <p><a href="/pricing">See all plan details</a></p>
      <h2>{t('finalTitle')}</h2>
      <p>{t('finalSub')}</p>
    </>
  );
}

function UsPricing() {
  return (
    <>
      <h1>Precision AI pricing</h1>
      <p>B2B prospecting with AI from $19/month. Every plan starts with a 7-day free trial: your card is only charged on day 8, and you can cancel before that and pay nothing.</p>
      <ul>{US_PLANS.map((p) => <li key={p.name}><strong>{p.name}</strong> — ${p.price}/month, {p.credits.toLocaleString('en-US')} credits per month</li>)}</ul>
      <h2>Every plan includes</h2>
      <ul>
        <li>Search businesses by niche and city, with phone, website and e-mail when available</li>
        <li>AI lead score and ready-to-send outreach messages</li>
        <li>Built-in CRM pipeline and daily follow-up list</li>
        <li>CSV export and HubSpot integration</li>
      </ul>
      <p><a href={US_SIGNUP}>Start your 7-day free trial</a></p>
    </>
  );
}

function UsSimple({ title, text }: { title: string; text: string }) {
  return (<><h1>{title}</h1><p>{text}</p><p>Questions: <a href="mailto:support@precisionia.com.br">support@precisionia.com.br</a></p></>);
}

/** Route path → static body for the US host. */
export function buildUsStaticBodies(messagesEn: Record<string, string>): Record<string, string> {
  const home = usHtml(<UsHome m={messagesEn} />);
  const pricing = usHtml(<UsPricing />);
  return {
    '': home,
    en: home,
    pricing,
    'en/pricing': pricing,
    privacy: usHtml(<UsSimple title="Privacy Policy" text="How Precision AI collects, uses and protects your data: account data, cookies, your rights (including under the CCPA) and how to exercise them." />),
    terms: usHtml(<UsSimple title="Terms of Service" text="Terms for using Precision AI: account, subscription and free trial, billing, acceptable use of business data and cancellation." />),
    'integracoes/hubspot': usHtml(<UsSimple title="Precision AI + HubSpot CRM" text="Prospect businesses with AI, qualify them automatically and send contacts and deals to HubSpot in one click, through a native OAuth connection with pipeline, stage and owner mapping." />),
  };
}
export { buildLocaleMessages } from '@/lib/i18n/merge';
