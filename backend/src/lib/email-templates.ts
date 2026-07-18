/**
 * PrecisionAI — Email Templates
 * Proprietário: Innexar Brasil
 * Av. Dona Ophelia Caccerari Reis - Aviação, 363 — São Paulo, SP
 *
 * Melhorias aplicadas vs versão anterior:
 *  - Header com cor da marca (identidade visual imediata)
 *  - Preheader text (preview na caixa de entrada)
 *  - Link de descadastro obrigatório (LGPD / CAN-SPAM)
 *  - Endereço físico no rodapé (obrigação legal)
 *  - Personalização com nome do usuário em todos os templates
 *  - Versão texto puro (plain text) via buildEmailText()
 *  - Interface BuildEmailOptions exportada
 *  - Validação de URL interna para evitar open redirect
 *  - escapeHtml() reforçado
 *  - CTAs específicos por contexto (não genéricos)
 *  - Data de próxima cobrança no paymentSuccess
 *  - Templates novos: trial expirando, trial expirado, cancelamento,
 *    dunning (3 toques), boas-vindas D+3, upgrade, resumo semanal,
 *    2FA ativado, dispositivo novo, promoção editável, relatório semanal
 */

import type { Locale } from '@/lib/i18n/locale';
import {
  getPasswordResetEmailCopy,
  getVerificationEmailCopy,
  getEmailShellCopy,
  getOAuthWelcomeEmailCopy,
  getTeamInviteEmailCopy,
  getTeamInviteAccountCreatedCopy,
  getRepresentativeInviteCopy,
  getRepresentativePromotedCopy,
  getLowCreditsEmailCopy,
  getNotificationEmailCopy,
  getAffiliateApprovedEmailCopy,
  getAffiliateConversionEmailCopy,
  getAffiliateCommissionPaidEmailCopy,
  getAffiliateCommissionAvailableEmailCopy,
} from '@/lib/i18n/messages';
import { getSiteUrlForMarket } from '@/lib/site-url';

// ── Configuração ───────────────────────────────────────────────────────────

const SITE_URL  = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Bases permitidas para links internos (BR + US + fallback env). */
function getAllowedSiteBases(preferredBase?: string): string[] {
  const bases = new Set<string>();
  const add = (url: string) => bases.add(url.replace(/\/$/, ''));
  if (preferredBase) add(preferredBase);
  add(SITE_URL);
  add(getSiteUrlForMarket('BR'));
  add(getSiteUrlForMarket('US'));
  return [...bases];
}
const APP_NAME  = 'PrecisionAI';
const LOGO_URL  = process.env.EMAIL_LOGO_URL ?? `${SITE_URL.replace(/\/$/, '')}/brands/precision-logo.png`;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'suporte@precisionai.com.br';

// Marca
const BRAND_COLOR   = '#1047da';
const BRAND_DARK    = '#0c1930';
const TEXT_COLOR    = '#1f2937';
const MUTED_COLOR   = '#6b7280';
const SUCCESS_COLOR = '#059669';
const WARNING_COLOR = '#d97706';
const DANGER_COLOR  = '#dc2626';

// Empresa (identidade legal por mercado, derivada do siteUrl do e-mail)
const COMPANY_NAME    = 'Innexar Brasil';
const COMPANY_ADDRESS = 'Av. Dona Ophelia Caccerari Reis - Aviação, 363 — São Paulo, SP';
const COMPANY_NAME_US    = 'Innexar LLC';
const COMPANY_ADDRESS_US = '13013 Yardley Ct — Orlando, Florida, USA';
const SUPPORT_EMAIL_US   = 'support@precisionai.innexar.app';

function getCompanyIdentity(siteBase: string): { name: string; address: string; support: string } {
  if (siteBase.includes('precisionai.innexar.app')) {
    return { name: COMPANY_NAME_US, address: COMPANY_ADDRESS_US, support: SUPPORT_EMAIL_US };
  }
  return { name: COMPANY_NAME, address: COMPANY_ADDRESS, support: SUPPORT_EMAIL };
}
// ── Tipos ──────────────────────────────────────────────────────────────────

export interface BuildEmailOptions {
  title: string;
  preheader?: string;
  userName?: string;
  body: string[];
  ctaHref?: string;
  ctaLabel?: string;
  footerNote?: string;
  accentColor?: string;
  /** Linhas extras no rodapé (ex: próxima cobrança, info de segurança) */
  footerExtra?: string;
  unsubscribeToken?: string;
  /** Base URL do site (market-aware); default = SITE_URL env */
  siteUrl?: string;
  locale?: Locale;
}

// ── Utilitários ────────────────────────────────────────────────────────────

/** Escapa todos os caracteres perigosos em HTML */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
    .replace(/`/g,  '&#96;')
    .replace(/\//g, '&#47;');
}

/**
 * Garante que a URL seja interna (domínios BR/US ou relativa).
 * Evita open redirect via argumentos externos.
 */
function safeUrl(url: string | undefined, preferredBase?: string): string | undefined {
  if (!url) return undefined;
  const defaultBase = (preferredBase ?? SITE_URL).replace(/\/$/, '');
  const allowedBases = getAllowedSiteBases(preferredBase);
  if (url.startsWith('/')) return `${defaultBase}${url}`;
  if (allowedBases.some((base) => url.startsWith(base))) return url;
  if (url.startsWith('http://localhost') || url.startsWith('http://127.')) return url;
  console.warn(`[email-templates] URL externa bloqueada: ${url}`);
  return `${defaultBase}/dashboard`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Componentes HTML ───────────────────────────────────────────────────────

/** Texto oculto que aparece no preview da caixa de entrada */
function preheaderHtml(text: string): string {
  return `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#ffffff;opacity:0;">${escapeHtml(text)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>`;
}

export function ctaButton(href: string, label: string, color = BRAND_COLOR): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 0;">
      <tr>
        <td>
          <a href="${href}"
             style="display:inline-block;padding:14px 28px;background-color:${color};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;mso-padding-alt:14px 28px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

