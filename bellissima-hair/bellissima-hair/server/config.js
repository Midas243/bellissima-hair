import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Mini-chargeur de .env (aucune dépendance)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

export const PORT = Number(process.env.PORT) || 3000;
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(ROOT, process.env.DATA_DIR) : path.join(ROOT, 'data');
export const PAYMENT_MODE = process.env.PAYMENT_MODE || 'simulation';
export const DELIVERY_FEE = Number(process.env.DELIVERY_FEE ?? 3);
export const TRUST_PROXY = process.env.TRUST_PROXY === '1';
export const SEED_DEMO = (process.env.SEED_DEMO ?? 'true') !== 'false';
export const CURRENCY = 'USD';

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadSecret() {
  if (process.env.SECRET && process.env.SECRET.length >= 16) return process.env.SECRET;
  const f = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
export const SECRET = loadSecret();

export const COMMUNES = [
  'Barumbu', 'Bandalungwa', 'Bumbu', 'Gombe', 'Kalamu', 'Kasa-Vubu', 'Kimbanseke', 'Kinshasa',
  'Kintambo', 'Kisenso', 'Lemba', 'Limete', 'Lingwala', 'Makala', 'Maluku', 'Masina',
  'Matete', 'Mont-Ngafula', "N'djili", 'Ngaba', 'Ngaliema', 'Ngiri-Ngiri', 'Nsele', 'Selembao',
];
export const PRODUCT_CATEGORIES = ['Mèches', 'Perruques', 'Huiles', 'Gels', 'Mousses', 'Shampoings', 'Accessoires', 'Matériel pro'];
export const POST_CATEGORIES = ['Conseils', 'Tendances', 'Formations', 'Opportunités', 'Promotions'];
export const ROLES = ['client', 'tresseuse', 'salon', 'magasin', 'admin'];
