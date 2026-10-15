import crypto from 'node:crypto';
import { Subject } from '../models/Subject.js';
import { Slot } from '../models/Slot.js';

export const EXP = 'booking-label-v1';

export function isEnabled() {
  return process.env.AB_ENABLED !== 'false';
}

/**
 * Calcul de répartition stable A/B (Étape 2 du TP, Page 10 du cours)
 * Empreinte SHA-256 de (EXP + ":" + visitorId), lecture non signée du premier octet,
 * répartition en deux groupes égaux [0-127] -> "A", [128-255] -> "B".
 */
export function variantFor(visitorId) {
  const hash = crypto.createHash('sha256').update(`${EXP}:${visitorId}`).digest();
  const bucket = hash[0]; // Entier non signé de 0 à 255
  return bucket < 128 ? 'A' : 'B';
}

/**
 * Recherche d'un sujet par son visitorId (avec validation du format UUID)
 */
export async function find(visitorId) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!visitorId || !uuidRegex.test(visitorId)) {
    return null;
  }
  return await Subject.findById(`${EXP}:${visitorId}`);
}

/**
 * Affectation stable d'un visiteur : réutilise l'existant ou génère un nouveau profil
 */
export async function assign(visitorId) {
  const existing = await find(visitorId);
  if (existing) {
    return existing;
  }

  const newVisitorId = crypto.randomUUID();
  const variant = variantFor(newVisitorId);

  const subject = new Subject({
    _id: `${EXP}:${newVisitorId}`,
    experimentId: EXP,
    visitorId: newVisitorId,
    variant,
    exposed: false,
    exposedAt: null
  });

  return await subject.save();
}

/**
 * Déclaration d'exposition atomique et idempotente (Étape 4 du TP, Page 20 du cours)
 * Ne modifie que si exposed est encore false. Préserve l'horodatage initial si déjà exposé.
 */
export async function expose(visitorId) {
  const subject = await find(visitorId);
  if (!subject) {
    const error = new Error('Affectation requise');
    error.status = 409;
    throw error;
  }

  await Subject.updateOne(
    { _id: subject._id, exposed: false },
    { $set: { exposed: true, exposedAt: new Date() } }
  );
}

/**
 * Attribution de la réservation à l'expérience si réalisée dans la fenêtre de 24h
 */
export async function attribution(visitorId) {
  if (!isEnabled()) return null;
  const subject = await find(visitorId);
  if (!subject || !subject.exposed || !subject.exposedAt) {
    return null;
  }

  const now = new Date();
  const windowLimit = new Date(subject.exposedAt.getTime() + 24 * 60 * 60 * 1000);
  if (now < subject.exposedAt || now > windowLimit) {
    return null;
  }

  return subject;
}

/**
 * Calcul des indicateurs A/B agrégés avec dédoublonnage strict des visiteurs convertis
 */
export async function getMetrics() {
  const result = [];
  for (const v of ['A', 'B']) {
    const assigned = await Subject.countDocuments({ experimentId: EXP, variant: v });

    const exposedSubjects = await Subject.find(
      { experimentId: EXP, variant: v, exposed: true },
      { _id: 1 }
    );
    const exposedIds = exposedSubjects.map(s => s._id);
    const exposed = exposedIds.length;

    let converted = 0;
    if (exposedIds.length > 0) {
      const distinctSubjects = await Slot.distinct('subjectId', {
        experimentId: EXP,
        status: 'BOOKED',
        subjectId: { $in: exposedIds }
      });
      converted = distinctSubjects.length;
    }

    const rate = exposed === 0 ? null : converted / exposed;
    result.push({
      variant: v,
      assigned,
      exposed,
      converted,
      rate
    });
  }
  return result;
}
