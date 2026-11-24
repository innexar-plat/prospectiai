import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { instrumentCron } from '@/lib/ops-telemetry';
import { handleInboundReply } from '@/lib/inbound-replies';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

const replySchema = z.object({
    mailbox: z.string().max(200),
    messageId: z.string().max(500),
    from: z.string().max(320),
    fromName: z.string().max(200).nullable().optional(),
    subject: z.string().max(500),
    text: z.string().max(20000),
    autoSubmitted: z.string().max(100).nullable().optional(),
    precedence: z.string().max(100).nullable().optional(),
    xAutoreply: z.string().max(100).nullable().optional(),
});
const bodySchema = z.object({ replies: z.array(replySchema).max(100) });

/**
 * POST /api/cron/inbound-replies — { replies: InboundReply[] }
 * Called by scripts/inbound-replies.py with the new messages of the reply-to mailboxes.
 * Returns one action per reply; the script only marks a message as processed when it got one.
 */
async function handlePOST(req: NextRequest) {
    if (CRON_SECRET && req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let parsed;
    try {
        parsed = bodySchema.safeParse(await req.json());
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const results: Array<{ messageId: string; action: string }> = [];
    for (const reply of parsed.data.replies) {
        try {
            results.push({ messageId: reply.messageId, action: await handleInboundReply(reply) });
        } catch (err) {
            logger.error('inbound-replies: reply failed', { mailbox: reply.mailbox, error: err instanceof Error ? err.message : 'Unknown' });
            results.push({ messageId: reply.messageId, action: 'error' });
        }
    }
    logger.info('cron/inbound-replies completed', { count: results.length, actions: results.map((r) => r.action).join(',') });
    return NextResponse.json({ results });
}

export const POST = instrumentCron('inbound-replies', handlePOST);
