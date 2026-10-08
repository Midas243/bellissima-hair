import { db, tx } from './db.js';
import { hashPassword, verifyPassword, signToken } from './auth.js';
import { initiatePayment, PAYMENT_METHODS } from './payments.js';
import {
  COMMUNES, PRODUCT_CATEGORIES, POST_CATEGORIES, PAYMENT_MODE, DELIVERY_FEE, CURRENCY,
} from './config.js';
import {
  HttpError, bad, str, num, oneOf, email, phone, imageUrl, bool, nowKinshasa, toMinutes,
} from './util.js';

export const routes = [];
const PRO_ROLES = ['tresseuse', 'salon', 'magasin'];

function route(method, path, opts, handler) {
  if (typeof opts === 'function') { handler = opts; opts = {}; }
  const keys = [];
  const regex = new RegExp('^' + path.replace(/:([a-z]+)/gi, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, regex, keys, opts, handler });
}
const auth = (...roles) => ({ auth: true, roles });
const id = (p, k = 'id') => {
  const n = Number(p[k]);
  if (!Number.isInteger(n) || n < 1) throw bad('Identifiant invalide.');
  return n;
};
const notFound = (what = 'Élément') => new HttpError(404, `${what} introuvable.`);

/* ───────────── Méta ───────────── */
route('GET', '/api/meta', () => ({
  communes: COMMUNES,
  productCategories: PRODUCT_CATEGORIES,
  postCategories: POST_CATEGORIES,
  paymentMethods: PAYMENT_METHODS,
  paymentMode: PAYMENT_MODE,
  deliveryFee: DELIVERY_FEE,
  currency: CURRENCY,
}));

/* ───────────── Compte ───────────── */
function publicUser(u) {
  if (!u) return null;
  const profile = db.prepare('SELECT id, kind FROM profiles WHERE user_id = ?').get(u.id);
  const shop = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(u.id);
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, commune: u.commune,
    profile_id: profile?.id ?? null, shop_id: shop?.id ?? null,
  };
}

route('POST', '/api/auth/register', async ({ body }) => {
  const name = str(body.name, 'Le nom', { required: true, min: 2, max: 80 });
  const mail = email(body.email);
  const pwd = str(body.password, 'Le mot de passe', { required: true, min: 8, max: 100 });
  const role = oneOf(body.role || 'client', ['client', 'tresseuse', 'salon', 'magasin'], 'Le type de compte');
  const tel = phone(body.phone, { required: role !== 'client' });
  const commune = str(body.commune, 'La commune', { max: 60 });
  const business = str(body.business_name, "Le nom de l'établissement", { max: 100 }) || name;
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail.');

  const hash = await hashPassword(pwd);
  const user = tx(() => {
    const r = db.prepare('INSERT INTO users (name, email, phone, password_hash, role, commune) VALUES (?,?,?,?,?,?)')
      .run(name, mail, tel, hash, role, commune);
    const uid = Number(r.lastInsertRowid);
    if (role === 'tresseuse' || role === 'salon') {
      db.prepare('INSERT INTO profiles (user_id, kind, display_name, commune, phone) VALUES (?,?,?,?,?)')
        .run(uid, role, business, commune, tel);
    }
    if (role === 'magasin') {
      db.prepare('INSERT INTO shops (user_id, name, commune, phone) VALUES (?,?,?,?)').run(uid, business, commune, tel);
    }
    return db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  });
  return { token: signToken(user.id), user: publicUser(user) };
});

route('POST', '/api/auth/login', async ({ body }) => {
  const mail = email(body.email);
  const pwd = str(body.password, 'Le mot de passe', { required: true, max: 100 });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(mail);
  // Même message dans tous les cas pour ne pas révéler quels e-mails existent
  if (!user || !(await verifyPassword(pwd, user.password_hash))) throw new HttpError(401, 'E-mail ou mot de passe incorrect.');
  return { token: signToken(user.id), user: publicUser(user) };
});

route('GET', '/api/me', auth(), ({ user }) => ({ user: publicUser(user) }));

route('PUT', '/api/me', auth(), ({ user, body }) => {
  const name = str(body.name, 'Le nom', { required: true, min: 2, max: 80 });
  const tel = phone(body.phone, { required: user.role !== 'client' && user.role !== 'admin' });
  const commune = str(body.commune, 'La commune', { max: 60 });
  db.prepare('UPDATE users SET name = ?, phone = ?, commune = ? WHERE id = ?').run(name, tel, commune, user.id);
  return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) };
});

