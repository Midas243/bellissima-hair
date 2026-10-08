import crypto from 'node:crypto';
import { db, tx } from './db.js';
import { hashPassword } from './auth.js';
import { SEED_DEMO } from './config.js';

export const DEMO_DOMAIN = '@demo.bellissima';

async function ensureAdmin() {
  if (db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) return;
  const mail = (process.env.ADMIN_EMAIL || 'admin@bellissima.local').toLowerCase();
  let pwd = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!pwd || pwd.length < 8) {
    pwd = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }
  db.prepare("INSERT INTO users (name, email, password_hash, role, commune) VALUES (?,?,?,'admin','Gombe')")
    .run('Administrateur', mail, await hashPassword(pwd));
  console.log(`\n  Compte administrateur créé : ${mail}`);
  if (generated) console.log(`  Mot de passe généré (notez-le, il ne sera plus affiché) : ${pwd}`);
  console.log('');
}

const PRO_DEMO = [
  { name: 'Mireille Kabongo', kind: 'tresseuse', commune: 'Limete', home: 1, tel: '+243 81 100 0001',
    bio: 'Tresseuse indépendante depuis 8 ans. Je me déplace chez vous à Limete, Matete et Gombe. Finitions soignées et produits de qualité.',
    spec: 'Tresses africaines, Vanilles, Box braids',
    services: [['Box braids', 35, 240], ['Vanilles', 20, 120], ['Tresses collées (cornrows)', 15, 90]] },
  { name: 'Salon Élégance Royale', kind: 'salon', commune: 'Gombe', home: 0, tel: '+243 81 100 0002',
    bio: 'Salon de coiffure moderne en plein cœur de la Gombe. Coiffure, soins, tissages et mariages. Sur rendez-vous.',
    spec: 'Tissages, Soins, Coiffure de mariage',
    services: [['Tissage complet', 45, 180], ['Soin profond hydratant', 18, 60], ['Coiffure de mariage', 80, 150]] },
  { name: 'Chantal Mbuyi', kind: 'tresseuse', commune: 'Ngaliema', home: 1, tel: '+243 81 100 0003',
    bio: 'Spécialiste des coiffures protectrices pour enfants et adultes. Déplacement à domicile à Ngaliema et Binza.',
    spec: 'Coiffures enfants, Twists, Nattes',
    services: [['Twists sénégalais', 30, 180], ['Nattes enfants', 10, 60], ['Fulani braids', 40, 210]] },
  { name: 'Beauty Corner Kintambo', kind: 'salon', commune: 'Kintambo', home: 1, tel: '+243 81 100 0004',
    bio: 'Salon convivial : pose de perruques, lissage, coloration et soins. Possibilité de venir chez vous pour les mariages.',
    spec: 'Perruques, Lissage, Coloration',
    services: [['Pose de perruque (lace)', 25, 90], ['Lissage brésilien', 55, 150], ['Coloration', 30, 120]] },
  { name: 'Grâce Tshimanga', kind: 'tresseuse', commune: 'Lemba', home: 1, tel: '+243 81 100 0005',
    bio: 'Passionnée de tresses et de beauté naturelle. Je prépare aussi vos cheveux pour les grandes occasions.',
    spec: 'Cheveux naturels, Locks, Tresses',
    services: [['Départ de locks', 50, 240], ['Tresses plaquées', 12, 75]] },
];

const SHOP_DEMO = [
  { name: 'Mèches & Co Kinshasa', commune: 'Kasa-Vubu', tel: '+243 82 200 0001', desc: 'Importateur de mèches, perruques et accessoires. Vente en détail et en gros.',
    products: [
      ['Mèches synthétiques x-pression', 'Mèches', 3, 2.2, 20, 120, 'Mèches souples idéales pour box braids et twists. Coloris noir, brun, bordeaux.'],
      ['Perruque lace frontale 14"', 'Perruques', 65, 52, 5, 18, 'Perruque cheveux naturels lisses, lace frontale pré-épilée.'],
      ['Mèches naturelles 3 paquets', 'Mèches', 85, 70, 5, 30, 'Tissage naturel de qualité, longueur 16 pouces.'],
      ['Peigne démêlant', 'Accessoires', 2.5, 1.6, 24, 200, 'Peigne à dents larges pour cheveux crépus.'],
    ] },
  { name: 'Afro Care Limete', commune: 'Limete', tel: '+243 82 200 0002', desc: 'Soins capillaires naturels : huiles, beurres et shampoings pour cheveux crépus et bouclés.',
    products: [
      ['Huile de ricin pure 100 ml', 'Huiles', 8, 5.5, 12, 80, 'Favorise la pousse et fortifie les cheveux.'],
      ['Gel coiffant tenue forte', 'Gels', 5, 3.5, 12, 60, 'Fixation longue durée sans résidus blancs.'],
      ['Mousse définition boucles', 'Mousses', 7, 5, 12, 45, 'Définit et hydrate les boucles sans les alourdir.'],
      ['Shampoing hydratant karité', 'Shampoings', 9, 6.5, 10, 70, 'Nettoie en douceur, enrichi au beurre de karité.'],
    ] },
  { name: 'Pro Salon Supply', commune: 'Gombe', tel: '+243 82 200 0003', desc: 'Matériel et consommables pour salons : sèche-cheveux, tondeuses, capes, bacs.',
    products: [
      ['Sèche-cheveux professionnel 2200 W', 'Matériel pro', 48, 38, 3, 14, 'Moteur puissant, 2 vitesses, 3 températures.'],
      ['Lot de 12 capes de coiffure', 'Matériel pro', 30, 22, 3, 25, 'Capes imperméables ajustables.'],
      ['Bonnet de satin', 'Accessoires', 4, 2.5, 20, 150, 'Protège les cheveux pendant la nuit.'],
    ] },
];

