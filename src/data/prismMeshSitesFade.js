/**
 * @module prismMeshSitesFade
 *
 * Fade on zoom for the three layers that draw ONE register at up to three
 * levels — `irve-fr`, `schools-fr` and `sup-fr`: département PRISMS while the
 * whole country is in view, a thinned MESH of real positions in the middle
 * zooms (`sup-fr` has none: its register is small enough to skip it), and
 * EVERY SITE over a city. `zoomFade.js` holds the arithmetic and the per-frame
 * camera read; this module holds what the three share on top of it, so the
 * rule each one keeps is written once.
 *
 * ── WHICH TRANSITION FADES, AND WHICH ONE STAYS A CUT ───────────────────────
 *
 * PRISMS ↔ POINTS STAYS A HARD CUT, in all three layers, and that is a finding
 * about the data rather than a shortcut. The prism's HEIGHT is the same count
 * as the points below it — every charge point, school or student the prism
 * stacks is one the points draw — but its COLOUR is a RATE on a sequential
 * ramp (charge points or schools per 1 000 km², the share of students at
 * bac+4 and beyond), while a point's colour is a CATEGORY (power band, school
 * level, kind of establishment) on a ramp of its own. Two indicators, two keys.
 * Each layer's header already says why the two ramps were chosen to share no
 * colour: the regimes never draw at once, and a reader who zooms out must not
 * carry a category's meaning into a quantity's. A crossfade would put both
 * ramps on screen at rest, under one key — `zoomFade.js` names that case
 * ("a choropleth of a share above points of sites") as one that keeps its cut.
 *
 * What the cut no longer does is go BLANK. It used to clear the outgoing level
 * before the incoming one was fetched — the 0.9 MB national mesh, the 0.62 MB
 * sup pack, the rollup and the polygons on a first visit — so the globe showed
 * nothing for as long as that took. `coverAlphas` with a hard target keeps the
 * outgoing level at full strength until the incoming one is drawn, then hands
 * over in one 260 ms arrival ramp. The prisms take no part in the ramp: they
 * are ~100 extruded entities on four kinds of material (class colour, stripe,
 * flat fill, grid) plus a silhouette colour, only the first of which could
 * follow a weight, and a colour that does is re-evaluated on every entity
 * every frame for as long as it exists. So they are TOGGLED, once, at an end
 * of the ramp (shown the moment they are painted on the way out, hidden on the
 * ramp's last frame on the way in), and the ramp is carried by the points,
 * whose collection fades for the cost of one colour per mark.
 *
 * MESH ↔ SITES FADES. The mesh is a strict SUBSET of the sites: every
 * mesh mark stands on a real site of the same register, at that site's own
 * coordinate, wearing the same category on the same colours, and its id is the
 * 5-decimal coordinate key the site regime computes for the same point
 * (`meshRowId`) — a charge point's own id, a school's join to its UAI. Fading
 * the two into each other claims nothing the data does not say: it is the
 * mesh densifying into the inventory, which is what `irveMesh.js` already
 * describes its budget ladder as trying to do.
 *
 * ── HOW THE BAND AVOIDS DOUBLING OR DIPPING ─────────────────────────────────
 *
 * Fading the mesh out while the sites fade in would draw each point the
 * two share TWICE — a darker dot mid-band — or, drawn once at either level's
 * weight, would dip it below full strength wherever that level is partial.
 * Neither is a statement about the world. So inside the band each mark has a
 * ROLE, decided when the two levels are both drawn:
 *
 *   shared — in the mesh AND in the sites: drawn ONCE, as a site, at full
 *            strength through the whole band. It is in both levels, so neither
 *            level fading changes whether it is there.
 *   sites  — a site the mesh thinned away: drawn at the site level's alpha.
 *            These are the marks that fade in.
 *   mesh   — a mesh mark the site query did not return (the 12 % padding
 *            outside the view, or a capped payload): drawn at the mesh's
 *            alpha. These are the marks that fade out.
 *
 * With one level drawn, every mark has that level's role. Both point roles are
 * multiplied by the cut's alpha on the points, so the prisms' hand-over moves
 * every mark together.
 *
 * ── WHY THE BAND IS A REVEAL, NOT A SYMMETRIC CROSSFADE ─────────────────────
 *
 * The band can only sit on the FINE side of the old switch: its coarse end is
 * the proxy's box ceiling, below which the sites were always drawn alone, and
 * above which they cannot be asked for. A symmetric crossfade gives the coarse
 * level most of a band, so every view between the two ends — views that showed
 * every site on main — would come back as the mesh with the sites faint under
 * it. `zoomFade.reveal` is the other shape, the one Kyle Walker's maps use: the
 * sites come in over the first 30 % of the band (in log scale, from the coarse
 * end) and the mesh fades out behind them over the first 70 %, so the two never
 * sum below 1 and the detail is what the reader gets as soon as they ask for it.
 *
 * No Cesium and no DOM of its own (only `zoomFade.js`'s arithmetic), so the
 * rules run under `node --test` exactly as they run in the browser.
 */
