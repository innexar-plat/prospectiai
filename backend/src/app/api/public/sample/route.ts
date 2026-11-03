import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/ratelimit';
import { SAMPLE_SEGMENTS, SampleError, requestSample } from '@/lib/sample-list';

const bodySchema = z.object({
    token: z.string().max(80).optional().nullable(),
    email: z.string().max(200).optional().nullable(),
    segment: z.string().min(1).max(60),
    city: z.string().trim().min(2).max(80),
    uf: z.string().trim().length(2),
});

/** GET /api/public/sample — segments available for the free sample. */
export async function GET() {
    return NextResponse.json({ segments: SAMPLE_SEGMENTS.map(({ slug, name }) => ({ slug, name })) });
}

/** POST /api/public/sample — free 20-company sample (no login; rate limited per IP and e-mail). */
export async function POST(req: NextRequest) {
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const rl = await rateLimit(`public-sample:${ip ?? 'unknown'}`, 10, 60 * 60);
    if (!rl.success) return NextResponse.json({ error: 'Muitas solicitações. Tente mais tarde.' }, { status: 429 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    try {
        return NextResponse.json(await requestSample({ ...parsed.data, ip }));
    } catch (error) {
        if (error instanceof SampleError) return NextResponse.json({ error: error.message }, { status: error.status });
        const { logger } = await import('@/lib/logger');
        logger.error('Public sample failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Não foi possível gerar a amostra agora.' }, { status: 500 });
    }
}
