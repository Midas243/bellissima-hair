/* ───── Gabarits HTML échappés par défaut (protection XSS) ───── */
class Raw { constructor(s) { this.s = s; } }
export const raw = (s) => new Raw(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const toStr = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(toStr).join('') : v === false || v == null ? '' : esc(v));
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += toStr(v) + strings[i + 1]; });
  return new Raw(out);
}

/* ───── Formats ───── */
export const money = (n) => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })} $`;
export const fdate = (d) => new Date(String(d).length === 10 ? d + 'T12:00:00' : String(d).replace(' ', 'T') + 'Z')
  .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
export const fshort = (d) => new Date(String(d).replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const stars = (r) => '★'.repeat(Math.round(r || 0)) + '☆'.repeat(5 - Math.round(r || 0));
export const initials = (n) => String(n).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
export const waLink = (tel) => `https://wa.me/${String(tel).replace(/\D/g, '')}`;

export const CAT_EMOJI = { 'Mèches': '🧶', Perruques: '👩🏾‍🦱', Huiles: '🫒', Gels: '🧴', Mousses: '🫧', Shampoings: '🧼', Accessoires: '🎀', 'Matériel pro': '✂️' };

/* ───── État global ───── */
export const state = { user: null, meta: null };
const TOKEN_KEY = 'bh_token';
const CART_KEY = 'bh_cart';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
  state.user = user;
  refreshChrome();
}

/* ───── API ───── */
export async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Connexion impossible. Vérifiez votre réseau et réessayez.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && t) setSession(null, null);
    throw new Error(data.error || 'Une erreur est survenue.');
  }
  return data;
}
export const get = (u) => api('GET', u);
export const post = (u, b) => api('POST', u, b || {});
export const put = (u, b) => api('PUT', u, b || {});
export const patch = (u, b) => api('PATCH', u, b || {});
export const del = (u) => api('DELETE', u);

/* ───── Panier (stocké dans le navigateur) ───── */
export const cart = {
  items: () => read(CART_KEY, []),
  save(items) { localStorage.setItem(CART_KEY, JSON.stringify(items)); refreshChrome(); },
  add(id, qty = 1) {
    const items = this.items();
    const l = items.find((i) => i.id === id);
    if (l) l.qty += qty; else items.push({ id, qty });
    this.save(items);
  },
  set(id, qty) { this.save(qty > 0 ? this.items().map((i) => (i.id === id ? { ...i, qty } : i)) : this.items().filter((i) => i.id !== id)); },
  clear() { this.save([]); },
  count: () => read(CART_KEY, []).reduce((n, i) => n + i.qty, 0),
};

/* ───── Notifications ───── */
export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 4200);
}

/* ───── Actions & formulaires (délégation d'événements) ───── */
export const actions = {};
export const forms = {};

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  e.preventDefault();
  try { await actions[el.dataset.action](el, e); } catch (err) { toast(err.message, 'err'); }
});

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form || !forms[form.dataset.form]) return;
  e.preventDefault();
  const btn = form.querySelector('[type=submit]');
  form.querySelector('.form-error')?.remove();
  if (btn) btn.disabled = true;
  try {
    await forms[form.dataset.form](formData(form), form);
  } catch (err) {
    const box = document.createElement('p');
    box.className = 'form-error';
    box.setAttribute('role', 'alert');
    box.textContent = err.message;
    form.prepend(box);
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.addEventListener('change', (e) => {
  const form = e.target.closest('form[data-autosubmit]');
  if (form) form.requestSubmit();
});

/* ───── Routeur par hash ───── */
const table = [];
export function route(pattern, handler, opts = {}) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:([a-z]+)/gi, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  table.push({ regex, keys, handler, opts });
}
export const go = (path) => { location.hash = '#' + path; };
export const rerender = () => render();
export const currentPath = () => (location.hash.slice(1) || '/').split('?')[0];

let renderId = 0;
async function render() {
  const id = ++renderId;
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const app = document.getElementById('app');
  const r = table.find((x) => x.regex.test(path));
  document.getElementById('main-nav').classList.remove('open');
  document.querySelector('.menu-btn')?.setAttribute('aria-expanded', 'false');
  highlightNav(path);

  if (!r) { app.innerHTML = notFoundHtml().s; return; }
  if (r.opts.auth && !state.user) { go(`/connexion?next=${encodeURIComponent(path)}`); return; }
  if (r.opts.roles && !r.opts.roles.includes(state.user.role)) { go('/compte'); return; }

  const first = !app.dataset.ready;
  if (first || app.dataset.path !== path) app.innerHTML = '<div class="loading">Chargement…</div>';
  try {
    const m = path.match(r.regex);
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const result = await r.handler({ params, query, path });
    if (id !== renderId) return; // une navigation plus récente a pris le relais
    app.innerHTML = result.s;
    if (app.dataset.path !== path) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
    app.dataset.path = path;
    app.dataset.ready = '1';
    const h1 = app.querySelector('h1');
    document.title = h1 ? `${h1.textContent} — Bellissima Hair` : 'Bellissima Hair — La beauté, connectée';
  } catch (err) {
    if (id !== renderId) return;
    app.innerHTML = html`<div class="container section"><div class="empty"><span class="emoji">😕</span><h2>Oups…</h2><p>${err.message}</p><a class="btn btn-primary" href="#/">Retour à l’accueil</a></div></div>`.s;
  }
}

const notFoundHtml = () => html`<div class="container section"><div class="empty"><span class="emoji">🔎</span><h1>Page introuvable</h1><p class="muted">Cette page n’existe pas ou a été déplacée.</p><a class="btn btn-primary" href="#/">Retour à l’accueil</a></div></div>`;

function highlightNav(path) {
  const seg = path.split('/')[1] || '';
  const map = { pro: 'services', produit: 'boutique', panier: 'boutique' };
  const key = map[seg] || seg;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
}

export function refreshChrome() {
  const link = document.getElementById('auth-link');
  if (link) {
    link.textContent = state.user ? `Mon compte` : 'Rejoindre';
    link.setAttribute('href', state.user ? '#/compte' : '#/connexion');
  }
  const n = cart.count();
  const c = document.getElementById('cart-count');
  if (c) { c.hidden = n === 0; c.textContent = n; }
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}

actions['toggle-menu'] = (el) => {
  const nav = document.getElementById('main-nav');
  const open = nav.classList.toggle('open');
  el.setAttribute('aria-expanded', String(open));
};
