import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/ratelimit';
import { analyzeSchema, formatZodError } from '@/lib/validations/schemas';
import { runAnalyze, AnalyzeHttpError } from '@/modules/analyze';
import type { AnalyzeProgressStep } from '@/modules/analyze';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const { success } = await rateLimit(`analyze:${ip}`, 15, 60);
        if (!success) {
            return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 });
        }

        const body = await req.json();
        const parsed = analyzeSchema.safeParse(body);
        if (!parsed.success) {
            return new Response(JSON.stringify({ error: formatZodError(parsed) }), { status: 400 });
        }

        const session = await auth();
        if (!session?.user?.id) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const userId = session.user.id;
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                let closed = false;

                function sendEvent(event: string, data: Record<string, unknown>) {
                    if (closed) return;
                    try {
                        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
                    } catch {
                        closed = true;
                    }
                }

                const onProgress = (step: AnalyzeProgressStep, detail?: string) => {
                    sendEvent('progress', { step, detail });
                };

                try {
                    const result = await runAnalyze(parsed.data, userId, onProgress);
                    sendEvent('result', result as unknown as Record<string, unknown>);
                } catch (err) {
                    if (err instanceof AnalyzeHttpError) {
                        sendEvent('error', { status: err.status, ...err.body });
                    } else {
                        const msg = err instanceof Error ? err.message : 'Internal server error';
                        sendEvent('error', { status: 500, error: msg });
                    }
                } finally {
                    closed = true;
                    try { controller.close(); } catch { /* already closed */ }
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
}
