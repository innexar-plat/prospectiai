/**
 * CRM: pipeline of deals per workspace (kanban), activities/tasks and forecast metrics.
 * Every function is scoped by workspaceId — callers resolve it from the session first.
 */
import type { CrmActivityType, CrmStageKind, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class CrmError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Won/lost deals stay visible on the board for this long. */
const CLOSED_VISIBLE_DAYS = 30;

export const DEFAULT_STAGES: Array<{ name: string; probability: number; kind: CrmStageKind; color: string }> = [
    { name: 'Novo lead', probability: 10, kind: 'OPEN', color: 'slate' },
    { name: 'Contato feito', probability: 25, kind: 'OPEN', color: 'sky' },
    { name: 'Reunião / diagnóstico', probability: 45, kind: 'OPEN', color: 'violet' },
    { name: 'Proposta enviada', probability: 65, kind: 'OPEN', color: 'amber' },
    { name: 'Negociação', probability: 80, kind: 'OPEN', color: 'orange' },
    { name: 'Ganho', probability: 100, kind: 'WON', color: 'emerald' },
    { name: 'Perdido', probability: 0, kind: 'LOST', color: 'red' },
];

export async function resolveCrmWorkspace(userId: string): Promise<string> {
    const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        orderBy: { workspace: { createdAt: 'asc' } },
        select: { workspaceId: true },
    });
    if (!membership) throw new CrmError('Workspace not found', 404);
    return membership.workspaceId;
}

export async function ensureDefaultPipeline(workspaceId: string) {
    const existing = await prisma.crmPipeline.findFirst({
        where: { workspaceId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.crmPipeline.create({
        data: {
            workspaceId,
            name: 'Vendas',
            isDefault: true,
            stages: { create: DEFAULT_STAGES.map((s, i) => ({ ...s, position: i })) },
        },
        select: { id: true },
    });
    return created.id;
}

async function pipelineOf(workspaceId: string, pipelineId?: string | null) {
    const id = pipelineId ?? (await ensureDefaultPipeline(workspaceId));
    const pipeline = await prisma.crmPipeline.findFirst({
        where: { id, workspaceId },
        select: { id: true, name: true, stages: { orderBy: { position: 'asc' } } },
    });
    if (!pipeline) throw new CrmError('Pipeline not found', 404);
    return pipeline;
}

async function dealOf(workspaceId: string, dealId: string) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, workspaceId }, include: { stage: true } });
    if (!deal) throw new CrmError('Deal not found', 404);
    return deal;
}

const DEAL_CARD_SELECT = {
    id: true, title: true, value: true, stageId: true, position: true, companyName: true, contactName: true,
    contactPhone: true, contactEmail: true, ownerUserId: true, expectedCloseAt: true, leadAnalysisId: true,
    lastActivityAt: true, wonAt: true, lostAt: true, createdAt: true, source: true,
} as const;

export interface BoardFilters {
    pipelineId?: string | null;
    ownerUserId?: string | null;
    q?: string | null;
}

export async function getBoard(workspaceId: string, filters: BoardFilters = {}, now = new Date()) {
    const pipeline = await pipelineOf(workspaceId, filters.pipelineId);
    const closedSince = new Date(now.getTime() - CLOSED_VISIBLE_DAYS * DAY_MS);
    const q = filters.q?.trim();
    const where: Prisma.CrmDealWhereInput = {
        workspaceId,
        pipelineId: pipeline.id,
        ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
        ...(q ? { OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { companyName: { contains: q, mode: 'insensitive' } },
            { contactName: { contains: q, mode: 'insensitive' } },
        ] } : {}),
        // Closed deals only for a while — the board is about what is still in play.
        AND: [{ OR: [{ stage: { kind: 'OPEN' } }, { wonAt: { gte: closedSince } }, { lostAt: { gte: closedSince } }] }],
    };
    const [deals, overdueTasks, nextTasks] = await Promise.all([
        prisma.crmDeal.findMany({ where, orderBy: [{ position: 'asc' }, { createdAt: 'desc' }], take: 1000, select: DEAL_CARD_SELECT }),
        prisma.crmActivity.count({ where: { workspaceId, type: 'TASK', doneAt: null, dueAt: { lt: now }, deal: { pipelineId: pipeline.id } } }),
        prisma.crmActivity.findMany({
            where: { workspaceId, doneAt: null, dueAt: { not: null }, deal: { pipelineId: pipeline.id } },
            orderBy: { dueAt: 'asc' },
            select: { dealId: true, dueAt: true, title: true, type: true },
            take: 2000,
        }),
    ]);
    const nextByDeal = new Map<string, { dueAt: Date | null; title: string | null; type: CrmActivityType }>();
    for (const t of nextTasks) if (!nextByDeal.has(t.dealId)) nextByDeal.set(t.dealId, t);

    const stages = pipeline.stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stageId === stage.id).map((d) => ({ ...d, nextActivity: nextByDeal.get(d.id) ?? null }));
        const value = stageDeals.reduce((s, d) => s + d.value, 0);
        return { ...stage, deals: stageDeals, count: stageDeals.length, value, weighted: (value * stage.probability) / 100 };
    });

    return { pipeline: { id: pipeline.id, name: pipeline.name }, stages, metrics: await getMetrics(workspaceId, pipeline.id, now, overdueTasks) };
}

