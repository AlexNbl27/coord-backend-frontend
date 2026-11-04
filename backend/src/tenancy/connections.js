import mongoose from 'mongoose';

export const MASTER_DB_NAME = 'cineslot_master';
const DEFAULT_URI = 'mongodb://mongodb:27017/?directConnection=true';

export const masterConn = mongoose.connection;
export const tenantConn = mongoose.createConnection();

export function resolveMongoConfig(env = process.env) {
  const fallback = env.MONGO_URI || DEFAULT_URI;
  const masterUri = env.MONGO_MASTER_URI || fallback;
  return {
    masterUri,
    tenantUri: env.MONGO_TENANT_URI || masterUri,
    masterDbName: env.MONGO_MASTER_DB || MASTER_DB_NAME
  };
}

export async function connectDatabases(options = {}, env = process.env) {
  const { masterUri, tenantUri, masterDbName } = resolveMongoConfig(env);
  await Promise.all([
    mongoose.connect(masterUri, { ...options, dbName: masterDbName }),
    tenantConn.openUri(tenantUri, options)
  ]);
}

export function databasesReady() {
  return masterConn.readyState === 1 && tenantConn.readyState === 1;
}
