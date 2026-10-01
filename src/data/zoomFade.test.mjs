// src/data/zoomFade.test.mjs
// The arithmetic of fade on zoom, the per-frame read every layer shares, and
// the adapters that write one weight into a primitive.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import {
  ARRIVAL_MS,
  CROSSFADE_OVERLAP,
  FADE_STEPS,
  FADE_UNIFORM,
  _resetZoomFadeForTest,
  arrivalWeight,
  bandAlphas,
  bandPosition,
  bandWeights,
  coverAlphas,
  createFadeColorAppearance,
  crossfade,
  fadeBand,
  fadeCollection,
  fadeFragmentShader,
  fadeInstances,
  fadingColorMaterial,
  getZoomFadeDiagnostics,
  levelVisible,
  quantizeFade,
  readViewScale,
  releaseZoomFade,
  setAppearanceFade,
  watchZoomFade,
} from './zoomFade.js';
import { _resetRenderGovernorForTest, getRenderGovernorDiagnostics } from '../renderGovernor.js';

afterEach(() => {
  _resetZoomFadeForTest();
  _resetRenderGovernorForTest();
});

test('a band refuses ends that are not ordered positive numbers', () => {
  assert.throws(() => fadeBand(0, 1), RangeError);
  assert.throws(() => fadeBand(1, 1), RangeError);
  assert.throws(() => fadeBand(2, 1), RangeError);
  assert.throws(() => fadeBand(Number.NaN, 1), RangeError);
  assert.deepEqual(fadeBand(0.07, 0.12), { fine: 0.07, coarse: 0.12 });
  assert.ok(Object.isFrozen(fadeBand(1, 2)));
});

test('the band position is 1 at the fine end, 0 at the coarse end, and linear in log(scale) between', () => {
  const band = fadeBand(10, 40);
  assert.equal(bandPosition(5, band), 1);
  assert.equal(bandPosition(10, band), 1);
  assert.equal(bandPosition(40, band), 0);
  assert.equal(bandPosition(400, band), 0);
  // 20 is one doubling out of two: halfway, not a third of the way.
  assert.ok(Math.abs(bandPosition(20, band) - 0.5) < 1e-12);
  // The same gesture moves the fade by the same amount at any altitude.
  const high = fadeBand(1000, 4000);
  assert.ok(Math.abs(bandPosition(2000, high) - bandPosition(20, band)) < 1e-12);
});

test('a camera that sees no rectangle is the coarsest view there is', () => {
  const band = fadeBand(1, 2);
  assert.equal(bandPosition(Infinity, band), 0);
  assert.equal(bandPosition(Number.NaN, band), 0);
  assert.equal(bandPosition(undefined, band), 0);
});

test('the crossfade keeps both levels strong mid-band and each at full strength at its own end', () => {
  assert.deepEqual(crossfade(1), { fine: 1, coarse: 0 });
  assert.deepEqual(crossfade(0), { fine: 0, coarse: 1 });
  const middle = crossfade(0.5);
  assert.equal(middle.fine, middle.coarse);
  assert.ok(middle.fine > 0.5 && middle.fine < 1, `mid-band weight ${middle.fine}`);
  assert.ok(Math.abs(middle.fine - 0.5 / (1 - CROSSFADE_OVERLAP)) < 1e-12);
  // Each ramp reaches full strength before the far end of the band.
  assert.equal(crossfade(1 - CROSSFADE_OVERLAP).fine, 1);
  assert.equal(crossfade(CROSSFADE_OVERLAP).coarse, 1);
  // No overlap at all is a hard cut, still well-defined.
  assert.deepEqual(crossfade(0.4, 1), { fine: 1, coarse: 1 });
});