import {
  bandPosition,
  coverAlphas,
  quantizeFade,
  reveal,
} from './zoomFade.js';

/** The cut's target while the camera holds the whole country: prisms only. */
export const NATIONAL_TARGET = Object.freeze({ fine: 0, coarse: 1 });
/** The cut's target anywhere below it: points only. */
export const POINTS_TARGET = Object.freeze({ fine: 1, coarse: 0 });

/** A mark both point levels draw, drawn once. */
export const ROLE_SHARED = 'shared';
/** A mark only the site level draws. */
export const ROLE_SITES = 'sites';
/** A mark only the mesh draws. */
export const ROLE_MESH = 'mesh';

/**
 * Arrival keys. `points` is the points arriving over the prisms (or over
 * nothing), `national` the prisms arriving over the points; `mesh` and `sites`
 * are one point level arriving while the other is already drawn. Exactly one
 * of them is started per hand-over, so no ramp is ever applied twice.
 */
export const ARRIVAL_POINTS = 'points';
export const ARRIVAL_NATIONAL = 'national';
export const ARRIVAL_MESH = 'mesh';
export const ARRIVAL_SITES = 'sites';

/**
 * The camera's scale for the mesh ↔ sites band: the view's LARGER span, in
 * degrees, or `Infinity` at or above the altitude gate.
 *
 * The larger span, because what starts the site level is the proxy's box
 * ceiling, which both spans must clear; the altitude, because the layers have
 * always refused a city query from above it whatever the rectangle says. In a
 * plan view the span reaches the ceiling long before the altitude does
 * (0.35° of longitude at ~25 km, against a 45 km gate), so the gate only ever
 * decides for an odd field of view.
 *
 * @param {number} spanMaxDeg Larger of the view's two spans, in degrees.
 * @param {number} altitudeM Camera height above the ellipsoid.
 * @param {number} gateM Altitude at and above which no site is drawn.
 * @returns {number}
 */
export function siteFadeScale(spanMaxDeg, altitudeM, gateM) {
  if (!(altitudeM < gateM)) return Infinity;
  return Number.isFinite(spanMaxDeg) && spanMaxDeg > 0 ? spanMaxDeg : Infinity;
}

/**
 * The two point levels' zoom weights at one scale — the band's REVEAL shape
 * (see the header for why not the symmetric crossfade).
 *
 * @param {number} scale From {@link siteFadeScale}.
 * @param {{fine: number, coarse: number}} band
 * @returns {{fine: number, coarse: number}}
 */
export function pointZoomWeights(scale, band) {
  return reveal(bandPosition(scale, band));
}

/**
 * Which point levels a SETTLED view loads: every level whose zoom weight is
 * above zero. Loading stays on `moveEnd`; this is called there and nowhere else.
 *
 * @param {number} scale From {@link siteFadeScale}.
 * @param {{fine: number, coarse: number}} band
 * @returns {{mesh: boolean, sites: boolean}}
 */
export function wantedPointLevels(scale, band) {
  const zoom = pointZoomWeights(scale, band);
  return { mesh: zoom.coarse > 0, sites: zoom.fine > 0 };
}

/**
 * The point level that owns the legend, the card, the row line and the
 * analyst's records: the one with the larger alpha on the settled view.
 *
 * With one level drawn it is that one, because the other has no alpha at all
 * yet; with both, it is the one with the larger zoom weight — under the reveal
 * the sites overtake the mesh 21 % of the way into the band (log scale, from
 * its coarse end), and the finer level takes the tie. With neither, the zoom
 * alone decides, so the row says what is being loaded.
 *
 * @param {{meshDrawn: boolean, sitesDrawn: boolean, scale: number, band: {fine:number, coarse:number}}} state
 * @returns {'mesh'|'sites'}
 */
