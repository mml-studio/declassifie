/**
 * @module zoomFade
 *
 * Fade on zoom: a layer that draws the same data at several aggregation
 * levels crossfades between them as the camera climbs or descends, instead of
 * swapping one for the other on a threshold.
 *
 * THE PROBLEM. Thirteen layers on the globe change level on a hard cut — a
 * région disc becomes a département disc, a 1 km cell becomes twenty-five
 * 200 m cells, a national prism becomes a field of sites — and the swap reads
 * as the map reloading: the eye loses the place it was looking at, because
 * nothing on screen survives the cut. The cartographic answer (Kyle Walker's
 * "fade on zoom") is to give each level an opacity that is a function of the
 * scale, so the coarse level is still there, fading, while the finer one comes
 * in over it, and every level is at full strength somewhere.
 *
 * WHAT A BAND IS. Each threshold a layer already switches on becomes a band of
 * scale between two ends, `fine` and `coarse`, in the unit the layer already
 * measures the camera in (a view span in degrees, or an altitude in metres —
 * larger is coarser in both). Below `fine` only the finer level is drawn, above
 * `coarse` only the coarser one, and between the two both are, at the weights
 * `crossfade()` gives them. The weight is interpolated on the LOGARITHM of the
 * scale, because a zoom is a multiplication: halving the altitude is the same
 * gesture at 900 km and at 9 km, and should move the fade by the same amount.
 *
 * WHERE IT MUST NOT BE USED. Fading two levels into each other claims they are
 * the same statistic at two resolutions. Two levels that are different datasets,
 * or the same six colours on different breaks, or whose alpha already carries a
 * value, would show one colour meaning two things for as long as the camera
 * rests in the band. Those keep their hard cut, on purpose, and say why where
 * they make it.
 *
 * WHAT THIS MODULE OWNS, AND WHAT IT DOES NOT. It owns the arithmetic, one
 * per-frame read of the camera for every subscribed layer, the short ramp a
 * level plays when its data arrives, and the adapters that apply one weight to
 * a primitive cheaply. It does not decide which levels a layer loads: each
 * layer keeps both levels of a band drawn while the camera is in it, and drops
 * a level only once its weight is zero.
 */
import * as Cesium from 'cesium';
import { holdContinuousRender, releaseContinuousRender } from '../renderGovernor.js';

// ---------------------------------------------------------------------------
// The arithmetic
// ---------------------------------------------------------------------------

/**
 * Share of a band over which BOTH levels are above zero at once.
 *
 * With complementary weights (`w` and `1 - w`) the middle of the band shows two
 * levels at half strength each, and over a light basemap that reads as the
 * layer fading out altogether. Each ramp instead covers 70 % of the band, so at
 * the midpoint both levels are at 0.71 and the layer keeps its weight on screen
 * while it changes level.
 */
export const CROSSFADE_OVERLAP = 0.3;

/**
 * Number of distinct weights a level is ever written at.
 *
 * Writing a weight costs something for every adapter but the shader uniform: a
 * colour per point, an attribute per instance. 64 steps is finer than an eye
 * can separate on a translucent fill (1.6 % of alpha per step) and turns a
 * camera that drifts by a metre into no write at all.
 */
export const FADE_STEPS = 64;

/** Duration of the ramp a level plays when its data arrives (ms). */
export const ARRIVAL_MS = 260;

/**
 * One fade band, validated.
 *
 * @param {number} fine Scale at and below which only the finer level is drawn.
 * @param {number} coarse Scale at and above which only the coarser level is drawn.
 * @returns {{fine: number, coarse: number}}
 */
export function fadeBand(fine, coarse) {
  if (!(Number.isFinite(fine) && fine > 0)) throw new RangeError(`fadeBand: fine end must be a positive number, got ${fine}`);
  if (!(Number.isFinite(coarse) && coarse > fine)) {
    throw new RangeError(`fadeBand: coarse end must be larger than the fine end (${fine}), got ${coarse}`);
  }
  return Object.freeze({ fine, coarse });
}

/**
 * Where the camera stands in a band: 1 at or below its fine end, 0 at or above
 * its coarse end, linear in log(scale) between.
 *
 * A scale that is not a number at all is the camera looking past the limb at
 * the whole planet — the coarsest view there is, so 0.
 *
 * @param {number} scale The layer's own measure of the camera (span or altitude).
 * @param {{fine: number, coarse: number}} band
 * @returns {number} 0..1
 */
