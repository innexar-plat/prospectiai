import { describe, it, expect, afterEach, vi } from 'vitest';
import { US_CATEGORY_GROUPS, resolveSearchCategoryGroups } from './searchTemplateGroups.us';

const BR_STUB = [{ label: 'SAÚDE & BEM-ESTAR', templates: [] }];

describe('searchTemplateGroups.us', () => {
    const originalHostname = window.location.hostname;

    afterEach(() => {
        vi.stubGlobal('location', { ...window.location, hostname: originalHostname });
    });

    it('returns US templates on US hostname', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
        const groups = resolveSearchCategoryGroups(BR_STUB);
        expect(groups).toBe(US_CATEGORY_GROUPS);
        expect(groups[0]?.label).toBe('HEALTH & WELLNESS');
    });

    it('returns BR templates on BR hostname', () => {
        vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
        const groups = resolveSearchCategoryGroups(BR_STUB);
        expect(groups).toBe(BR_STUB);
        expect(groups[0]?.label).toBe('SAÚDE & BEM-ESTAR');
    });
});
