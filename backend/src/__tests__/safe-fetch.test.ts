jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
import { lookup } from 'node:dns/promises';
import { assertPublicHttpUrl, isPrivateAddress, safeFetch } from '@/lib/safe-fetch';

const mockLookup = lookup as unknown as jest.Mock;

describe('isPrivateAddress', () => {
    it.each(['10.0.0.1', '127.0.0.1', '172.20.1.1', '192.168.0.10', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1'])('blocks %s', (ip) => {
        expect(isPrivateAddress(ip)).toBe(true);
    });
    it.each(['8.8.8.8', '172.32.0.1', '2606:4700::1111'])('allows %s', (ip) => {
        expect(isPrivateAddress(ip)).toBe(false);
    });
});

describe('assertPublicHttpUrl', () => {
    beforeEach(() => mockLookup.mockReset());

    it('rejects internal hosts, protocols and private resolutions', async () => {
        await expect(assertPublicHttpUrl('http://prospector-redis:6379')).rejects.toThrow('internal');
        await expect(assertPublicHttpUrl('http://localhost:4000')).rejects.toThrow('internal');
        await expect(assertPublicHttpUrl('file:///etc/passwd')).rejects.toThrow('protocol');
        await expect(assertPublicHttpUrl('http://169.254.169.254/latest')).rejects.toThrow('private');
        mockLookup.mockResolvedValueOnce([{ address: '10.1.2.3', family: 4 }]);
        await expect(assertPublicHttpUrl('https://evil.example.org')).rejects.toThrow('private');
    });

    it('accepts public hosts', async () => {
        mockLookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
        await expect(assertPublicHttpUrl('https://padaria.com.br/contato')).resolves.toBeInstanceOf(URL);
    });
});

describe('safeFetch', () => {
    const realFetch = global.fetch;
    afterEach(() => { global.fetch = realFetch; });

    it('re-validates redirects and blocks a hop to a private address', async () => {
        mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
        global.fetch = jest.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } })) as unknown as typeof fetch;
        await expect(safeFetch('https://site.com.br')).rejects.toThrow('private');
    });
});
