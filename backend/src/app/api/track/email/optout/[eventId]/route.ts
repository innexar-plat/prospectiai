import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

function page(message: string): NextResponse {
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Precision IA</title></head>`
        + `<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;">`
        + `<main style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;max-width:420px;text-align:center;color:#111827;">`
        + `<h1 style="font-size:18px;margin:0 0 8px;">Precision IA</h1><p style="margin:0;color:#4b5563;">${message}</p></main></body></html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/**
 * GET /api/track/email/optout/[eventId] — one-click opt-out from auto-prospecting e-mails.
 * Marks the lead OPTED_OUT and suppresses the address for every workspace.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    try {
        const event = await prisma.prospectedLeadEmailEvent.findUnique({
            where: { id: eventId },
            select: { leadId: true, lead: { select: { email: true } } },
        });
        if (event) {
            await prisma.prospectedLead.update({ where: { id: event.leadId }, data: { status: 'OPTED_OUT' } });
            const email = event.lead.email?.trim().toLowerCase();
            if (email) {
                await prisma.emailUnsubscribe.upsert({
                    where: { email_category: { email, category: 'MARKETING' } },
                    create: { email, category: 'MARKETING' },
                    update: {},
                });
            }
        }
    } catch (error) {
        logger.warn('Opt-out failed', { eventId, error: error instanceof Error ? error.message : 'Unknown' });
    }
    // Same answer either way: never reveal whether an id exists.
    return page('Pronto. Você não receberá mais e-mails nossos.');
}
