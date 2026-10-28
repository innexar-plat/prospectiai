jest.mock('@/lib/prisma', () => ({ prisma: {} }));
import { keepGroundedSocialLinks } from '@/lib/gemini';

describe('keepGroundedSocialLinks', () => {
    const source = 'Site: https://padaria.com.br ... siga https://www.instagram.com/padariadobairro/ e facebook.com/PadariaDoBairro';

    it('keeps links present in the collected data', () => {
        const r = keepGroundedSocialLinks({
            instagram: 'https://instagram.com/padariadobairro',
            facebook: 'https://www.facebook.com/PadariaDoBairro',
        }, source);
        expect(r.instagram).toBe('https://instagram.com/padariadobairro');
        expect(r.facebook).toBe('https://www.facebook.com/PadariaDoBairro');
    });

    it('drops invented links, placeholders and bare domains', () => {
        const r = keepGroundedSocialLinks({
            instagram: 'https://instagram.com/padaria_inventada',
            facebook: 'Não encontrado',
            linkedin: 'https://linkedin.com/',
        }, source);
        expect(r).toEqual({ instagram: undefined, facebook: undefined, linkedin: undefined });
    });
});
