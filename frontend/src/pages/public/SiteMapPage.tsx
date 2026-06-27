import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BLOG_POSTS } from '@/pages/blog/blogData';
import { getWave1Slugs } from '@/lib/seo-local';
import { getActiveMarket } from '@/lib/market';
import { getAppOrigin } from '@/lib/site-url';

function setMeta(nameOrProperty: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, nameOrProperty);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function SiteMapPage() {
  const seoSlugs = getWave1Slugs();

  const isUsMarket = getActiveMarket() === 'US';

  useEffect(() => {
    if (isUsMarket) return;
    const baseUrl = getAppOrigin();
    document.title = 'Mapa do Site | Precision';
    setMeta('description', 'Mapa do site da Precision com links para paginas de blog, integracoes, termos e paginas locais de prospeccao B2B.');
    setMeta('og:title', 'Mapa do Site | Precision', true);
    setMeta('og:description', 'Todos os links publicos indexaveis da Precision em um so lugar.', true);
    setMeta('og:url', `${baseUrl}/mapa-do-site`, true);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${baseUrl}/mapa-do-site`);
  }, []);

  if (isUsMarket) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <h1 className="text-3xl md:text-4xl font-black mb-3">Mapa do Site</h1>
        <p className="text-muted mb-10">Links publicos para navegacao e descoberta de conteudo.</p>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Principais paginas</h2>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
            <li><Link to="/" className="underline underline-offset-2 hover:text-violet-500">Inicio</Link></li>
            <li><Link to="/blog" className="underline underline-offset-2 hover:text-violet-500">Blog</Link></li>
            <li><Link to="/integracoes/rdstation" className="underline underline-offset-2 hover:text-violet-500">Integracao RD Station</Link></li>
            <li><Link to="/integracoes/agendor" className="underline underline-offset-2 hover:text-violet-500">Integracao Agendor</Link></li>
            <li><Link to="/integracoes/hubspot" className="underline underline-offset-2 hover:text-violet-500">Integracao HubSpot</Link></li>
            <li><Link to="/privacy" className="underline underline-offset-2 hover:text-violet-500">Privacidade</Link></li>
            <li><Link to="/terms" className="underline underline-offset-2 hover:text-violet-500">Termos</Link></li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Posts do blog</h2>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
            {BLOG_POSTS.map((post) => (
              <li key={post.slug}>
                <Link to={`/blog/${post.slug}`} className="underline underline-offset-2 hover:text-violet-500">
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Paginas locais de prospeccao B2B</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {seoSlugs.map((entry) => (
              <li key={entry.slug}>
                <Link to={`/${entry.slug}`} className="underline underline-offset-2 hover:text-violet-500">
                  {entry.slug}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
