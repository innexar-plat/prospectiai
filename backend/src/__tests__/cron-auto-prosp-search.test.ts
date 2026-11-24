const mockConfigs = jest.fn();
const mockCount = jest.fn();
const mockProfiles = jest.fn();
const mockRunUpdate = jest.fn().mockResolvedValue({});
jest.mock('@/lib/prisma', () => ({
    prisma: {
        autoProspeccaoConfig: { findMany: (...a: unknown[]) => mockConfigs(...a) },
        searchProfile: { count: (...a: unknown[]) => mockCount(...a), findMany: (...a: unknown[]) => mockProfiles(...a) },
        autoProspeccaoRun: { create: jest.fn().mockResolvedValue({ id: 'run1' }), update: (...a: unknown[]) => mockRunUpdate(...a), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    },
}));
jest.mock('@/lib/ops-telemetry', () => ({ instrumentCron: (_n: string, fn: unknown) => fn }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const mockSearch = jest.fn().mockResolvedValue({ leadsFound: 2, leadsDedupSkip: 0 });
jest.mock('@/modules/auto-prospeccao/application/search.worker', () => ({ runSearchWorker: (...a: unknown[]) => mockSearch(...a) }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/cron/auto-prospeccao/search/route';

const call = () => POST(new NextRequest('http://localhost/api/cron/auto-prospeccao/search', { method: 'POST' }));
const scopeOf = (call: unknown[]) => ((call[0] as { where: { AND: unknown[] } }).where.AND[0]);

beforeEach(() => jest.clearAllMocks());

describe('cron auto-prospecting search — profile scope', () => {
    it('a workspace with its own profiles never runs the system (Precision IA) profiles', async () => {
        mockConfigs.mockResolvedValueOnce([{ workspaceId: 'heavyclean', maxLeadsPerRun: 50, blockedCnpjs: [] }]);
        mockCount.mockResolvedValueOnce(3);
        mockProfiles.mockResolvedValueOnce([{ id: 'p1' }]);
        await call();
        expect(scopeOf(mockProfiles.mock.calls[0])).toEqual({ workspaceId: 'heavyclean', isSystem: false });
        expect(mockSearch).toHaveBeenCalledWith('heavyclean', { id: 'p1' }, 'run1', 50, []);
    });

    it('a workspace without profiles falls back to the system profiles', async () => {
        mockConfigs.mockResolvedValueOnce([{ workspaceId: 'precision', maxLeadsPerRun: 50, blockedCnpjs: [] }]);
        mockCount.mockResolvedValueOnce(0);
        mockProfiles.mockResolvedValueOnce([]);
        await call();
        expect(scopeOf(mockProfiles.mock.calls[0])).toEqual({ isSystem: true });
    });

    it('a failing profile does not cancel the others; the run is FAILED only when all fail', async () => {
        const cfg = [{ workspaceId: 'w', maxLeadsPerRun: 50, blockedCnpjs: [], market: 'BR' }];
        mockConfigs.mockResolvedValueOnce(cfg);
        mockCount.mockResolvedValueOnce(1);
        mockProfiles.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }]);
        mockSearch.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ leadsFound: 3, leadsDedupSkip: 0 });
        await call();
        expect(mockRunUpdate.mock.calls.at(-1)[0].data).toMatchObject({ status: 'COMPLETED', leadsFound: 3 });

        mockConfigs.mockResolvedValueOnce(cfg);
        mockCount.mockResolvedValueOnce(1);
        mockProfiles.mockResolvedValueOnce([{ id: 'p1' }]);
        mockSearch.mockRejectedValueOnce(new Error('timeout'));
        await call();
        expect(mockRunUpdate.mock.calls.at(-1)[0].data).toMatchObject({ status: 'FAILED', errorLog: 'timeout' });
    });

    it('a US workspace never falls back to the Brazilian system profiles', async () => {
        mockConfigs.mockResolvedValueOnce([{ workspaceId: 'us', maxLeadsPerRun: 50, blockedCnpjs: [], market: 'US' }]);
        mockCount.mockResolvedValueOnce(0);
        mockProfiles.mockResolvedValueOnce([]);
        await call();
        expect(scopeOf(mockProfiles.mock.calls[0])).toEqual({ workspaceId: 'us', isSystem: false });
    });
});
