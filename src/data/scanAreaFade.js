/**
 * The plots (parcels) and the sections of the two cadastral area layers —
 * property prices (`dvfSales.js`) and energy ratings (`dpeFrance.js`) — as two
 * levels that fade into each other across `scanRegime.SCAN_SECTION_FADE`,
 * instead of swapping on the 1 800 m switch.
 *
 * WHY A MODULE OF ITS OWN. Both layers are built on `addressScanLayer.js`,
 * whose shell asks ONE question per settle and holds ONE answer — the right
 * shape for the five layers that share it and never fade. Here the layer keeps
 * the shell's answer as its PRIMARY level, exactly as before (same params,
 * same boxes, same tiles, same caps), and adds the other level beside it:
 *
 *   - inside the band the shell answers in plots, and this module asks the
 *     same route for the sections around the same point — the very question
 *     the shell asks at 1 800 m, built by the layer's own `params` from the
 *     point lifted to the coarse band (`scanRegime.scanCoarsePoint`);
 *   - each level is painted by its own `groundAreaPaint` — no-blank redraws,
 *     a weight written per instance — and the frame writes both weights;
 *   - a level the band no longer wants is dropped once its weight is zero,
 *     never before: a level holds full strength until its replacement is
 *     drawn (`zoomFade.coverAlphas`).
 *
 * THE DOMINANT LEVEL OWNS THE KEY. The level with the larger zoom weight at the
 * settled view — decided at each draw, each companion answer and each settle —
 * is the one whose answer the key, the row's disclosure and the stats are
 * built from (`ownerPayload`). Both stay clickable: a click is answered by
 * geometry over every shape on screen, the smallest winning, so a plot is
 * found under its section.
 *
 * What stays outside, on purpose: the disc regime under 600 m. The layers
 * clear both levels when the shell draws a disc (see `scanAreaLevelsAt`).
 *
 * @module data/scanAreaFade
 */

import {
  bandPosition,
  coverAlphas,
  fadeBand,
  levelVisible,
  quantizeFade,
  reveal,
  watchZoomFade,
} from './zoomFade.js';
import { SCAN_SECTION_FADE, scanAreaLevelsAt, scanCoarsePoint } from './scanRegime.js';
import { createGroundAreaPaint, groundShapeAt } from './groundAreaPaint.js';
import { governorRequestRender } from '../renderGovernor.js';

/** The plots ↔ sections band, validated — see `scanRegime.SCAN_SECTION_FADE`. */
export const SCAN_AREA_FADE_BAND = fadeBand(SCAN_SECTION_FADE.fine, SCAN_SECTION_FADE.coarse);

/**
 * The two levels' zoom weights at an altitude.
 *
 * A REVEAL, NOT A SYMMETRIC CROSSFADE (`zoomFade.reveal`). The band can only
 * sit under the 1 800 m switch — the plots are not asked for above it — so a
 * crossfade would have handed most of what used to be the plots' view to the
 * sections. Revealed, the plots are at full strength 30 % of the way into the
 * band (1 544 m) and the sections gone 70 % of the way (1 259 m): the band's
 * top shows the sections giving way, its lower half the plots alone, as before.
 *
 * @param {number} altitudeM
 * @returns {{fine: number, coarse: number}}
 */
export function scanAreaZoomWeights(altitudeM) {
  return reveal(bandPosition(altitudeM, SCAN_AREA_FADE_BAND));
}

/** The two levels, finest first. */
const LEVELS = Object.freeze(['fine', 'coarse']);

/**
 * Wait after the camera settles before reconsidering the companion, in ms —
 * a little longer than the shell's own 450 ms debounce, so a rescan the shell
 * is about to make lands first and is the one the companion follows.
 */
export const SCAN_AREA_SETTLE_MS = 600;

/** The other level. */
function partnerOf(level) {
  return level === 'fine' ? 'coarse' : 'fine';
}

/**
 * The dominant level at an altitude, given which levels are in hand: the one
 * with the larger zoom weight when both are, the one in hand otherwise.
 * @param {number} altitudeM
 * @param {{fine: boolean, coarse: boolean}} held
 * @returns {?('fine'|'coarse')}
 */
export function scanAreaDominant(altitudeM, held) {
  if (held.fine && held.coarse) {
    const weights = scanAreaZoomWeights(altitudeM);
    return weights.coarse > weights.fine ? 'coarse' : 'fine';
  }
  if (held.fine) return 'fine';
  if (held.coarse) return 'coarse';
  return null;
}

