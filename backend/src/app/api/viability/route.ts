import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { planHasModule, type ProductPlan } from '@/lib/product-modules';
import { runViabilityAnalysis } from '@/modules/viability';
import type { ViabilityMode } from '@/modules/viability/domain/types';
import { z } from 'zod';

const viabilityModeEnum = z.enum(['new_business', 'expand', 'my_business']);

const viabilitySchema = z.object({
    mode: viabilityModeEnum,
    businessType: z.string().min(2).max(200).optional(),
    city: z.string().min(2).max(200),
    state: z.string().max(100).optional(),
}).refine(
    (data) => data.mode === 'my_business' || (typeof data.businessType === 'string' && data.businessType.length >= 2),
    { message: 'businessType is required when mode is new_business or expand', path: ['businessType'] }
);

export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const { success } = await rateLimit(`viability:${ip}`, 10, 60);
        if (!success) {
            return jsonWithRequestId({ error: 'Too many requests. Try again later.' }, { status: 429, requestId });
        }

        const body = await req.json();
        const parsed = viabilitySchema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400, requestId });
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
                companyName: true,
                productService: true,
            },
        });
        const plan: ProductPlan = user?.workspaces?.[0]?.workspace?.plan ?? (user?.plan as ProductPlan) ?? 'FREE';

        // Only SCALE plan can use viability — use RELATORIOS module as closest match
        if (!planHasModule(plan, 'INTELIGENCIA_MERCADO')) {
            return jsonWithRequestId(
                { error: 'Viability analysis is only available on Scale plan. Upgrade to access.' },
                { status: 403, requestId }
            );
        }

        let businessType: string;
        const mode: ViabilityMode = parsed.data.mode;

        if (mode === 'my_business') {
            const parts = [user?.companyName, user?.productService].filter((s): s is string => Boolean(s?.trim()));
            businessType = parts.length > 0 ? parts.join(' — ') : '';
            if (!businessType.trim()) {
                return jsonWithRequestId(
                    { error: 'Complete seu perfil (empresa/serviço) para usar esta análise. Acesse Configurações ou Perfil.' },
                    { status: 400, requestId }
                );
            }
        } else {
            businessType = parsed.data.businessType as string;
        }

        const input = {
            mode,
            businessType,
            city: parsed.data.city,
            state: parsed.data.state,
        };

        const result = await runViabilityAnalysis(input, session.user.id);
        return jsonWithRequestId(result, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Viability error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
