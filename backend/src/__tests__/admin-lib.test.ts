import { isAdmin } from '@/lib/admin';

describe('isAdmin', () => {
    const orig = process.env.ADMIN_EMAILS;
    afterEach(() => { process.env.ADMIN_EMAILS = orig; });

    it('returns false when session is null', () => {
        expect(isAdmin(null)).toBe(false);
    });

    it('returns false when ADMIN_EMAILS is not set', () => {
        delete process.env.ADMIN_EMAILS;
        expect(isAdmin({ user: { email: 'a@b.com' }, expires: '' } as never)).toBe(false);
    });

    it('returns true when email is in ADMIN_EMAILS', () => {
        process.env.ADMIN_EMAILS = 'admin@test.com';
        expect(isAdmin({ user: { email: 'admin@test.com' }, expires: '' } as never)).toBe(true);
    });
});
