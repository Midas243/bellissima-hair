import { html, raw, route, get, post, forms, actions, go, state, toast, money, cart, rerender, CAT_EMOJI } from './core.js';
import { productCard, emptyState, isProRole } from './ui.js';

forms.shopfilters = (d) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(d)) if (v && v !== false) qs.set(k, v === true ? '1' : v);
  go(`/boutique${qs.toString() ? '?' + qs : ''}`);
};

route('/boutique', async ({ query }) => {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v));
  const { products } = await get(`/api/products?${qs}`);
  const cats = state.meta.productCategories;
  const chip = (label, cat) => html`<a class="chip ${(query.category || '') === cat ? 'active' : ''}" href="#/boutique${cat ? '?category=' + encodeURIComponent(cat) : ''}">${label}</a>`;
  return html`<div class="container">
    <div class="page-head">
      <h1>🛍️ Bellissima Boutique</h1>
      <p>Un marché beauté où les magasins vendent leurs produits aux clientes en détail et aux professionnelles en gros.</p>
    </div>
    <form class="filters" data-form="shopfilters" role="search">
      <div class="row">
        <div class="field"><label for="s-q">Recherche</label><input id="s-q" name="q" type="search" value="${query.q || ''}" placeholder="Huile, mèches, perruque…"></div>
        <div class="field"><label for="s-sort">Trier par</label><select id="s-sort" name="sort" data-keep><option value="">Pertinence</option><option value="recent" ${query.sort === 'recent' ? raw('selected') : ''}>Nouveautés</option><option value="prix" ${query.sort === 'prix' ? raw('selected') : ''}>Prix croissant</option></select></div>
        <div class="field"><label class="check"><input type="checkbox" name="wholesale" ${query.wholesale === '1' ? raw('checked') : ''}> Tarif de gros disponible</label></div>
        <div class="field"><button class="btn btn-primary btn-block" type="submit">Rechercher</button></div>
      </div>
      ${query.category ? html`<input type="hidden" name="category" value="${query.category}">` : ''}
      <div class="chips">${chip('Tout', '')}${cats.map((c) => chip(c, c))}</div>
    </form>
    ${isProRole() ? html`<p class="hint" style="margin-bottom:20px">Compte professionnel : le tarif de gros s’applique automatiquement dès la quantité minimale indiquée.</p>` : ''}
    <p class="muted">${products.length} produit${products.length > 1 ? 's' : ''}</p>
    ${products.length ? html`<div class="grid grid-4" style="margin-bottom:64px">${products.map(productCard)}</div>`
      : html`<div style="margin-bottom:64px">${emptyState('🛍️', 'Aucun produit trouvé', 'Essayez une autre catégorie ou un autre mot-clé.', html`<a class="btn btn-ghost" href="#/boutique">Voir toute la boutique</a>`)}</div>`}
  </div>`;
});

route('/produit/:id', async ({ params }) => {
  const { product: p } = await get(`/api/products/${params.id}`);
  const out = p.stock <= 0;
  return html`<div class="container">
    <p style="margin:24px 0 0"><a href="#/boutique">← Retour à la boutique</a></p>
    <div class="grid grid-2" style="margin:20px 0 64px;align-items:start">
      <div class="card product-img" style="aspect-ratio:1;border-radius:var(--r-lg);overflow:hidden;padding:0;font-size:6rem">${p.image_url ? html`<img src="${p.image_url}" alt="${p.name}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover">` : CAT_EMOJI[p.category] || '🛍️'}</div>
      <div>
        <span class="badge">${p.category}</span>
        <h1 style="font-size:2rem;margin-top:12px">${p.name}</h1>
        <p class="muted">Vendu par <strong>${p.shop_name}</strong>${p.shop_commune ? ` · 📍 ${p.shop_commune}` : ''} ${p.shop_verified ? html`<span class="badge badge-ok">✓ Vérifié</span>` : ''}</p>
        <div class="price" style="font-size:1.8rem">${money(p.price_retail)}</div>
        ${p.price_wholesale != null ? html`<p><span class="badge badge-gold">Tarif de gros : ${money(p.price_wholesale)} l’unité dès ${p.wholesale_min} unités</span><br><span class="muted" style="font-size:.85rem">Réservé aux comptes professionnels (tresseuses, salons, magasins).</span></p>` : ''}
        ${p.description ? html`<p>${p.description}</p>` : ''}
        <p>${out ? html`<span class="badge badge-err">Rupture de stock</span>` : html`<span class="badge badge-ok">${p.stock} en stock</span>`}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn btn-primary" data-action="add-cart" data-id="${p.id}" ${out ? 'disabled' : ''}>Ajouter au panier</button>
          <a class="btn btn-ghost" href="#/boutique?category=${encodeURIComponent(p.category)}">Voir la catégorie</a>
        </div>
      </div>
    </div>
  </div>`;
});