export function bandPosition(scale, band) {
  if (!(scale < band.coarse)) return 0;
  if (scale <= band.fine) return 1;
  return 1 - Math.log(scale / band.fine) / Math.log(band.coarse / band.fine);
}

/**
 * The two levels' weights at one position in a band.
 *
 * @param {number} position `bandPosition()` result, 0 (coarse) .. 1 (fine).
 * @param {number} [overlap]
 * @returns {{fine: number, coarse: number}}
 */
export function crossfade(position, overlap = CROSSFADE_OVERLAP) {
  const p = clamp01(position);
  const ramp = 1 - clamp01(overlap);
  if (ramp <= 0) return { fine: p > 0 ? 1 : 0, coarse: p < 1 ? 1 : 0 };
  return { fine: clamp01(p / ramp), coarse: clamp01((1 - p) / ramp) };
}

/** Where a `reveal` has brought the finer level to full strength. */
export const REVEAL_LEAD = 0.3;
/** Where a `reveal` has faded the coarser level out. */
export const REVEAL_TRAIL = 0.7;

/**
 * The two levels' weights when the finer level is what the reader zoomed in
 * FOR: it comes in over the first 30 % of the band, and the coarser one fades
 * out behind it over the first 70 %.
 *
 * This is the shape of Kyle Walker's maps — "higher-aggregation layers fade
 * away to show more detail" — and the one to use where a band can only sit on
 * the fine side of an old threshold (because the finer level's request is
 * capped there): a symmetric crossfade would hand most of the band to the
 * coarse level, and a view that used to show the detail would show the
 * aggregate instead.
 *
 * @param {number} position `bandPosition()` result, 0 (coarse) .. 1 (fine).
 * @returns {{fine: number, coarse: number}}
 */
export function reveal(position) {
  const p = clamp01(position);
  return { fine: clamp01(p / REVEAL_LEAD), coarse: clamp01(1 - p / REVEAL_TRAIL) };
}

/**
 * Both levels' weights straight from the camera's scale.
 *
 * @param {number} scale
 * @param {{fine: number, coarse: number}} band
 * @returns {{fine: number, coarse: number}}
 */
export function bandWeights(scale, band) {
  return crossfade(bandPosition(scale, band));
}

/**
 * The alphas a band's two levels are actually DRAWN at, given which of them
 * is on screen yet.
 *
 * The zoom weights alone would make a layer fade out mid-gesture: a camera
 * zooming through the band dims the coarse level at once, while the finer one
 * is still a request in flight (layers fetch on `moveEnd`, never per frame).
 * So a level stands in for a partner that is missing: it holds full strength
 * until the partner is drawn, and while the partner's arrival ramp runs it
 * steps down to its own zoom weight in the same proportion. Nothing goes dim
 * that is not being replaced.
 *
 * A level in the middle of two bands (a département between régions and the
 * grid, a mesh between prisms and sites) is drawn at the PRODUCT of its two
 * alphas, which is right as long as the two bands do not overlap: each is 1
 * outside its own band.
 *
 * @param {number} scale
 * @param {{fine: number, coarse: number}} band
 * @param {{fineReady?: boolean, coarseReady?: boolean, fineArrival?: number, coarseArrival?: number}} state
 *   `*Ready`: the level's drawing is on screen. `*Arrival`: its arrival ramp, 1 when none runs.
 * @returns {{fine: number, coarse: number, position: number}}
 */
export function bandAlphas(scale, band, state = {}) {
  const position = bandPosition(scale, band);
  return { ...coverAlphas(crossfade(position), state), position };
}

/**
 * The same cover rule for any pair of target weights — including a HARD CUT
 * (`{fine: 1, coarse: 0}` or the reverse), which is how a transition that must
 * not fade still swaps without a blank frame: the outgoing level holds until
 * the incoming one is drawn, then the two cross over the arrival ramp.
 *
 * @param {{fine: number, coarse: number}} target Weights the levels should reach.
 * @param {{fineReady?: boolean, coarseReady?: boolean, fineArrival?: number, coarseArrival?: number}} state
 * @returns {{fine: number, coarse: number}}
 */
export function coverAlphas(target, state = {}) {
  const fineCover = state.fineReady ? clamp01(state.fineArrival ?? 1) : 0;
  const coarseCover = state.coarseReady ? clamp01(state.coarseArrival ?? 1) : 0;
  return {
    fine: fineCover * (1 + (clamp01(target.fine) - 1) * coarseCover),
    coarse: coarseCover * (1 + (clamp01(target.coarse) - 1) * fineCover),
  };
}

