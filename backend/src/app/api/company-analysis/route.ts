import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { planHasModule, type ProductPlan } from '@/lib/product-modules';
import { companyAnalysisSchema } from '@/lib/validations/schemas';
import { runCompanyAnalysis } from '@/modules/company-analysis';
import { classifyRouteError, getRouteFallbackMessage } from '@/lib/api-route-errors';
import { getRequestMarket, resolveAnalysisMarket, resolveSearchCountry } from '@/lib/market';
import { resolveMarketForUser } from '@/lib/user-market';
import { resolveAiRequestLocale } from '@/lib/i18n/locale';

const WORKSPACE_SELECT = {
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
    address: true,
    postalCode: true,
    neighborhood: true,
    city: true,
    state: true,
    linkedInUrl: true,
    instagramUrl: true,
    facebookUrl: true,
    websiteUrl: true,
    serviceModel: true,
    averageTicket: true,
    operationRadiusKm: true,
    knownCompetitors: true,
} as const;

type WorkspaceForAnalysis = { companyName: string | null; legalName: string | null; tradeName: string | null; cnpj: string | null; primaryCnaeCode: string | null; primaryCnaeDescription: string | null; companySize: string | null; foundingDate: string | null; productService: string | null; targetAudience: string | null; mainBenefit: string | null; address: string | null; postalCode: string | null; neighborhood: string | null; city: string | null; state: string | null; linkedInUrl: string | null; instagramUrl: string | null; facebookUrl: string | null; websiteUrl: string | null; serviceModel: string | null; averageTicket: number | null; operationRadiusKm: number | null; knownCompetitors: string | null };
type BodyForAnalysis = { useProfile?: boolean; companyName?: string; legalName?: string; tradeName?: string; cnpj?: string; city?: string; state?: string; country?: string; locale?: 'pt' | 'en' | 'es'; postalCode?: string; neighborhood?: string; primaryCnaeCode?: string; primaryCnaeDescription?: string; companySize?: string; foundingDate?: string; productService?: string; targetAudience?: string; mainBenefit?: string; address?: string; websiteUrl?: string; linkedInUrl?: string; instagramUrl?: string; facebookUrl?: string; serviceModel?: string; averageTicket?: number; operationRadiusKm?: number; knownCompetitors?: string };

function buildAnalysisInput(useProfile: boolean, data: BodyForAnalysis, w: WorkspaceForAnalysis) {
    if (useProfile) {
        return {
            companyName: (data.companyName ?? w.companyName ?? '').trim(),
            legalName: w.legalName ?? undefined,
            tradeName: w.tradeName ?? undefined,
            cnpj: w.cnpj ?? undefined,
            primaryCnaeCode: w.primaryCnaeCode ?? undefined,
            primaryCnaeDescription: w.primaryCnaeDescription ?? undefined,
            companySize: w.companySize ?? undefined,
            foundingDate: w.foundingDate ?? undefined,
            productService: w.productService ?? undefined,
            targetAudience: w.targetAudience ?? undefined,
            mainBenefit: w.mainBenefit ?? undefined,
            address: w.address ?? undefined,
            postalCode: w.postalCode ?? undefined,
            neighborhood: w.neighborhood ?? undefined,
            websiteUrl: w.websiteUrl ?? undefined,
            linkedInUrl: w.linkedInUrl ?? undefined,
            instagramUrl: w.instagramUrl ?? undefined,
            facebookUrl: w.facebookUrl ?? undefined,
            city: data.city ?? w.city ?? undefined,
            state: data.state ?? w.state ?? undefined,
            serviceModel: w.serviceModel ?? undefined,
            averageTicket: w.averageTicket ?? undefined,
            operationRadiusKm: w.operationRadiusKm ?? undefined,
            knownCompetitors: w.knownCompetitors ?? undefined,
        };
    }
    return {
        companyName: (data.companyName ?? '').trim(),
        legalName: data.legalName,
        tradeName: data.tradeName,
        cnpj: data.cnpj,
        primaryCnaeCode: data.primaryCnaeCode,
        primaryCnaeDescription: data.primaryCnaeDescription,
        companySize: data.companySize,
        foundingDate: data.foundingDate,
        productService: data.productService,
        targetAudience: data.targetAudience,
        mainBenefit: data.mainBenefit,
        address: data.address,
        postalCode: data.postalCode,
        neighborhood: data.neighborhood,
        websiteUrl: data.websiteUrl,
        linkedInUrl: data.linkedInUrl,
        instagramUrl: data.instagramUrl,
        facebookUrl: data.facebookUrl,
        city: data.city,
        state: data.state,
        serviceModel: data.serviceModel,
        averageTicket: data.averageTicket,
        operationRadiusKm: data.operationRadiusKm,
        knownCompetitors: data.knownCompetitors,
    };
}