actions['add-cart'] = (el) => {
  cart.add(Number(el.dataset.id));
  toast('Ajouté au panier 🛍️', 'ok');
};

/* ───── Panier ───── */
function unitPrice(p, qty) {
  const wholesale = isProRole() && p.price_wholesale != null && qty >= p.wholesale_min;
  return { unit: wholesale ? p.price_wholesale : p.price_retail, wholesale };
}

route('/panier', async () => {
  const items = cart.items();
  if (!items.length) {
    return html`<div class="container section">${emptyState('🛍️', 'Votre panier est vide', 'Ajoutez des produits depuis la boutique.', html`<a class="btn btn-primary" href="#/boutique">Explorer la boutique</a>`)}</div>`;
  }
  const { products } = await post('/api/products/lookup', { ids: items.map((i) => i.id) });
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  // Retire les produits qui n'existent plus
  const valid = items.filter((i) => byId[i.id]);
  if (valid.length !== items.length) cart.save(valid);

  let subtotal = 0;
  const lines = valid.map((i) => {
    const p = byId[i.id];
    const qty = Math.min(i.qty, Math.max(p.stock, 1));
    const { unit, wholesale } = unitPrice(p, qty);
    subtotal += unit * qty;
    return { p, qty, unit, wholesale };
  });
  const fee = state.meta.deliveryFee;

  return html`<div class="container">
    <div class="page-head"><h1>Mon panier</h1></div>
    <div class="pro-layout" style="margin-bottom:64px">
      <div class="card">
        ${lines.map(({ p, qty, unit, wholesale }) => html`<div class="line">
          <div class="line-img">${p.image_url ? html`<img src="${p.image_url}" alt="" referrerpolicy="no-referrer">` : CAT_EMOJI[p.category] || '🛍️'}</div>
          <div><strong>${p.name}</strong><div class="meta">${p.shop_name}</div>
            ${wholesale ? html`<span class="badge badge-gold">Tarif de gros appliqué</span>` : ''}
            ${p.stock < qty || p.stock <= 0 ? html`<span class="badge badge-err">Stock : ${p.stock}</span>` : ''}</div>
          <div style="text-align:right">
            <div class="qty"><button data-action="qty-dec" data-id="${p.id}" aria-label="Diminuer">−</button><span>${qty}</span><button data-action="qty-inc" data-id="${p.id}" aria-label="Augmenter" ${qty >= p.stock ? 'disabled' : ''}>+</button></div>
            <div class="price" style="margin-top:6px">${money(unit * qty)}</div>
            <button class="link-btn" data-action="qty-del" data-id="${p.id}">Retirer</button>
          </div>
        </div>`)}
      </div>

      <aside class="sticky card">
        <h2 style="font-size:1.4rem">Récapitulatif</h2>
        ${!state.user ? html`
          <div class="totals"><div><span>Sous-total</span><span>${money(subtotal)}</span></div></div>
          <p class="muted">Connectez-vous pour finaliser votre commande.</p>
          <a class="btn btn-primary btn-block" href="#/connexion?next=${encodeURIComponent('/panier')}">Se connecter</a>`
        : html`<form data-form="checkout">
          <div class="field"><label>Réception</label>
            <label class="opt"><input type="radio" name="delivery_mode" value="livraison" checked data-checkout> Livraison (${money(fee)})</label>
            <label class="opt"><input type="radio" name="delivery_mode" value="retrait" data-checkout> Retrait chez le vendeur</label></div>
          <div class="field" id="c-address-wrap"><label for="c-address">Adresse de livraison</label><input id="c-address" name="address" value="" placeholder="Avenue, numéro, quartier, commune" required></div>
          <div class="field"><label>Paiement</label>
            ${state.meta.paymentMethods.map((m, i) => html`<label class="opt"><input type="radio" name="payment_method" value="${m.id}" data-mobile="${m.mobile ? 1 : 0}" data-checkout ${i === 0 ? raw('checked') : ''}> ${m.label}</label>`)}</div>
          <div class="field" id="c-phone-wrap"><label for="c-phone">Numéro Mobile Money</label><input id="c-phone" name="payment_phone" type="tel" value="${state.user.phone || ''}" placeholder="+243 81 234 5678" required></div>
          <div class="totals">
            <div><span>Sous-total</span><span>${money(subtotal)}</span></div>
            <div id="c-fee"><span>Livraison</span><span>${money(fee)}</span></div>
            <div class="grand"><span>Total</span><span id="c-total" data-sub="${subtotal}" data-fee="${fee}">${money(subtotal + fee)}</span></div>
          </div>
          ${state.meta.paymentMode === 'simulation' ? html`<p class="hint" style="margin-bottom:14px">Mode démonstration : aucun paiement réel n’est effectué.</p>` : ''}
          <button class="btn btn-primary btn-block" type="submit">Commander</button>
        </form>`}
      </aside>
    </div>
  </div>`;
});