/**
 * One layer's two area levels.
 *
 * @param {object} config
 * @param {string} config.ownerId Layer id: the fade subscription and the
 *   draw-changed event both carry it.
 * @param {{fine: string, coarse: string}} config.names What the levels are
 *   called in the report (`plots`/`parcels`, `sections`).
 * @param {string} config.renderReason Render-governor tag of the builds.
 * @param {string} config.endpoint The layer's own route, asked for the
 *   companion sections.
 * @param {(payload: ?object) => ?('fine'|'coarse')} config.unitOf
 * @param {(level: string, payload: object, runtime: object) =>
 *   {items: Array<object>, style: object}} config.paintOf What one answer paints.
 * @param {(point: object, viewer: ?object) => ?Record<string, string>} config.coarseParams
 *   The query of the coarse answer at a point already lifted to the coarse band
 *   — the layer's own `params`, so the companion is the shell's question.
 * @param {(viewer: object) => ?object} [config.scanPoint] Where a settle would
 *   scan — the shell's `cameraScanPoint`.
 * @param {typeof fetch} [config.fetchImpl]
 * @param {?EventTarget} [config.eventTarget] Where the draw-changed event goes.
 * @returns {object}
 */
export function createScanAreaLevels(config) {
  const {
    ownerId, names, renderReason, endpoint, unitOf, paintOf, coarseParams,
    scanPoint = () => null,
    fetchImpl = (...args) => fetch(...args),
    eventTarget = typeof window === 'undefined' ? null : window,
  } = config;

  const paints = {
    fine: createGroundAreaPaint({ renderReason: `${renderReason}-${names.fine}` }),
    coarse: createGroundAreaPaint({ renderReason: `${renderReason}-${names.coarse}` }),
  };
  /** level -> {payload, drawKey, query} of the answer it paints. */
  const held = { fine: null, coarse: null };
  /** Whether the settled view wants each level; a level not wanted is dropped at weight zero. */
  const wanted = { fine: false, coarse: false };
  /** The level the shell's own answer is, or null. */
  let primaryLevel = null;
  let point = null;
  let viewer = null;
  let classificationType;
  let runtime = {};
  let altitudeM = NaN;
  let dominant = null;
  let enabled = false;
  let handle = null;
  let clearPending = false;
  let companion = { query: null, controller: null, generation: 0 };
  let force = true;
  let retireQueued = false;
  let settleTimer = null;
  let removeMoveEnd = null;
  const written = { fine: -1, coarse: -1 };
  const lastSwap = { fine: 0, coarse: 0 };

  /** The surface and the filter a level was painted against. */
  function drawKey() {
    return `${classificationType}|${JSON.stringify(runtime)}`;
  }

  function announce() {
    eventTarget?.dispatchEvent?.(new CustomEvent('gev:layer-draw-changed', {
      detail: { layerId: ownerId, dormant: false },
    }));
  }

  /** Paint one answer into its level. */
  function paint(level, payload, query = null) {
    const { items, style } = paintOf(level, payload, runtime) || { items: [], style: null };
    const tagged = (items || []).map((item) => ({ ...item, level }));
    const count = style ? paints[level].draw(viewer, tagged, { style, classificationType }) : 0;
    held[level] = { payload, drawKey: drawKey(), query };
    force = true;
    return count;
  }

  /**
   * Re-decide the dominant level on the view the camera stands at.
   * @returns {boolean} Whether it changed.
   */
  function settleOwnership() {
    const before = dominant;
    dominant = scanAreaDominant(altitudeM, { fine: Boolean(held.fine), coarse: Boolean(held.coarse) });
    return dominant !== before;
  }

  function abortCompanion() {
    companion.controller?.abort?.();
    companion = { query: null, controller: null, generation: companion.generation + 1 };
  }

  /** The companion query at a point, without its coordinate — the cache key. */
  function companionQuery(at) {
    if (!at || !Number.isFinite(at.lat) || !Number.isFinite(at.lon)) return null;
    const params = coarseParams(scanCoarsePoint(at), viewer);
    if (!params || !Object.keys(params).length) return null;
    return String(new URLSearchParams(params));
  }

  /** Ask for the sections around a point, unless they are in hand or on their way. */
  function ensureCompanion(at) {
    const query = companionQuery(at);
    if (!query) return;
    if (held.coarse?.query === query || companion.query === query) return;
    abortCompanion();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const generation = companion.generation;
    companion = { query, controller, generation };
    const url = `${endpoint}?${new URLSearchParams({ lat: at.lat.toFixed(6), lon: at.lon.toFixed(6) })}&${query}`;
    Promise.resolve()
      .then(() => fetchImpl(url, controller ? { signal: controller.signal } : undefined))
      .then((response) => (response?.ok ? response.json() : null))
      .then((payload) => {
        if (companion.generation !== generation) return;
        companion = { query: null, controller: null, generation };
        if (!enabled || !payload || payload.error || unitOf(payload) !== 'coarse') return;
        // The view moved on while the answer was in flight.
        if (primaryLevel !== 'fine' || !wanted.coarse) return;
        paint('coarse', payload, query);
        if (settleOwnership()) announce();
        governorRequestRender(`${renderReason}-companion`);
      })
      .catch(() => {
        if (companion.generation === generation) companion = { query: null, controller: null, generation };
      });
  }

  /**
   * Which levels the view wants, and the companion request when the sections
   * are wanted beside the shell's plots.
   * @param {object} at Where the view scans.
   */
  function reconsider(at) {
    const levels = scanAreaLevelsAt({ altitudeM, pinned: at?.pinned });
    wanted.fine = primaryLevel === 'fine';
    wanted.coarse = primaryLevel === 'coarse' || (primaryLevel === 'fine' && levels.coarse);
    if (primaryLevel === 'fine' && wanted.coarse) ensureCompanion(at);
    else abortCompanion();
    force = true;
  }

  /** Take both levels off the globe, the request in flight with them. */
  function clearAll() {
    clearPending = false;
    abortCompanion();
    for (const level of LEVELS) {
      paints[level].clear();
      held[level] = null;
      wanted[level] = false;
      lastSwap[level] = paints[level].generation();
    }
    primaryLevel = null;
    dominant = null;
    force = true;
  }

  /**
   * Drop the levels the view no longer wants, once their weight is zero —
   * outside the frame that noticed it.
   */
  function retire() {
    retireQueued = false;
    if (!enabled) return;
    let changed = false;
    for (const level of LEVELS) {
      if (wanted[level] || !held[level]) continue;
      if (quantizeFade(written[level]) > 0) continue;
      paints[level].clear();
      held[level] = null;
      lastSwap[level] = paints[level].generation();
      changed = true;
    }
    if (!changed) return;
    force = true;
    if (settleOwnership()) announce();
    governorRequestRender(`${renderReason}-retire`);
  }

  /**
   * The per-frame pass: swap in what finished building, write both weights,
   * report. Weight arithmetic and per-instance writes only; nothing is fetched.
   */
  function onFrame(scale, nowMs) {
    if (!enabled) return;
    let swapped = false;
    for (const level of LEVELS) {
      const had = paints[level].drawn();
      paints[level].promote();
      const swap = paints[level].generation();
      if (swap === lastSwap[level]) continue;
      lastSwap[level] = swap;
      swapped = true;
      // A NEW drawing over the other level plays its arrival ramp; one that
      // replaces its own level, or appears over nothing, just appears.
      if (!had && paints[level].drawn() && paints[partnerOf(level)].drawn()) handle?.arrive(level);
    }
    const alphas = coverAlphas(scanAreaZoomWeights(scale?.heightM), {
      fineReady: paints.fine.drawn(),
      coarseReady: paints.coarse.drawn(),
      fineArrival: handle?.arrival('fine', nowMs) ?? 1,
      coarseArrival: handle?.arrival('coarse', nowMs) ?? 1,
    });
    const fine = quantizeFade(alphas.fine);
    const coarse = quantizeFade(alphas.coarse);
    const writeAll = force || swapped;
    force = false;
    if (!writeAll && fine === written.fine && coarse === written.coarse) return;
    paints.fine.fade(fine, { force: writeAll });
    paints.coarse.fade(coarse, { force: writeAll });
    paints.fine.setShow(levelVisible(enabled, fine));
    paints.coarse.setShow(levelVisible(enabled, coarse));
    written.fine = fine;
    written.coarse = coarse;
    handle?.report({
      levels: { [names.fine]: fine, [names.coarse]: coarse },
      dominant: dominant ? names[dominant] : null,
      bands: {
        [`${names.fine}-${names.coarse}`]: {
          fine: SCAN_AREA_FADE_BAND.fine, coarse: SCAN_AREA_FADE_BAND.coarse, unit: 'm',
        },
      },
      primary: primaryLevel ? names[primaryLevel] : null,
      pending: { [names.fine]: paints.fine.stats().pending, [names.coarse]: paints.coarse.stats().pending },
    });
    const done = LEVELS.some((level) => !wanted[level] && held[level] && written[level] === 0);
    if (done && !retireQueued) {
      retireQueued = true;
      setTimeout(retire, 0);
    }
  }

  /** Every shape on screen, both levels — what a click is tested against. */
  function visibleShapes() {
    const out = [];
    for (const level of LEVELS) {
      if (!held[level]) continue;
      if (written[level] === 0) continue;
      out.push(...paints[level].shapes());
    }
    return out;
  }

  /** The camera settled: the band may want the companion now, or not any more. */
  function settle() {
    settleTimer = null;
    if (!enabled || !viewer || !primaryLevel) return;
    const at = scanPoint(viewer);
    if (!at || !Number.isFinite(at.altitudeM)) return;
    altitudeM = at.altitudeM;
    reconsider(point?.pinned ? point : at);
    if (settleOwnership()) announce();
    governorRequestRender(`${renderReason}-settle`);
  }

  return {
    names,
    paints,

    /**
     * Draw the shell's answer as the primary level, and arrange the other.
     * Called from the layer's `render` for an AREA answer.
     * @param {object} payload
     * @param {{viewer: object, point: object, classificationType: number, runtime?: object}} context
     * @returns {number} Shapes drawn.
     */
    primary(payload, context) {
      clearPending = false;
      const level = unitOf(payload);
      if (!level) {
        clearAll();
        return 0;
      }
      viewer = context?.viewer || viewer;
      point = context?.point || point;
      classificationType = context?.classificationType;
      runtime = { ...(context?.runtime || {}) };
      altitudeM = Number(point?.altitudeM);
      primaryLevel = level;
      const query = level === 'coarse' ? companionQuery(point) : null;
      const drawn = paint(level, payload, query);
      // The other level, still in hand, follows a new surface or a new filter.
      const other = partnerOf(level);
      if (held[other] && held[other].drawKey !== drawKey()) {
        paint(other, held[other].payload, held[other].query);
      }
      reconsider(point);
      settleOwnership();
      return drawn;
    },

    /**
     * The shell took its draw down. It redraws in the same task when a new
     * answer follows; when none does — the layer went dormant above its
     * ceiling — both levels go, once the task is over.
     */
    cleared() {
      clearPending = true;
      queueMicrotask(() => {
        if (clearPending) clearAll();
      });
    },

    clearAll,

    enable(targetViewer) {
      enabled = true;
      viewer = targetViewer || viewer;
      if (!viewer) return;
      handle = watchZoomFade(viewer, ownerId, onFrame);
      force = true;
      removeMoveEnd?.();
      removeMoveEnd = viewer.camera?.moveEnd?.addEventListener?.(() => {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(settle, SCAN_AREA_SETTLE_MS);
      }) || null;
    },

    disable() {
      enabled = false;
      clearTimeout(settleTimer);
      settleTimer = null;
      removeMoveEnd?.();
      removeMoveEnd = null;
      handle?.release();
      handle = null;
      clearAll();
    },

    /**
     * The answer that owns the key: the dominant level's, or the one given
     * (the shell's) when the dominant level is not an area level in hand.
     * @param {?object} fallback
     * @returns {?object}
     */
    ownerPayload(fallback) {
      if (!fallback || !unitOf(fallback)) return fallback;
      return (dominant && held[dominant]?.payload) || fallback;
    },

    /** The answer a drawn shape belongs to. */
    payloadOf(shape) {
      return (shape?.level && held[shape.level]?.payload) || null;
    },

    shapes: visibleShapes,

    /** The shape under a ground point, both levels, the smallest winning. */
    shapeAt(lon, lat) {
      return groundShapeAt(lon, lat, visibleShapes());
    },

    /** The level names for the harnesses: the primary one, and both draws. */
    stats() {
      const primaryStats = primaryLevel ? paints[primaryLevel].stats() : { shapes: 0, fills: 0, ready: true, pending: false };
      return {
        ...primaryStats,
        dominant: dominant ? names[dominant] : null,
        levels: Object.fromEntries(LEVELS.map((level) => [names[level], {
          ...paints[level].stats(),
          held: Boolean(held[level]),
          wanted: wanted[level],
          alpha: written[level] < 0 ? null : written[level],
        }])),
      };
    },

    /** Test seam: run one frame against a scale, with a stand-in for the shared read. */
    _frameForTest(heightM, { arrivals = {}, report = () => {}, arrive = () => {} } = {}) {
      const previous = handle;
      handle = {
        arrival: (key) => arrivals[key] ?? 1,
        arrive,
        report,
        release() {},
      };
      force = true;
      try {
        onFrame({ heightM }, 0);
      } finally {
        handle = previous;
      }
      return { fine: written.fine, coarse: written.coarse, dominant: dominant ? names[dominant] : null };
    },

    /** Test seam: the settle, at a given scan point, without a camera. */
    _settleForTest(at) {
      if (!primaryLevel) return;
      altitudeM = at.altitudeM;
      reconsider(at);
      settleOwnership();
    },

    /** Test seam: switch the module on without a viewer. */
    _enableForTest(on = true) {
      enabled = on;
    },
  };
}
