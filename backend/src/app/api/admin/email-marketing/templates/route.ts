import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { listTemplates, createTemplate } from '@/modules/email-marketing';
import { createTemplateSchema } from '@/modules/email-marketing/domain/types';

/**
 * GET /api/admin/email-marketing/templates
 * List email templates with optional filters.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  try {
    const result = await listTemplates({ type, status, limit, offset });
    return NextResponse.json(result);
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('List templates error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/email-marketing/templates
 * Create a new email template.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const template = await createTemplate(parsed.data, session.user.id);
    return NextResponse.json({ data: template }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A template with this slug already exists' }, { status: 409 });
    }
    const { logger } = await import('@/lib/logger');
    logger.error('Create template error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
