import { logAdminAction } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: { auditLog: { create: jest.fn().mockResolvedValue({}) } },
}));

describe('logAdminAction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when session is null', async () => {
    await logAdminAction(null, 'admin.stats');
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('does nothing when session has no user id', async () => {
    await logAdminAction({ user: { id: '' }, expires: '' } as never, 'admin.stats');
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('creates audit log when session is valid', async () => {
    const session = { user: { id: 'u1', email: 'admin@test.com' }, expires: '2025-12-31' };
    await logAdminAction(session as never, 'admin.stats', { details: { users: 10 } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        adminEmail: 'admin@test.com',
        action: 'admin.stats',
        resource: undefined,
        resourceId: undefined,
        details: { users: 10 },
      },
    });
  });

  it('creates audit log with resource and resourceId', async () => {
    const session = { user: { id: 'u1', email: 'a@b.com' }, expires: '' };
    await logAdminAction(session as never, 'admin.users.get', { resource: 'users', resourceId: 'u2' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        adminEmail: 'a@b.com',
        action: 'admin.users.get',
        resource: 'users',
        resourceId: 'u2',
        details: undefined,
      },
    });
  });
});
