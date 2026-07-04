import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins non-empty strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters out falsy values', () => {
    expect(cn('a', undefined, 'b', null, false, 'c')).toBe('a b c');
  });

  it('returns empty string when all falsy', () => {
    expect(cn(undefined, null, false)).toBe('');
  });

  it('merges conflicting tailwind classes (last wins)', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });

  it('accepts objects and arrays (clsx)', () => {
    expect(cn('a', { b: true, c: false }, ['d', 'e'])).toBe('a b d e');
  });
});
