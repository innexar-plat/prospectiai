import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { getCached, setCached } from '@/lib/redis';
import { aiRuntimeUpdateSchema, formatZodError } from '@/lib/validations/schemas';
import { prisma } from '@/lib/prisma';

type RuntimeControls = {
    analyzeRateLimitMax: number;
    analyzeRateLimitWindowSeconds: number;
    analyzeBulkheadMaxInFlight: number;
    analyzeBulkheadAcquireTimeoutMs: number;
    aiModelMaxInFlight: number;
    analyzeAiMaxOutputTokens: number;
    aiCircuitBreakerFailureThreshold: number;
    aiCircuitBreakerOpenMs: number;
    aiFallbackProvider: 'GEMINI' | 'CLOUDFLARE' | 'OPENROUTER';
    aiCloudflareModelsLeadAnalysis: string;
    aiCloudflareModelsViability: string;
    aiCloudflareModelsCompanyAnalysis: string;
};

const RUNTIME_CONTROLS_CACHE_KEY = 'admin:ai:runtime-controls';
const RUNTIME_CONTROLS_TTL_SECONDS = 60 * 60 * 24 * 365;
const CONTROL_KEY = 'default';

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeFallbackProvider(value: string): RuntimeControls['aiFallbackProvider'] {
    const upper = value.toUpperCase();
    if (upper === 'CLOUDFLARE') return 'CLOUDFLARE';
    if (upper === 'OPENROUTER') return 'OPENROUTER';
    return 'GEMINI';
}

function getRuntimeControls(): RuntimeControls {
    const provider = (process.env.AI_FALLBACK_PROVIDER ?? 'GEMINI').toUpperCase();
    return {
        analyzeRateLimitMax: parsePositiveInt(process.env.ANALYZE_RATE_LIMIT_MAX, 15),
        analyzeRateLimitWindowSeconds: parsePositiveInt(process.env.ANALYZE_RATE_LIMIT_WINDOW_SECONDS, 60),
        analyzeBulkheadMaxInFlight: parsePositiveInt(process.env.ANALYZE_BULKHEAD_MAX_IN_FLIGHT, 12),
        analyzeBulkheadAcquireTimeoutMs: parsePositiveInt(process.env.ANALYZE_BULKHEAD_ACQUIRE_TIMEOUT_MS, 12000),
        aiModelMaxInFlight: parsePositiveInt(process.env.AI_MODEL_MAX_IN_FLIGHT, 4),
        analyzeAiMaxOutputTokens: parsePositiveInt(process.env.ANALYZE_AI_MAX_OUTPUT_TOKENS, 16384),
        aiCircuitBreakerFailureThreshold: parsePositiveInt(process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD, 3),
        aiCircuitBreakerOpenMs: parsePositiveInt(process.env.AI_CIRCUIT_BREAKER_OPEN_MS, 30000),
        aiFallbackProvider: normalizeFallbackProvider(provider),
        aiCloudflareModelsLeadAnalysis: process.env.AI_CLOUDFLARE_MODELS_LEAD_ANALYSIS ?? '',
        aiCloudflareModelsViability: process.env.AI_CLOUDFLARE_MODELS_VIABILITY ?? '',
        aiCloudflareModelsCompanyAnalysis: process.env.AI_CLOUDFLARE_MODELS_COMPANY_ANALYSIS ?? '',
    };
}

