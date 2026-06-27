import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Calendar, Clock, Tag } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import LegalFooterLinks from '@/components/legal/LegalFooterLinks';
import { BLOG_POSTS } from './blogData';
import { getActiveMarket } from '@/lib/market';
import { getAppOrigin } from '@/lib/site-url';

function setMeta(nameOrProperty: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, nameOrProperty); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

export default function BlogIndex() {
  const isUsMarket = getActiveMarket() === 'US';

  useEffect(() => {
    if (isUsMarket) return;
    const baseUrl = getAppOrigin();
    document.title = 'Blog Precision — Dicas de Vendas B2B, Prospecção e Geração de Leads';
    setMeta('description', 'Blog sobre vendas B2B, prospecção de clientes, geração de leads e como encontrar empresas para vender. Dicas práticas e estratégias comprovadas.');
    setMeta('og:title', 'Blog Precision — Vendas B2B e Prospecção', true);
    setMeta('og:description', 'Dicas de vendas B2B, prospecção de clientes e geração de leads. Aprenda como encontrar empresas para vender.', true);
    setMeta('og:url', `${baseUrl}/blog`, true);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `${baseUrl}/blog`);
  }, []);

  if (isUsMarket) return <Navigate to="/" replace />;

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

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-8">
        <h1 className="text-4xl md:text-5xl font-black mb-4">Blog Precision</h1>
        <p className="text-lg text-muted max-w-2xl">
          Dicas práticas de <strong>vendas B2B</strong>, <strong>prospecção de clientes</strong> e como <strong>encontrar empresas para vender</strong>.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20 grid gap-6">
        {BLOG_POSTS.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group block p-6 rounded-2xl border border-border bg-card hover:border-violet-500/50 hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-3 mb-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-bold">
                <Tag size={10} /> {post.category}
              </span>
              <span className="inline-flex items-center gap-1"><Calendar size={10} /> {new Date(post.date).toLocaleDateString('pt-BR')}</span>
              <span className="inline-flex items-center gap-1"><Clock size={10} /> {post.readTime}</span>
            </div>
            <h2 className="text-xl font-bold text-foreground group-hover:text-violet-500 transition-colors mb-2">
              {post.title}
            </h2>
            <p className="text-muted text-sm leading-relaxed">{post.excerpt}</p>
          </Link>
        ))}
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
    </div>
  );
}
