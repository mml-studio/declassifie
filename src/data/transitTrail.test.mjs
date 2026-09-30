// src/data/transitTrail.test.mjs — the server's fifteen minutes of where each
// live transit vehicle has been.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransitTrailStore } from './transitTrail.js';

const T0 = 1_780_000_000; // epoch seconds

test('a moving vehicle keeps its samples, oldest first, as [ms, lat, lon]', () => {
  const store = createTransitTrailStore();
  assert.equal(store.record('pan-83026:bus-1', 44.8378, -0.5792, T0), true);
  assert.equal(store.record('pan-83026:bus-1', 44.8390, -0.5792, T0 + 15), true);
  assert.equal(store.record('pan-83026:bus-1', 44.8402, -0.5792, T0 + 30), true);
  const rows = store.read('pan-83026:bus-1', T0 + 30);
  assert.deepEqual(rows.map((row) => row[0]), [T0 * 1000, (T0 + 15) * 1000, (T0 + 30) * 1000]);
  assert.deepEqual(rows[1].slice(1), [44.839, -0.5792]);
  assert.deepEqual(store.read('unknown', T0), []);
});

test('a parked or repeated fix is thinned away, and an older fix never rewinds the ring', () => {
  const store = createTransitTrailStore({ minGapSec: 10, minMoveM: 15 });
  store.record('v', 44.8378, -0.5792, T0);
  assert.equal(store.record('v', 44.8378, -0.5792, T0 + 60), false, 'did not move');
  assert.equal(store.record('v', 44.8400, -0.5792, T0 + 5), false, 'too soon');
  assert.equal(store.record('v', 44.8400, -0.5792, T0 - 30), false, 'older than the last sample');
  assert.equal(store.read('v', T0 + 60).length, 1);
});

test('the ring keeps its newest samples and the window drops the old ones', () => {
  const store = createTransitTrailStore({ samples: 4, minGapSec: 1, minMoveM: 1, retentionSec: 900 });
  for (let i = 0; i < 6; i += 1) store.record('v', 44.8 + i * 0.001, -0.57, T0 + i * 20);
  const rows = store.read('v', T0 + 100);
  assert.equal(rows.length, 4);
  assert.equal(rows[0][0], (T0 + 40) * 1000);
  assert.equal(store.read('v', T0 + 40 + 900 + 1).length, 3, 'samples older than 15 min are not served');
});

test('vehicles not heard for fifteen minutes are swept, and the least recently heard go first at the cap', () => {
  const store = createTransitTrailStore({ maxVehicles: 2, sweepEverySec: 60 });
  store.record('a', 44.8, -0.57, T0);
  store.record('b', 44.8, -0.57, T0 + 1);
  store.record('a', 44.8, -0.57, T0 + 2); // a is heard again (thinned), b is now the oldest
  store.record('c', 44.8, -0.57, T0 + 3);
  assert.equal(store.size(), 2);
  assert.deepEqual(store.read('b', T0 + 3), [], 'b was evicted, not a');
  assert.equal(store.read('a', T0 + 3).length, 1);
  store.record('d', 44.9, -0.57, T0 + 1000);
  assert.equal(store.size(), 1, 'the sweep dropped a and c');
});

test('junk is refused', () => {
  const store = createTransitTrailStore();
  assert.equal(store.record('', 44.8, -0.57, T0), false);
  assert.equal(store.record('v', 95, -0.57, T0), false);
  assert.equal(store.record('v', 44.8, Number.NaN, T0), false);
  assert.equal(store.record('v', 44.8, -0.57, 0), false);
  assert.equal(store.size(), 0);
});
