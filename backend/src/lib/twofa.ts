import { generateSecret, generateURI, verifySync } from 'otplib';

const ISSUER = process.env.TWOFA_ISSUER ?? 'Precision IA';

export function generateTotpSecret(email: string): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: ISSUER, label: email, secret });
  return { secret, otpauthUrl };
}

export function verifyTotpToken(secret: string, token: string): boolean {
  return verifySync({ token, secret }).valid;
}