test('the coarse level is falling as the fine one is rising, across the whole band', () => {
  const band = fadeBand(0.07, 0.12);
  let previous = { fine: -1, coarse: 2 };
  for (let scale = 0.13; scale >= 0.06; scale -= 0.0025) {
    const weights = bandWeights(scale, band);
    assert.ok(weights.fine >= previous.fine, `fine weight fell at ${scale}`);
    assert.ok(weights.coarse <= previous.coarse, `coarse weight rose at ${scale}`);
    assert.ok(weights.fine + weights.coarse >= 1 - 1e-12, `the layer dipped at ${scale}`);
    previous = weights;
  }
});

test('a level holds full strength until the level replacing it is drawn', () => {
  const band = fadeBand(0.07, 0.12);
  const mid = 0.0917; // about the middle of the band, in log terms
  const zoom = bandWeights(mid, band);
  // Mid-gesture, the finer level is still a request in flight: the coarse
  // level does not dim for it.
  assert.equal(bandAlphas(mid, band, { coarseReady: true }).coarse, 1);
  // Even past the fine end, the coarse level covers until the fine one lands.
  assert.equal(bandAlphas(0.05, band, { coarseReady: true }).coarse, 1);
  // And the other way: zooming out, the fine level holds for a missing coarse one.
  assert.equal(bandAlphas(mid, band, { fineReady: true }).fine, 1);
  // Both on screen: the zoom weights, exactly.
  const both = bandAlphas(mid, band, { fineReady: true, coarseReady: true });
  assert.ok(Math.abs(both.fine - zoom.fine) < 1e-12 && Math.abs(both.coarse - zoom.coarse) < 1e-12);
  // Nothing drawn, nothing to show.
  assert.deepEqual(
    { fine: bandAlphas(mid, band, {}).fine, coarse: bandAlphas(mid, band, {}).coarse },
    { fine: 0, coarse: 0 },
  );
});

test('while the finer level ramps in, the coarse one steps down in the same proportion', () => {
  const band = fadeBand(0.07, 0.12);
  const scale = 0.05; // below the band: the fine level alone, once it is in
  let previous = { fine: -1, coarse: 2 };
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const alphas = bandAlphas(scale, band, { fineReady: true, coarseReady: true, fineArrival: t });
    assert.ok(Math.abs(alphas.fine - t) < 1e-12, `fine follows its ramp at ${t}`);
    assert.ok(Math.abs(alphas.coarse - (1 - t)) < 1e-12, `coarse steps down at ${t}`);
    assert.ok(alphas.fine >= previous.fine && alphas.coarse <= previous.coarse);
    previous = alphas;
  }
});

test('a hard cut swaps without a blank frame: the outgoing level holds, then the two cross', () => {
  const cut = { fine: 1, coarse: 0 };
  // The incoming level is still in flight: the outgoing one stays at full strength.
  assert.deepEqual(coverAlphas(cut, { coarseReady: true }), { fine: 0, coarse: 1 });
  // Halfway through the incoming level's ramp, the outgoing one is halfway out.
  assert.deepEqual(coverAlphas(cut, { coarseReady: true, fineReady: true, fineArrival: 0.5 }), { fine: 0.5, coarse: 0.5 });
  assert.deepEqual(coverAlphas(cut, { coarseReady: true, fineReady: true }), { fine: 1, coarse: 0 });
  // A target outside 0..1 is clamped rather than overshooting.
  assert.deepEqual(coverAlphas({ fine: 3, coarse: -1 }, { fineReady: true, coarseReady: true }), { fine: 1, coarse: 0 });
});

test('weights are written on a fixed grid of steps, so a drifting camera writes nothing', () => {
  assert.equal(quantizeFade(0), 0);
  assert.equal(quantizeFade(1), 1);
  assert.equal(quantizeFade(-3), 0);
  assert.equal(quantizeFade(7), 1);
  assert.equal(quantizeFade(0.5 + 0.1 / FADE_STEPS), 0.5);
  assert.equal(quantizeFade(0.4 / FADE_STEPS), 0, 'a sliver of weight is no weight');
  assert.equal(levelVisible(true, 0.4 / FADE_STEPS), false);
  assert.equal(levelVisible(true, 0.5), true);
  assert.equal(levelVisible(false, 1), false);
});

