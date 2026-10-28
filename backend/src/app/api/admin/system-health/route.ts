import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { getRedisClient } from '@/lib/redis';
import { getLeadSyncQueueStats } from '@/lib/lead-sync-queue';
import { getSearchHistoryQueueStats } from '@/lib/search-history-queue';
import { getSearchBulkheadStats } from '@/lib/search-bulkhead';
import { getAnalyzeBulkheadStats } from '@/lib/analyze-bulkhead';
import { decryptEmailSecret } from '@/lib/email-config-encrypt';
import { getCronRuns, getErrorStats, getWebhookStatus } from '@/lib/ops-telemetry';
import { PERIOD_GRACE_DAYS, addDays } from '@/lib/billing-period';

/**
 * Crons the platform depends on. `intervalMin` = expected cadence when scheduled; a run older
 * than 2x that is flagged as stale. `scheduled: false` = exists but has no host crontab entry.
 */
const CRONS: Array<{ name: string; label: string; intervalMin: number; scheduled: boolean }> = [
    { name: 'billing-lifecycle', label: 'Cobrança: créditos, PIX, expiração', intervalMin: 1440, scheduled: true },
    { name: 'auto-prospeccao/email-sequence', label: 'Auto-prospecção: sequência de e-mails', intervalMin: 30, scheduled: true },
    { name: 'auto-prospeccao/crm-push', label: 'Auto-prospecção: envio ao CRM', intervalMin: 30, scheduled: true },
    { name: 'auto-prospeccao/search', label: 'Auto-prospecção: busca de leads', intervalMin: 360, scheduled: true },
    { name: 'auto-prospeccao/analyze', label: 'Auto-prospecção: análise IA', intervalMin: 360, scheduled: true },
    { name: 'auto-prospeccao/reset-sender-counts', label: 'Auto-prospecção: zera contadores de envio', intervalMin: 1440, scheduled: true },
    { name: 'weekly-report', label: 'Relatório semanal por e-mail', intervalMin: 10080, scheduled: false },
    { name: 'campaign-processor', label: 'Campanhas de e-mail marketing', intervalMin: 15, scheduled: false },
    { name: 'affiliate-approve-commissions', label: 'Aprovação de comissões de afiliados', intervalMin: 1440, scheduled: false },
    { name: 'br-trial-reactivation', label: 'Reativação de trials (BR)', intervalMin: 1440, scheduled: false },
];

type Check = { ok: boolean; latencyMs: number; detail?: Record<string, unknown> };

async function checkDb(): Promise<Check> {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        const latencyMs = Date.now() - start;
        const [size] = await prisma.$queryRaw<[{ bytes: bigint }]>`SELECT pg_database_size(current_database()) AS bytes`;
        const [conns] = await prisma.$queryRaw<[{ total: bigint; active: bigint }]>`
            SELECT count(*) AS total, count(*) FILTER (WHERE state = 'active') AS active
            FROM pg_stat_activity WHERE datname = current_database()`;
        const [migration] = await prisma.$queryRaw<[{ migration_name: string; finished_at: Date | null } | undefined]>`
            SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 1`;
        return {
            ok: true,
            latencyMs,
            detail: {
                sizeBytes: Number(size?.bytes ?? 0),
                connections: Number(conns?.total ?? 0),
                activeConnections: Number(conns?.active ?? 0),
                lastMigration: migration?.migration_name ?? null,
                lastMigrationAt: migration?.finished_at ?? null,
            },
        };
    } catch (err) {
        return { ok: false, latencyMs: Date.now() - start, detail: { error: err instanceof Error ? err.message : 'Unknown' } };
    }
}

function parseRedisInfo(info: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of info.split('\n')) {
        const [k, v] = line.split(':');
        if (k && v !== undefined) out[k.trim()] = v.trim();
    }
    return out;
}

