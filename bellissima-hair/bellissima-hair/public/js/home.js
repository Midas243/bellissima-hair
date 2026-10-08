import { html, route, get, forms, go, fshort, state } from './core.js';
import { proCard, productCard } from './ui.js';

forms.hero = ({ q }) => go(`/services${q ? `?q=${encodeURIComponent(q)}` : ''}`);

route('/', async () => {
  const [{ pros }, { products }, { posts }] = await Promise.all([
    get('/api/pros?sort=note'), get('/api/products?sort=recent'), get('/api/posts?limit=3'),
  ]);

  return html`
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <span class="pill">Beauté • Confiance • Élégance</span>
        <h1>La beauté,<em>connectée.</em></h1>
        <p class="hero-lead">Bellissima Hair réunit les femmes, les tresseuses, les salons et les boutiques de produits capillaires sur une même plateforme.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/services">Découvrir Bellissima</a>
          <a class="btn btn-ghost" href="#/boutique">🛍️ Explorer la boutique</a>
        </div>
      </div>
      <div class="phone">
        <div class="phone-inner">
          <h2>Bellissima Hair</h2>
          <p class="sub">Trouvez votre beauté en quelques clics ✨</p>
          <form data-form="hero" role="search">
            <label class="sr" for="hero-q">Rechercher</label>
            <input id="hero-q" name="q" type="search" placeholder="🔎 Coiffure, tresseuse, salon, produit…" autocomplete="off">
          </form>
          <div class="tiles">
            <a class="tile" href="#/services?kind=tresseuse"><span class="emoji">💁🏾‍♀️</span>Tresseuse</a>
            <a class="tile" href="#/services?kind=salon"><span class="emoji">💇🏾‍♀️</span>Salon</a>
            <a class="tile" href="#/boutique"><span class="emoji">🛍️</span>Produits</a>
            <a class="tile" href="#/services?home=1"><span class="emoji">🚗</span>À domicile</a>
          </div>
          <div class="promise"><strong>Votre beauté, votre choix.</strong><span>Réservez • Achetez • Découvrez • Entreprenez</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="strip" aria-label="Points forts">
    <div class="container strip-grid">
      <div class="strip-item"><span class="emoji">💁🏾‍♀️</span>Tresseuses &amp; salons</div>
      <div class="strip-item"><span class="emoji">📅</span>Réservation facile</div>
      <div class="strip-item"><span class="emoji">🛍️</span>Boutique beauté</div>
      <div class="strip-item"><span class="emoji">🚗</span>Mobilité</div>
      <div class="strip-item"><span class="emoji">💳</span>Paiement flexible</div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <h2>Un espace pensé pour toutes les femmes</h2>
        <p>Une seule plateforme pour prendre soin de soi, trouver une professionnelle ou développer son activité.</p>
      </div>
      <div class="grid grid-4">
        <div class="card"><span class="emoji">💁🏾‍♀️</span><h3>Tresseuses indépendantes</h3><p class="muted">Portfolio, tarifs, disponibilités, localisation, réservation et avis.</p><a class="link-more" href="#/services?kind=tresseuse">Découvrir →</a></div>
        <div class="card"><span class="emoji">💇🏾‍♀️</span><h3>Salons de coiffure</h3><p class="muted">Présentez vos services, recevez des réservations et développez votre clientèle.</p><a class="link-more" href="#/inscription?role=salon">Pour les salons →</a></div>
        <div class="card"><span class="emoji">🏠</span><h3>Beauté à domicile</h3><p class="muted">La cliente peut choisir de faire venir la professionnelle chez elle.</p><a class="link-more" href="#/services?home=1">En savoir plus →</a></div>
        <div class="card"><span class="emoji">✨</span><h3>Inspiration beauté</h3><p class="muted">Découvrez des styles, tendances et conseils pour prendre soin de vos cheveux.</p><a class="link-more" href="#/communaute">Voir la communauté →</a></div>
      </div>
    </div>
  </section>

  ${pros.length ? html`<section class="section bg-white">
    <div class="container">
      <div class="section-head"><h2>Les mieux notées</h2><p>Des professionnelles de confiance, près de chez vous.</p></div>
      <div class="grid grid-3">${pros.slice(0, 3).map(proCard)}</div>
      <p class="center" style="margin:28px 0 0"><a class="btn btn-ghost" href="#/services">Voir toutes les professionnelles</a></p>
    </div>
  </section>` : ''}

  <section class="section steps">
    <div class="container">
      <div class="section-head"><h2>Une expérience simple</h2><p>De la recherche jusqu’au rendez-vous, Bellissima Hair rassemble les étapes essentielles.</p></div>
      <div class="grid grid-4">
        <div class="step"><div class="step-n">1</div><h3>Je recherche</h3><p>Une coiffure, une tresseuse, un salon ou un produit.</p></div>
        <div class="step"><div class="step-n">2</div><h3>Je compare</h3><p>Photos, prix, disponibilités, localisation et évaluations.</p></div>
        <div class="step"><div class="step-n">3</div><h3>Je réserve / j’achète</h3><p>Je choisis mon service ou mes produits capillaires.</p></div>
        <div class="step"><div class="step-n">4</div><h3>Je profite</h3><p>Je me rends au salon, je reçois à domicile ou je me fais livrer selon le service.</p></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <h2>🛍️ Bellissima Boutique</h2>
        <p>Un marché beauté où les magasins peuvent vendre leurs produits aux clientes en détail et aux professionnels en gros.</p>
      </div>
      <div class="grid grid-2" style="margin-bottom:32px">
        <div class="card"><h3>Pour les clientes</h3><p class="muted">Achetez vos essentiels beauté en quelques clics.</p>
          <div class="chips">${state.meta.productCategories.slice(0, 7).map((c) => html`<a class="chip" href="#/boutique?category=${encodeURIComponent(c)}">${c}</a>`)}</div>
          <p style="margin:20px 0 0"><a class="btn btn-primary btn-sm" href="#/boutique">Explorer la boutique</a></p></div>
        <div class="card"><h3>Pour les salons &amp; pros</h3><p class="muted">Commandez en quantité et trouvez des fournisseurs sur une même plateforme.</p>
          <div class="chips"><span class="chip">Tarifs de gros</span><span class="chip">Commandes en quantité</span><span class="chip">Fournisseurs</span><span class="chip">Matériel pro</span><span class="chip">Livraison</span></div>
          <p style="margin:20px 0 0"><a class="btn btn-ghost btn-sm" href="#/inscription?role=salon">Devenir acheteur pro</a></p></div>
      </div>
      ${products.length ? html`<div class="grid grid-4">${products.slice(0, 4).map(productCard)}</div>` : ''}
    </div>
  </section>

  <section class="section bg-blush">
    <div class="container pay-grid">
      <div>
        <h2>Paiement selon vos habitudes</h2>
        <p class="muted">Bellissima Hair prévoit plusieurs options pour rendre les transactions simples et accessibles.</p>
      </div>
      <div class="pay-list">
        <h3>Moyens de paiement prévus</h3>
        <div>${state.meta.paymentMethods.map((m) => html`<span class="pay-item">${m.label}</span>`)}</div>
        <p class="muted" style="font-size:.88rem;margin:8px 0 0">Les intégrations de paiement seront réalisées avec les partenaires et prestataires agréés lors du développement.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head"><h2>Vous êtes une professionnelle ?</h2><p>Bellissima Hair veut créer des opportunités pour celles qui font vivre le secteur de la beauté.</p></div>
      <div class="grid grid-3">
        <div class="card"><span class="emoji">💁🏾‍♀️</span><h3>Je suis tresseuse</h3><p class="muted">Créez votre profil, montrez votre travail et recevez des réservations.</p><a class="link-more" href="#/inscription?role=tresseuse">Rejoindre →</a></div>
        <div class="card"><span class="emoji">🏪</span><h3>Je suis un salon</h3><p class="muted">Présentez votre établissement et développez votre clientèle.</p><a class="link-more" href="#/inscription?role=salon">Inscrire mon salon →</a></div>
        <div class="card"><span class="emoji">🛍️</span><h3>Je suis un magasin</h3><p class="muted">Vendez vos produits capillaires en gros et au détail sur Bellissima Boutique.</p><a class="link-more" href="#/inscription?role=magasin">Devenir vendeur →</a></div>
      </div>
    </div>
  </section>

  <section class="section community">
    <div class="container community-grid">
      <div>
        <h2>Bienvenue dans la communauté Bellissima.</h2>
        <p style="color:#f7d8e3;font-size:1.05rem">Plus qu’une plateforme de coiffure : un espace où les femmes peuvent découvrir, apprendre, entreprendre et prendre soin d’elles.</p>
        <a class="btn btn-light" href="#/communaute">Rejoindre la communauté</a>
      </div>
      <div class="agenda">
        <h3>👑 Au programme</h3>
        ${posts.length
          ? html`<ul>${posts.map((p) => html`<li><a href="#/communaute?category=${encodeURIComponent(p.category)}"><strong>${p.title}</strong></a> <span class="muted">· ${fshort(p.created_at)}</span></li>`)}</ul>`
          : html`<ul><li>Conseils cheveux &amp; beauté</li><li>Tendances et inspirations</li><li>Formations beauté</li><li>Opportunités pour entrepreneures</li><li>Promotions &amp; bons plans</li></ul>`}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container center">
      <h2>Construisons Bellissima Hair ensemble.</h2>
      <p class="muted" style="max-width:560px;margin-inline:auto 0;margin:0 auto 24px">Le projet est pensé pour commencer à Kinshasa puis évoluer vers d’autres villes et marchés.</p>
      <a class="btn btn-primary" href="#/contact">Je souhaite collaborer</a>
    </div>
  </section>`;
});