export function dominantPointLevel({ meshDrawn, sitesDrawn, scale, band }) {
  if (meshDrawn !== sitesDrawn) return sitesDrawn ? 'sites' : 'mesh';
  const zoom = pointZoomWeights(scale, band);
  return zoom.fine >= zoom.coarse ? 'sites' : 'mesh';
}

/**
 * The drawn point level a settled view can let go of NOW, or null.
 *
 * A level is dropped only when its zoom weight is zero AND the level replacing
 * it is drawn and has finished arriving: until then it is the cover that keeps
 * the map from going blank, at whatever alpha the cover rule gives it.
 *
 * @param {{scale: number, band: {fine:number, coarse:number}, meshDrawn: boolean,
 *   sitesDrawn: boolean, meshArrival?: number, sitesArrival?: number}} state
 * @returns {'mesh'|'sites'|null}
 */
export function retiredPointLevel({ scale, band, meshDrawn, sitesDrawn, meshArrival = 1, sitesArrival = 1 }) {
  if (!meshDrawn || !sitesDrawn) return null;
  const zoom = pointZoomWeights(scale, band);
  if (zoom.fine === 0 && meshArrival >= 1) return 'sites';
  if (zoom.coarse === 0 && sitesArrival >= 1) return 'mesh';
  return null;
}

/**
 * The arrival ramp a rebuild owes, from what was drawn before it and after it.
 *
 * Points appearing where there were none arrive as `points` (over the prisms,
 * or over an empty globe); a point level appearing beside the other arrives
 * under its own key. A same-level redraw — a pan — owes nothing: the old
 * drawing stays until the new one replaces it, and nothing fades.
 *
 * @param {{mesh: boolean, sites: boolean}} before
 * @param {{mesh: boolean, sites: boolean}} after
 * @returns {?string} One of the `ARRIVAL_*` keys, or null.
 */
export function pointArrivalKey(before, after) {
  const had = Boolean(before?.mesh || before?.sites);
  const has = Boolean(after?.mesh || after?.sites);
  if (!has) return null;
  if (!had) return ARRIVAL_POINTS;
  if (after.sites && !before.sites) return ARRIVAL_SITES;
  if (after.mesh && !before.mesh) return ARRIVAL_MESH;
  return null;
}

/**
 * The role of every mark, from the ids each point level draws.
 *
 * @param {Iterable<string>} meshIds Ids the mesh draws.
 * @param {Iterable<string>} siteIds Ids the site level draws.
 * @param {{meshDrawn: boolean, sitesDrawn: boolean}} drawn
 * @returns {Map<string, string>} id → role.
 */
export function pointRoles(meshIds, siteIds, { meshDrawn, sitesDrawn }) {
  const roles = new Map();
  const both = meshDrawn && sitesDrawn;
  const mesh = new Set(meshDrawn ? meshIds : []);
  if (sitesDrawn) {
    for (const id of siteIds) roles.set(id, both && mesh.has(id) ? ROLE_SHARED : ROLE_SITES);
  }
  for (const id of mesh) if (!roles.has(id)) roles.set(id, ROLE_MESH);
  return roles;
}

/**
 * The plate count a view is sized for: every mark, each weighted by the alpha
 * its role will settle at on this view.
 *
 * Mark-size rules in this family hold an ink budget over what is ON SCREEN.
 * Counting a site that is drawn at 0.1 as a whole mark would shrink every
 * plate at the coarse end of the band for marks nobody can see yet; ignoring
 * it would size the fine end for the mesh alone.
 *
 * @param {{shared: number, sites: number, mesh: number}} counts Marks per role.
 * @param {number} scale Settled scale.
 * @param {{fine:number, coarse:number}} band
 * @param {{meshDrawn: boolean, sitesDrawn: boolean}} drawn
 * @returns {number}
 */
export function effectiveMarkCount(counts, scale, band, { meshDrawn, sitesDrawn }) {
  const levels = coverAlphas(pointZoomWeights(scale, band), { fineReady: sitesDrawn, coarseReady: meshDrawn });
  return (counts.shared || 0)
    + (counts.sites || 0) * levels.fine
    + (counts.mesh || 0) * levels.coarse;
}

