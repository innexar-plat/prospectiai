import { getUsCitySuggestions } from '@/lib/us-city-suggestions';

const originalKey = process.env.GOOGLE_PLACES_API_KEY;

describe('getUsCitySuggestions', () => {
    beforeEach(() => {
        process.env.GOOGLE_PLACES_API_KEY = 'test-key';
        global.fetch = jest.fn();
    });

    afterEach(() => {
        process.env.GOOGLE_PLACES_API_KEY = originalKey;
        jest.resetAllMocks();
    });

    it('returns empty array when state or query is too short', async () => {
        await expect(getUsCitySuggestions('', 'aus')).resolves.toEqual([]);
        await expect(getUsCitySuggestions('TX', 'a')).resolves.toEqual([]);
    });

    it('parses locality suggestions filtered by state', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                suggestions: [
                    {
                        placePrediction: {
                            structuredFormat: {
                                mainText: { text: 'Austin' },
                                secondaryText: { text: 'TX, USA' },
                            },
                        },
                    },
                    {
                        placePrediction: {
                            structuredFormat: {
                                mainText: { text: 'Dallas' },
                                secondaryText: { text: 'TX, USA' },
                            },
                        },
                    },
                ],
            }),
        });

        const cities = await getUsCitySuggestions('TX', 'aus');
        expect(cities).toEqual(['Austin', 'Dallas']);
    });

    it('returns empty array when API key is missing', async () => {
        delete process.env.GOOGLE_PLACES_API_KEY;
        await expect(getUsCitySuggestions('CA', 'san')).resolves.toEqual([]);
    });
});