export function ctaButtonSecondary(href: string, label: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:12px 0 0;">
      <tr>
        <td>
          <a href="${href}"
             style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:${BRAND_COLOR};text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;border:2px solid ${BRAND_COLOR};">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

export function titleHtml(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${TEXT_COLOR};line-height:1.3;">${text}</h1>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${TEXT_COLOR};">${text}</p>`;
}

export function mutedText(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;color:${MUTED_COLOR};line-height:1.5;">${text}</p>`;
}

/** Caixa destacada colorida (alertas, resumos, destaques) */
function infoBox(content: string, color = BRAND_COLOR, bgColor = '#f5f3ff'): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
      <tr>
        <td style="padding:16px;background-color:${bgColor};border-radius:8px;border-left:4px solid ${color};">
          ${content}
        </td>
      </tr>
    </table>`;
}

/** Linha de detalhe: label + valor lado a lado */
function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:${MUTED_COLOR};border-bottom:1px solid #e5e7eb;">${label}</td>
      <td style="padding:8px 0;font-size:14px;color:${TEXT_COLOR};font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${value}</td>
    </tr>`;
}

/** Tabela de detalhes (plano, datas, etc.) */
function detailTable(rows: Array<[string, string]>): string {
  const rowsHtml = rows.map(([l, v]) => detailRow(l, v)).join('');
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

/** Card de métrica para relatório semanal */
function metricCard(label: string, value: string, change?: string, changePositive?: boolean): string {
  const changeHtml = change
    ? `<span style="font-size:12px;color:${changePositive ? SUCCESS_COLOR : DANGER_COLOR};margin-left:6px;">${change}</span>`
    : '';
  return `
    <td style="width:33%;padding:12px;background-color:#f9fafb;border-radius:8px;text-align:center;vertical-align:top;">
      <div style="font-size:24px;font-weight:700;color:${BRAND_COLOR};">${value}${changeHtml}</div>
      <div style="font-size:12px;color:${MUTED_COLOR};margin-top:4px;">${label}</div>
    </td>`;
}

// ── Shell principal ────────────────────────────────────────────────────────

function wrapContent(content: string, options: {
  preheader?: string;
  accentColor?: string;
  footerExtra?: string;
  unsubscribeToken?: string;
  siteUrl?: string;
  locale?: Locale;
}): string {
  const accent   = options.accentColor ?? BRAND_COLOR;
  const base     = (options.siteUrl ?? SITE_URL).replace(/\/$/, '');
  const company  = getCompanyIdentity(base);
  const shell    = getEmailShellCopy(options.locale ?? 'pt');
  const unsub    = options.unsubscribeToken
    ? `${base}/unsubscribe?token=${encodeURIComponent(options.unsubscribeToken)}`
    : `${base}/unsubscribe`;
  const preheader = options.preheader ? preheaderHtml(options.preheader) : '';

  return `<!DOCTYPE html>
<html lang="${shell.htmlLang}" xmlns="http://www.w3.org/1999/xhtml">
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
  ${preheader}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">

          <!-- HEADER com cor da marca -->
          <tr>
            <td style="background-color:${accent};border-radius:12px 12px 0 0;padding:20px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <a href="${base}" style="text-decoration:none;">
                      <img src="${LOGO_URL}" alt="${APP_NAME}" width="181" height="40"
                           style="display:block;border:0;border-radius:8px;background-color:rgba(255,255,255,0.15);object-fit:contain;" />
                    </a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:18px;font-weight:700;color:#ffffff;">${APP_NAME}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CONTEÚDO -->
          <tr>
            <td style="background-color:#ffffff;padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- RODAPÉ -->
          <tr>
            <td style="background-color:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid #e5e7eb;">
              ${options.footerExtra ? `<p style="margin:0 0 10px;font-size:13px;color:${TEXT_COLOR};">${options.footerExtra}</p>` : ''}
              <p style="margin:0 0 4px;font-size:12px;color:${MUTED_COLOR};">
                ${shell.needHelp}
                <a href="mailto:${company.support}" style="color:${accent};text-decoration:none;">${company.support}</a>
              </p>
              <p style="margin:0 0 10px;font-size:12px;color:${MUTED_COLOR};">
                <strong>${company.name}</strong> &mdash; ${company.address}
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                <a href="${base}" style="color:${MUTED_COLOR};text-decoration:none;">${base.replace(/^https?:\/\//, '')}</a>
                &nbsp;&middot;&nbsp;
                <a href="${unsub}" style="color:${MUTED_COLOR};text-decoration:none;">${shell.unsubscribe}</a>
                &nbsp;&middot;&nbsp;
                <a href="${base}/privacy" style="color:${MUTED_COLOR};text-decoration:none;">${shell.privacy}</a>
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

// ── buildEmail central ─────────────────────────────────────────────────────

export function buildEmail(options: BuildEmailOptions): string {
  const {
    title, preheader, userName, body,
    ctaHref, ctaLabel, footerNote, footerExtra,
    accentColor, unsubscribeToken, siteUrl, locale = 'pt',
  } = options;

  const shell = getEmailShellCopy(locale);
  const greeting = userName
    ? `<p style="margin:0 0 16px;font-size:15px;color:${MUTED_COLOR};">${shell.greeting}, <strong style="color:${TEXT_COLOR};">${escapeHtml(userName)}</strong>.</p>`
    : '';

  let content = greeting + titleHtml(title);
  body.forEach(p => { content += paragraph(p); });
  if (ctaHref && ctaLabel) {
    content += ctaButton(safeUrl(ctaHref, siteUrl) ?? '#', ctaLabel, accentColor);
  }
  if (footerNote) content += mutedText(footerNote);

  return wrapContent(content, { preheader, accentColor, footerExtra, unsubscribeToken, siteUrl, locale });
}

/** Versão texto puro — usar como multipart/alternative */
export function buildEmailText(options: BuildEmailOptions): string {
  const { title, userName, body, ctaHref, ctaLabel, footerNote, siteUrl, locale = 'pt' } = options;
  const base = (siteUrl ?? SITE_URL).replace(/\/$/, '');
  const company = getCompanyIdentity(base);
  const shell = getEmailShellCopy(locale);
  const lines: string[] = [];
  if (userName) lines.push(`${shell.greeting}, ${userName}.`, '');
  lines.push(title, '='.repeat(title.length), '');
  body.forEach(p => lines.push(p.replace(/<[^>]+>/g, ''), ''));
  if (ctaHref && ctaLabel) lines.push(`${ctaLabel}: ${safeUrl(ctaHref, siteUrl)}`, '');
  if (footerNote) lines.push('---', footerNote, '');
  lines.push(
    '---',
    `${company.name} | ${company.address}`,
    `${shell.needHelp} ${company.support}`,
    `${shell.unsubscribe}: ${base}/unsubscribe`,
  );
  return lines.join('\n');
}

// ══════════════════════════════════════════════════════════════════════════
// TEMPLATES TRANSACIONAIS
// ══════════════════════════════════════════════════════════════════════════

/** Redefinição de senha */
export function passwordResetTemplate(resetLink: string, userName?: string, locale: Locale = 'pt', siteUrl?: string): string {
  const copy = getPasswordResetEmailCopy(locale);
  return buildEmail({
    title: copy.title,
    preheader: copy.preheader,
    userName,
    body: [...copy.body],
    ctaHref: resetLink,
    ctaLabel: copy.ctaLabel,
    footerNote: copy.footerNote,
    accentColor: BRAND_COLOR,
    locale,
    siteUrl,
  });
}

/** Verificação de e-mail no cadastro */
export function verificationTemplate(verifyLink: string, userName?: string, locale: Locale = 'pt', siteUrl?: string): string {
  const copy = getVerificationEmailCopy(locale);
  return buildEmail({
    title: copy.title,
    preheader: copy.preheader,
    userName,
    body: [...copy.body],
    ctaHref: verifyLink,
    ctaLabel: copy.ctaLabel,
    footerNote: copy.footerNote,
    accentColor: BRAND_COLOR,
    locale,
    siteUrl,
  });
}

/** Boas-vindas OAuth */
export function oauthWelcomeTemplate(
  firstName: string,
  provider: string,
  dashboardUrl: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): string {
  const copy = getOAuthWelcomeEmailCopy(locale);
  return buildEmail({
    title: copy.title,
    preheader: copy.preheader,
    userName: firstName === copy.defaultName ? undefined : firstName,
    body: copy.body(provider),
    ctaHref: dashboardUrl,
    ctaLabel: copy.ctaLabel,
    accentColor: BRAND_COLOR,
    locale,
    siteUrl,
  });
}

/** Convite para workspace */
export function teamInviteTemplate(
  inviterName: string,
  workspaceName: string,
  acceptInviteUrl: string,
  userName?: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): string {
  const copy = getTeamInviteEmailCopy(locale);
  const safeInviter = escapeHtml(inviterName);
  const safeWorkspace = escapeHtml(workspaceName);
  return buildEmail({
    title: copy.title(safeWorkspace),
    preheader: copy.preheader(safeInviter),
    userName,
    body: copy.body(safeInviter, safeWorkspace),
    ctaHref: acceptInviteUrl,
    ctaLabel: copy.ctaLabel,
    footerNote: copy.footerNote,
    accentColor: BRAND_COLOR,
    locale,
    siteUrl,
  });
}

/** Conta criada via convite — usuário precisa definir senha */
export function teamInviteAccountCreatedTemplate(
  inviterName: string,
  workspaceName: string,
  setPasswordUrl: string,
  userName?: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): string {
  const copy = getTeamInviteAccountCreatedCopy(locale);
  const safeInviter = escapeHtml(inviterName);
  const safeWorkspace = escapeHtml(workspaceName);
  return buildEmail({
    title: copy.title(safeWorkspace),
    preheader: copy.preheader,
    userName,
    body: copy.body(safeInviter, safeWorkspace),
    ctaHref: setPasswordUrl,
    ctaLabel: copy.ctaLabel,
    footerNote: copy.footerNote,
    accentColor: BRAND_COLOR,
    locale,
    siteUrl,
  });
}

/** Novo representante sem conta prévia — precisa definir senha */
export function representativeInviteTemplate(
  setPasswordUrl: string,
  userName?: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): string {
  const copy = getRepresentativeInviteCopy(locale);
  return buildEmail({
    title: copy.title,
    preheader: copy.preheader,
    userName,
    body: copy.body,
    ctaHref: setPasswordUrl,
    ctaLabel: copy.ctaLabel,
    footerNote: copy.footerNote,
    accentColor: BRAND_COLOR,
    locale,
    siteUrl,
  });
}

/** Cliente existente promovido a representante — conta já tinha senha */
export function representativePromotedTemplate(
  dashboardUrl: string,
  userName?: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): string {
  const copy = getRepresentativePromotedCopy(locale);
  return buildEmail({
    title: copy.title,
    preheader: copy.preheader,
    userName,
    body: copy.body,
    ctaHref: dashboardUrl,
    ctaLabel: copy.ctaLabel,
    footerNote: copy.footerNote,
    accentColor: BRAND_COLOR,
    locale,
    siteUrl,
  });
}

/** Créditos acabando — CTA de upgrade no momento de maior engajamento */
export function lowCreditsTemplate(
  remaining: number,
  limit: number,
  plansUrl: string,
  userName?: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): string {
  const copy = getLowCreditsEmailCopy(locale);
  return buildEmail({
    title: copy.title(remaining),
    preheader: copy.preheader,
    userName,
    body: copy.body(remaining, limit),
    ctaHref: plansUrl,
    ctaLabel: copy.ctaLabel,
    footerNote: copy.footerNote,
    accentColor: WARNING_COLOR,
    locale,
    siteUrl,
  });
}

/** E-mail de teste (admin) */
export function testEmailTemplate(): string {
  return buildEmail({
    title: 'E-mail de teste',
    preheader: 'Configuração de e-mail funcionando corretamente.',
    body: [
      'Este é um e-mail de teste enviado pelo painel administrativo do PrecisionAI.',
      'Se você recebeu esta mensagem, a configuração de e-mail está funcionando corretamente.',
    ],
    accentColor: MUTED_COLOR,
  });
}

/** Notificação in-app por e-mail */
export function notificationTemplate(
  titleText: string,
  message: string,
  linkUrl?: string | null,
  userName?: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): string {
  const ctaHref = linkUrl ? safeUrl(linkUrl, siteUrl) : undefined;
  const ctaLabel = ctaHref ? getNotificationEmailCopy(locale).ctaLabel : undefined;
  return buildEmail({
    title: escapeHtml(titleText),
    preheader: escapeHtml(message).slice(0, 90),
    userName,
    body: [escapeHtml(message)],
    ctaHref,
    ctaLabel,
    accentColor: BRAND_COLOR,
    locale,
    siteUrl,
  });
}

// ── Pagamentos ─────────────────────────────────────────────────────────────

/** Pagamento aprovado / plano ativo */
export function paymentSuccessTemplate(
  planName: string,
  leadsLimit: number,
  dashboardUrl: string,
  userName?: string,
  nextBillingDate?: Date,
): string {
  const safePlan = escapeHtml(planName);
  const nextDate = nextBillingDate ? formatDate(nextBillingDate) : null;

  const detailsHtml = detailTable([
    ['Plano ativo', safePlan],
    ['Buscas por mês', leadsLimit.toLocaleString('pt-BR')],
    ...(nextDate ? [['Próxima cobrança', nextDate] as [string, string]] : []),
  ]);

  const base  = SITE_URL.replace(/\/$/, '');
  const cta   = safeUrl(dashboardUrl) ?? `${base}/dashboard/search?onboarding=1`;

  let content = '';
  if (userName) {
    content += `<p style="margin:0 0 16px;font-size:15px;color:${MUTED_COLOR};">Olá, <strong style="color:${TEXT_COLOR};">${escapeHtml(userName)}</strong>.</p>`;
  }
  content += titleHtml('Seu plano está ativo!');
  content += paragraph('Seu pagamento foi aprovado. Bem-vindo ao PrecisionAI — sua equipe de prospecção com inteligência artificial.');
  content += infoBox(
    `<p style="margin:0;font-size:15px;color:#5b21b6;font-weight:600;">Plano <strong>${safePlan}</strong> ativado</p>
     <p style="margin:4px 0 0;font-size:14px;color:#6d28d9;">Você tem <strong>${leadsLimit.toLocaleString('pt-BR')} buscas/mês</strong> disponíveis agora.</p>`,
    BRAND_COLOR,
    '#f5f3ff',
  );
  content += detailsHtml;
  content += paragraph('Próximos passos: acesse o dashboard, defina o nicho e a cidade na <strong>Nova Busca</strong> e execute sua primeira prospecção com score de IA.');
  content += ctaButton(cta, 'Fazer minha primeira busca', SUCCESS_COLOR);
  content += ctaButtonSecondary(`${base}/dashboard`, 'Ver dashboard completo');
  if (nextDate) {
    content += mutedText(`Próxima cobrança: ${nextDate}. Cancele a qualquer momento em Configurações → Assinatura.`);
  }

  return wrapContent(content, {
    preheader: `Plano ${safePlan} ativo — ${leadsLimit.toLocaleString('pt-BR')} buscas/mês disponíveis.`,
    accentColor: SUCCESS_COLOR,
    footerExtra: `<a href="${base}/settings/subscription" style="color:${MUTED_COLOR};font-size:12px;">Gerenciar assinatura</a>`,
  });
}

/** Pagamento recusado */
export function paymentFailureTemplate(
  dashboardOrPlansUrl: string,
  userName?: string,
): string {
  return buildEmail({
    title: 'Pagamento não aprovado',
    preheader: 'Houve um problema com o pagamento do seu plano. Veja como resolver.',
    userName,
    body: [
      'O pagamento do seu plano PrecisionAI não foi processado. Isso pode ocorrer por dados incorretos, limite insuficiente ou recusa do emissor.',
      'Verifique os dados do cartão ou tente outro meio de pagamento. Sua conta continua ativa por mais 3 dias enquanto você resolve.',
    ],
    ctaHref: dashboardOrPlansUrl,
    ctaLabel: 'Atualizar forma de pagamento',
    accentColor: DANGER_COLOR,
    footerNote: 'Se precisar de ajuda, responda este e-mail ou acesse nosso suporte.',
  });
}

// ── Dunning sequence (cobrança falhando) ────────────────────────────────────

/** Dunning 1 — aviso suave (dia da falha) */
export function dunningFirstTemplate(
  planName: string,
  retryDate: Date,
  updatePaymentUrl: string,
  userName?: string,
): string {
  return buildEmail({
    title: 'Problema com seu pagamento',
    preheader: 'Não conseguimos processar sua cobrança. Veja como resolver.',
    userName,
    body: [
      `Tentamos cobrar sua assinatura do plano <strong>${escapeHtml(planName)}</strong>, mas o pagamento não foi aprovado.`,
      `Não se preocupe — sua conta continua ativa. Faremos uma nova tentativa em <strong>${formatDate(retryDate)}</strong>.`,
      'Se quiser resolver agora, atualize sua forma de pagamento clicando no botão abaixo.',
    ],
    ctaHref: updatePaymentUrl,
    ctaLabel: 'Atualizar pagamento',
    accentColor: WARNING_COLOR,
    footerNote: 'Se não atualizar até a data de nova tentativa, sua conta pode ser suspensa.',
  });
}

/** Dunning 2 — urgência média (3 dias depois) */
export function dunningSecondTemplate(
  planName: string,
  suspensionDate: Date,
  updatePaymentUrl: string,
  userName?: string,
): string {
  return buildEmail({
    title: 'Sua assinatura será suspensa em breve',
    preheader: `Ação necessária: pagamento do plano ${escapeHtml(planName)} pendente.`,
    userName,
    body: [
      `Ainda não conseguimos processar o pagamento do seu plano <strong>${escapeHtml(planName)}</strong>.`,
      `Se não resolvermos até <strong>${formatDate(suspensionDate)}</strong>, sua conta será suspensa e você perderá acesso aos leads e análises salvos.`,
      'Leva menos de 1 minuto para atualizar sua forma de pagamento.',
    ],
    ctaHref: updatePaymentUrl,
    ctaLabel: 'Resolver agora',
    accentColor: DANGER_COLOR,
    footerNote: 'Após a suspensão, seus dados ficam guardados por 30 dias. Você pode reativar a conta a qualquer momento.',
  });
}

/** Dunning 3 — conta suspensa (dia da suspensão) */
export function dunningThirdTemplate(
  reactivateUrl: string,
  userName?: string,
): string {
  return buildEmail({
    title: 'Sua conta foi suspensa',
    preheader: 'Reative sua conta para recuperar o acesso ao PrecisionAI.',
    userName,
    body: [
      'Devido a pagamentos em atraso, sua conta PrecisionAI foi suspensa.',
      'Seus dados, leads salvos e histórico de buscas estão preservados por 30 dias.',
      'Para reativar, escolha um plano e atualize sua forma de pagamento. Todo seu histórico será restaurado imediatamente.',
    ],
    ctaHref: reactivateUrl,
    ctaLabel: 'Reativar minha conta',
    accentColor: DANGER_COLOR,
    footerNote: 'Após 30 dias de suspensão, os dados podem ser excluídos permanentemente.',
  });
}

// ── Trial ──────────────────────────────────────────────────────────────────

/** Trial expirando — 1 dia antes */
export function trialExpiringTemplate(
  trialEndDate: Date,
  plansUrl: string,
  userName?: string,
): string {
  const base = SITE_URL.replace(/\/$/, '');
  return buildEmail({
    title: 'Seu período de teste termina amanhã',
    preheader: 'Assine agora para não perder o acesso ao PrecisionAI.',
    userName,
    body: [
      `Seu período de teste gratuito encerra em <strong>${formatDate(trialEndDate)}</strong>.`,
      'Ao assinar um plano, você mantém acesso a todos os seus leads salvos, histórico de buscas e análises de IA.',
      'Aproveite: para usuários em trial que convertem, temos uma oferta especial de boas-vindas.',
    ],
    ctaHref: plansUrl,
    ctaLabel: 'Ver planos e assinar',
    accentColor: WARNING_COLOR,
    footerNote: `Dúvidas? Responda este e-mail ou acesse ${SUPPORT_EMAIL}.`,
    footerExtra: `<a href="${base}/settings" style="color:${MUTED_COLOR};font-size:12px;">Gerenciar trial</a>`,
  });
}

/** Trial expirado — 24h após expirar */
export function trialExpiredTemplate(
  plansUrl: string,
  userName?: string,
): string {
  return buildEmail({
    title: 'Seu teste gratuito encerrou',
    preheader: 'Seus dados estão guardados — assine para recuperar o acesso.',
    userName,
    body: [
      'Seu período de teste no PrecisionAI chegou ao fim.',
      '<strong>Boa notícia:</strong> todos os seus leads salvos, buscas e análises estão preservados por 15 dias. Ao assinar, você recupera tudo imediatamente.',
      'Escolha o plano ideal para o tamanho da sua prospecção e continue onde parou.',
    ],
    ctaHref: plansUrl,
    ctaLabel: 'Escolher meu plano',
    accentColor: BRAND_COLOR,
    footerNote: 'Seus dados serão mantidos por mais 15 dias. Após esse prazo, podem ser excluídos.',
  });
}

/** Boas-vindas D+3 — trial ativo mas sem uso */
export function trialActivationNudgeTemplate(
  firstSearchUrl: string,
  userName?: string,
): string {
  return buildEmail({
    title: 'Você ainda não fez sua primeira busca',
    preheader: 'Leva menos de 2 minutos. Encontre leads qualificados agora.',
    userName,
    body: [
      'Sua conta PrecisionAI está ativa, mas você ainda não explorou a plataforma.',
      'Em menos de 2 minutos você pode encontrar dezenas de empresas qualificadas para prospectar — com score de IA, dados de contato e análise de potencial.',
      'Que tal fazer sua primeira busca agora? Escolha uma cidade e um segmento e veja o resultado.',
    ],
    ctaHref: firstSearchUrl,
    ctaLabel: 'Fazer minha primeira busca',
    accentColor: BRAND_COLOR,
    footerNote: 'Seu trial é gratuito e termina em alguns dias. Explore sem compromisso.',
  });
}

// ── Assinatura ─────────────────────────────────────────────────────────────

/** Upgrade de plano */
export function planUpgradeTemplate(
  oldPlan: string,
  newPlan: string,
  newLeadsLimit: number,
  dashboardUrl: string,
  nextBillingDate?: Date,
  userName?: string,
): string {
  const details: Array<[string, string]> = [
    ['Plano anterior', escapeHtml(oldPlan)],
    ['Novo plano', escapeHtml(newPlan)],
    ['Buscas por mês', newLeadsLimit.toLocaleString('pt-BR')],
  ];
  if (nextBillingDate) details.push(['Próxima cobrança', formatDate(nextBillingDate)]);

  let content = '';
  if (userName) {
    content += `<p style="margin:0 0 16px;font-size:15px;color:${MUTED_COLOR};">Olá, <strong style="color:${TEXT_COLOR};">${escapeHtml(userName)}</strong>.</p>`;
  }
  content += titleHtml(`Upgrade para ${escapeHtml(newPlan)} confirmado!`);
  content += paragraph(`Seu plano foi atualizado de <strong>${escapeHtml(oldPlan)}</strong> para <strong>${escapeHtml(newPlan)}</strong>. O novo limite já está disponível.`);
  content += detailTable(details);
  content += ctaButton(safeUrl(dashboardUrl) ?? '#', 'Explorar novos recursos', SUCCESS_COLOR);
  if (nextBillingDate) {
    content += mutedText(`Próxima cobrança: ${formatDate(nextBillingDate)}.`);
  }

  return wrapContent(content, {
    preheader: `Upgrade para ${escapeHtml(newPlan)} ativo — ${newLeadsLimit.toLocaleString('pt-BR')} buscas/mês disponíveis.`,
    accentColor: SUCCESS_COLOR,
  });
}

/** Assinatura cancelada */
export function subscriptionCancelledTemplate(
  planName: string,
  accessUntil: Date,
  reactivateUrl: string,
  userName?: string,
): string {
  const base = SITE_URL.replace(/\/$/, '');
  return buildEmail({
    title: 'Assinatura cancelada',
    preheader: 'Seu acesso continua ativo até o fim do período pago.',
    userName,
    body: [
      `Sua assinatura do plano <strong>${escapeHtml(planName)}</strong> foi cancelada conforme solicitado.`,
      `Você ainda tem acesso completo até <strong>${formatDate(accessUntil)}</strong>. Após essa data, sua conta será rebaixada para o plano gratuito.`,
      'Se mudou de ideia, você pode reativar a qualquer momento sem perder seu histórico.',
    ],
    ctaHref: reactivateUrl,
    ctaLabel: 'Reativar assinatura',
    accentColor: MUTED_COLOR,
    footerNote: `Lamentamos vê-lo partir. Se tiver sugestões de melhoria, responda este e-mail — lemos todos.`,
    footerExtra: `Seu histórico de leads e buscas fica salvo por 60 dias após o encerramento.`,
  });
}

// ── Segurança ──────────────────────────────────────────────────────────────

/** 2FA ativado */
export function twoFactorEnabledTemplate(userName?: string): string {
  const base = SITE_URL.replace(/\/$/, '');
  return buildEmail({
    title: 'Autenticação em dois fatores ativada',
    preheader: 'Sua conta está mais segura agora.',
    userName,
    body: [
      'A autenticação em dois fatores (2FA) foi ativada com sucesso na sua conta PrecisionAI.',
      'A partir de agora, você precisará do código do seu aplicativo autenticador a cada login.',
      '<strong>Guarde seus códigos de recuperação em um lugar seguro.</strong> Eles são a única forma de recuperar o acesso caso perca o dispositivo.',
    ],
    ctaHref: `${base}/settings/security`,
    ctaLabel: 'Ver configurações de segurança',
    accentColor: SUCCESS_COLOR,
    footerNote: 'Se você não ativou o 2FA, acesse as configurações e desative imediatamente. Em caso de dúvida, entre em contato com o suporte.',
  });
}

/** Login de dispositivo desconhecido */
export function newDeviceLoginTemplate(
  deviceInfo: string,
  location: string,
  loginTime: Date,
  securityUrl: string,
  userName?: string,
): string {
  const details: Array<[string, string]> = [
    ['Dispositivo', escapeHtml(deviceInfo)],
    ['Localização', escapeHtml(location)],
    ['Horário', loginTime.toLocaleString('pt-BR')],
  ];

  let content = '';
  if (userName) {
    content += `<p style="margin:0 0 16px;font-size:15px;color:${MUTED_COLOR};">Olá, <strong style="color:${TEXT_COLOR};">${escapeHtml(userName)}</strong>.</p>`;
  }
  content += titleHtml('Novo login detectado na sua conta');
  content += paragraph('Detectamos um acesso à sua conta PrecisionAI a partir de um dispositivo ou localização não reconhecidos:');
  content += detailTable(details);
  content += paragraph('Se foi você, pode ignorar este e-mail. Se não reconhece este acesso, proteja sua conta imediatamente.');
  content += ctaButton(safeUrl(securityUrl) ?? '#', 'Proteger minha conta', DANGER_COLOR);

  return wrapContent(content, {
    preheader: 'Novo login detectado — verifique se foi você.',
    accentColor: DANGER_COLOR,
    footerExtra: 'Por segurança, nunca compartilhe sua senha ou código 2FA.',
  });
}


function affiliateCommissionGeneratedLine(locale: Locale, amount: string): string {
  if (locale === 'en') {
    return `Commission earned: <strong>${amount}</strong>. It will enter a hold period before payout per program policy.`;
  }
  if (locale === 'es') {
    return `Comisión generada: <strong>${amount}</strong>. Entrará en período de retención antes del pago según la política del programa.`;
  }
  return `Comissão gerada: <strong>${amount}</strong>. O valor entrará em período de carência e ficará disponível para saque conforme a política do programa.`;
}

function affiliateCommissionPaidLine(locale: Locale, amount: string): string {
  if (locale === 'en') {
    return `A commission of <strong>${amount}</strong> was processed and sent using your payout details.`;
  }
  if (locale === 'es') {
    return `Una comisión de <strong>${amount}</strong> fue procesada y enviada según tus datos de pago.`;
  }
  return `Uma comissão no valor de <strong>${amount}</strong> foi processada e enviada conforme seus dados de saque.`;
}

function affiliateBalanceAvailableLine(locale: Locale, amount: string): string {
  if (locale === 'en') {
    return `You have <strong>${amount}</strong> available for payout in the PrecisionAI affiliate program.`;
  }
  if (locale === 'es') {
    return `Tienes <strong>${amount}</strong> disponibles para retiro en el programa de afiliados PrecisionAI.`;
  }
  return `Você tem <strong>${amount}</strong> disponíveis para saque no programa de afiliados PrecisionAI.`;
}

// ── Afiliados ──────────────────────────────────────────────────────────────

/** Afiliado aprovado */
export function affiliateApprovedTemplate(
  affiliateCode: string,
  loginUrl: string,
  userName?: string,
  siteUrl?: string,
  locale: Locale = 'pt',
): string {
  const copy = getAffiliateApprovedEmailCopy(locale);
  const safeCode = escapeHtml(affiliateCode);
  const base = (siteUrl ?? SITE_URL).replace(/\/$/, '');
  const affiliateLink = `${base}/r/${encodeURIComponent(affiliateCode)}`;
  const cta = safeUrl(loginUrl, base) ?? `${base}/dashboard/afiliado`;

  let content = '';
  if (userName) {
    const shell = getEmailShellCopy(locale);
    content += `<p style="margin:0 0 16px;font-size:15px;color:${MUTED_COLOR};">${shell.greeting}, <strong style="color:${TEXT_COLOR};">${escapeHtml(userName)}</strong>.</p>`;
  }
  content += titleHtml(copy.title);
  content += paragraph(copy.body[0]);
  content += infoBox(
    `<p style="margin:0;font-size:14px;color:#5b21b6;font-weight:600;">${copy.codeLabel}</p>
     <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#4c1d95;letter-spacing:2px;">${safeCode}</p>
     <p style="margin:6px 0 0;font-size:13px;color:#7c3aed;">
       <a href="${affiliateLink}" style="color:#7c3aed;word-break:break-all;">${affiliateLink}</a>
     </p>`,
    BRAND_COLOR,
    '#f5f3ff',
  );
  content += paragraph(copy.body[1]);
  content += ctaButton(cta, copy.ctaLabel, BRAND_COLOR);

  return wrapContent(content, {
    preheader: copy.preheader(safeCode),
    accentColor: BRAND_COLOR,
    siteUrl: base,
    locale,
  });
}

/** Nova conversão do afiliado */
export function affiliateConversionTemplate(
  conversionSummary: string,
  commissionAmount: string,
  dashboardUrl: string,
  userName?: string,
  siteUrl?: string,
  locale: Locale = 'pt',
): string {
  const copy = getAffiliateConversionEmailCopy(locale);
  const amount = escapeHtml(commissionAmount);
  const commissionLine = affiliateCommissionGeneratedLine(locale, amount);
  return buildEmail({
    title: copy.title,
    preheader: copy.preheader(amount),
    userName,
    body: [
      escapeHtml(conversionSummary),
      commissionLine,
      copy.bodyTail,
    ],
    ctaHref: dashboardUrl,
    ctaLabel: copy.ctaLabel,
    accentColor: SUCCESS_COLOR,
    siteUrl,
    locale,
  });
}

/** Comissão paga */
export function affiliateCommissionPaidTemplate(
  amountFormatted: string,
  payoutInfo: string,
  userName?: string,
  locale: Locale = 'pt',
  siteUrl?: string,
): string {
  const copy = getAffiliateCommissionPaidEmailCopy(locale);
  const amount = escapeHtml(amountFormatted);
  const paidLine = affiliateCommissionPaidLine(locale, amount);
  return buildEmail({
    title: copy.title,
    preheader: copy.preheader(amount),
    userName,
    body: [paidLine, escapeHtml(payoutInfo), copy.bodyTail],
    accentColor: SUCCESS_COLOR,
    locale,
    siteUrl,
  });
}

/** Comissão disponível para saque */
export function affiliateCommissionAvailableTemplate(
  amount: string,
  dashboardUrl: string,
  userName?: string,
  siteUrl?: string,
  locale: Locale = 'pt',
): string {
  const copy = getAffiliateCommissionAvailableEmailCopy(locale);
  const safeAmount = escapeHtml(amount);
  const balanceLine = affiliateBalanceAvailableLine(locale, safeAmount);
  return buildEmail({
    title: copy.title,
    preheader: copy.preheader(safeAmount),
    userName,
    body: [balanceLine, copy.body],
    ctaHref: dashboardUrl,
    ctaLabel: copy.ctaLabel,
    accentColor: SUCCESS_COLOR,
    siteUrl,
    locale,
  });
}

// ══════════════════════════════════════════════════════════════════════════
// TEMPLATES EDITÁVEIS PELO PAINEL ADMIN
// Estrutura: função recebe variáveis dinâmicas + bloco de conteúdo customizável
// ══════════════════════════════════════════════════════════════════════════

/**
 * Relatório semanal de uso — editável pelo admin.
 * @param config Dados do usuário e métricas da semana
 * @param adminConfig Personalização via painel admin (assunto, destaque, CTA)
 */
export interface WeeklyReportConfig {
  userName: string;
  weekStart: Date;
  weekEnd: Date;
  totalSearches: number;
  totalLeadsFound: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  avgScore: number;
  topSegment: string;
  topCity: string;
  dashboardUrl: string;
}

export interface AdminWeeklyReportConfig {
  customTitle?: string;
  customHighlight?: string;   // Texto em destaque (tip da semana, novidade, etc.)
  ctaLabel?: string;
  ctaUrl?: string;
  footerPromo?: string;       // Promoção ou aviso no rodapé
}

export function weeklyReportTemplate(
  config: WeeklyReportConfig,
  adminConfig: AdminWeeklyReportConfig = {},
): string {
  const {
    userName, weekStart, weekEnd,
    totalSearches, totalLeadsFound, hotLeads, warmLeads, coldLeads,
    avgScore, topSegment, topCity, dashboardUrl,
  } = config;

  const {
    customTitle = `Seu resumo da semana — PrecisionAI`,
    customHighlight,
    ctaLabel = 'Ver todos os leads',
    ctaUrl,
    footerPromo,
  } = adminConfig;

  const base = SITE_URL.replace(/\/$/, '');
  const ctaHref = safeUrl(ctaUrl ?? dashboardUrl) ?? `${base}/dashboard`;
  const period  = `${formatDate(weekStart)} a ${formatDate(weekEnd)}`;

  let content = `<p style="margin:0 0 16px;font-size:15px;color:${MUTED_COLOR};">Olá, <strong style="color:${TEXT_COLOR};">${escapeHtml(userName)}</strong>.</p>`;
  content += titleHtml(escapeHtml(customTitle));
  content += paragraph(`Aqui está o resumo da sua atividade de <strong>${period}</strong>:`);

  // Métricas em grade
  content += `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
      <tr>
        ${metricCard('Buscas realizadas', totalSearches.toString())}
        <td style="width:2%;"></td>
        ${metricCard('Leads encontrados', totalLeadsFound.toLocaleString('pt-BR'))}
        <td style="width:2%;"></td>
        ${metricCard('Score médio', avgScore.toFixed(0) + '/100')}
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 16px;">
      <tr>
        ${metricCard('Hot leads', hotLeads.toString(), undefined, true)}
        <td style="width:2%;"></td>
        ${metricCard('Warm leads', warmLeads.toString())}
        <td style="width:2%;"></td>
        ${metricCard('Cold leads', coldLeads.toString())}
      </tr>
    </table>`;

  content += detailTable([
    ['Segmento mais buscado', escapeHtml(topSegment)],
    ['Cidade com mais leads', escapeHtml(topCity)],
  ]);

  if (customHighlight) {
    content += infoBox(
      `<p style="margin:0;font-size:14px;color:#1e40af;font-weight:600;">Dica da semana</p>
       <p style="margin:6px 0 0;font-size:14px;color:#1e3a8a;">${customHighlight}</p>`,
      '#2563eb',
      '#eff6ff',
    );
  }

  content += ctaButton(ctaHref, ctaLabel, BRAND_COLOR);

  return wrapContent(content, {
    preheader: `${totalLeadsFound} leads encontrados esta semana. Veja seu resumo.`,
    accentColor: BRAND_COLOR,
    footerExtra: footerPromo
      ? `<p style="margin:0 0 8px;font-size:13px;color:${BRAND_COLOR};font-weight:600;">${escapeHtml(footerPromo)}</p>`
      : undefined,
  });
}

/**
 * E-mail de promoção — totalmente editável pelo painel admin.
 * Campos editáveis: título, subtítulo, corpo, CTA, cor, imagem de destaque, badge.
 */
export interface PromotionEmailConfig {
  /** Assunto do e-mail (não aparece no HTML mas deve ser passado ao provider) */
  subject: string;
  /** Badge/chip acima do título (ex: "Oferta especial", "Novidade") */
  badge?: string;
  badgeColor?: string;
  title: string;
  subtitle?: string;
  /** Parágrafos de corpo — suportam HTML limitado (b, strong, a) */
  bodyParagraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  /** Cor de destaque (substitui BRAND_COLOR no header e no botão) */
  accentColor?: string;
  /** Validade da oferta */
  expiresAt?: Date;
  /** Lista de benefícios (bullets) */
  benefits?: string[];
  /** Destinatários: 'all' | 'trial' | 'paid' | 'churned' */
  audience?: string;
  /** Token de unsubscribe para esta campanha específica */
  unsubscribeToken?: string;
  /** Rodapé extra (termos, restrições) */
  legalNote?: string;
}

export function promotionEmailTemplate(
  config: PromotionEmailConfig,
  userName?: string,
): string {
  const {
    badge, badgeColor = BRAND_COLOR, title, subtitle,
    bodyParagraphs, ctaLabel, ctaUrl, accentColor = BRAND_COLOR,
    expiresAt, benefits, legalNote, unsubscribeToken,
  } = config;

  let content = '';

  if (userName) {
    content += `<p style="margin:0 0 16px;font-size:15px;color:${MUTED_COLOR};">Olá, <strong style="color:${TEXT_COLOR};">${escapeHtml(userName)}</strong>.</p>`;
  }

  if (badge) {
    content += `<p style="margin:0 0 10px;">
      <span style="display:inline-block;background-color:${badgeColor};color:#ffffff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em;">
        ${escapeHtml(badge)}
      </span>
    </p>`;
  }

  content += titleHtml(escapeHtml(title));

  if (subtitle) {
    content += `<p style="margin:-8px 0 16px;font-size:17px;color:${MUTED_COLOR};line-height:1.4;">${escapeHtml(subtitle)}</p>`;
  }

  bodyParagraphs.forEach(p => { content += paragraph(p); });

  if (benefits && benefits.length > 0) {
    const items = benefits.map(b =>
      `<tr><td style="padding:6px 0;font-size:14px;color:${TEXT_COLOR};">
        <span style="color:${SUCCESS_COLOR};font-weight:700;margin-right:8px;">&#10003;</span>${escapeHtml(b)}
      </td></tr>`
    ).join('');
    content += `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;"><tbody>${items}</tbody></table>`;
  }

  if (expiresAt) {
    content += infoBox(
      `<p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">Oferta valida ate ${formatDate(expiresAt)}</p>`,
      WARNING_COLOR,
      '#fffbeb',
    );
  }

  content += ctaButton(safeUrl(ctaUrl) ?? '#', ctaLabel, accentColor);

  if (legalNote) {
    content += mutedText(escapeHtml(legalNote));
  }

  return wrapContent(content, {
    preheader: escapeHtml(subtitle ?? title).slice(0, 90),
    accentColor,
    unsubscribeToken,
  });
}