async function checkRedis(): Promise<Check> {
    const start = Date.now();
    const r = getRedisClient();
    if (!r) return { ok: false, latencyMs: 0, detail: { error: 'client unavailable' } };
    try {
        await r.ping();
        const latencyMs = Date.now() - start;
        const info = parseRedisInfo(await r.info());
        const keys = await r.dbsize();
        return {
            ok: true,
            latencyMs,
            detail: {
                usedMemory: info.used_memory_human ?? null,
                maxMemory: info.maxmemory_human ?? null,
                keys,
                evictedKeys: Number(info.evicted_keys ?? 0),
                uptimeDays: Math.round(Number(info.uptime_in_seconds ?? 0) / 86400),
                version: info.redis_version ?? null,
            },
        };
    } catch (err) {
        return { ok: false, latencyMs: Date.now() - start, detail: { error: err instanceof Error ? err.message : 'Unknown' } };
    }
}

async function checkEmail(): Promise<{ provider: string; ok: boolean; note?: string }> {
    const row = await prisma.emailConfig.findFirst({ orderBy: { updatedAt: 'desc' } }).catch(() => null);
    if (row?.provider === 'resend' && row.resendApiKeyEncrypted) {
        try {
            decryptEmailSecret(row.resendApiKeyEncrypted);
            return { provider: 'Resend (painel)', ok: true };
        } catch {
            return { provider: 'Resend (painel)', ok: Boolean(process.env.RESEND_API_KEY), note: 'Chave do painel não abre; usando a do ambiente' };
        }
    }
    if (row?.provider === 'smtp' && row.smtpHost) return { provider: `SMTP ${row.smtpHost}`, ok: true };
    if (process.env.RESEND_API_KEY) return { provider: 'Resend (ambiente)', ok: true };
    return { provider: 'nenhum', ok: false, note: 'Nenhum provedor de e-mail configurado' };
}

async function integrations() {
    const [aiProviders, webSearch, email] = await Promise.all([
        prisma.aiProviderConfig.findMany({ where: { enabled: true }, select: { role: true, provider: true, model: true } }).catch(() => []),
        prisma.webSearchConfig.findMany({ where: { enabled: true }, select: { role: true, provider: true } }).catch(() => []),
        checkEmail(),
    ]);
    const env = (k: string) => Boolean(process.env[k]);
    return {
        email,
        mercadoPago: { ok: env('MERCADOPAGO_ACCESS_TOKEN') && env('MERCADOPAGO_WEBHOOK_SECRET'), token: env('MERCADOPAGO_ACCESS_TOKEN'), webhookSecret: env('MERCADOPAGO_WEBHOOK_SECRET') },
        stripe: { ok: env('STRIPE_SECRET_KEY') && env('STRIPE_WEBHOOK_SECRET'), key: env('STRIPE_SECRET_KEY'), webhookSecret: env('STRIPE_WEBHOOK_SECRET') },
        googlePlaces: { ok: env('GOOGLE_PLACES_API_KEY') },
        serper: { ok: env('SERPER_API_KEY') || env('SEARCH_SERPER_API_KEY') || webSearch.length > 0 },
        telegram: { ok: env('TELEGRAM_BOT_TOKEN') && env('TELEGRAM_CHAT_ID') },
        googleLogin: { ok: env('AUTH_GOOGLE_ID') && env('AUTH_GOOGLE_SECRET') },
        cronSecret: { ok: env('CRON_SECRET') },
        ai: {
            ok: aiProviders.length > 0 || env('GEMINI_API_KEY') || env('OPENROUTER_API_KEY') || env('CLOUDFLARE_AI_API_TOKEN'),
            configured: aiProviders,
            envFallbacks: { gemini: env('GEMINI_API_KEY'), openrouter: env('OPENROUTER_API_KEY'), cloudflare: env('CLOUDFLARE_AI_API_TOKEN') },
        },
    };
}