export async function getMetrics(workspaceId: string, pipelineId: string, now = new Date(), overdueTasks?: number) {
    const ninetyDays = new Date(now.getTime() - 90 * DAY_MS);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [open, won90, lost90, wonMonth, overdue] = await Promise.all([
        prisma.crmDeal.findMany({ where: { workspaceId, pipelineId, stage: { kind: 'OPEN' } }, select: { value: true, stage: { select: { probability: true } } } }),
        prisma.crmDeal.findMany({ where: { workspaceId, pipelineId, wonAt: { gte: ninetyDays } }, select: { value: true, createdAt: true, wonAt: true } }),
        prisma.crmDeal.count({ where: { workspaceId, pipelineId, lostAt: { gte: ninetyDays } } }),
        prisma.crmDeal.aggregate({ where: { workspaceId, pipelineId, wonAt: { gte: monthStart } }, _sum: { value: true }, _count: true }),
        overdueTasks ?? prisma.crmActivity.count({ where: { workspaceId, type: 'TASK', doneAt: null, dueAt: { lt: now }, deal: { pipelineId } } }),
    ]);
    const cycles = won90.filter((d) => d.wonAt).map((d) => (d.wonAt!.getTime() - d.createdAt.getTime()) / DAY_MS);
    return {
        openCount: open.length,
        openValue: open.reduce((s, d) => s + d.value, 0),
        forecast: open.reduce((s, d) => s + (d.value * d.stage.probability) / 100, 0),
        wonThisMonthValue: wonMonth._sum.value ?? 0,
        wonThisMonthCount: wonMonth._count,
        winRate90d: won90.length + lost90 > 0 ? Math.round((won90.length / (won90.length + lost90)) * 100) : null,
        avgCycleDays: cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null,
        overdueTasks: overdue,
    };
}

export interface DealInput {
    title?: string;
    value?: number;
    stageId?: string;
    pipelineId?: string;
    expectedCloseAt?: string | null;
    ownerUserId?: string | null;
    companyName?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    leadAnalysisId?: string | null;
}

async function assertMember(workspaceId: string, userId: string | null | undefined) {
    if (!userId) return;
    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId }, select: { id: true } });
    if (!member) throw new CrmError('Responsável não pertence ao workspace', 400);
}

export async function createDeal(workspaceId: string, userId: string, input: DealInput) {
    const pipeline = await pipelineOf(workspaceId, input.pipelineId);
    const stage = input.stageId ? pipeline.stages.find((s) => s.id === input.stageId) : pipeline.stages.find((s) => s.kind === 'OPEN');
    if (!stage) throw new CrmError('Stage not found', 400);
    await assertMember(workspaceId, input.ownerUserId ?? userId);

    // From a saved Precision lead: copy company and contact so the card is useful right away.
    let fromLead: Partial<DealInput> = {};
    if (input.leadAnalysisId) {
        // Clicking "send to CRM" twice must not duplicate the deal.
        const existing = await prisma.crmDeal.findFirst({
            where: { workspaceId, leadAnalysisId: input.leadAnalysisId, stage: { kind: 'OPEN' } },
            select: DEAL_CARD_SELECT,
        });
        if (existing) return existing;
        const analysis = await prisma.leadAnalysis.findFirst({
            where: { id: input.leadAnalysisId, OR: [{ workspaceId }, { userId }] },
            select: { lead: { select: { name: true, phone: true, recommendedPhone: true, email: true, recommendedEmail: true } } },
        });
        if (!analysis) throw new CrmError('Lead not found', 404);
        fromLead = {
            companyName: analysis.lead.name,
            contactPhone: analysis.lead.recommendedPhone || analysis.lead.phone || null,
            contactEmail: analysis.lead.recommendedEmail || analysis.lead.email || null,
        };
    }
    const title = input.title?.trim() || input.companyName?.trim() || fromLead.companyName || 'Nova negociação';
    const top = await prisma.crmDeal.findFirst({ where: { workspaceId, stageId: stage.id }, orderBy: { position: 'asc' }, select: { position: true } });

    const deal = await prisma.crmDeal.create({
        data: {
            workspaceId,
            pipelineId: pipeline.id,
            stageId: stage.id,
            title,
            value: Math.max(0, input.value ?? 0),
            expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null,
            ownerUserId: input.ownerUserId ?? userId,
            leadAnalysisId: input.leadAnalysisId ?? null,
            companyName: input.companyName ?? fromLead.companyName ?? null,
            contactName: input.contactName ?? null,
            contactPhone: input.contactPhone ?? fromLead.contactPhone ?? null,
            contactEmail: input.contactEmail ?? fromLead.contactEmail ?? null,
            source: input.leadAnalysisId ? 'precision' : 'manual',
            position: (top?.position ?? 1) - 1,
            createdById: userId,
            ...(stage.kind === 'WON' ? { wonAt: new Date() } : stage.kind === 'LOST' ? { lostAt: new Date() } : {}),
        },
        select: DEAL_CARD_SELECT,
    });
    return deal;
}

