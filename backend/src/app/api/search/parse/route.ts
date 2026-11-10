import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { parseSearchIntent } from '@/lib/search-intent';

/**
 * GET /api/search/parse?q=<free text>&state=<UF preferred for ambiguous names>
 * "lojas de eletrônicos em Florianópolis SC" → { term, city, state }. Instant, no AI.
 */
export async function GET(req: NextRequest) {
    const session = await getApiSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 200);
    const state = req.nextUrl.searchParams.get('state')?.toUpperCase() ?? null;
    return NextResponse.json(parseSearchIntent(q, state && /^[A-Z]{2}$/.test(state) ? state : null));
}
