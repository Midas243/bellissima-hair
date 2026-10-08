import { html, raw, route, get, post, put, patch, del, forms, actions, go, state, setSession, toast, money, fdate, fshort, rerender, waLink } from './core.js';
import { communeOptions, emptyState, badge, BOOKING_STATUS, ITEM_STATUS, PAY_STATUS, KIND_LABEL } from './ui.js';

const TABS = {
  client: [['reservations', 'Mes réservations'], ['commandes', 'Mes commandes'], ['infos', 'Mon compte']],
  pro: [['demandes', 'Demandes reçues'], ['profil', 'Profil public'], ['services', 'Mes services'], ['reservations', 'Mes réservations'], ['commandes', 'Mes achats'], ['infos', 'Mon compte']],
  magasin: [['boutique', 'Ma boutique'], ['produits', 'Produits'], ['ventes', 'Ventes reçues'], ['commandes', 'Mes achats'], ['infos', 'Mon compte']],
  admin: [['stats', 'Statistiques'], ['utilisateurs', 'Utilisateurs'], ['messages', 'Messages'], ['infos', 'Mon compte']],
};
const tabsFor = (role) => TABS[role === 'tresseuse' || role === 'salon' ? 'pro' : role];
const payLabel = (id) => state.meta.paymentMethods.find((m) => m.id === id)?.label || id;
const when = (b) => `${fdate(b.date)} à ${b.time}`;
const sel = (a, b) => (String(a) === String(b) ? raw('selected') : '');

route('/compte', () => { go(`/compte/${tabsFor(state.user.role)[0][0]}`); return html``; }, { auth: true });

route('/compte/:tab', async ({ params }) => {
  const tabs = tabsFor(state.user.role);
  const tab = tabs.find(([k]) => k === params.tab);
  if (!tab) { go('/compte'); return html``; }
  const body = await views[params.tab]();
  return html`<div class="container">
    <div class="page-head"><h1>Bonjour ${state.user.name.split(' ')[0]} 👋</h1>
      <p>${{ client: 'Votre espace cliente', tresseuse: 'Votre espace tresseuse', salon: 'Votre espace salon', magasin: 'Votre espace vendeur', admin: 'Administration' }[state.user.role]}</p></div>
    <nav class="tabs" aria-label="Sections de votre espace">${tabs.map(([k, l]) => html`<a href="#/compte/${k}" class="${k === params.tab ? 'active' : ''}" ${k === params.tab ? raw('aria-current="page"') : ''}>${l}</a>`)}</nav>
    <div style="margin-bottom:64px">${body}</div>
  </div>`;
}, { auth: true });

