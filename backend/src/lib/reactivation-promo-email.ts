/**
 * Premium HTML email — BR trial reactivation promo.
 * Responsive layout with table-based structure for Outlook compatibility.
 */

import {
  getReactivationPromoEmailCopy,
  getReactivationPromoCheckoutUrl,
} from '@/lib/i18n/messages';
import { ctaButton, ctaButtonSecondary } from '@/lib/email-templates';
import { getSiteUrlForMarket } from '@/lib/site-url';

const APP_NAME = 'PrecisionAI';
const BRAND_COLOR = '#1047da';
const BRAND_DARK = '#0c1930';
const TEXT_COLOR = '#1f2937';
const MUTED_COLOR = '#6b7280';
const SUCCESS_COLOR = '#059669';
const SITE_URL = getSiteUrlForMarket('BR');
const LOGO_URL = process.env.EMAIL_LOGO_URL ?? `${SITE_URL}/brands/precision-logo.png`;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'suporte@precisionai.com.br';
const COMPANY_NAME = 'Innexar Brasil';
const COMPANY_ADDRESS = 'Av. Dona Ophelia Caccerari Reis - Aviação, 363 — São Paulo, SP';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function preheaderHtml(text: string): string {
  return `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#ffffff;opacity:0;">${escapeHtml(text)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>`;
}

function benefitRow(text: string): string {
  return `
    <tr>
      <td style="padding:10px 0;vertical-align:top;width:28px;">
        <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#ecfdf5;color:${SUCCESS_COLOR};border-radius:50%;font-size:13px;font-weight:700;">&#10003;</span>
      </td>
      <td style="padding:10px 0 10px 8px;font-size:15px;line-height:1.5;color:${TEXT_COLOR};vertical-align:top;">
        ${escapeHtml(text)}
      </td>
    </tr>`;
}

function priceCard(copy: ReturnType<typeof getReactivationPromoEmailCopy>): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
      <tr>
        <td style="padding:24px;background:linear-gradient(135deg,${BRAND_COLOR} 0%,#1d4ed8 100%);border-radius:12px;text-align:center;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.06em;">
            ${escapeHtml(copy.promoHeadline)}
          </p>
          <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#ffffff;">
            ${escapeHtml(copy.planName)}
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
            <tr>
              <td style="padding-right:12px;font-size:18px;color:rgba(255,255,255,0.6);text-decoration:line-through;">
                ${escapeHtml(copy.originalPrice)}/mês
              </td>
              <td style="font-size:36px;font-weight:800;color:#ffffff;line-height:1;">
                ${escapeHtml(copy.promoPrice)}<span style="font-size:16px;font-weight:600;">/mês</span>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">
            nos primeiros <strong>${escapeHtml(copy.promoDuration)}</strong>
          </p>
        </td>
      </tr>
    </table>`;
}

export interface ReactivationPromoEmailOptions {
  userName?: string;
  checkoutUrl?: string;
  siteUrl?: string;
  unsubscribeToken?: string;
}

export function buildReactivationPromoEmailHtml(options: ReactivationPromoEmailOptions = {}): string {
  const copy = getReactivationPromoEmailCopy();
  const base = (options.siteUrl ?? SITE_URL).replace(/\/$/, '');
  const checkoutUrl = options.checkoutUrl ?? getReactivationPromoCheckoutUrl(base);
  const unsub = options.unsubscribeToken
    ? `${base}/unsubscribe?token=${encodeURIComponent(options.unsubscribeToken)}`
    : `${base}/unsubscribe`;

  const greeting = options.userName
    ? `<p style="margin:0 0 20px;font-size:15px;color:${MUTED_COLOR};">Olá, <strong style="color:${TEXT_COLOR};">${escapeHtml(options.userName)}</strong>.</p>`
    : '';

  const benefitsHtml = copy.benefits.map(benefitRow).join('');

  const content = `
    ${greeting}
    <p style="margin:0 0 12px;">
      <span style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.05em;">
        ${escapeHtml(copy.badge)}
      </span>
    </p>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:${BRAND_DARK};line-height:1.25;">
      ${escapeHtml(copy.title)}
    </h1>
    <p style="margin:0 0 16px;font-size:16px;color:${MUTED_COLOR};line-height:1.5;">
      ${escapeHtml(copy.subtitle)}
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${TEXT_COLOR};">
      ${escapeHtml(copy.intro)}
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
      <tr>
        <td style="padding:14px 16px;background-color:#eff6ff;border-radius:8px;border-left:4px solid ${BRAND_COLOR};">
          <p style="margin:0;font-size:14px;line-height:1.55;color:#1e40af;">
            ${escapeHtml(copy.dataPreserved)}
          </p>
        </td>
      </tr>
    </table>
    ${priceCard(copy)}
    <h2 style="margin:24px 0 12px;font-size:17px;font-weight:700;color:${TEXT_COLOR};">
      ${escapeHtml(copy.benefitsTitle)}
    </h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
      <tbody>${benefitsHtml}</tbody>
    </table>
    ${ctaButton(checkoutUrl, copy.ctaLabel, BRAND_COLOR)}
    ${ctaButtonSecondary(`${base}/dashboard/plans`, 'Ver todos os planos')}
    <p style="margin:20px 0 0;font-size:13px;color:${MUTED_COLOR};line-height:1.55;">
      ${escapeHtml(copy.footerNote)}
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
      ${escapeHtml(copy.legalNote)}
    </p>`;

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${APP_NAME}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;color:${TEXT_COLOR};">
  ${preheaderHtml(copy.preheader)}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
          <tr>
            <td style="background-color:${BRAND_COLOR};border-radius:12px 12px 0 0;padding:24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <a href="${base}" style="text-decoration:none;">
                      <img src="${LOGO_URL}" alt="${APP_NAME}" width="181" height="40"
                           style="display:block;border:0;border-radius:8px;background-color:rgba(255,255,255,0.12);object-fit:contain;" />
                    </a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${APP_NAME}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:32px 28px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;border-radius:0 0 12px 12px;padding:20px 28px;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px;font-size:12px;color:${MUTED_COLOR};">
                Precisa de ajuda?
                <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR};text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin:0 0 10px;font-size:12px;color:${MUTED_COLOR};">
                <strong>${COMPANY_NAME}</strong> &mdash; ${COMPANY_ADDRESS}
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                <a href="${base}" style="color:${MUTED_COLOR};text-decoration:none;">${base.replace(/^https?:\/\//, '')}</a>
                &nbsp;&middot;&nbsp;
                <a href="${unsub}" style="color:${MUTED_COLOR};text-decoration:none;">Descadastrar e-mails</a>
                &nbsp;&middot;&nbsp;
                <a href="${base}/privacy" style="color:${MUTED_COLOR};text-decoration:none;">Privacidade (LGPD)</a>
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

export function getReactivationPromoEmailSubject(): string {
  return getReactivationPromoEmailCopy().subject;
}
