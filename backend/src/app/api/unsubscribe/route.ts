import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const unsubscribeSchema = z.object({
  token: z.string().min(1).optional(),
  email: z.string().email().optional(),
  category: z.enum(['ALL', 'MARKETING', 'WEEKLY_REPORT', 'PROMOTIONS']).optional(),
});

/**
 * GET /api/unsubscribe?token=xxx
 * Show unsubscribe confirmation page.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return new NextResponse(buildHtmlPage('Link inválido', 'Este link de descadastro é inválido ou expirou.'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Check if already unsubscribed
  const existing = await prisma.emailUnsubscribe.findUnique({ where: { token } });
  if (existing) {
    return new NextResponse(
      buildHtmlPage('Já descadastrado', 'Você já foi removido desta lista de emails.'),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  return new NextResponse(
    buildHtmlPage(
      'Descadastrar emails',
      `<form method="POST" action="/api/unsubscribe">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <p>Selecione quais emails deseja parar de receber:</p>
        <label style="display:block;margin:8px 0;"><input type="radio" name="category" value="MARKETING" checked /> Emails de marketing e promoções</label>
        <label style="display:block;margin:8px 0;"><input type="radio" name="category" value="WEEKLY_REPORT" /> Apenas relatórios semanais</label>
        <label style="display:block;margin:8px 0;"><input type="radio" name="category" value="ALL" /> Todos os emails (exceto transacionais)</label>
        <button type="submit" style="margin-top:16px;padding:10px 20px;background:#8B5CF6;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;">Confirmar descadastro</button>
      </form>`,
    ),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * POST /api/unsubscribe
 * Process unsubscribe from form or API.
 */
export async function POST(req: NextRequest) {
  try {
    let data: Record<string, string>;
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      data = {
        token: formData.get('token') as string ?? '',
        category: formData.get('category') as string ?? 'MARKETING',
      };
    } else {
      data = await req.json();
    }

    const parsed = unsubscribeSchema.safeParse(data);
    if (!parsed.success) {
      return new NextResponse(
        buildHtmlPage('Erro', 'Dados inválidos. Tente novamente.'),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }

    const category = parsed.data.category ?? 'MARKETING';
    const email = parsed.data.email;
    const token = parsed.data.token;

    let targetEmail = email;

    // If we have a token, find the user
    if (token && !targetEmail) {
      // Try to find user by unsubscribe token or use the token as a user identifier
      const user = await prisma.user.findFirst({
        where: { id: token },
        select: { email: true },
      });
      targetEmail = user?.email ?? undefined;
    }

    if (!targetEmail) {
      return new NextResponse(
        buildHtmlPage('Erro', 'Não foi possível identificar o email. Tente novamente.'),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }

    // Create unsubscribe record
    await prisma.emailUnsubscribe.upsert({
      where: { email_category: { email: targetEmail, category } },
      create: {
        email: targetEmail,
        category,
        token: token ?? `unsub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      },
      update: { unsubscribedAt: new Date() },
    });

    return new NextResponse(
      buildHtmlPage(
        'Descadastro confirmado',
        `<p>Você foi removido da lista de emails <strong>${categoryLabel(category)}</strong>.</p>
         <p style="margin-top:16px;color:#6b7280;">Você pode reverter esta escolha em <strong>Configurações</strong> dentro do PrecisionAI.</p>`,
      ),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Unsubscribe error', { error: e instanceof Error ? e.message : 'Unknown' });
    return new NextResponse(
      buildHtmlPage('Erro', 'Ocorreu um erro. Tente novamente.'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'ALL': return 'Todos os emails';
    case 'MARKETING': return 'Marketing e promoções';
    case 'WEEKLY_REPORT': return 'Relatórios semanais';
    case 'PROMOTIONS': return 'Promoções';
    default: return cat;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — PrecisionAI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 32px; max-width: 480px; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 20px; color: #1f2937; margin: 0 0 16px; }
    p { color: #4b5563; line-height: 1.6; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`;
}
