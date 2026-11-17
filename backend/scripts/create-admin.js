import crypto from 'node:crypto';
import mongoose from 'mongoose';
import 'dotenv/config';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/services/sessionService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, inlineVal] = arg.slice(2).split('=');
      if (inlineVal !== undefined) {
        args[key] = inlineVal;
      } else if (i + 1 < argv.length) {
        args[key] = argv[i + 1];
        i += 1;
      }
    } else {
      positional.push(arg);
    }
  }
  return {
    email: args.email ?? positional[0],
    name: args.name ?? positional[1],
    password: args.password ?? positional[2]
  };
}

async function main() {
  const { email, name, password } = parseArgs(process.argv.slice(2));
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!normalizedEmail || normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail)) {
    console.error('Usage: node scripts/create-admin.js --email <email> --name <name> --password <password>');
    process.exit(1);
  }
  if (!trimmedName || trimmedName.length > 80) {
    console.error('Invalid name: must be 1..80 characters.');
    process.exit(1);
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    console.error('Invalid password: must be 12..128 characters.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || 'mongodb://mongodb:27017/cineslot_master?directConnection=true';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    const user = await User.create({
      _id: crypto.randomUUID(),
      email: normalizedEmail,
      name: trimmedName,
      passwordHash: await hashPassword(password),
      role: 'SUPER_ADMIN',
      cinemaSlugs: []
    });
    console.log(`SUPER_ADMIN created: ${user.email} (${user._id})`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err?.code === 11000 ? 'A user with this email already exists.' : err.message);
  process.exit(1);
});
