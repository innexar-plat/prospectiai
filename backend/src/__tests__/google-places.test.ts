import { textSearch } from '@/lib/google-places';

global.fetch = jest.fn();

describe('Google Places Lib', () => {
    beforeEach(() => {
        process.env.GOOGLE_PLACES_API_KEY = 'test-key';
        jest.mocked(fetch).mockClear();
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
});
