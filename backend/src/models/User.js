import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, default: undefined },
  role: { type: String, enum: ['SUPER_ADMIN', 'CINEMA_ADMIN', 'SPECTATOR'], default: 'SPECTATOR' },
  cinemaSlugs: { type: [String], default: [] },
  // Absent until the first password reset ($inc then sets it to 1).
  sessionVersion: { type: Number, default: undefined },
  googleId: { type: String, default: undefined, unique: true, sparse: true },
  resetTokenHash: { type: String, default: undefined, index: { sparse: true } },
  resetTokenExpires: { type: Date, default: undefined },
  createdAt: { type: Date, default: Date.now }
}, {
  collection: 'users',
  versionKey: false
});

userSchema.pre('save', function () {
  if (!this.isNew && this.isModified('role')) {
    this.sessionVersion = (this.sessionVersion ?? 0) + 1;
  }
});

function bumpSessionVersionOnRoleUpdate() {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') {
    return;
  }
  const setsRole = 'role' in update || (update.$set && 'role' in update.$set);
  if (!setsRole) {
    return;
  }
  if (!update.$inc) {
    update.$inc = {};
  }
  if (typeof update.$inc.sessionVersion !== 'number') {
    update.$inc.sessionVersion = 1;
  }
}

userSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], bumpSessionVersionOnRoleUpdate);

export const User = mongoose.model('User', userSchema);
