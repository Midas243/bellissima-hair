import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { SECRET } from './config.js';

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [algo, salt, hash] = String(stored).split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

const hmac = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function signToken(uid, days = 30) {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + days * 864e5 })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}
