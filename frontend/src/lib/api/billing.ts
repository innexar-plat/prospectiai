import { request } from './_request';
import type { PlanFromApi, CheckoutResponse, PromoValidateResponse, AffiliateMe, AffiliateStats } from './types';

export const plansApi = {
    list: () => request<PlanFromApi[]>('/plans'),
};

export const billingApi = {
    checkout: (data: {
        planId: string;
        interval?: 'monthly' | 'annual';
        locale?: string;
        scheduleAtPeriodEnd?: boolean;
        affiliateCode?: string;
        promoCode?: string;
        promoToken?: string;
    }) =>
        request<CheckoutResponse>('/billing/checkout', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    validatePromo: (params: { promo?: string; token?: string }) => {
        const qs = new URLSearchParams();
        if (params.promo) qs.set('promo', params.promo);
        if (params.token) qs.set('token', params.token);
        return request<PromoValidateResponse>(`/billing/promo/validate?${qs.toString()}`);
    },
    cancelSubscription: () =>
        request<{ ok: boolean; message: string; pendingPlanId?: string | null; pendingPlanEffectiveAt?: string | null }>('/billing/cancel-subscription', {
            method: 'POST',
        }),
    cancelPendingDowngrade: () =>
        request<{ ok: boolean; message: string }>('/billing/cancel-pending-downgrade', {
            method: 'POST',
        }),
};

export const affiliateApi = {
    me: () => request<AffiliateMe>('/affiliate/me'),
    register: () => request<{ id: string; code: string; status: string; message: string }>('/affiliate/register', { method: 'POST' }),
    stats: () => request<AffiliateStats>('/affiliate/stats'),
    referrals: (params?: { page?: number; limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.page != null) q.set('page', String(params.page));
        if (params?.limit != null) q.set('limit', String(params.limit));
        return request<{ items: Array<{ id: string; landedAt: string; signupAt: string; convertedAt: string | null; refSource: string; planId: string | null; valueCents: number | null; emailMasked: string | null }>; total: number; page: number; limit: number }>(`/affiliate/referrals?${q}`);
    },
    commissions: (params?: { page?: number; limit?: number; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.page != null) q.set('page', String(params.page));
        if (params?.limit != null) q.set('limit', String(params.limit));
        if (params?.status) q.set('status', params.status);
        return request<{ items: Array<{ id: string; amountCents: number; currency: string; status: string; availableAt: string; paidAt: string | null; commissionType: string; createdAt: string }>; total: number; page: number; limit: number }>(`/affiliate/commissions?${q}`);
    },
    updatePayout: (data: { payoutType?: 'PIX' | 'BANK_TRANSFER'; payoutPayload?: string }) =>
        request<{ ok: boolean }>('/affiliate/me', { method: 'PATCH', body: JSON.stringify(data) }),
};
