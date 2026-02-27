/**
 * Testes do fluxo de registro: criação de User + Workspace + WorkspaceMember.
 */

const { POST } = require('@/app/api/auth/register/route');

jest.mock('bcryptjs', () => ({ hash: jest.fn(() => Promise.resolve('hashed')) }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));

jest.mock('@/lib/prisma', () => {
  const mockTx = {
    user: { create: jest.fn() },
    workspace: { create: jest.fn() },
    workspaceMember: { create: jest.fn() },
  };
  return {
    prisma: {
      user: { findUnique: jest.fn(), create: jest.fn() },
      workspace: { create: jest.fn() },
      workspaceMember: { create: jest.fn() },
      verificationToken: { create: jest.fn() },
      $transaction: jest.fn((fn) => fn(mockTx)),
      _mockTx: mockTx,
    },
  };
});
jest.mock('@/lib/email', () => ({ sendVerificationEmail: jest.fn(() => Promise.resolve({ sent: true })) }));

const { sendVerificationEmail } = require('@/lib/email');

const prisma = require('@/lib/prisma').prisma;
const mockTx = prisma._mockTx;

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.verificationToken.create.mockResolvedValue({});
    mockTx.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    });
    mockTx.workspace.create.mockResolvedValue({
      id: 'ws-1',
      name: 'Test User - Workspace',
      plan: 'FREE',
      leadsLimit: 10,
      leadsUsed: 0,
    });
    mockTx.workspaceMember.create.mockResolvedValue({
      id: 'wm-1',
      userId: 'user-1',
      workspaceId: 'ws-1',
      role: 'OWNER',
    });
    prisma.$transaction.mockImplementation((fn) => fn(mockTx));
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'password123' }),
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required|missing|invalid|expected/i);
  });

  it('returns 400 when password is too short', async () => {
    const res = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'short' }),
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/8|password/i);
  });

  it('returns 400 when email already in use', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'test@example.com' });
    const res = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already in use/i);
  });

  it('creates user, workspace and workspaceMember in transaction', async () => {
    const res = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', password: 'password123', name: 'New User' }),
    }));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
        }),
      })
    );
    expect(mockTx.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'New User - Workspace',
          plan: 'FREE',
          leadsLimit: 10,
          leadsUsed: 0,
        }),
      })
    );
    expect(mockTx.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        workspaceId: 'ws-1',
        role: 'OWNER',
      },
    });
    const json = await res.json();
    expect(json.message).toMatch(/success/i);
    expect(json.requiresOnboarding).toBe(true);
    expect(prisma.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: 'new@example.com',
        token: expect.any(String),
        expires: expect.any(Date),
      }),
    });
    expect(sendVerificationEmail).toHaveBeenCalledWith('new@example.com', expect.any(String));
  });
});
