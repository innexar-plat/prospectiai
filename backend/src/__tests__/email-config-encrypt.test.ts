/**
 * Tests for email-config-encrypt: round-trip, no secret leak, invalid input handling.
 */
import { createCipheriv, randomBytes, scryptSync } from 'crypto';
import { encryptEmailSecret, decryptEmailSecret } from '@/lib/email-config-encrypt';

const MIN_SECRET = 'a'.repeat(16);

describe('email-config-encrypt', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.AUTH_SECRET = MIN_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('round-trip: decrypt(encrypt(plain)) equals plain', () => {
    const plain = 're_abc123secret';
    const encrypted = encryptEmailSecret(plain);
    expect(encrypted).toBeTruthy();
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain(plain);
    const decrypted = decryptEmailSecret(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('ciphertext is different each call (IV is random)', () => {
    const plain = 'same-secret';
    const a = encryptEmailSecret(plain);
    const b = encryptEmailSecret(plain);
    expect(a).not.toBe(b);
    expect(decryptEmailSecret(a)).toBe(plain);
    expect(decryptEmailSecret(b)).toBe(plain);
  });

  it('decrypts values saved in the legacy fixed-salt format', () => {
    const key = scryptSync(MIN_SECRET, 'email-config-salt', 32);
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update('re_legacy_key', 'utf8'), cipher.final()]);
    const legacy = Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('hex');
    expect(decryptEmailSecret(legacy)).toBe('re_legacy_key');
  });

  it('throws on decrypt with invalid hex (too short)', () => {
    expect(() => decryptEmailSecret('ab')).toThrow(/Invalid encrypted value/);
  });

  it('throws on decrypt with invalid hex (garbage)', () => {
    const longHex = 'a'.repeat(100);
    expect(() => decryptEmailSecret(longHex)).toThrow();
  });

  it('uses AI_CONFIG_ENCRYPTION_KEY when set', () => {
    process.env.AUTH_SECRET = undefined;
    process.env.AI_CONFIG_ENCRYPTION_KEY = MIN_SECRET;
    const plain = 'key-from-env';
    const encrypted = encryptEmailSecret(plain);
    const decrypted = decryptEmailSecret(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('throws when no secret (min 16 chars) is set', () => {
    delete process.env.AUTH_SECRET;
    delete process.env.AI_CONFIG_ENCRYPTION_KEY;
    expect(() => encryptEmailSecret('x')).toThrow(/required for email config encryption/);
  });

  it('throws when secret is too short', () => {
    process.env.AUTH_SECRET = 'short';
    expect(() => encryptEmailSecret('x')).toThrow(/required for email config encryption/);
  });
});
