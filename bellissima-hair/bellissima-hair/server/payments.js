import crypto from 'node:crypto';
import { PAYMENT_MODE } from './config.js';

export const PAYMENT_METHODS = [
  { id: 'mpesa', label: 'M-Pesa', mobile: true },
  { id: 'airtel', label: 'Airtel Money', mobile: true },
  { id: 'orange', label: 'Orange Money', mobile: true },
  { id: 'visa', label: 'Carte Visa', mobile: false },
  { id: 'cash', label: 'Paiement sur place', mobile: false },
];

/**
 * Point d'entrée UNIQUE pour les paiements.
 *
 * En mode "simulation" (PAYMENT_MODE=simulation) : aucun argent n'est réellement débité,
 * le paiement est marqué comme réussi pour permettre de tester tout le parcours.
 *
 * Pour passer en réel : ajoutez ici l'appel à l'API de votre prestataire agréé
 * (M-Pesa Vodacom RDC, Airtel Money, Orange Money, passerelle carte...) puis mettez
 * PAYMENT_MODE=live. Le reste de l'application n'a pas besoin d'être modifié.
 *
 * @returns {{ status: 'paye'|'en_attente'|'a_payer_sur_place'|'echoue', reference: string }}
 */
export async function initiatePayment({ method, amount, phone, orderId }) {
  if (method === 'cash') return { status: 'a_payer_sur_place', reference: '' };

  if (PAYMENT_MODE === 'simulation') {
    return { status: 'paye', reference: `SIM-${orderId}-${crypto.randomBytes(3).toString('hex').toUpperCase()}` };
  }

  // PAYMENT_MODE=live : intégration prestataire à brancher ici.
  // Tant qu'elle n'est pas faite, on refuse proprement plutôt que de valider à tort.
  return { status: 'echoue', reference: '' };
}