export async function getDeal(workspaceId: string, dealId: string) {
    const deal = await prisma.crmDeal.findFirst({
        where: { id: dealId, workspaceId },
        include: {
            stage: { select: { id: true, name: true, kind: true, probability: true } },
            activities: { orderBy: [{ createdAt: 'desc' }], take: 200 },
        },
    });
    if (!deal) throw new CrmError('Deal not found', 404);
    let leadPlaceId: string | null = null;
    if (deal.leadAnalysisId) {
        const a = await prisma.leadAnalysis.findUnique({ where: { id: deal.leadAnalysisId }, select: { lead: { select: { placeId: true } } } });
        leadPlaceId = a?.lead.placeId ?? null;
    }
    return { ...deal, leadPlaceId };
}

export async function updateDeal(workspaceId: string, dealId: string, input: DealInput) {
    await dealOf(workspaceId, dealId);
    if (input.ownerUserId) await assertMember(workspaceId, input.ownerUserId);
    const data: Prisma.CrmDealUpdateInput = {};
    if (input.title !== undefined) data.title = input.title.trim() || 'Nova negociação';
    if (input.value !== undefined) data.value = Math.max(0, input.value);
    if (input.expectedCloseAt !== undefined) data.expectedCloseAt = input.expectedCloseAt ? new Date(input.expectedCloseAt) : null;
    if (input.ownerUserId !== undefined) data.ownerUserId = input.ownerUserId;
    for (const k of ['companyName', 'contactName', 'contactPhone', 'contactEmail'] as const) {
        if (input[k] !== undefined) data[k] = input[k]?.trim() || null;
    }
    return prisma.crmDeal.update({ where: { id: dealId }, data, select: DEAL_CARD_SELECT });
}

/** Moves a card (drag & drop). Records the stage change; WON/LOST stamp the dates. */
export async function moveDeal(workspaceId: string, userId: string, dealId: string, stageId: string, position: number, lostReason?: string | null) {
    const deal = await dealOf(workspaceId, dealId);
    const stage = await prisma.crmStage.findFirst({ where: { id: stageId, pipelineId: deal.pipelineId } });
    if (!stage) throw new CrmError('Stage not found', 400);
    const now = new Date();
    const changed = stage.id !== deal.stageId;
    const data: Prisma.CrmDealUpdateInput = { stage: { connect: { id: stage.id } }, position };
    if (changed) {
        data.wonAt = stage.kind === 'WON' ? now : null;
        data.lostAt = stage.kind === 'LOST' ? now : null;
        data.lostReason = stage.kind === 'LOST' ? (lostReason?.trim() || null) : null;
        data.lastActivityAt = now;
    }
    const [updated] = await prisma.$transaction([
        prisma.crmDeal.update({ where: { id: dealId }, data, select: DEAL_CARD_SELECT }),
        ...(changed ? [prisma.crmActivity.create({
            data: {
                workspaceId, dealId, userId, type: 'STAGE_CHANGE',
                title: `${deal.stage.name} → ${stage.name}`,
                body: stage.kind === 'LOST' && lostReason ? `Motivo: ${lostReason}` : null,
            },
        })] : []),
    ]);
    return updated;
}

export async function deleteDeal(workspaceId: string, dealId: string) {
    await dealOf(workspaceId, dealId);
    await prisma.crmDeal.delete({ where: { id: dealId } });
}

