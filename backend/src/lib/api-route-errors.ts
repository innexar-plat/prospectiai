import { Prisma } from '@prisma/client';
import type { Market } from '@/lib/market';

export type ClassifiedRouteError = {
    status: number;
    message: string;
};

const US_MESSAGES = {
    rateLimit: 'Usage limit reached. Please try again in a few minutes.',
    timeout: 'The operation took too long. Please try again shortly.',
    aiUnavailable: 'AI service is temporarily unavailable. Please try again shortly.',
    serviceUnavailable: 'Service temporarily unavailable. Please try again.',
} as const;

const BR_MESSAGES = {
    rateLimit: 'Limite de uso atingido. Tente novamente em alguns minutos.',
    timeout: 'A operação demorou demais. Tente novamente em instantes.',
    aiUnavailable: 'Serviço de IA temporariamente indisponível. Tente novamente em instantes.',
    serviceUnavailable: 'Serviço temporariamente indisponível. Tente novamente.',
} as const;

const ROUTE_FALLBACKS = {
    viability: {
        US: 'Unable to complete viability analysis. Please try again.',
        BR: 'Não foi possível concluir a análise de viabilidade. Tente novamente.',
    },
    companyAnalysis: {
        US: 'Unable to complete company analysis. Please try again.',
        BR: 'Não foi possível concluir a análise da empresa. Tente novamente.',
    },
    viabilityProfileIncomplete: {
        US: 'Complete your profile (company/service) to use this analysis. Go to Settings or Profile.',
        BR: 'Complete seu perfil (empresa/serviço) para usar esta análise. Acesse Configurações ou Perfil.',
    },
} as const;

export type RouteFallbackKey = keyof typeof ROUTE_FALLBACKS;

export function getRouteFallbackMessage(key: RouteFallbackKey, market?: Market): string {
    return ROUTE_FALLBACKS[key][market === 'US' ? 'US' : 'BR'];
}

function routeMessages(market?: Market) {
    return market === 'US' ? US_MESSAGES : BR_MESSAGES;
}

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}

/** Map known infra/AI failures to appropriate HTTP status + user-safe message. */
export function classifyRouteError(
    err: unknown,
    fallbackMessage = 'Internal Server Error',
    market?: Market,
): ClassifiedRouteError {
    const messages = routeMessages(market);
    const msg = getErrorMessage(err).toLowerCase();

    if (
        msg.includes('too many requests')
        || msg.includes('rate limit')
        || msg.includes('429')
        || msg.includes('quota')
    ) {
        return {
            status: 503,
            message: messages.rateLimit,
        };
    }

    if (
        msg.includes('timeout')
        || msg.includes('aborted')
        || msg.includes('aborterror')
        || msg.includes('timed out')
        || msg.includes('bulkhead')
    ) {
        return {
            status: 503,
            message: messages.timeout,
        };
    }

    if (
        msg.includes('cloudflare ai error')
        || msg.includes('empty response from cloudflare')
        || msg.includes('no available ai model')
        || msg.includes(' 520')
        || msg.includes('error 520')
    ) {
        return {
            status: 503,
            message: messages.aiUnavailable,
        };
    }

    if (err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientRustPanicError) {
        return { status: 503, message: messages.serviceUnavailable };
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (['P1001', 'P1002', 'P1017'].includes(err.code)) {
            return { status: 503, message: messages.serviceUnavailable };
        }
    }

    if (msg.includes("can't reach database") || msg.includes('econnrefused') || msg.includes('connection')) {
        return { status: 503, message: messages.serviceUnavailable };
    }

    return { status: 500, message: fallbackMessage };
}
