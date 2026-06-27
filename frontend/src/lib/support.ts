/**
 * Contato de suporte (e-mail e WhatsApp).
 * VITE_SUPPORT_EMAIL / VITE_SUPPORT_WHATSAPP aplicam-se ao mercado BR;
 * no mercado US ignoramos overrides BR do .env compartilhado.
 */
import { getActiveMarket } from '@/lib/market';

const BR_SUPPORT_EMAIL = 'suporte@precisionia.com.br';
const US_SUPPORT_EMAIL = 'support@precisionai.innexar.app';
const DEFAULT_BR_WHATSAPP = '5511912801461';

const rawEmail = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_EMAIL;
const rawWhatsApp = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_WHATSAPP;

function readEnvEmail(): string | null {
  return typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim() : null;
}

function isBrSupportEmail(email: string): boolean {
  return email === BR_SUPPORT_EMAIL || email.endsWith('@precisionia.com.br');
}

export function getSupportEmail(): string {
  const envEmail = readEnvEmail();
  if (getActiveMarket() === 'US') {
    if (envEmail && !isBrSupportEmail(envEmail)) return envEmail;
    return US_SUPPORT_EMAIL;
  }
  return envEmail ?? BR_SUPPORT_EMAIL;
}

/** WhatsApp support is BR-only; returns null for US market. */
export function getSupportWhatsAppUrl(): string | null {
  if (getActiveMarket() === 'US') return null;

  const envDigits =
    typeof rawWhatsApp === 'string' && rawWhatsApp.trim()
      ? rawWhatsApp.trim().replace(/\D/g, '')
      : null;
  const digits = envDigits || DEFAULT_BR_WHATSAPP;
  return digits ? `https://wa.me/${digits}` : null;
}