/**
 * Anúncio de nova funcionalidade — editável pelo admin.
 */
export interface FeatureAnnouncementConfig {
  featureName: string;
  tagline: string;
  description: string[];
  ctaLabel: string;
  ctaUrl: string;
  /** Lista de benefícios da nova feature */
  benefits?: string[];
  badge?: string;
}

export function featureAnnouncementTemplate(
  config: FeatureAnnouncementConfig,
  userName?: string,
): string {
  const { featureName, tagline, description, ctaLabel, ctaUrl, benefits, badge } = config;

  let content = '';
  if (userName) {
    content += `<p style="margin:0 0 16px;font-size:15px;color:${MUTED_COLOR};">Olá, <strong style="color:${TEXT_COLOR};">${escapeHtml(userName)}</strong>.</p>`;
  }
  if (badge) {
    content += `<p style="margin:0 0 10px;">
      <span style="display:inline-block;background-color:${BRAND_COLOR};color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em;">
        ${escapeHtml(badge)}
      </span>
    </p>`;
  }
  content += titleHtml(escapeHtml(featureName));
  content += `<p style="margin:-8px 0 16px;font-size:17px;color:${MUTED_COLOR};line-height:1.4;">${escapeHtml(tagline)}</p>`;
  description.forEach(p => { content += paragraph(p); });
  if (benefits?.length) {
    const items = benefits.map(b =>
      `<tr><td style="padding:6px 0;font-size:14px;color:${TEXT_COLOR};">
        <span style="color:${BRAND_COLOR};font-weight:700;margin-right:8px;">&#8594;</span>${escapeHtml(b)}
      </td></tr>`
    ).join('');
    content += `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;"><tbody>${items}</tbody></table>`;
  }
  content += ctaButton(safeUrl(ctaUrl) ?? '#', ctaLabel, BRAND_COLOR);

  return wrapContent(content, {
    preheader: `Novidade no PrecisionAI: ${escapeHtml(featureName)} — ${escapeHtml(tagline)}`.slice(0, 90),
    accentColor: BRAND_COLOR,
  });
}

/**
 * E-mail de reengajamento — para usuários inativos (editável pelo admin).
 */
export interface ReengagementConfig {
  inactiveDays: number;
  highlight: string;         // o que melhorou desde que saiu
  incentive?: string;        // ex: "Ganhe 100 buscas grátis"
  ctaLabel: string;
  ctaUrl: string;
}

export function reengagementTemplate(
  config: ReengagementConfig,
  userName?: string,
): string {
  const { inactiveDays, highlight, incentive, ctaLabel, ctaUrl } = config;
  return buildEmail({
    title: 'Sentimos sua falta no PrecisionAI',
    preheader: incentive ?? `Volte e veja o que mudou nos últimos ${inactiveDays} dias.`,
    userName,
    body: [
      `Faz ${inactiveDays} dias que você não acessa o PrecisionAI.`,
      `Enquanto isso, melhoramos bastante: ${escapeHtml(highlight)}`,
      ...(incentive ? [`<strong>${escapeHtml(incentive)}</strong> — para você que está voltando.`] : []),
    ],
    ctaHref: ctaUrl,
    ctaLabel,
    accentColor: BRAND_COLOR,
    footerNote: 'Se não quiser receber e-mails de reengajamento, descadastre-se pelo link abaixo.',
  });
}
