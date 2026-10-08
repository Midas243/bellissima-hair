import { html, route, get, post, del, forms, actions, state, toast, fshort, rerender } from './core.js';
import { emptyState } from './ui.js';

const ROLE_LABEL = { tresseuse: 'Tresseuse', salon: 'Salon', magasin: 'Magasin', admin: 'Équipe Bellissima', client: 'Membre' };

route('/communaute', async ({ query }) => {
  const cat = query.category || '';
  const { posts } = await get(`/api/posts${cat ? '?category=' + encodeURIComponent(cat) : ''}`);
  const canPost = ['tresseuse', 'salon', 'magasin', 'admin'].includes(state.user?.role);
  const cats = state.meta.postCategories;
  return html`<div class="container">
    <div class="page-head">
      <h1>La communauté Bellissima</h1>
      <p>Plus qu’une plateforme de coiffure : un espace où les femmes peuvent découvrir, apprendre, entreprendre et prendre soin d’elles.</p>
      <div class="chips">
        <a class="chip ${cat ? '' : 'active'}" href="#/communaute">Tout</a>
        ${cats.map((c) => html`<a class="chip ${cat === c ? 'active' : ''}" href="#/communaute?category=${encodeURIComponent(c)}">${c}</a>`)}
      </div>
    </div>
    <div class="pro-layout" style="margin-bottom:64px">
      <div>
        ${posts.length ? posts.map((p) => html`<article class="card post">
          <div class="meta"><span class="badge">${p.category}</span><span>${p.author} · ${ROLE_LABEL[p.author_role]}</span><span>${fshort(p.created_at)}</span></div>
          <h3>${p.title}</h3>
          <p>${p.body}</p>
          ${state.user && (state.user.id === p.author_id || state.user.role === 'admin') ? html`<button class="link-btn" data-action="del-post" data-id="${p.id}">Supprimer</button>` : ''}
        </article>`) : emptyState('✨', 'Rien ici pour le moment', 'Les conseils, tendances et bons plans apparaîtront ici.')}
      </div>
      <aside class="sticky">
        ${canPost ? html`<form class="card" data-form="post">
          <h2 style="font-size:1.3rem">Publier</h2>
          <div class="field"><label for="p-cat">Catégorie</label><select id="p-cat" name="category">${cats.map((c) => html`<option>${c}</option>`)}</select></div>
          <div class="field"><label for="p-title">Titre</label><input id="p-title" name="title" required maxlength="120"></div>
          <div class="field"><label for="p-body">Contenu</label><textarea id="p-body" name="body" required minlength="10" maxlength="3000"></textarea></div>
          <button class="btn btn-primary btn-block" type="submit">Publier</button>
        </form>` : html`<div class="card"><h2 style="font-size:1.3rem">Vous êtes professionnelle ?</h2><p class="muted">Partagez vos conseils, formations et promotions avec la communauté.</p>
          <a class="btn btn-primary btn-block" href="${state.user ? '#/compte' : '#/inscription?role=tresseuse'}">${state.user ? 'Mon espace' : 'Rejoindre'}</a></div>`}
      </aside>
    </div>
  </div>`;
});

forms.post = async (d, form) => {
  await post('/api/posts', d);
  toast('Publication ajoutée.', 'ok');
  rerender();
};
actions['del-post'] = async (el) => {
  if (!confirm('Supprimer cette publication ?')) return;
  await del(`/api/posts/${el.dataset.id}`);
  toast('Publication supprimée.');
  rerender();
};

