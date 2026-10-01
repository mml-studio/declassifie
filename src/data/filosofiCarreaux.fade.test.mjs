// src/data/filosofiCarreaux.fade.test.mjs
// Fade on zoom over the carroyage: where each band sits and why, which levels a
// settled view loads, and the alpha each of the four levels is drawn at.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import filosofiCarreauxLayer, {
  FILOSOFI_GRID_BAND,
  FILOSOFI_MAX_BOX_DEG,
  FILOSOFI_TERRITORY_BAND,
  filosofiCountMetric,
  filosofiGridPlan,
  filosofiLevelAlphas,
  filosofiTerritoryPlan,
  filosofiViewScale,
} from './filosofiCarreaux.js';
import { resolutionForBox, resolveMetric } from './filosofiFeed.js';
import { levelForBox, resolveTerritoryMetric } from './filosofiTerritoiresFeed.js';
import { snapBoxOutward } from './viewportBox.js';

const NIVEAU = resolveMetric('niveau');
const POPULATION = resolveMetric('population');

test('the 200 m grid is only ever asked for where the old rule asked for it', () => {
  // The band is measured on the CAMERA's box; the request is that box snapped
  // outward onto the 0.01° grid, and only a snapped box `resolutionForBox`
  // calls fine may carry `resolution=200` — wherever the box falls against the
  // snapping grid and whatever the window's shape.
  let fine = 0;
  for (let scale = 0.05; scale <= 0.14; scale += 0.004) {
    for (const offset of [0, 0.0001, 0.0049, 0.005, 0.0099]) {
      for (const aspect of [0.5, 1, 1.5, 2.4]) {
        const lat = scale;
        const lon = Math.min(lat * aspect, lat / 0.66);
        const box = { south: 45.7 + offset, west: 4.8 + offset, north: 45.7 + offset + lat, east: 4.8 + offset + lon };
        const allowed = resolutionForBox(snapBoxOutward(box, 0.01));
        const plan = filosofiGridPlan(filosofiViewScale(box), NIVEAU, allowed);
        if (plan.wanted.includes(200)) {
          fine += 1;
          assert.equal(allowed, 200, `scale ${scale}, offset ${offset}, aspect ${aspect}`);
        }
      }
    }
  }
  assert.ok(fine > 0, 'the precondition: some of these views do ask for the fine grid');
});

test('the city view the harness checks is still a 200 m view', () => {
  // Lyon from 9 km at −75° on a 1600 × 1000 window measures 0.101.
  const plan = filosofiGridPlan(0.101, NIVEAU, 200);
  assert.deepEqual(plan.wanted, [200, 1000]);
  assert.equal(plan.dominant, 200);
  const alphas = filosofiLevelAlphas({
    regime: 'carreaux', gridPosition: plan.position, territoryPosition: 1, ready: { 200: true, 1000: true },
  });
  assert.equal(alphas[200], 1);
  assert.ok(alphas[1000] > 0 && alphas[1000] < 1, `the 1 km grid is fading behind it (${alphas[1000]})`);
});

test('the bands are ordered and do not overlap the grid ceiling', () => {
  assert.ok(FILOSOFI_GRID_BAND.coarse < FILOSOFI_MAX_BOX_DEG, 'the grid band sits under the ceiling');
  assert.ok(FILOSOFI_TERRITORY_BAND.fine > FILOSOFI_MAX_BOX_DEG * 1.6, 'the territory band sits above it');
  // The territory band ends where `levelForBox` switched: same meaning on its coarse side.
  const above = { south: 40, west: 0, north: 40 + FILOSOFI_TERRITORY_BAND.coarse + 0.5, east: 2 };
  assert.equal(levelForBox(above), 'REG');
  // Both bands span between half and one zoom level.
  for (const band of [FILOSOFI_GRID_BAND, FILOSOFI_TERRITORY_BAND]) {
    const ratio = band.coarse / band.fine;
    assert.ok(ratio >= 1.5 && ratio <= 2, `ratio ${ratio}`);
  }
});

test('only a count indicator is held to a hard cut', () => {
  assert.equal(filosofiCountMetric(POPULATION), true);
  assert.equal(filosofiCountMetric(resolveTerritoryMetric('population')), true);
  for (const id of ['niveau', 'pauvrete', 'social', 'jeunes', 'aines', 'proprietaires', 'solo']) {
    assert.equal(filosofiCountMetric(resolveMetric(id)), false, id);
  }
});

test('a settled view loads the grids its band gives weight to', () => {
  assert.deepEqual(filosofiGridPlan(0.04, NIVEAU).wanted, [200]);
  assert.deepEqual(filosofiGridPlan(0.08, NIVEAU).wanted, [200, 1000]);
  assert.deepEqual(filosofiGridPlan(0.2, NIVEAU).wanted, [1000]);
  assert.deepEqual(filosofiGridPlan(Infinity, NIVEAU).wanted, [1000]);
  // A fine request the proxy rule refuses is never made, band or not.
  assert.deepEqual(filosofiGridPlan(0.04, NIVEAU, 1000).wanted, [1000]);
});

