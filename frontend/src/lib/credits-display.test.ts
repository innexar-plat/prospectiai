import { describe, it, expect } from 'vitest';
import { formatCreditCount, formatCreditUsage, getRemainingCredits } from './credits-display';

describe('credits-display', () => {
  it('getRemainingCredits clamps negative and non-finite values', () => {
    expect(getRemainingCredits({ leadsUsed: 8, leadsLimit: 100 })).toBe(92);
    expect(getRemainingCredits({ leadsUsed: 150, leadsLimit: 100 })).toBe(0);
    expect(getRemainingCredits({ leadsUsed: null, leadsLimit: 50 })).toBe(50);
    expect(getRemainingCredits({ leadsUsed: 10, leadsLimit: undefined })).toBe(0);
  });

  it('formatCreditCount locale-formats large numbers', () => {
    expect(formatCreditCount(9998492, 'en-US')).toBe('9,998,492');
    expect(formatCreditCount(92, 'en-US')).toBe('92');
  });

  it('formatCreditUsage returns consistent remaining and labels', () => {
    const usage = formatCreditUsage({ leadsUsed: 8, leadsLimit: 100 }, 'en-US');
    expect(usage.remaining).toBe(92);
    expect(usage.remainingLabel).toBe('92');
    expect(usage.usedLabel).toBe('8');
    expect(usage.limitLabel).toBe('100');
  });
});
