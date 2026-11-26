/** Minimal HS256 JWT (sign/verify) — no third-party dependency. */
import { createHmac, timingSafeEqual } from 'node:crypto';

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, ttlSeconds = 60 * 60 * 12): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
