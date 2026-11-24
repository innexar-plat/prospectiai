const mockConfigs = jest.fn();
const mockCount = jest.fn();
const mockProfiles = jest.fn();
jest.mock('@/lib/prisma', () => ({
    prisma: {
        autoProspeccaoConfig: { findMany: (...a: unknown[]) => mockConfigs(...a) },
        searchProfile: { count: (...a: unknown[]) => mockCount(...a), findMany: (...a: unknown[]) => mockProfiles(...a) },
        autoProspeccaoRun: { create: jest.fn().mockResolvedValue({ id: 'run1' }), update: jest.fn().mockResolvedValue({}) },
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
});
