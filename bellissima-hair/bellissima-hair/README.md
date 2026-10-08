# Bellissima Hair

Plateforme beauté pour les femmes de Kinshasa : tresseuses, salons, boutique de produits capillaires (détail et gros) et communauté.

**Aucune dépendance à installer** : le projet utilise uniquement Node.js 22 (serveur HTTP et base SQLite intégrés). Pas de `npm install`, pas de service externe.

## Ce que fait le site

| Côté | Fonctionnalités |
|---|---|
| **Cliente** | Rechercher tresseuses/salons (type, commune, à domicile, prix, notes), réserver un créneau (au salon ou à domicile), suivre/annuler, laisser un avis, acheter dans la boutique, suivre ses commandes |
| **Tresseuse / Salon** | Profil public (photo, présentation, spécialités, zone), services et tarifs, réception des demandes (confirmer / refuser / terminer), anti double-réservation, achats au tarif de gros |
| **Magasin** | Fiche boutique, produits (prix de détail + prix de gros + quantité minimale + stock), suivi des ventes (préparée → expédiée → livrée) |
| **Communauté** | Conseils, tendances, formations, opportunités, promotions (publiés par les professionnelles et l'équipe) |
| **Administrateur** | Statistiques, vérification des profils/magasins (badge ✓), gestion des comptes, messages de partenariat |
| **Paiement** | M-Pesa, Airtel Money, Orange Money, Visa, sur place — **en mode simulation** (voir plus bas) |

## Lancer en local (2 minutes)

```bash
node -v            # doit afficher v22.13 ou plus
cp .env.example .env
# modifiez ADMIN_EMAIL et ADMIN_PASSWORD dans .env
npm start
```

Ouvrez http://localhost:3000. Au premier démarrage, le compte administrateur et des données de démonstration sont créés.

## Mettre en ligne (la seule chose à faire)

Le site a besoin d'**un hébergeur Node.js 22+ avec un disque persistant** (la base de données est un fichier). Trois options :

### Option A — Render.com (le plus simple)
1. Mettez le dossier sur GitHub.
2. Sur Render : *New → Blueprint*, sélectionnez le dépôt (le fichier `render.yaml` configure tout, disque inclus).
3. Renseignez `ADMIN_EMAIL` et `ADMIN_PASSWORD`. C'est en ligne.

### Option B — Railway / Fly.io / tout hébergeur Docker
Utilisez le `Dockerfile` fourni. **Attachez un volume persistant monté sur `/app/data`** (sinon la base est effacée à chaque redéploiement). Définissez `ADMIN_EMAIL` et `ADMIN_PASSWORD`.

### Option C — Serveur VPS (Ubuntu)
```bash
# Installez Node 22 (nvm ou NodeSource), puis :
git clone <votre-depot> bellissima && cd bellissima
cp .env.example .env && nano .env
npm install -g pm2
pm2 start server/index.js --name bellissima && pm2 save && pm2 startup
```
Placez Caddy ou Nginx devant (port 3000) pour le HTTPS. Avec Caddy : `votredomaine.com { reverse_proxy localhost:3000 }`.

> **HTTPS obligatoire en production** (Render, Railway, Fly et Caddy le fournissent automatiquement).
> **Une seule instance** : SQLite ne se partage pas entre plusieurs serveurs. C'est largement suffisant pour démarrer.

## Après la mise en ligne

1. Connectez-vous avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Sans mot de passe défini, il est affiché **une seule fois** dans les journaux du premier démarrage.
2. **Supprimez les données de démonstration** avant le lancement public : `npm run purge-demo` (ou `SEED_DEMO=false` *avant* le premier démarrage).
3. Dans *Administration → Utilisateurs*, cliquez sur **Vérifier** pour attribuer le badge ✓ aux professionnelles et magasins sérieux.
4. **Sauvegardes** : copiez régulièrement le dossier `data/` (fichier `bellissima.db`).

## Brancher les vrais paiements

Aujourd'hui `PAYMENT_MODE=simulation` : **aucun argent n'est débité**, le paiement est simplement marqué « payé ». Le site l'indique à la cliente.

Pour passer en réel, il faut un contrat avec un prestataire agréé (M-Pesa Vodacom RDC, Airtel Money, Orange Money, passerelle carte). Ensuite, **un seul fichier à modifier** : `server/payments.js`, fonction `initiatePayment()`. Ajoutez l'appel à l'API du prestataire, puis mettez `PAYMENT_MODE=live`. Tant que ce n'est pas fait, le mode `live` refuse les paiements au lieu de les valider à tort.

## Structure

```
server/
  index.js      serveur HTTP, sécurité, limitation de débit, fichiers statiques
  routes.js     toute l'API REST (/api/...)
  db.js         schéma SQLite
  auth.js       mots de passe (scrypt) et sessions signées
  payments.js   point d'intégration des paiements
  seed.js       compte admin + données de démonstration
public/
  index.html, css/style.css
  js/           une page par fichier (home, services, shop, community, auth, account)
scripts/
  smoke-test.js test de bout en bout (npm test)
  purge-demo.js suppression des données de démonstration
```

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port d'écoute | 3000 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Compte admin créé au 1er démarrage | généré |
| `SECRET` | Clé de signature des sessions | générée dans `data/` |
| `DATA_DIR` | Dossier de la base | `./data` |
| `SEED_DEMO` | Données de démonstration | `true` |
| `PAYMENT_MODE` | `simulation` ou `live` | `simulation` |
| `DELIVERY_FEE` | Frais de livraison (USD) | 3 |
| `TRUST_PROXY` | `1` derrière un proxy (lecture de la vraie IP) | 0 |

## Tests

`npm test` lance 33 vérifications de bout en bout (inscriptions, réservations et conflits de créneaux, stock, tarifs de gros, droits d'accès, sécurité).

## Ce qui n'est pas inclus dans cette V1

- **Transport / VTC** : la maquette mentionne « Mobilité ». La V1 propose le service **à domicile** (la professionnelle se déplace). Un vrai service de transport est un projet à part.
- **E-mails / SMS** : les notifications se voient dans l'espace personnel, et un lien WhatsApp permet de contacter directement.
- **Téléversement de photos** : les photos se renseignent par lien `https://`. L'envoi d'images pourra s'ajouter ensuite.
- **Mot de passe oublié** : nécessite l'envoi d'e-mails. En attendant, l'administrateur peut supprimer un compte pour que la personne se réinscrive.
