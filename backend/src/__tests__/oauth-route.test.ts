import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

const signInMock = jest.fn();

jest.mock('@/auth', () => ({
    signIn: (...args: unknown[]) => signInMock(...args),
}));

describe('GET /api/oauth/:provider', () => {
    beforeEach(() => {
        signInMock.mockReset();
        signInMock.mockResolvedValue(undefined);
    });

    async function callRoute(
        provider: string,
        query: string,
        headers: Record<string, string> = {},
    ) {
        const { GET } = await import('@/app/api/oauth/[provider]/route');
        const request = new NextRequest(
            `http://localhost/api/oauth/${provider}?${query}`,
            { headers: { host: 'precisionai.innexar.app', ...headers } },
        );
        return GET(request, { params: Promise.resolve({ provider }) });
    }

    it('sanitizes cross-market callbackUrl to request host', async () => {
        await callRoute(
            'google',
            `callbackUrl=${encodeURIComponent('https://precisionia.com.br/checkout')}`,
        );
        expect(signInMock).toHaveBeenCalledWith('google', {
            redirectTo: 'https://precisionai.innexar.app/checkout',
        });
    });

    it('keeps same-market absolute callbackUrl', async () => {
        await callRoute(
            'google',
            `callbackUrl=${encodeURIComponent('https://precisionai.innexar.app/dashboard')}`,
        );
        expect(signInMock).toHaveBeenCalledWith('google', {
            redirectTo: 'https://precisionai.innexar.app/dashboard',
        });
    });

    it('resolves relative callbackUrl on request host', async () => {
        await callRoute('github', 'callbackUrl=%2Fcheckout');
        expect(signInMock).toHaveBeenCalledWith('github', {
            redirectTo: 'https://precisionai.innexar.app/checkout',
        });
    });

    it('rejects unknown providers', async () => {
        const res = await callRoute('facebook', 'callbackUrl=%2Fdashboard');
        expect(res.status).toBe(400);
        expect(signInMock).not.toHaveBeenCalled();
    });
});
