// src/data/scanAreaFade.test.mjs
// The plots (parcels) and sections of the price and energy layers as two
// levels that fade into each other between 1 080 m and 1 800 m, and the
// painter under them that never shows bare ground while it rebuilds.
//
// No WebGL here: the primitives are Cesium's own objects, added to a stand-in
// collection that lets a test say when they are ready, the way the worker
// pool would.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeParts } from './dvfFeed.js';
import { createGroundAreaPaint } from './groundAreaPaint.js';
import {
  SCAN_AREA_FADE_BAND,
  createScanAreaLevels,
  scanAreaDominant,
  scanAreaZoomWeights,
} from './scanAreaFade.js';
import { SCAN_SECTION_FADE, scanCellParams } from './scanRegime.js';

// A `GroundPolylinePrimitive` checks its render state against the GL context's
// line-width limits at construction, and there is no context under `node
// --test` — the harness's limit, not the layer's (see `sitadelFrance.test.mjs`).
const { default: ContextLimits } = await import('@cesium/engine/Source/Renderer/ContextLimits.js');
ContextLimits._maximumAliasedLineWidth = 16;

/** A viewer whose primitives are Cesium's, readied by hand. */
function fakeViewer() {
  const added = [];
  const listeners = new Set();
  return {
    added,
    scene: {
      primitives: {
        add(primitive) {
          let ready = false;
          const store = new Map();
          Object.defineProperty(primitive, 'ready', { get: () => ready, configurable: true });
          primitive.setReadyForTest = () => { ready = true; };
          primitive.attributesForTest = store;
          primitive.getGeometryInstanceAttributes = (id) => {
            if (!store.has(id)) {
              // Cesium's setter COPIES the value into the batch table.
              let color = new Uint8Array([0, 0, 0, 0]);
              store.set(id, {
                get color() { return color; },
                set color(value) { color = Uint8Array.from(value); },
              });
            }
            return store.get(id);
          };
          added.push(primitive);
          return primitive;
        },
        remove(primitive) {
          const at = added.indexOf(primitive);
          if (at >= 0) added.splice(at, 1);
          return at >= 0;
        },
      },
      postRender: {
        addEventListener(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      },
    },
    readyAll() {
      for (const primitive of added) primitive.setReadyForTest();
    },
    postRender() {
      for (const fn of [...listeners]) fn();
    },
  };
}

/** A square of `sizeDeg` at (lon, lat), encoded as the proxy sends it. */
function square(lon, lat, sizeDeg = 0.0005) {
  return encodeParts([[[[lon, lat], [lon + sizeDeg, lat], [lon + sizeDeg, lat + sizeDeg], [lon, lat + sizeDeg], [lon, lat]]]]);
}

const STYLE = { fill: 0.34, outline: 0.9, widthPx: 1.2 };

test('a redraw keeps the old shapes on the globe until the new ones are built', () => {
  const viewer = fakeViewer();
  const paint = createGroundAreaPaint({ renderReason: 'test' });
  paint.draw(viewer, [{ id: 'a:1', kind: 'plot', record: {}, parts: square(4.85, 45.76), css: '#ff0000' }],
    { style: STYLE, classificationType: 0 });
  assert.equal(paint.drawn(), false, 'nothing is on screen while the first draw builds');
  viewer.readyAll();
  assert.equal(paint.promote(), true);
  const first = [...viewer.added];
  assert.ok(first.every((primitive) => primitive.show === true));

  // A pan: the next box is asked for and starts building.
  paint.draw(viewer, [{ id: 'a:2', kind: 'plot', record: {}, parts: square(4.86, 45.76), css: '#00ff00' }],
    { style: STYLE, classificationType: 0 });
  assert.equal(paint.promote(), false, 'not ready, not swapped');
  assert.ok(first.every((primitive) => viewer.added.includes(primitive) && primitive.show), 'the old draw stays up');
  const building = viewer.added.filter((primitive) => !first.includes(primitive));
  assert.ok(building.length > 0 && building.every((primitive) => primitive.show === false), 'the new one builds hidden');
  assert.equal(paint.stats().pending, true);
  assert.equal(paint.stats().ready, false, 'a harness waiting for `ready` waits for the swap');

  viewer.readyAll();
  assert.equal(paint.promote(), true);
  assert.ok(first.every((primitive) => !viewer.added.includes(primitive)), 'the old draw left in the same swap');
  assert.ok(building.every((primitive) => primitive.show === true));
  assert.equal(paint.stats().ready, true);
  assert.equal(paint.generation(), 2);
});

test('every part and every ring has its own instance id, so a fade reaches all of them', () => {
  const viewer = fakeViewer();
  const paint = createGroundAreaPaint({ renderReason: 'test' });
  // A plot in two parts, the second with a courtyard.
  const parts = [
    ...square(4.85, 45.76),
    [square(4.851, 45.76, 0.002)[0][0], square(4.8515, 45.7605, 0.0005)[0][0]],
  ];
  paint.draw(viewer, [{ id: 'dvf-plot:69381000AB0012', kind: 'plot', record: {}, parts, css: '#ff0000' }],
    { style: STYLE, classificationType: 0 });
  const [fill, outline] = viewer.added;
  const fillIds = fill.geometryInstances.map((instance) => instance.id);
  const ringIds = outline.geometryInstances.map((instance) => instance.id);
  assert.deepEqual(fillIds, ['dvf-plot:69381000AB0012', 'dvf-plot:69381000AB0012#2']);
  assert.deepEqual(ringIds, ['dvf-plot:69381000AB0012', 'dvf-plot:69381000AB0012#2', 'dvf-plot:69381000AB0012#3']);
  assert.ok([...fillIds, ...ringIds].every((id) => id.startsWith('dvf-plot:')), 'the pick prefix is unchanged');

  viewer.readyAll();
  paint.promote();
  assert.equal(paint.fade(0.5), true);
  for (const id of fillIds) assert.equal(fill.attributesForTest.get(id).color[3], Math.round(0.34 * 0.5 * 255));
  for (const id of ringIds) assert.equal(outline.attributesForTest.get(id).color[3], Math.round(0.9 * 0.5 * 255));
  assert.equal(paint.fade(0.5), false, 'an unchanged weight writes nothing');
  paint.setShow(false);
  assert.ok(viewer.added.every((primitive) => primitive.show === false), 'a level at zero is hidden');
});

/** A plots answer and a sections answer over Lyon, as the price proxy sends them. */
function plotsAnswer() {
  return { box: { south: 45.75, west: 4.83, north: 45.77, east: 4.85 }, plots: [{ id: 'P1', parts: square(4.84, 45.76) }] };
}
function sectionsAnswer() {
  return { box: { south: 45.72, west: 4.8, north: 45.8, east: 4.88 }, sections: [{ id: 'S1', parts: square(4.835, 45.755, 0.02) }] };
}

/** A levels controller over a fake viewer and a fake route. */
function levelsFixture({ sections = sectionsAnswer } = {}) {
  const viewer = fakeViewer();
  const asked = [];
  const levels = createScanAreaLevels({
    ownerId: 'test-area',
    names: { fine: 'plots', coarse: 'sections' },
    renderReason: 'test-area',
    endpoint: '/api/test',
    unitOf: (payload) => {
      if (Array.isArray(payload?.plots)) return 'fine';
      return Array.isArray(payload?.sections) ? 'coarse' : null;
    },
    paintOf: (level, payload) => {
      const records = level === 'fine' ? payload.plots : payload.sections;
      const kind = level === 'fine' ? 'plot' : 'section';
      return {
        items: records.map((record) => ({ id: `t-${kind}:${record.id}`, kind, record, parts: record.parts, css: '#3366ff' })),
        style: STYLE,
      };
    },
    coarseParams: (point) => scanCellParams(point),
    fetchImpl: async (url) => {
      asked.push(url);
      return { ok: true, json: async () => sections() };
    },
    eventTarget: null,
  });
  levels._enableForTest(true);
  return { viewer, levels, asked };
}

const LYON = { lat: 45.7603, lon: 4.8406 };
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

test('the band reveals the plots: the old plots view stays theirs once 30 % in', () => {
  assert.deepEqual({ fine: SCAN_AREA_FADE_BAND.fine, coarse: SCAN_AREA_FADE_BAND.coarse }, SCAN_SECTION_FADE);
  assert.deepEqual(scanAreaZoomWeights(1_800), { fine: 0, coarse: 1 });
  const lead = scanAreaZoomWeights(1_544);
  assert.ok(lead.fine > 0.99 && lead.coarse > 0.5, 'plots full, sections still fading');
  assert.deepEqual(scanAreaZoomWeights(1_250), { fine: 1, coarse: 0 }, 'the sections are gone 70 % in');
  for (let altitude = 1_800; altitude >= 1_080; altitude -= 20) {
    const weights = scanAreaZoomWeights(altitude);
    assert.ok(weights.fine + weights.coarse >= 1 - 1e-9, `the layer dipped at ${altitude} m`);
  }
  assert.equal(scanAreaDominant(1_700, { fine: true, coarse: true }), 'coarse');
  assert.equal(scanAreaDominant(1_400, { fine: true, coarse: true }), 'fine');
  assert.equal(scanAreaDominant(1_700, { fine: true, coarse: false }), 'fine', 'one level in hand owns the key');
});

test('a settled view in the band keeps both levels: the shell\'s plots and the sections around the same point', async () => {
  const { viewer, levels, asked } = levelsFixture();
  const plots = plotsAnswer();
  levels.primary(plots, { viewer, point: { ...LYON, altitudeM: 1_700 }, classificationType: 0 });
  await flush();
  assert.equal(asked.length, 1, 'the sections are asked for once');
  const url = new URL(asked[0], 'http://localhost');
  const coarse = scanCellParams({ ...LYON, altitudeM: 1_800 });
  for (const key of ['south', 'west', 'north', 'east']) assert.equal(url.searchParams.get(key), coarse[key]);
  // Built, swapped in, faded at the band's weights.
  viewer.readyAll();
  const arrivals = [];
  const frame = levels._frameForTest(1_700, { arrive: (key) => arrivals.push(key) });
  const zoom = scanAreaZoomWeights(1_700);
  assert.ok(Math.abs(frame.fine - zoom.fine) < 1 / 64 && Math.abs(frame.coarse - zoom.coarse) < 1 / 64);
  assert.ok(frame.fine > 0 && frame.coarse > 0, 'both drawn');
  // High in the band the sections outweigh the plots and own the key.
  assert.equal(frame.dominant, 'sections');
  assert.notEqual(levels.ownerPayload(plots), plots);
  assert.ok(Array.isArray(levels.ownerPayload(plots).sections));
  // Both stay clickable, the plot winning where it lies inside its section.
  assert.equal(levels.shapeAt(4.84025, 45.76025)?.kind, 'plot');
  assert.equal(levels.shapeAt(4.8370, 45.7570)?.kind, 'section');
  assert.equal(levels.payloadOf(levels.shapeAt(4.8370, 45.7570)), levels.ownerPayload(plots));
  // A settle lower in the band hands the key back to the plots, and asks nothing new.
  levels._settleForTest({ ...LYON, altitudeM: 1_300 });
  await flush();
  assert.equal(asked.length, 1, 'the same tile is the same question');
  assert.equal(levels.ownerPayload(plots), plots);
});

test('a view under the band drops the sections, once they have faded to nothing', async () => {
  const { viewer, levels } = levelsFixture();
  const plots = plotsAnswer();
  levels.primary(plots, { viewer, point: { ...LYON, altitudeM: 1_500 }, classificationType: 0 });
  await flush();
  viewer.readyAll();
  levels._frameForTest(1_500);
  assert.equal(levels.stats().levels.sections.held, true);
  levels._settleForTest({ ...LYON, altitudeM: 900 });
  assert.equal(levels.stats().levels.sections.wanted, false);
  const frame = levels._frameForTest(900);
  assert.equal(frame.coarse, 0);
  assert.equal(levels.stats().levels.sections.held, true, 'not dropped inside the frame');
  await flush();
  assert.equal(levels.stats().levels.sections.held, false, 'dropped once at zero');
  assert.equal(levels.ownerPayload(plots), plots);
});

test('a level that replaces the other holds it up until it is drawn, then ramps in over it', async () => {
  const { viewer, levels } = levelsFixture();
  // From 2 500 m the shell answered in sections.
  levels.primary(sectionsAnswer(), { viewer, point: { ...LYON, altitudeM: 2_500 }, classificationType: 0 });
  viewer.readyAll();
  levels._frameForTest(2_500);
  // The reader comes down to 1 000 m: the shell's plots are building.
  levels.primary(plotsAnswer(), { viewer, point: { ...LYON, altitudeM: 1_000 }, classificationType: 0 });
  await flush();
  let frame = levels._frameForTest(1_000);
  assert.equal(frame.coarse, 1, 'the sections hold: nothing has replaced them yet');
  assert.equal(levels.shapeAt(4.8370, 45.7570)?.kind, 'section');
  viewer.readyAll();
  const arrivals = [];
  frame = levels._frameForTest(1_000, { arrive: (key) => arrivals.push(key), arrivals: { fine: 0.5 } });
  assert.deepEqual(arrivals, ['fine'], 'the plots play their arrival over the sections');
  assert.equal(frame.fine, 0.5);
  assert.equal(frame.coarse, 0.5, 'the sections step down in the same proportion');
  frame = levels._frameForTest(1_000);
  assert.equal(frame.coarse, 0);
  await flush();
  assert.equal(levels.stats().levels.sections.held, false);
});

test('the disc under 600 m stays a hard cut: both levels go at once', async () => {
  const { viewer, levels } = levelsFixture();
  levels.primary(plotsAnswer(), { viewer, point: { ...LYON, altitudeM: 1_500 }, classificationType: 0 });
  await flush();
  viewer.readyAll();
  levels._frameForTest(1_500);
  assert.ok(viewer.added.length > 0);
  // The shell drew a disc: the layer clears the levels in the same task.
  levels.clearAll();
  assert.equal(viewer.added.length, 0, 'no fade into the disc — a different question, not a finer reading');
  assert.equal(levels.stats().levels.plots.held, false);
  assert.equal(levels.stats().levels.sections.held, false);
});

test('a shell teardown with no redraw behind it — the dormant ceiling — clears both levels after the task', async () => {
  const { viewer, levels } = levelsFixture();
  levels.primary(plotsAnswer(), { viewer, point: { ...LYON, altitudeM: 1_500 }, classificationType: 0 });
  await flush();
  viewer.readyAll();
  levels._frameForTest(1_500);
  // A redraw: torn down and drawn again in the same task — nothing leaves.
  levels.cleared();
  levels.primary(plotsAnswer(), { viewer, point: { ...LYON, altitudeM: 1_500 }, classificationType: 0 });
  await flush();
  assert.ok(viewer.added.length > 0, 'the old draw is still up while the new one builds');
  // Dormant: torn down and nothing drawn.
  levels.cleared();
  await flush();
  assert.equal(viewer.added.length, 0);
});
