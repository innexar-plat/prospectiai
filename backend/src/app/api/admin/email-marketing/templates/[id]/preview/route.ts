import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getTemplate, renderTemplatePreview } from '@/modules/email-marketing';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/email-marketing/templates/:id/preview
 * Render template preview HTML.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const template = await getTemplate(id);
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const userName = (body as { userName?: string }).userName ?? 'Usuário Teste';

    const html = renderTemplatePreview(template, userName);
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Template preview error', { id, error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
