import { parseAffiliateRefFromCookie } from '@/lib/affiliate';
import { provisionOauthUserWithWorkspace } from '@/lib/oauth-registration';

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    user: { create: jest.fn() },
    workspace: { create: jest.fn() },
    workspaceMember: { create: jest.fn() },
  },
}));

jest.mock('@/lib/affiliate', () => ({
  attachReferralOnSignup: jest.fn(() => Promise.resolve()),
  parseAffiliateRefFromCookie: jest.fn(),
}));

const { prisma } = require('@/lib/prisma');
const { headers } = require('next/headers');
const { attachReferralOnSignup } = require('@/lib/affiliate');

describe('provisionOauthUserWithWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    headers.mockResolvedValue({
      get: (name: string) => {
        if (name === 'cookie') return null;
        return null;
      },
    });
  });

  it('creates inactive FREE workspace for BR market', async () => {
    const createdUser = { id: 'u1', email: 'a@b.com', name: 'Alice' };
    const createdWorkspace = { id: 'w1', plan: 'FREE', subscriptionStatus: 'inactive' };
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(createdUser) },
        workspace: {
          create: jest.fn().mockImplementation((args: { data: { plan: string; leadsLimit: number; subscriptionStatus: string } }) => {
            expect(args.data.plan).toBe('FREE');
            expect(args.data.leadsLimit).toBe(0);
            expect(args.data.subscriptionStatus).toBe('inactive');
            return Promise.resolve(createdWorkspace);
          }),
        },
        workspaceMember: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    const user = await provisionOauthUserWithWorkspace(
      { email: 'a@b.com', name: 'Alice' },
      'BR',
    );
    expect(user.id).toBe('u1');
    expect(attachReferralOnSignup).not.toHaveBeenCalled();
  });

  it('creates inactive FREE workspace for US market', async () => {
    const createdUser = { id: 'u2', email: 'us@x.com', name: 'Bob' };
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(createdUser) },
        workspace: {
          create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            expect(args.data.plan).toBe('FREE');
            expect(args.data.leadsLimit).toBe(0);
            expect(args.data.subscriptionStatus).toBe('inactive');
            return Promise.resolve({ id: 'w2', ...args.data });
          }),
        },
        workspaceMember: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    await provisionOauthUserWithWorkspace({ email: 'us@x.com', name: 'Bob' }, 'US');
  });

  it('uses My Workspace default name for US OAuth without display name', async () => {
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue({ id: 'u4', email: 'anon@x.com' }) },
        workspace: {
          create: jest.fn().mockImplementation((args: { data: { name: string } }) => {
            expect(args.data.name).toBe('My Workspace');
            return Promise.resolve({ id: 'w4', plan: 'FREE' });
          }),
        },
        workspaceMember: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    await provisionOauthUserWithWorkspace({ email: 'anon@x.com' }, 'US');
  });

  it('attaches affiliate referral when affiliate_ref cookie is present', async () => {
    headers.mockResolvedValue({
      get: (name: string) => (name === 'cookie' ? 'affiliate_ref=PARTNER1' : null),
    });
    (parseAffiliateRefFromCookie as jest.Mock).mockReturnValue('PARTNER1');

    const createdUser = { id: 'u3', email: 'ref@x.com', name: 'Ref' };
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(createdUser) },
        workspace: { create: jest.fn().mockResolvedValue({ id: 'w3', plan: 'FREE' }) },
        workspaceMember: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    await provisionOauthUserWithWorkspace({ email: 'ref@x.com', name: 'Ref' }, 'BR');
    expect(attachReferralOnSignup).toHaveBeenCalledWith({
      affiliateCode: 'PARTNER1',
      userId: 'u3',
      workspaceId: 'w3',
      email: 'ref@x.com',
    });
  });
});

describe('parseAffiliateRefFromCookie', () => {
  it('parses affiliate_ref cookie', () => {
    jest.unmock('@/lib/affiliate');
    const { parseAffiliateRefFromCookie: parse } = jest.requireActual('@/lib/affiliate');
    expect(parse('affiliate_ref=abc12; other=1')).toBe('ABC12');
    expect(parse('')).toBeNull();
  });
});
