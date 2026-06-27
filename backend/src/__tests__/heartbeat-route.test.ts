const { POST } = require('@/app/api/user/heartbeat/route');
const { auth } = require('@/auth');
const { setPresence } = require('@/lib/redis');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/redis', () => ({ setPresence: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));

describe('POST /api/user/heartbeat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(setPresence).not.toHaveBeenCalled();
  });

  it('returns 200 and sets presence when authenticated', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(setPresence).toHaveBeenCalledWith('u1');
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('returns 401 when auth() throws instead of 500', async () => {
    auth.mockRejectedValue(new Error('JWT session error'));
    const res = await POST();
    expect(res.status).toBe(401);
    expect(setPresence).not.toHaveBeenCalled();
  });
});
