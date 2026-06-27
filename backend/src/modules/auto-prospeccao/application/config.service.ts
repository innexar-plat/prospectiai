import { prisma } from '@/lib/prisma';
import type { ConfigInput } from '../domain/types';

/** Lê ou cria config padrão para uma workspace */
export async function getConfig(workspaceId: string) {
  const config = await prisma.autoProspeccaoConfig.findUnique({ where: { workspaceId } });
  if (config) return config;

  // Cria config padrão (sem ativar)
  return prisma.autoProspeccaoConfig.create({
    data: { workspaceId, updatedAt: new Date() },
  });
}

/** Salva configuração da workspace */
export async function updateConfig(workspaceId: string, input: ConfigInput) {
  const existing = await prisma.autoProspeccaoConfig.findUnique({ where: { workspaceId } });

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.scheduleDays !== undefined) data.scheduleDays = input.scheduleDays;
  if (input.scheduleTimeStart !== undefined) data.scheduleTimeStart = input.scheduleTimeStart;
  if (input.scheduleTimeEnd !== undefined) data.scheduleTimeEnd = input.scheduleTimeEnd;
  if (input.searchIntervalHours !== undefined) data.searchIntervalHours = input.searchIntervalHours;
  if (input.analyzeDelayMinutes !== undefined) data.analyzeDelayMinutes = input.analyzeDelayMinutes;
  if (input.maxLeadsPerRun !== undefined) data.maxLeadsPerRun = input.maxLeadsPerRun;
  if (input.maxEmailsPerDay !== undefined) data.maxEmailsPerDay = input.maxEmailsPerDay;
  if (input.maxCrmPushPerDay !== undefined) data.maxCrmPushPerDay = input.maxCrmPushPerDay;
  if (input.hotScoreMin !== undefined) data.hotScoreMin = input.hotScoreMin;
  if (input.warmScoreMin !== undefined) data.warmScoreMin = input.warmScoreMin;
  if (input.crmAutoSend !== undefined) data.crmAutoSend = input.crmAutoSend;
  if ('crmProvider' in input) data.crmProvider = input.crmProvider ?? null;
  if ('crmOwnerUserId' in input) data.crmOwnerUserId = input.crmOwnerUserId ?? null;
  if (input.emailAutoSend !== undefined) data.emailAutoSend = input.emailAutoSend;
  if ('defaultSequenceId' in input) data.defaultSequenceId = input.defaultSequenceId ?? null;
  if (input.blockedCnpjs !== undefined) data.blockedCnpjs = input.blockedCnpjs;
  if (input.whatsappEnabled !== undefined) data.whatsappEnabled = input.whatsappEnabled;

  if (existing) {
    return prisma.autoProspeccaoConfig.update({ where: { workspaceId }, data });
  }
  return prisma.autoProspeccaoConfig.create({
    data: { workspaceId, ...data } as Parameters<typeof prisma.autoProspeccaoConfig.create>[0]['data'],
  });
}
