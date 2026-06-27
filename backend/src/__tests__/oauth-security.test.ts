import {
  isLikelyFirstOauthSignIn,
  isOauthSignIn,
  isProviderEmailVerified,
  shouldSendOauthWelcomeEmail,
} from '@/lib/oauth-security';

describe('oauth-security', () => {
  describe('isOauthSignIn', () => {
    it('returns false for credentials', () => {
      expect(isOauthSignIn('credentials')).toBe(false);
    });

    it('returns true for oauth providers', () => {
      expect(isOauthSignIn('google')).toBe(true);
      expect(isOauthSignIn('github')).toBe(true);
    });
  });

  describe('isProviderEmailVerified', () => {
    it('returns true for email_verified claim', () => {
      expect(isProviderEmailVerified({ email_verified: true })).toBe(true);
    });

    it('returns true for verified_email claim', () => {
      expect(isProviderEmailVerified({ verified_email: true })).toBe(true);
    });

    it('returns false when no supported claim exists', () => {
      expect(isProviderEmailVerified({})).toBe(false);
      expect(isProviderEmailVerified(undefined)).toBe(false);
    });
  });

  describe('isLikelyFirstOauthSignIn', () => {
    it('returns true for account created in the last 10 minutes', () => {
      const now = Date.UTC(2026, 3, 21, 15, 0, 0);
      const createdAt = new Date(now - 5 * 60 * 1000);
      expect(isLikelyFirstOauthSignIn(createdAt, now)).toBe(true);
    });

    it('returns false for old accounts', () => {
      const now = Date.UTC(2026, 3, 21, 15, 0, 0);
      const createdAt = new Date(now - 60 * 60 * 1000);
      expect(isLikelyFirstOauthSignIn(createdAt, now)).toBe(false);
    });
  });

  describe('shouldSendOauthWelcomeEmail', () => {
    it('returns true for enabled flags', () => {
      expect(shouldSendOauthWelcomeEmail('true')).toBe(true);
      expect(shouldSendOauthWelcomeEmail('1')).toBe(true);
      expect(shouldSendOauthWelcomeEmail('yes')).toBe(true);
    });

    it('returns false by default', () => {
      expect(shouldSendOauthWelcomeEmail(undefined)).toBe(false);
      expect(shouldSendOauthWelcomeEmail('false')).toBe(false);
      expect(shouldSendOauthWelcomeEmail('0')).toBe(false);
    });
  });
});
