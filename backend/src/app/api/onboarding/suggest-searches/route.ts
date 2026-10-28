import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { suggestSearchTerms } from '@/lib/search-suggestions';

const schema = z.object({
    productService: z.string().max(300).optional(),
    targetAudience: z.string().max(300).optional(),
    locale: z.enum(['pt', 'en']).optional(),
});

/**
 * POST /api/onboarding/suggest-searches — concrete niches to prospect, from the seller profile.
 * Falls back to the saved workspace profile when the body is empty (used by the dashboard too).
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { success } = await rateLimit(`suggest-searches:${session.user.id}`, 10, 60);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    let { productService, targetAudience } = parsed.data;

    if (!productService && !targetAudience) {
        const member = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'asc' },
            select: { workspace: { select: { productService: true, targetAudience: true } } },
        });
        productService = member?.workspace.productService ?? undefined;
        targetAudience = member?.workspace.targetAudience ?? undefined;
    }

    const terms = await suggestSearchTerms({ productService, targetAudience, locale: parsed.data.locale });
    return NextResponse.json({ terms });
}