async function getRuntimeControlsMerged(): Promise<RuntimeControls> {
    const fromDb = await prisma.aiRuntimeConfig.findUnique({ where: { key: CONTROL_KEY } }).catch(() => null);
    if (fromDb) {
        return {
            analyzeRateLimitMax: fromDb.analyzeRateLimitMax,
            analyzeRateLimitWindowSeconds: fromDb.analyzeRateLimitWindowSeconds,
            analyzeBulkheadMaxInFlight: fromDb.analyzeBulkheadMaxInFlight,
            analyzeBulkheadAcquireTimeoutMs: fromDb.analyzeBulkheadAcquireTimeoutMs,
            aiModelMaxInFlight: fromDb.aiModelMaxInFlight,
            analyzeAiMaxOutputTokens: fromDb.analyzeAiMaxOutputTokens,
            aiCircuitBreakerFailureThreshold: fromDb.aiCircuitBreakerFailureThreshold,
            aiCircuitBreakerOpenMs: fromDb.aiCircuitBreakerOpenMs,
            aiFallbackProvider: normalizeFallbackProvider(fromDb.aiFallbackProvider),
            aiCloudflareModelsLeadAnalysis: fromDb.aiCloudflareModelsLeadAnalysis,
            aiCloudflareModelsViability: fromDb.aiCloudflareModelsViability,
            aiCloudflareModelsCompanyAnalysis: fromDb.aiCloudflareModelsCompanyAnalysis,
        };
    }

    const defaults = getRuntimeControls();
    await prisma.aiRuntimeConfig.upsert({
        where: { key: CONTROL_KEY },
        create: {
            key: CONTROL_KEY,
            analyzeRateLimitMax: defaults.analyzeRateLimitMax,
            analyzeRateLimitWindowSeconds: defaults.analyzeRateLimitWindowSeconds,
            analyzeBulkheadMaxInFlight: defaults.analyzeBulkheadMaxInFlight,
            analyzeBulkheadAcquireTimeoutMs: defaults.analyzeBulkheadAcquireTimeoutMs,
            aiModelMaxInFlight: defaults.aiModelMaxInFlight,
            analyzeAiMaxOutputTokens: defaults.analyzeAiMaxOutputTokens,
            aiCircuitBreakerFailureThreshold: defaults.aiCircuitBreakerFailureThreshold,
            aiCircuitBreakerOpenMs: defaults.aiCircuitBreakerOpenMs,
            aiFallbackProvider: defaults.aiFallbackProvider,
            aiCloudflareModelsLeadAnalysis: defaults.aiCloudflareModelsLeadAnalysis,
            aiCloudflareModelsViability: defaults.aiCloudflareModelsViability,
            aiCloudflareModelsCompanyAnalysis: defaults.aiCloudflareModelsCompanyAnalysis,
        },
        update: {},
    }).catch(() => {});

    const persisted = await getCached<RuntimeControls>(RUNTIME_CONTROLS_CACHE_KEY);
    if (!persisted) return defaults;
    return {
        ...defaults,
        ...persisted,
    };
}

function setStringEnv(name: string, value: string): void {
    process.env[name] = value.trim();
}

function setIntEnv(name: string, value: number): void {
    process.env[name] = String(Math.max(1, Math.floor(value)));
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ controls: await getRuntimeControlsMerged() });
}

