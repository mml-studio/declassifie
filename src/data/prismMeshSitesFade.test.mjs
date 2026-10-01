// src/data/prismMeshSitesFade.test.mjs
// The rules the three prism → mesh → sites layers share: the national cut
// stays a cut but never goes blank, and the mesh ↔ sites band fades
// without drawing a shared point twice or dipping it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARRIVAL_MESH,
  ARRIVAL_NATIONAL,
  ARRIVAL_POINTS,
  ARRIVAL_SITES,
  ROLE_MESH,
  ROLE_SHARED,
  ROLE_SITES,
  createRecordFader,
  dominantPointLevel,
  effectiveMarkCount,
  familyAlphas,
  pointArrivalKey,
  pointRoles,
  retiredPointLevel,
  siteFadeScale,
  wantedPointLevels,
} from './prismMeshSitesFade.js';
import { fadeBand } from './zoomFade.js';

const BAND = fadeBand(0.21, 0.35);

/** A frame's state with every ramp finished unless a key is given a value. */
function frame(overrides = {}, arrivals = {}) {
  return familyAlphas({
    national: false,
    nationalReady: false,
    meshDrawn: false,
    sitesDrawn: false,
    scale: 0.5,
    band: BAND,
    arrival: (key) => arrivals[key] ?? 1,
    ...overrides,
  }, {});
}

test('the national cut rests on ONE side, at any span: a cut, not a band', () => {
  // Both sides drawn and no ramp running — the resting state of a camera that
  // has settled. However the span sits against the band, the prisms and the
  // points are never on screen together at rest, because their colours are
  // two indicators with two keys.
  for (const scale of [0.1, 0.28, 0.5, Infinity]) {
    const national = frame({ national: true, nationalReady: true, meshDrawn: true, sitesDrawn: true, scale });
    assert.equal(national.national, 1);
    assert.equal(national.nationalShown, true);
    assert.deepEqual([national.shared, national.sites, national.mesh], [0, 0, 0], `points at rest under the prisms, ${scale}`);
    const points = frame({ national: false, nationalReady: true, meshDrawn: true, sitesDrawn: true, scale });
    assert.equal(points.national, 0);
    assert.equal(points.nationalShown, false, `prisms at rest under the points, ${scale}`);
    assert.equal(points.shared, 1);
  }
});

test('the cut never shows an empty globe while the next side loads', () => {
  // Zooming out: the rollup is still in flight, so the marks hold.
  const out = frame({ national: true, nationalReady: false, meshDrawn: true });
  assert.equal(out.mesh, 1);
  assert.equal(out.nationalShown, false);
  // Zooming in: the 0.9 MB national point set is still in flight, so the
  // prisms hold.
  const into = frame({ national: false, nationalReady: true });
  assert.equal(into.national, 1);
  assert.equal(into.nationalShown, true);
});

test('the hand-over runs on the points, and the prisms toggle only at its ends', () => {
  // Zooming in: the points ramp in over the prisms, which stay drawn whole
  // until the ramp's last step and are then hidden — never drawn part-way.
  let previous = -1;
  for (const t of [0, 0.25, 0.5, 0.75, 0.99]) {
    const alphas = frame({ national: false, nationalReady: true, meshDrawn: true }, { [ARRIVAL_POINTS]: t });
    assert.ok(alphas.mesh >= previous, `points rise at ${t}`);
    assert.equal(alphas.nationalShown, true, `prisms still whole at ${t}`);
    previous = alphas.mesh;
  }
  assert.equal(frame({ national: false, nationalReady: true, meshDrawn: true }).nationalShown, false);
  // Zooming out: the prisms are shown the moment they are painted, and the
  // points step down under them.
  const start = frame({ national: true, nationalReady: true, sitesDrawn: true }, { [ARRIVAL_NATIONAL]: 0 });
  assert.equal(start.nationalShown, true);
  assert.equal(start.sites, 1);
  const half = frame({ national: true, nationalReady: true, sitesDrawn: true }, { [ARRIVAL_NATIONAL]: 0.5 });
  assert.equal(half.sites, 0.5);
});

test('inside the band a shared mark stays whole while the others cross over', () => {
  let previous = { sites: -1, mesh: 2 };
  for (let scale = 0.4; scale >= 0.15; scale -= 0.005) {
    const alphas = frame({ meshDrawn: true, sitesDrawn: true, scale });
    // Drawn once, at full strength, the whole way: no dip in the middle of
    // the band and no doubling, because there is only one of it.
    assert.equal(alphas.shared, 1, `shared at ${scale}`);
    assert.ok(alphas.sites >= previous.sites, `sites rose at ${scale}`);
    assert.ok(alphas.mesh <= previous.mesh, `mesh fell at ${scale}`);
    previous = alphas;
  }
  const coarse = frame({ meshDrawn: true, sitesDrawn: true, scale: 0.35 });
  assert.deepEqual([coarse.sites, coarse.mesh], [0, 1]);
  const fine = frame({ meshDrawn: true, sitesDrawn: true, scale: 0.21 });
  assert.deepEqual([fine.sites, fine.mesh], [1, 0]);
});

