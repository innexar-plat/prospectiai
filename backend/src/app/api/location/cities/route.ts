import { NextRequest, NextResponse } from 'next/server';
import { getUsCitySuggestions } from '@/lib/us-city-suggestions';
import { suggestBrCities } from '@/lib/br-cities';

export async function GET(req: NextRequest) {
    try {
        const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
        const state = (req.nextUrl.searchParams.get('state') ?? '').trim().toUpperCase();
        const country = (req.nextUrl.searchParams.get('country') ?? 'BR').trim().toUpperCase();

        if (!state) {
            return NextResponse.json({ error: 'state is required' }, { status: 400 });
        }

        if (country === 'US') {
            const minQueryLen = 2;
            if (q.length < minQueryLen) {
                return NextResponse.json({ cities: [] });
            }
            const cities = await getUsCitySuggestions(state, q);
            return NextResponse.json({ cities });
        }

        if (country !== 'BR') {
            return NextResponse.json({ cities: [] });
        }

        return NextResponse.json({ cities: suggestBrCities(state, q) });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('City autocomplete error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
