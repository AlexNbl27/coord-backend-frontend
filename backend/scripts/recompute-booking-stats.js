import mongoose from 'mongoose';
import 'dotenv/config';
import { recomputeBookingStats } from '../src/stats/bookingStats.js';

const mongoUri = process.env.MONGO_URI || 'mongodb://mongodb:27017/cineslot_master?directConnection=true';

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
try {
  const logs = mongoose.connection
    .collection('reservation_logs')
    .find({ action: { $in: ['BOOKED', 'CANCELLED'] } })
    .sort({ at: 1 });
  const count = await recomputeBookingStats(logs);
  console.log(`booking_stats recomputed: ${count} rows`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