/**
 * A weight rounded onto `FADE_STEPS`, so an unchanged view writes nothing.
 * @param {number} weight
 * @returns {number}
 */
export function quantizeFade(weight) {
  return Math.round(clamp01(weight) * FADE_STEPS) / FADE_STEPS;
}

/**
 * The arrival ramp: smoothstep from 0 to 1 over `durationMs`.
 * @param {number} elapsedMs
 * @param {number} [durationMs]
 * @returns {number}
 */
export function arrivalWeight(elapsedMs, durationMs = ARRIVAL_MS) {
  if (!(durationMs > 0)) return 1;
  const t = clamp01(elapsedMs / durationMs);
  return t * t * (3 - 2 * t);
}

/**
 * Whether a level at this weight is drawn at all. A level at zero is HIDDEN,
 * not drawn transparent: an invisible primitive still costs its draw call and
 * still answers picks.
 *
 * @param {boolean} enabled The layer's own on/off state.
 * @param {number} weight
 * @returns {boolean}
 */
export function levelVisible(enabled, weight) {
  return Boolean(enabled) && quantizeFade(weight) > 0;
}

function clamp01(value) {
  if (!(value > 0)) return 0;
  return value >= 1 ? 1 : value;
}

// ---------------------------------------------------------------------------
// One read of the camera per frame
// ---------------------------------------------------------------------------

/**
 * The camera's scale in every unit the layers measure it in.
 *
 * Spans are `Infinity` when the camera sees no rectangle (the limb is in view)
 * or the rectangle crosses the antimeridian, which every caller treats as the
 * coarsest view — the same reading each layer's own `computeViewRectangle`
 * check already makes.
 *
 * @param {object} viewer Cesium viewer, or any `{camera, scene}` holder.
 * @returns {{box: ?{south:number, north:number, west:number, east:number},
 *   latSpan: number, lonSpan: number, heightM: number}}
 */
export function readViewScale(viewer) {
  const camera = viewer?.camera;
  const heightRaw = camera?.positionCartographic?.height;
  const heightM = Number.isFinite(heightRaw) ? heightRaw : Infinity;
  const rectangle = camera?.computeViewRectangle?.(viewer?.scene?.globe?.ellipsoid);
  if (!rectangle) return { box: null, latSpan: Infinity, lonSpan: Infinity, heightM };
  const box = {
    south: Cesium.Math.toDegrees(rectangle.south),
    north: Cesium.Math.toDegrees(rectangle.north),
    west: Cesium.Math.toDegrees(rectangle.west),
    east: Cesium.Math.toDegrees(rectangle.east),
  };
  const latSpan = box.north - box.south;
  const lonSpan = box.east - box.west;
  if (!(latSpan > 0) || !(lonSpan > 0)) return { box: null, latSpan: Infinity, lonSpan: Infinity, heightM };
  return { box, latSpan, lonSpan, heightM };
}

