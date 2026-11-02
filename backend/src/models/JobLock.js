import mongoose from 'mongoose';

const jobLockSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  owner: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, {
  collection: 'job_locks',
  versionKey: false
});

jobLockSchema.index({ expiresAt: 1 });

export const JobLock = mongoose.model('JobLock', jobLockSchema);
