import municipios from '@/lib/br-municipios.json';

// Bundled IBGE list (5.570 municípios) — the IBGE API is unreachable from the production server.
const BR_CITIES = municipios as Record<string, string[]>;

const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function suggestBrCities(state: string, q: string, limit = 20): string[] {
    const all = BR_CITIES[state] ?? [];
    if (q.length < 3) return all.slice(0, limit);
    const nq = fold(q);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const city of all) {
        const fc = fold(city);
        if (fc.startsWith(nq)) starts.push(city);
        else if (fc.includes(nq)) contains.push(city);
    }
    return [...starts, ...contains].slice(0, limit);
}