route('PUT', '/api/me/password', auth(), async ({ user, body }) => {
  const current = str(body.current, 'Le mot de passe actuel', { required: true, max: 100 });
  const next = str(body.next, 'Le nouveau mot de passe', { required: true, min: 8, max: 100 });
  if (!(await verifyPassword(current, user.password_hash))) throw new HttpError(403, 'Le mot de passe actuel est incorrect.');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), user.id);
  return { ok: true };
});

/* ───────────── Professionnelles (tresseuses & salons) ───────────── */
const PRO_SELECT = `
  SELECT p.id, p.kind, p.display_name, p.bio, p.commune, p.address, p.home_service, p.phone,
         p.image_url, p.specialties, p.verified,
         (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.profile_id = p.id) AS rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.profile_id = p.id) AS review_count,
         (SELECT MIN(price) FROM services s WHERE s.profile_id = p.id) AS min_price
  FROM profiles p`;

route('GET', '/api/pros', ({ query }) => {
  const where = ['p.active = 1'];
  const params = [];
  if (query.kind && ['tresseuse', 'salon'].includes(query.kind)) { where.push('p.kind = ?'); params.push(query.kind); }
  if (query.commune) { where.push('p.commune = ?'); params.push(query.commune); }
  if (query.home === '1') where.push('p.home_service = 1');
  if (query.q) {
    const like = `%${String(query.q).slice(0, 60).replace(/[%_]/g, '')}%`;
    where.push(`(p.display_name LIKE ? OR p.bio LIKE ? OR p.specialties LIKE ?
      OR EXISTS (SELECT 1 FROM services s WHERE s.profile_id = p.id AND s.name LIKE ?))`);
    params.push(like, like, like, like);
  }
  const order = { prix: 'min_price ASC', note: 'rating DESC, review_count DESC' }[query.sort]
    || 'p.verified DESC, rating DESC, review_count DESC, p.id DESC';
  const pros = db.prepare(`${PRO_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 60`).all(...params);
  return { pros };
});

route('GET', '/api/pros/:id', ({ params }) => {
  const pid = id(params);
  const pro = db.prepare(`${PRO_SELECT} WHERE p.id = ? AND p.active = 1`).get(pid);
  if (!pro) throw notFound('Professionnelle');
  const services = db.prepare('SELECT id, name, price, duration_min, description FROM services WHERE profile_id = ? ORDER BY price').all(pid);
  const reviews = db.prepare(`SELECT r.id, r.rating, r.comment, r.created_at, u.name AS author
    FROM reviews r JOIN users u ON u.id = r.client_id WHERE r.profile_id = ? ORDER BY r.id DESC LIMIT 30`).all(pid);
  return { pro, services, reviews };
});

route('GET', '/api/my/profile', auth('tresseuse', 'salon'), ({ user }) => {
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id);
  const services = db.prepare('SELECT * FROM services WHERE profile_id = ? ORDER BY id').all(profile.id);
  return { profile, services };
});

route('PUT', '/api/my/profile', auth('tresseuse', 'salon'), ({ user, body }) => {
  const data = {
    display_name: str(body.display_name, 'Le nom affiché', { required: true, min: 2, max: 100 }),
    bio: str(body.bio, 'La présentation', { max: 1000 }),
    commune: str(body.commune, 'La commune', { max: 60 }),
    address: str(body.address, "L'adresse", { max: 200 }),
    home_service: bool(body.home_service),
    phone: phone(body.phone, { required: true }),
    image_url: imageUrl(body.image_url),
    specialties: str(body.specialties, 'Les spécialités', { max: 200 }),
    active: bool(body.active),
  };
  db.prepare(`UPDATE profiles SET display_name=?, bio=?, commune=?, address=?, home_service=?, phone=?,
    image_url=?, specialties=?, active=? WHERE user_id=?`)
    .run(data.display_name, data.bio, data.commune, data.address, data.home_service, data.phone,
      data.image_url, data.specialties, data.active, user.id);
  return { profile: db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) };
});

