/**
 * Encrypt/decrypt API keys for AiProviderConfig.
 * Uses AES-256-GCM; key derived from AI_CONFIG_ENCRYPTION_KEY or AUTH_SECRET.
 * Never log or return raw keys.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALG = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 16;
const TAG_LEN = 16;

function getEncryptionKey(): Buffer {
    const secret = process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.AUTH_SECRET;
    if (!secret || secret.length < 16) {
        throw new Error('AI_CONFIG_ENCRYPTION_KEY or AUTH_SECRET (min 16 chars) required for AI config encryption');
    }
    return scryptSync(secret, 'ai-config-salt', KEY_LEN);
}

/**
 * Encrypts a plaintext API key. Returns a hex string: iv:salt:tag:ciphertext (we use fixed salt for key derivation; iv is per-value).
 * For simplicity we store iv+tag+ciphertext as one hex blob (iv 16, tag 16, ciphertext variable).
 */
export function encryptApiKey(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALG, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('hex');
}

/**
 * Decrypts an encrypted API key.
 */
export function decryptApiKey(encryptedHex: string): string {
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
