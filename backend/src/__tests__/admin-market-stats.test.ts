import {
    classifyWorkspaceMarket,
    getPlanMrrForWorkspace,
} from '@/lib/admin-market-stats';

describe('classifyWorkspaceMarket', () => {
    const base = {
        plan: 'FREE',
        subscriptionId: null,
        subscriptionStatus: null,
        leadsLimit: 10,
        billingCycle: null,
        cnpj: null,
    };

    it('classifies Stripe subscription as US', () => {
        expect(
            classifyWorkspaceMarket({
                ...base,
                plan: 'PRO',
                subscriptionId: 'sub_abc123',
                subscriptionStatus: 'active',
            }),
        ).toBe('US');
    });

    it('classifies active paid workspace without Stripe as BR', () => {
        expect(
            classifyWorkspaceMarket({
                ...base,
                plan: 'PRO',
                subscriptionId: 'mp_preapproval_1',
                subscriptionStatus: 'active',
            }),
        ).toBe('BR');
    });

    it('classifies TRIAL as BR', () => {
        expect(
            classifyWorkspaceMarket({
                ...base,
                plan: 'TRIAL',
                subscriptionStatus: 'trialing',
            }),
        ).toBe('BR');
    });

    it('classifies CNPJ workspace as BR', () => {
        expect(
            classifyWorkspaceMarket({
                ...base,
                cnpj: '12345678000199',
            }),
        ).toBe('BR');
    });

    it('classifies US free signup pattern as US', () => {
        expect(
            classifyWorkspaceMarket({
                ...base,
                plan: 'FREE',
                leadsLimit: 0,
                subscriptionStatus: 'inactive',
            }),
        ).toBe('US');
    });

    it('defaults legacy FREE to BR', () => {
        expect(classifyWorkspaceMarket(base)).toBe('BR');
    });
});

describe('getPlanMrrForWorkspace', () => {
    const planConfigByKey = new Map([
        [
            'BASIC',
            {
                priceMonthlyBrl: 97,
                priceAnnualBrl: 989,
                priceMonthlyUsd: 19,
                priceAnnualUsd: 190,
            },
        ],
    ]);

    it('computes monthly MRR for BR Mercado Pago workspace', () => {
        const result = getPlanMrrForWorkspace(
            {
                plan: 'BASIC',
                subscriptionId: null,
                subscriptionStatus: 'active',
                leadsLimit: 100,
                billingCycle: 'monthly',
                cnpj: null,
            },
            planConfigByKey,
        );
        expect(result).toEqual({ market: 'BR', mrr: 97 });
    });

    it('computes annual MRR equivalent for US Stripe workspace', () => {
        const result = getPlanMrrForWorkspace(
            {
                plan: 'BASIC',
                subscriptionId: 'sub_1',
                subscriptionStatus: 'active',
                leadsLimit: 50,
                billingCycle: 'annual',
                cnpj: null,
            },
            planConfigByKey,
        );
        expect(result?.market).toBe('US');
        expect(result?.mrr).toBeCloseTo(190 / 12, 2);
    });
});
