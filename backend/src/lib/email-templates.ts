/**
 * Professional HTML email templates. No emojis; logo, CTA button, footer, signature.
 * Inline CSS and table layout for broad client compatibility.
 */

const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const APP_NAME = 'ProspectorAI';
const LOGO_URL = process.env.EMAIL_LOGO_URL ?? `${SITE_URL.replace(/\/$/, '')}/lopclaro.png`;
const BRAND_COLOR = '#8B5CF6';
const TEXT_COLOR = '#1f2937';
const MUTED_COLOR = '#6b7280';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapContent(content: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;color:${TEXT_COLOR};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <a href="${SITE_URL}" style="text-decoration:none;color:inherit;">
                      <img src="${LOGO_URL}" alt="${APP_NAME}" width="48" height="48" style="display:block;border:0;border-radius:10px;" />
                    </a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:18px;font-weight:700;color:${TEXT_COLOR};">${APP_NAME}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;border-top:1px solid #e5e7eb;background-color:#f9fafb;border-radius:0 0 12px 12px;">
              <p style="margin:0;font-size:12px;color:${MUTED_COLOR};">
                Este e-mail foi enviado por <strong>${APP_NAME}</strong>.
              </p>
              <p style="margin:8px 0 0;font-size:12px;">
                <a href="${SITE_URL}" style="color:${BRAND_COLOR};text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Primary CTA button (single prominent link).
 */
export function ctaButton(href: string, label: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 0;">
      <tr>
        <td>
          <a href="${href}" style="display:inline-block;padding:14px 28px;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/**
 * Title (H1) inside content.
 */
export function title(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${TEXT_COLOR};line-height:1.3;">${text}</h1>`;
}

/**
 * Paragraph.
 */
export function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${TEXT_COLOR};">${text}</p>`;
}

/**
 * Muted/small text (e.g. expiry notice).
 */
export function muted(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;color:${MUTED_COLOR};line-height:1.5;">${text}</p>`;
}

/**
 * Full template: title + body paragraphs + optional CTA + optional muted.
 */
export function buildEmail(options: {
  title: string;
  body: string[];
  ctaHref?: string;
  ctaLabel?: string;
  muted?: string;
}): string {
  const { title: titleText, body, ctaHref, ctaLabel, muted: mutedText } = options;
  let content = title(titleText);
  body.forEach((p) => {
    content += paragraph(p);
  });
  if (ctaHref && ctaLabel) {
    content += ctaButton(ctaHref, ctaLabel);
  }
  if (mutedText) {
    content += muted(mutedText);
  }
  return wrapContent(content);
}

/**
 * Password reset email (professional template).
 */
export function passwordResetTemplate(resetLink: string): string {
  return buildEmail({
    title: 'Redefinir sua senha',
    body: [
      'Você solicitou a redefinição de senha da sua conta no ProspectorAI.',
      'Clique no botão abaixo para definir uma nova senha. Se você não solicitou isso, ignore este e-mail.',
    ],
    ctaHref: resetLink,
    ctaLabel: 'Redefinir senha',
    muted: 'Este link expira em 1 hora.',
  });
}

/**
 * Email verification (sign-up) template.
 */
export function verificationTemplate(verifyLink: string): string {
  return buildEmail({
    title: 'Confirme seu e-mail',
    body: [
      'Obrigado por se cadastrar no ProspectorAI.',
      'Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta.',
    ],
    ctaHref: verifyLink,
    ctaLabel: 'Confirmar e-mail',
    muted: 'Este link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.',
  });
}

/**
 * Team invite template (convite para workspace X por Y). Link = aceitar convite (com token).
 */
export function teamInviteTemplate(inviterName: string, workspaceName: string, acceptInviteUrl: string): string {
  const safeInviter = escapeHtml(inviterName);
  const safeWorkspace = escapeHtml(workspaceName);
  return buildEmail({
    title: `Convite para o workspace "${safeWorkspace}"`,
    body: [
      `${safeInviter} convidou você para o workspace "${safeWorkspace}".`,
      'Clique no botão abaixo para aceitar o convite e entrar na equipe.',
    ],
    ctaHref: acceptInviteUrl,
    ctaLabel: 'Aceitar convite',
  });
}

/**
 * Admin test email template.
 */
export function testEmailTemplate(): string {
  return buildEmail({
    title: 'E-mail de teste',
    body: [
      'Este é um e-mail de teste enviado pelo painel administrativo do ProspectorAI.',
      'Se você recebeu esta mensagem, a configuração de e-mail está funcionando corretamente.',
    ],
  });
}

/**
 * Notification email (in-app notification sent by email). Title and message are escaped for safety.
 * Converts relative links (e.g. /dashboard/lead/xxx) to absolute URLs so the link works in email clients.
 */
export function notificationTemplate(titleText: string, message: string, linkUrl?: string | null): string {
  const body = [escapeHtml(message)];
  const base = SITE_URL.replace(/\/$/, '');
  const ctaHref = linkUrl?.startsWith('/') ? `${base}${linkUrl}` : (linkUrl ?? undefined);
  return buildEmail({
    title: escapeHtml(titleText),
    body,
    ctaHref,
    ctaLabel: linkUrl ? 'Ver mais' : undefined,
  });
}

/**
 * Payment success / welcome to plan (professional template).
 * Used when Mercado Pago webhook reports approved payment.
 */
export function paymentSuccessTemplate(planName: string, leadsLimit: number, dashboardUrl: string): string {
  const safePlanName = escapeHtml(planName);
  const body = [
    'Obrigado por assinar o ProspectorAI. Seu pagamento foi aprovado e seu plano já está ativo.',
    `Você agora tem acesso ao plano <strong>${safePlanName}</strong>, com até ${leadsLimit} buscas por mês. Use o dashboard para fazer sua primeira prospecção, salvar leads e aproveitar as análises com IA.`,
    'Próximos passos: acesse o dashboard, defina nicho e região na Nova Busca e execute sua primeira busca. Em Inteligência você encontra concorrência, relatórios e análise da sua empresa conforme seu plano.',
  ];
  const base = SITE_URL.replace(/\/$/, '');
  const ctaHref = dashboardUrl.startsWith('http') ? dashboardUrl : `${base}${dashboardUrl.startsWith('/') ? '' : '/'}${dashboardUrl}`;
  return buildEmail({
    title: `Bem-vindo ao ${APP_NAME} — seu plano está ativo`,
    body,
    ctaHref,
    ctaLabel: 'Acessar dashboard',
  });
}

/**
 * Payment failed / rejected (professional template).
 * Used when Mercado Pago webhook reports rejected payment.
 */
export function paymentFailureTemplate(dashboardOrPlansUrl: string): string {
  const base = SITE_URL.replace(/\/$/, '');
  const ctaHref = dashboardOrPlansUrl.startsWith('http') ? dashboardOrPlansUrl : `${base}${dashboardOrPlansUrl.startsWith('/') ? '' : '/'}${dashboardOrPlansUrl}`;
  return buildEmail({
    title: 'Pagamento não aprovado',
    body: [
      'O pagamento do seu plano ProspectorAI não foi processado. Isso pode ocorrer por dados incorretos do cartão, limite insuficiente ou recusa do emissor.',
      'Verifique os dados do cartão ou tente outro cartão ou meio de pagamento. Você pode acessar a página de planos para tentar novamente.',
    ],
    ctaHref,
    ctaLabel: 'Ver planos',
  });
}
