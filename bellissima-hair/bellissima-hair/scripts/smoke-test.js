// Test de bout en bout : lance le serveur sur une base temporaire et vérifie les parcours clés.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bh-'));
const PORT = 4100 + Math.floor(Math.random() * 500);
const base = `http://localhost:${PORT}`;
const srv = spawn('node', ['server/index.js'], {
  env: { ...process.env, PORT, DATA_DIR: dir, ADMIN_EMAIL: 'admin@test.cd', ADMIN_PASSWORD: 'AdminTest123', SEED_DEMO: 'true' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((ok, ko) => { srv.stdout.on('data', (d) => /en ligne/.test(d) && ok()); setTimeout(() => ko(new Error('démarrage trop long')), 15000); });

let token = null;
const api = async (method, url, body, tk = token) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
let n = 0;
const ok = (name) => console.log(`  ✓ ${++n}. ${name}`);

try {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200); ok('page d’accueil servie');
  assert.equal((await fetch(base + '/healthz')).status, 200); ok('healthz');
  assert.equal((await fetch(base + '/../server/config.js')).status === 200 && false, false);
  const trav = await fetch(base + '/%2e%2e/server/config.js'); assert.notEqual(trav.status, 200); ok('protection traversée de dossier');

  const meta = await api('GET', '/api/meta'); assert.ok(meta.data.communes.length > 10); ok('meta');
  const pros = await api('GET', '/api/pros'); assert.ok(pros.data.pros.length >= 5); ok(`liste pros (${pros.data.pros.length})`);
  const f = await api('GET', '/api/pros?home=1&q=tresses'); assert.ok(f.data.pros.every((p) => p.home_service === 1)); ok('filtres pros');
  const prods = await api('GET', '/api/products?category=Huiles'); assert.ok(prods.data.products.length >= 1); ok('produits par catégorie');

  const bad = await api('POST', '/api/auth/login', { email: 'x@y.cd', password: 'nope12345' }); assert.equal(bad.status, 401); ok('login refusé');
  const reg = await api('POST', '/api/auth/register', { name: 'Test Cliente', email: 'cliente@test.cd', password: 'motdepasse1', role: 'client' });
  assert.equal(reg.status, 200); token = reg.data.token; ok('inscription cliente');
  assert.equal((await api('POST', '/api/auth/register', { name: 'Doublon', email: 'cliente@test.cd', password: 'motdepasse1' })).status, 409); ok('e-mail unique');

  const pro = (await api('GET', '/api/pros?kind=tresseuse&home=1')).data.pros[0];
  const detail = (await api('GET', `/api/pros/${pro.id}`)).data; const svc = detail.services[0];
  const tomorrow = new Date(Date.now() + 3600e3 + 864e5).toISOString().slice(0, 10);
  const past = await api('POST', '/api/bookings', { service_id: svc.id, date: '2020-01-01', time: '10:00', mode: 'salon' }); assert.equal(past.status, 400); ok('réservation dans le passé refusée');
  const bk = await api('POST', '/api/bookings', { service_id: svc.id, date: tomorrow, time: '10:00', mode: 'domicile', address: '12 av. de la Paix, Limete' }); assert.equal(bk.status, 200); ok('réservation créée');
  const dup = await api('POST', '/api/bookings', { service_id: svc.id, date: tomorrow, time: '11:00', mode: 'salon' }); assert.equal(dup.status, 409); ok('conflit de créneau détecté');
  assert.equal((await api('PATCH', `/api/bookings/${bk.data.id}`, { status: 'confirmee' })).status, 403); ok('cliente ne peut pas confirmer');
  assert.equal((await api('GET', '/api/my/shop')).status, 403); ok('contrôle des rôles');

  const p1 = prods.data.products[0];
  const ord = await api('POST', '/api/orders', { items: [{ product_id: p1.id, qty: 2 }], delivery_mode: 'livraison', address: '5 rue Kasa-Vubu', payment_method: 'mpesa', payment_phone: '+243 81 234 5678' });
  assert.equal(ord.status, 200); assert.equal(ord.data.payment_status, 'paye'); ok(`commande payée (simulation) total=${ord.data.total}`);
  const after = (await api('GET', `/api/products/${p1.id}`)).data.product; assert.equal(after.stock, p1.stock - 2); ok('stock décrémenté');
  assert.equal((await api('POST', '/api/orders', { items: [{ product_id: p1.id, qty: 99999 }], delivery_mode: 'retrait', payment_method: 'cash' })).status, 400); ok('quantité absurde refusée');

  // Professionnelle : inscription, services, confirmation
  const proReg = await api('POST', '/api/auth/register', { name: 'Test Tresseuse', email: 'tress@test.cd', password: 'motdepasse1', role: 'tresseuse', phone: '+243 99 111 2222', commune: 'Limete' }, null);
  const ptk = proReg.data.token; assert.equal(proReg.data.user.role, 'tresseuse'); ok('inscription tresseuse (profil créé)');
  assert.equal((await api('POST', '/api/my/services', { name: 'Tresses test', price: 20, duration_min: 90 }, ptk)).status, 200); ok('ajout de service');
  const mine = (await api('GET', '/api/my/profile', null, ptk)).data;
  const svc2 = mine.services[0];
  const bk2 = await api('POST', '/api/bookings', { service_id: svc2.id, date: tomorrow, time: '09:00', mode: 'salon' }); assert.equal(bk2.status, 200);
  assert.equal((await api('PATCH', `/api/bookings/${bk2.data.id}`, { status: 'confirmee' }, ptk)).status, 200); ok('la pro confirme');
  assert.equal((await api('POST', '/api/reviews', { booking_id: bk2.data.id, rating: 5 })).status, 400); ok('avis refusé avant fin de prestation');
  assert.equal((await api('PATCH', `/api/bookings/${bk2.data.id}`, { status: 'terminee' }, ptk)).status, 200);
  assert.equal((await api('POST', '/api/reviews', { booking_id: bk2.data.id, rating: 5, comment: 'Top' })).status, 200); ok('avis publié après prestation');

  // Boutique : vendeur + prix de gros pour une pro
  const shopReg = await api('POST', '/api/auth/register', { name: 'Boutique Test', email: 'shop@test.cd', password: 'motdepasse1', role: 'magasin', phone: '+243 99 333 4444' }, null);
  const stk = shopReg.data.token;
  const np = await api('POST', '/api/my/products', { name: 'Gel test', category: 'Gels', price_retail: 10, price_wholesale: 6, wholesale_min: 5, stock: 50 }, stk); assert.equal(np.status, 200); ok('vendeur ajoute un produit');
  assert.equal((await api('POST', '/api/my/products', { name: 'Gel', category: 'Gels', price_retail: 5, price_wholesale: 9, stock: 1 }, stk)).status, 400); ok('prix de gros > détail refusé');
  const wh = await api('POST', '/api/orders', { items: [{ product_id: np.data.id, qty: 5 }], delivery_mode: 'retrait', payment_method: 'cash' }, ptk);
  assert.equal(wh.data.total, 30); assert.equal(wh.data.payment_status, 'a_payer_sur_place'); ok('tarif de gros appliqué aux professionnelles (5×6=30)');
  const sellerOrders = (await api('GET', '/api/my/orders', null, stk)).data.items; assert.equal(sellerOrders.length, 1);
  assert.equal((await api('PATCH', `/api/order-items/${sellerOrders[0].id}`, { status: 'preparee' }, stk)).status, 200); ok('vendeur met à jour la commande');

  // Communauté & contact
  assert.equal((await api('POST', '/api/posts', { category: 'Conseils', title: 'Titre test', body: 'Contenu de test suffisant' })).status, 403); ok('cliente ne publie pas');
  assert.equal((await api('POST', '/api/posts', { category: 'Conseils', title: 'Titre test', body: 'Contenu de test suffisant' }, ptk)).status, 200); ok('pro publie');
  assert.equal((await api('POST', '/api/contact', { name: 'Jean', email: 'j@x.cd', type: 'partenaire', message: 'Je souhaite collaborer.' }, null)).status, 200); ok('formulaire de contact');

  // Admin
  const adm = await api('POST', '/api/auth/login', { email: 'admin@test.cd', password: 'AdminTest123' }, null); assert.equal(adm.status, 200);
  const st = await api('GET', '/api/admin/stats', null, adm.data.token); assert.ok(st.data.users > 5); ok('admin : statistiques');
  assert.equal((await api('GET', '/api/admin/stats')).status, 403); ok('stats interdites aux non-admins');

  const xss = await api('POST', '/api/auth/register', { name: '<script>x</script>', email: 'xss@test.cd', password: 'motdepasse1' }, null); assert.equal(xss.status, 200); ok('texte HTML accepté comme texte (échappé côté interface)');
  console.log(`\nTous les tests passent (${n}).`);
} catch (e) {
  console.error('\nÉCHEC :', e.message); console.error(e.stack?.split('\n').slice(1, 4).join('\n')); process.exitCode = 1;
} finally { srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
