jest.mock('@/lib/prisma', () => ({ prisma: {} }));
import { computeOpportunityScore } from '@/lib/db-sync';
import type { PlaceResult } from '@/lib/google-places';

const base = (over: Partial<PlaceResult> = {}): PlaceResult => ({
    id: 'p1',
    displayName: { text: 'X', languageCode: 'pt-BR' },
    nationalPhoneNumber: '(11) 99999-0000',
    currentOpeningHours: { weekdayDescriptions: ['seg: 8-18'] },
    photos: [{ name: 'p' }],
    userRatingCount: 100,
    rating: 4.8,
    websiteUri: 'https://x.com',
    businessStatus: 'OPERATIONAL',
    ...over,
} as PlaceResult);

describe('computeOpportunityScore', () => {
    it('ranks a reachable business without website above an unreachable one', () => {
        const reachable = computeOpportunityScore(base({ websiteUri: undefined, userRatingCount: 3 }));
        const unreachable = computeOpportunityScore(base({ websiteUri: undefined, userRatingCount: 3, nationalPhoneNumber: undefined, currentOpeningHours: undefined }));
        expect(reachable.score).toBeGreaterThan(unreachable.score);
        expect(unreachable.factors.noPhone).toBe(true);
    });

    it('closed permanently scores 0 and temporarily closed is heavily reduced', () => {
        expect(computeOpportunityScore(base({ websiteUri: undefined, businessStatus: 'CLOSED_PERMANENTLY' })).score).toBe(0);
        const open = computeOpportunityScore(base({ websiteUri: undefined })).score;
        const temp = computeOpportunityScore(base({ websiteUri: undefined, businessStatus: 'CLOSED_TEMPORARILY' })).score;
        expect(temp).toBeLessThan(open / 2);
    });

    it('established business with website and great reviews is a low opportunity', () => {
        const { score, factors } = computeOpportunityScore(base());
        expect(score).toBeLessThanOrEqual(15);
        expect(factors.noWebsite).toBeUndefined();
    });

    it('keeps the factor keys the UI renders', () => {
        const { factors } = computeOpportunityScore(base({ websiteUri: undefined, userRatingCount: 2, rating: 3, photos: [], nationalPhoneNumber: undefined, currentOpeningHours: undefined }));
        expect(factors).toEqual(expect.objectContaining({ noWebsite: true, fewReviews: true, lowRating: true, noPhotos: true, noPhone: true, noHoursData: true }));
    });

    it('stays within 0-100', () => {
        const { score } = computeOpportunityScore(base({ websiteUri: undefined, userRatingCount: 0, rating: 1, photos: [] }));
        expect(score).toBeLessThanOrEqual(100);
        expect(score).toBeGreaterThan(80);
    });
});
