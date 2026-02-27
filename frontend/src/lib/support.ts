/**
 * Contato de suporte (e-mail e WhatsApp).
 * Configurável via VITE_SUPPORT_EMAIL e VITE_SUPPORT_WHATSAPP (número com DDI, ex: 5511912801461).
 */
const rawEmail = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_EMAIL;
const rawWhatsApp = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_WHATSAPP;

export const SUPPORT_EMAIL: string =
  typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim() : 'support@innexar.com.br';

const whatsAppNumber = typeof rawWhatsApp === 'string' && rawWhatsApp.trim()
  ? rawWhatsApp.trim().replace(/\D/g, '')
  : '5511912801461';

export const SUPPORT_WHATSAPP_URL: string = `https://wa.me/${whatsAppNumber}`;
