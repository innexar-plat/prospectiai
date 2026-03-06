import { describe, it, expect } from 'vitest';
import { formatDate } from './date-utils';

describe('formatDate', () => {
  it('returns "—" for empty string', () => {
    expect(formatDate('')).toBe('—');
  });

  it('formats valid ISO date in pt-BR', () => {
    const out = formatDate('2025-03-06T12:00:00.000Z');
    expect(out).toMatch(/\d/);
    expect(out).not.toBe('—');
  });

  it('returns "—" for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
});
