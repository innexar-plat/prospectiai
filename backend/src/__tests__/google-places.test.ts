jest.mock('@/lib/redis', () => ({
    getCached: jest.fn(),
    setCached: jest.fn().mockResolvedValue(undefined),
}));

import { textSearch } from '@/lib/google-places';
import { getCached, setCached } from '@/lib/redis';

global.fetch = jest.fn();

describe('Google Places Lib', () => {
    beforeEach(() => {
        process.env.GOOGLE_PLACES_API_KEY = 'test-key';
        jest.mocked(fetch).mockClear();
        jest.mocked(getCached).mockReset();
        jest.mocked(setCached).mockClear();
    });

    it('should fetch places and return formatted results', async () => {
        jest.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => ({
                places: [
                    { id: '123', displayName: { text: 'Test Business' }, formattedAddress: 'Address' }
                ]
            })
        });

        const result = await textSearch({ textQuery: 'cafes', pageSize: 5 });

        expect(result.places).toHaveLength(1);
        expect(result.places[0].displayName.text).toBe('Test Business');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('places:searchText'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"pageSize":5')
            })
        );
    });

    it('should throw error if fetch fails', async () => {
        jest.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 403,
            text: async () => 'Forbidden'
        });

        await expect(textSearch({ textQuery: 'fail' })).rejects.toThrow('Places API error (403): Forbidden');
    });

    it('rebuilds paging request with locationBias when page token cache misses', async () => {
        jest.mocked(getCached).mockResolvedValue(null);
        jest.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ places: [] }),
        });

        await textSearch({
            textQuery: 'fazendas pecuaria ms',
            pageToken: 'token-1',
            pageSize: 20,
            languageCode: 'pt-BR',
            regionCode: 'BR',
            locationBias: {
                center: { latitude: -20.4697, longitude: -54.6201 },
                radius: 50000,
            },
        });

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('places:searchText'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"pageToken":"token-1"'),
            })
        );

        const [, requestInit] = jest.mocked(fetch).mock.calls[0];
        const parsedBody = JSON.parse(String(requestInit?.body));
        expect(parsedBody.locationBias).toEqual({
            circle: {
                center: { latitude: -20.4697, longitude: -54.6201 },
                radius: 50000,
            },
        });
    });
});
