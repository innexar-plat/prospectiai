import { createProspectorAuthAdapter } from '@/lib/auth-adapter';
import { provisionOauthUserWithWorkspace, resolveAdapterMarket } from '@/lib/oauth-registration';

jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(() => ({
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    createSession: jest.fn(),
  })),
}));

jest.mock('@/lib/oauth-registration', () => ({
  provisionOauthUserWithWorkspace: jest.fn(),
  resolveAdapterMarket: jest.fn(),
}));

const { provisionOauthUserWithWorkspace: provision } = require('@/lib/oauth-registration');

describe('createProspectorAuthAdapter', () => {
  const prisma = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
    resolveAdapterMarket.mockResolvedValue('US');
    provision.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
  });

  it('delegates createUser to provisionOauthUserWithWorkspace with resolved market', async () => {
    const adapter = createProspectorAuthAdapter(prisma);
    provision.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Test' });
    const user = await adapter.createUser({ email: 'a@b.com', name: 'Test' });
    expect(resolveAdapterMarket).toHaveBeenCalled();
    expect(provision).toHaveBeenCalledWith({ email: 'a@b.com', name: 'Test' }, 'US');
    expect(user).toEqual({ id: 'u1', email: 'a@b.com', name: 'Test', emailVerified: null, image: null });
  });
});