async function billingSanity(now: Date) {
    const paid = ['BASIC', 'PRO', 'BUSINESS', 'SCALE'] as const;
    const [overdueUnexpired, pastDue, openPix, overduePending, overLimit] = await Promise.all([
        prisma.workspace.count({
            where: { plan: { in: [...paid] }, subscriptionId: { not: null }, currentPeriodEnd: { lt: addDays(now, -(PERIOD_GRACE_DAYS + 1)) } },
        }),
        prisma.workspace.count({ where: { subscriptionStatus: 'past_due' } }),
        prisma.workspace.count({ where: { renewalPaymentExpiresAt: { gt: now } } }),
        prisma.workspace.count({ where: { pendingPlanId: { not: null }, pendingPlanEffectiveAt: { lt: addDays(now, -1) }, subscriptionId: { not: null } } }),
        prisma.$queryRaw<[{ n: bigint }]>`SELECT count(*) AS n FROM "Workspace" WHERE "leadsUsed" > "leadsLimit"`,
    ]);
    return {
        // Should stay 0 while the billing cron runs daily.
        paidPlansPastPeriod: overdueUnexpired,
        pastDue,
        openPixCharges: openPix,
        overduePlanChanges: overduePending,
        workspacesOverLimit: Number(overLimit[0]?.n ?? 0),
    };
}

async function usageLast24h(since: Date) {
    const [events, searches, analyses, signups] = await Promise.all([
        prisma.usageEvent.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _sum: { quantity: true } }),
        prisma.searchHistory.count({ where: { createdAt: { gte: since } } }),
        prisma.leadAnalysis.count({ where: { createdAt: { gte: since } } }),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
    ]);
    return {
        searches,
        analyses,
        signups,
        byType: Object.fromEntries(events.map((e) => [e.type, e._sum.quantity ?? 0])),
    };
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const [db, redis, integ, cronRuns, webhooks, errors] = await Promise.all([
        checkDb(),
        checkRedis(),
        integrations(),
        getCronRuns(CRONS.map((c) => c.name)),
        getWebhookStatus(['mercadopago', 'stripe']),
        getErrorStats(24),
    ]);
    const [billing, usage] = db.ok
        ? await Promise.all([billingSanity(now), usageLast24h(addDays(now, -1))])
        : [null, null];

    const crons = CRONS.map((c) => {
        const last = cronRuns[c.name]?.last ?? null;
        const ageMin = last ? (now.getTime() - new Date(last.at).getTime()) / 60000 : null;
        const stale = c.scheduled && (ageMin == null || ageMin > c.intervalMin * 2);
        return { ...c, last, history: cronRuns[c.name]?.history ?? [], stale };
    });

    const mem = process.memoryUsage();
    const errorsLastHour = errors.perHour.at(-1)?.count ?? 0;
    const problems: string[] = [];
    if (!db.ok) problems.push('Banco de dados indisponível');
    if (!redis.ok) problems.push('Redis indisponível');
    if (!integ.email.ok) problems.push('E-mail sem provedor');
    if (!integ.mercadoPago.ok) problems.push('Mercado Pago incompleto');
    if (!integ.ai.ok) problems.push('Nenhum provedor de IA');
    for (const c of crons) if (c.stale) problems.push(`Cron atrasado: ${c.label}`);
    for (const c of crons) if (c.last && !c.last.ok) problems.push(`Última execução falhou: ${c.label}`);
    if (errorsLastHour > 20) problems.push(`${errorsLastHour} erros na última hora`);
    if (billing && billing.paidPlansPastPeriod > 0) problems.push(`${billing.paidPlansPastPeriod} plano(s) pago(s) vencido(s) sem processar`);
    if (billing && billing.overduePlanChanges > 0) problems.push(`${billing.overduePlanChanges} mudança(s) de plano atrasada(s)`);

    const status = !db.ok ? 'down' : problems.length > 0 ? 'degraded' : 'ok';

    return NextResponse.json({
        status,
        problems,
        checkedAt: now.toISOString(),
        app: {
            version: process.env.APP_VERSION ?? null,
            node: process.version,
            uptimeSec: Math.round(process.uptime()),
            memory: { rssMb: Math.round(mem.rss / 1048576), heapUsedMb: Math.round(mem.heapUsed / 1048576), heapTotalMb: Math.round(mem.heapTotal / 1048576) },
        },
        db,
        redis,
        queues: {
            leadSync: getLeadSyncQueueStats(),
            searchHistory: getSearchHistoryQueueStats(),
            searchBulkhead: getSearchBulkheadStats(),
            analyzeBulkhead: getAnalyzeBulkheadStats(),
        },
        integrations: integ,
        crons,
        webhooks,
        errors,
        billing,
        usage,
    });
}
