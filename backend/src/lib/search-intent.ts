/**
 * Understands a free-text search ("lojas de eletrônicos em Florianópolis SC", "clínicas em
 * Santa Catarina") and splits it into niche + city + state. Deterministic and instant: matches
 * against the bundled IBGE city list and the state names — no AI call, no external API.
 */
import { BR_CITIES, fold } from '@/lib/br-cities';

export const BR_STATES: Record<string, string> = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
    ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
    MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
    RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
    SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

export interface SearchIntent {
    /** What to look for, location removed ("lojas de eletrônicos"). */
    term: string;
    city: string | null;
    state: string | null;
    /** Other states that have a city with the same name, when the state was guessed. */
    otherStates: string[];
    /** True when anything was recognised. */
    understood: boolean;
}

interface CityEntry { name: string; uf: string }

let cityIndex: Map<string, CityEntry[]> | null = null;
let maxCityWords = 1;

function getCityIndex(): Map<string, CityEntry[]> {
    if (cityIndex) return cityIndex;
    cityIndex = new Map();
    for (const [uf, cities] of Object.entries(BR_CITIES)) {
        for (const name of cities) {
            const key = normalize(name);
            maxCityWords = Math.max(maxCityWords, key.split(' ').length);
            const list = cityIndex.get(key) ?? [];
            list.push({ name, uf });
            cityIndex.set(key, list);
        }
    }
    return cityIndex;
}

const stateByName = new Map(Object.entries(BR_STATES).map(([uf, name]) => [normalize(name), uf]));

function normalize(s: string): string {
    return fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Words that introduce a location: "em", "no", "na", "de" only when followed by a known place. */
const LOCATION_PREPS = new Set(['em', 'no', 'na', 'nos', 'nas', 'para', 'perto', 'regiao', 'cidade', 'de', 'do', 'da']);
const TRAILING_NOISE = new Set(['em', 'no', 'na', 'nos', 'nas', 'de', 'do', 'da', 'para', 'perto', 'regiao', 'cidade', 'e', 'estado']);

function findState(words: string[], at: number): { uf: string; len: number } | null {
    // Full state name (up to 4 words: "rio grande do norte") or the 2-letter code.
    for (let len = Math.min(4, words.length - at); len >= 1; len--) {
        const uf = stateByName.get(words.slice(at, at + len).join(' '));
        if (uf) return { uf, len };
    }
    const code = words[at]?.toUpperCase();
    if (code && code.length === 2 && BR_STATES[code]) return { uf: code, len: 1 };
    return null;
}

function findCity(words: string[], at: number): { entries: CityEntry[]; len: number } | null {
    const index = getCityIndex();
    for (let len = Math.min(maxCityWords, words.length - at); len >= 1; len--) {
        const entries = index.get(words.slice(at, at + len).join(' '));
        if (entries) return { entries, len };
    }
    return null;
}

export function parseSearchIntent(text: string, preferredState?: string | null): SearchIntent {
    const raw = text.trim();
    // Same tokens in two forms, so the term keeps the user's own spelling.
    const original = raw.match(/[\p{L}\p{N}]+/gu) ?? [];
    const words = original.map(normalize);
    const empty: SearchIntent = { term: raw, city: null, state: null, otherStates: [], understood: false };
    if (words.length === 0) return empty;

    /** A 2-letter state code only counts when written in capitals or right after a preposition. */
    const stateAt = (i: number, prevIsPrep: boolean): { uf: string; len: number } | null => {
        const st = findState(words, i);
        if (!st) return null;
        if (st.len === 1 && words[i]!.length === 2 && !prevIsPrep && original[i] !== original[i]!.toUpperCase()) return null;
        return st;
    };

    // The location is the longest run of place words that closes the text: scanning from the
    // start, the first index that yields one wins ("santa catarina" beats the city "Catarina",
    // "florianopolis sc" beats a bare "sc"). At the same index a city beats a state name.
    let best: { start: number; city: CityEntry[] | null; uf: string | null } | null = null;
    for (let i = 0; i < words.length && !best; i++) {
        const prevIsPrep = i > 0 && LOCATION_PREPS.has(words[i - 1]!);
        const city = findCity(words, i);
        if (city) {
            const after = i + city.len;
            const st = after < words.length ? stateAt(after, true) : null;
            const reachesEnd = after + (st?.len ?? 0) === words.length;
            const confident = prevIsPrep || st !== null || city.len >= 2 || i === 0 || words[i]!.length >= 5;
            if (reachesEnd && confident) {
                best = { start: i, city: city.entries, uf: st?.uf ?? null };
                break;
            }
        }
        const st = stateAt(i, prevIsPrep);
        if (st && i + st.len === words.length) best = { start: i, city: null, uf: st.uf };
    }
    if (!best) return empty;

    let city: string | null = null;
    let state: string | null = best.uf;
    let otherStates: string[] = [];
    if (best.city) {
        const inState = state ? best.city.find((c) => c.uf === state) : undefined;
        const preferred = !state && preferredState ? best.city.find((c) => c.uf === preferredState) : undefined;
        const pick = inState ?? preferred ?? best.city[0]!;
        if (!state) {
            city = pick.name;
            state = pick.uf;
            otherStates = best.city.filter((c) => c.uf !== pick.uf).map((c) => c.uf);
        } else if (inState) {
            city = inState.name;
        }
        // "<city> <UF>" where that city is not in that UF: trust the UF, drop the city.
    }

    let end = best.start;
    while (end > 0 && TRAILING_NOISE.has(words[end - 1]!)) end--;
    return { term: original.slice(0, end).join(' '), city, state, otherStates, understood: true };
}
