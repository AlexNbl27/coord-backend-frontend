import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('pas de lat/lon dans les logs nginx', () => {
  const conf = read('../frontend/nginx.conf');
  assert.ok(conf.includes('access_log /var/log/nginx/access.log sans_position;'));
  assert.ok(conf.includes('"$request_method $uri"'));
  assert.ok(!conf.includes('$request_uri'));
  assert.ok(!conf.includes('$args'));
});

test('lat et lon masqués dans les traces', () => {
  assert.match(read('src/tracing.js'), /redactedQueryParamsServer:\s*\['lat', 'lon'\]/);
});

test('aucun console.log dans le code geo', () => {
  for (const file of ['src/geo/distance.js', 'src/geo/finders.js', 'src/routes/cinemaRoutes.js']) {
    assert.doesNotMatch(read(file), /console\./, file);
  }
});