function serviceData(body) {
  return {
    name: str(body.name, 'Le nom du service', { required: true, min: 2, max: 100 }),
    price: num(body.price, 'Le prix', { min: 0, max: 100000 }),
    duration: num(body.duration_min, 'La durée', { min: 15, max: 720, int: true }),
    description: str(body.description, 'La description', { max: 400 }),
  };
}
route('POST', '/api/my/services', auth('tresseuse', 'salon'), ({ user, body }) => {
  const p = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(user.id);
  if (db.prepare('SELECT COUNT(*) c FROM services WHERE profile_id = ?').get(p.id).c >= 50) throw bad('Limite de 50 services atteinte.');
  const d = serviceData(body);
  const r = db.prepare('INSERT INTO services (profile_id, name, price, duration_min, description) VALUES (?,?,?,?,?)')
    .run(p.id, d.name, d.price, d.duration, d.description);
  return { id: Number(r.lastInsertRowid) };
});
route('PUT', '/api/my/services/:id', auth('tresseuse', 'salon'), ({ user, params, body }) => {
  const sid = id(params);
  const d = serviceData(body);
  const r = db.prepare(`UPDATE services SET name=?, price=?, duration_min=?, description=?
    WHERE id=? AND profile_id=(SELECT id FROM profiles WHERE user_id=?)`).run(d.name, d.price, d.duration, d.description, sid, user.id);
  if (!r.changes) throw notFound('Service');
  return { ok: true };
});
route('DELETE', '/api/my/services/:id', auth('tresseuse', 'salon'), ({ user, params }) => {
  const r = db.prepare('DELETE FROM services WHERE id=? AND profile_id=(SELECT id FROM profiles WHERE user_id=?)').run(id(params), user.id);
  if (!r.changes) throw notFound('Service');
  return { ok: true };
});

