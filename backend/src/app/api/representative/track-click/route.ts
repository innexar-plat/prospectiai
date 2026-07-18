import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { z } from 'zod';

const bodySchema = z.object({
  code: z.string().min(1).max(50),
});

/**
 * POST /api/representative/track-click
 * Public, unauthenticated — fired by the landing page when a `?rep=` link is opened.
 * Counts raw clicks (not unique visitors) toward the representative's funnel metrics.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const { success } = await rateLimit(`rep-click:${ip}`, 30, 60);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // updateMany (not update) because `status` isn't a unique key — this also means an
  // unknown/inactive code silently matches zero rows instead of throwing.
  await prisma.representative.updateMany({
    where: { id: parsed.data.code, status: 'ACTIVE' },
    data: { linkClicks: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