export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const body = await req.json();
        const parsed = aiRuntimeUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const data = parsed.data;

        if (data.analyzeRateLimitMax !== undefined) setIntEnv('ANALYZE_RATE_LIMIT_MAX', data.analyzeRateLimitMax);
        if (data.analyzeRateLimitWindowSeconds !== undefined) setIntEnv('ANALYZE_RATE_LIMIT_WINDOW_SECONDS', data.analyzeRateLimitWindowSeconds);
        if (data.analyzeBulkheadMaxInFlight !== undefined) setIntEnv('ANALYZE_BULKHEAD_MAX_IN_FLIGHT', data.analyzeBulkheadMaxInFlight);
        if (data.analyzeBulkheadAcquireTimeoutMs !== undefined) setIntEnv('ANALYZE_BULKHEAD_ACQUIRE_TIMEOUT_MS', data.analyzeBulkheadAcquireTimeoutMs);
        if (data.aiModelMaxInFlight !== undefined) setIntEnv('AI_MODEL_MAX_IN_FLIGHT', data.aiModelMaxInFlight);
        if (data.analyzeAiMaxOutputTokens !== undefined) setIntEnv('ANALYZE_AI_MAX_OUTPUT_TOKENS', data.analyzeAiMaxOutputTokens);
        if (data.aiCircuitBreakerFailureThreshold !== undefined) setIntEnv('AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD', data.aiCircuitBreakerFailureThreshold);
        if (data.aiCircuitBreakerOpenMs !== undefined) setIntEnv('AI_CIRCUIT_BREAKER_OPEN_MS', data.aiCircuitBreakerOpenMs);

        if (data.aiFallbackProvider !== undefined) {
            setStringEnv('AI_FALLBACK_PROVIDER', data.aiFallbackProvider);
        }
        if (data.aiCloudflareModelsLeadAnalysis !== undefined) {
            setStringEnv('AI_CLOUDFLARE_MODELS_LEAD_ANALYSIS', data.aiCloudflareModelsLeadAnalysis);
        }
        if (data.aiCloudflareModelsViability !== undefined) {
            setStringEnv('AI_CLOUDFLARE_MODELS_VIABILITY', data.aiCloudflareModelsViability);
        }
        if (data.aiCloudflareModelsCompanyAnalysis !== undefined) {
            setStringEnv('AI_CLOUDFLARE_MODELS_COMPANY_ANALYSIS', data.aiCloudflareModelsCompanyAnalysis);
        }

        const controls = getRuntimeControls();
        await prisma.aiRuntimeConfig.upsert({
            where: { key: CONTROL_KEY },
            create: {
                key: CONTROL_KEY,
                analyzeRateLimitMax: controls.analyzeRateLimitMax,
                analyzeRateLimitWindowSeconds: controls.analyzeRateLimitWindowSeconds,
                analyzeBulkheadMaxInFlight: controls.analyzeBulkheadMaxInFlight,
                analyzeBulkheadAcquireTimeoutMs: controls.analyzeBulkheadAcquireTimeoutMs,
                aiModelMaxInFlight: controls.aiModelMaxInFlight,
                analyzeAiMaxOutputTokens: controls.analyzeAiMaxOutputTokens,
                aiCircuitBreakerFailureThreshold: controls.aiCircuitBreakerFailureThreshold,
                aiCircuitBreakerOpenMs: controls.aiCircuitBreakerOpenMs,
                aiFallbackProvider: controls.aiFallbackProvider,
                aiCloudflareModelsLeadAnalysis: controls.aiCloudflareModelsLeadAnalysis,
                aiCloudflareModelsViability: controls.aiCloudflareModelsViability,
                aiCloudflareModelsCompanyAnalysis: controls.aiCloudflareModelsCompanyAnalysis,
            },
            update: {
                analyzeRateLimitMax: controls.analyzeRateLimitMax,
                analyzeRateLimitWindowSeconds: controls.analyzeRateLimitWindowSeconds,
                analyzeBulkheadMaxInFlight: controls.analyzeBulkheadMaxInFlight,
                analyzeBulkheadAcquireTimeoutMs: controls.analyzeBulkheadAcquireTimeoutMs,
                aiModelMaxInFlight: controls.aiModelMaxInFlight,
                analyzeAiMaxOutputTokens: controls.analyzeAiMaxOutputTokens,
                aiCircuitBreakerFailureThreshold: controls.aiCircuitBreakerFailureThreshold,
                aiCircuitBreakerOpenMs: controls.aiCircuitBreakerOpenMs,
                aiFallbackProvider: controls.aiFallbackProvider,
                aiCloudflareModelsLeadAnalysis: controls.aiCloudflareModelsLeadAnalysis,
                aiCloudflareModelsViability: controls.aiCloudflareModelsViability,
                aiCloudflareModelsCompanyAnalysis: controls.aiCloudflareModelsCompanyAnalysis,
            },
        });
        await setCached(RUNTIME_CONTROLS_CACHE_KEY, controls, RUNTIME_CONTROLS_TTL_SECONDS);
        logAdminAction(session, 'admin.ai-config.update', {
            resource: 'ai-config-runtime',
            details: controls,
        }).catch(() => {});
        return NextResponse.json({ controls });
    } catch {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
}
