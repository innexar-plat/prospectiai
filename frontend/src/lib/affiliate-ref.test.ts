import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setAffiliateRef,
  getAffiliateRef,
  clearAffiliateRef,
  captureRefFromUrl,
  setRepCode,
  getRepCode,
  clearRepCode,
  captureRepFromUrl,
} from './affiliate-ref';

describe('affiliate-ref', () => {
  let cookieStore: string;

  beforeEach(() => {
    cookieStore = '';
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => cookieStore,
      set: (v: string) => {
        const [part] = v.split(';');
        const [name, val] = part!.split('=').map((s) => s.trim());
        if (val === '' || (name && val === undefined)) {
          cookieStore = cookieStore.replace(new RegExp(`${name}=[^;]*;?`), '');
        } else {
          cookieStore = cookieStore ? `${cookieStore}; ${part!}` : part!;
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

  describe('setRepCode', () => {
    it('does nothing when code is empty', () => {
      setRepCode('');
      setRepCode('   ');
      expect(document.cookie).toBe('');
    });

    it('preserves case — the rep code is a lowercase cuid id, not a normalized code (regression: used to uppercase and break lookups)', () => {
      setRepCode('  cmrdf7r9z00pemc014590v2z8  ');
      expect(document.cookie).toContain('rep_code=');
      expect(document.cookie).toContain(encodeURIComponent('cmrdf7r9z00pemc014590v2z8'));
      expect(document.cookie).not.toContain('CMRDF7R9Z00PEMC014590V2Z8');
    });

    it('slices to 50 chars', () => {
      setRepCode('a'.repeat(60));
      expect(document.cookie).toContain(encodeURIComponent('a'.repeat(50)));
    });
  });

  describe('getRepCode', () => {
    it('returns null when no cookie', () => {
      expect(getRepCode()).toBeNull();
    });

    it('returns decoded value exactly as stored, case preserved', () => {
      cookieStore = `rep_code=${encodeURIComponent('cmrDf7r9z00')}; path=/`;
      expect(getRepCode()).toBe('cmrDf7r9z00');
    });

    it('returns null for empty value', () => {
      cookieStore = 'rep_code=; path=/';
      expect(getRepCode()).toBeNull();
    });
  });

  describe('clearRepCode', () => {
    it('clears cookie so getRepCode returns null', () => {
      cookieStore = 'rep_code=cmrold123';
      expect(getRepCode()).toBe('cmrold123');
      clearRepCode();
      expect(getRepCode()).toBeNull();
    });
  });

  describe('captureRepFromUrl', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });

    it('reads rep from search and sets cookie, preserving case', () => {
      const location = { search: '?rep=cmrFromUrl123', href: 'http://localhost/' };
      vi.stubGlobal('window', { location, search: location.search });
      captureRepFromUrl();
      expect(document.cookie).toContain(encodeURIComponent('cmrFromUrl123'));
      vi.unstubAllGlobals();
    });

    it('fires a best-effort click-tracking request with the rep code', () => {
      const mockFetch = vi.mocked(fetch);
      const location = { search: '?rep=cmrFromUrl123', href: 'http://localhost/' };
      vi.stubGlobal('window', { location, search: location.search });
      vi.stubGlobal('fetch', mockFetch);
      captureRepFromUrl();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/representative/track-click',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'cmrFromUrl123' }) }),
      );
      vi.unstubAllGlobals();
    });

    it('does not throw when the click-tracking request fails', () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
      const location = { search: '?rep=cmrFromUrl123', href: 'http://localhost/' };
      vi.stubGlobal('window', { location, search: location.search });
      expect(() => captureRepFromUrl()).not.toThrow();
      vi.unstubAllGlobals();
    });

    it('does nothing when no rep in URL', () => {
      vi.stubGlobal('window', { location: { search: '?foo=1' }, search: '?foo=1' });
      captureRepFromUrl();
      expect(document.cookie).toBe('');
      expect(fetch).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });
});
