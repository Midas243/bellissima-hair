import { html, raw, route, get, post, forms, actions, go, state, toast, money, fdate, stars, waLink, rerender } from './core.js';
import { proCard, avatar, ratingLine, communeOptions, emptyState, KIND_LABEL } from './ui.js';

forms.filters = (data) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) if (v && v !== false) qs.set(k, v === true ? '1' : v);
  go(`/services${qs.toString() ? '?' + qs : ''}`);
};

route('/services', async ({ query }) => {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v));
  const { pros } = await get(`/api/pros?${qs}`);
  const sel = (a, b) => (a === b ? raw('selected') : '');
  return html`<div class="container">
    <div class="page-head">
      <h1>Trouvez votre professionnelle</h1>
      <p>Comparez les tresseuses et salons de Kinshasa : tarifs, avis, disponibilités et service à domicile.</p>
    </div>
    <form class="filters" data-form="filters" data-autosubmit role="search">
      <div class="row">
        <div class="field"><label for="f-q">Recherche</label><input id="f-q" name="q" type="search" value="${query.q || ''}" placeholder="Box braids, tissage, perruque…"></div>
        <div class="field"><label for="f-kind">Type</label>
          <select id="f-kind" name="kind"><option value="">Tous</option><option value="tresseuse" ${sel(query.kind, 'tresseuse')}>Tresseuses</option><option value="salon" ${sel(query.kind, 'salon')}>Salons</option></select></div>
        <div class="field"><label for="f-commune">Commune</label><select id="f-commune" name="commune">${communeOptions(query.commune, 'Toutes les communes')}</select></div>
        <div class="field"><label for="f-sort">Trier par</label>
          <select id="f-sort" name="sort"><option value="">Pertinence</option><option value="note" ${sel(query.sort, 'note')}>Mieux notées</option><option value="prix" ${sel(query.sort, 'prix')}>Prix croissant</option></select></div>
        <div class="field"><label class="check"><input type="checkbox" name="home" ${query.home === '1' ? raw('checked') : ''}> 🏠 À domicile</label></div>
        <div class="field"><button class="btn btn-primary btn-block" type="submit">Rechercher</button></div>
      </div>
    </form>
    <p class="muted" aria-live="polite">${pros.length} résultat${pros.length > 1 ? 's' : ''}</p>
    ${pros.length
      ? html`<div class="grid grid-3" style="margin-bottom:64px">${pros.map(proCard)}</div>`
      : html`<div style="margin-bottom:64px">${emptyState('🔎', 'Aucun résultat', 'Essayez un autre mot-clé ou retirez des filtres.', html`<a class="btn btn-ghost" href="#/services">Réinitialiser</a>`)}</div>`}
  </div>`;
});

const SLOTS = [];
for (let h = 7; h <= 20; h++) for (const m of ['00', '30']) SLOTS.push(`${String(h).padStart(2, '0')}:${m}`);
const todayKin = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);