export async function addActivity(workspaceId: string, userId: string, dealId: string, input: { type: CrmActivityType; title?: string | null; body?: string | null; dueAt?: string | null; done?: boolean }) {
    await dealOf(workspaceId, dealId);
    if (input.type === 'STAGE_CHANGE') throw new CrmError('Invalid activity type', 400);
    const now = new Date();
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    // Notes and logged calls/messages are done when created; tasks and scheduled ones are not.
    const done = input.done ?? (input.type === 'NOTE' || !dueAt);
    const [activity] = await prisma.$transaction([
        prisma.crmActivity.create({
            data: { workspaceId, dealId, userId, type: input.type, title: input.title?.trim() || null, body: input.body?.trim() || null, dueAt, doneAt: done ? now : null },
        }),
        prisma.crmDeal.update({ where: { id: dealId }, data: { lastActivityAt: now } }),
    ]);
    return activity;
}

export async function setActivityDone(workspaceId: string, activityId: string, done: boolean) {
    const activity = await prisma.crmActivity.findFirst({ where: { id: activityId, workspaceId }, select: { id: true } });
    if (!activity) throw new CrmError('Activity not found', 404);
    return prisma.crmActivity.update({ where: { id: activityId }, data: { doneAt: done ? new Date() : null } });
}

export async function deleteActivity(workspaceId: string, activityId: string) {
    const activity = await prisma.crmActivity.findFirst({ where: { id: activityId, workspaceId, type: { not: 'STAGE_CHANGE' } }, select: { id: true } });
    if (!activity) throw new CrmError('Activity not found', 404);
    await prisma.crmActivity.delete({ where: { id: activityId } });
}

export interface StageInput {
    id?: string;
    name: string;
    probability: number;
    kind: CrmStageKind;
    color?: string;
}

/** Replace the stage list (rename, reorder, add, remove). Removing a stage with deals is refused. */
export async function saveStages(workspaceId: string, pipelineId: string, stages: StageInput[]) {
    const pipeline = await pipelineOf(workspaceId, pipelineId);
    if (stages.filter((s) => s.kind === 'OPEN').length === 0) throw new CrmError('O funil precisa de ao menos uma etapa em aberto', 400);
    if (stages.filter((s) => s.kind === 'WON').length !== 1 || stages.filter((s) => s.kind === 'LOST').length !== 1) {
        throw new CrmError('O funil precisa de exatamente uma etapa de Ganho e uma de Perdido', 400);
    }
    const keepIds = new Set(stages.map((s) => s.id).filter(Boolean) as string[]);
    const removed = pipeline.stages.filter((s) => !keepIds.has(s.id));
    if (removed.length) {
        const inUse = await prisma.crmDeal.count({ where: { stageId: { in: removed.map((s) => s.id) } } });
        if (inUse > 0) throw new CrmError('Mova as negociações antes de remover a etapa', 409);
    }
    await prisma.$transaction([
        prisma.crmStage.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } }),
        ...stages.map((s, position) => {
            const data = { name: s.name.trim().slice(0, 60) || 'Etapa', probability: Math.min(100, Math.max(0, Math.round(s.probability))), kind: s.kind, color: s.color ?? 'violet', position };
            return s.id && pipeline.stages.some((p) => p.id === s.id)
                ? prisma.crmStage.update({ where: { id: s.id }, data })
                : prisma.crmStage.create({ data: { ...data, pipelineId: pipeline.id } });
        }),
    ]);
    return (await pipelineOf(workspaceId, pipeline.id)).stages;
}

export function listMembers(workspaceId: string) {
    return prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true, role: true, user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
    });
}

function csvCell(v: unknown): string {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportDealsCsv(workspaceId: string): Promise<string> {
    const deals = await prisma.crmDeal.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 10000,
        include: { stage: { select: { name: true } }, pipeline: { select: { name: true } } },
    });
    const header = ['Negociação', 'Empresa', 'Contato', 'Telefone', 'E-mail', 'Valor', 'Funil', 'Etapa', 'Previsão de fechamento', 'Ganho em', 'Perdido em', 'Motivo da perda', 'Criado em'];
    const rows = deals.map((d) => [
        d.title, d.companyName, d.contactName, d.contactPhone, d.contactEmail, d.value.toFixed(2), d.pipeline.name, d.stage.name,
        d.expectedCloseAt?.toISOString().slice(0, 10), d.wonAt?.toISOString().slice(0, 10), d.lostAt?.toISOString().slice(0, 10), d.lostReason,
        d.createdAt.toISOString().slice(0, 10),
    ].map(csvCell).join(','));
    return '﻿' + [header.join(','), ...rows].join('\n');
}
