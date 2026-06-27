const { GET } = require('@/app/api/config/public/route');

describe('GET /api/config/public', () => {
    it('returns US market config with trial disabled', async () => {
        const req = new Request('http://localhost/api/config/public', {
            headers: { host: 'precisionai.innexar.app' },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.market).toBe('US');
        expect(data.trial).toEqual({ enabled: false });
        expect(data.currency).toBe('USD');
        expect(data.features.trial).toBe(false);
        expect(data.features.mercadoPago).toBe(false);
        expect(data.starterPlan).toMatchObject({ key: 'BASIC', priceUsd: 19, credits: 50 });
        const basic = data.plans.find((p: { key: string }) => p.key === 'BASIC');
        expect(basic).toMatchObject({ leadsLimit: 50, currency: 'USD', priceMonthly: 19 });
    });

    it('returns BR market config with trial enabled', async () => {
        const req = new Request('http://localhost/api/config/public', {
            headers: { host: 'precisionia.com.br' },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.market).toBe('BR');
        expect(data.trial.enabled).toBe(true);
        expect(data.trial.days).toBe(7);
        expect(data.currency).toBe('BRL');
        expect(data.features.trial).toBe(true);
        expect(data.features.mercadoPago).toBe(true);
    });
});
