import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { planHasModule, type ProductPlan } from '@/lib/product-modules';
import { companyAnalysisSchema } from '@/lib/validations/schemas';
import { runCompanyAnalysis } from '@/modules/company-analysis';

const WORKSPACE_SELECT = {
    companyName: true,
    productService: true,
    targetAudience: true,
    mainBenefit: true,
    address: true,
    linkedInUrl: true,
    instagramUrl: true,
    facebookUrl: true,
    websiteUrl: true,
} as const;

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
            productService: undefined,
            targetAudience: undefined,
            mainBenefit: undefined,
            address: undefined,
            websiteUrl: undefined,
            linkedInUrl: undefined,
            instagramUrl: undefined,
            facebookUrl: undefined,
        };
        const data: Body = parsed.success ? parsed.data : defaultBody;

        const w = membership.workspace;
        const useProfile = data.useProfile !== false;

        if (useProfile) {
            const companyName = (data.companyName ?? w.companyName ?? '').trim();
            if (!companyName) {
                return jsonWithRequestId(
                    { error: 'Preencha o nome da empresa no Perfil da empresa (Configurações > Empresa) ou envie companyName no corpo da requisição.' },
                    { status: 400, requestId }
                );
            }
        } else {
            const companyName = (data.companyName ?? '').trim();
            if (!companyName) {
                return jsonWithRequestId(
                    { error: 'No modo "Pesquisar", informe o nome da empresa (companyName) no corpo da requisição.' },
                    { status: 400, requestId }
                );
            }
        }

        const input = useProfile
            ? {
                  companyName: (data.companyName ?? w.companyName ?? '').trim(),
                  productService: w.productService ?? undefined,
                  targetAudience: w.targetAudience ?? undefined,
                  mainBenefit: w.mainBenefit ?? undefined,
                  address: w.address ?? undefined,
                  websiteUrl: w.websiteUrl ?? undefined,
                  linkedInUrl: w.linkedInUrl ?? undefined,
                  instagramUrl: w.instagramUrl ?? undefined,
                  facebookUrl: w.facebookUrl ?? undefined,
                  city: data.city,
                  state: data.state,
              }
            : {
                  companyName: (data.companyName ?? '').trim(),
                  productService: data.productService,
                  targetAudience: data.targetAudience,
                  mainBenefit: data.mainBenefit,
                  address: data.address,
                  websiteUrl: data.websiteUrl,
                  linkedInUrl: data.linkedInUrl,
                  instagramUrl: data.instagramUrl,
                  facebookUrl: data.facebookUrl,
                  city: data.city,
                  state: data.state,
              };

        const result = await runCompanyAnalysis(input, session.user.id);
        return jsonWithRequestId(result, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Company analysis error', {
            error: err instanceof Error ? err.message : 'Unknown',
        }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
