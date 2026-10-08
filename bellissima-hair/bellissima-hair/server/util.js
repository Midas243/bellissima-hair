export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (msg) => new HttpError(400, msg);

/** Texte validé et nettoyé. */
export function str(v, label, { min = 0, max = 500, required = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${label} est requis.`);
    return '';
  }
  if (typeof v !== 'string') throw bad(`${label} est invalide.`);
  const t = v.trim();
  if (required && !t) throw bad(`${label} est requis.`);
  if (t.length < min) throw bad(`${label} doit contenir au moins ${min} caractères.`);
  if (t.length > max) throw bad(`${label} ne peut pas dépasser ${max} caractères.`);
  return t;
}

/** Nombre validé. Retourne null si absent et non requis. */
export function num(v, label, { min = 0, max = 1e9, int = false, required = true } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${label} est requis.`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw bad(`${label} doit être un nombre.`);
  if (int && !Number.isInteger(n)) throw bad(`${label} doit être un nombre entier.`);
  if (n < min || n > max) throw bad(`${label} doit être compris entre ${min} et ${max}.`);
  return n;
}

export function oneOf(v, list, label) {
  if (!list.includes(v)) throw bad(`${label} est invalide.`);
  return v;
}

export function email(v) {
  const e = str(v, "L'e-mail", { required: true, max: 160 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw bad("L'adresse e-mail n'est pas valide.");
  return e;
}

export function phone(v, { required = false } = {}) {
  const p = str(v, 'Le téléphone', { max: 25, required });
  if (p && !/^\+?[0-9 ()-]{8,20}$/.test(p)) throw bad('Le numéro de téléphone n’est pas valide (ex. +243 81 234 5678).');
  return p;
}

/** URL d'image : vide ou https uniquement. */
export function imageUrl(v) {
  const u = str(v, "L'URL de l'image", { max: 500 });
  if (u && !/^https:\/\/[^\s]+$/i.test(u)) throw bad("L'URL de l'image doit commencer par https://");
  return u;
}

export const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

/** Date du jour / heure actuelle à Kinshasa (UTC+1). */
export function nowKinshasa() {
  const d = new Date(Date.now() + 3600e3);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
