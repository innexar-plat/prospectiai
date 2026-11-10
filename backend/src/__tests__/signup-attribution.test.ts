const mockFind = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue({});
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => mockFind(...a), update: (...a: unknown[]) => mockUpdate(...a) } } }));

import { attributionSchema, describeAttribution, saveAttribution, signupOriginLabel } from '@/lib/signup-attribution';

beforeEach(() => jest.clearAllMocks());

describe('signup attribution', () => {
    it('writes the first touch once and always updates the answer', async () => {
        mockFind.mockResolvedValueOnce({ signupSource: null });
        await saveAttribution('u1', { firstTouch: { source: 'coldmail', landing: '/amostra' }, heardFrom: 'google' });
        expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { signupSource: { source: 'coldmail', landing: '/amostra' }, heardFrom: 'google' } });

        mockFind.mockResolvedValueOnce({ signupSource: { source: 'seo' } });
        await saveAttribution('u1', { firstTouch: { source: 'other' }, heardFrom: 'outro', heardFromOther: 'feira' });
        expect(mockUpdate).toHaveBeenLastCalledWith({ where: { id: 'u1' }, data: { heardFrom: 'outro: feira' } });
    });

    it('rejects unknown answers', () => {
        expect(attributionSchema.safeParse({ heardFrom: 'tiktok-hack' }).success).toBe(false);
    });

    it('describes the origin for humans', () => {
        expect(describeAttribution({ source: 'coldmail', medium: 'sample', landing: '/amostra' }, null)).toBe('utm coldmail/sample · entrou em /amostra');
        expect(describeAttribution({ referrer: 'https://www.google.com/', landing: '/empresas/x' }, 'indicacao')).toBe('veio de google.com · entrou em /empresas/x · disse: Indicação');
        expect(describeAttribution({ landing: '/' }, 'outro: feira')).toBe('acesso direto · entrou em / · disse: Outro (feira)');
        expect(describeAttribution(null, null)).toBeNull();
    });

    it('labels users without data and never throws', async () => {
        mockFind.mockResolvedValueOnce({ signupSource: null, heardFrom: null });
        expect(await signupOriginLabel('u1')).toBe('sem origem registrada');
        mockFind.mockRejectedValueOnce(new Error('db down'));
        expect(await signupOriginLabel('u1')).toBeNull();
    });
});
