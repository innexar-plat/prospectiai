import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { SearchProfileInput } from '../domain/types';

export async function listProfiles(workspaceId: string) {
  const [system, workspace] = await Promise.all([
    prisma.searchProfile.findMany({
      where: { isSystem: true, isActive: true },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    }),
    prisma.searchProfile.findMany({
      where: { workspaceId, isSystem: false },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    }),
  ]);
  return { system, workspace };
}

export async function getProfile(id: string, workspaceId: string) {
  const profile = await prisma.searchProfile.findUnique({ where: { id } });
  if (!profile) return null;
  // Allow access if system or belongs to workspace
  if (!profile.isSystem && profile.workspaceId !== workspaceId) return null;
  return profile;
}

export async function createProfile(workspaceId: string, input: SearchProfileInput) {
  return prisma.searchProfile.create({
    data: {
      workspaceId,
      isSystem: false,
      name: input.name,
      description: input.description ?? null,
      priority: input.priority ?? 0,
      cnae: input.cnae ?? null,
      cnaeList: (input.cnaeList as Prisma.InputJsonValue) ?? undefined,
      uf: (input.uf as Prisma.InputJsonValue) ?? undefined,
      municipio: input.municipio ?? null,
      porte: (input.porte as Prisma.InputJsonValue) ?? undefined,
      hasEmail: input.hasEmail ?? null,
      hasPhone: input.hasPhone ?? null,
      minCapital: input.minCapital ?? null,
      openedAfter: input.openedAfter ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function updateProfile(id: string, workspaceId: string, input: Partial<SearchProfileInput>) {
  // Cannot edit system profiles
  const profile = await prisma.searchProfile.findUnique({ where: { id } });
  if (!profile || profile.isSystem) throw new Error('Cannot edit system profile');
  if (profile.workspaceId !== workspaceId) throw new Error('Not found');

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description ?? null;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.cnae !== undefined) data.cnae = input.cnae ?? null;
  if (input.cnaeList !== undefined) data.cnaeList = input.cnaeList ?? null;
  if (input.uf !== undefined) data.uf = input.uf ?? null;
  if (input.municipio !== undefined) data.municipio = input.municipio ?? null;
  if (input.porte !== undefined) data.porte = input.porte ?? null;
  if (input.hasEmail !== undefined) data.hasEmail = input.hasEmail ?? null;
  if (input.hasPhone !== undefined) data.hasPhone = input.hasPhone ?? null;
  if (input.minCapital !== undefined) data.minCapital = input.minCapital ?? null;
  if (input.openedAfter !== undefined) data.openedAfter = input.openedAfter ?? null;

  return prisma.searchProfile.update({ where: { id }, data });
}

export async function deleteProfile(id: string, workspaceId: string) {
  const profile = await prisma.searchProfile.findUnique({ where: { id } });
  if (!profile || profile.isSystem) throw new Error('Cannot delete system profile');
  if (profile.workspaceId !== workspaceId) throw new Error('Not found');

  const leadsCount = await prisma.prospectedLead.count({ where: { searchProfileId: id } });
  if (leadsCount > 0) throw new Error('Cannot delete profile with associated leads');

  return prisma.searchProfile.delete({ where: { id } });
}

export async function toggleProfile(id: string, workspaceId: string) {
  const profile = await prisma.searchProfile.findUnique({ where: { id } });
  if (!profile) throw new Error('Not found');
  if (profile.workspaceId !== workspaceId && !profile.isSystem) throw new Error('Not found');

  return prisma.searchProfile.update({
    where: { id },
    data: { isActive: !profile.isActive, updatedAt: new Date() },
  });
}
