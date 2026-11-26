/** Password hashing (scrypt) + AES-256-GCM encryption for stored provider keys. */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const computed = scryptSync(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  const expected = Buffer.from(hash, 'hex');
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

function aesKey(encryptionKey: string): Buffer {
  return createHash('sha256').update(encryptionKey).digest(); // 32 bytes
}

/** Encrypt a secret for DB storage. Returns iv:tag:ciphertext (base64 parts). */
export function encryptSecret(plain: string, encryptionKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey(encryptionKey), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(payload: string, encryptionKey: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  const decipher = createDecipheriv('aes-256-gcm', aesKey(encryptionKey), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

/** Mask a secret for API responses: show only the last 4 characters. */
export function maskSecret(plain: string): string {
  if (plain.length <= 4) return '****';
  return `****${plain.slice(-4)}`;
}
