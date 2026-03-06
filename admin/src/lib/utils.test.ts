import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters falsy', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b');
  });
});
