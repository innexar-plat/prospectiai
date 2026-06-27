import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { planHasModule, type ProductPlan } from '@/lib/product-modules';
import { runViabilityAnalysis } from '@/modules/viability';
import type { ViabilityMode } from '@/modules/viability/domain/types';
import { classifyRouteError, getRouteFallbackMessage } from '@/lib/api-route-errors';
import { getRequestMarket } from '@/lib/market';
import { resolveAiRequestLocale } from '@/lib/i18n/locale';
import { z } from 'zod';

const viabilityModeEnum = z.enum(['new_business', 'expand', 'my_business']);

const WORKSPACE_SELECT = {
    plan: true,
    companyName: true,
    legalName: true,
    tradeName: true,
    cnpj: true,
    primaryCnaeCode: true,
    primaryCnaeDescription: true,
    companySize: true,
    foundingDate: true,
    productService: true,
    targetAudience: true,
    mainBenefit: true,
    city: true,
    state: true,
    serviceModel: true,
    averageTicket: true,
    operationRadiusKm: true,
    knownCompetitors: true,
} as const;

const viabilitySchema = z.object({
    mode: viabilityModeEnum,
    businessType: z.string().min(2).max(200).optional(),
    city: z.string().min(2).max(200),
    state: z.string().max(100).optional(),
    country: z.string().max(10).optional(),
    locale: z.enum(['pt', 'en', 'es']).optional(),
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

        const body = await req.json().catch(() => null);
        if (body === null) {
            return jsonWithRequestId({ error: 'Invalid JSON body' }, { status: 400, requestId });
        }
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
                workspaces: { include: { workspace: { select: WORKSPACE_SELECT } }, take: 1 },
                plan: true,
                companyName: true,
                productService: true,
            },
        });
        const plan: ProductPlan = user?.workspaces?.[0]?.workspace?.plan ?? (user?.plan as ProductPlan) ?? 'FREE';
        const workspace = user?.workspaces?.[0]?.workspace;

        // Only SCALE plan can use viability — use RELATORIOS module as closest match
        if (!planHasModule(plan, 'INTELIGENCIA_MERCADO')) {
            return jsonWithRequestId(
                { error: 'Viability analysis is only available on Scale plan. Upgrade to access.' },
                { status: 403, requestId }
            );
        }

        let businessType: string;
        const mode: ViabilityMode = parsed.data.mode;
        const requestedCity = parsed.data.city.trim();
        const requestedState = parsed.data.state?.trim() || undefined;

        const businessContext = workspace
            ? {
                companyName: workspace.companyName ?? undefined,
                legalName: workspace.legalName ?? undefined,
                tradeName: workspace.tradeName ?? undefined,
                cnpj: workspace.cnpj ?? undefined,
                primaryCnaeCode: workspace.primaryCnaeCode ?? undefined,
                primaryCnaeDescription: workspace.primaryCnaeDescription ?? undefined,
                companySize: workspace.companySize ?? undefined,
                foundingDate: workspace.foundingDate ?? undefined,
                targetAudience: workspace.targetAudience ?? undefined,
                mainBenefit: workspace.mainBenefit ?? undefined,
                serviceModel: workspace.serviceModel ?? undefined,
                averageTicket: workspace.averageTicket ?? undefined,
                operationRadiusKm: workspace.operationRadiusKm ?? undefined,
                knownCompetitors: workspace.knownCompetitors ?? undefined,
            }
            : undefined;

        if (mode === 'my_business') {
            const parts = [workspace?.tradeName, workspace?.companyName ?? user?.companyName, workspace?.productService ?? user?.productService, workspace?.primaryCnaeDescription].filter((s): s is string => Boolean(s?.trim()));
            businessType = parts.length > 0 ? parts.join(' — ') : '';
            if (!businessType.trim()) {
                const market = getRequestMarket(req);
                return jsonWithRequestId(
                    { error: getRouteFallbackMessage('viabilityProfileIncomplete', market) },
                    { status: 400, requestId }
                );
            }
        } else {
            businessType = parsed.data.businessType as string;
        }

        const input = {
            mode,
            businessType,
            city: requestedCity,
            state: requestedState,
            country: parsed.data.country?.trim() || undefined,
            locale: parsed.data.locale,
            businessContext,
        };

        const locale = resolveAiRequestLocale(req, parsed.data.locale);
        const result = await runViabilityAnalysis({ ...input, locale }, session.user.id, locale);
        return jsonWithRequestId(result, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        const market = getRequestMarket(req);
        const classified = classifyRouteError(err, getRouteFallbackMessage('viability', market), market);
        logger.error('Viability error', { error: err instanceof Error ? err.message : 'Unknown', status: classified.status }, requestId);
        return jsonWithRequestId({ error: classified.message }, { status: classified.status, requestId });
    }
}