test('a level holds whole until the other is drawn, then the two cross over its arrival', () => {
  // Mid-band, the site answer still in flight: the mesh does not dim.
  assert.equal(frame({ meshDrawn: true, scale: 0.27 }).mesh, 1);
  // Past the fine end, still nothing else drawn: it still covers.
  assert.equal(frame({ meshDrawn: true, scale: 0.1 }).mesh, 1);
  // The sites land: they ramp in, and the mesh steps down in proportion.
  const landing = frame({ meshDrawn: true, sitesDrawn: true, scale: 0.1 }, { [ARRIVAL_SITES]: 0.5 });
  assert.equal(landing.sites, 0.5);
  assert.equal(landing.mesh, 0.5);
  assert.equal(landing.shared, 1, 'a shared mark is not part of either ramp');
});

test('every mark has one role, and a point both levels draw is drawn once', () => {
  const both = pointRoles(['a', 'b', 'x'], ['a', 'b', 'c', 'd'], { meshDrawn: true, sitesDrawn: true });
  assert.deepEqual(Object.fromEntries(both), {
    a: ROLE_SHARED, b: ROLE_SHARED, c: ROLE_SITES, d: ROLE_SITES, x: ROLE_MESH,
  });
  assert.equal(both.size, 5, 'five marks for five points — none twice');
  // With one level drawn there is nothing to share.
  const meshOnly = pointRoles(['a', 'b'], ['a', 'c'], { meshDrawn: true, sitesDrawn: false });
  assert.deepEqual(Object.fromEntries(meshOnly), { a: ROLE_MESH, b: ROLE_MESH });
  const sitesOnly = pointRoles(['a', 'b'], ['a', 'c'], { meshDrawn: false, sitesDrawn: true });
  assert.deepEqual(Object.fromEntries(sitesOnly), { a: ROLE_SITES, c: ROLE_SITES });
});

test('a settled view loads every level with a weight, and lets go of one only once it is replaced', () => {
  assert.deepEqual(wantedPointLevels(0.5, BAND), { mesh: true, sites: false });
  assert.deepEqual(wantedPointLevels(0.28, BAND), { mesh: true, sites: true });
  assert.deepEqual(wantedPointLevels(0.1, BAND), { mesh: false, sites: true });
  const both = { band: BAND, meshDrawn: true, sitesDrawn: true };
  assert.equal(retiredPointLevel({ ...both, scale: 0.28 }), null, 'in the band, both stay');
  assert.equal(retiredPointLevel({ ...both, scale: 0.5 }), 'sites');
  assert.equal(retiredPointLevel({ ...both, scale: 0.1 }), 'mesh');
  // Not while the replacement is still arriving: it is the cover until then.
  assert.equal(retiredPointLevel({ ...both, scale: 0.1, sitesArrival: 0.4 }), null);
  assert.equal(retiredPointLevel({ ...both, scale: 0.5, meshArrival: 0.4 }), null);
  // Nothing replaces a level that is drawn alone.
  assert.equal(retiredPointLevel({ band: BAND, meshDrawn: true, sitesDrawn: false, scale: 0.1 }), null);
});

test('the level that owns the key is the one with the larger alpha', () => {
  assert.equal(dominantPointLevel({ meshDrawn: true, sitesDrawn: false, scale: 0.1, band: BAND }), 'mesh',
    'the only level drawn owns the view, wherever the camera is');
  assert.equal(dominantPointLevel({ meshDrawn: false, sitesDrawn: true, scale: 0.5, band: BAND }), 'sites');
  // Under the reveal the sites overtake the mesh 21 % of the way in, in log
  // scale from the coarse end: 0.35 × 0.6^0.21 = 0.314°.
  assert.equal(dominantPointLevel({ meshDrawn: true, sitesDrawn: true, scale: 0.33, band: BAND }), 'mesh');
  assert.equal(dominantPointLevel({ meshDrawn: true, sitesDrawn: true, scale: 0.3, band: BAND }), 'sites');
  assert.equal(dominantPointLevel({ meshDrawn: true, sitesDrawn: true, scale: 0.25, band: BAND }), 'sites');
});

