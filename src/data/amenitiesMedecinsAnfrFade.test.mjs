// src/data/amenitiesMedecinsAnfrFade.test.mjs
// The rule the three mesh-and-sites registers share: a mark both levels hold
// is drawn once and never fades, the national cut never blends, and a class
// at zero is hidden as a whole collection.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import { fadeMarkLevel, meshSitesAlphas, nationalCutAlphas } from './amenitiesMedecinsAnfrFade.js';
import { FADE_STEPS, reveal } from './zoomFade.js';

test('a mark both levels hold stays at full strength across the whole band', () => {
  let previous = { mesh: 2, sites: -1 };
  for (let position = 0; position <= 1.0001; position += 0.05) {
    const alphas = meshSitesAlphas(position, { meshReady: true, sitesReady: true });
    assert.equal(alphas.shared, 1, `shared dipped at ${position}`);
    assert.ok(alphas.mesh <= previous.mesh && alphas.sites >= previous.sites);
    assert.ok(alphas.mesh + alphas.sites >= 1 - 1e-12, `the layer dipped at ${position}`);
    previous = alphas;
  }
  // `reveal`, not the symmetric crossfade: the detail is in by 30 % of the band.
  assert.deepEqual(
    (({ mesh, sites }) => ({ mesh, sites }))(meshSitesAlphas(0.3, { meshReady: true, sitesReady: true })),
    { mesh: reveal(0.3).coarse, sites: 1 },
  );
});

test('a level holds for a missing partner, and the shared marks hold with it', () => {
  const onlyMesh = meshSitesAlphas(1, { meshReady: true });
  assert.deepEqual(onlyMesh, { mesh: 1, sites: 0, shared: 1 });
  const onlySites = meshSitesAlphas(0, { sitesReady: true });
  assert.deepEqual(onlySites, { mesh: 0, sites: 1, shared: 1 });
  assert.deepEqual(meshSitesAlphas(0.5, {}), { mesh: 0, sites: 0, shared: 0 });
  // Even with both partners ramping at once, a shared mark does not dip.
  const both = meshSitesAlphas(0.5, { meshReady: true, sitesReady: true, meshArrival: 0.5, sitesArrival: 0.5 });
  assert.equal(both.shared, 1);
});

test('the national cut is 0 or 1, and the outgoing side holds until the incoming one is drawn', () => {
  assert.deepEqual(nationalCutAlphas({ national: false, nationalReady: true }), { national: 1, points: 0 });
  assert.deepEqual(nationalCutAlphas({ national: false, nationalReady: true, pointsReady: true }), { national: 0, points: 1 });
  assert.deepEqual(nationalCutAlphas({ national: true, pointsReady: true }), { national: 0, points: 1 });
  assert.deepEqual(nationalCutAlphas({ national: true, nationalReady: true, pointsReady: true }), { national: 1, points: 0 });
  assert.deepEqual(nationalCutAlphas({ national: true }), { national: 0, points: 0 });
});

/** A collection whose items copy the colour they are given, as billboards do. */
function marks(alphas) {
  const items = alphas.map((alpha) => {
    let color = Cesium.Color.RED.withAlpha(alpha);
    return {
      get color() { return color; },
      set color(value) { color = Cesium.Color.clone(value); },
    };
  });
  return { show: false, length: items.length, get: (index) => items[index], items };
}

test('a class at zero is hidden as a collection, and shown again at its new weight', () => {
  const collection = marks([1, 0.5]);
  assert.equal(fadeMarkLevel(collection, 0.5), true);
  assert.equal(collection.show, true);
  assert.equal(collection.items[0].color.alpha, 0.5);
  assert.equal(collection.items[1].color.alpha, 0.25);
  assert.equal(fadeMarkLevel(collection, 0.5 + 0.1 / FADE_STEPS), false, 'no step, no write');
  assert.equal(fadeMarkLevel(collection, 0), true);
  assert.equal(collection.show, false);
  // Hidden: the marks are not written, they are simply not drawn.
  assert.equal(collection.items[0].color.alpha, 0.5);
  // Back on: written at the weight it comes back at, even an unchanged one.
  fadeMarkLevel(collection, 0.5);
  assert.equal(collection.show, true);
  assert.equal(collection.items[1].color.alpha, 0.25);
  assert.equal(fadeMarkLevel(null, 1), false);
  // A layer that is off shows nothing whatever the weight.
  fadeMarkLevel(collection, 1, { enabled: false });
  assert.equal(collection.show, false);
});

test('a class rebuilt while hidden is written in full when it comes back at the weight it left at', () => {
  const collection = marks([1]);
  fadeMarkLevel(collection, 0.5);
  fadeMarkLevel(collection, 0);
  // The layer rebuilt the class while it was hidden: a new mark at full alpha.
  let fresh = Cesium.Color.BLUE.withAlpha(1);
  collection.items.push({
    get color() { return fresh; },
    set color(value) { fresh = Cesium.Color.clone(value); },
  });
  collection.length = 2;
  fadeMarkLevel(collection, 0.5);
  assert.equal(collection.items[1].color.alpha, 0.5, 'the newcomer took the class weight');
});
