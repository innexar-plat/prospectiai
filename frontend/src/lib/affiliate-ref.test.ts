import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setAffiliateRef, getAffiliateRef, clearAffiliateRef, captureRefFromUrl } from './affiliate-ref';

describe('affiliate-ref', () => {
  let cookieStore: string;

  beforeEach(() => {
    cookieStore = '';
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => cookieStore,
      set: (v: string) => {
        const [part] = v.split(';');
        const [name, val] = part.split('=').map((s) => s.trim());
        if (val === '' || (name && val === undefined)) {
          cookieStore = cookieStore.replace(new RegExp(`${name}=[^;]*;?`), '');
        } else {
          cookieStore = cookieStore ? `${cookieStore}; ${part}` : part;
        }
      },
    });
  });

  describe('setAffiliateRef', () => {
    it('does nothing when code is empty', () => {
      setAffiliateRef('');
      setAffiliateRef('   ');
      expect(document.cookie).toBe('');
    });

    it('sets cookie with trimmed uppercase code', () => {
      setAffiliateRef('  abc123  ');
      expect(document.cookie).toContain('affiliate_ref=');
      expect(document.cookie).toContain(encodeURIComponent('ABC123'));
    });

    it('slices to 50 chars', () => {
      setAffiliateRef('A'.repeat(60));
      expect(document.cookie).toContain(encodeURIComponent('A'.repeat(50)));
    });
  });

  describe('getAffiliateRef', () => {
    it('returns null when no cookie', () => {
      expect(getAffiliateRef()).toBeNull();
    });

    it('returns decoded value when cookie set', () => {
      cookieStore = `affiliate_ref=${encodeURIComponent('MYCODE')}; path=/`;
      expect(getAffiliateRef()).toBe('MYCODE');
    });

    it('returns null for empty value', () => {
      cookieStore = 'affiliate_ref=; path=/';
      expect(getAffiliateRef()).toBeNull();
    });
  });

  describe('clearAffiliateRef', () => {
    it('clears cookie so getAffiliateRef returns null', () => {
      cookieStore = 'affiliate_ref=OLD';
      expect(getAffiliateRef()).toBe('OLD');
      clearAffiliateRef();
      expect(getAffiliateRef()).toBeNull();
    });
  });

  describe('captureRefFromUrl', () => {
    it('reads ref from search and sets cookie', () => {
      const location = { search: '?ref=FROMURL', href: 'http://localhost/' };
      vi.stubGlobal('window', { location, search: location.search });
      captureRefFromUrl();
      expect(document.cookie).toContain(encodeURIComponent('FROMURL'));
      vi.unstubAllGlobals();
    });

    it('does nothing when no ref in URL', () => {
      vi.stubGlobal('window', { location: { search: '?foo=1' }, search: '?foo=1' });
      captureRefFromUrl();
      expect(document.cookie).toBe('');
      vi.unstubAllGlobals();
    });
  });
});
