import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { Cinema } from '../src/models/Cinema.js';
import { seedCinemas } from '../src/geo/cinemas.js';
import { findInBox, findWithGeoNear } from '../src/geo/finders.js';

const uri = process.env.MONGO_TEST_URI;

test('geoNear donne les memes cinemas que findInBox', { skip: !uri }, async () => {
  await mongoose.connect(uri);
  try {
    await Cinema.syncIndexes();
    await seedCinemas();
    const query = { lat: 45.7576, lon: 4.8317, radiusKm: 5, feature: null };

    const byBox = await findInBox(query);
    const byGeoNear = await findWithGeoNear(query);
    const slugs = (rows) => rows.map((r) => r.cinema.slug).sort();

    assert.equal(byBox.length, 6);
    assert.deepEqual(slugs(byGeoNear), slugs(byBox));
    for (const near of byGeoNear) {
      const box = byBox.find((b) => b.cinema.slug === near.cinema.slug);
      assert.ok(Math.abs(near.km - box.km) / box.km < 0.005);
    }
  } finally {
    await mongoose.disconnect();
  }
});