/** @type {Map<string, object>} ownerId -> subscriber */
const _subscribers = new Map();
let _frameViewer = null;
let _removeFrameListener = null;

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function prefersReducedMotion() {
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

function arrivalHoldId(ownerId) {
  return `zoom-fade:${ownerId}`;
}

function onPreRender() {
  if (!_subscribers.size || !_frameViewer) return;
  const scale = readViewScale(_frameViewer);
  const t = now();
  for (const subscriber of _subscribers.values()) runSubscriber(subscriber, scale, t);
}

function runSubscriber(subscriber, scale, t) {
  subscriber.lastScale = scale;
  try {
    subscriber.onFrame(scale, t);
  } catch (error) {
    console.warn(`[zoomFade] ${subscriber.ownerId} frame failed:`, error);
  }
  // Retire finished ramps AFTER the frame read them at full weight, so the
  // last frame of a ramp is drawn at 1 and not skipped.
  for (const [key, startedAt] of subscriber.arrivals) {
    if (t - startedAt >= subscriber.arrivalMs) subscriber.arrivals.delete(key);
  }
  if (!subscriber.arrivals.size && subscriber.holding) {
    subscriber.holding = false;
    releaseContinuousRender(arrivalHoldId(subscriber.ownerId));
  }
}

function attachFrameListener(viewer) {
  if (_frameViewer === viewer && _removeFrameListener) return;
  detachFrameListener();
  const event = viewer?.scene?.preRender;
  if (!event?.addEventListener) return;
  _frameViewer = viewer;
  _removeFrameListener = event.addEventListener(onPreRender);
}

function detachFrameListener() {
  _removeFrameListener?.();
  _removeFrameListener = null;
  _frameViewer = null;
}

/**
 * Subscribe a layer to the per-frame scale read.
 *
 * `onFrame(scale, nowMs)` runs on `scene.preRender` — before the frame is
 * drawn, so a weight written there is on screen in the same frame — for every
 * frame the scene renders. That is every frame of a camera motion, and no frame
 * at all for a parked camera in request-render mode, which is the point: a fade
 * driven by the camera costs nothing while the camera is still.
 *
 * Arrival ramps are the exception that needs frames without motion, so while a
 * ramp runs the handle holds continuous render under `zoom-fade:<ownerId>` and
 * releases it on the ramp's last frame.
 *
 * @param {object} viewer Cesium viewer.
 * @param {string} ownerId Short stable id, the layer's own.
 * @param {(scale: ReturnType<typeof readViewScale>, nowMs: number) => void} onFrame
 * @param {{arrivalMs?: number}} [options]
 * @returns {{
 *   arrive: (key: string) => void,
 *   arrival: (key: string, nowMs?: number) => number,
 *   arriving: () => boolean,
 *   frame: () => void,
 *   report: (state: object) => void,
 *   release: () => void,
 * }}
 */
export function watchZoomFade(viewer, ownerId, onFrame, options = {}) {
  if (!ownerId) throw new TypeError('watchZoomFade requires an owner id');
  if (typeof onFrame !== 'function') throw new TypeError('watchZoomFade requires a frame callback');
  releaseZoomFade(ownerId);

  const subscriber = {
    ownerId,
    viewer,
    onFrame,
    arrivalMs: options.arrivalMs ?? ARRIVAL_MS,
    arrivals: new Map(),
    holding: false,
    lastScale: null,
    reported: null,
  };
  _subscribers.set(ownerId, subscriber);
  attachFrameListener(viewer);

  return {
    /**
     * Start the arrival ramp of one level (a new drawing became ready).
     * Instant under prefers-reduced-motion.
     */
    arrive(key) {
      if (_subscribers.get(ownerId) !== subscriber) return;
      if (prefersReducedMotion() || !(subscriber.arrivalMs > 0)) {
        subscriber.arrivals.delete(key);
        return;
      }
      subscriber.arrivals.set(key, now());
      if (!subscriber.holding) {
        subscriber.holding = true;
        holdContinuousRender(arrivalHoldId(ownerId));
      }
    },
    /** The arrival ramp of one level, 1 when it has none running. */
    arrival(key, nowMs = now()) {
      const startedAt = subscriber.arrivals.get(key);
      if (startedAt === undefined) return 1;
      return arrivalWeight(nowMs - startedAt, subscriber.arrivalMs);
    },
    /** Whether any arrival ramp is still running. */
    arriving() {
      return subscriber.arrivals.size > 0;
    },
    /** Run the frame callback now, against the current camera. */
    frame() {
      if (_subscribers.get(ownerId) !== subscriber || !viewer) return;
      runSubscriber(subscriber, readViewScale(viewer), now());
    },
    /** Publish the layer's weights for diagnostics and browser harnesses. */
    report(state) {
      subscriber.reported = state;
    },
    release() {
      if (_subscribers.get(ownerId) === subscriber) releaseZoomFade(ownerId);
    },
  };
}

/**
 * Unsubscribe a layer. Safe when it never subscribed.
 * @param {string} ownerId
 */
export function releaseZoomFade(ownerId) {
  const subscriber = _subscribers.get(ownerId);
  if (!subscriber) return;
  _subscribers.delete(ownerId);
  if (subscriber.holding) releaseContinuousRender(arrivalHoldId(ownerId));
  subscriber.holding = false;
  subscriber.arrivals.clear();
  if (!_subscribers.size) detachFrameListener();
}

/**
 * What every subscribed layer last reported, for harnesses.
 * @returns {{listening: boolean, owners: Array<{ownerId: string, arriving: boolean,
 *   scale: ?object, state: ?object}>}}
 */
export function getZoomFadeDiagnostics() {
  return {
    listening: Boolean(_removeFrameListener),
    owners: [..._subscribers.values()].map((subscriber) => ({
      ownerId: subscriber.ownerId,
      arriving: subscriber.arrivals.size > 0,
      scale: subscriber.lastScale
        ? { latSpan: subscriber.lastScale.latSpan, lonSpan: subscriber.lastScale.lonSpan, heightM: subscriber.lastScale.heightM }
        : null,
      state: subscriber.reported,
    })),
  };
}

/** Test seam. */
export function _resetZoomFadeForTest() {
  for (const ownerId of [..._subscribers.keys()]) releaseZoomFade(ownerId);
  detachFrameListener();
}

// ---------------------------------------------------------------------------
// Applying one weight cheaply
// ---------------------------------------------------------------------------

/** Name of the uniform `createFadeColorAppearance` multiplies alpha by. */
export const FADE_UNIFORM = 'u_zoomFade';

/**
 * Wrap a fragment shader so its output alpha is multiplied by `u_zoomFade`.
 *
 * Renaming `main` and calling it from a new one keeps whatever the original
 * computes — flat or lit, gamma-corrected — and touches only the alpha. The
 * pick pass Cesium derives from this shader discards fragments whose alpha is
 * zero, so a level faded out entirely stops answering picks even before the
 * layer hides it.
 *
 * @param {string} source GLSL fragment shader with a `void main()`.
 * @returns {string}
 */
export function fadeFragmentShader(source) {
  const renamed = String(source).replace(/void\s+main\s*\(\s*(?:void)?\s*\)/, 'void zoomFade_main()');
  if (renamed === source) throw new Error('fadeFragmentShader: the shader has no main()');
  return `${renamed}
uniform float ${FADE_UNIFORM};
void main()
{
    zoomFade_main();
    out_FragColor.a *= ${FADE_UNIFORM};
}
`;
}

/**
 * A `PerInstanceColorAppearance` whose whole primitive fades by one uniform.
 *
 * This is the adapter for a `Primitive` of thousands of instances: one number
 * written per frame instead of one colour attribute per instance. It is forced
 * translucent, since a fade needs blending.
 *
 * Not for a `GroundPrimitive`, which builds its own shaders from the
 * appearance's TYPE and ignores the source here — use `fadeInstances` there.
 *
 * @param {object} [options] `PerInstanceColorAppearance` options (`flat`, `closed`, ...).
 * @returns {Cesium.PerInstanceColorAppearance}
 */
export function createFadeColorAppearance(options = {}) {
  const base = new Cesium.PerInstanceColorAppearance({ ...options, translucent: true });
  const appearance = new Cesium.PerInstanceColorAppearance({
    ...options,
    translucent: true,
    fragmentShaderSource: fadeFragmentShader(base.fragmentShaderSource),
  });
  appearance.uniforms = { [FADE_UNIFORM]: 1 };
  return appearance;
}

/**
 * Write a weight into an appearance made by `createFadeColorAppearance`.
 * @param {object} appearance
 * @param {number} weight
 * @returns {boolean} Whether the value changed.
 */
export function setAppearanceFade(appearance, weight) {
  const uniforms = appearance?.uniforms;
  if (!uniforms || !(FADE_UNIFORM in uniforms)) return false;
  const next = quantizeFade(weight);
  if (uniforms[FADE_UNIFORM] === next) return false;
  uniforms[FADE_UNIFORM] = next;
  return true;
}

/** item -> { base, outlineBase, written, outlineWritten } */
const _itemAlpha = new WeakMap();
/** collection -> last weight written */
const _collectionWeight = new WeakMap();
const _colorScratch = new Cesium.Color();

/**
 * Fade every point or billboard of a collection by one weight, from the alpha
 * the layer gave each item.
 *
 * The item's own alpha is remembered the first time it is seen, and taken again
 * whenever the layer has written a new colour since (a recolour, a selection):
 * the base is whatever the layer last set, never what this function wrote.
 * Points fade their outline too.
 *
 * @param {Cesium.PointPrimitiveCollection|Cesium.BillboardCollection} collection
 * @param {number} weight
 * @param {{force?: boolean}} [options] `force` rewrites even when the weight is unchanged (after the layer added items).
 * @returns {boolean} Whether anything was written.
 */
export function fadeCollection(collection, weight, options = {}) {
  if (!collection || typeof collection.get !== 'function') return false;
  const w = quantizeFade(weight);
  if (!options.force && _collectionWeight.get(collection) === w) return false;
  _collectionWeight.set(collection, w);
  const length = collection.length ?? 0;
  for (let i = 0; i < length; i += 1) fadeItem(collection.get(i), w);
  return true;
}

function fadeItem(item, w) {
  if (!item?.color) return;
  let memo = _itemAlpha.get(item);
  if (!memo) {
    memo = { base: item.color.alpha, written: null, outlineBase: item.outlineColor?.alpha ?? null, outlineWritten: null };
    _itemAlpha.set(item, memo);
  }
  if (memo.written !== null && Math.abs(item.color.alpha - memo.written) > 1e-6) memo.base = item.color.alpha;
  const alpha = memo.base * w;
  if (memo.written !== alpha) {
    Cesium.Color.clone(item.color, _colorScratch);
    _colorScratch.alpha = alpha;
    item.color = _colorScratch;
    memo.written = alpha;
  }
  if (memo.outlineBase !== null && item.outlineColor) {
    if (memo.outlineWritten !== null && Math.abs(item.outlineColor.alpha - memo.outlineWritten) > 1e-6) {
      memo.outlineBase = item.outlineColor.alpha;
    }
    const outline = memo.outlineBase * w;
    if (memo.outlineWritten !== outline) {
      Cesium.Color.clone(item.outlineColor, _colorScratch);
      _colorScratch.alpha = outline;
      item.outlineColor = _colorScratch;
      memo.outlineWritten = outline;
    }
  }
}

/** primitive -> { attributes: Map(id -> attributes), weight } */
const _instanceCache = new WeakMap();
/**
 * The value written into each instance's colour attribute. The attribute's
 * setter copies it into the batch table, so one array serves every write;
 * reading `attributes.color` instead would mint a new one per instance per
 * step — about 1 450 arrays a frame over a 0.9° view of communes.
 */
const _instanceColorScratch = new Uint8Array(4);

/**
 * Fade the instances of a primitive by writing each one's colour attribute.
 *
 * The adapter for a `GroundPrimitive`, which cannot take a custom shader. The
 * attribute handles are looked up once per primitive and cached:
 * `getGeometryInstanceAttributes` scans the instance ids linearly, so calling it
 * per instance per frame is quadratic. Nothing is written until the primitive
 * is ready, and nothing when the weight has not moved a step.
 *
 * @param {Cesium.Primitive|Cesium.GroundPrimitive} primitive
 * @param {Iterable<[string, Cesium.Color]>} entries Instance id and its full-strength colour.
 * @param {number} weight
 * @param {{force?: boolean}} [options]
 * @returns {boolean} Whether anything was written.
 */
export function fadeInstances(primitive, entries, weight, options = {}) {
  if (!primitive?.ready || typeof primitive.getGeometryInstanceAttributes !== 'function') return false;
  const w = quantizeFade(weight);
  let cache = _instanceCache.get(primitive);
  if (!cache) {
    cache = { attributes: new Map(), weight: null };
    _instanceCache.set(primitive, cache);
  }
  if (!options.force && cache.weight === w) return false;
  cache.weight = w;
  for (const [id, color] of entries) {
    let attributes = cache.attributes.get(id);
    if (attributes === undefined) {
      attributes = primitive.getGeometryInstanceAttributes(id) ?? null;
      cache.attributes.set(id, attributes);
    }
    if (!attributes || !color) continue;
    Cesium.Color.clone(color, _colorScratch);
    _colorScratch.alpha = color.alpha * w;
    attributes.color = Cesium.ColorGeometryInstanceAttribute.toValue(_colorScratch, _instanceColorScratch);
  }
  return true;
}

/**
 * A material colour for an entity that follows a weight without rebuilding.
 *
 * Replacing an entity's material rebuilds its geometry batch; a non-constant
 * colour property is re-read each frame and written as an attribute instead.
 * The alpha is capped at 0.99 so the entity never crosses from the translucent
 * batch into the opaque one mid-fade, which WOULD rebuild.
 *
 * @param {Cesium.Color} color Full-strength colour.
 * @param {() => number} getWeight
 * @returns {Cesium.ColorMaterialProperty}
 */
export function fadingColorMaterial(color, getWeight) {
  const base = Cesium.Color.clone(color);
  return new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty((time, result) => {
    const out = Cesium.Color.clone(base, result ?? new Cesium.Color());
    out.alpha = Math.min(0.99, base.alpha * quantizeFade(getWeight()));
    return out;
  }, false));
}
