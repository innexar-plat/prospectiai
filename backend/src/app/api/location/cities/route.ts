import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry } from '@/lib/fetch-http';
import { getCached, setCached } from '@/lib/redis';

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const CITY_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h

async function getCitiesByState(state: string): Promise<string[]> {
    const key = `cities:ibge:${state.toUpperCase()}`;
    const cached = await getCached<string[]>(key);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;

    const url = `${IBGE_BASE}/estados/${encodeURIComponent(state)}/municipios`;
    const res = await fetchWithRetry(url, { method: 'GET' }, { timeoutMs: 30000, maxRetries: 3 });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`IBGE cities error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as Array<{ nome?: string }>;
    const cities = data
        .map((row) => String(row.nome ?? '').trim())
        .filter((name) => name.length > 0)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (cities.length > 0) {
        setCached(key, cities, CITY_CACHE_TTL_SECONDS).catch(() => {
            // Cache is optional.
        });
    }

    return cities;
}

export async function GET(req: NextRequest) {
    try {
        const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
        const state = (req.nextUrl.searchParams.get('state') ?? '').trim().toUpperCase();
        const country = (req.nextUrl.searchParams.get('country') ?? 'BR').trim().toUpperCase();

        if (!state) {
            return NextResponse.json({ error: 'state is required' }, { status: 400 });
        }

        if (country !== 'BR') {
            return NextResponse.json({ cities: [] });
        }

        const allCities = await getCitiesByState(state);
        if (q.length < 3) {
            return NextResponse.json({ cities: allCities.slice(0, 20) });
        }

        const normalizedQ = q.toLocaleLowerCase('pt-BR');
        const filtered = allCities
            .filter((city) => city.toLocaleLowerCase('pt-BR').includes(normalizedQ))
            .slice(0, 20);

        return NextResponse.json({ cities: filtered });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('City autocomplete error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
