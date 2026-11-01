const m = {
    pipelineFindFirst: jest.fn(), pipelineCreate: jest.fn(),
    dealFindFirst: jest.fn(), dealFindMany: jest.fn(), dealCreate: jest.fn(), dealUpdate: jest.fn(), dealCount: jest.fn(), dealAggregate: jest.fn(),
    stageFindFirst: jest.fn(), stageDeleteMany: jest.fn(), stageUpdate: jest.fn(), stageCreate: jest.fn(),
    activityCreate: jest.fn(), activityCount: jest.fn(), activityFindMany: jest.fn(),
    memberFindFirst: jest.fn(), analysisFindFirst: jest.fn(), tx: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({
    prisma: {
        crmPipeline: { findFirst: (...a: unknown[]) => m.pipelineFindFirst(...a), create: (...a: unknown[]) => m.pipelineCreate(...a) },
        crmDeal: {
            findFirst: (...a: unknown[]) => m.dealFindFirst(...a), findMany: (...a: unknown[]) => m.dealFindMany(...a),
            create: (...a: unknown[]) => m.dealCreate(...a), update: (...a: unknown[]) => m.dealUpdate(...a),
            count: (...a: unknown[]) => m.dealCount(...a), aggregate: (...a: unknown[]) => m.dealAggregate(...a),
        },
        crmStage: {
            findFirst: (...a: unknown[]) => m.stageFindFirst(...a), deleteMany: (...a: unknown[]) => m.stageDeleteMany(...a),
            update: (...a: unknown[]) => m.stageUpdate(...a), create: (...a: unknown[]) => m.stageCreate(...a),
        },
        crmActivity: { create: (...a: unknown[]) => m.activityCreate(...a), count: (...a: unknown[]) => m.activityCount(...a), findMany: (...a: unknown[]) => m.activityFindMany(...a) },
        workspaceMember: { findFirst: (...a: unknown[]) => m.memberFindFirst(...a) },
        leadAnalysis: { findFirst: (...a: unknown[]) => m.analysisFindFirst(...a) },
        $transaction: (...a: unknown[]) => m.tx(...a),
    },
}));

import { CrmError, DEFAULT_STAGES, createDeal, ensureDefaultPipeline, getMetrics, moveDeal, saveStages } from '@/lib/crm';

const stages = DEFAULT_STAGES.map((s, i) => ({ ...s, id: `s${i}`, position: i }));
const pipeline = { id: 'p1', name: 'Vendas', stages };

beforeEach(() => {
    jest.clearAllMocks();
    m.tx.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
});

describe('crm', () => {
    it('creates the default pipeline with open, won and lost stages on first use', async () => {
        m.pipelineFindFirst.mockResolvedValueOnce(null);
        m.pipelineCreate.mockResolvedValueOnce({ id: 'p1' });
        expect(await ensureDefaultPipeline('w1')).toBe('p1');
        const created = m.pipelineCreate.mock.calls[0][0].data.stages.create;
        expect(created.map((s: { kind: string }) => s.kind)).toEqual(['OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'WON', 'LOST']);
    });

    it('a deal from a Precision lead copies company and contacts', async () => {
        m.pipelineFindFirst.mockResolvedValueOnce({ id: 'p1' }).mockResolvedValueOnce(pipeline);
        m.memberFindFirst.mockResolvedValueOnce({ id: 'mem' });
        m.dealFindFirst.mockResolvedValueOnce(null);
        m.analysisFindFirst.mockResolvedValueOnce({ lead: { name: 'Padaria Sol', phone: '1133334444', recommendedPhone: '11999998888', email: null, recommendedEmail: 'oi@sol.com' } });
        m.dealFindFirst.mockResolvedValueOnce(null);
        m.dealCreate.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => data);

        const deal = await createDeal('w1', 'u1', { leadAnalysisId: 'la1', value: 1500 }) as unknown as Record<string, unknown>;

        expect(deal).toEqual(expect.objectContaining({
            title: 'Padaria Sol', companyName: 'Padaria Sol', contactPhone: '11999998888', contactEmail: 'oi@sol.com',
            stageId: 's0', value: 1500, source: 'precision', ownerUserId: 'u1',
        }));
    });

    it('moving to Lost stamps the date, keeps the reason and logs the stage change', async () => {
        m.dealFindFirst.mockResolvedValueOnce({ id: 'd1', pipelineId: 'p1', stageId: 's3', stage: stages[3] });
        m.stageFindFirst.mockResolvedValueOnce(stages[6]);
        m.dealUpdate.mockResolvedValueOnce({ id: 'd1' });
        m.activityCreate.mockResolvedValueOnce({});

        await moveDeal('w1', 'u1', 'd1', 's6', 0, 'Preço');

        const data = m.dealUpdate.mock.calls[0][0].data;
        expect(data.lostAt).toBeInstanceOf(Date);
        expect(data.wonAt).toBeNull();
        expect(data.lostReason).toBe('Preço');
        expect(m.activityCreate.mock.calls[0][0].data).toEqual(expect.objectContaining({ type: 'STAGE_CHANGE', title: 'Proposta enviada → Perdido', body: 'Motivo: Preço' }));
    });

    it('stage list must keep exactly one Won and one Lost, and cannot drop stages with deals', async () => {
        m.pipelineFindFirst.mockResolvedValue(pipeline);
        await expect(saveStages('w1', 'p1', [{ name: 'A', probability: 10, kind: 'OPEN' }, { name: 'B', probability: 0, kind: 'LOST' }, { name: 'C', probability: 0, kind: 'LOST' }]))
            .rejects.toBeInstanceOf(CrmError);
        m.dealCount.mockResolvedValueOnce(2);
        await expect(saveStages('w1', 'p1', [
            { id: 's0', name: 'Novo', probability: 10, kind: 'OPEN' }, { id: 's5', name: 'Ganho', probability: 100, kind: 'WON' }, { id: 's6', name: 'Perdido', probability: 0, kind: 'LOST' },
        ])).rejects.toMatchObject({ status: 409 });
    });

    it('forecast weights open value by stage probability; win rate over 90 days', async () => {
        m.dealFindMany
            .mockResolvedValueOnce([{ value: 1000, stage: { probability: 50 } }, { value: 2000, stage: { probability: 10 } }])
            .mockResolvedValueOnce([{ value: 500, createdAt: new Date('2026-10-01'), wonAt: new Date('2026-10-11') }]);
        m.dealCount.mockResolvedValueOnce(1);
        m.dealAggregate.mockResolvedValueOnce({ _sum: { value: 500 }, _count: 1 });

        const r = await getMetrics('w1', 'p1', new Date('2026-11-01T12:00:00Z'), 3);

        expect(r).toEqual({ openCount: 2, openValue: 3000, forecast: 700, wonThisMonthValue: 500, wonThisMonthCount: 1, winRate90d: 50, avgCycleDays: 10, overdueTasks: 3 });
    });

    it('sending the same lead to the CRM twice returns the open deal', async () => {
        m.pipelineFindFirst.mockResolvedValueOnce({ id: 'p1' }).mockResolvedValueOnce(pipeline);
        m.memberFindFirst.mockResolvedValueOnce({ id: 'mem' });
        m.dealFindFirst.mockResolvedValueOnce({ id: 'd-existing' });
        expect(await createDeal('w1', 'u1', { leadAnalysisId: 'la1' })).toEqual({ id: 'd-existing' });
        expect(m.dealCreate).not.toHaveBeenCalled();
    });
});

