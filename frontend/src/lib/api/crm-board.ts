import { request } from './_request';

export type CrmStageKind = 'OPEN' | 'WON' | 'LOST';
export type CrmActivityType = 'NOTE' | 'CALL' | 'WHATSAPP' | 'EMAIL' | 'MEETING' | 'TASK' | 'STAGE_CHANGE';

export interface CrmDealCard {
    id: string;
    title: string;
    value: number;
    stageId: string;
    position: number;
    companyName: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    ownerUserId: string | null;
    expectedCloseAt: string | null;
    leadAnalysisId: string | null;
    lastActivityAt: string | null;
    wonAt: string | null;
    lostAt: string | null;
    createdAt: string;
    source: string;
    nextActivity?: { dueAt: string | null; title: string | null; type: CrmActivityType } | null;
}

export interface CrmStage {
    id: string;
    name: string;
    position: number;
    probability: number;
    kind: CrmStageKind;
    color: string;
}

export interface CrmBoardStage extends CrmStage {
    deals: CrmDealCard[];
    count: number;
    value: number;
    weighted: number;
}

export interface CrmMetrics {
    openCount: number;
    openValue: number;
    forecast: number;
    wonThisMonthValue: number;
    wonThisMonthCount: number;
    winRate90d: number | null;
    avgCycleDays: number | null;
    overdueTasks: number;
}

export interface CrmBoard {
    pipeline: { id: string; name: string };
    stages: CrmBoardStage[];
    metrics: CrmMetrics;
}

export interface CrmActivity {
    id: string;
    type: CrmActivityType;
    title: string | null;
    body: string | null;
    dueAt: string | null;
    doneAt: string | null;
    userId: string | null;
    createdAt: string;
}

export interface CrmDealDetail extends CrmDealCard {
    lostReason: string | null;
    stage: { id: string; name: string; kind: CrmStageKind; probability: number };
    activities: CrmActivity[];
    leadPlaceId: string | null;
}

export interface CrmMember {
    userId: string;
    role: string;
    name: string | null;
    email: string | null;
}

export interface CrmDealInput {
    title?: string;
    value?: number;
    stageId?: string;
    expectedCloseAt?: string | null;
    ownerUserId?: string | null;
    companyName?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    leadAnalysisId?: string | null;
}

const json = (body: unknown) => JSON.stringify(body);

export const crmApi = {
    board: (params: { q?: string; owner?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        if (params.owner) qs.set('owner', params.owner);
        const suffix = qs.toString() ? `?${qs}` : '';
        return request<CrmBoard>(`/crm/board${suffix}`);
    },
    members: () => request<{ members: CrmMember[] }>('/crm/members'),
    createDeal: (input: CrmDealInput) => request<{ deal: CrmDealCard }>('/crm/deals', { method: 'POST', body: json(input) }),
    getDeal: (id: string) => request<{ deal: CrmDealDetail }>(`/crm/deals/${id}`),
    updateDeal: (id: string, input: CrmDealInput) => request<{ deal: CrmDealCard }>(`/crm/deals/${id}`, { method: 'PATCH', body: json(input) }),
    deleteDeal: (id: string) => request<{ ok: boolean }>(`/crm/deals/${id}`, { method: 'DELETE' }),
    moveDeal: (id: string, stageId: string, position: number, lostReason?: string) =>
        request<{ deal: CrmDealCard }>(`/crm/deals/${id}/move`, { method: 'POST', body: json({ stageId, position, lostReason }) }),
    addActivity: (dealId: string, input: { type: Exclude<CrmActivityType, 'STAGE_CHANGE'>; title?: string; body?: string; dueAt?: string | null }) =>
        request<{ activity: CrmActivity }>(`/crm/deals/${dealId}/activities`, { method: 'POST', body: json(input) }),
    setActivityDone: (id: string, done: boolean) => request<{ activity: CrmActivity }>(`/crm/activities/${id}`, { method: 'PATCH', body: json({ done }) }),
    deleteActivity: (id: string) => request<{ ok: boolean }>(`/crm/activities/${id}`, { method: 'DELETE' }),
    saveStages: (pipelineId: string, stages: Array<Pick<CrmStage, 'name' | 'probability' | 'kind' | 'color'> & { id?: string }>) =>
        request<{ stages: CrmStage[] }>(`/crm/pipelines/${pipelineId}/stages`, { method: 'PUT', body: json({ stages }) }),
};
