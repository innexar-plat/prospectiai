/**
 * GET  /api/integrations/rdstation  — Test saved token connection
 * POST /api/integrations/rdstation  — Save token for current user
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
    forceRefreshRdTokenIfPossible,
    getRdProbeContactsUrl,
    getRdProductMode,
    getValidRdStationAccessToken,
    saveManualRdToken,
} from '@/lib/rdstation-oauth';

const saveTokenSchema = z.object({
    token: z.string().min(10, 'Token inválido'),
});

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        const token = (user as unknown as { rdStationToken?: string | null }).rdStationToken;
        const hasRefresh = !!(user as unknown as { rdStationRefreshToken?: string | null }).rdStationRefreshToken;

        if (!token) {
            return NextResponse.json({ ok: false, connected: false, mode: null });
        }

        let accessToken = await getValidRdStationAccessToken(session.user.id);
        if (!accessToken) {
            return NextResponse.json({ ok: false, connected: false, mode: null });
        }

        const probeUrl = getRdProbeContactsUrl();
        const productMode = getRdProductMode();
        let res = await fetch(probeUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok && res.status === 401 && hasRefresh) {
            accessToken = await forceRefreshRdTokenIfPossible(session.user.id);
            if (accessToken) {
                res = await fetch(probeUrl, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
            }
        }

        if (!res.ok) {
            return NextResponse.json({
                ok: false,
                connected: false,
                mode: hasRefresh ? 'oauth' : 'manual',
                product: productMode,
                error: 'Token inválido ou expirado',
            });
        }

        return NextResponse.json({ ok: true, connected: true, mode: hasRefresh ? 'oauth' : 'manual', product: productMode });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('RD Station test error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const result = saveTokenSchema.safeParse(body);
        if (!result.success) {
            const msg = result.error.flatten().fieldErrors.token?.[0] ?? 'Dados inválidos';
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        const { token } = result.data;

        const testRes = await fetch(getRdProbeContactsUrl(), {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!testRes.ok) {
            return NextResponse.json({ error: 'Token inválido — verifique as credenciais no painel RD Station' }, { status: 422 });
        }

        await saveManualRdToken(session.user.id, token);

        return NextResponse.json({ ok: true });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('RD Station save token error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
