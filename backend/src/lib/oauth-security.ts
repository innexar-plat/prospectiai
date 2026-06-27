type OAuthProfile = Record<string, unknown> | null | undefined;

export function isOauthSignIn(providerType: string | null | undefined): boolean {
  return providerType != null && providerType !== 'credentials';
}

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }

  return null;
}

/**
 * Normaliza sinais de e-mail verificado vindos de diferentes provedores OAuth.
 */
export function isProviderEmailVerified(profile: OAuthProfile): boolean {
  if (!profile) return false;

  const candidates = [
    profile.email_verified,
    profile.verified_email,
    profile.verified,
  ];

  for (const value of candidates) {
    const parsed = parseBooleanLike(value);
    if (parsed != null) return parsed;
  }

  return false;
}

/**
 * Considera primeiro acesso OAuth apenas perto da criação da conta para evitar envios repetidos.
 */
export function isLikelyFirstOauthSignIn(createdAt: Date | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const ageMs = now - createdAt.getTime();
  return ageMs >= 0 && ageMs <= 10 * 60 * 1000;
}

export function shouldSendOauthWelcomeEmail(flag: string | undefined): boolean {
  if (!flag) return false;
  const normalized = flag.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}
