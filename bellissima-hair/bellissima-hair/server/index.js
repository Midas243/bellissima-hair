import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT, PORT, TRUST_PROXY } from './config.js';
import { db } from './db.js';
import { verifyToken } from './auth.js';
import { seed } from './seed.js';
import { routes } from './routes.js';
import { HttpError } from './util.js';

const PUBLIC_DIR = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com", "img-src 'self' data: https:", "connect-src 'self'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join('; '),
};

/* Limitation simple du débit (en mémoire) */
const hits = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) { hits.set(key, { count: 1, reset: now + windowMs }); return false; }
  return ++entry.count > max;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (v.reset < n) hits.delete(k); }, 60_000).unref();

function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new HttpError(413, 'Requête trop volumineuse.');
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new HttpError(400, 'Le corps de la requête n’est pas du JSON valide.');
  }
}

async function handleApi(req, res, url) {
  try {
    const ip = clientIp(req);
    if (rateLimited(`api:${ip}`, 300, 60_000)) throw new HttpError(429, 'Trop de requêtes. Réessayez dans une minute.');
    if (url.pathname.startsWith('/api/auth/') && rateLimited(`auth:${ip}`, 20, 15 * 60_000)) {
      throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
    }
    if (url.pathname === '/api/contact' && rateLimited(`contact:${ip}`, 5, 60 * 60_000)) {
      throw new HttpError(429, 'Vous avez déjà envoyé plusieurs messages. Réessayez plus tard.');
    }

    const r = routes.find((x) => x.method === req.method && x.regex.test(url.pathname));
    if (!r) {
      const pathExists = routes.some((x) => x.regex.test(url.pathname));
      throw new HttpError(pathExists ? 405 : 404, pathExists ? 'Méthode non autorisée.' : 'Ressource introuvable.');
    }

    let user = null;
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      const data = verifyToken(token);
      if (data) user = db.prepare('SELECT * FROM users WHERE id = ?').get(data.uid) || null;
    }
    if (r.opts.auth) {
      if (!user) throw new HttpError(401, 'Connectez-vous pour continuer.');
      if (r.opts.roles?.length && !r.opts.roles.includes(user.role)) throw new HttpError(403, 'Accès refusé pour votre type de compte.');
    }

    const m = url.pathname.match(r.regex);
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    const result = await r.handler({ req, user, params, body, query: Object.fromEntries(url.searchParams) });
    send(res, 200, result ?? { ok: true });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error('[erreur]', req.method, req.url, err);
    send(res, 500, { error: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}

function serveStatic(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  let file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // Fichier inexistant avec extension → 404 ; sinon page d'accueil (application monopage)
    if (path.extname(rel)) { res.writeHead(404, SECURITY_HEADERS); return res.end('Introuvable'); }
    file = path.join(PUBLIC_DIR, 'index.html');
  }
  const ext = path.extname(file);
  const type = MIME[ext] || 'application/octet-stream';
  const cache = ext === '.html' ? 'no-cache' : 'public, max-age=3600';
  const headers = { 'Content-Type': type, 'Cache-Control': cache, ...SECURITY_HEADERS };
  let raw;
  try { raw = fs.readFileSync(file); } catch { res.writeHead(404, SECURITY_HEADERS); return res.end('Introuvable'); }
  if (/gzip/.test(req.headers['accept-encoding'] || '') && ['.html', '.css', '.js', '.svg', '.json'].includes(ext)) {
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
    res.writeHead(200, headers);
    return res.end(req.method === 'HEAD' ? undefined : zlib.gzipSync(raw));
  }
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : raw);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') return send(res, 200, { status: 'ok' });
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  serveStatic(req, res, url);
});

await seed();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Bellissima Hair est en ligne sur http://localhost:${PORT}\n`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); });
}
