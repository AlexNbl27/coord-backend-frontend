import mongoose from 'mongoose';

export const MASTER_DB_NAME = 'cineslot_master';
const DEFAULT_URI = 'mongodb://mongodb:27017/?directConnection=true';

export const masterConn = mongoose.connection;
export const tenantConn = mongoose.createConnection();

export function resolveMongoConfig() {
  const fallback = process.env.MONGO_URI || DEFAULT_URI;
  const masterUri = process.env.MONGO_MASTER_URI || fallback;
  return {
    masterUri,
    tenantUri: process.env.MONGO_TENANT_URI || masterUri,
    masterDbName: process.env.MONGO_MASTER_DB || MASTER_DB_NAME
  };
}

export async function connectDatabases(options = {}) {
  const { masterUri, tenantUri, masterDbName } = resolveMongoConfig();
  await Promise.all([
    mongoose.connect(masterUri, { ...options, dbName: masterDbName }),
    tenantConn.openUri(tenantUri, options)
  ]);
}

export function databasesReady() {
  return masterConn.readyState === 1 && tenantConn.readyState === 1;
}
