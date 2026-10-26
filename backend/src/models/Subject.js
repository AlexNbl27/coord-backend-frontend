import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  experimentId: { type: String, required: true },
  visitorId: { type: String, required: true },
  variant: { type: String, enum: ['A', 'B'], required: true },
  exposed: { type: Boolean, default: false },
  exposedAt: { type: Date, default: null }
}, {
  collection: 'ab_subjects',
  versionKey: false
});

subjectSchema.index({ experimentId: 1, variant: 1, exposed: 1 });

export const Subject = mongoose.model('Subject', subjectSchema);
