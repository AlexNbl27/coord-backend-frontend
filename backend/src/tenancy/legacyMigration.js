import { tenantDbName } from './slug.js';

export const LEGACY_SOURCE_DB = 'cours_db';
export const LEGACY_TENANT_SLUG = 'cine-bellecour';
export const LEGACY_DEFAULT_ADDRESS = '14 rue de la Cinémathèque, 69002 Lyon';
export const MASTER_COLLECTIONS = ['movies', 'users', 'ab_subjects', 'job_locks'];
export const TENANT_COLLECTIONS = ['slots', 'bookings'];

async function copyMissingById(source, target, dryRun) {
  const docs = await source.find({}).toArray();
  if (docs.length === 0) {
    return { read: 0, inserted: 0 };
  }
  if (dryRun) {
    const existing = await target.countDocuments({ _id: { $in: docs.map((d) => d._id) } });
    return { read: docs.length, inserted: docs.length - existing };
  }
  const result = await target.bulkWrite(
    docs.map((doc) => ({
      updateOne: { filter: { _id: doc._id }, update: { $setOnInsert: doc }, upsert: true }
    })),
    { ordered: false }
  );
  return { read: docs.length, inserted: result.upsertedCount ?? 0 };
}

async function copyMissingCinemas(source, target, dryRun) {
  const docs = await source.find({}).toArray();
  let inserted = 0;
  for (const { _id, ...doc } of docs) {
    let dbName;
    try {
      dbName = tenantDbName(doc.slug);
    } catch {
      continue;
    }
    const exists = await target.countDocuments({ slug: doc.slug });
    if (exists > 0) {
      continue;
    }
    inserted += 1;
    if (!dryRun) {
      await target.updateOne(
        { slug: doc.slug },
        { $setOnInsert: { status: 'ACTIVE', deletedAt: null, purgeState: null, ...doc, dbName } },
        { upsert: true }
      );
    }
  }
  return { read: docs.length, inserted };
}

async function backfillDbNames(cinemas, dryRun) {
  const missing = await cinemas.find({ $or: [{ dbName: { $exists: false } }, { dbName: null }] }).toArray();
  const invalid = [];
  let updated = 0;
  for (const cinema of missing) {
    let dbName;
    try {
      dbName = tenantDbName(cinema.slug);
    } catch {
      invalid.push(cinema.slug);
      continue;
    }
    updated += 1;
    if (!dryRun) {
      await cinemas.updateOne({ _id: cinema._id }, { $set: { dbName } });
    }
  }
  return { updated, invalid };
}

async function linkMovieIds(collection, movieIdsByTitle, dryRun) {
  let linked = 0;
  for (const [title, movieId] of movieIdsByTitle) {
    const filter = { movieTitle: title, $or: [{ movieId: { $exists: false } }, { movieId: null }] };
    if (dryRun) {
      linked += await collection.countDocuments(filter);
    } else {
      const res = await collection.updateMany(filter, { $set: { movieId } });
      linked += res.modifiedCount ?? 0;
    }
  }
  return linked;
}

export async function migrateLegacyDatabase({
  sourceDb,
  masterDb,
  tenantDb,
  slug = LEGACY_TENANT_SLUG,
  dryRun = false
}) {
  const expectedTenantDb = tenantDbName(slug);
  if (tenantDb.databaseName && tenantDb.databaseName !== expectedTenantDb) {
    throw new Error(`Base tenant inattendue : ${tenantDb.databaseName} au lieu de ${expectedTenantDb}.`);
  }
  if (sourceDb.databaseName && [masterDb.databaseName, expectedTenantDb].includes(sourceDb.databaseName)) {
    throw new Error('La base source doit être distincte des bases cibles.');
  }

  const report = { dryRun, slug, master: {}, tenant: {} };

  for (const name of MASTER_COLLECTIONS) {
    report.master[name] = await copyMissingById(sourceDb.collection(name), masterDb.collection(name), dryRun);
  }
  report.master.cinemas = await copyMissingCinemas(sourceDb.collection('cinemas'), masterDb.collection('cinemas'), dryRun);
  report.master.dbNames = await backfillDbNames(masterDb.collection('cinemas'), dryRun);

  const cinema = await masterDb.collection('cinemas').findOne({ slug });
  if (!cinema && !dryRun) {
    throw new Error(`Cinéma ${slug} absent du registre maître.`);
  }

  for (const name of TENANT_COLLECTIONS) {
    report.tenant[name] = await copyMissingById(sourceDb.collection(name), tenantDb.collection(name), dryRun);
  }

  const movies = await masterDb.collection('movies').find({}, { projection: { _id: 1, title: 1 } }).toArray();
  const movieIdsByTitle = new Map(movies.map((m) => [m.title, m._id]));
  report.tenant.slotsLinked = await linkMovieIds(tenantDb.collection('slots'), movieIdsByTitle, dryRun);
  report.tenant.bookingsLinked = await linkMovieIds(tenantDb.collection('bookings'), movieIdsByTitle, dryRun);

  const address = cinema ? [cinema.address, cinema.city].filter(Boolean).join(', ') : '';
  const addressFilter = { address: { $in: [LEGACY_DEFAULT_ADDRESS, '', null] } };
  if (!address) {
    report.tenant.bookingsAddressed = 0;
  } else if (dryRun) {
    report.tenant.bookingsAddressed = await tenantDb.collection('bookings').countDocuments(addressFilter);
  } else {
    const res = await tenantDb.collection('bookings').updateMany(addressFilter, { $set: { address } });
    report.tenant.bookingsAddressed = res.modifiedCount ?? 0;
  }

  return report;
}
