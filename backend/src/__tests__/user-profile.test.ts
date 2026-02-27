const { POST } = require('@/app/api/user/profile/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { update: jest.fn() } } }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));

const updatedUserSelect = {
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
  notifyByEmail: true,
  notifyWeeklyReport: false,
  notifyLeadAlerts: false,
};

describe('POST /api/user/profile', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(new Request('http://localhost/api/user/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
  });
  it('returns 200 and updated user (personal profile only)', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.update.mockResolvedValue(updatedUserSelect);
    const res = await POST(new Request('http://localhost/api/user/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name', phone: '+5511999999999' }),
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      id: 'u1',
      name: 'New Name',
      email: 'u@x.com',
      notifyByEmail: true,
      notifyWeeklyReport: false,
      notifyLeadAlerts: false,
    });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: expect.objectContaining({ name: 'New Name', phone: '+5511999999999' }),
    }));
  });
  it('returns 500 when update throws', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.update.mockRejectedValue(new Error('DB error'));
    const res = await POST(new Request('http://localhost/api/user/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal Server Error' });
  });
});
