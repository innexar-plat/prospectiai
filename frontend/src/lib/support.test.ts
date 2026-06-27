import { describe, it, expect, afterEach, vi } from 'vitest';
import { getSupportEmail, getSupportWhatsAppUrl } from './support';

describe('support', () => {
  const originalHostname = window.location.hostname;

  afterEach(() => {
    vi.stubGlobal('location', { ...window.location, hostname: originalHostname, protocol: 'https:' });
  });

  it('uses US support email on US host (ignores BR env default)', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    expect(getSupportEmail()).toBe('support@precisionai.innexar.app');
  });

  it('uses BR support email on BR host', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
    expect(getSupportEmail()).toContain('@');
    expect(getSupportEmail()).toMatch(/precisionia\.com\.br$/);
  });

  it('returns WhatsApp URL only for BR market', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionia.com.br', protocol: 'https:' });
    expect(getSupportWhatsAppUrl()).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });

  it('returns null WhatsApp URL for US market', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'precisionai.innexar.app', protocol: 'https:' });
    expect(getSupportWhatsAppUrl()).toBeNull();
  });
});