/* ───────────── Réservations ───────────── */
route('POST', '/api/bookings', auth(), ({ user, body }) => {
  const service = db.prepare(`SELECT s.*, p.user_id AS pro_user, p.home_service, p.active
    FROM services s JOIN profiles p ON p.id = s.profile_id WHERE s.id = ?`).get(num(body.service_id, 'Le service', { int: true, min: 1 }));
  if (!service || !service.active) throw notFound('Service');
  if (service.pro_user === user.id) throw bad('Vous ne pouvez pas réserver votre propre service.');

  const date = str(body.date, 'La date', { required: true, max: 10 });
  const time = str(body.time, "L'heure", { required: true, max: 5 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw bad('La date est invalide.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw bad("L'heure est invalide.");
  const start = toMinutes(time);
  if (start < 7 * 60 || start + service.duration_min > 21 * 60) throw bad('Les rendez-vous sont possibles entre 07h00 et 21h00.');
  const now = nowKinshasa();
  if (date < now.date || (date === now.date && start <= now.minutes)) throw bad('Choisissez un créneau à venir.');

  const mode = oneOf(body.mode || 'salon', ['salon', 'domicile'], 'Le lieu');
  let address = '';
  if (mode === 'domicile') {
    if (!service.home_service) throw bad("Cette professionnelle ne se déplace pas à domicile.");
    address = str(body.address, 'Votre adresse', { required: true, min: 5, max: 200 });
  }
  const note = str(body.note, 'Le message', { max: 500 });

  return tx(() => {
    const busy = db.prepare(`SELECT b.time, s.duration_min FROM bookings b JOIN services s ON s.id = b.service_id
      WHERE b.profile_id = ? AND b.date = ? AND b.status IN ('en_attente','confirmee')`).all(service.profile_id, date);
    const end = start + service.duration_min;
    if (busy.some((b) => start < toMinutes(b.time) + b.duration_min && toMinutes(b.time) < end)) {
      throw new HttpError(409, 'Ce créneau n’est plus disponible. Choisissez une autre heure.');
    }
    const r = db.prepare(`INSERT INTO bookings (client_id, profile_id, service_id, date, time, mode, address, note)
      VALUES (?,?,?,?,?,?,?,?)`).run(user.id, service.profile_id, service.id, date, time, mode, address, note);
    return { id: Number(r.lastInsertRowid) };
  });
});

route('GET', '/api/bookings', auth(), ({ user, query }) => {
  if (query.as === 'pro') {
    if (!['tresseuse', 'salon'].includes(user.role)) throw new HttpError(403, 'Accès refusé.');
    return { bookings: db.prepare(`SELECT b.*, s.name AS service_name, s.price, s.duration_min,
        u.name AS client_name, u.phone AS client_phone
      FROM bookings b JOIN services s ON s.id = b.service_id JOIN users u ON u.id = b.client_id
      WHERE b.profile_id = (SELECT id FROM profiles WHERE user_id = ?) ORDER BY b.date DESC, b.time DESC LIMIT 200`).all(user.id) };
  }
  return { bookings: db.prepare(`SELECT b.*, s.name AS service_name, s.price, s.duration_min,
      p.display_name AS pro_name, p.phone AS pro_phone, p.id AS pro_id,
      EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed
    FROM bookings b JOIN services s ON s.id = b.service_id JOIN profiles p ON p.id = b.profile_id
    WHERE b.client_id = ? ORDER BY b.date DESC, b.time DESC LIMIT 200`).all(user.id) };
});

route('PATCH', '/api/bookings/:id', auth(), ({ user, params, body }) => {
  const b = db.prepare('SELECT b.*, p.user_id AS pro_user FROM bookings b JOIN profiles p ON p.id = b.profile_id WHERE b.id = ?').get(id(params));
  if (!b) throw notFound('Réservation');
  const status = oneOf(body.status, ['confirmee', 'refusee', 'annulee', 'terminee'], 'Le statut');
  const isPro = b.pro_user === user.id;
  const isClient = b.client_id === user.id;
  const allowed = {
    en_attente: isPro ? ['confirmee', 'refusee'] : isClient ? ['annulee'] : [],
    confirmee: isPro ? ['terminee', 'annulee'] : isClient ? ['annulee'] : [],
  }[b.status] || [];
  if (!allowed.includes(status)) throw new HttpError(403, 'Cette action n’est pas possible pour cette réservation.');
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, b.id);
  return { ok: true };
});

route('POST', '/api/reviews', auth(), ({ user, body }) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(num(body.booking_id, 'La réservation', { int: true, min: 1 }));
  if (!b || b.client_id !== user.id) throw notFound('Réservation');
  if (b.status !== 'terminee') throw bad('Vous pouvez donner un avis une fois la prestation terminée.');
  if (db.prepare('SELECT 1 FROM reviews WHERE booking_id = ?').get(b.id)) throw new HttpError(409, 'Vous avez déjà donné votre avis.');
  const rating = num(body.rating, 'La note', { min: 1, max: 5, int: true });
  const comment = str(body.comment, 'Le commentaire', { max: 600 });
  db.prepare('INSERT INTO reviews (booking_id, profile_id, client_id, rating, comment) VALUES (?,?,?,?,?)')
    .run(b.id, b.profile_id, user.id, rating, comment);
  return { ok: true };
});

/* ───────────── Boutique ───────────── */
const PRODUCT_SELECT = `
  SELECT pr.id, pr.name, pr.category, pr.description, pr.price_retail, pr.price_wholesale, pr.wholesale_min,
         pr.stock, pr.image_url, pr.shop_id, s.name AS shop_name, s.commune AS shop_commune, s.verified AS shop_verified
  FROM products pr JOIN shops s ON s.id = pr.shop_id`;

route('GET', '/api/products', ({ query }) => {
  const where = ['pr.active = 1'];
  const params = [];
  if (query.category && PRODUCT_CATEGORIES.includes(query.category)) { where.push('pr.category = ?'); params.push(query.category); }
  if (query.shop) { where.push('pr.shop_id = ?'); params.push(Number(query.shop) || 0); }
  if (query.wholesale === '1') where.push('pr.price_wholesale IS NOT NULL');
  if (query.q) {
    const like = `%${String(query.q).slice(0, 60).replace(/[%_]/g, '')}%`;
    where.push('(pr.name LIKE ? OR pr.description LIKE ? OR s.name LIKE ?)');
    params.push(like, like, like);
  }
  const order = { prix: 'pr.price_retail ASC', recent: 'pr.id DESC' }[query.sort] || 'pr.stock > 0 DESC, pr.id DESC';
  return { products: db.prepare(`${PRODUCT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 120`).all(...params) };
});

route('GET', '/api/products/:id', ({ params }) => {
  const p = db.prepare(`${PRODUCT_SELECT} WHERE pr.id = ? AND pr.active = 1`).get(id(params));
  if (!p) throw notFound('Produit');
  return { product: p };
});

// Détails de plusieurs produits (panier)
route('POST', '/api/products/lookup', ({ body }) => {
  const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 50).map(Number).filter(Number.isInteger);
  if (!ids.length) return { products: [] };
  const q = ids.map(() => '?').join(',');
  return { products: db.prepare(`${PRODUCT_SELECT} WHERE pr.active = 1 AND pr.id IN (${q})`).all(...ids) };
});

