/**
 * Encrypt/decrypt email config secrets (Resend API key, SMTP password).
 * Uses AES-256-GCM; key derived from AI_CONFIG_ENCRYPTION_KEY or AUTH_SECRET.
 * Never log or return raw values.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALG = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT = 'email-config-salt';

function getEncryptionKey(): Buffer {
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'AI_CONFIG_ENCRYPTION_KEY or AUTH_SECRET (min 16 chars) required for email config encryption'
    );
  }
  return scryptSync(secret, SALT, KEY_LEN);
}

export function encryptEmailSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('hex');
}

export function decryptEmailSecret(encryptedHex: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(encryptedHex, 'hex');
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('Invalid encrypted value');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
