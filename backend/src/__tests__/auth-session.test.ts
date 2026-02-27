/**
 * Tests for GET /api/auth/session
 */
const { GET } = require('@/app/api/auth/session/route');
const { auth } = require('@/auth');

jest.mock('@/auth', () => ({ auth: jest.fn() }));

describe('GET /api/auth/session', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns 200 with user null when no session', async () => {
    auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toBeNull();
  });

  it('returns 200 with user when session exists', async () => {
    auth.mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Test',
        email: 'test@example.com',
        image: null,
        plan: 'PRO',
        leadsUsed: 5,
        leadsLimit: 100,
      },
      expires: '2025-12-31',
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toMatchObject({
      id: 'u1',
      name: 'Test',
      email: 'test@example.com',
      plan: 'PRO',
      leadsUsed: 5,
      leadsLimit: 100,
    });
  });

  it('returns defaults for plan/leads when not in session', async () => {
    auth.mockResolvedValue({
      user: { id: 'u1', name: 'T', email: 't@x.com' },
      expires: '',
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.plan).toBe('FREE');
    expect(json.user.leadsUsed).toBe(0);
    expect(json.user.leadsLimit).toBe(10);
  });
});
