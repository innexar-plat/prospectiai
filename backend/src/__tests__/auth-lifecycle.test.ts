/**
 * Tests for auth configuration: session maxAge, JWT strategy, disabled users, cookies
 */
import bcrypt from 'bcryptjs';

// --- Mocks ---
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }));
jest.mock('next-auth/providers/google', () => ({ __esModule: true, default: jest.fn(() => ({ id: 'google' })) }));
jest.mock('next-auth/providers/github', () => ({ __esModule: true, default: jest.fn(() => ({ id: 'github' })) }));
jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: jest.fn((cfg: unknown) => cfg),
}));
jest.mock('@/lib/admin', () => ({ getPanelRole: jest.fn(() => null) }));

// Mock NextAuth to capture config
let capturedConfig: Record<string, unknown> = {};
jest.mock('next-auth', () => {
  const CredentialsSignin = class extends Error { constructor(m: string) { super(m); this.name = 'CredentialsSignin'; } };
  return Object.assign(
    (config: Record<string, unknown>) => {
      capturedConfig = config;
      return { handlers: {}, auth: jest.fn(), signIn: jest.fn(), signOut: jest.fn() };
    },
    { CredentialsSignin },
  );
});

// Trigger module evaluation to populate capturedConfig
beforeAll(() => {
  jest.isolateModules(() => {
    require('@/auth');
  });
});

describe('Auth Configuration', () => {
  it('uses JWT strategy with 30-day maxAge', () => {
    const session = capturedConfig.session as { strategy: string; maxAge: number };
    expect(session.strategy).toBe('jwt');
    expect(session.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it('sets httpOnly + secure + sameSite=lax on all cookies', () => {
    const cookies = capturedConfig.cookies as Record<string, { options: Record<string, unknown> }>;
    for (const [name, cookie] of Object.entries(cookies)) {
      expect(cookie.options.httpOnly).toBe(true);
      expect(cookie.options.secure).toBe(true);
      expect(cookie.options.sameSite).toBe('lax');
    }
  });

  it('has trustHost enabled', () => {
    expect(capturedConfig.trustHost).toBe(true);
  });
});

describe('Auth Callbacks', () => {
  const { prisma } = require('@/lib/prisma');
  const callbacks = () => capturedConfig.callbacks as Record<string, Function>;

  beforeEach(() => { jest.clearAllMocks(); });

  it('signIn rejects disabled users (OAuth)', async () => {
    prisma.user.findUnique.mockResolvedValue({ disabledAt: new Date() });
    const result = await callbacks().signIn({ user: { email: 'x@x.com' }, account: { provider: 'google' } });
    expect(result).toBe(false);
  });

  it('signIn allows active users (OAuth)', async () => {
    prisma.user.findUnique.mockResolvedValue({ disabledAt: null });
    const result = await callbacks().signIn({ user: { email: 'x@x.com' }, account: { provider: 'google' } });
    expect(result).toBe(true);
  });

  it('signIn rejects users without email (OAuth)', async () => {
    const result = await callbacks().signIn({ user: {}, account: { provider: 'google' } });
    expect(result).toBe(false);
  });

  it('signIn passes through credentials provider', async () => {
    const result = await callbacks().signIn({ user: { email: 'x@x.com' }, account: { provider: 'credentials' } });
    expect(result).toBe(true);
  });

  it('jwt callback sets user fields on initial login', async () => {
    const token = {};
    const user = { id: 'u1', email: 'a@b.com', name: 'Test', image: 'https://img.jpg' };
    const result = await callbacks().jwt({ token, user });
    expect(result.id).toBe('u1');
    expect(result.email).toBe('a@b.com');
    expect(result.name).toBe('Test');
    expect(result.picture).toBe('https://img.jpg');
  });

  it('session callback enriches session with token data', async () => {
    const session = { user: { id: '', email: '', name: '' }, expires: '' };
    const token = { id: 'u1', email: 'a@b.com', role: 'admin' };
    const result = await callbacks().session({ session, token });
    expect(result.user.id).toBe('u1');
    expect(result.user.email).toBe('a@b.com');
    expect(result.user.role).toBe('admin');
  });

  it('redirect callback keeps same-origin URLs', async () => {
    const result = await callbacks().redirect({ url: 'https://precisionia.com.br/dashboard', baseUrl: 'https://precisionia.com.br' });
    expect(result).toBe('https://precisionia.com.br/dashboard');
  });

  it('redirect callback resolves relative paths', async () => {
    const result = await callbacks().redirect({ url: '/dashboard', baseUrl: 'https://precisionia.com.br' });
    expect(result).toBe('https://precisionia.com.br/dashboard');
  });

  it('redirect callback blocks cross-origin URLs', async () => {
    const result = await callbacks().redirect({ url: 'https://evil.com/phish', baseUrl: 'https://precisionia.com.br' });
    expect(result).toBe('https://precisionia.com.br');
  });
});

describe('Credentials Provider', () => {
  const { prisma } = require('@/lib/prisma');

  function getCredentialsAuthorize(): Function {
    const providers = capturedConfig.providers as Array<{ name?: string; credentials?: unknown; authorize?: Function }>;
    const creds = providers.find((p) => p.name === 'credentials' || p.credentials);
    return creds!.authorize!;
  }

  beforeEach(() => { jest.clearAllMocks(); });

  it('returns null for missing email/password', async () => {
    const authorize = getCredentialsAuthorize();
    const result = await authorize({});
    expect(result).toBeNull();
  });

  it('returns null when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const authorize = getCredentialsAuthorize();
    const result = await authorize({ email: 'a@b.com', password: 'pass' });
    expect(result).toBeNull();
  });

  it('returns null for wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', password: hash });
    const authorize = getCredentialsAuthorize();
    const result = await authorize({ email: 'a@b.com', password: 'wrong' });
    expect(result).toBeNull();
  });

  it('returns user for correct credentials', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', password: hash, disabledAt: null });
    const authorize = getCredentialsAuthorize();
    const result = await authorize({ email: 'a@b.com', password: 'correct' });
    expect(result).toMatchObject({ id: 'u1', email: 'a@b.com' });
  });

  it('throws for disabled account', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', password: hash, disabledAt: new Date() });
    const authorize = getCredentialsAuthorize();
    await expect(authorize({ email: 'a@b.com', password: 'correct' })).rejects.toThrow();
  });
});
