import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

/**
 * GET /api/admin/email
 * Returns email config status. Configured when DB has valid config or RESEND_API_KEY is set. Admin only.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const row = await prisma.emailConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
    const fromDb =
      row &&
      ((row.provider === 'resend' && Boolean(row.resendApiKeyEncrypted)) ||
        (row.provider === 'smtp' &&
          Boolean(row.smtpHost && row.smtpPort != null && row.smtpUser && row.smtpPasswordEncrypted)));
    const fromEnv = Boolean(process.env.RESEND_API_KEY?.trim());
    const configured = Boolean(fromDb || fromEnv);
    return NextResponse.json({ configured });
  } catch {
    const configured = Boolean(process.env.RESEND_API_KEY?.trim());
    return NextResponse.json({ configured });
  }
}
