import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { searchSchema, formatZodError } from '@/lib/validations/schemas';
import { planHasModule, type ProductPlan } from '@/lib/product-modules';
import { runCompetitorAnalysis, SearchHttpError } from '@/modules/competitors';

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success } = await rateLimit(`competitors:${ip}`, 15, 60);
    if (!success) {
      return jsonWithRequestId({ error: 'Too many requests. Try again later.' }, { status: 429, requestId });
    }

    const body = await req.json();
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        workspaces: { include: { workspace: { select: { plan: true } } }, take: 1 },
        plan: true,
      },
    });
    const plan: ProductPlan = user?.workspaces?.[0]?.workspace?.plan ?? (user?.plan as ProductPlan) ?? 'FREE';
    if (!planHasModule(plan, 'ANALISE_CONCORRENCIA')) {
      return jsonWithRequestId(
        { error: 'Competitor analysis is not available on your plan. Upgrade to PRO or higher.' },
        { status: 403, requestId }
      );
    }

    const result = await runCompetitorAnalysis(parsed.data, session.user.id);
    return jsonWithRequestId(result, { requestId });
  } catch (err) {
    if (err instanceof SearchHttpError) {
      return jsonWithRequestId(err.body, { status: err.status, requestId });
    }
    const { logger } = await import('@/lib/logger');
    logger.error('Competitors error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
    return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
  }
}
