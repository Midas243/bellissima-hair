// Supprime toutes les données de démonstration (comptes, produits, avis, publications d'exemple)
import { db } from '../server/db.js';
import { DEMO_DOMAIN } from '../server/seed.js';

const titles = ['Protéger vos tresses la nuit', 'Les coiffures qui font la différence cette saison', 'Atelier d’initiation à la tresse',
  'Devenir revendeuse de produits capillaires', 'Bons plans du mois'];
db.prepare(`DELETE FROM posts WHERE title IN (${titles.map(() => '?').join(',')})`).run(...titles);
const r = db.prepare('DELETE FROM users WHERE email LIKE ?').run(`%${DEMO_DOMAIN}`);
console.log(`Données de démonstration supprimées (${r.changes} comptes).`);
