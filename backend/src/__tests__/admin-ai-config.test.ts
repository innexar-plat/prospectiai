/**
 * Admin ai-config API: ensure API key is never returned in responses.
 */
import { GET } from '@/app/api/admin/ai-config/route';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    aiProviderConfig: {
      findMany: jest.fn(),
    },
  },
}));

const auth = require('@/auth').auth;
const isAdmin = require('@/lib/admin').isAdmin;
const prisma = require('@/lib/prisma').prisma;

describe('GET /api/admin/ai-config', () => {
  beforeEach(() => {
    auth.mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
    isAdmin.mockReturnValue(true);
  });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    isAdmin.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns list without apiKey or apiKeyEncrypted in items', async () => {
    prisma.aiProviderConfig.findMany.mockResolvedValue([
      {
        id: 'c1',
        role: 'LEAD_ANALYSIS',
        provider: 'GEMINI',
        model: 'gemini-flash-latest',
        enabled: true,
        cloudflareAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        apiKeyEncrypted: 'encrypted-value-never-expose',
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toHaveProperty('hasApiKey', true);
    expect(data.items[0]).not.toHaveProperty('apiKey');
    expect(data.items[0]).not.toHaveProperty('apiKeyEncrypted');
  });
});
