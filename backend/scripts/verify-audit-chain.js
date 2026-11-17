import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { AuditLog } from '../src/models/AuditLog.js';
import { verifyAuditChain } from '../src/events/audit.js';
import { resolveMongoConfig } from '../src/tenancy/index.js';

dotenv.config();

try {
  const { masterUri, masterDbName } = resolveMongoConfig();
  await mongoose.connect(masterUri, { dbName: masterDbName, serverSelectionTimeoutMS: 5000 });
  const cursor = AuditLog.find().sort({ seq: 1 }).lean().cursor();
  const report = await verifyAuditChain(cursor);
  console.log(JSON.stringify(report));
  process.exitCode = report.ok ? 0 : 1;
} catch (err) {
  console.error('[audit:verify]', err.message);
  process.exitCode = 2;
} finally {
  await mongoose.disconnect();
}
