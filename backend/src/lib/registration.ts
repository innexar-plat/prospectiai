import type { Market } from '@/lib/market';
import { MARKET } from '@/lib/market';

/** User + workspace data for new signups — inactive FREE until first payment (BR and US). */
export function buildRegistrationUserData(_market: Market = MARKET) {
    return {
        plan: 'FREE' as const,
        leadsLimit: 0,
        leadsUsed: 0,
    };
}

export function defaultWorkspaceName(market: Market = MARKET, personName?: string | null): string {
    const trimmed = personName?.trim();
    if (trimmed) return `${trimmed} - Workspace`;
    return market === 'US' ? 'My Workspace' : 'Meu Workspace';
}

export function buildRegistrationWorkspaceData(name: string, _market: Market = MARKET) {
    return {
        name,
        plan: 'FREE' as const,
        leadsLimit: 0,
        leadsUsed: 0,
        subscriptionStatus: 'inactive',
        currentPeriodEnd: null,
    };
}
