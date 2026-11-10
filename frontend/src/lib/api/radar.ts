import { request } from './_request';

export interface RadarCompany {
    cnpj: string;
    name: string;
    bairro: string | null;
    openedAt: string | null;
    porte: string | null;
    phone: string | null;
    email: string | null;
}

export interface RadarItem { niche: string; city: string | null; state: string | null; total: number; companies: RadarCompany[] }
export interface Radar { since: string | null; items: RadarItem[]; generatedAt: string }

export interface SearchIntent { term: string; city: string | null; state: string | null; otherStates: string[]; understood: boolean }

export interface FirstTouch { source?: string | null; medium?: string | null; campaign?: string | null; referrer?: string | null; landing?: string | null; at?: string | null }

export const radarApi = {
    get: (fresh = false) => request<Radar>(`/radar${fresh ? '?fresh=1' : ''}`),
    /** "lojas de eletrônicos em Florianópolis SC" → { term, city, state }. */
    parseSearch: (q: string, state?: string | null) => {
        const qs = new URLSearchParams({ q });
        if (state && state !== 'Todos') qs.set('state', state);
        return request<SearchIntent>(`/search/parse?${qs.toString()}`);
    },
    saveAttribution: (data: { firstTouch?: FirstTouch | null; heardFrom?: string | null; heardFromOther?: string | null }) =>
        request<{ ok: boolean }>('/user/attribution', { method: 'POST', body: JSON.stringify(data) }),
};