test('the band is a reveal: the sites win it, because every view in it used to show them', () => {
  // The band can only sit below the old switch (its coarse end is the proxy
  // ceiling), so a symmetric crossfade would have handed views that showed
  // every site on main to the mesh.
  const at = (p) => 0.35 * (0.21 / 0.35) ** p;
  const lead = frame({ meshDrawn: true, sitesDrawn: true, scale: at(0.3) });
  assert.equal(lead.sites, 1, 'whole 30 % of the way in');
  assert.ok(lead.mesh > 0, 'with the mesh still fading behind them');
  const trail = frame({ meshDrawn: true, sitesDrawn: true, scale: at(0.7) - 1e-9 });
  assert.equal(trail.mesh, 0, 'and the mesh gone 70 % of the way in');
  // Before the mesh is gone it is no longer wanted for long: a settled view
  // past 70 % of the band does not load it.
  assert.equal(wantedPointLevels(at(0.75), BAND).mesh, false);
  assert.equal(wantedPointLevels(at(0.65), BAND).mesh, true);
  // And the two never sum below one: no point in the band is a dimmer map.
  for (let p = 0; p <= 1; p += 0.05) {
    const alphas = frame({ meshDrawn: true, sitesDrawn: true, scale: at(p) });
    assert.ok(alphas.sites + alphas.mesh >= 1 - 1 / 64, `sum at ${p.toFixed(2)}`);
  }
});

test('one arrival per hand-over, and none for a pan', () => {
  const none = { mesh: false, sites: false };
  assert.equal(pointArrivalKey(none, { mesh: true, sites: false }), ARRIVAL_POINTS);
  assert.equal(pointArrivalKey({ mesh: true, sites: false }, { mesh: true, sites: true }), ARRIVAL_SITES);
  assert.equal(pointArrivalKey({ mesh: false, sites: true }, { mesh: true, sites: true }), ARRIVAL_MESH);
  assert.equal(pointArrivalKey({ mesh: true, sites: true }, { mesh: true, sites: true }), null);
  assert.equal(pointArrivalKey({ mesh: true, sites: true }, { mesh: false, sites: true }), null, 'a retirement is not an arrival');
  assert.equal(pointArrivalKey({ mesh: true, sites: false }, none), null);
});

test('the band scale is the larger span, and nothing above the altitude guard', () => {
  assert.equal(siteFadeScale(0.3, 20_000, 45_000), 0.3);
  assert.equal(siteFadeScale(0.3, 45_000, 45_000), Infinity);
  assert.equal(siteFadeScale(0.3, Infinity, 45_000), Infinity);
  assert.equal(siteFadeScale(Infinity, 20_000, 45_000), Infinity);
  assert.equal(siteFadeScale(Number.NaN, 20_000, 45_000), Infinity);
});

test('plates are sized for the marks a view will show, at their settled alpha', () => {
  const counts = { shared: 100, sites: 300, mesh: 50 };
  const drawn = { meshDrawn: true, sitesDrawn: true };
  assert.equal(effectiveMarkCount(counts, 0.35, BAND, drawn), 150, 'coarse end: the mesh');
  assert.equal(effectiveMarkCount(counts, 0.21, BAND, drawn), 400, 'fine end: the sites');
  const middle = effectiveMarkCount(counts, 0.28, BAND, drawn);
  assert.ok(middle > 150 && middle < 450);
  // One level alone counts whole, wherever the camera settled.
  assert.equal(effectiveMarkCount({ mesh: 80 }, 0.1, BAND, { meshDrawn: true, sitesDrawn: false }), 80);
});

test('the record fader writes only what moved, and says when a mark crosses zero', () => {
  const writes = [];
  const fader = createRecordFader((record, weight) => writes.push([record.id, weight]));
  const records = new Map([
    ['s', { id: 's', fadeRole: ROLE_SHARED }],
    ['f', { id: 'f', fadeRole: ROLE_SITES }],
    ['m', { id: 'm', fadeRole: ROLE_MESH }],
    ['legacy', { id: 'legacy' }],
  ]);
  let result = fader.apply(records, { shared: 1, sites: 0.5, mesh: 0 });
  // The shared mark and the role-less one are already whole: not written.
  assert.deepEqual(writes, [['f', 0.5], ['m', 0]]);
  assert.equal(result.crossed, true, 'the mesh-only mark went to zero');
  writes.length = 0;
  result = fader.apply(records, { shared: 1, sites: 0.5, mesh: 0 });
  assert.equal(result.changed, false);
  assert.deepEqual(writes, [], 'a still camera writes nothing');
  // A rebuild brings new records; the same weights must still reach them.
  records.set('g', { id: 'g', fadeRole: ROLE_SITES });
  fader.invalidate();
  fader.apply(records, { shared: 1, sites: 0.5, mesh: 0 });
  assert.deepEqual(writes, [['g', 0.5]]);
  writes.length = 0;
  result = fader.apply(records, { shared: 1, sites: 0.75, mesh: 0.25 });
  assert.equal(result.crossed, true, 'the mesh-only mark came back from zero');
  assert.deepEqual(writes.map(([id]) => id).sort(), ['f', 'g', 'm']);
});
