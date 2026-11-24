import { useEffect, useRef } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, Clock, Tag } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import LegalFooterLinks from '@/components/legal/LegalFooterLinks';
import { BLOG_POSTS, getBlogPostBySlug } from './blogData';
import { ARTICLE_CONTENT } from './blogContent';
import { getActiveMarket } from '@/lib/market';
import { getAppOrigin } from '@/lib/site-url';

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

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPostBySlug(slug) : undefined;
  const defaultTitleRef = useRef(document.title);

  const isUsMarket = getActiveMarket() === 'US';

  useEffect(() => {
    if (isUsMarket) return;
    const defaultTitle = defaultTitleRef.current;
    if (!post) return;
    const baseUrl = getAppOrigin();
    document.title = post.metaTitle;
    setMeta('description', post.metaDescription);
    setMeta('keywords', post.keywords.join(', '));
    setMeta('og:title', post.metaTitle, true);
    setMeta('og:description', post.metaDescription, true);
    setMeta('og:url', `${baseUrl}/blog/${post.slug}`, true);
    setMeta('og:type', 'article', true);
    setMeta('article:published_time', post.date, true);
    setMeta('twitter:title', post.metaTitle, true);
    setMeta('twitter:description', post.metaDescription, true);
    setCanonical(`${baseUrl}/blog/${post.slug}`);

    return () => { document.title = defaultTitle; };
  }, [post]);

  if (isUsMarket) return <Navigate to="/" replace />;

  if (!post) return <Navigate to="/blog" replace />;

  const baseUrl = getAppOrigin();
  const content = ARTICLE_CONTENT[post.slug];
  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center shrink-0"><Logo height={40} /></Link>
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
          <Link to="/" className="inline-flex items-center shrink-0"><Logo height={36} /></Link>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link to="/blog" className="hover:text-foreground transition-colors font-bold">Blog</Link>
            <LegalFooterLinks />
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
            author: { '@type': 'Organization', name: 'Precision' },
            publisher: { '@type': 'Organization', name: 'Precision', url: baseUrl },
            mainEntityOfPage: `${baseUrl}/blog/${post.slug}`,
            keywords: post.keywords.join(', '),
          }),
        }}
      />
    </div>
  );
}
