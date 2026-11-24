import { request } from './_request';

export interface UsCompanyResult {
    id: string; name: string; category: string | null; address: string | null; city: string | null;
    state: string; postcode: string | null; phone: string | null; email: string | null; website: string | null;
}

export const usSearchApi = {
    segments: () => request<{ segments: Array<{ slug: string; name: string }> }>('/us-search'),
    search: (body: { segment: string; state: string; city?: string; hasPhone?: boolean; hasEmail?: boolean; hasWebsite?: boolean; page: number }) =>
        request<{ companies: UsCompanyResult[]; total: number; capped: boolean }>('/us-search', { method: 'POST', body: JSON.stringify(body) }),
};
