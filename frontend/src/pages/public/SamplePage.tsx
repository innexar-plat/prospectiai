import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, Loader2, Mail, Phone, Sparkles } from 'lucide-react';
import { saveSeoSearchIntent } from '@/lib/seo-search-intent';

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

interface Company { name: string; bairro: string | null; porte: string | null; openedAt: string | null; phone: string | null; email: string | null }
interface SampleResult { segment: string; city: string; uf: string; companies: Company[]; fromColdEmail: boolean }

const inputCls = 'w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-violet-500/30';

/**
 * Free sample of 20 companies — linked from cold e-mails (?t=signed token, no e-mail needed) and
 * from the public /empresas pages (?segmento=&cidade=&uf=, e-mail required).
 */
export default function SamplePage() {
  const [params] = useSearchParams();
  const token = params.get('t');
  const [segments, setSegments] = useState<Array<{ slug: string; name: string }>>([]);
  const [form, setForm] = useState({ segment: params.get('segmento') ?? '', city: params.get('cidade') ?? '', uf: (params.get('uf') ?? 'SP').toUpperCase(), email: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SampleResult | null>(null);

  useEffect(() => {
    document.title = 'Amostra grátis: 20 empresas para você vender | Precision';
    fetch('/api/public/sample').then((r) => r.json()).then((d: { segments?: Array<{ slug: string; name: string }> }) => setSegments(d.segments ?? [])).catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, token, email: token ? undefined : form.email }),
      });
      const data = (await res.json()) as SampleResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível gerar a amostra.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar a amostra.');
    } finally {
      setBusy(false);
    }
  };

  const goSignup = () => {
    if (result) saveSeoSearchIntent({ term: result.segment.toLowerCase(), city: result.city, uf: result.uf });
  };
  const signupHref = `/auth/signup?utm_source=${token ? 'coldmail' : 'seo'}&utm_medium=sample&utm_campaign=amostra`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-3xl mx-auto px-4 py-10 md:py-16">
        <Link to="/" className="text-xs text-muted hover:text-foreground">Precision IA</Link>
        {!result ? (
          <>
            <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
              <Sparkles size={13} aria-hidden /> Amostra grátis
            </span>
            <h1 className="mt-3 text-3xl md:text-4xl font-black leading-tight">Veja agora 20 empresas para você vender</h1>
            <p className="mt-3 text-lg text-muted">
              Escolha o tipo de cliente e a cidade. Mostramos na hora 20 empresas reais, com telefone e e-mail — começando pelas que abriram há pouco e ainda estão escolhendo fornecedores.
            </p>
            <form onSubmit={submit} className="mt-8 grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
              <label className="sm:col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-muted">Quem você quer como cliente?</span>
                <select required className={inputCls} value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
                  <option value="">Escolha um segmento…</option>
                  {segments.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Cidade</span>
                <input required className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex.: Campinas" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Estado</span>
                <select className={inputCls} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })}>
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              {!token && (
                <label className="sm:col-span-2 block">
                  <span className="mb-1 block text-xs font-medium text-muted">Seu e-mail (enviamos a lista para você)</span>
                  <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="voce@empresa.com.br" />
                </label>
              )}
              {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy} className="sm:col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />} Ver minhas 20 empresas
              </button>
              <p className="sm:col-span-2 text-center text-xs text-muted">Grátis, sem cartão e sem cadastro.</p>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl md:text-3xl font-black leading-tight">{result.segment} em {result.city} ({result.uf})</h1>
            <p className="mt-2 text-muted">
              {result.companies.length > 0
                ? `${result.companies.length} empresas para você começar hoje${token ? '' : ' — enviamos a lista para o seu e-mail também'}.`
                : 'Não encontramos empresas com contato para essa combinação. Tente outra cidade ou segmento.'}
            </p>
            <ol className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
              {result.companies.map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted">{[c.bairro, c.porte, c.openedAt ? `aberta em ${c.openedAt}` : null].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex flex-col text-xs text-foreground sm:items-end">
                    {c.phone && <span className="inline-flex items-center gap-1"><Phone size={12} aria-hidden /> {c.phone}</span>}
                    {c.email && <span className="inline-flex items-center gap-1 text-muted"><Mail size={12} aria-hidden /> {c.email}</span>}
                  </div>
                </li>
              ))}
            </ol>
            <section className="mt-8 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
              <h2 className="text-lg font-bold">Isso é só uma amostra.</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {['Todas as empresas da sua região, filtradas por bairro, porte e data de abertura', 'Nota de chance de compra de cada uma e a mensagem de abordagem pronta', 'Rotina diária de follow-up e funil de vendas para não perder nenhuma venda'].map((p) => (
                  <li key={p} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden /> {p}</li>
                ))}
              </ul>
              <Link to={signupHref} onClick={goSignup} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700">
                Ver a lista completa — 7 dias grátis <ArrowRight size={16} aria-hidden />
              </Link>
              <p className="mt-2 text-xs text-muted">Sem cartão de crédito.</p>
            </section>
            <button type="button" onClick={() => setResult(null)} className="mt-6 inline-flex items-center gap-1 text-sm text-violet-700 dark:text-violet-300 hover:underline">
              <Building2 size={14} aria-hidden /> Ver outro segmento ou cidade
            </button>
          </>
        )}
      </main>
    </div>
  );
}