/* ───── Professionnelles ───── */
route('/professionnelles', () => html`<div class="container">
  <div class="page-head"><h1>Vous êtes une professionnelle ?</h1>
    <p>Bellissima Hair veut créer des opportunités pour celles qui font vivre le secteur de la beauté.</p></div>
  <div class="grid grid-3" style="margin-bottom:40px">
    <div class="card"><span class="emoji">💁🏾‍♀️</span><h3>Je suis tresseuse</h3><p class="muted">Créez votre profil, montrez votre travail et recevez des réservations.</p><a class="btn btn-primary btn-sm" href="#/inscription?role=tresseuse">Rejoindre</a></div>
    <div class="card"><span class="emoji">🏪</span><h3>Je suis un salon</h3><p class="muted">Présentez votre établissement et développez votre clientèle.</p><a class="btn btn-primary btn-sm" href="#/inscription?role=salon">Inscrire mon salon</a></div>
    <div class="card"><span class="emoji">🛍️</span><h3>Je suis un magasin</h3><p class="muted">Vendez vos produits capillaires en gros et au détail sur Bellissima Boutique.</p><a class="btn btn-primary btn-sm" href="#/inscription?role=magasin">Devenir vendeur</a></div>
  </div>
  <div class="card" style="margin-bottom:64px"><h2 style="font-size:1.4rem">Ce que vous obtenez</h2>
    <div class="grid grid-3">
      <div><h3>Un profil public</h3><p class="muted">Services, tarifs, zone, service à domicile et avis de vos clientes.</p></div>
      <div><h3>Des réservations</h3><p class="muted">Recevez les demandes, confirmez-les et évitez les doubles réservations.</p></div>
      <div><h3>Des fournisseurs</h3><p class="muted">Achetez vos produits au tarif de gros auprès des magasins partenaires.</p></div>
    </div></div>
</div>`);

/* ───── Contact / partenariat ───── */
route('/contact', () => html`<div class="container section">
  <div class="narrow">
    <h1>Construisons Bellissima Hair ensemble.</h1>
    <p class="muted">Le projet est pensé pour commencer à Kinshasa puis évoluer vers d’autres villes et marchés. Écrivez-nous pour collaborer.</p>
    <form class="card" data-form="contact">
      <div class="field"><label for="k-name">Nom</label><input id="k-name" name="name" required maxlength="80" autocomplete="name"></div>
      <div class="field"><label for="k-mail">E-mail</label><input id="k-mail" name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="k-type">Motif</label><select id="k-type" name="type"><option value="partenaire">Devenir partenaire</option><option value="collaboration">Collaborer</option><option value="question">Une question</option></select></div>
      <div class="field"><label for="k-msg">Message</label><textarea id="k-msg" name="message" required minlength="10" maxlength="2000"></textarea></div>
      <button class="btn btn-primary btn-block" type="submit">Envoyer</button>
    </form>
  </div>
</div>`);

forms.contact = async (d, form) => {
  await post('/api/contact', d);
  form.reset();
  toast('Message envoyé. Nous vous répondrons par e-mail.', 'ok');
};

/* ───── FAQ ───── */
const FAQ = [
  ['Comment réserver une tresseuse ou un salon ?', 'Cherchez dans « Services », ouvrez un profil, choisissez un service, une date et une heure, puis envoyez la demande. La professionnelle la confirme ; vous la suivez dans votre espace.'],
  ['Puis-je me faire coiffer à domicile ?', 'Oui, lorsque la professionnelle propose le service à domicile (badge 🏠). Vous indiquez votre adresse au moment de la réservation.'],
  ['Comment payer ?', 'Les prestations se règlent directement auprès de la professionnelle. Dans la boutique, vous pouvez choisir M-Pesa, Airtel Money, Orange Money, carte Visa ou le paiement sur place.'],
  ['Qu’est-ce que le tarif de gros ?', 'Les comptes professionnels (tresseuses, salons, magasins) bénéficient automatiquement du prix de gros dès la quantité minimale fixée par le vendeur.'],
  ['Comment vendre mes produits ?', 'Créez un compte « magasin », complétez votre fiche puis ajoutez vos produits avec prix de détail, prix de gros et stock.'],
  ['Mes données sont-elles protégées ?', 'Les mots de passe sont chiffrés et vos informations ne sont partagées qu’avec la professionnelle ou le vendeur concerné par votre réservation ou commande.'],
];
route('/faq', () => html`<div class="container section"><div class="narrow" style="max-width:720px">
  <h1>Questions fréquentes</h1>
  <div class="faq">${FAQ.map(([q, a]) => html`<details><summary>${q}</summary><p>${a}</p></details>`)}</div>
  <p style="margin-top:24px"><a class="btn btn-ghost" href="#/contact">Une autre question ?</a></p>
</div></div>`);
