import { extractEmails, findContactPageUrl, pickBestEmail } from '@/lib/website-scraper';

describe('website e-mail helpers', () => {
    it('drops asset and placeholder addresses', () => {
        expect(extractEmails('logo@2x.png contato@padaria.com.br seuemail@gmail.com x@sentry.io VENDAS@Padaria.com.br')).toEqual(['contato@padaria.com.br', 'vendas@padaria.com.br']);
    });

    it('prefers the site domain', () => {
        expect(pickBestEmail(['dono@gmail.com', 'oi@padaria.com.br'], 'https://www.padaria.com.br')).toBe('oi@padaria.com.br');
        expect(pickBestEmail(['dono@gmail.com'], 'padaria.com.br')).toBe('dono@gmail.com');
        expect(pickBestEmail([], 'padaria.com.br')).toBeNull();
    });

    it('finds a same-site contact page and ignores WhatsApp/external links', () => {
        const html = '<a href="https://wa.me/55119">Contato</a><a href="https://outro.com/contato">Contato</a><a href="/fale-conosco">Fale conosco</a>';
        expect(findContactPageUrl(html, 'https://padaria.com.br/')).toBe('https://padaria.com.br/fale-conosco');
        expect(findContactPageUrl('<a href="/sobre">Sobre</a>', 'https://padaria.com.br')).toBeNull();
    });
});
