import { describe, it, expect } from 'vitest';
import { LEGAL_MESSAGES } from '@/lib/i18n/legal-messages';
import { CHECKOUT_MESSAGES } from '@/lib/i18n/checkout-messages';
import { SUPPORT_MESSAGES } from '@/lib/i18n/support-messages';
import { buildLocaleMessages } from '@/lib/i18n/merge';

const LOCALES = ['pt', 'en', 'es'] as const;

function collectKeys(record: Record<string, Record<string, string>>): string[] {
  const keys = new Set<string>();
  for (const locale of LOCALES) {
    Object.keys(record[locale] ?? {}).forEach((k) => keys.add(k));
  }
  return [...keys].sort();
}

function assertLocaleParity(
  moduleName: string,
  record: Record<string, Record<string, string>>,
): void {
  const allKeys = collectKeys(record);
  for (const locale of LOCALES) {
    const missing = allKeys.filter((key) => !(key in (record[locale] ?? {})));
    expect(missing, `${moduleName}: ${locale} missing keys`).toEqual([]);
  }
}

describe('i18n critical key parity', () => {
  it('LEGAL_MESSAGES has same keys in pt, en, es', () => {
    assertLocaleParity('LEGAL_MESSAGES', LEGAL_MESSAGES);
  });

  it('CHECKOUT_MESSAGES has same keys in pt, en, es', () => {
    assertLocaleParity('CHECKOUT_MESSAGES', CHECKOUT_MESSAGES);
  });

  it('SUPPORT_MESSAGES has same keys in pt, en, es', () => {
    assertLocaleParity('SUPPORT_MESSAGES', SUPPORT_MESSAGES);
  });

  it('merged en bundle includes legal and checkout keys', () => {
    const en = buildLocaleMessages('en');
    expect(en['legal.terms.title']).toBe('Terms of Use');
    expect(en['legal.privacy.title']).toBe('Privacy Policy');
    expect(en['page.checkout.subtitleUs']).toContain('Stripe');
  });
});

describe('US-facing EN legal copy', () => {
  const en = LEGAL_MESSAGES.en!;

  it('terms governing law references US jurisdiction, not Brazil', () => {
    expect(en['legal.terms.s9.body']).toMatch(/Delaware|United States/i);
    expect(en['legal.terms.s9.body']).not.toMatch(/Brazil|Brasil/i);
  });

  it('privacy EN mentions Stripe only, not Mercado Pago', () => {
    expect(en['legal.privacy.s2.body']).toMatch(/Stripe/i);
    expect(en['legal.privacy.s2.body']).not.toMatch(/Mercado Pago/i);
  });

  it('privacy EN does not reference LGPD', () => {
    const privacyText = Object.entries(en)
      .filter(([key]) => key.startsWith('legal.privacy.'))
      .map(([, value]) => value)
      .join(' ');
    expect(privacyText).not.toMatch(/LGPD/i);
  });

  it('privacy EN does not use Precision IA branding', () => {
    const legalText = Object.values(en).join(' ');
    expect(legalText).not.toMatch(/Precision IA/i);
  });
});
