import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

function normalizeCnpj(value: string): string {
    return value.replace(/\D/g, '').slice(0, 14);
}

export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    const session = await auth();
    if (!session?.user?.id) {
        return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }

    const { success } = await rateLimit(`workspace-profile-cnpj:${session.user.id}`, 30, 60);
    if (!success) {
        return jsonWithRequestId({ error: 'Too many requests. Try again later.' }, { status: 429, requestId });
    }

    const cnpj = normalizeCnpj(req.nextUrl.searchParams.get('cnpj') ?? '');
    if (cnpj.length !== 14) {
        return jsonWithRequestId({ error: 'CNPJ inválido.' }, { status: 400, requestId });
    }

    const company = await prisma.rfCompany.findUnique({
        where: { cnpj },
        select: {
            cnpj: true,
            razaoSocial: true,
            nomeFantasia: true,
            cnaePrincipal: true,
            uf: true,
            municipio: true,
            cep: true,
            bairro: true,
            logradouro: true,
            numero: true,
            porte: true,
            dataAbertura: true,
        },
    });

    if (!company) {
        return jsonWithRequestId({ error: 'CNPJ não encontrado na base enriquecida.' }, { status: 404, requestId });
    }

    const cnae = company.cnaePrincipal
        ? await prisma.cnaeCode.findUnique({ where: { code: company.cnaePrincipal }, select: { description: true } })
        : null;

    return jsonWithRequestId({
        cnpj: company.cnpj,
        legalName: company.razaoSocial,
        tradeName: company.nomeFantasia ?? null,
        primaryCnaeCode: company.cnaePrincipal ?? null,
        primaryCnaeDescription: cnae?.description ?? null,
        companySize: company.porte ?? null,
        foundingDate: company.dataAbertura ?? null,
        postalCode: company.cep ?? null,
        street: company.logradouro ?? null,
        number: company.numero ?? null,
        neighborhood: company.bairro ?? null,
        city: company.municipio ?? null,
        state: company.uf ?? null,
        address: [company.logradouro, company.numero, company.bairro, company.municipio, company.uf].filter(Boolean).join(', ') || null,
    }, { requestId });
}