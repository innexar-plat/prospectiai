const { generateTotpSecret, verifyTotpToken } = require('@/lib/twofa');
const { generateSync } = require('otplib');

describe('twofa lib', () => {
  it('generateTotpSecret returns secret and otpauthUrl', () => {
    const { secret, otpauthUrl } = generateTotpSecret('u@x.com');
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThan(10);
    expect(otpauthUrl).toContain('otpauth://totp/');
  });

  it('verifyTotpToken returns false for wrong code', () => {
    const { secret } = generateTotpSecret('u@x.com');
    expect(verifyTotpToken(secret, '000000')).toBe(false);
  });

  it('verifyTotpToken returns true for current code', () => {
    const { secret } = generateTotpSecret('u@x.com');
    const token = generateSync({ secret });
    expect(verifyTotpToken(secret, token)).toBe(true);
  });
});
