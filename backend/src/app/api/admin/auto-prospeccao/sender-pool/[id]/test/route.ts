import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';
import { decryptEmailSecret } from '@/lib/email-config-encrypt';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { z } from 'zod';

const bodySchema = z.object({ testEmail: z.string().email() });

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/auto-prospeccao/sender-pool/[id]/test
 * Send a test email using the configured sender. Admin only.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'testEmail must be a valid e-mail address' }, { status: 400 });
  }

  const sender = await prisma.autoProspSenderPool.findUnique({ where: { id } });
  if (!sender) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { testEmail } = parsed.data;
  const subject = '[Precision IA] Teste de remetente';
  const html = `<p>Este é um e-mail de teste para verificar que o remetente <strong>${sender.fromEmail}</strong> está configurado corretamente no pool de e-mails da Precision IA.</p><p>Se você recebeu esta mensagem, a configuração está funcionando! ✅</p>`;

  try {
    if (sender.provider === 'resend') {
      if (!sender.resendApiKeyEncrypted) {
        return NextResponse.json({ error: 'Resend API key not configured' }, { status: 400 });
      }
      const apiKey = decryptEmailSecret(sender.resendApiKeyEncrypted);
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: sender.fromEmail,
        to: [testEmail],
        subject,
        html,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    } else {
      if (!sender.smtpHost || !sender.smtpPort || !sender.smtpUser || !sender.smtpPasswordEncrypted) {
        return NextResponse.json({ error: 'SMTP credentials incomplete' }, { status: 400 });
      }
      const password = decryptEmailSecret(sender.smtpPasswordEncrypted);
      const transporter = nodemailer.createTransport({
        host: sender.smtpHost,
        port: sender.smtpPort,
        secure: sender.smtpPort === 465,
        auth: { user: sender.smtpUser, pass: password },
      });
      await transporter.sendMail({ from: sender.fromEmail, to: testEmail, subject, html });
    }

    return NextResponse.json({ success: true, message: `Test email sent to ${testEmail}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
