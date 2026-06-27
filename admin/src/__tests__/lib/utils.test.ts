import { describe, it, expect } from 'vitest';
import { cn, adminPath } from '@/lib/utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters falsy', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b');
  });
});

describe('adminPath', () => {
  it('joins route segments without leading slash', () => {
    expect(adminPath('users', 'abc')).toBe('users/abc');
  });

  it('filters empty segments', () => {
    expect(adminPath('email-templates', '', 'new')).toBe('email-templates/new');
  });
});
