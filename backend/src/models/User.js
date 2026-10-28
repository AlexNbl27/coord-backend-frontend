import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  resetTokenHash: { type: String, default: undefined, index: { sparse: true } },
  resetTokenExpires: { type: Date, default: undefined },
  createdAt: { type: Date, default: Date.now }
}, {
  collection: 'users',
  versionKey: false
});

export const User = mongoose.model('User', userSchema);
