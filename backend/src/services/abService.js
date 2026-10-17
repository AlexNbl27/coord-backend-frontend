import crypto from 'node:crypto';
import { Subject } from '../models/Subject.js';
import { Slot } from '../models/Slot.js';
import {
  calculateConfidenceInterval,
  calculateSrm,
  calculateTwoProportionZTest
} from '../utils/abStats.js';

export const EXP = 'booking-label-v1';

export function isEnabled() {
  return process.env.AB_ENABLED !== 'false';
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Calcul de répartition stable A/B (Étape 2 du TP)
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
  if (!visitorId || !UUID_REGEX.test(visitorId)) {
    return null;
  }
  return await Subject.findById(`${EXP}:${visitorId}`);
}

/**
 * Affectation stable d'un visiteur avec écriture différée (Lazy Write)
 * Ne crée pas immédiatement de ligne en base pour éviter la saturation par des bots ou rebonds.
 * L'évaluation est déterministe et stateless en mémoire grâce au hachage salé.
 */
export async function assign(visitorId) {
  let validVisitorId = visitorId;

  if (!validVisitorId || !UUID_REGEX.test(validVisitorId)) {
    validVisitorId = crypto.randomUUID();
  } else {
    // Si déjà présent en base, on réutilise ses données existantes
    const existing = await find(validVisitorId);
    if (existing) {
      return {
        visitorId: existing.visitorId,
        variant: existing.variant,
        exposed: existing.exposed
      };
    }
  }

  // Calcul déterministe sans écriture BDD préalable
  const variant = variantFor(validVisitorId);
  return {
    visitorId: validVisitorId,
    variant,
    exposed: false
  };
}

/**
 * Déclaration d'exposition atomique et résiliente (Upsert)
 * Si le visiteur n'a pas encore été persisté en base, il est inséré avec exposed: true.
 * Préserve l'horodatage initial si déjà exposé.
 */
export async function expose(visitorId) {
  if (!visitorId || !UUID_REGEX.test(visitorId)) {
    const error = new Error('Identifiant visiteur invalide');
    error.status = 400;
    throw error;
  }

  const variant = variantFor(visitorId);
  const now = new Date();

  // Upsert atomique : insère si absent, ou met à jour si exposed est false
  const updated = await Subject.findOneAndUpdate(
    { _id: `${EXP}:${visitorId}` },
    {
      $setOnInsert: {
        _id: `${EXP}:${visitorId}`,
        experimentId: EXP,
        visitorId,
        variant,
        exposed: true,
        exposedAt: now
      }
    },
    { upsert: true, new: true }
  );

  // Si le sujet existait déjà mais n'était pas encore marqué exposé
  if (!updated.exposed) {
    updated.exposed = true;
    updated.exposedAt = now;
    await updated.save();
  }

  return updated;
}

/**
 * Attribution de la réservation à l'expérience
 * Résilience anti-course critique (Race Condition) :
 * Si l'utilisateur réserve très rapidement avant la confirmation du POST /exposure,
 * l'exposition est synchronisée automatiquement.
 */
export async function attribution(visitorId) {
  if (!isEnabled()) return null;
  if (!visitorId || !UUID_REGEX.test(visitorId)) return null;

  let subject = await find(visitorId);

  // Protection Race Condition : si non encore persisté ou non exposé au moment du clic
  if (!subject) {
    subject = await expose(visitorId);
    return subject;
  }

  if (!subject.exposed || !subject.exposedAt) {
    subject.exposed = true;
    subject.exposedAt = new Date();
    await subject.save();
    return subject;
  }

  const now = new Date();
  const windowLimit = new Date(subject.exposedAt.getTime() + 24 * 60 * 60 * 1000);
  if (now < subject.exposedAt || now > windowLimit) {
    return null;
  }

  return subject;
}

/**
 * Calcul des indicateurs A/B agrégés avec rigueur statistique complète :
 * - Dédoublonnage strict par visiteur unique converti
 * - Intervalles de confiance de Wilson (95%)
 * - Test Z de deux proportions & p-value
 * - Détection SRM (Sample Ratio Mismatch)
 */