/**
 * Per frame: the alpha of the prisms, and of each mark role — the cut through
 * `coverAlphas` with a hard target, the band through `coverAlphas` over the
 * reveal (the same holding rule `bandAlphas` applies to its crossfade).
 *
 * Writes into `out` rather than returning a new object, so a frame allocates
 * nothing. Every point weight is quantised, so a still camera compares equal
 * and writes nothing.
 *
 * @param {object} state
 * @param {boolean} state.national Whether the cut's target is the prisms (the settled regime).
 * @param {boolean} state.nationalReady Whether the prisms are painted.
 * @param {boolean} state.meshDrawn
 * @param {boolean} state.sitesDrawn
 * @param {number} state.scale From {@link siteFadeScale}; ignored without a band.
 * @param {?{fine:number, coarse:number}} state.band The mesh ↔ sites band, or null (no mesh).
 * @param {(key: string) => number} state.arrival The handle's arrival ramp for one key.
 * @param {object} out
 * @returns {{national: number, nationalShown: boolean, shared: number, sites: number, mesh: number,
 *   meshLevel: number, sitesLevel: number}} `out`, filled.
 */
export function familyAlphas(state, out) {
  const pointsDrawn = Boolean(state.meshDrawn || state.sitesDrawn);
  const cut = coverAlphas(state.national ? NATIONAL_TARGET : POINTS_TARGET, {
    fineReady: pointsDrawn,
    coarseReady: Boolean(state.nationalReady),
    fineArrival: state.arrival(ARRIVAL_POINTS),
    coarseArrival: state.arrival(ARRIVAL_NATIONAL),
  });
  let fine = 1;
  let coarse = 1;
  if (state.band) {
    const levels = coverAlphas(pointZoomWeights(state.scale, state.band), {
      fineReady: Boolean(state.sitesDrawn),
      coarseReady: Boolean(state.meshDrawn),
      fineArrival: state.arrival(ARRIVAL_SITES),
      coarseArrival: state.arrival(ARRIVAL_MESH),
    });
    fine = levels.fine;
    coarse = levels.coarse;
  }
  out.national = quantizeFade(cut.coarse);
  // Shown the moment they are painted while they are the target, and kept
  // until their alpha reaches zero while they are not: never faded.
  out.nationalShown = Boolean(state.nationalReady) && (Boolean(state.national) || out.national > 0);
  out.shared = quantizeFade(cut.fine);
  out.sites = quantizeFade(cut.fine * fine);
  out.mesh = quantizeFade(cut.fine * coarse);
  out.sitesLevel = state.sitesDrawn ? out.sites : 0;
  out.meshLevel = state.meshDrawn ? out.mesh : 0;
  return out;
}

/**
 * A fader for a layer's own records: writes each record's role weight through
 * the layer's writer, and only for records whose weight moved.
 *
 * The early exit is on the three role weights, so a frame in which none of
 * them changed costs three comparisons. `invalidate()` after a rebuild makes
 * the next frame walk the new records even if the weights did not move. A new
 * record is assumed drawn at full strength (`fadeWeight` undefined reads as 1),
 * so a record that should stay at 1 is never written at all.
 *
 * @param {(record: object, weight: number) => void} write Applies one weight to one record.
 * @returns {{invalidate: () => void, apply: (records: Map<string, object>, weights: {shared:number, sites:number, mesh:number}) => {changed: boolean, crossed: boolean}}}
 */
export function createRecordFader(write) {
  const last = { shared: NaN, sites: NaN, mesh: NaN };
  let dirty = true;
  const result = { changed: false, crossed: false };
  return {
    invalidate() {
      dirty = true;
    },
    apply(records, weights) {
      result.changed = false;
      result.crossed = false;
      if (!dirty && last.shared === weights.shared && last.sites === weights.sites && last.mesh === weights.mesh) {
        return result;
      }
      dirty = false;
      last.shared = weights.shared;
      last.sites = weights.sites;
      last.mesh = weights.mesh;
      for (const record of records.values()) {
        const role = record.fadeRole;
        const weight = role === ROLE_SITES ? weights.sites : role === ROLE_MESH ? weights.mesh : weights.shared;
        const previous = record.fadeWeight ?? 1;
        if (previous === weight) continue;
        // Crossing zero changes whether the mark is DRAWN at all, which the
        // layer has to know: a mark at zero is hidden, not drawn transparent.
        if ((previous > 0) !== (weight > 0)) result.crossed = true;
        record.fadeWeight = weight;
        write(record, weight);
        result.changed = true;
      }
      return result;
    },
  };
}
