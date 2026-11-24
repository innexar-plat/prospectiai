import { useEffect, useState } from 'react';
import { Briefcase, Building2, Check, ChevronLeft, ChevronRight, Download, Globe, Loader2, Mail, MapPin, Phone, Search } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { Button } from '@/components/ui/Button';
import { crmApi, usSearchApi, type UsCompanyResult } from '@/lib/api';
import { US_STATES } from '@/lib/locationData';
import { exportToCSV } from '@/lib/exportService';
import { useToast } from '@/contexts/ToastContext';

const PAGE_SIZE = 25;
const field = 'h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30';

/** Only http(s) links from the open dataset become clickable. */
function safeUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** US business base (Overture Maps): industry + state + city + contact filters. */
export default function UsCompaniesPage() {
  const { addToast } = useToast();
  const [segments, setSegments] = useState<Array<{ slug: string; name: string }>>([]);
  const [form, setForm] = useState({ segment: '', state: '', city: '', hasPhone: true, hasEmail: false, hasWebsite: false });
  const [searched, setSearched] = useState<typeof form | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ companies: UsCompanyResult[]; total: number; capped: boolean } | null>(null);
  const [inCrm, setInCrm] = useState<Set<string>>(new Set());

  useEffect(() => {
    usSearchApi.segments().then((r) => setSegments(r.segments)).catch(() => undefined);
  }, []);

  const run = async (target: number, filters: typeof form) => {
    setLoading(true);
    setError(null);
    try {
      const r = await usSearchApi.search({ ...filters, city: filters.city.trim() || undefined, page: target });
      setResult(r);
      setSearched(filters);
      setPage(target);
      if (target === 1) window.dispatchEvent(new Event('refresh-user'));
    } catch (err) {
      const m = err instanceof Error ? err.message : '';
      setError(/limit/i.test(m) ? 'You are out of credits this month. Upgrade to keep searching.' : m || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addToCrm = async (c: UsCompanyResult) => {
    try {
      await crmApi.createDeal({ title: c.name, companyName: c.name, contactPhone: c.phone ?? undefined, contactEmail: c.email ?? undefined });
      setInCrm((prev) => new Set(prev).add(c.id));
      addToast('success', `${c.name} added to your CRM.`);
    } catch {
      addToast('error', 'Could not add to CRM.');
    }
  };

  const exportPage = () => {
    if (!result || !searched) return;
    exportToCSV(result.companies.map((c) => ({
      Company: c.name, Phone: c.phone ?? '', Email: c.email ?? '', Website: c.website ?? '',
      Address: c.address ?? '', City: c.city ?? '', State: c.state, ZIP: c.postcode ?? '',
    })), `${searched.segment}-${searched.city || searched.state}-p${page}`);
  };

  return (
    <>
      <HeaderDashboard title="Business Database" subtitle="U.S. businesses by industry, state and city." breadcrumb="Prospecting / Business Database" />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
        <form role="search" className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); void run(1, form); }}>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-muted">Industry *</span>
              <select required value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className={field}>
                <option value="">Select an industry</option>
                {segments.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted">State *</span>
              <select required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={field}>
                <option value="">Select</option>
                {US_STATES.filter((s) => /^[A-Z]{2}$/.test(s.value)).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted">City</span>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Whole state" className={field} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {([['hasPhone', 'With phone'], ['hasEmail', 'With e-mail'], ['hasWebsite', 'With website']] as const).map(([k, label]) => (
              <label key={k} className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} className="w-4 h-4 accent-violet-600" /> {label}
              </label>
            ))}
            <span className="text-xs text-muted sm:ml-auto">1 credit per new search · paging is free</span>
            <Button type="submit" variant="primary" className="h-10 px-6" disabled={loading || !form.segment || !form.state} icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>Search</Button>
          </div>
        </form>

        {error && <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
        {!result && !loading && !error && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            <Building2 size={28} className="mx-auto mb-2 opacity-60" aria-hidden /> Pick an industry and a state to start.
          </div>
        )}

        {result && searched && (
          <section aria-live="polite" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{result.total.toLocaleString('en-US')}{result.capped ? '+' : ''} businesses in {searched.city || searched.state}</p>
              <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportPage} disabled={!result.companies.length}>Export page (CSV)</Button>
            </div>
            {result.companies.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">No businesses match these filters. Try another city or fewer filters.</p>
            ) : (
              <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
                {result.companies.map((c) => {
                  const site = safeUrl(c.website);
                  return (
                    <li key={c.id} className="p-4 flex flex-col sm:flex-row gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-foreground">
                          <span className="inline-flex items-center gap-1.5 text-muted"><MapPin size={12} aria-hidden />{[c.address, c.city, c.state].filter(Boolean).join(', ')}</span>
                          {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone size={12} aria-hidden />{c.phone}</a>}
                          {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:underline break-all"><Mail size={12} aria-hidden />{c.email}</a>}
                          {site && <a href={site} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 hover:underline"><Globe size={12} aria-hidden />Website</a>}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" className="h-9 shrink-0" disabled={inCrm.has(c.id)} icon={inCrm.has(c.id) ? <Check size={14} /> : <Briefcase size={14} />} onClick={() => { void addToCrm(c); }}>
                        {inCrm.has(c.id) ? 'In CRM' : 'Add to CRM'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <nav className="flex items-center justify-between" aria-label="Pagination">
              <Button variant="secondary" size="sm" icon={<ChevronLeft size={14} />} disabled={page <= 1 || loading} onClick={() => { void run(page - 1, searched); }}>Previous</Button>
              <span className="text-xs text-muted">Page {page}</span>
              <Button variant="secondary" size="sm" disabled={loading || result.companies.length < PAGE_SIZE} onClick={() => { void run(page + 1, searched); }}>Next <ChevronRight size={14} className="ml-1" aria-hidden /></Button>
            </nav>
            <p className="text-xs text-muted">Business data © Overture Maps Foundation and contributors (overturemaps.org).</p>
          </section>
        )}
      </div>
    </>
  );
}
