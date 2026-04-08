/**
 * GET  /api/integrations/hubspot  — Test saved token connection
 * POST /api/integrations/hubspot  — (reserved for future manual token)
 */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
    forceRefreshHubspotTokenIfPossible,
    getValidHubspotAccessToken,
} from '@/lib/hubspot-oauth';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        const token = (user as unknown as { hubspotToken?: string | null }).hubspotToken;
        const hasRefresh = !!(user as unknown as { hubspotRefreshToken?: string | null }).hubspotRefreshToken;

        if (!token) {
            return NextResponse.json({ ok: false, connected: false, mode: null });
        }

        let accessToken = await getValidHubspotAccessToken(session.user.id);
        if (!accessToken) {
            return NextResponse.json({ ok: false, connected: false, mode: null });
        }

        // Probe HubSpot contacts to verify token
        let res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok && res.status === 401 && hasRefresh) {
            accessToken = await forceRefreshHubspotTokenIfPossible(session.user.id);
            if (accessToken) {
                res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
            }
        }

        if (!res.ok) {
            return NextResponse.json({
                ok: false,
                connected: false,
                mode: hasRefresh ? 'oauth' : null,
                error: 'Token inválido ou expirado',
            });
        }

        return NextResponse.json({ ok: true, connected: true, mode: 'oauth' });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('HubSpot test error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
