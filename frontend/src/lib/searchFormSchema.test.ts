import { describe, it, expect, vi } from 'vitest';
import { searchFormSchema, DEFAULT_SEARCH_VALUES, createDefaultSearchValues } from './searchFormSchema';

describe('searchFormSchema', () => {
  it('parses valid object with defaults', () => {
    const result = searchFormSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBe('BR');
      expect(result.data.state).toBe('Todos');
      expect(result.data.radiusKm).toBe(20);
      expect(result.data.niches).toEqual([]);
    }
  });

  it('accepts optional includedType and advancedTerm', () => {
    const result = searchFormSchema.safeParse({
      country: 'BR',
      includedType: 'restaurant',
      advancedTerm: 'cafes',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includedType).toBe('restaurant');
      expect(result.data.advancedTerm).toBe('cafes');
    }
  });

  it('fails when advancedTerm has 1-2 chars', () => {
    const result = searchFormSchema.safeParse({
      country: 'BR',
      advancedTerm: 'ab',
    });
    expect(result.success).toBe(false);
  });

  it('succeeds when advancedTerm has 3+ chars', () => {
    const result = searchFormSchema.safeParse({
      country: 'BR',
      advancedTerm: 'abc',
    });
    expect(result.success).toBe(true);
  });

  it('DEFAULT_SEARCH_VALUES matches schema defaults', () => {
    expect(DEFAULT_SEARCH_VALUES.country).toBe('BR');
    expect(DEFAULT_SEARCH_VALUES.state).toBe('Todos');
    expect(DEFAULT_SEARCH_VALUES.radiusKm).toBe(20);
    expect(DEFAULT_SEARCH_VALUES.niches).toEqual([]);
  });

  it('createDefaultSearchValues uses US country on US hostname', () => {
    const originalHostname = window.location.hostname;
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    expect(createDefaultSearchValues().country).toBe('US');
    vi.stubGlobal('location', { ...window.location, hostname: originalHostname });
  });
});
