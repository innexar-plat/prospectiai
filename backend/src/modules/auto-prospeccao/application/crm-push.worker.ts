import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  getValidRdStationAccessToken,
  getRdProductMode,
  forceRefreshRdTokenIfPossible,
} from '@/lib/rdstation-oauth';
import { getValidHubspotAccessToken, forceRefreshHubspotTokenIfPossible } from '@/lib/hubspot-oauth';
import { getAgendorApiTokenForUser } from '@/lib/agendor-config';
import type { ProspectedLead } from '@prisma/client';

interface CrmPushResult {
  pushed: number;
  failed: number;
}

/**
 * Envia leads HOT para o CRM configurado no workspace.
 * Usa crmOwnerUserId para obter o token de acesso correto.
 */
export async function runCrmPushWorker(
  workspaceId: string,
  runId: string,
  maxPushPerRun: number,
): Promise<CrmPushResult> {
  const config = await prisma.autoProspeccaoConfig.findUnique({
    where: { workspaceId },
  });

  if (!config?.crmAutoSend || !config.crmProvider || !config.crmOwnerUserId) {
    return { pushed: 0, failed: 0 };
  }

  const leads = await prisma.prospectedLead.findMany({
    where: {
      workspaceId,
      status: { in: ['HOT', 'EMAILING'] },
      crmPushedAt: null,
    },
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    take: maxPushPerRun,
  });

  let pushed = 0;
  let failed = 0;

  for (const lead of leads) {
    try {
      const crmId = await pushLeadToCrm(lead, config.crmProvider, config.crmOwnerUserId);
      await prisma.prospectedLead.update({
        where: { id: lead.id },
        data: {
          status: 'CRM_SENT',
          crmProvider: config.crmProvider,
          crmId: crmId ?? null,
          crmPushedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      pushed++;
    } catch (err) {
      logger.error('crm-push.worker: failed to push lead', {
        leadId: lead.id,
        provider: config.crmProvider,
        error: err instanceof Error ? err.message : 'Unknown',
      });
      failed++;
    }
  }

  await prisma.autoProspeccaoRun.update({
    where: { id: runId },
    data: { crmPushed: pushed },
  });

  return { pushed, failed };
}

/**
 * Empurra um único lead para o CRM especificado.
 * Retorna o ID externo do contato no CRM (se disponível).
 */
export async function pushSingleLeadToCrm(
  leadId: string,
  workspaceId: string,
): Promise<{ crmId: string | null; provider: string }> {
  const lead = await prisma.prospectedLead.findUnique({ where: { id: leadId } });
  if (!lead || lead.workspaceId !== workspaceId) throw new Error('Lead not found');

  const config = await prisma.autoProspeccaoConfig.findUnique({ where: { workspaceId } });
  if (!config?.crmProvider || !config.crmOwnerUserId) {
    throw new Error('CRM não configurado para este workspace');
  }

  const crmId = await pushLeadToCrm(lead, config.crmProvider, config.crmOwnerUserId);

  await prisma.prospectedLead.update({
    where: { id: leadId },
    data: {
      status: 'CRM_SENT',
      crmProvider: config.crmProvider,
      crmId: crmId ?? null,
      crmPushedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return { crmId, provider: config.crmProvider };
}

async function pushLeadToCrm(
  lead: ProspectedLead,
  crmProvider: string,
  ownerUserId: string,
): Promise<string | null> {
  switch (crmProvider) {
    case 'rdstation':
      return pushToRdStation(lead, ownerUserId);
    case 'hubspot':
      return pushToHubspot(lead, ownerUserId);
    case 'agendor':
      return pushToAgendor(lead, ownerUserId);
    default:
      throw new Error(`CRM provider not supported: ${crmProvider}`);
  }
}

async function pushToRdStation(lead: ProspectedLead, ownerUserId: string): Promise<string | null> {
  let token = await getValidRdStationAccessToken(ownerUserId);
  if (!token) throw new Error('RD Station token not available');

  const mode = getRdProductMode();
  const url =
    mode === 'marketing'
      ? 'https://api.rd.services/platform/events'
      : 'https://api.rd.services/crm/v2/contacts';

  const body =
    mode === 'marketing'
      ? buildRdMarketingPayload(lead)
      : buildRdCrmPayload(lead);

  let res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Tentar refresh automático se 401
  if (res.status === 401) {
    token = await forceRefreshRdTokenIfPossible(ownerUserId);
    if (!token) throw new Error('RD Station token refresh failed');
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`RD Station error ${res.status}: ${JSON.stringify(errBody)}`);
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string; data?: { id?: string } };
  return data?.data?.id ?? data?.id ?? null;
}

async function pushToHubspot(lead: ProspectedLead, ownerUserId: string): Promise<string | null> {
  let token = await getValidHubspotAccessToken(ownerUserId);
  if (!token) throw new Error('HubSpot token not available');

  const body = {
    properties: {
      company: lead.razaoSocial,
      email: lead.email ?? undefined,
      phone: lead.telefone ? `${lead.ddd ?? ''}${lead.telefone}` : undefined,
      city: lead.municipio ?? undefined,
      state: lead.uf ?? undefined,
    },
  };

  let res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    token = await forceRefreshHubspotTokenIfPossible(ownerUserId);
    if (!token) throw new Error('HubSpot token refresh failed');
    res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`HubSpot error ${res.status}: ${JSON.stringify(errBody)}`);
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return data?.id ?? null;
}

async function pushToAgendor(lead: ProspectedLead, ownerUserId: string): Promise<string | null> {
  const { token } = await getAgendorApiTokenForUser(ownerUserId);
  if (!token) throw new Error('Agendor token not available');

  const body = {
    name: lead.razaoSocial,
    cnpj: lead.cnpj,
    email: lead.email ?? undefined,
    phone: lead.telefone ? `${lead.ddd ?? ''}${lead.telefone}` : undefined,
    city: lead.municipio ?? undefined,
    state: lead.uf ?? undefined,
  };

  const res = await fetch('https://api.agendor.com.br/v3/organizations', {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`Agendor error ${res.status}: ${JSON.stringify(errBody)}`);
  }

  const data = (await res.json().catch(() => ({}))) as { data?: { id?: number } };
  return data?.data?.id != null ? String(data.data.id) : null;
}

function buildRdMarketingPayload(lead: ProspectedLead) {
  return {
    event_type: 'CONVERSION',
    event_family: 'CDP',
    payload: {
      email: lead.email ?? `${lead.cnpj}@prospeccao.invalid`,
      name: lead.razaoSocial,
      company_name: lead.razaoSocial,
      cf_cnpj: lead.cnpj,
      cf_uf: lead.uf ?? '',
      cf_porte: lead.porte ?? '',
      cf_score: lead.score != null ? String(lead.score) : '',
    },
  };
}

function buildRdCrmPayload(lead: ProspectedLead) {
  return {
    data: {
      name: lead.razaoSocial,
      emails: lead.email ? [{ email: lead.email }] : [],
      phones: lead.telefone ? [{ phone: `${lead.ddd ?? ''}${lead.telefone}` }] : [],
      city: lead.municipio ?? undefined,
      state: lead.uf ?? undefined,
    },
  };
}
