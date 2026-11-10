import { describe, it, expect, vi, beforeEach } from 'vitest';

const saveAttribution = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/lib/api', () => ({ radarApi: { saveAttribution: (...a: unknown[]) => saveAttribution(...a) } }));

import { captureFirstTouch, flushFirstTouch, readFirstTouch } from './first-touch';

const loc = (search: string, pathname = '/') => ({ search, pathname, hostname: 'precisionia.com.br' });

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe('first touch', () => {
  it('keeps only the very first visit and ignores internal referrers', () => {
    captureFirstTouch(loc('?utm_source=coldmail&utm_medium=sample&utm_campaign=amostra', '/amostra'), 'https://precisionia.com.br/');
    captureFirstTouch(loc('?utm_source=other', '/precos'), 'https://www.google.com/');
    expect(readFirstTouch()).toMatchObject({ source: 'coldmail', medium: 'sample', campaign: 'amostra', referrer: null, landing: '/amostra' });
  });

  it('records search engines and ad clicks', () => {
    captureFirstTouch(loc('?gclid=abc', '/empresas/x'), 'https://www.google.com/');
    expect(readFirstTouch()).toMatchObject({ source: 'google-ads', referrer: 'https://www.google.com/', landing: '/empresas/x' });
  });

  it('sends it once per user', async () => {
    captureFirstTouch(loc(''), '');
    flushFirstTouch('u1');
    await vi.waitFor(() => expect(localStorage.getItem('precision:first-touch-sent:u1')).toBe('1'));
    flushFirstTouch('u1');
    expect(saveAttribution).toHaveBeenCalledTimes(1);
  });
});
