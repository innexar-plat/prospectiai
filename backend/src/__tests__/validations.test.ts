import { registerSchema, searchSchema, formatZodError } from '@/lib/validations/schemas';

describe('Validations', () => {
    it('registerSchema parses valid input', () => {
        const r = registerSchema.safeParse({ email: 'a@b.com', password: 'password123' });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.email).toBe('a@b.com');
    });

    it('registerSchema fails on short password', () => {
        const r = registerSchema.safeParse({ email: 'a@b.com', password: 'short' });
        expect(r.success).toBe(false);
    });

    it('searchSchema parses valid input', () => {
        const r = searchSchema.safeParse({ textQuery: 'cafes' });
        expect(r.success).toBe(true);
    });

    it('formatZodError returns string for failed parse', () => {
        const r = registerSchema.safeParse({ email: 'x', password: 'short' });
        expect(r.success).toBe(false);
        if (!r.success) expect(typeof formatZodError(r)).toBe('string');
    });
});
