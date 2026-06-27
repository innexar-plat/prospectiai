const mockAuth = jest.fn();

jest.mock('@/auth', () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
}));

jest.mock('@/lib/logger', () => ({
    logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const { getApiSession } = require('@/lib/api-auth');
const { logger } = require('@/lib/logger');

describe('getApiSession', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns session when auth succeeds', async () => {
        const session = { user: { id: 'u1', email: 'u@x.com' }, expires: '' };
        mockAuth.mockResolvedValue(session);
        await expect(getApiSession()).resolves.toEqual(session);
    });

    it('returns null when auth returns null', async () => {
        mockAuth.mockResolvedValue(null);
        await expect(getApiSession()).resolves.toBeNull();
    });

    it('returns null and logs warn when auth throws', async () => {
        mockAuth.mockRejectedValue(new Error('JWT expired'));
        await expect(getApiSession()).resolves.toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
            'getApiSession: auth() failed',
            expect.objectContaining({ error: 'JWT expired' }),
        );
    });
});
