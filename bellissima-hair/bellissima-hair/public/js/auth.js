import { html, raw, route, post, forms, actions, go, state, setSession, toast } from './core.js';
import { communeOptions } from './ui.js';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/compte');
let nextAfterAuth = '/compte';

route('/connexion', ({ query }) => {
  if (state.user) { go('/compte'); return html``; }
  nextAfterAuth = safeNext(query.next);
  return html`<div class="container section"><div class="narrow">
    <h1>Connexion</h1>
    <p class="muted">Retrouvez vos réservations, commandes et votre espace professionnel.</p>
    <form class="card" data-form="login">
      <div class="field"><label for="l-mail">E-mail</label><input id="l-mail" name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="l-pwd">Mot de passe</label><input id="l-pwd" name="password" type="password" required autocomplete="current-password"></div>
      <button class="btn btn-primary btn-block" type="submit">Se connecter</button>
    </form>
    <p class="center" style="margin-top:18px">Pas encore de compte ? <a href="#/inscription${query.next ? '?next=' + encodeURIComponent(query.next) : ''}">Rejoindre Bellissima</a></p>
  </div></div>`;
});

const ROLES = [
  ['client', '💁🏾‍♀️ Cliente — je cherche une coiffure ou des produits'],
  ['tresseuse', '✂️ Tresseuse — je propose mes services'],
  ['salon', '🏪 Salon de coiffure'],
  ['magasin', '🛍️ Magasin — je vends des produits capillaires'],
];

route('/inscription', ({ query }) => {
  if (state.user) { go('/compte'); return html``; }
  nextAfterAuth = safeNext(query.next);
  const role = ROLES.some(([r]) => r === query.role) ? query.role : 'client';
  return html`<div class="container section"><div class="narrow">
    <h1>Rejoindre Bellissima</h1>
    <p class="muted">Créez votre compte gratuitement en une minute.</p>
    <form class="card" data-form="register">
      <div class="field"><label for="r-role">Je suis</label>
        <select id="r-role" name="role" data-register-role>${ROLES.map(([v, l]) => html`<option value="${v}" ${v === role ? raw('selected') : ''}>${l}</option>`)}</select></div>
      <div class="field"><label for="r-name">Votre nom</label><input id="r-name" name="name" required minlength="2" maxlength="80" autocomplete="name"></div>
      <div class="field" id="r-biz" ${role === 'client' ? 'hidden' : ''}><label for="r-biz-in">Nom de l’établissement ou du magasin</label><input id="r-biz-in" name="business_name" maxlength="100" placeholder="Laissez vide pour utiliser votre nom"></div>
      <div class="field"><label for="r-mail">E-mail</label><input id="r-mail" name="email" type="email" required autocomplete="email"></div>
      <div class="row">
        <div class="field"><label for="r-phone">Téléphone <span class="muted" id="r-phone-opt">${role === 'client' ? '(facultatif)' : ''}</span></label><input id="r-phone" name="phone" type="tel" placeholder="+243 81 234 5678" ${role === 'client' ? '' : 'required'} autocomplete="tel"></div>
        <div class="field"><label for="r-commune">Commune</label><select id="r-commune" name="commune">${communeOptions('')}</select></div>
      </div>
      <div class="field"><label for="r-pwd">Mot de passe</label><input id="r-pwd" name="password" type="password" required minlength="8" autocomplete="new-password"><small>8 caractères minimum.</small></div>
      <button class="btn btn-primary btn-block" type="submit">Créer mon compte</button>
    </form>
    <p class="center" style="margin-top:18px">Déjà inscrite ? <a href="#/connexion">Se connecter</a></p>
  </div></div>`;
});

document.addEventListener('change', (e) => {
  if (!e.target.matches('[data-register-role]')) return;
  const pro = e.target.value !== 'client';
  document.getElementById('r-biz').hidden = !pro;
  document.getElementById('r-phone').required = pro;
  document.getElementById('r-phone-opt').textContent = pro ? '' : '(facultatif)';
});

async function done(r, welcome) {
  setSession(r.token, r.user);
  toast(welcome, 'ok');
  go(nextAfterAuth);
}

forms.login = async (d) => {
  const r = await post('/api/auth/login', d);
  await done(r, `Bienvenue ${r.user.name.split(' ')[0]} 👋`);
};
forms.register = async (d) => {
  const r = await post('/api/auth/register', d);
  const next = r.user.role === 'client' ? nextAfterAuth : r.user.role === 'magasin' ? '/compte/produits' : '/compte/services';
  nextAfterAuth = next;
  await done(r, 'Compte créé. Bienvenue sur Bellissima Hair !');
};

actions.logout = () => {
  setSession(null, null);
  toast('Vous êtes déconnectée.');
  go('/');
};