const views = {
  /* ───── Cliente : réservations ───── */
  async reservations() {
    const { bookings } = await get('/api/bookings');
    if (!bookings.length) return emptyState('📅', 'Aucune réservation', 'Trouvez une professionnelle et réservez votre créneau.', html`<a class="btn btn-primary" href="#/services">Trouver une professionnelle</a>`);
    return html`${bookings.map((b) => html`<div class="item">
      <div class="item-head">
        <div><strong>${b.service_name}</strong> — <a href="#/pro/${b.pro_id}">${b.pro_name}</a>
          <div class="meta">📅 ${when(b)} · ${b.mode === 'domicile' ? '🏠 À domicile' : '📍 Sur place'} · ${money(b.price)}</div>
          ${b.address ? html`<div class="meta">Adresse : ${b.address}</div>` : ''}</div>
        ${badge(BOOKING_STATUS[b.status])}
      </div>
      <div class="item-actions">
        ${['en_attente', 'confirmee'].includes(b.status) ? html`<button class="btn btn-danger btn-sm" data-action="booking-status" data-id="${b.id}" data-status="annulee" data-confirm="Annuler cette réservation ?">Annuler</button>` : ''}
        ${b.status === 'confirmee' && b.pro_phone ? html`<a class="btn btn-ghost btn-sm" href="${waLink(b.pro_phone)}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>` : ''}
      </div>
      ${b.status === 'terminee' && !b.reviewed ? html`<details style="margin-top:12px"><summary class="link-btn">Donner mon avis</summary>
        <form data-form="review" style="margin-top:12px"><input type="hidden" name="booking_id" value="${b.id}">
          <div class="row"><div class="field"><label>Note</label><select name="rating">${[5, 4, 3, 2, 1].map((n) => html`<option value="${n}">${'★'.repeat(n)} (${n}/5)</option>`)}</select></div></div>
          <div class="field"><label>Commentaire</label><textarea name="comment" maxlength="600"></textarea></div>
          <button class="btn btn-primary btn-sm" type="submit">Publier mon avis</button></form></details>` : ''}
    </div>`)}`;
  },

  /* ───── Professionnelle : demandes reçues ───── */
  async demandes() {
    const { bookings } = await get('/api/bookings?as=pro');
    if (!bookings.length) return emptyState('📥', 'Aucune demande pour le moment', 'Complétez votre profil et vos services pour recevoir des réservations.', html`<a class="btn btn-primary" href="#/compte/services">Ajouter mes services</a>`);
    return html`${bookings.map((b) => html`<div class="item">
      <div class="item-head">
        <div><strong>${b.service_name}</strong> · ${money(b.price)} · ${b.duration_min} min
          <div class="meta">📅 ${when(b)} · ${b.mode === 'domicile' ? '🏠 À domicile' : '📍 Chez vous / au salon'}</div>
          <div class="meta">👤 ${b.client_name}${b.client_phone ? html` · <a href="${waLink(b.client_phone)}" target="_blank" rel="noopener noreferrer">${b.client_phone}</a>` : ''}</div>
          ${b.address ? html`<div class="meta">Adresse : ${b.address}</div>` : ''}
          ${b.note ? html`<div class="meta">« ${b.note} »</div>` : ''}</div>
        ${badge(BOOKING_STATUS[b.status])}
      </div>
      <div class="item-actions">
        ${b.status === 'en_attente' ? html`<button class="btn btn-primary btn-sm" data-action="booking-status" data-id="${b.id}" data-status="confirmee">Confirmer</button>
          <button class="btn btn-danger btn-sm" data-action="booking-status" data-id="${b.id}" data-status="refusee" data-confirm="Refuser cette demande ?">Refuser</button>` : ''}
        ${b.status === 'confirmee' ? html`<button class="btn btn-primary btn-sm" data-action="booking-status" data-id="${b.id}" data-status="terminee">Marquer comme terminée</button>
          <button class="btn btn-danger btn-sm" data-action="booking-status" data-id="${b.id}" data-status="annulee" data-confirm="Annuler ce rendez-vous ?">Annuler</button>` : ''}
      </div>
    </div>`)}`;
  },

  /* ───── Professionnelle : profil public ───── */
  async profil() {
    const { profile: p } = await get('/api/my/profile');
    return html`<div class="pro-layout"><form class="card" data-form="my-profile">
      <h2 style="font-size:1.4rem">Profil public</h2>
      <div class="field"><label for="m-name">Nom affiché</label><input id="m-name" name="display_name" value="${p.display_name}" required maxlength="100"></div>
      <div class="field"><label for="m-bio">Présentation</label><textarea id="m-bio" name="bio" maxlength="1000" placeholder="Votre expérience, votre style, vos produits…">${p.bio}</textarea></div>
      <div class="field"><label for="m-spec">Spécialités</label><input id="m-spec" name="specialties" value="${p.specialties}" maxlength="200" placeholder="Box braids, Tissages, Locks…"></div>
      <div class="row">
        <div class="field"><label for="m-commune">Commune</label><select id="m-commune" name="commune">${communeOptions(p.commune)}</select></div>
        <div class="field"><label for="m-phone">Téléphone / WhatsApp</label><input id="m-phone" name="phone" type="tel" value="${p.phone}" required></div>
      </div>
      <div class="field"><label for="m-addr">Adresse</label><input id="m-addr" name="address" value="${p.address}" maxlength="200" placeholder="Avenue, numéro, quartier"></div>
      <div class="field"><label for="m-img">Photo (lien https://…)</label><input id="m-img" name="image_url" type="url" value="${p.image_url}" placeholder="https://…"><small>Collez le lien d’une image hébergée (ex. Facebook, Instagram, Google Photos publics).</small></div>
      <div class="field"><label class="check"><input type="checkbox" name="home_service" ${p.home_service ? raw('checked') : ''}> 🏠 Je me déplace à domicile</label></div>
      <div class="field"><label class="check"><input type="checkbox" name="active" ${p.active ? raw('checked') : ''}> Profil visible dans les résultats</label></div>
      <button class="btn btn-primary" type="submit">Enregistrer</button>
    </form>
    <aside class="card"><h3>Votre vitrine</h3>
      <p>${KIND_LABEL[p.kind]} ${p.verified ? html`<span class="badge badge-ok">✓ Vérifiée</span>` : html`<span class="badge badge-warn">Vérification en cours</span>`}</p>
      <p class="muted">Un profil complet (photo, présentation, services) reçoit beaucoup plus de réservations.</p>
      <a class="btn btn-ghost btn-sm" href="#/pro/${p.id}">Voir mon profil public</a></aside></div>`;
  },

  /* ───── Professionnelle : services ───── */
  async services() {
    const { services } = await get('/api/my/profile');
    const form = (s = {}) => html`<form data-form="service">
      ${s.id ? html`<input type="hidden" name="id" value="${s.id}">` : ''}
      <div class="row">
        <div class="field"><label>Service</label><input name="name" value="${s.name || ''}" required maxlength="100" placeholder="Box braids"></div>
        <div class="field"><label>Prix ($)</label><input name="price" type="number" min="0" step="0.5" value="${s.price ?? ''}" required></div>
        <div class="field"><label>Durée (min)</label><input name="duration_min" type="number" min="15" step="15" value="${s.duration_min ?? 60}" required></div>
      </div>
      <div class="field"><label>Description (facultatif)</label><input name="description" value="${s.description || ''}" maxlength="400"></div>
      <div class="item-actions" style="margin:0"><button class="btn btn-primary btn-sm" type="submit">${s.id ? 'Enregistrer' : 'Ajouter le service'}</button>
        ${s.id ? html`<button class="btn btn-danger btn-sm" type="button" data-action="del-service" data-id="${s.id}" data-confirm="Supprimer ce service ?">Supprimer</button>` : ''}</div>
    </form>`;
    return html`<details class="item" ${services.length ? '' : raw('open')}><summary>➕ Ajouter un service</summary>${form()}</details>
      ${services.map((s) => html`<details class="item"><summary><span>${s.name}</span><span class="price-from">${money(s.price)} · ${s.duration_min} min</span></summary>${form(s)}</details>`)}`;
  },

  /* ───── Commandes passées (tous les comptes) ───── */
  async commandes() {
    const { orders } = await get('/api/orders');
    if (!orders.length) return emptyState('🛍️', 'Aucune commande', 'Vos achats de la boutique apparaîtront ici.', html`<a class="btn btn-primary" href="#/boutique">Explorer la boutique</a>`);
    return html`${orders.map((o) => html`<div class="item">
      <div class="item-head">
        <div><strong>Commande n°${o.id}</strong> <span class="muted">· ${fshort(o.created_at)}</span>
          <div class="meta">${payLabel(o.payment_method)} · ${o.delivery_mode === 'livraison' ? '🚚 Livraison : ' + o.address : '📍 Retrait chez le vendeur'}</div></div>
        <div style="text-align:right"><div class="price">${money(o.total)}</div>${badge(PAY_STATUS[o.payment_status])}</div>
      </div>
      <table style="margin-top:12px"><tbody>${o.items.map((i) => html`<tr>
        <td>${i.name}${i.wholesale ? html` <span class="badge badge-gold">Gros</span>` : ''}<div class="meta">${i.shop_name}</div></td>
        <td>${i.qty} × ${money(i.unit_price)}</td><td>${badge(ITEM_STATUS[i.status])}</td>
        <td>${i.status === 'en_attente' ? html`<button class="link-btn" data-action="item-status" data-id="${i.id}" data-status="annulee" data-confirm="Annuler cet article ?">Annuler</button>` : ''}</td></tr>`)}</tbody></table>
      ${o.payment_ref ? html`<p class="muted" style="font-size:.82rem;margin:10px 0 0">Référence : ${o.payment_ref}</p>` : ''}
    </div>`)}`;
  },

  /* ───── Magasin ───── */
  async boutique() {
    const { shop: s } = await get('/api/my/shop');
    return html`<div class="pro-layout"><form class="card" data-form="my-shop">
      <h2 style="font-size:1.4rem">Ma boutique</h2>
      <div class="field"><label for="sh-name">Nom du magasin</label><input id="sh-name" name="name" value="${s.name}" required maxlength="100"></div>
      <div class="field"><label for="sh-desc">Description</label><textarea id="sh-desc" name="description" maxlength="800">${s.description}</textarea></div>
      <div class="row">
        <div class="field"><label for="sh-commune">Commune</label><select id="sh-commune" name="commune">${communeOptions(s.commune)}</select></div>
        <div class="field"><label for="sh-phone">Téléphone</label><input id="sh-phone" name="phone" type="tel" value="${s.phone}" required></div>
      </div>
      <div class="field"><label for="sh-addr">Adresse</label><input id="sh-addr" name="address" value="${s.address}" maxlength="200"></div>
      <button class="btn btn-primary" type="submit">Enregistrer</button>
    </form>
    <aside class="card"><h3>Statut</h3><p>${s.verified ? html`<span class="badge badge-ok">✓ Magasin vérifié</span>` : html`<span class="badge badge-warn">Vérification en cours</span>`}</p>
      <p class="muted">Ajoutez vos produits dans l’onglet « Produits » avec prix de détail, prix de gros et stock.</p></aside></div>`;
  },

  async produits() {
    const { products } = await get('/api/my/shop');
    const cats = state.meta.productCategories;
    const form = (p = {}) => html`<form data-form="product">
      ${p.id ? html`<input type="hidden" name="id" value="${p.id}">` : ''}
      <div class="row">
        <div class="field"><label>Produit</label><input name="name" value="${p.name || ''}" required maxlength="120"></div>
        <div class="field"><label>Catégorie</label><select name="category">${cats.map((c) => html`<option ${sel(p.category, c)}>${c}</option>`)}</select></div>
      </div>
      <div class="row">
        <div class="field"><label>Prix détail ($)</label><input name="price_retail" type="number" min="0" step="0.1" value="${p.price_retail ?? ''}" required></div>
        <div class="field"><label>Prix de gros ($)</label><input name="price_wholesale" type="number" min="0" step="0.1" value="${p.price_wholesale ?? ''}"></div>
        <div class="field"><label>Quantité min. gros</label><input name="wholesale_min" type="number" min="2" value="${p.wholesale_min ?? 10}"></div>
        <div class="field"><label>Stock</label><input name="stock" type="number" min="0" value="${p.stock ?? 0}" required></div>
      </div>
      <div class="field"><label>Description</label><textarea name="description" maxlength="800">${p.description || ''}</textarea></div>
      <div class="field"><label>Photo (lien https://…)</label><input name="image_url" type="url" value="${p.image_url || ''}" placeholder="https://…"></div>
      <div class="field"><label class="check"><input type="checkbox" name="active" ${p.id && !p.active ? '' : raw('checked')}> Visible dans la boutique</label></div>
      <div class="item-actions" style="margin:0"><button class="btn btn-primary btn-sm" type="submit">${p.id ? 'Enregistrer' : 'Ajouter le produit'}</button>
        ${p.id ? html`<button class="btn btn-danger btn-sm" type="button" data-action="del-product" data-id="${p.id}" data-confirm="Supprimer ce produit ?">Supprimer</button>` : ''}</div>
    </form>`;
    return html`<details class="item" ${products.length ? '' : raw('open')}><summary>➕ Ajouter un produit</summary>${form()}</details>
      ${products.map((p) => html`<details class="item"><summary><span>${p.name} ${p.active ? '' : html`<span class="badge badge-warn">Masqué</span>`}</span><span class="price-from">${money(p.price_retail)} · stock ${p.stock}</span></summary>${form(p)}</details>`)}`;
  },

  async ventes() {
    const { items } = await get('/api/my/orders');
    if (!items.length) return emptyState('📦', 'Aucune vente pour le moment', 'Les commandes de vos produits apparaîtront ici.');
    const next = { en_attente: ['preparee', 'Marquer préparée'], preparee: ['expediee', 'Marquer expédiée'], expediee: ['livree', 'Marquer livrée'] };
    return html`${items.map((i) => html`<div class="item">
      <div class="item-head">
        <div><strong>${i.name}</strong> × ${i.qty} <span class="muted">· ${money(i.unit_price * i.qty)}</span> ${i.wholesale ? html`<span class="badge badge-gold">Gros</span>` : ''}
          <div class="meta">👤 ${i.buyer_name}${i.buyer_phone ? html` · <a href="${waLink(i.buyer_phone)}" target="_blank" rel="noopener noreferrer">${i.buyer_phone}</a>` : ''} · ${fshort(i.created_at)}</div>
          <div class="meta">${i.delivery_mode === 'livraison' ? '🚚 ' + i.address : '📍 Retrait en magasin'} · ${payLabel(i.payment_method)} · ${badge(PAY_STATUS[i.payment_status])}</div></div>
        ${badge(ITEM_STATUS[i.status])}
      </div>
      <div class="item-actions">
        ${next[i.status] ? html`<button class="btn btn-primary btn-sm" data-action="item-status" data-id="${i.id}" data-status="${next[i.status][0]}">${next[i.status][1]}</button>` : ''}
        ${['en_attente', 'preparee'].includes(i.status) ? html`<button class="btn btn-danger btn-sm" data-action="item-status" data-id="${i.id}" data-status="annulee" data-confirm="Annuler cette vente ? Le stock sera remis.">Annuler</button>` : ''}
      </div>
    </div>`)}`;
  },

  /* ───── Tous les comptes ───── */
  async infos() {
    const u = state.user;
    return html`<div class="grid grid-2">
      <form class="card" data-form="me"><h2 style="font-size:1.3rem">Mes informations</h2>
        <div class="field"><label>Nom</label><input name="name" value="${u.name}" required maxlength="80"></div>
        <div class="field"><label>E-mail</label><input value="${u.email}" disabled></div>
        <div class="row"><div class="field"><label>Téléphone</label><input name="phone" type="tel" value="${u.phone}"></div>
          <div class="field"><label>Commune</label><select name="commune">${communeOptions(u.commune)}</select></div></div>
        <button class="btn btn-primary" type="submit">Enregistrer</button></form>
      <div>
        <form class="card" data-form="password" style="margin-bottom:22px"><h2 style="font-size:1.3rem">Mot de passe</h2>
          <div class="field"><label>Mot de passe actuel</label><input name="current" type="password" required autocomplete="current-password"></div>
          <div class="field"><label>Nouveau mot de passe</label><input name="next" type="password" required minlength="8" autocomplete="new-password"></div>
          <button class="btn btn-primary" type="submit">Changer</button></form>
        <button class="btn btn-ghost" data-action="logout">Se déconnecter</button>
      </div></div>`;
  },

  /* ───── Administration ───── */
  async stats() {
    const s = await get('/api/admin/stats');
    const cells = [['Comptes', s.users], ['Clientes', s.clients], ['Professionnelles', s.pros], ['Magasins', s.shops], ['Réservations', s.bookings], ['Commandes', s.orders], ['Ventes ($)', s.revenue], ['Messages', s.messages]];
    return html`<div class="grid grid-4">${cells.map(([l, v]) => html`<div class="card stat"><b>${v}</b><span class="muted">${l}</span></div>`)}</div>`;
  },
  async utilisateurs() {
    const { users } = await get('/api/admin/users');
    return html`<div class="table-wrap"><table><thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Vérification</th><th></th></tr></thead><tbody>
      ${users.map((u) => html`<tr><td>${u.name}<div class="meta">${u.phone}</div></td><td>${u.email}</td><td>${u.role}</td>
        <td>${u.profile_id ? html`<button class="link-btn" data-action="verify" data-kind="profile" data-id="${u.profile_id}" data-verified="${u.profile_verified ? 0 : 1}">${u.profile_verified ? '✓ Vérifiée (retirer)' : 'Vérifier'}</button>`
          : u.shop_id ? html`<button class="link-btn" data-action="verify" data-kind="shop" data-id="${u.shop_id}" data-verified="${u.shop_verified ? 0 : 1}">${u.shop_verified ? '✓ Vérifié (retirer)' : 'Vérifier'}</button>` : '—'}</td>
        <td>${u.role !== 'admin' ? html`<button class="link-btn" style="color:var(--err)" data-action="del-user" data-id="${u.id}" data-confirm="Supprimer ${u.name} et toutes ses données ?">Supprimer</button>` : ''}</td></tr>`)}
    </tbody></table></div>`;
  },
  async messages() {
    const { contacts } = await get('/api/admin/contacts');
    if (!contacts.length) return emptyState('✉️', 'Aucun message', 'Les demandes de partenariat reçues apparaîtront ici.');
    return html`${contacts.map((c) => html`<div class="item"><div class="item-head"><strong>${c.name}</strong><span class="badge">${c.type}</span></div>
      <div class="meta"><a href="mailto:${c.email}">${c.email}</a> · ${fshort(c.created_at)}</div><p style="margin:10px 0 0;white-space:pre-line">${c.message}</p></div>`)}`;
  },
};

