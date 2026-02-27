import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth';

export type AuditAction =
  | 'admin.stats'
  | 'admin.users.list'
  | 'admin.users.get'
  | 'admin.workspaces.list'
  | 'admin.workspaces.get'
  | 'admin.search-history.list'
  | 'admin.leads.list'
  | 'admin.audit-logs.list'
  | 'system.migrate-workspace'
  | 'support.users.list'
  | 'support.users.get'
  | 'support.users.activate'
  | 'support.users.deactivate'
  | 'admin.ai-config.list'
  | 'admin.ai-config.create'
  | 'admin.ai-config.update'
  | 'admin.ai-config.delete'
  | 'admin.ai-config.test'
  | 'admin.web-search-config.list'
  | 'admin.web-search-config.upsert'
  | 'admin.plans.create'
  | 'admin.plans.update'
  | 'admin.plans.delete'
  | 'admin.users.reset-password'
  | 'admin.workspaces.update'
  | 'support.users.reset-password';

/**
 * Registra ação admin no audit log (não bloqueia a resposta em caso de falha).
 */
export async function logAdminAction(
  session: Session | null,
  action: AuditAction,
  options?: { resource?: string; resourceId?: string; details?: Record<string, unknown> }
): Promise<void> {
  if (!session?.user?.id) return;
  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        adminEmail: session.user.email ?? undefined,
        action,
        resource: options?.resource,
        resourceId: options?.resourceId,
        details: (options?.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // audit is best-effort; do not fail the request
  }
}

/** Registra ação de suporte (admin ou support) no audit log. */
export async function logSupportAction(
  session: Session | null,
  action: Extract<AuditAction, `support.${string}`>,
  options?: { resource?: string; resourceId?: string; details?: Record<string, unknown> }
): Promise<void> {
  return logAdminAction(session, action, options);
}
