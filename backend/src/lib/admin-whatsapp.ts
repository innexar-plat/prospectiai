/**
 * Singleton "company" WhatsApp connection for the admin/support account — one row,
 * created on first use. Mirrors the same provider fields as Representative so the shared
 * chat/provider abstraction (whatsapp-chat.ts, whatsapp-send.ts) works identically for both.
 */
import { prisma } from '@/lib/prisma';
import type { AdminWhatsAppConfig } from '@prisma/client';

export async function getOrCreateAdminWhatsAppConfig(): Promise<AdminWhatsAppConfig> {
    const existing = await prisma.adminWhatsAppConfig.findFirst();
    if (existing) return existing;
    return prisma.adminWhatsAppConfig.create({ data: {} });
}

export function instanceNameForAdmin(configId: string): string {
    return `admin_${configId}`;
}