test('the arrival ramp eases from 0 to 1 over its duration', () => {
  assert.equal(arrivalWeight(0), 0);
  assert.equal(arrivalWeight(ARRIVAL_MS), 1);
  assert.equal(arrivalWeight(ARRIVAL_MS * 4), 1);
  assert.equal(arrivalWeight(ARRIVAL_MS / 2), 0.5);
  assert.ok(arrivalWeight(ARRIVAL_MS / 4) < 0.25, 'smoothstep starts slower than linear');
  assert.equal(arrivalWeight(10, 0), 1, 'no duration is no ramp');
});

/** A viewer whose camera sees a fixed rectangle, with a preRender event. */
function fakeViewer({ south = 45, north = 45.1, west = 4.8, east = 4.95, height = 9000 } = {}) {
  const listeners = new Set();
  const rect = new Cesium.Rectangle(
    Cesium.Math.toRadians(west), Cesium.Math.toRadians(south),
    Cesium.Math.toRadians(east), Cesium.Math.toRadians(north),
  );
  const viewer = {
    rect,
    camera: {
      positionCartographic: { height },
      computeViewRectangle: () => viewer.rect,
    },
    scene: {
      globe: { ellipsoid: Cesium.Ellipsoid.WGS84 },
      requestRenderMode: true,
      requestRender() {},
      preRender: {
        addEventListener(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      },
    },
    render() {
      for (const fn of [...listeners]) fn();
    },
    listenerCount: () => listeners.size,
  };
  return viewer;
}

test('the view scale reports both spans and the altitude, and Infinity past the limb', () => {
  const viewer = fakeViewer();
  const scale = readViewScale(viewer);
  assert.ok(Math.abs(scale.latSpan - 0.1) < 1e-9);
  assert.ok(Math.abs(scale.lonSpan - 0.15) < 1e-9);
  assert.equal(scale.heightM, 9000);
  viewer.rect = undefined;
  assert.deepEqual(readViewScale(viewer), { box: null, latSpan: Infinity, lonSpan: Infinity, heightM: 9000 });
  // An antimeridian-crossing rectangle is read as the coarsest view too.
  viewer.rect = new Cesium.Rectangle(Cesium.Math.toRadians(170), 0, Cesium.Math.toRadians(-170), 0.1);
  assert.equal(readViewScale(viewer).lonSpan, Infinity);
});

test('subscribers share one preRender listener, and the last one out removes it', () => {
  const viewer = fakeViewer();
  const seen = [];
  const a = watchZoomFade(viewer, 'a', (scale) => seen.push(['a', scale.heightM]));
  watchZoomFade(viewer, 'b', (scale) => seen.push(['b', scale.heightM]));
  assert.equal(viewer.listenerCount(), 1);
  viewer.render();
  assert.deepEqual(seen, [['a', 9000], ['b', 9000]]);
  a.release();
  assert.equal(viewer.listenerCount(), 1);
  releaseZoomFade('b');
  assert.equal(viewer.listenerCount(), 0);
  assert.equal(getZoomFadeDiagnostics().listening, false);
});

test('resubscribing the same owner replaces its callback instead of doubling it', () => {
  const viewer = fakeViewer();
  let first = 0;
  let second = 0;
  watchZoomFade(viewer, 'layer', () => { first += 1; });
  watchZoomFade(viewer, 'layer', () => { second += 1; });
  viewer.render();
  assert.equal(first, 0);
  assert.equal(second, 1);
});

test('an arrival holds continuous render for exactly the length of its ramp', async () => {
  const viewer = fakeViewer();
  const weights = [];
  const handle = watchZoomFade(viewer, 'layer', (scale, t) => weights.push(handle.arrival('cells', t)), { arrivalMs: 30 });
  assert.equal(handle.arrival('cells'), 1, 'no ramp is full strength');
  handle.arrive('cells');
  assert.deepEqual(getRenderGovernorDiagnostics().holds, ['zoom-fade:layer']);
  assert.equal(handle.arriving(), true);
  viewer.render();
  assert.ok(weights.at(-1) < 1);
  await new Promise((resolve) => setTimeout(resolve, 45));
  viewer.render();
  assert.equal(weights.at(-1), 1, 'the last frame of a ramp is drawn at full strength');
  assert.equal(handle.arriving(), false);
  assert.deepEqual(getRenderGovernorDiagnostics().holds, []);
});

test('releasing a layer mid-ramp releases its render hold', () => {
  const viewer = fakeViewer();
  const handle = watchZoomFade(viewer, 'layer', () => {});
  handle.arrive('cells');
  assert.deepEqual(getRenderGovernorDiagnostics().holds, ['zoom-fade:layer']);
  handle.release();
  assert.deepEqual(getRenderGovernorDiagnostics().holds, []);
  handle.arrive('cells');
  assert.deepEqual(getRenderGovernorDiagnostics().holds, [], 'a released handle cannot take a hold again');
});

test('under prefers-reduced-motion an arrival is instant and holds nothing', () => {
  const viewer = fakeViewer();
  const original = globalThis.matchMedia;
  globalThis.matchMedia = (query) => ({ matches: query.includes('reduce') });
  try {
    const handle = watchZoomFade(viewer, 'layer', () => {});
    handle.arrive('cells');
    assert.equal(handle.arrival('cells'), 1);
    assert.deepEqual(getRenderGovernorDiagnostics().holds, []);
  } finally {
    globalThis.matchMedia = original;
  }
});

test('a frame callback that throws does not stop the other layers', () => {
  const viewer = fakeViewer();
  let ran = false;
  const warn = console.warn;
  console.warn = () => {};
  try {
    watchZoomFade(viewer, 'broken', () => { throw new Error('boom'); });
    watchZoomFade(viewer, 'fine', () => { ran = true; });
    viewer.render();
  } finally {
    console.warn = warn;
  }
  assert.equal(ran, true);
});

test('frame() runs the callback now and report() reaches the diagnostics', () => {
  const viewer = fakeViewer({ height: 1234 });
  const handle = watchZoomFade(viewer, 'layer', () => handle.report({ fine: 0.25 }));
  handle.frame();
  const [owner] = getZoomFadeDiagnostics().owners;
  assert.equal(owner.ownerId, 'layer');
  assert.equal(owner.scale.heightM, 1234);
  assert.deepEqual(owner.state, { fine: 0.25 });
});

test('the fade shader multiplies the alpha of whatever the original main computed', () => {
  const wrapped = fadeFragmentShader('in vec4 v_color;\nvoid main()\n{\n    out_FragColor = v_color;\n}\n');
  assert.match(wrapped, /void zoomFade_main\(\)/);
  assert.match(wrapped, new RegExp(`uniform float ${FADE_UNIFORM};`));
  assert.match(wrapped, new RegExp(`out_FragColor\\.a \\*= ${FADE_UNIFORM};`));
  assert.equal(wrapped.match(/void main\(\)/g).length, 1, 'exactly one entry point');
  assert.throws(() => fadeFragmentShader('void notMain() {}'), /no main/);
});

test('the fade appearance stays a PerInstanceColorAppearance and writes on step changes only', () => {
  const appearance = createFadeColorAppearance({ flat: true, closed: false });
  assert.ok(appearance instanceof Cesium.PerInstanceColorAppearance);
  assert.equal(appearance.translucent, true);
  assert.match(appearance.getFragmentShaderSource(), /#define FLAT/);
  assert.match(appearance.getFragmentShaderSource(), /zoomFade_main/);
  assert.equal(appearance.uniforms[FADE_UNIFORM], 1);
  assert.equal(setAppearanceFade(appearance, 0.5), true);
  assert.equal(appearance.uniforms[FADE_UNIFORM], 0.5);
  assert.equal(setAppearanceFade(appearance, 0.5 + 0.1 / FADE_STEPS), false);
  assert.equal(setAppearanceFade({}, 0.5), false);
  // Forced translucent even when asked otherwise: a fade needs blending.
  assert.equal(createFadeColorAppearance({ translucent: false }).translucent, true);
});

test('a collection fades from each item\'s own alpha, outline included, and follows a recolour', () => {
  const points = new Cesium.PointPrimitiveCollection();
  const a = points.add({ position: Cesium.Cartesian3.fromDegrees(2, 48), color: Cesium.Color.RED.withAlpha(0.8), outlineColor: Cesium.Color.WHITE.withAlpha(0.5) });
  const b = points.add({ position: Cesium.Cartesian3.fromDegrees(3, 48), color: Cesium.Color.BLUE.withAlpha(0.4) });
  assert.equal(fadeCollection(points, 0.5), true);
  assert.ok(Math.abs(a.color.alpha - 0.4) < 1e-9);
  assert.ok(Math.abs(a.outlineColor.alpha - 0.25) < 1e-9);
  assert.ok(Math.abs(b.color.alpha - 0.2) < 1e-9);
  assert.equal(a.color.red, 1, 'the hue is left alone');
  assert.equal(fadeCollection(points, 0.5), false, 'an unchanged weight writes nothing');
  // The layer recolours an item at full strength: that becomes its new base.
  a.color = Cesium.Color.LIME.withAlpha(0.6);
  assert.equal(fadeCollection(points, 0.5, { force: true }), true);
  assert.ok(Math.abs(a.color.alpha - 0.3) < 1e-9);
  assert.equal(a.color.green, 1);
  fadeCollection(points, 1);
  assert.ok(Math.abs(a.color.alpha - 0.6) < 1e-9);
  assert.ok(Math.abs(b.color.alpha - 0.4) < 1e-9, 'full strength restores the layer\'s own alpha');
  assert.equal(fadeCollection(null, 1), false);
});

test('instance fades wait for a ready primitive and look each attribute up once', () => {
  let lookups = 0;
  const stored = new Map([['x', { color: new Uint8Array([255, 0, 0, 200]) }], ['y', { color: new Uint8Array([0, 0, 255, 100]) }]]);
  const primitive = {
    ready: false,
    getGeometryInstanceAttributes(id) {
      lookups += 1;
      return stored.get(id);
    },
  };
  const entries = [['x', Cesium.Color.RED.withAlpha(0.8)], ['y', Cesium.Color.BLUE.withAlpha(0.4)], ['gone', Cesium.Color.RED]];
  assert.equal(fadeInstances(primitive, entries, 0.5), false, 'nothing before ready');
  primitive.ready = true;
  assert.equal(fadeInstances(primitive, entries, 0.5), true);
  assert.equal(stored.get('x').color[3], Math.round(0.4 * 255));
  assert.equal(stored.get('y').color[3], Math.round(0.2 * 255));
  assert.equal(fadeInstances(primitive, entries, 0.5), false, 'unchanged weight');
  fadeInstances(primitive, entries, 1);
  assert.equal(stored.get('x').color[3], Math.round(0.8 * 255));
  assert.equal(lookups, 3, 'one lookup per id, the missing one included');
});

test('an entity colour follows the weight and never turns opaque', () => {
  let weight = 1;
  const material = fadingColorMaterial(Cesium.Color.ORANGE, () => weight);
  assert.equal(material.isConstant, false);
  const time = Cesium.JulianDate.now();
  assert.equal(material.color.getValue(time).alpha, 0.99);
  weight = 0.5;
  assert.ok(Math.abs(material.color.getValue(time).alpha - 0.5) < 1e-9);
  assert.equal(material.color.getValue(time).red, Cesium.Color.ORANGE.red);
});
