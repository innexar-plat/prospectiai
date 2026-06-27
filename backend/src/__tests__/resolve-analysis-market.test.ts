import { resolveAnalysisMarket } from '@/lib/market';

function mockRequest(headers: Record<string, string> = {}): Request {
    return { headers: new Headers(headers) } as Request;
}

describe('resolveAnalysisMarket', () => {
    it('returns US when body country is US', () => {
        const req = mockRequest({ 'x-prospector-market': 'BR' });
        expect(resolveAnalysisMarket(req, 'US', 'BR')).toBe('US');
    });

    it('returns US when request market is US and country omitted', () => {
        const req = mockRequest({ 'x-prospector-market': 'US' });
        expect(resolveAnalysisMarket(req, undefined, 'BR')).toBe('US');
    });

    it('returns BR for Brazilian country with BR user market', () => {
        const req = mockRequest({ 'x-prospector-market': 'BR' });
        expect(resolveAnalysisMarket(req, 'BR', 'BR')).toBe('BR');
    });
});
