import { US_SEGMENTS, buildUsWhere } from '@/lib/us-query';
import { buildOptOutFooter, easternLagMs } from '@/modules/auto-prospeccao/application/email-sequence.worker';
import { isUsProfile } from '@/modules/auto-prospeccao/application/search.worker';
import type { SearchProfile } from '@prisma/client';

describe('US base query', () => {
    it('is parameterised and refuses searches without category and state', () => {
        const w = buildUsWhere({ categories: ['dental_clinic', "x'; DROP"], states: ['fl', 'Texas'], city: ' Miami ', hasEmail: true });
        expect(w.sql).toBe('category IN ($1) AND state IN ($2::char(2)) AND "cityNorm" = $3 AND email IS NOT NULL');
        expect(w.params).toEqual(['dental_clinic', 'FL', 'miami']);
        expect(buildUsWhere({ categories: [], states: ['FL'] }).sql).toBe('false');
        expect(buildUsWhere({ categories: ['gym'], states: [] }).sql).toBe('false');
    });
    it('has unique segments with valid categories', () => {
        expect(new Set(US_SEGMENTS.map((s) => s.slug)).size).toBe(US_SEGMENTS.length);
        expect(US_SEGMENTS.every((s) => s.categories.every((c) => /^[a-z0-9_]+$/.test(c)))).toBe(true);
    });
});

describe('US outreach', () => {
    it('shifts the clock to Eastern time, with and without daylight saving', () => {
        expect(easternLagMs(new Date('2026-12-01T14:00:00Z'))).toBe(2 * 3600000);
        expect(easternLagMs(new Date('2026-07-01T14:00:00Z'))).toBe(1 * 3600000);
        expect(easternLagMs(new Date('2026-12-01T02:00:00Z'))).toBe(2 * 3600000);
    });
    it('footer is English with the postal address', () => {
        const f = buildOptOutFooter('https://x/o/1', { postalAddress: '1 Main St <Miami>' });
        expect(f).toContain('Unsubscribe');
        expect(f).toContain('1 Main St &lt;Miami>');
        expect(f).not.toContain('Você');
    });
    it('tells US profiles (categories) from BR ones (CNAE)', () => {
        expect(isUsProfile({ cnaeList: ['marketing_agency'] } as unknown as SearchProfile)).toBe(true);
        expect(isUsProfile({ cnaeList: ['7311'] } as unknown as SearchProfile)).toBe(false);
        expect(isUsProfile({ cnaeList: null } as unknown as SearchProfile)).toBe(false);
    });
});
