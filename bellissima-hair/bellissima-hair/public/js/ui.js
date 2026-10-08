import { html, raw, money, stars, initials, CAT_EMOJI, state } from './core.js';

export const KIND_LABEL = { tresseuse: 'Tresseuse', salon: 'Salon de coiffure' };

export function avatar(name, imageUrl, big = false) {
  return html`<span class="avatar ${big ? 'avatar-lg' : ''}">${imageUrl
    ? html`<img src="${imageUrl}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : initials(name)}</span>`;
}

export function ratingLine(rating, count) {
  if (!count) return html`<span class="muted">Pas encore d’avis</span>`;
  return html`<span class="stars" aria-label="Note ${rating} sur 5">${stars(rating)}</span> <span>${rating} (${count})</span>`;
}

export function proCard(p) {
  return html`<a class="card pro-card" href="#/pro/${p.id}">
    <div class="pro-top">
      ${avatar(p.display_name, p.image_url)}
      <div>
        <h3>${p.display_name} ${p.verified ? html`<span class="badge badge-ok" title="Profil vérifié par Bellissima">✓ Vérifiée</span>` : ''}</h3>
        <div class="meta"><span>${KIND_LABEL[p.kind]}</span><span>📍 ${p.commune || 'Kinshasa'}</span></div>
      </div>
    </div>
    <div class="meta">${ratingLine(p.rating, p.review_count)}</div>
    ${p.specialties ? html`<div class="meta">${p.specialties}</div>` : ''}
    <div class="meta" style="justify-content:space-between;margin-top:auto">
      <span>${p.home_service ? html`<span class="badge">🏠 À domicile</span>` : ''}</span>
      ${p.min_price != null ? html`<span>dès <span class="price-from">${money(p.min_price)}</span></span>` : ''}
    </div>
  </a>`;
}

/** Prix affiché selon le profil : les professionnelles voient le tarif de gros dès la quantité minimale. */
export const isProRole = () => ['tresseuse', 'salon', 'magasin'].includes(state.user?.role);

export function productCard(p) {
  const out = p.stock <= 0;
  return html`<article class="card product">
    <a class="product-img" href="#/produit/${p.id}" aria-label="${p.name}">${p.image_url
      ? html`<img src="${p.image_url}" alt="${p.name}" loading="lazy" referrerpolicy="no-referrer">`
      : CAT_EMOJI[p.category] || '🛍️'}</a>
    <div class="product-body">
      <span class="meta">${p.category} · ${p.shop_name}</span>
      <h3><a href="#/produit/${p.id}" style="color:inherit">${p.name}</a></h3>
      <div class="price">${money(p.price_retail)}</div>
      ${p.price_wholesale != null ? html`<div class="meta"><span class="badge badge-gold">Gros : ${money(p.price_wholesale)} dès ${p.wholesale_min}</span></div>` : ''}
      <div class="product-foot">
        ${out ? html`<span class="badge badge-err">Rupture de stock</span>` : html`<span class="meta">${p.stock} en stock</span>`}
        <button class="btn btn-primary btn-sm" data-action="add-cart" data-id="${p.id}" ${out ? 'disabled' : ''}>Ajouter</button>
      </div>
    </div>
  </article>`;
}

export function communeOptions(selected = '', placeholder = 'Choisir une commune') {
  return html`<option value="">${placeholder}</option>${state.meta.communes.map((c) => html`<option ${c === selected ? raw('selected') : ''}>${c}</option>`)}`;
}

export const emptyState = (emoji, title, text, cta = '') => html`<div class="empty"><span class="emoji">${emoji}</span><h3>${title}</h3><p class="muted">${text}</p>${raw(cta?.s || '')}</div>`;

export const BOOKING_STATUS = {
  en_attente: ['En attente', 'badge-warn'], confirmee: ['Confirmée', 'badge-ok'], refusee: ['Refusée', 'badge-err'],
  annulee: ['Annulée', 'badge-err'], terminee: ['Terminée', 'badge-ok'],
};
export const ITEM_STATUS = {
  en_attente: ['En attente', 'badge-warn'], preparee: ['Préparée', 'badge-gold'], expediee: ['Expédiée', 'badge-gold'],
  livree: ['Livrée', 'badge-ok'], annulee: ['Annulée', 'badge-err'],
};
export const PAY_STATUS = { paye: ['Payé', 'badge-ok'], a_payer_sur_place: ['À payer sur place', 'badge-warn'], en_attente: ['Paiement en attente', 'badge-warn'], echoue: ['Paiement échoué', 'badge-err'] };
export const badge = ([label, cls]) => html`<span class="badge ${cls}">${label}</span>`;
