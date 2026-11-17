import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDatabases, masterConn, tenantConn, useTenantDb } from '../src/tenancy/index.js';
import { LEGACY_SOURCE_DB, LEGACY_TENANT_SLUG, migrateLegacyDatabase } from '../src/tenancy/legacyMigration.js';

function parseArgs(argv) {
  const args = { dryRun: false, source: LEGACY_SOURCE_DB, slug: LEGACY_TENANT_SLUG };
  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg.startsWith('--source=')) {
      args.source = arg.slice('--source='.length);
    } else if (arg.startsWith('--slug=')) {
      args.slug = arg.slice('--slug='.length);
    }
  }
  return args;
}

async function main() {
  const { dryRun, source, slug } = parseArgs(process.argv.slice(2));
  await connectDatabases({ serverSelectionTimeoutMS: 5000 });
  try {
    const sourceDb = masterConn.getClient().db(source);
    const masterDb = masterConn.db;
    const tenantDb = useTenantDb(slug).db;
    const report = await migrateLegacyDatabase({ sourceDb, masterDb, tenantDb, slug, dryRun });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await Promise.all([mongoose.disconnect(), tenantConn.close()]);
  }
}

main().catch((err) => {
  console.error(`[migrate] ${err.message}`);
  process.exitCode = 1;
});