const POSTS_DEMO = [
  ['Conseils', 'Protéger vos tresses la nuit', 'Utilisez un bonnet ou un foulard en satin pour limiter les frottements, et hydratez le cuir chevelu 2 fois par semaine avec une huile légère. Vos tresses dureront plus longtemps.'],
  ['Tendances', 'Les coiffures qui font la différence cette saison', 'Fulani braids, knotless braids et twists sénégalais restent en tête. Demandez un portfolio à votre tresseuse pour trouver le style qui vous convient.'],
  ['Formations', 'Atelier d’initiation à la tresse', 'Un atelier pratique est prévu à Kinshasa pour les débutantes qui veulent apprendre les bases de la tresse et lancer leur activité. Inscriptions bientôt ouvertes.'],
  ['Opportunités', 'Devenir revendeuse de produits capillaires', 'Les boutiques partenaires proposent des tarifs de gros dès une certaine quantité. Une bonne façon de démarrer votre commerce avec un petit capital.'],
  ['Promotions', 'Bons plans du mois', 'Retrouvez ici les promotions des salons et boutiques partenaires. Suivez la communauté pour ne rien manquer.'],
];

async function seedDemo() {
  if (db.prepare('SELECT 1 FROM users WHERE email LIKE ?').get(`%${DEMO_DOMAIN}`)) return;
  if (db.prepare('SELECT 1 FROM profiles LIMIT 1').get() || db.prepare('SELECT 1 FROM shops LIMIT 1').get()) return;

  const lock = () => hashPassword(crypto.randomBytes(24).toString('hex')); // comptes de démo non connectables
  const prepared = [];
  for (let i = 0; i < PRO_DEMO.length + SHOP_DEMO.length + 3; i++) prepared.push(await lock());

  tx(() => {
    let h = 0;
    const mkUser = (name, mail, tel, role, commune) => Number(db.prepare(
      'INSERT INTO users (name, email, phone, password_hash, role, commune) VALUES (?,?,?,?,?,?)',
    ).run(name, mail + DEMO_DOMAIN, tel, prepared[h++], role, commune).lastInsertRowid);

    const clients = ['Nadège L.', 'Sarah M.', 'Prisca K.'].map((n, i) => mkUser(n, `client${i + 1}`, '', 'client', 'Gombe'));

    PRO_DEMO.forEach((p, i) => {
      const uid = mkUser(p.name, `pro${i + 1}`, p.tel, p.kind, p.commune);
      const pid = Number(db.prepare(`INSERT INTO profiles (user_id, kind, display_name, bio, commune, home_service, phone, specialties, verified)
        VALUES (?,?,?,?,?,?,?,?,1)`).run(uid, p.kind, p.name, p.bio, p.commune, p.home, p.tel, p.spec).lastInsertRowid);
      for (const [n, price, dur] of p.services) {
        db.prepare('INSERT INTO services (profile_id, name, price, duration_min) VALUES (?,?,?,?)').run(pid, n, price, dur);
      }
      const comments = ['Très professionnelle, résultat parfait !', 'Ponctuelle et soignée, je recommande.', 'Super travail, mes tresses ont tenu longtemps.'];
      clients.forEach((c, k) => {
        db.prepare('INSERT INTO reviews (profile_id, client_id, rating, comment) VALUES (?,?,?,?)').run(pid, c, k === 2 ? 4 : 5, comments[(i + k) % 3]);
      });
    });

    SHOP_DEMO.forEach((s, i) => {
      const uid = mkUser(s.name, `shop${i + 1}`, s.tel, 'magasin', s.commune);
      const sid = Number(db.prepare('INSERT INTO shops (user_id, name, description, commune, phone, verified) VALUES (?,?,?,?,?,1)')
        .run(uid, s.name, s.desc, s.commune, s.tel).lastInsertRowid);
      for (const [n, cat, retail, whole, wmin, stock, desc] of s.products) {
        db.prepare(`INSERT INTO products (shop_id, name, category, description, price_retail, price_wholesale, wholesale_min, stock)
          VALUES (?,?,?,?,?,?,?,?)`).run(sid, n, cat, desc, retail, whole, wmin, stock);
      }
    });

    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    const author = admin ? admin.id : clients[0];
    POSTS_DEMO.forEach(([cat, title, body]) => {
      db.prepare('INSERT INTO posts (author_id, category, title, body) VALUES (?,?,?,?)').run(author, cat, title, body);
    });
  });
  console.log('  Données de démonstration ajoutées (supprimables avec : npm run purge-demo)');
}

export async function seed() {
  await ensureAdmin();
  if (SEED_DEMO) await seedDemo();
}
