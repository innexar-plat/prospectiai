import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { sendEmail } from '@/lib/email';
import { testEmailTemplate } from '@/lib/email-templates';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { z } from 'zod';

const testSchema = z.object({
  to: z.string().email('Valid email is required'),
});

/**
 * POST /api/admin/email/test
 * Send a test email (admin only). Uses current RESEND config from env.
 */
export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }
    if (!isAdmin(session)) {
      return jsonWithRequestId({ error: 'Forbidden' }, { status: 403, requestId });
    }

    const body = await req.json();
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('; ');
      return jsonWithRequestId({ error: msg }, { status: 400, requestId });
    }

    const { to } = parsed.data;
    const html = testEmailTemplate();
    const result = await sendEmail(to, 'E-mail de teste – ProspectorAI', html);

    if (!result.sent) {
      return jsonWithRequestId(
        { error: result.error ?? 'Failed to send email', sent: false },
        { status: 200, requestId }
      );
    }

    return jsonWithRequestId({ message: 'Test email sent', sent: true }, { requestId });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin email test error', {
      error: e instanceof Error ? e.message : 'Unknown',
    }, requestId);
    return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
  }
}
