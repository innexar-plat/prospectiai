/**
 * Admin email config API: ensure API key and password are never returned.
 */
import { GET, PATCH } from '@/app/api/admin/email/config/route';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/email-config-encrypt', () => ({
  encryptEmailSecret: jest.fn((plain: string) => `encrypted-${plain}`),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    emailConfig: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const auth = require('@/auth').auth;
const isAdmin = require('@/lib/admin').isAdmin;
const prisma = require('@/lib/prisma').prisma;

describe('GET /api/admin/email/config', () => {
  beforeEach(() => {
    auth.mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.emailConfig.findFirst.mockResolvedValue(null);
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

  it('returns config without apiKey or password when admin', async () => {
    prisma.emailConfig.findFirst.mockResolvedValue({
      id: 'ec1',
      provider: 'resend',
      resendApiKeyEncrypted: 'encrypted-key',
      fromEmail: 'From <noreply@test.com>',
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
      smtpPasswordEncrypted: null,
      updatedAt: new Date(),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(true);
    expect(data.provider).toBe('resend');
    expect(data.fromEmail).toBe('From <noreply@test.com>');
    expect(data.hasResendApiKey).toBe(true);
    expect(data).not.toHaveProperty('resendApiKeyEncrypted');
    expect(data).not.toHaveProperty('apiKey');
    expect(data).not.toHaveProperty('smtpPasswordEncrypted');
    expect(data).not.toHaveProperty('smtpPassword');
  });

  it('returns configured false and no secrets when no row', async () => {
    prisma.emailConfig.findFirst.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(false);
    expect(data).not.toHaveProperty('resendApiKeyEncrypted');
    expect(data).not.toHaveProperty('smtpPasswordEncrypted');
  });
});

describe('PATCH /api/admin/email/config', () => {
  beforeEach(() => {
    auth.mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
    isAdmin.mockReturnValue(true);
    prisma.emailConfig.findFirst.mockResolvedValue(null);
    prisma.emailConfig.create.mockResolvedValue({
      id: 'ec1',
      provider: 'resend',
      resendApiKeyEncrypted: 'encrypted-re_xxx',
      fromEmail: 'noreply@example.com',
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
      smtpPasswordEncrypted: null,
      updatedAt: new Date(),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const req = new Request('http://localhost/api/admin/email/config', {
      method: 'PATCH',
      body: JSON.stringify({ provider: 'resend', apiKey: 're_xxx', fromEmail: 'From <noreply@test.com>' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    isAdmin.mockReturnValue(false);
    const req = new Request('http://localhost/api/admin/email/config', {
      method: 'PATCH',
      body: JSON.stringify({ provider: 'resend', apiKey: 're_xxx' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 and public config when admin with valid resend body', async () => {
    const req = new Request('http://localhost/api/admin/email/config', {
      method: 'PATCH',
      body: JSON.stringify({
        provider: 'resend',
        apiKey: 're_xxx',
        fromEmail: 'noreply@example.com',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(true);
    expect(data.provider).toBe('resend');
    expect(data.fromEmail).toBe('noreply@example.com');
    expect(data.hasResendApiKey).toBe(true);
    expect(data).not.toHaveProperty('resendApiKeyEncrypted');
    expect(data).not.toHaveProperty('apiKey');
  });
});
