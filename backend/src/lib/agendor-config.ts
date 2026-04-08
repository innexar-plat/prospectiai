import { decryptEmailSecret } from '@/lib/email-config-encrypt';
import { prisma } from '@/lib/prisma';

export async function getAgendorApiTokenForUser(userId: string): Promise<{ token: string | null; source: 'env' | 'user' | null }> {
  const envToken = process.env.AGENDOR_API_TOKEN?.trim();
  if (envToken) return { token: envToken, source: 'env' };

  const row = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { agendorApiTokenEncrypted: true },
    })
    .catch(() => null) as { agendorApiTokenEncrypted?: string | null } | null;

  const encrypted = row?.agendorApiTokenEncrypted?.trim();
  if (!encrypted) return { token: null, source: null };

  const decrypted = decryptEmailSecret(encrypted).trim();
  return decrypted.length > 0 ? { token: decrypted, source: 'user' } : { token: null, source: null };
}

export async function countAgendorConnectedUsers(): Promise<number> {
  return prisma.user.count({ where: { agendorApiTokenEncrypted: { not: null } } });
}