route('GET', '/api/my/shop', auth('magasin'), ({ user }) => {
  const shop = db.prepare('SELECT * FROM shops WHERE user_id = ?').get(user.id);
  const products = db.prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY id DESC').all(shop.id);
  return { shop, products };
});
route('PUT', '/api/my/shop', auth('magasin'), ({ user, body }) => {
  db.prepare('UPDATE shops SET name=?, description=?, commune=?, address=?, phone=? WHERE user_id=?').run(
    str(body.name, 'Le nom du magasin', { required: true, min: 2, max: 100 }),
    str(body.description, 'La description', { max: 800 }),
    str(body.commune, 'La commune', { max: 60 }),
    str(body.address, "L'adresse", { max: 200 }),
    phone(body.phone, { required: true }),
    user.id,
  );
  return { shop: db.prepare('SELECT * FROM shops WHERE user_id = ?').get(user.id) };
});

function productData(body) {
  const wholesale = num(body.price_wholesale, 'Le prix de gros', { min: 0, max: 1e6, required: false });
  const retail = num(body.price_retail, 'Le prix de détail', { min: 0, max: 1e6 });
  if (wholesale !== null && wholesale > retail) throw bad('Le prix de gros doit être inférieur ou égal au prix de détail.');
  return {
    name: str(body.name, 'Le nom du produit', { required: true, min: 2, max: 120 }),
    category: oneOf(body.category, PRODUCT_CATEGORIES, 'La catégorie'),
    description: str(body.description, 'La description', { max: 800 }),
    retail, wholesale,
    wmin: num(body.wholesale_min ?? 10, 'La quantité minimale de gros', { min: 2, max: 10000, int: true }),
    stock: num(body.stock, 'Le stock', { min: 0, max: 1e6, int: true }),
    image: imageUrl(body.image_url),
    active: body.active === undefined ? 1 : bool(body.active),
  };
}
route('POST', '/api/my/products', auth('magasin'), ({ user, body }) => {
  const shop = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(user.id);
  const d = productData(body);
  const r = db.prepare(`INSERT INTO products (shop_id, name, category, description, price_retail, price_wholesale,
    wholesale_min, stock, image_url, active) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(shop.id, d.name, d.category, d.description, d.retail, d.wholesale, d.wmin, d.stock, d.image, d.active);
  return { id: Number(r.lastInsertRowid) };
});
route('PUT', '/api/my/products/:id', auth('magasin'), ({ user, params, body }) => {
  const d = productData(body);
  const r = db.prepare(`UPDATE products SET name=?, category=?, description=?, price_retail=?, price_wholesale=?,
    wholesale_min=?, stock=?, image_url=?, active=? WHERE id=? AND shop_id=(SELECT id FROM shops WHERE user_id=?)`)
    .run(d.name, d.category, d.description, d.retail, d.wholesale, d.wmin, d.stock, d.image, d.active, id(params), user.id);
  if (!r.changes) throw notFound('Produit');
  return { ok: true };
});
route('DELETE', '/api/my/products/:id', auth('magasin'), ({ user, params }) => {
  const r = db.prepare('DELETE FROM products WHERE id=? AND shop_id=(SELECT id FROM shops WHERE user_id=?)').run(id(params), user.id);
  if (!r.changes) throw notFound('Produit');
  return { ok: true };
});

/* ───────────── Commandes ───────────── */
route('POST', '/api/orders', auth(), async ({ user, body }) => {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw bad('Votre panier est vide.');
  if (items.length > 50) throw bad('Trop d’articles dans le panier.');
  const deliveryMode = oneOf(body.delivery_mode, ['livraison', 'retrait'], 'Le mode de réception');
  const address = deliveryMode === 'livraison' ? str(body.address, "L'adresse de livraison", { required: true, min: 5, max: 200 }) : '';
  const method = oneOf(body.payment_method, PAYMENT_METHODS.map((m) => m.id), 'Le moyen de paiement');
  const isMobile = PAYMENT_METHODS.find((m) => m.id === method).mobile;
  const payPhone = isMobile ? phone(body.payment_phone, { required: true }) : '';
  const isPro = PRO_ROLES.includes(user.role);

  const order = tx(() => {
    let subtotal = 0;
    const lines = [];
    for (const it of items) {
      const pid = num(it.product_id, 'Le produit', { int: true, min: 1 });
      const qty = num(it.qty, 'La quantité', { int: true, min: 1, max: 10000 });
      const p = db.prepare('SELECT pr.*, s.user_id AS owner FROM products pr JOIN shops s ON s.id = pr.shop_id WHERE pr.id = ? AND pr.active = 1').get(pid);
      if (!p) throw bad('Un produit de votre panier n’est plus disponible.');
      if (p.owner === user.id) throw bad('Vous ne pouvez pas acheter vos propres produits.');
      if (p.stock < qty) throw new HttpError(409, `Stock insuffisant pour « ${p.name} » (${p.stock} restant).`);
      const wholesale = isPro && p.price_wholesale !== null && qty >= p.wholesale_min ? 1 : 0;
      const unit = wholesale ? p.price_wholesale : p.price_retail;
      subtotal += unit * qty;
      lines.push({ p, qty, unit, wholesale });
    }
    const fee = deliveryMode === 'livraison' ? DELIVERY_FEE : 0;
    const total = Math.round((subtotal + fee) * 100) / 100;
    const r = db.prepare(`INSERT INTO orders (buyer_id, subtotal, delivery_fee, total, delivery_mode, address, payment_method, payment_phone)
      VALUES (?,?,?,?,?,?,?,?)`).run(user.id, Math.round(subtotal * 100) / 100, fee, total, deliveryMode, address, method, payPhone);
    const oid = Number(r.lastInsertRowid);
    for (const l of lines) {
      db.prepare('INSERT INTO order_items (order_id, product_id, shop_id, name, unit_price, qty, wholesale) VALUES (?,?,?,?,?,?,?)')
        .run(oid, l.p.id, l.p.shop_id, l.p.name, l.unit, l.qty, l.wholesale);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(l.qty, l.p.id);
    }
    return { id: oid, total };
  });

  const pay = await initiatePayment({ method, amount: order.total, phone: payPhone, orderId: order.id });
  db.prepare('UPDATE orders SET payment_status = ?, payment_ref = ? WHERE id = ?').run(pay.status, pay.reference, order.id);
  return { id: order.id, total: order.total, payment_status: pay.status, payment_ref: pay.reference };
});

route('GET', '/api/orders', auth(), ({ user }) => {
  const orders = db.prepare('SELECT * FROM orders WHERE buyer_id = ? ORDER BY id DESC LIMIT 100').all(user.id);
  const itemsStmt = db.prepare(`SELECT oi.*, s.name AS shop_name FROM order_items oi JOIN shops s ON s.id = oi.shop_id WHERE oi.order_id = ?`);
  return { orders: orders.map((o) => ({ ...o, items: itemsStmt.all(o.id) })) };
});

route('GET', '/api/my/orders', auth('magasin'), ({ user }) => ({
  items: db.prepare(`SELECT oi.*, o.created_at, o.delivery_mode, o.address, o.payment_method, o.payment_status,
      u.name AS buyer_name, u.phone AS buyer_phone
    FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN users u ON u.id = o.buyer_id
    WHERE oi.shop_id = (SELECT id FROM shops WHERE user_id = ?) ORDER BY oi.id DESC LIMIT 200`).all(user.id),
}));

route('PATCH', '/api/order-items/:id', auth(), ({ user, params, body }) => {
  const it = db.prepare(`SELECT oi.*, s.user_id AS seller, o.buyer_id FROM order_items oi
    JOIN shops s ON s.id = oi.shop_id JOIN orders o ON o.id = oi.order_id WHERE oi.id = ?`).get(id(params));
  if (!it) throw notFound('Article');
  const status = oneOf(body.status, ['preparee', 'expediee', 'livree', 'annulee'], 'Le statut');
  const isSeller = it.seller === user.id;
  const isBuyer = it.buyer_id === user.id;
  const flow = { en_attente: ['preparee', 'annulee'], preparee: ['expediee', 'annulee'], expediee: ['livree'] };
  const allowed = isSeller ? (flow[it.status] || []) : isBuyer && it.status === 'en_attente' ? ['annulee'] : [];
  if (!allowed.includes(status)) throw new HttpError(403, 'Cette action n’est pas possible pour cet article.');
  tx(() => {
    db.prepare('UPDATE order_items SET status = ? WHERE id = ?').run(status, it.id);
    if (status === 'annulee' && it.product_id) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(it.qty, it.product_id);
  });
  return { ok: true };
});

/* ───────────── Communauté ───────────── */
route('GET', '/api/posts', ({ query }) => {
  const where = [];
  const params = [];
  if (query.category && POST_CATEGORIES.includes(query.category)) { where.push('p.category = ?'); params.push(query.category); }
  const limit = Math.min(Number(query.limit) || 30, 50);
  return { posts: db.prepare(`SELECT p.id, p.category, p.title, p.body, p.created_at, p.author_id, u.name AS author, u.role AS author_role
    FROM posts p JOIN users u ON u.id = p.author_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.id DESC LIMIT ${limit}`).all(...params) };
});
route('POST', '/api/posts', auth('tresseuse', 'salon', 'magasin', 'admin'), ({ user, body }) => {
  const r = db.prepare('INSERT INTO posts (author_id, category, title, body) VALUES (?,?,?,?)').run(
    user.id,
    oneOf(body.category, POST_CATEGORIES, 'La catégorie'),
    str(body.title, 'Le titre', { required: true, min: 3, max: 120 }),
    str(body.body, 'Le contenu', { required: true, min: 10, max: 3000 }),
  );
  return { id: Number(r.lastInsertRowid) };
});
route('DELETE', '/api/posts/:id', auth(), ({ user, params }) => {
  const p = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(id(params));
  if (!p) throw notFound('Publication');
  if (p.author_id !== user.id && user.role !== 'admin') throw new HttpError(403, 'Accès refusé.');
  db.prepare('DELETE FROM posts WHERE id = ?').run(params.id);
  return { ok: true };
});

/* ───────────── Contact / partenariat ───────────── */
route('POST', '/api/contact', ({ body }) => {
  db.prepare('INSERT INTO contacts (name, email, type, message) VALUES (?,?,?,?)').run(
    str(body.name, 'Le nom', { required: true, min: 2, max: 80 }),
    email(body.email),
    oneOf(body.type || 'question', ['partenaire', 'collaboration', 'question'], 'Le motif'),
    str(body.message, 'Le message', { required: true, min: 10, max: 2000 }),
  );
  return { ok: true };
});

/* ───────────── Administration ───────────── */
route('GET', '/api/admin/stats', auth('admin'), () => {
  const c = (sql) => db.prepare(sql).get().c;
  return {
    users: c('SELECT COUNT(*) c FROM users'),
    clients: c("SELECT COUNT(*) c FROM users WHERE role='client'"),
    pros: c('SELECT COUNT(*) c FROM profiles'),
    shops: c('SELECT COUNT(*) c FROM shops'),
    bookings: c('SELECT COUNT(*) c FROM bookings'),
    orders: c('SELECT COUNT(*) c FROM orders'),
    revenue: db.prepare("SELECT COALESCE(SUM(total),0) c FROM orders WHERE payment_status IN ('paye','a_payer_sur_place')").get().c,
    messages: c('SELECT COUNT(*) c FROM contacts'),
  };
});
route('GET', '/api/admin/users', auth('admin'), () => ({
  users: db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.role, u.commune, u.created_at,
      p.id AS profile_id, p.verified AS profile_verified, s.id AS shop_id, s.verified AS shop_verified
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN shops s ON s.user_id = u.id ORDER BY u.id DESC LIMIT 300`).all(),
}));
route('PATCH', '/api/admin/verify', auth('admin'), ({ body }) => {
  const kind = oneOf(body.kind, ['profile', 'shop'], 'Le type');
  const table = kind === 'profile' ? 'profiles' : 'shops';
  const r = db.prepare(`UPDATE ${table} SET verified = ? WHERE id = ?`).run(bool(body.verified), num(body.id, "L'identifiant", { int: true, min: 1 }));
  if (!r.changes) throw notFound();
  return { ok: true };
});
route('GET', '/api/admin/contacts', auth('admin'), () => ({
  contacts: db.prepare('SELECT * FROM contacts ORDER BY id DESC LIMIT 200').all(),
}));
route('DELETE', '/api/admin/users/:id', auth('admin'), ({ user, params }) => {
  const uid = id(params);
  if (uid === user.id) throw bad('Vous ne pouvez pas supprimer votre propre compte.');
  const r = db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  if (!r.changes) throw notFound('Utilisateur');
  return { ok: true };
});
