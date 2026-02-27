/**
 * TOTP 2FA helpers using speakeasy. Secrets are base32.
 */
import speakeasy from 'speakeasy';

const ISSUER = process.env.TWOFA_ISSUER ?? 'Prospector';

export function generateTotpSecret(email: string): { secret: string; otpauthUrl: string } {
  const secret = speakeasy.generateSecret({
    name: `${ISSUER}:${email}`,
    length: 20,
  });
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url ?? `otpauth://totp/${ISSUER}:${email}?secret=${secret.base32}`,
  };
}

export function verifyTotpToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}