// Met à jour l'adresse / le téléphone / le total selon les options choisies
document.addEventListener('change', (e) => {
  if (!e.target.matches('[data-checkout]')) return;
  const f = e.target.form;
  const livraison = f.elements.delivery_mode.value === 'livraison';
  document.getElementById('c-address-wrap').hidden = !livraison;
  document.getElementById('c-address').required = livraison;
  document.getElementById('c-fee').hidden = !livraison;
  const pm = f.querySelector('input[name=payment_method]:checked');
  const mobile = pm?.dataset.mobile === '1';
  document.getElementById('c-phone-wrap').hidden = !mobile;
  document.getElementById('c-phone').required = mobile;
  const t = document.getElementById('c-total');
  const total = Number(t.dataset.sub) + (livraison ? Number(t.dataset.fee) : 0);
  t.textContent = money(total);
});

const changeQty = (id, delta) => {
  const l = cart.items().find((i) => i.id === id);
  if (l) cart.set(id, l.qty + delta);
  rerender();
};
actions['qty-inc'] = (el) => changeQty(Number(el.dataset.id), 1);
actions['qty-dec'] = (el) => changeQty(Number(el.dataset.id), -1);
actions['qty-del'] = (el) => { cart.set(Number(el.dataset.id), 0); rerender(); };

forms.checkout = async (d) => {
  const items = cart.items().map((i) => ({ product_id: i.id, qty: i.qty }));
  const mobile = state.meta.paymentMethods.find((m) => m.id === d.payment_method)?.mobile;
  const r = await post('/api/orders', {
    items,
    delivery_mode: d.delivery_mode,
    address: d.delivery_mode === 'livraison' ? d.address : '',
    payment_method: d.payment_method,
    payment_phone: mobile ? d.payment_phone : '',
  });
  if (r.payment_status === 'echoue') throw new Error('Le paiement n’a pas abouti. Votre commande est enregistrée : réessayez ou choisissez un autre moyen de paiement.');
  cart.clear();
  toast(`Commande n°${r.id} enregistrée. Merci !`, 'ok');
  go('/compte/commandes');
};