test('the row belongs to the stronger grid, and a count belongs to the fine one', () => {
  assert.equal(filosofiGridPlan(0.065, NIVEAU).dominant, 200);
  assert.equal(filosofiGridPlan(0.095, NIVEAU).dominant, 200);
  assert.equal(filosofiGridPlan(0.118, NIVEAU).dominant, 1000);
  // Paris from 9 km at −75°: the two grids cross at 0.7 each, and the row
  // belongs to the detail the reader zoomed in for.
  assert.equal(filosofiGridPlan(0.108, NIVEAU).dominant, 200);
  // A count shows the 200 m grid alone wherever it has weight.
  assert.equal(filosofiGridPlan(0.118, POPULATION).dominant, 200);
  assert.equal(filosofiGridPlan(0.2, POPULATION).dominant, 1000);
});

test('a settled view loads the territory levels its band gives weight to', () => {
  const niveau = resolveTerritoryMetric('niveau');
  assert.deepEqual(filosofiTerritoryPlan(3, niveau), { position: 1, wanted: ['DEP'], dominant: 'DEP' });
  assert.deepEqual(filosofiTerritoryPlan(16, niveau).wanted, ['REG']);
  const mid = filosofiTerritoryPlan(9, niveau);
  assert.deepEqual(mid.wanted, ['DEP', 'REG']);
  assert.equal(filosofiTerritoryPlan(11.5, niveau).dominant, 'REG');
  assert.equal(filosofiTerritoryPlan(11.5, resolveTerritoryMetric('population')).dominant, 'DEP');
});

const ALL_READY = { 200: true, 1000: true, DEP: true, REG: true };

test('inside the grid band both grids are drawn, the 1 km fading as the 200 m comes in', () => {
  let previous = null;
  for (const position of [0, 0.25, 0.5, 0.75, 1]) {
    const alphas = filosofiLevelAlphas({
      regime: 'carreaux', gridPosition: position, territoryPosition: 1, ready: ALL_READY,
    });
    assert.equal(alphas.DEP, 0);
    assert.equal(alphas.REG, 0);
    if (previous) {
      assert.ok(alphas[200] >= previous[200]);
      assert.ok(alphas[1000] <= previous[1000]);
    }
    previous = alphas;
  }
  // Where the two cross, both are strong: the layer does not thin out.
  const crossing = filosofiLevelAlphas({ regime: 'carreaux', gridPosition: 0.2, territoryPosition: 1, ready: ALL_READY });
  assert.ok(crossing[200] > 0.5 && crossing[1000] > 0.5, 'both strong where they cross');
});

test('a count indicator swaps grids on a cut, never a blend', () => {
  for (const position of [0.01, 0.5, 0.99]) {
    const alphas = filosofiLevelAlphas({
      regime: 'carreaux', gridPosition: position, territoryPosition: 1, gridCut: true, ready: ALL_READY,
    });
    assert.deepEqual([alphas[200], alphas[1000]], [1, 0], `position ${position}`);
  }
  const outside = filosofiLevelAlphas({
    regime: 'carreaux', gridPosition: 0, territoryPosition: 1, gridCut: true, ready: ALL_READY,
  });
  assert.deepEqual([outside[200], outside[1000]], [0, 1]);
});

test('the 1 km grid covers until the 200 m one is drawn, even past the band', () => {
  const alphas = filosofiLevelAlphas({
    regime: 'carreaux', gridPosition: 1, territoryPosition: 1, ready: { 1000: true },
  });
  assert.equal(alphas[1000], 1);
  assert.equal(alphas[200], 0);
});

test('the territories and the grid are a cut: the one leaving holds until the one arriving is drawn', () => {
  // Zooming in past the ceiling: the départements hold while the grid loads.
  const loading = filosofiLevelAlphas({
    regime: 'carreaux', gridPosition: 0, territoryPosition: 1, ready: { DEP: true },
  });
  assert.deepEqual(loading, { 200: 0, 1000: 0, DEP: 1, REG: 0 });
  // Halfway through the grid's arrival, the two regimes have crossed halfway.
  const crossing = filosofiLevelAlphas({
    regime: 'carreaux',
    gridPosition: 0,
    territoryPosition: 1,
    ready: { 1000: true, DEP: true },
    arrival: (key) => (key === 'grids' ? 0.5 : 1),
  });
  assert.equal(crossing[1000], 0.5);
  assert.equal(crossing.DEP, 0.5);
  // At rest, one regime only — never both datasets on screen.
  const rest = filosofiLevelAlphas({
    regime: 'carreaux', gridPosition: 0, territoryPosition: 1, ready: { 1000: true, DEP: true },
  });
  assert.deepEqual(rest, { 200: 0, 1000: 1, DEP: 0, REG: 0 });
  const back = filosofiLevelAlphas({
    regime: 'territoires', gridPosition: 0, territoryPosition: 1, ready: { 1000: true, DEP: true },
  });
  assert.deepEqual(back, { 200: 0, 1000: 0, DEP: 1, REG: 0 });
});

