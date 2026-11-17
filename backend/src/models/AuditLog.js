import mongoose from 'mongoose';
import { insertOnly } from './insertOnly.js';

const auditLogSchema = new mongoose.Schema({
  seq: { type: Number, required: true, unique: true },
  prevHash: { type: String, required: true, unique: true },
  hash: { type: String, required: true },
  at: { type: Date, required: true },
  actor: { type: mongoose.Schema.Types.Mixed, default: null },
  action: { type: String, required: true },
  target: { type: mongoose.Schema.Types.Mixed, default: null },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  result: { type: String, required: true }
}, {
  collection: 'audit_logs',
  versionKey: false,
  minimize: false
});

auditLogSchema.index({ 'target.cinemaSlug': 1, seq: -1 });
auditLogSchema.index({ action: 1, seq: -1 });

insertOnly(auditLogSchema, 'audit_logs');

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
