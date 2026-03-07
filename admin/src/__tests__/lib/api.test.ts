import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockFetch } from '@/__tests__/test-utils';
import { authApi, adminApi, supportApi } from '@/lib/api';

describe('admin api', () => {
  let mockFetch: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('authApi', () => {
    it('signOut sends POST and does not throw when ok', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ token: 't' }) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
      await expect(authApi.signOut()).resolves.toBeUndefined();
    });

    it('session returns user when ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: { id: 'u1', email: 'admin@x.com', role: 'admin' } }),
      } as Response);
      const data = await authApi.session();
      expect(data.user?.id).toBe('u1');
    });

    it('session returns null when not authenticated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: null }),
      } as Response);
      const data = await authApi.session();
      expect(data.user).toBeNull();
    });
  });

  describe('adminApi', () => {
    it('stats returns dashboard stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            users: 10,
            workspaces: 5,
            searchHistory: 100,
            leadAnalyses: 50,
          }),
      } as Response);
      const data = await adminApi.stats();
      expect(data.users).toBe(10);
      expect(data.workspaces).toBe(5);
    });

    it('users returns list with items and total', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            items: [{ id: 'u1', name: 'User', email: 'u@x.com', plan: 'PRO', disabledAt: null, onboardingCompletedAt: null, createdAt: '', _count: { workspaces: 1, analyses: 0, searchHistory: 0 } }],
            total: 1,
            limit: 20,
            offset: 0,
          }),
      } as Response);
      const data = await adminApi.users();
      expect(data.items).toHaveLength(1);
      expect(data.items[0].email).toBe('u@x.com');
    });

    it('workspaces returns list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            items: [],
            total: 0,
            limit: 20,
            offset: 0,
          }),
      } as Response);
      const data = await adminApi.workspaces();
      expect(data.items).toEqual([]);
    });

    it('workspace returns detail by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'w1',
            name: 'WS',
            plan: 'PRO',
            leadsUsed: 0,
            leadsLimit: 100,
            createdAt: '',
            updatedAt: '',
            _count: { members: 1, analyses: 0, searchHistory: 0 },
            members: [],
          }),
      } as Response);
      const data = await adminApi.workspace('w1');
      expect(data.id).toBe('w1');
    });

    it('user returns detail by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'u1',
            name: 'User',
            email: 'u@x.com',
            plan: 'PRO',
            disabledAt: null,
            onboardingCompletedAt: null,
            createdAt: '',
            leadsUsed: 10,
            leadsLimit: 100,
            companyName: null,
            productService: null,
            targetAudience: null,
            mainBenefit: null,
            updatedAt: '',
            workspaces: [],
            _count: { workspaces: 1, analyses: 0, searchHistory: 0 },
          }),
      } as Response);
      const data = await adminApi.user('u1');
      expect(data.id).toBe('u1');
    });

    it('throws when request not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      } as Response);
      await expect(adminApi.stats()).rejects.toThrow();
    });

    it('throws with details when response has details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request', details: 'Invalid plan' }),
      } as Response);
      await expect(adminApi.stats()).rejects.toThrow(/Invalid plan/);
    });

    it('users with params builds query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 10, offset: 5 }),
      } as Response);
      await adminApi.users({ limit: 10, offset: 5 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });

    it('resetPassword sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'OK' }),
      } as Response);
      const data = await adminApi.resetPassword('u1', { sendEmail: true });
      expect(data.message).toBe('OK');
    });

    it('updateWorkspace sends PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'w1', name: 'W', plan: 'PRO', leadsUsed: 0, leadsLimit: 100, createdAt: '', updatedAt: '', _count: { members: 1, analyses: 0, searchHistory: 0 } }),
      } as Response);
      const data = await adminApi.updateWorkspace('w1', { plan: 'PRO' });
      expect(data.plan).toBe('PRO');
    });

    it('leads returns list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 }),
      } as Response);
      const data = await adminApi.leads();
      expect(data.items).toEqual([]);
    });

    it('searchHistory returns list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 }),
      } as Response);
      const data = await adminApi.searchHistory();
      expect(data.total).toBe(0);
    });

    it('auditLogs returns list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 }),
      } as Response);
      const data = await adminApi.auditLogs();
      expect(data.items).toEqual([]);
    });

    it('aiConfig.list returns items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [] }),
      } as Response);
      const data = await adminApi.aiConfig.list();
      expect(data.items).toEqual([]);
    });

    it('plans.list returns array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      } as Response);
      const data = await adminApi.plans.list();
      expect(data).toEqual([]);
    });

    it('email.status returns configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ configured: true }),
      } as Response);
      const data = await adminApi.email.status();
      expect(data.configured).toBe(true);
    });

    it('notifications.list returns items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], unreadCount: 0, limit: 20, offset: 0 }),
      } as Response);
      const data = await adminApi.notifications.list();
      expect(data.items).toEqual([]);
    });

    it('affiliates returns list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 }),
      } as Response);
      const data = await adminApi.affiliates();
      expect(data.items).toEqual([]);
    });

    it('commissions returns list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 }),
      } as Response);
      const data = await adminApi.commissions();
      expect(data.items).toEqual([]);
    });

    it('affiliateSettings.get returns settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 's1', defaultCommissionRatePercent: 20, cookieDurationDays: 30, commissionRule: 'FIRST_PAYMENT_ONLY', approvalHoldDays: 15, minPayoutCents: 10000, allowSelfSignup: true, updatedAt: '' }),
      } as Response);
      const data = await adminApi.affiliateSettings.get();
      expect(data.defaultCommissionRatePercent).toBe(20);
    });

    it('affiliateSettings.update sends PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 's1', defaultCommissionRatePercent: 25, cookieDurationDays: 30, commissionRule: 'FIRST_PAYMENT_ONLY', approvalHoldDays: 15, minPayoutCents: 10000, allowSelfSignup: true, updatedAt: '' }),
      } as Response);
      const data = await adminApi.affiliateSettings.update({ defaultCommissionRatePercent: 25 });
      expect(data.defaultCommissionRatePercent).toBe(25);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/admin/affiliate-settings'), expect.objectContaining({ method: 'PATCH' }));
    });

    it('aiConfig.create sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'c1', role: 'lead_analysis', provider: 'GEMINI', model: 'x', enabled: true }),
      } as Response);
      const data = await adminApi.aiConfig.create({ role: 'lead_analysis', provider: 'GEMINI', model: 'x', apiKey: '', enabled: true });
      expect(data.id).toBe('c1');
    });

    it('webSearchConfig.list returns items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [] }),
      } as Response);
      const data = await adminApi.webSearchConfig.list();
      expect(data.items).toEqual([]);
    });

    it('plans.create sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'p1', key: 'PRO', name: 'Pro', leadsLimit: 400, priceMonthlyBrl: 99, priceAnnualBrl: 990, priceMonthlyUsd: 0, priceAnnualUsd: 0, modules: [], isActive: true, sortOrder: 0 }),
      } as Response);
      const data = await adminApi.plans.create({ key: 'PRO', name: 'Pro', leadsLimit: 400, priceMonthlyBrl: 99, priceAnnualBrl: 990, priceMonthlyUsd: 0, priceAnnualUsd: 0, modules: [], isActive: true, sortOrder: 0 });
      expect(data.key).toBe('PRO');
    });

    it('email.getConfig returns config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ provider: 'resend', fromEmail: 'noreply@x.com', smtpHost: null, smtpPort: null, smtpUser: null }),
      } as Response);
      const data = await adminApi.email.getConfig();
      expect(data.fromEmail).toBe('noreply@x.com');
    });

    it('notifications.sendAll sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ sent: 10 }),
      } as Response);
      const data = await adminApi.notifications.sendAll({ title: 'T', message: 'M' });
      expect(data.sent).toBe(10);
    });

    it('notificationChannels.list returns channels', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ channels: [{ key: 'k1', name: 'N', appEnabled: true, emailEnabled: false }] }),
      } as Response);
      const data = await adminApi.notificationChannels.list();
      expect(data.channels).toHaveLength(1);
    });

    it('createAffiliate sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'a1', code: 'X', status: 'PENDING', message: 'OK' }),
      } as Response);
      const data = await adminApi.createAffiliate({ name: 'A', email: 'a@x.com' });
      expect(data.code).toBe('X');
    });

    it('affiliate returns detail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'a1', code: 'X', status: 'APPROVED', commissionRatePercent: 20, email: 'a@x.com', name: 'A', approvedAt: null, createdAt: '', referralCount: 0, userId: null, referrals: [], commissions: [], commissionPendingCents: 0, commissionPaidCents: 0 }),
      } as Response);
      const data = await adminApi.affiliate('a1');
      expect(data.id).toBe('a1');
    });

    it('referrals with params builds query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 }),
      } as Response);
      await adminApi.referrals({ affiliateId: 'a1', converted: 'true' });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('affiliateId=a1'), expect.any(Object));
    });

    it('affiliates with hasPendingCommissions builds query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 }),
      } as Response);
      await adminApi.affiliates({ hasPendingCommissions: true });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('hasPendingCommissions'), expect.any(Object));
    });

    it('notifications.list with params builds query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], unreadCount: 0, limit: 20, offset: 0 }),
      } as Response);
      await adminApi.notifications.list({ workspaceId: 'w1', userId: 'u1', type: 'info' });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('workspaceId=w1'), expect.any(Object));
    });
  });

  describe('supportApi', () => {
    it('users returns list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 }),
      } as Response);
      const data = await supportApi.users();
      expect(data.items).toEqual([]);
    });

    it('users with params builds query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 10, offset: 5 }),
      } as Response);
      await supportApi.users({ limit: 10, offset: 5, search: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/support/users?'), expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=10'), expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('search=test'), expect.any(Object));
    });

    it('user returns detail by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'u1', name: 'U', email: 'u@x.com', plan: 'PRO', disabledAt: null, createdAt: '', workspaces: [] }),
      } as Response);
      const data = await supportApi.user('u1');
      expect(data.id).toBe('u1');
    });

    it('resetPassword sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'OK' }),
      } as Response);
      const data = await supportApi.resetPassword('u1', { sendEmail: true });
      expect(data.message).toBe('OK');
    });

    it('activate sends PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      } as Response);
      const data = await supportApi.activate('u1');
      expect(data.ok).toBe(true);
    });

    it('deactivate sends PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      } as Response);
      const data = await supportApi.deactivate('u1', { reason: 'test' });
      expect(data.ok).toBe(true);
    });
  });
});
