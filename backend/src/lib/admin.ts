import type { Session } from 'next-auth';

const ADMIN_EMAILS_KEY = 'ADMIN_EMAILS';
const SUPPORT_EMAILS_KEY = 'SUPPORT_EMAILS';

function parseEmailList(key: string): string[] {
  const list = process.env[key];
  if (!list || typeof list !== 'string') return [];
  return list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Log at load so we can confirm env in container logs (count only, no emails)
const _adminCount = parseEmailList(ADMIN_EMAILS_KEY).length;
const _supportCount = parseEmailList(SUPPORT_EMAILS_KEY).length;
if (process.env.NODE_ENV !== 'test') {
  console.log('[ADMIN] Config - ADMIN_EMAILS count:', _adminCount, 'SUPPORT_EMAILS count:', _supportCount);
}

/**
 * Verifica se a sessão pertence a um administrador.
 * ADMIN_EMAILS = lista de emails separados por vírgula (trim, lowercase).
 */
export function isAdmin(session: Session | null): boolean {
  if (!session?.user?.email) return false;
  const emails = parseEmailList(ADMIN_EMAILS_KEY);
  return emails.includes(session.user.email.toLowerCase());
}

/**
 * Verifica se a sessão pertence ao suporte (ou admin; admin tem acesso a tudo).
 * SUPPORT_EMAILS = lista de emails separados por vírgula.
 */
export function isSupport(session: Session | null): boolean {
  if (!session?.user?.email) return false;
  if (isAdmin(session)) return true;
  const emails = parseEmailList(SUPPORT_EMAILS_KEY);
  return emails.includes(session.user.email.toLowerCase());
}

export type PanelRole = 'admin' | 'support' | null;

/**
 * Retorna o papel do usuário no painel: admin (acesso total) ou support (só suporte).
 * Se email estiver em ambos, retorna admin. Se não estiver em nenhum, null.
 */
export function getPanelRole(session: Session | null): PanelRole {
  if (!session?.user?.email) return null;
  const adminEmails = parseEmailList(ADMIN_EMAILS_KEY);
  const supportEmails = parseEmailList(SUPPORT_EMAILS_KEY);
  const email = session.user.email.toLowerCase();
  if (adminEmails.includes(email)) return 'admin';
  if (supportEmails.includes(email)) return 'support';
  return null;
}
