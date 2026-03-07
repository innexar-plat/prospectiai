import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockFetch } from '@/test/test-utils';
import {
  authApi,
  searchApi,
  userApi,
  plansApi,
  workspaceProfileApi,
  onboardingApi,
  billingApi,
  activityApi,
  tagsApi,
  leadsApi,
  notificationsApi,
  affiliateApi,
  viabilityApi,
  competitorApi,
  companyAnalysisApi,
  intelligenceApi,
} from './api';

describe('api', () => {
  let mockFetch: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('authApi', () => {
    it('session returns user when ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: { id: 'u1', email: 'a@b.com' } }),
      } as Response);
      const data = await authApi.session();
      expect(data.user).toEqual({ id: 'u1', email: 'a@b.com' });
    });

    it('session returns null user when not authenticated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: null }),
      } as Response);
      const data = await authApi.session();
      expect(data.user).toBeNull();
    });

    it('register sends POST and returns message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Created', id: 'u1' }),
      } as Response);
      const data = await authApi.register({
        email: 'x@y.com',
        password: 'secret',
        name: 'User',
      });
      expect(data.message).toBe('Created');
      expect(data.id).toBe('u1');
    });

    it('forgotPassword sends email and returns message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Email sent' }),
      } as Response);
      const data = await authApi.forgotPassword('u@x.com');
      expect(data.message).toBe('Email sent');
    });

    it('resetPassword sends token and password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Updated' }),
      } as Response);
      const data = await authApi.resetPassword({
        token: 't1',
        password: 'newpass',
      });
      expect(data.message).toBe('Updated');
    });

    it('throws when request returns not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid email' }),
      } as Response);
      await expect(authApi.register({ email: 'bad', password: 'x' })).rejects.toThrow('Invalid email');
    });

    it('throws statusText when res.json fails on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);
      await expect(authApi.register({ email: 'a@b.com', password: 'x' })).rejects.toThrow('Bad Gateway');
    });

    it('initiateOAuthSignIn fetches CSRF and submits form', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ csrfToken: 'csrf-xyz' }),
      } as Response);
      const submitFn = vi.fn();
      const form = {
        method: '',
        action: '',
        appendChild: vi.fn(),
        submit: submitFn,
      };
      vi.stubGlobal('window', { ...window, location: { ...window.location, origin: 'https://app.example.com' } });
      vi.stubGlobal('document', {
        ...document,
        createElement: vi.fn((tag: string) => (tag === 'form' ? form : { name: '', type: '', value: '', appendChild: vi.fn() })),
        body: { appendChild: vi.fn() },
      });
      await authApi.initiateOAuthSignIn('google', '/dashboard');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/auth/csrf'), expect.any(Object));
      expect(form.action).toBe('/api/auth/signin/google');
      expect(form.method).toBe('POST');
      expect(submitFn).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('signOut fetches CSRF then POSTs signout', async () => {
      vi.stubGlobal('window', { ...window, location: { ...window.location, origin: 'https://app.example.com' } });
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ csrfToken: 't' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true }),
        } as Response);
      const data = await authApi.signOut();
      expect(data).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/auth/csrf'), expect.any(Object));
      expect(mockFetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/auth/signout'), expect.objectContaining({ method: 'POST' }));
      vi.unstubAllGlobals();
    });

    it('signIn fetches CSRF and submits credentials form with callbackUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ csrfToken: 'tok' }),
      } as Response);
      const submitFn = vi.fn();
      const form = {
        method: '',
        action: '',
        appendChild: vi.fn(),
        submit: submitFn,
      };
      vi.stubGlobal('window', { ...window, location: { ...window.location, origin: 'https://example.com' } });
      vi.stubGlobal('document', {
        ...document,
        createElement: vi.fn((tag: string) => (tag === 'form' ? form : { name: '', type: '', value: '', appendChild: vi.fn() })),
        body: { appendChild: vi.fn() },
      });
      await authApi.signIn({ email: 'u@x.com', password: 'secret', callbackUrl: '/dashboard' });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/auth/csrf'), expect.any(Object));
      expect(form.action).toBe('/api/auth/callback/credentials');
      expect(form.method).toBe('POST');
      expect(submitFn).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('register sends affiliateCode when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Created', id: 'u2' }),
      } as Response);
      const data = await authApi.register({
        email: 'ref@x.com',
        password: 'p',
        affiliateCode: 'AFF01',
      });
      expect(data.id).toBe('u2');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('AFF01'),
        })
      );
    });
  });

  describe('searchApi', () => {
    it('search sends POST with textQuery and returns places', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            places: [{ id: 'p1', displayName: { text: 'Place 1' } }],
            nextPageToken: undefined,
          }),
      } as Response);
      const data = await searchApi.search({ textQuery: 'cafes' });
      expect(data.places).toHaveLength(1);
      expect(data.places[0].displayName?.text).toBe('Place 1');
    });

    it('details fetches place by placeId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'p1', name: 'Detail' }),
      } as Response);
      const data = await searchApi.details('p1');
      expect(data.name).toBe('Detail');
    });

    it('history calls with optional params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 10, offset: 0 }),
      } as Response);
      const data = await searchApi.history({ limit: 5, offset: 10 });
      expect(data.total).toBe(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search/history'),
        expect.any(Object)
      );
    });

    it('history without params calls /search/history without query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 }),
      } as Response);
      await searchApi.history();
      expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/search\/history$/), expect.any(Object));
    });

    it('historyDetail fetches by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'h1', textQuery: 'cafes', resultsData: [] }),
      } as Response);
      const data = await searchApi.historyDetail('h1');
      expect(data.id).toBe('h1');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/search/history/h1'), expect.any(Object));
    });

    it('analyze sends POST with place body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ score: 8, summary: 'Good' }),
      } as Response);
      const data = await searchApi.analyze({ placeId: 'p1', name: 'Cafe' });
      expect(data.score).toBe(8);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/analyze'), expect.objectContaining({ method: 'POST' }));
    });

    it('marketReport sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ totalCount: 100 }),
      } as Response);
      const data = await searchApi.marketReport({ textQuery: 'restaurants', pageSize: 10 });
      expect(data).toEqual({ totalCount: 100 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/market-report'), expect.objectContaining({ method: 'POST' }));
    });
  });

  describe('userApi', () => {
    it('me returns user and workspaceProfile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            user: { id: 'u1', email: 'u@x.com', plan: 'PRO' },
            workspaceProfile: { companyName: 'Acme' },
          }),
      } as Response);
      const data = await userApi.me();
      expect(data.user?.id).toBe('u1');
      expect(data.workspaceProfile?.companyName).toBe('Acme');
    });

    it('updateProfile sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'u1',
            name: 'New Name',
            email: 'u@x.com',
            image: null,
            phone: null,
            address: null,
            linkedInUrl: null,
            instagramUrl: null,
            facebookUrl: null,
            websiteUrl: null,
            notifyByEmail: false,
          }),
      } as Response);
      const data = await userApi.updateProfile({ name: 'New Name' });
      expect(data.name).toBe('New Name');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/user/profile'), expect.objectContaining({ method: 'POST' }));
    });
  });

  describe('plansApi', () => {
    it('list returns plans array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            { key: 'PRO', name: 'Pro', leadsLimit: 500, priceMonthlyBrl: 99, priceAnnualBrl: 990, modules: [] },
          ]),
      } as Response);
      const data = await plansApi.list();
      expect(data).toHaveLength(1);
      expect(data[0].key).toBe('PRO');
    });
  });

  describe('workspaceProfileApi', () => {
    it('get returns profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            companyName: 'Co',
            productService: 'X',
            targetAudience: null,
            mainBenefit: null,
            address: null,
            linkedInUrl: null,
            instagramUrl: null,
            facebookUrl: null,
            websiteUrl: null,
            logoUrl: null,
          }),
      } as Response);
      const data = await workspaceProfileApi.get();
      expect(data.companyName).toBe('Co');
    });

    it('update sends PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ companyName: 'Updated', productService: null, targetAudience: null, mainBenefit: null, address: null, linkedInUrl: null, instagramUrl: null, facebookUrl: null, websiteUrl: null, logoUrl: null }),
      } as Response);
      const data = await workspaceProfileApi.update({ companyName: 'Updated' });
      expect(data.companyName).toBe('Updated');
    });
  });

  describe('onboardingApi', () => {
    it('complete sends profile data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            message: 'Done',
            onboardingCompletedAt: '2025-01-01T00:00:00Z',
          }),
      } as Response);
      const data = await onboardingApi.complete({
        companyName: 'C',
        productService: 'P',
      });
      expect(data.message).toBe('Done');
    });
  });

  describe('billingApi', () => {
    it('checkout returns url', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ url: 'https://checkout.example.com' }),
      } as Response);
      const data = await billingApi.checkout({ planId: 'PRO' });
      expect(data.url).toBe('https://checkout.example.com');
    });
  });

  describe('activityApi', () => {
    it('track sends action', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      } as Response);
      const data = await activityApi.track({ action: 'view_page' });
      expect(data.ok).toBe(true);
    });
  });

  describe('tagsApi', () => {
    it('list returns tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tags: [] }),
      } as Response);
      const data = await tagsApi.list();
      expect(data.tags).toEqual([]);
    });

    it('add creates tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            tag: { id: 't1', leadId: 'l1', label: 'VIP', color: '#fff', userId: 'u1', createdAt: '' },
          }),
      } as Response);
      const data = await tagsApi.add({ leadId: 'l1', label: 'VIP' });
      expect(data.tag.label).toBe('VIP');
    });

    it('list with leadId appends query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tags: [{ id: 't1', leadId: 'l1', label: 'X', color: '#f00', createdAt: '' }] }),
      } as Response);
      const data = await tagsApi.list('lead-123');
      expect(data.tags).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tags?leadId=lead-123'), expect.any(Object));
    });

    it('remove sends DELETE with id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      } as Response);
      const data = await tagsApi.remove('tag-456');
      expect(data.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tags?id=tag-456'), expect.objectContaining({ method: 'DELETE' }));
    });
  });

  describe('leadsApi', () => {
    it('list returns lead analyses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      } as Response);
      const data = await leadsApi.list();
      expect(data).toEqual([]);
    });

    it('get returns one lead', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'a1', lead: { id: 'l1', name: 'L' }, createdAt: '' }),
      } as Response);
      const data = await leadsApi.get('a1');
      expect(data.lead.name).toBe('L');
    });

    it('toggleFavorite sends PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'a1', isFavorite: true, lead: { id: 'l1', name: 'L' }, createdAt: '' }),
      } as Response);
      const data = await leadsApi.toggleFavorite('a1', true);
      expect(data.isFavorite).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/leads/a1'), expect.objectContaining({ method: 'PATCH' }));
    });
  });

  describe('notificationsApi', () => {
    it('list returns items and unreadCount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], unreadCount: 0, limit: 20 }),
      } as Response);
      const data = await notificationsApi.list();
      expect(data.unreadCount).toBe(0);
    });

    it('list with params appends query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], unreadCount: 0, limit: 10 }),
      } as Response);
      await notificationsApi.list({ unreadOnly: true, limit: 10 });
      const url = (mockFetch as ReturnType<typeof createMockFetch>).mock.calls[0][0];
      expect(url).toContain('unreadOnly=true');
      expect(url).toContain('limit=10');
    });

    it('markRead sends PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'n1', readAt: '2025-01-01T00:00:00Z', link: null }),
      } as Response);
      const data = await notificationsApi.markRead('n1');
      expect(data.id).toBe('n1');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/notifications/n1'), expect.objectContaining({ method: 'PATCH' }));
    });
  });

  describe('affiliateApi', () => {
    it('me returns affiliate or throws', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'a1',
            code: 'ABC',
            status: 'APPROVED',
            commissionRatePercent: 20,
            payoutType: null,
            approvedAt: null,
            createdAt: '',
            referralCount: 5,
            commissionCount: 2,
          }),
      } as Response);
      const data = await affiliateApi.me();
      expect(data.code).toBe('ABC');
    });

    it('register sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'a2',
            code: 'XYZ',
            status: 'PENDING',
            commissionRatePercent: 15,
            payoutType: null,
            approvedAt: null,
            createdAt: '',
            referralCount: 0,
            commissionCount: 0,
          }),
      } as Response);
      const data = await affiliateApi.register();
      expect(data.code).toBe('XYZ');
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/affiliate/register'), expect.objectContaining({ method: 'POST' }));
    });

    it('stats returns stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ referralCount: 10, commissionCount: 3, totalEarnings: 150 }),
      } as Response);
      const data = await affiliateApi.stats();
      expect(data.referralCount).toBe(10);
    });

    it('referrals returns list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0 }),
      } as Response);
      const data = await affiliateApi.referrals();
      expect(data.total).toBe(0);
    });

    it('commissions returns list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0 }),
      } as Response);
      const data = await affiliateApi.commissions();
      expect(data.total).toBe(0);
    });

    it('updatePayout sends PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      } as Response);
      const data = await affiliateApi.updatePayout({ payoutType: 'PIX', payoutPayload: 'key' });
      expect(data.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/affiliate/me'), expect.objectContaining({ method: 'PATCH' }));
    });
  });

  describe('competitorApi', () => {
    it('analyze sends POST and returns result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            totalCount: 10,
            rankingByRating: [],
            rankingByReviews: [],
            digitalPresence: { withWebsite: 5, withoutWebsite: 5, withPhone: 4, withoutPhone: 6 },
            opportunities: [],
            avgRating: 4.2,
            medianReviews: 50,
            topOpportunities: [],
            aiPlaybook: null,
          }),
      } as Response);
      const data = await competitorApi.analyze({ textQuery: 'cafes', city: 'São Paulo' });
      expect(data.totalCount).toBe(10);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/competitors'), expect.objectContaining({ method: 'POST' }));
    });
  });

  describe('companyAnalysisApi', () => {
    it('run sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            summary: 'OK',
            strengths: [],
            weaknesses: [],
            opportunities: [],
            socialNetworks: { presence: 'partial', perNetwork: [] },
            recommendations: [],
          }),
      } as Response);
      const data = await companyAnalysisApi.run({ companyName: 'Acme', city: 'SP' });
      expect(data.summary).toBe('OK');
    });
  });

  describe('intelligenceApi', () => {
    it('history returns items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0 }),
      } as Response);
      const data = await intelligenceApi.history();
      expect(data.total).toBe(0);
    });

    it('history with params appends query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0 }),
      } as Response);
      await intelligenceApi.history({ module: 'search', limit: 5 });
      const callUrl = (mockFetch as ReturnType<typeof createMockFetch>).mock.calls[0][0];
      expect(callUrl).toContain('module=search');
      expect(callUrl).toContain('limit=5');
    });

    it('detail fetches by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'r1', module: 'search', resultsData: null }),
      } as Response);
      const data = await intelligenceApi.detail('r1');
      expect(data.id).toBe('r1');
    });

    it('toggleFavorite sends PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'r1', isFavorite: true }),
      } as Response);
      const data = await intelligenceApi.toggleFavorite('r1', true);
      expect(data.isFavorite).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/intelligence/history/r1'),
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ isFavorite: true }) })
      );
    });
  });

  describe('viabilityApi', () => {
    it('analyze returns report', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            score: 7,
            verdict: 'OK',
            goNoGo: 'GO',
            summary: 'Good',
            competitorDensity: 5,
            saturationIndex: 0.5,
            digitalMaturityPercent: 60,
            strengths: [],
            risks: [],
            recommendations: [],
            estimatedInvestment: '',
            bestLocations: [],
            segmentBreakdown: [],
            dailyLeadsTarget: 10,
            suggestedOffer: '',
            suggestedTicket: '',
            topOpportunities: [],
          }),
      } as Response);
      const data = await viabilityApi.analyze({
        mode: 'new_business',
        businessType: 'Store',
        city: 'Belo Horizonte',
      });
      expect(data.score).toBe(7);
      expect(data.goNoGo).toBe('GO');
    });
  });
});
