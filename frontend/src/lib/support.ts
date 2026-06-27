/**
 * Contato de suporte (e-mail e WhatsApp).
 * Configurável via VITE_SUPPORT_EMAIL e VITE_SUPPORT_WHATSAPP (número com DDI, ex: 5511912801461).
 */
import { getActiveMarket } from '@/lib/market';

const rawEmail = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_EMAIL;
const rawWhatsApp = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_WHATSAPP;

const DEFAULT_SUPPORT_EMAIL =
  getActiveMarket() === 'US' ? 'support@precisionai.innexar.app' : 'suporte@precisionia.com.br';

export const SUPPORT_EMAIL: string =
  typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim() : DEFAULT_SUPPORT_EMAIL;

const whatsAppNumber = typeof rawWhatsApp === 'string' && rawWhatsApp.trim()
  ? rawWhatsApp.trim().replace(/\D/g, '')
  : '5511912801461';

export const SUPPORT_WHATSAPP_URL: string = `https://wa.me/${whatsAppNumber}`;
