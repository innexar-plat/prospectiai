import { prisma } from '@/lib/prisma';
import type { Prisma, AutoProspTemplateType } from '@prisma/client';
import type { TemplateInput } from '../domain/types';

export async function listTemplates(workspaceId: string) {
  const [system, workspace] = await Promise.all([
    prisma.autoProspeccaoTemplate.findMany({
      where: { isSystem: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.autoProspeccaoTemplate.findMany({
      where: { workspaceId, isSystem: false },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
  ]);
  return { system, workspace };
}

export async function getTemplate(id: string, workspaceId: string) {
  const t = await prisma.autoProspeccaoTemplate.findUnique({ where: { id } });
  if (!t) return null;
  if (!t.isSystem && t.workspaceId !== workspaceId) return null;
  return t;
}

export async function createTemplate(workspaceId: string, createdBy: string, input: TemplateInput) {
  return prisma.autoProspeccaoTemplate.create({
    data: {
      workspaceId,
      isSystem: false,
      createdBy,
      name: input.name,
      type: input.type as AutoProspTemplateType,
      subject: input.subject,
      preheader: input.preheader ?? null,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText ?? null,
      variables: (input.variables as Prisma.InputJsonValue) ?? undefined,
      targetCnae: input.targetCnae ?? null,
      targetSegment: input.targetSegment ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function updateTemplate(id: string, workspaceId: string, input: Partial<TemplateInput>) {
  const t = await prisma.autoProspeccaoTemplate.findUnique({ where: { id } });
  if (!t || t.isSystem) throw new Error('Cannot edit system template');
  if (t.workspaceId !== workspaceId) throw new Error('Not found');

  return prisma.autoProspeccaoTemplate.update({
    where: { id },
    data: {
      ...input,
      variables: input.variables as Prisma.InputJsonValue ?? undefined,
      updatedAt: new Date(),
    },
  });
}

export async function deleteTemplate(id: string, workspaceId: string) {
  const t = await prisma.autoProspeccaoTemplate.findUnique({ where: { id } });
  if (!t || t.isSystem) throw new Error('Cannot delete system template');
  if (t.workspaceId !== workspaceId) throw new Error('Not found');
  return prisma.autoProspeccaoTemplate.delete({ where: { id } });
}

/** Clona um template do sistema para uma workspace */
export async function cloneSystemTemplate(id: string, workspaceId: string, userId: string) {
  const t = await prisma.autoProspeccaoTemplate.findUnique({ where: { id } });
  if (!t || !t.isSystem) throw new Error('Not a system template');
  return prisma.autoProspeccaoTemplate.create({
    data: {
      workspaceId,
      isSystem: false,
      createdBy: userId,
      name: `${t.name} (cópia)`,
      type: t.type,
      subject: t.subject,
      preheader: t.preheader,
      bodyHtml: t.bodyHtml,
      bodyText: t.bodyText,
      variables: t.variables as Prisma.InputJsonValue ?? undefined,
      targetCnae: t.targetCnae,
      targetSegment: t.targetSegment,
      updatedAt: new Date(),
    },
  });
}
