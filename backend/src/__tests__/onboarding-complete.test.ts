const mockAuth = jest.fn();
const mockUserUpdate = jest.fn();
const mockWorkspaceUpdate = jest.fn();
const mockWorkspaceCreate = jest.fn();
const mockMemberFindFirst = jest.fn();
const mockUserFindUnique = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            update: (...args: unknown[]) => mockUserUpdate(...args),
            findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
        },
        workspace: {
            update: (...args: unknown[]) => mockWorkspaceUpdate(...args),
            create: (...args: unknown[]) => mockWorkspaceCreate(...args),
        },
        workspaceMember: {
            findFirst: (...args: unknown[]) => mockMemberFindFirst(...args),
        },
        $transaction: (...args: unknown[]) => mockTransaction(...args),
    },
}));

const { POST } = require('@/app/api/onboarding/complete/route');

describe('POST /api/onboarding/complete', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: 'u1' } });
        mockMemberFindFirst.mockResolvedValue({ workspaceId: 'w1' });
        mockUserUpdate.mockResolvedValue({});
        mockWorkspaceUpdate.mockResolvedValue({});
        mockUserFindUnique.mockResolvedValue({ onboardingCompletedAt: new Date('2026-01-01') });
    });

    it('creates inactive FREE workspace (not trial) for US market when membership missing', async () => {
        mockMemberFindFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ workspaceId: 'w-new' });
        mockUserFindUnique.mockResolvedValueOnce({ name: 'Jane' });
        mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
            const tx = {
                workspace: { create: mockWorkspaceCreate },
                workspaceMember: { create: jest.fn().mockResolvedValue({}) },
            };
            await fn(tx);
        });
        mockWorkspaceCreate.mockResolvedValue({ id: 'w-new' });

        const req = new Request('http://localhost/api/onboarding/complete', {
            method: 'POST',
            headers: {
                host: 'precisionai.innexar.app',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ companyName: 'Acme' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(mockWorkspaceCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    plan: 'FREE',
                    leadsLimit: 0,
                    subscriptionStatus: 'inactive',
                }),
            }),
        );
    });
});
