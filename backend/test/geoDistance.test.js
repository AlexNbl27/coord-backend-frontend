import assert from 'node:assert/strict';
import test from 'node:test';
import { boundingBox, haversineKm, roundKm } from '../src/geo/distance.js';

test('distance Nashville Los Angeles (Rosetta Code)', () => {
  const km = haversineKm(36.12, -86.67, 33.94, -118.40);
  assert.ok(Math.abs(km - 2886.444) < 0.001, `obtenu ${km}`);
});

test('Lyon Paris ~392 km', () => {
  const km = haversineKm(45.7576, 4.8317, 48.8663, 2.3685);
  assert.ok(km > 380 && km < 400, `obtenu ${km}`);
});

test('distance nulle si même point', () => {
  assert.equal(haversineKm(45.7576, 4.8317, 45.7576, 4.8317), 0);
});

test('lat et lon inversés donnent un résultat faux', () => {
  assert.ok(haversineKm(45.7576, 4.8317, 45.7569, 4.8330) < 0.2);
  assert.ok(haversineKm(4.8317, 45.7576, 45.7569, 4.8330) > 5000);
});

test('arrondi a 0.1 km', () => {
  assert.equal(roundKm(2.34), 2.3);
  assert.equal(roundKm(2.26), 2.3);
  assert.equal(roundKm(4.96), 5);
});

test('boite de 5 km autour de Bellecour', () => {
  const box = boundingBox(45.7576, 4.8317, 5);
  assert.ok(Math.abs(box.maxLat - 45.7576 - 0.045) < 0.0001);
  assert.ok(Math.abs(box.maxLon - 4.8317 - 0.0644) < 0.0001);
});
