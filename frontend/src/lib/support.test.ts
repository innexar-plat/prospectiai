import { describe, it, expect } from 'vitest';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from './support';

describe('support', () => {
  it('exports SUPPORT_EMAIL as string', () => {
    expect(typeof SUPPORT_EMAIL).toBe('string');
    expect(SUPPORT_EMAIL.length).toBeGreaterThan(0);
    expect(SUPPORT_EMAIL).toContain('@');
  });

  it('exports SUPPORT_WHATSAPP_URL as wa.me link', () => {
    expect(SUPPORT_WHATSAPP_URL).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });
});
