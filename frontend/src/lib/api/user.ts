import { request } from './_request';
import type { SessionUser, UserProfileUpdate, UserProfileResponse, WorkspaceProfile, WorkspaceProfileCnpjLookup } from './types';

export const userApi = {
    me: () => request<{ user: SessionUser | null; workspaceProfile?: WorkspaceProfile | null }>('/user/me'),
    updateProfile: (data: UserProfileUpdate) =>
        request<UserProfileResponse>('/user/profile', { method: 'POST', body: JSON.stringify(data) }),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
        request<{ message: string }>('/user/change-password', { method: 'POST', body: JSON.stringify(data) }),
};

export const workspaceProfileApi = {
    get: () => request<WorkspaceProfile>('/workspace/current/profile'),
    update: (data: Partial<WorkspaceProfile>) =>
        request<WorkspaceProfile>('/workspace/current/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    lookupCnpj: (cnpj: string) =>
        request<WorkspaceProfileCnpjLookup>(`/workspace/current/profile/cnpj?cnpj=${encodeURIComponent(cnpj)}`),
};

export const onboardingApi = {
    complete: (data: { companyName?: string; productService?: string; targetAudience?: string; mainBenefit?: string }) =>
        request<{ message: string; onboardingCompletedAt: string }>('/onboarding/complete', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

export const activityApi = {
    track: (data: { action: string; metadata?: Record<string, unknown> }) =>
        request<{ ok: boolean }>('/activity', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};