export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const { success } = await rateLimit(`company-analysis:${ip}`, 10, 60);
        if (!success) {
            return jsonWithRequestId(
                { error: 'Too many requests. Try again later.' },
                { status: 429, requestId }
            );
        }

        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            include: { workspace: { select: { ...WORKSPACE_SELECT, plan: true } } },
        });
        if (!membership?.workspace) {
            return jsonWithRequestId({ error: 'Workspace not found' }, { status: 404, requestId });
        }

        const plan: ProductPlan = membership.workspace.plan as ProductPlan;
        if (!planHasModule(plan, 'ANALISE_MINHA_EMPRESA')) {
            return jsonWithRequestId(
                { error: 'Análise da minha empresa está disponível nos planos Business e Enterprise. Faça upgrade para acessar.' },
                { status: 403, requestId }
            );
        }

        const body = await req.json().catch(() => ({}));
        const parsed = companyAnalysisSchema.safeParse(body);
        type Body = z.infer<typeof companyAnalysisSchema>;
        const defaultBody: Body = {
            useProfile: true,
            companyName: undefined,
            city: undefined,
            state: undefined,
            country: undefined,
            locale: undefined,
            postalCode: undefined,
            neighborhood: undefined,
            legalName: undefined,
            tradeName: undefined,
            cnpj: undefined,
            primaryCnaeCode: undefined,
            primaryCnaeDescription: undefined,
            companySize: undefined,
            foundingDate: undefined,
            productService: undefined,
            targetAudience: undefined,
            mainBenefit: undefined,
            address: undefined,
            websiteUrl: undefined,
            linkedInUrl: undefined,
            instagramUrl: undefined,
            facebookUrl: undefined,
            serviceModel: undefined,
            averageTicket: undefined,
            operationRadiusKm: undefined,
            knownCompetitors: undefined,
        };
        const data: Body = parsed.success ? parsed.data : defaultBody;

        const w = membership.workspace as WorkspaceForAnalysis;
        const useProfile = data.useProfile !== false;

        const companyNameForValidation = useProfile ? (data.companyName ?? w.companyName ?? '').trim() : (data.companyName ?? '').trim();
        if (!companyNameForValidation) {
            const msg = useProfile
                ? 'Preencha o nome da empresa no Perfil da empresa (Configurações > Empresa) ou envie companyName no corpo da requisição.'
                : 'No modo "Pesquisar", informe o nome da empresa (companyName) no corpo da requisição.';
            return jsonWithRequestId({ error: msg }, { status: 400, requestId });
        }

        const input = buildAnalysisInput(useProfile, data, w);
        const userMarket = await resolveMarketForUser(session.user.id);
        const resolvedCountry = resolveSearchCountry(req, data.country);
        const market = resolveAnalysisMarket(req, resolvedCountry, userMarket);
        const locale = resolveAiRequestLocale(req, data.locale);
        const result = await runCompanyAnalysis({ ...input, country: resolvedCountry }, session.user.id, market, locale);
        return jsonWithRequestId(result, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        const market = getRequestMarket(req);
        const classified = classifyRouteError(err, getRouteFallbackMessage('companyAnalysis', market), market);
        logger.error('Company analysis error', {
            error: err instanceof Error ? err.message : 'Unknown',
            status: classified.status,
        }, requestId);
        return jsonWithRequestId({ error: classified.message }, { status: classified.status, requestId });
    }
}
