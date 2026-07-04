import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALG = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT_LEN = 16;

function getEncryptionKey(salt: Buffer): Buffer {
    const secret = process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.AUTH_SECRET;
    if (!secret || secret.length < 16) {
        throw new Error(
            'AI_CONFIG_ENCRYPTION_KEY or AUTH_SECRET (min 16 chars) required for email config encryption'
        );
    }
    return scryptSync(secret, salt, KEY_LEN);
}

export function encryptEmailSecret(plaintext: string): string {
    const salt = randomBytes(SALT_LEN);
    const key = getEncryptionKey(salt);
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALG, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, enc]).toString('hex');
}

export function decryptEmailSecret(encryptedHex: string): string {
    const buf = Buffer.from(encryptedHex, 'hex');
    if (buf.length < SALT_LEN + IV_LEN + TAG_LEN) throw new Error('Invalid encrypted value');
    const salt = buf.subarray(0, SALT_LEN);
    const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const ciphertext = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN);
    const key = getEncryptionKey(salt);
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