/* ───── Actions & formulaires ───── */
const ask = (el) => !el.dataset.confirm || confirm(el.dataset.confirm);

actions['booking-status'] = async (el) => {
  if (!ask(el)) return;
  await patch(`/api/bookings/${el.dataset.id}`, { status: el.dataset.status });
  toast('Réservation mise à jour.', 'ok');
  rerender();
};
actions['item-status'] = async (el) => {
  if (!ask(el)) return;
  await patch(`/api/order-items/${el.dataset.id}`, { status: el.dataset.status });
  toast('Commande mise à jour.', 'ok');
  rerender();
};
actions['del-service'] = async (el) => { if (!ask(el)) return; await del(`/api/my/services/${el.dataset.id}`); toast('Service supprimé.'); rerender(); };
actions['del-product'] = async (el) => { if (!ask(el)) return; await del(`/api/my/products/${el.dataset.id}`); toast('Produit supprimé.'); rerender(); };
actions.verify = async (el) => { await patch('/api/admin/verify', { kind: el.dataset.kind, id: Number(el.dataset.id), verified: el.dataset.verified === '1' }); toast('Statut mis à jour.', 'ok'); rerender(); };
actions['del-user'] = async (el) => { if (!ask(el)) return; await del(`/api/admin/users/${el.dataset.id}`); toast('Compte supprimé.'); rerender(); };

forms.review = async (d) => { await post('/api/reviews', d); toast('Merci pour votre avis !', 'ok'); rerender(); };
forms['my-profile'] = async (d) => { await put('/api/my/profile', d); toast('Profil enregistré.', 'ok'); rerender(); };
forms.service = async (d) => { await (d.id ? put(`/api/my/services/${d.id}`, d) : post('/api/my/services', d)); toast('Service enregistré.', 'ok'); rerender(); };
forms['my-shop'] = async (d) => { await put('/api/my/shop', d); toast('Boutique enregistrée.', 'ok'); rerender(); };
forms.product = async (d) => { await (d.id ? put(`/api/my/products/${d.id}`, d) : post('/api/my/products', d)); toast('Produit enregistré.', 'ok'); rerender(); };
forms.me = async (d) => {
  const r = await put('/api/me', d);
  state.user = r.user;
  toast('Informations enregistrées.', 'ok');
  rerender();
};
forms.password = async (d, form) => { await put('/api/me/password', d); form.reset(); toast('Mot de passe modifié.', 'ok'); };