export async function getMetrics() {
  const variants = [];

  for (const v of ['A', 'B']) {
    const exposed = await Subject.countDocuments({ experimentId: EXP, variant: v, exposed: true });
    // Nombre d'assignés : au moins égal aux exposés enregistrés
    const assignedInDb = await Subject.countDocuments({ experimentId: EXP, variant: v });
    const assigned = Math.max(assignedInDb, exposed);

    let converted = 0;
    if (exposed > 0) {
      const conversionData = await Slot.aggregate([
        {
          $match: {
            experimentId: EXP,
            status: 'BOOKED',
            subjectId: { $ne: null }
          }
        },
        {
          $lookup: {
            from: 'ab_subjects',
            localField: 'subjectId',
            foreignField: '_id',
            as: 'subject'
          }
        },
        { $unwind: '$subject' },
        {
          $match: {
            'subject.variant': v,
            'subject.exposed': true
          }
        },
        {
          $group: {
            _id: '$subjectId'
          }
        },
        {
          $count: 'total'
        }
      ]);

      converted = conversionData[0]?.total || 0;
    }

    const rate = exposed === 0 ? null : parseFloat((converted / exposed).toFixed(4));
    const confidenceInterval = calculateConfidenceInterval(converted, exposed);

    variants.push({
      variant: v,
      assigned,
      exposed,
      converted,
      rate,
      confidenceInterval
    });
  }

  const [metricA, metricB] = variants;
  const zTest = calculateTwoProportionZTest(
    metricA.exposed,
    metricA.converted,
    metricB.exposed,
    metricB.converted
  );
  const srm = calculateSrm(metricA.exposed, metricB.exposed);

  let recommendation = null;
  if (zTest.isSignificant) {
    recommendation = zTest.relativeLift > 0 ? 'B' : 'A';
  }

  return {
    variants,
    summary: {
      zScore: zTest.zScore,
      pValue: zTest.pValue,
      isSignificant: zTest.isSignificant,
      relativeLift: zTest.relativeLift,
      srm,
      recommendation
    }
  };
}

/**
 * Injection de données simulées pour tester le moteur statistique et l'interface
 */
export async function simulateData({ countA = 80, convA = 16, countB = 80, convB = 30 } = {}) {
  const subjectsToInsert = [];
  const now = new Date();

  // Simulation Variante A
  for (let i = 0; i < countA; i++) {
    const id = crypto.randomUUID();
    subjectsToInsert.push({
      _id: `${EXP}:${id}`,
      experimentId: EXP,
      visitorId: id,
      variant: 'A',
      exposed: true,
      exposedAt: now
    });
  }

  // Simulation Variante B
  for (let i = 0; i < countB; i++) {
    const id = crypto.randomUUID();
    subjectsToInsert.push({
      _id: `${EXP}:${id}`,
      experimentId: EXP,
      visitorId: id,
      variant: 'B',
      exposed: true,
      exposedAt: now
    });
  }

  await Subject.deleteMany({ experimentId: EXP });
  await Subject.insertMany(subjectsToInsert);

  // Conversion des sujets A et B sur des créneaux
  const subjectsA = subjectsToInsert.filter(s => s.variant === 'A').slice(0, convA);
  const subjectsB = subjectsToInsert.filter(s => s.variant === 'B').slice(0, convB);
  const convertedSubjects = [...subjectsA, ...subjectsB];

  // Réinitialiser les créneaux existants pour associer les conversions
  const slots = await Slot.find();
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (i < convertedSubjects.length) {
      const sub = convertedSubjects[i];
      slot.status = 'BOOKED';
      slot.bookedBy = `Simulé ${sub.variant}-${i + 1}`;
      slot.bookingId = crypto.randomUUID();
      slot.bookedAt = now;
      slot.experimentId = EXP;
      slot.subjectId = sub._id;
    } else {
      slot.status = 'AVAILABLE';
      slot.bookedBy = null;
      slot.bookingId = null;
      slot.bookedAt = null;
      slot.experimentId = null;
      slot.subjectId = null;
    }
    await slot.save();
  }

  return await getMetrics();
}