test('the régions fade into the départements across their band', () => {
  const alphas = filosofiLevelAlphas({
    regime: 'territoires', gridPosition: 0, territoryPosition: 0.2, ready: { DEP: true, REG: true },
  });
  assert.ok(alphas.DEP > 0.5 && alphas.REG > 0.5);
  assert.equal(alphas[1000], 0);
  const cut = filosofiLevelAlphas({
    regime: 'territoires', gridPosition: 0, territoryPosition: 0.5, territoryCut: true, ready: { DEP: true, REG: true },
  });
  assert.deepEqual([cut.DEP, cut.REG], [1, 0]);
});

// ── The layer, end to end, against a stubbed proxy ──────────────────────────

function createViewer(box) {
  const state = { box, added: [], removed: [] };
  return {
    state,
    scene: {
      globe: { ellipsoid: Cesium.Ellipsoid.WGS84, getHeight: () => 170, show: true },
      primitives: {
        add: (primitive) => { state.added.push(primitive); return primitive; },
        remove: (primitive) => { state.removed.push(primitive); return true; },
      },
      requestRender() {},
    },
    camera: {
      positionCartographic: { height: 9000 },
      computeViewRectangle: () => Cesium.Rectangle.fromDegrees(
        state.box.west, state.box.south, state.box.east, state.box.north,
      ),
    },
  };
}

const CELL = Object.freeze({
  n: 2_531_400, e: 3_918_600, ind: 538.5, men: 274, niveau: 22_872, pauvrete: 16.8,
  social: 28.5, surface: 68.5, jeunes: 22.8, aines: 8.9, proprietaires: 29.6,
  solo: 47.4, est: 0, com: '69381',
});

async function withProxy(run) {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    const resolution = Number(new URL(String(url), 'http://x').searchParams.get('resolution'));
    return new Response(JSON.stringify({
      resolution, cells: [CELL], communes: {}, matched: 1, returned: 1, truncated: false,
      summary: { cells: 1, people: 538 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    return await run(requests);
  } finally {
    globalThis.fetch = original;
  }
}

/** A Lyon box whose scale (`max(lat, 0.66 × lon)`) is `scale`, latitude-led. */
function lyonBox(scale) {
  return { south: 45.70, west: 4.80, north: 45.70 + scale, east: 4.80 + scale };
}

test('inside the band the layer asks for both grids; outside it, for one', async () => {
  await withProxy(async (requests) => {
    const viewer = createViewer(lyonBox(0.08));
    filosofiCarreauxLayer.init(viewer);
    filosofiCarreauxLayer.enable(viewer);
    try {
      await filosofiCarreauxLayer.update();
      const resolutions = requests.map((url) => new URL(url, 'http://x').searchParams.get('resolution')).sort();
      assert.deepEqual(resolutions, ['1000', '200']);
      // Each grid built its own primitive, hidden until Cesium reports it ready.
      assert.equal(viewer.state.added.length, 2);
      assert.ok(viewer.state.added.every((primitive) => primitive.show === false));

      requests.length = 0;
      viewer.state.box = lyonBox(0.04);
      await filosofiCarreauxLayer.update();
      assert.deepEqual(requests.map((url) => new URL(url, 'http://x').searchParams.get('resolution')), ['200']);

      requests.length = 0;
      viewer.state.box = lyonBox(0.3);
      await filosofiCarreauxLayer.update();
      assert.deepEqual(requests.map((url) => new URL(url, 'http://x').searchParams.get('resolution')), ['1000']);
      assert.equal(filosofiCarreauxLayer.getStats().resolution, 1000, 'the row follows the grid that owns it');
    } finally {
      filosofiCarreauxLayer.destroy(viewer);
    }
  });
});

test('nothing is removed from the globe before its replacement is ready', async () => {
  await withProxy(async () => {
    const viewer = createViewer(lyonBox(0.04));
    filosofiCarreauxLayer.init(viewer);
    filosofiCarreauxLayer.enable(viewer);
    try {
      await filosofiCarreauxLayer.update();
      assert.equal(viewer.state.added.length, 1);
      // Cesium finished building it.
      viewer.state.added[0]._ready = true;
      // A pan: a new box, the same grid. The redraw is built beside the drawing
      // it replaces; the old one is not removed while the new one is pending.
      viewer.state.box = { ...lyonBox(0.04), south: 45.75, north: 45.79 };
      await filosofiCarreauxLayer.update();
      assert.equal(viewer.state.added.length, 2);
      assert.equal(viewer.state.removed.length, 0);
      assert.equal(viewer.state.added[0].show, true, 'the drawing in place stays on screen');
      assert.equal(viewer.state.added[1].show, false, 'its replacement waits, hidden');
    } finally {
      filosofiCarreauxLayer.destroy(viewer);
    }
  });
});
