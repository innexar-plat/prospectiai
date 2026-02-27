/**
 * Market module — runMarketReport
 */
jest.mock('@/modules/search', () => ({
  runSearch: jest.fn(),
  runSearchAllPages: jest.fn(),
  SEARCH_ALL_PAGES_MAX_PLACES: 60,
  SearchHttpError: class SearchHttpError extends Error {
    constructor(public status: number, public body: Record<string, unknown>) {
      super('SearchHttpError');
    }
  },
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'u1',
        workspaces: [{ workspace: { id: 'w1' } }],
      }),
    },
    intelligenceReport: { create: jest.fn().mockResolvedValue({}) },
  },
}));

const { runSearchAllPages } = require('@/modules/search');
const { runMarketReport } = require('@/modules/market/application/market.service');

describe('runMarketReport', () => {
  beforeEach(() => jest.clearAllMocks());

  it('aggregates segments and digital maturity', async () => {
    jest.mocked(runSearchAllPages).mockResolvedValue({
      places: [
        { primaryType: 'restaurant', rating: 4.5, websiteUri: 'https://a.com', nationalPhoneNumber: '+5511' },
        { primaryType: 'restaurant', rating: 4.0, websiteUri: null, nationalPhoneNumber: '+5512' },
        { primaryType: 'cafe', rating: 4.8, websiteUri: 'https://c.com', nationalPhoneNumber: null },
      ],
      totalFetched: 3,
    });

    const result = await runMarketReport(
      { textQuery: 'restaurantes', pageSize: 60 },
      'user-1'
    );

    expect(runSearchAllPages).toHaveBeenCalledWith(
      expect.objectContaining({ textQuery: 'restaurantes', includedType: undefined, city: undefined, state: undefined }),
      'user-1',
      60
    );
    expect(result.totalBusinesses).toBe(3);
    expect(result.segments).toHaveLength(2);
    const rest = result.segments.find((s) => s.type === 'restaurant');
    const cafe = result.segments.find((s) => s.type === 'cafe');
    expect(rest?.count).toBe(2);
    expect(cafe?.count).toBe(1);
    expect(result.digitalMaturity.total).toBe(3);
    expect(result.digitalMaturity.withWebsite).toBe(2);
    expect(result.digitalMaturity.withPhone).toBe(2);
    expect(result.saturationIndex).toBeGreaterThanOrEqual(1);
  });

  it('uses establishment when no type', async () => {
    jest.mocked(runSearchAllPages).mockResolvedValue({
      places: [{ types: [], rating: 3 }],
      totalFetched: 1,
    });

    const result = await runMarketReport({ textQuery: 'x' }, 'u1');

    expect(result.totalBusinesses).toBe(1);
    expect(result.segments[0].type).toBe('establishment');
    expect(result.digitalMaturity.withWebsitePercent).toBe(0);
  });
});