route('/pro/:id', async ({ params, query }) => {
  const { pro, services, reviews } = await get(`/api/pros/${params.id}`);
  const preselect = Number(query.service) || services[0]?.id;
  const own = state.user && state.user.profile_id === pro.id;

  return html`<div class="container">
    <p style="margin:24px 0 0"><a href="#/services">← Retour aux résultats</a></p>
    <div class="pro-layout" style="margin:20px 0 64px">
      <div>
        <div class="card" style="margin-bottom:22px">
          <div class="pro-top" style="gap:20px;align-items:flex-start">
            ${avatar(pro.display_name, pro.image_url, true)}
            <div>
              <h1 style="font-size:1.9rem;margin-bottom:6px">${pro.display_name}</h1>
              <div class="meta" style="margin-bottom:8px">
                <span class="badge">${KIND_LABEL[pro.kind]}</span>
                ${pro.verified ? html`<span class="badge badge-ok">✓ Vérifiée</span>` : ''}
                ${pro.home_service ? html`<span class="badge">🏠 À domicile</span>` : ''}
              </div>
              <div class="meta"><span>📍 ${[pro.address, pro.commune].filter(Boolean).join(', ') || 'Kinshasa'}</span>${ratingLine(pro.rating, pro.review_count)}</div>
            </div>
          </div>
          ${pro.bio ? html`<p style="margin-top:18px">${pro.bio}</p>` : ''}
          ${pro.specialties ? html`<p class="muted"><strong>Spécialités :</strong> ${pro.specialties}</p>` : ''}
          ${pro.phone ? html`<a class="btn btn-ghost btn-sm" href="${waLink(pro.phone)}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>` : ''}
        </div>

        <div class="card" style="margin-bottom:22px">
          <h2 style="font-size:1.4rem">Services et tarifs</h2>
          ${services.length ? services.map((s) => html`<div class="service-row">
            <div><strong>${s.name}</strong><div class="meta">⏱ ${Math.floor(s.duration_min / 60) ? Math.floor(s.duration_min / 60) + ' h ' : ''}${s.duration_min % 60 ? (s.duration_min % 60) + ' min' : ''}</div>${s.description ? html`<div class="muted" style="font-size:.9rem">${s.description}</div>` : ''}</div>
            <div style="text-align:right"><div class="price">${money(s.price)}</div><a class="link-btn" href="#/pro/${pro.id}?service=${s.id}">Choisir</a></div>
          </div>`) : html`<p class="muted">Cette professionnelle n’a pas encore publié de services.</p>`}
        </div>

        <div class="card">
          <h2 style="font-size:1.4rem">Avis des clientes</h2>
          ${reviews.length ? reviews.map((r) => html`<div class="review"><div class="meta"><span class="stars">${stars(r.rating)}</span><strong style="color:var(--ink)">${r.author}</strong></div>${r.comment ? html`<p style="margin:6px 0 0">${r.comment}</p>` : ''}</div>`)
            : html`<p class="muted">Aucun avis pour le moment. Les avis sont publiés après une prestation terminée.</p>`}
        </div>
      </div>

      <aside class="sticky">
        <div class="card" id="reserver">
          <h2 style="font-size:1.4rem">Réserver</h2>
          ${!services.length ? html`<p class="muted">Réservation indisponible pour le moment.</p>`
            : own ? html`<p class="muted">Ceci est votre profil public. Modifiez-le depuis <a href="#/compte/profil">votre espace</a>.</p>`
            : !state.user ? html`<p class="muted">Connectez-vous pour réserver un créneau.</p><a class="btn btn-primary btn-block" href="#/connexion?next=${encodeURIComponent('/pro/' + pro.id)}">Se connecter</a><p class="center" style="margin:12px 0 0"><a href="#/inscription?next=${encodeURIComponent('/pro/' + pro.id)}">Créer un compte</a></p>`
            : html`<form data-form="booking">
              <input type="hidden" name="profile_id" value="${pro.id}">
              <div class="field"><label for="b-service">Service</label>
                <select id="b-service" name="service_id" required>${services.map((s) => html`<option value="${s.id}" ${s.id === preselect ? raw('selected') : ''}>${s.name} — ${money(s.price)}</option>`)}</select></div>
              <div class="row">
                <div class="field"><label for="b-date">Date</label><input id="b-date" name="date" type="date" min="${todayKin()}" required></div>
                <div class="field"><label for="b-time">Heure</label><select id="b-time" name="time" required>${SLOTS.map((t) => html`<option>${t}</option>`)}</select></div>
              </div>
              <div class="field"><label>Lieu</label>
                <label class="opt"><input type="radio" name="mode" value="salon" checked data-toggle-address> ${pro.kind === 'salon' ? 'Au salon' : 'Chez la tresseuse'}</label>
                ${pro.home_service ? html`<label class="opt"><input type="radio" name="mode" value="domicile" data-toggle-address> 🏠 À mon domicile</label>` : ''}
              </div>
              <div class="field" id="b-address-wrap" hidden><label for="b-address">Votre adresse</label><input id="b-address" name="address" placeholder="Avenue, numéro, quartier, commune"></div>
              <div class="field"><label for="b-note">Message (facultatif)</label><textarea id="b-note" name="note" maxlength="500" placeholder="Longueur souhaitée, modèle, précisions…"></textarea></div>
              <button class="btn btn-primary btn-block" type="submit">Envoyer la demande</button>
              <p class="muted" style="font-size:.85rem;margin:12px 0 0">Le paiement se fait directement auprès de la professionnelle. Elle confirme votre demande.</p>
            </form>`}
        </div>
      </aside>
    </div>
  </div>`;
});

// Affiche le champ adresse seulement pour « à domicile »
document.addEventListener('change', (e) => {
  if (!e.target.matches('[data-toggle-address]')) return;
  const wrap = document.getElementById('b-address-wrap');
  const dom = e.target.form.elements.mode.value === 'domicile';
  wrap.hidden = !dom;
  document.getElementById('b-address').required = dom;
});

forms.booking = async (d) => {
  await post('/api/bookings', {
    service_id: d.service_id, date: d.date, time: d.time, mode: d.mode, address: d.mode === 'domicile' ? d.address : '', note: d.note,
  });
  toast('Demande envoyée ! La professionnelle va la confirmer.', 'ok');
  go('/compte/reservations');
};
