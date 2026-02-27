/**
 * Competitors module — runCompetitorAnalysis
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
const { runCompetitorAnalysis } = require('@/modules/competitors/application/competitor.service');

describe('runCompetitorAnalysis', () => {
  beforeEach(() => jest.clearAllMocks());

  it('aggregates ranking by rating and digital presence', async () => {
    jest.mocked(runSearchAllPages).mockResolvedValue({
      places: [
        { id: 'p1', displayName: { text: 'Cafe A' }, rating: 4.8, userRatingCount: 100, websiteUri: 'https://a.com', nationalPhoneNumber: '+5511' },
        { id: 'p2', displayName: { text: 'Cafe B' }, rating: 4.2, userRatingCount: 50, websiteUri: null, nationalPhoneNumber: null },
        { id: 'p3', displayName: { text: 'Cafe C' }, rating: 4.5, userRatingCount: 80, websiteUri: 'https://c.com', nationalPhoneNumber: null },
      ],
      totalFetched: 3,
    });

    const result = await runCompetitorAnalysis(
      { textQuery: 'cafes', pageSize: 60 },
      'user-1'
    );

    expect(runSearchAllPages).toHaveBeenCalledWith(expect.objectContaining({ textQuery: 'cafes', pageSize: 60 }), 'user-1', 60);
    expect(result.totalCount).toBe(3);
    expect(result.rankingByRating).toHaveLength(3);
    expect(result.rankingByRating[0].name).toBe('Cafe A');
    expect(result.rankingByRating[0].rating).toBe(4.8);
    expect(result.rankingByReviews[0].name).toBe('Cafe A');
    expect(result.rankingByReviews[0].reviewCount).toBe(100);
    expect(result.digitalPresence.withWebsite).toBe(2);
    expect(result.digitalPresence.withoutWebsite).toBe(1);
    expect(result.digitalPresence.withPhone).toBe(1);
    expect(result.opportunities.some((o) => o.missingWebsite)).toBe(true);
  });

  it('returns empty rankings when no places', async () => {
    jest.mocked(runSearchAllPages).mockResolvedValue({ places: [], totalFetched: 0 });

    const result = await runCompetitorAnalysis({ textQuery: 'xyz' }, 'u1');

    expect(result.totalCount).toBe(0);
    expect(result.rankingByRating).toEqual([]);
    expect(result.rankingByReviews).toEqual([]);
    expect(result.digitalPresence).toEqual({ withWebsite: 0, withoutWebsite: 0, withPhone: 0, withoutPhone: 0 });
    expect(result.opportunities).toEqual([]);
  });
});
