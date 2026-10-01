/**
 * @module petiteEnfanceFrance
 *
 * Where a childcare place is easy to find in France, and where it is not.
 *
 * The source is the CNAF's own *taux de couverture d'accueil du jeune enfant*
 * (data.caf.fr, Licence Ouverte 2.0) at the three scales it is published:
 * département, intercommunalité, commune. `petiteEnfanceFeed.js` holds the
 * reading of the seven files and every trap in them — including WHY this layer
 * draws a rate rather than a register of crèches, which is a measured answer
 * and not a shortcut. `petiteEnfanceDepartements.js` holds the national fold.
 * This file is the rendering.
 *
 * ── Two regimes, and neither of them draws a point ──────────────────────────
 *   national — the 96 bundled metropolitan département polygons, filled by
 *              how the département compares with France. It holds from orbit
 *              all the way down to {@link NATIONAL_EXIT_SPAN_DEG}.
 *   local    — the intercommunalité and commune TERRITORIES themselves, from
 *              `geo.api.gouv.fr` commune outlines, fetched a département at a
 *              time for the départements in view.
 *
 * This layer used to draw the local scales as dots at each area's
 * administrative centre, and that was wrong in a way worth recording. A
 * coverage rate is a property of a TERRITORY; drawn as a dot it becomes a
 * property of a coordinate, and the coordinate is a centroid — a field outside
 * the seat commune of a rural intercommunalité, a spot in the 5th for a
 * Métropole. Nothing on screen said where the number stopped applying.
 *
 * ── How an EPCI is drawn when it has no contour ─────────────────────────────
 * `geo.api.gouv.fr` publishes no EPCI outline and refuses an unfiltered
 * contour request. It does publish `codeEpci` alongside every commune, at no
 * extra call — so an intercommunalité is filled as its MEMBER COMMUNES, all
 * carrying one colour and no internal outline, which reads as one territory
 * rather than as a mosaic. What is missing is the union's outer stroke, and
 * nothing here fakes one.
 *
 * ── Where the two grains meet ───────────────────────────────────────────────
 * The CNAF publishes the commune scale only above 10 000 inhabitants —
 * **1 061 of France's ~34 875** — so it can never tile anything. Below
 * {@link COMMUNE_SPAN_DEG} those 1 061 communes are CUT OUT of their EPCI's
 * wash and filled with their own rate instead. The two grains therefore never
 * overlap: every piece of ground carries exactly one number, the finest one
 * published for it, and the outline says which. Above that span the EPCI wash
 * is continuous.
 *
 * ── What the map no longer says, and why that is the right trade ────────────
 * The dots were sized by total places, so the layer used to answer "how much
 * childcare is here?" and "how much per child?" at once. A fill has one
 * channel and it is spent on the rate — the question the indicator exists to
 * answer. The places count is on every card, and the alternative (a dot
 * floating over its own territory) is exactly the thing this regime removed.
 *
 * ── What the colour means ───────────────────────────────────────────────────
 * How the area compares with France, as a ratio to the national rate of the
 * same edition (60,9 places per 100 children under three, in 2023). NOT a
 * quantile: this layer paints three nested scales, and a quantile band would
 * mean "the top sixth of what is on screen", so an area would change colour
 * as you zoomed without anything changing about it. Anchoring on the one
 * national figure makes a colour mean the same thing at every zoom.
 *
 * And it is never a count of crèches: nothing in open data is one. The
 * measurement behind that sentence — 210 CNAF datasets, FINESS, the BPE and
 * Sirene, all checked — is in `petiteEnfanceFeed.js`.
 */

import * as Cesium from 'cesium';
import { claimCameraSensitivity, releaseCameraSensitivity } from './cameraSensitivity.js';
import { markViewportRead, releaseCameraSettle, watchCameraSettle } from './cameraSettle.js';
import { governorRequestRender } from '../renderGovernor.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import { ringAnchor } from './communeContours.js';
import { parseDepartements } from './meteoFranceVigilance.js';
import { boxKey, snapBoxOutward } from './viewportBox.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import {
  PE_BANDS,
  PE_BOX_STEP_DEG,
  PE_GEO_SOURCE,
  PE_BAND_RATIOS,
  PE_MODES,
  peBandName,
  peModeLabel,
  peModeShortLabel,
  peScaleLabel,
} from './petiteEnfanceFeed.js';
import { pickAt } from './pickAt.js';
import {
  bandPosition,
  coverAlphas,
  fadeBand,
  fadeInstances,
  fadingColorMaterial,
  levelVisible,
  quantizeFade,
  reveal,
  watchZoomFade,
} from './zoomFade.js';
import { formatDecimal, formatNumber } from '../i18n/format.js';
import messages from './petiteEnfanceFrance.i18n.js';
import { serverFailureMessage } from '../i18n/serverMessages.js';

export const PE_FR_LAYER_ID = 'petite-enfance-fr';

export const PE_FR_OVERLAY_SOURCE_ID = 'petite-enfance-fr-selected';
export const PE_FR_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});
export const PE_FR_LABEL_SOURCE_ID = 'petite-enfance-fr-departements';
export const PE_FR_LABEL_COHORT_LIMIT = 14;
export const PE_FR_LABEL_COLLISION_CAPACITY = 12;

const DEPARTEMENTS_URL = new URL(
  './local_data/france_departements/departements.geojson',
  import.meta.url,
).href;

// --- Activation / load gating ----------------------------------------------
/**
 * View latitude span (degrees) below which the TERRITORIES are drawn.
 *
 * It used to be 9,5° — the height of metropolitan France — because below it
 * the dots took over. What is below it now is real geometry, and the ceiling
 * is how much of it a view can hold: measured on the ground, a 0,9° box holds
 * about 1 450 communes, which is the same order as the parcel batches this
 * app already draws. So the choropleth answers everything above that and the
 * territories take over below it — now across a band rather than on a line,
 * see {@link PE_NATIONAL_BAND}.
 */
export const NATIONAL_EXIT_SPAN_DEG = 0.9;
/**
 * View latitude span below which communes are cut out of their EPCI's wash.
 *
 * 0,45° is about 50 km of France — a metropolitan area and its ring — which
 * is the first zoom at which "which commune" is a question a reader can act
 * on, and comfortably inside the regime that is already drawing territory.
 * The coarse end of {@link PE_COMMUNE_BAND}.
 */
export const COMMUNE_SPAN_DEG = 0.45;

/**
 * ── Fade on zoom: the three scales are ONE statistic ────────────────────────
 * Every level this layer draws is the CNAF's own `txcouv_pe_*` — places per
 * 100 children under three — for ONE reference year, discovered once per
 * build, and banded against ONE national rate (`peBand`, ratios
 * {@link PE_BAND_RATIOS}) in ONE proxy pass (`refreshPeCoverage`). The colour
 * is anchored on the national figure precisely so that "an area would change
 * colour as you zoomed without anything changing about it" cannot happen.
 * That is the case fade on zoom exists for: the département fill can dim while
 * the EPCI wash comes in over it, and both mean the same thing for as long as
 * the camera rests between them. Each band's two levels are drawn at the
 * alphas `peBandAlphas` gives them, multiplied into each band's own alpha
 * (`BAND_ALPHA`, `TERRITORY_ALPHA`) — one factor for every band of a level,
 * so the extremes still outweigh the middle at every point of the fade.
 */

/**
 * Département choropleth → territories, in degrees of view latitude.
 *
 * The coarse end is where the territories start loading today, 0,9°, and it
 * is also the most the contour proxy can be asked for with room to spare: the
 * box is snapped OUTWARD to {@link PE_BOX_STEP_DEG}, so a 0,9° view asks for
 * at most 0,9 + 2 × 0,1 = 1,1°, under the 1,3° (`PE_MAX_BOX_DEG`) the proxy
 * refuses above, and holds the ~1 450 communes measured for that span, under
 * the 2 400 one answer may carry. The old exit at 1,3° could snap to 1,5° and
 * be refused; the band never asks that. The fine end is 0,6 × 0,9 = 0,54°:
 * a ratio of 1,67, a little under one zoom level, so the hand-over is one
 * gesture and not a crawl. The choropleth stays drawn down to it, which costs
 * nothing — it is the ~35 KB national rollup over 112 bundled polygons,
 * already in hand. The band replaces the old 0,9° / 1,3° hysteresis: inside
 * it both levels are drawn, so a camera resting on an edge flips nothing a
 * reader can see.
 */
export const PE_NATIONAL_BAND = fadeBand(0.54, NATIONAL_EXIT_SPAN_DEG);

/**
 * EPCI wash → commune cut-outs, in degrees of view latitude.
 *
 * The coarse end is the 0,45° where the cut-outs start today, the fine end
 * 0,6 × 0,45 = 0,27° (ratio 1,67, the same gesture as the band above). The
 * commune grain costs no fetch at all — the same contour answer carries both
 * grains — so the band costs only drawing: inside it, the ground of every
 * commune the CNAF publishes is drawn twice, once in its EPCI's colour fading
 * out and once in its own fading in. Those are only the communes of more than
 * 10 000 inhabitants (1 061 in France) that fall in the view, against the
 * ~1 450 rings of the whole wash at the outer band's edge. Outside the band
 * the ground is drawn once, as before. The two bands do not overlap
 * (0,45 < 0,54), so the EPCI level, which sits between them, is drawn at the
 * product of its two alphas, of which at most one is below 1 at any span.
 */
export const PE_COMMUNE_BAND = fadeBand(0.27, COMMUNE_SPAN_DEG);

/**
 * The two weights a band gives its levels: a `reveal`, not a symmetric
 * crossfade.
 *
 * Both bands can only sit BELOW the old switches (the outer one is capped by
 * the contour proxy's box, the inner one starts where the cut-outs always
 * did), and a symmetric crossfade there hands most of each band to the
 * coarser level: a view just under 0,9° that used to show the EPCI wash
 * would show the départements, and one just under 0,45° that used to show
 * communes would show EPCI. Measured the same way on the carroyage, where it
 * turned the harness's city view into a view of the 1 km grid. The reveal
 * brings the finer level to full strength over the first 30 % of the band and
 * fades the coarser one out behind it.
 *
 * @param {number} span View latitude span, degrees.
 * @param {{fine: number, coarse: number}} band
 * @returns {{fine: number, coarse: number}}
 */
export function peBandWeights(span, band) {
  return reveal(bandPosition(span, band));
}

/** The alphas a band's levels are drawn at, with the zoomFade cover rule. */
function peBandAlphas(span, band, state) {
  return coverAlphas(peBandWeights(span, band), state);
}

/** The two bands as the zoom-fade diagnostics report them. */
const FADE_BANDS_REPORT = Object.freeze({
  'departements-epci': Object.freeze({
    fine: PE_NATIONAL_BAND.fine, coarse: PE_NATIONAL_BAND.coarse, unit: 'deg-lat',
  }),
  'epci-communes': Object.freeze({
    fine: PE_COMMUNE_BAND.fine, coarse: PE_COMMUNE_BAND.coarse, unit: 'deg-lat',
  }),
});

/** Box answers kept in the browser between views, LRU. */
export const PE_BOX_CACHE = 6;
const CAMERA_DEBOUNCE_MS = 450;
/**
 * Poll cadence (ms). The CNAF publishes this once a year, in January, so
 * anything faster re-asks a question whose answer cannot have changed.
 */
const POLL_INTERVAL_MS = 6 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 120_000;
/**
 * Territories one view may fill.
 *
 * Well above what the proxy will send — `PE_MAX_BOX_COMMUNES` caps one answer
 * at 2 400 communes, and several of those share an EPCI — which makes this a
 * runaway guard rather than a policy. What it drops is reported on the row.
 */
const MAX_RENDERED_AREAS = 4_000;

// --- Presentation -----------------------------------------------------------
/**
 * The band ramp: a DIVERGING scale, because the quantity has a meaningful
 * midpoint — the national rate — and the question a reader actually asks is
 * "is it worse than average here?", which a sequential ramp cannot answer
 * without counting swatches.
 *
 * Orange below France, blue above, with the break falling exactly between
 * index 2 and index 3 where the ratio crosses 1. No green anywhere, on
 * purpose: Vigilance's ramp is green→red and the schools choropleth is
 * sequential green, and this map must not be mistaken for either at a glance.
 * It is also not the charge-point ramp, which runs blue→red the other way.
 */
const BAND_COLORS = Object.freeze({
  'tres-bas': '#8c2d04',
  bas: '#e6550d',
  'sous-moyenne': '#fdae6b',
  'sur-moyenne': '#9ecae1',
  haut: '#4292c6',
  'tres-haut': '#08519c',
});

/** Fill alpha per band. The extremes carry more weight, both ways. */
const BAND_ALPHA = Object.freeze({
  'tres-bas': 0.68,
  bas: 0.60,
  'sous-moyenne': 0.50,
  'sur-moyenne': 0.50,
  haut: 0.60,
  'tres-haut': 0.68,
});

/**
 * Fill alpha per band in the LOCAL regime.
 *
 * The choropleth's own alphas, scaled to 55%. A département fill covers ground
 * a reader is looking at from 500 km up, where there is nothing underneath it
 * to lose; an EPCI fill sits over streets and buildings at city zoom, and at
 * the choropleth's weight it stops being a highlight and becomes a lid. The
 * RATIO between the bands is preserved exactly, so the extremes still carry
 * more weight than the middle, both ways.
 */
const TERRITORY_ALPHA = Object.freeze({
  'tres-bas': 0.374,
  bas: 0.330,
  'sous-moyenne': 0.275,
  'sur-moyenne': 0.275,
  haut: 0.330,
  'tres-haut': 0.374,
});

const SELECTED_COLOR = '#00ffff';
/**
 * The commune grain outlines, the EPCI grain does not.
 *
 * The two never overlap — a commune the CNAF publishes is cut out of its
 * EPCI's wash — so the hairline is not a border between two fills, it is the
 * one mark that says "this piece carries its own number". Drawing the EPCI's
 * member communes with the same hairline would turn one territory into a
 * mosaic of thirty, which is precisely the reading this regime exists to
 * prevent.
 */
const COMMUNE_OUTLINE_COLOR = '#ffffff';
const COMMUNE_OUTLINE_ALPHA = 0.34;
const COMMUNE_OUTLINE_WIDTH_PX = 1.4;
const SELECTED_OUTLINE_WIDTH_PX = 3;
/** The selected territory's own wash, laid over the band fill it belongs to. */
const SELECTED_FILL_ALPHA = 0.16;

/**
 * One-line explanation behind each band swatch.
 *
 * A function and not a constant: a constant is resolved when the module loads,
 * which would freeze the key in whatever language booted first.
 */
function bandBlurb(band) {
  return messages().bandBlurbs[band] || null;
}

const DEFAULT_OVERLAY_HOST = Object.freeze({
  setEntries: setOverlayEntries,
  setVisible: setOverlaySourceVisible,
  clearSource: clearOverlaySource,
});
let _overlayHost = DEFAULT_OVERLAY_HOST;

// --- Runtime state ----------------------------------------------------------
let _viewer = null;
/**
 * The territories of the DOMINANT grain of the drawing on screen: what the
 * legend counts, what a harness reads, what a callout anchors on.
 */
let _records = new Map();
/**
 * Every territory the drawing on screen can answer a click for — both grains
 * inside the commune band, where a fading commune is still a commune.
 */
let _pickRecords = new Map();
let _enabled = false;
let _clickHandler = null;
let _cameraChangedAttached = false;
let _cameraDebounceTimer = null;
let _selectedId = null;
let _count = 0;
let _lastUpdate = null;
let _loading = false;
let _loadingNational = false;
let _loadingLocal = false;
let _error = null;
let _status = 'idle';
/**
 * The DOMINANT level at the last settled view: `national` while the
 * département fill outweighs the territories, `local` once they outweigh it.
 * It owns the legend, the status line and the card; it no longer decides
 * what is loaded — {@link pePlanLevels} does.
 */
let _regime = 'national';
/** Inside the local regime, the dominant grain: `epci` or `com`. */
let _grain = 'epci';
/** What the last settled view loads. See {@link pePlanLevels}. */
let _plan = null;
let _requestGeneration = 0;

let _national = null;
let _nationalPromise = null;
let _nationalError = null;
/** The rollup the département entities were last painted with. */
let _paintedNational = null;
/** The département entities carry a fill (the national level can be drawn). */
let _nationalPainted = false;
/** Whether the département entities are shown, as the fade last decided. */
let _depShown = false;
/** Codes the rollup paints; the rest are absence and stay hidden. */
let _depPaintedCodes = new Set();
/**
 * The weight every département fill is multiplied by, read by the entities'
 * colour callbacks. Already on the `FADE_STEPS` grid.
 */
let _nationalWeight = 1;
/** One fading material per band, shared by every département in it. */
const _depMaterials = new Map();
let _depHighlightMaterial = null;
let _depDataSource = null;
let _depEntities = new Map();
let _depMeta = new Map();
let _depShapesPromise = null;

let _pack = null;
let _packPromise = null;
let _packError = null;
let _inView = 0;
let _communesShown = 0;
let _unpainted = 0;

/** INSEE code → the CNAF area drawn for it, rebuilt whenever the pack lands. */
let _areaIndex = new Map();
/** snapped box key → the outlines it answered, LRU-capped at `PE_BOX_CACHE`. */
const _contourPacks = new Map();
const _contourPromises = new Map();
let _contourError = null;
let _visibleDeps = [];
let _dropped = 0;
/**
 * The territory drawing on screen, and the one being built to replace it.
 * See {@link drawLocal} for the shape; the pending one is built hidden and
 * promoted by the frame callback once every primitive in it is ready.
 */
let _local = null;
let _pendingLocal = null;
let _selectionFill = null;
let _selectionOutline = null;
/** The two selection primitives with their `[id, colour]` lists, for the fade. */
let _selectionBatches = [];
/** `watchZoomFade` handle while the layer is enabled. */
let _fade = null;
/** What the last frame drew each level at, for the harness. */
let _levelAlphas = {
  departements: 0, epci: 0, epciUnderCommunes: 0, communes: 0,
};

// --- Colour and size --------------------------------------------------------

/** Hex for one band, or null when the area has no published rate. */
export function peBandColor(band) {
  return BAND_COLORS[band] || null;
}

/** Fill alpha for one band. */
export function peBandAlpha(band) {
  return BAND_ALPHA[band] ?? 0;
}

/** The band's name in the page's language. */
export function peBandLabel(band) {
  return peBandName(band) || messages().noRate;
}

/**
 * Legend labels for the ramp, expressed against the edition's national rate.
 *
 * Built from the ratios rather than typed, so the legend and the colours can
 * never disagree, and so the numbers move with the national rate between
 * editions instead of going quietly stale.
 */
export function peBandRangeLabels(national) {
  const m = messages();
  const reference = Number(national);
  const has = Number.isFinite(reference) && reference > 0;
  const at = (ratio) => (has
    ? `${(ratio * reference).toFixed(0)}`
    : m.legend.ratio(Math.round(ratio * 100)));
  const labels = [];
  for (let i = 0; i < PE_BAND_RATIOS.length; i += 1) {
    labels.push(i === 0
      ? m.legend.below(at(PE_BAND_RATIOS[0]))
      : m.legend.between(at(PE_BAND_RATIOS[i - 1]), at(PE_BAND_RATIOS[i])));
  }
  labels.push(m.legend.above(at(PE_BAND_RATIOS[PE_BAND_RATIOS.length - 1])));
  return labels;
}

/**
 * Fill alpha for one band in the LOCAL regime.
 *
 * Derived from the choropleth's alpha rather than typed independently, so the
 * two regimes can never disagree about which end of the ramp carries weight.
 */
export function peTerritoryAlpha(band) {
  return TERRITORY_ALPHA[band] ?? 0;
}

// --- Camera -----------------------------------------------------------------

/** View box for the local regime — the camera rectangle, padded. */
export function cameraPeBox(viewer, padFraction = 0.12) {
  const rectangle = viewer?.camera?.computeViewRectangle?.();
  if (!rectangle) return null;
  const south = Cesium.Math.toDegrees(rectangle.south);
  const north = Cesium.Math.toDegrees(rectangle.north);
  const west = Cesium.Math.toDegrees(rectangle.west);
  const east = Cesium.Math.toDegrees(rectangle.east);
  if (![south, west, north, east].every(Number.isFinite)) return null;
  if (west >= east || south >= north) return null;
  const padLat = (north - south) * padFraction;
  const padLon = (east - west) * padFraction;
  return {
    south: Math.max(-90, south - padLat),
    north: Math.min(90, north + padLat),
    west: Math.max(-180, west - padLon),
    east: Math.min(180, east + padLon),
  };
}

/** A view rectangle's latitude span, in degrees; Infinity past the limb. */
export function peViewSpanDeg(viewer) {
  const rectangle = viewer?.camera?.computeViewRectangle?.();
  if (!rectangle) return Infinity;
  const lat = Cesium.Math.toDegrees(rectangle.north - rectangle.south);
  return Number.isFinite(lat) ? lat : Infinity;
}

/**
 * What one settled view loads, and which level owns the legend.
 *
 * A level is loaded wherever its zoom weight is above zero — on the
 * `FADE_STEPS` grid, so a sliver of weight at a band's far end loads nothing
 * a reader could see — and dropped only where it is zero. Inside the commune
 * band both grains are drawn; `under` is the EPCI colour on the ground of the
 * communes that are cut out, `over` their own colour on it.
 *
 * The dominant level is decided here, on the settled view, exactly as the
 * regime was before: the finer level owns the row from half strength, which
 * the reveal reaches 15 % into each band.
 *
 * @param {number} span View latitude span, degrees (Infinity past the limb).
 * @param {{hasBox?: boolean}} [options] `hasBox`: the view has a rectangle to
 *   ask the contour proxy about; without one the territories cannot load.
 * @returns {{national: boolean, local: boolean, under: boolean, over: boolean,
 *   regime: string, grain: string}}
 */
export function pePlanLevels(span, { hasBox = true } = {}) {
  const outer = peBandWeights(span, PE_NATIONAL_BAND);
  const inner = peBandWeights(span, PE_COMMUNE_BAND);
  const local = Boolean(hasBox) && levelVisible(true, outer.fine);
  const national = !local || levelVisible(true, outer.coarse);
  const under = local && levelVisible(true, inner.coarse);
  const over = local && levelVisible(true, inner.fine);
  // i18n-ignore-start — regime and grain KEYS.
  return {
    national,
    local,
    under,
    over,
    regime: local && outer.fine >= 0.5 ? 'local' : 'national',
    grain: over && (!under || inner.fine >= 0.5) ? 'com' : 'epci',
  };
  // i18n-ignore-end
}

/**
 * The id one geometry instance carries.
 *
 * One OBJECT per instance, not the territory's id string: an EPCI is drawn
 * as all of its member communes, and `getGeometryInstanceAttributes` answers
 * only the first instance of a repeated id — fading by it would fade one
 * commune of thirty. The object resolves to the territory id everywhere a
 * pick is read: `.id` for `resolvePickId` and the pick registry, `toString()`
 * for anything that prints it.
 */
class PeInstanceId {
  constructor(id, part) {
    this.id = id;
    this.part = part;
  }

  toString() {
    return this.id;
  }
}

/** The territory id a pick carries, whether a string or a {@link PeInstanceId}. */
export function peTerritoryIdOf(pickedId) {
  if (typeof pickedId === 'string') return pickedId;
  return typeof pickedId?.id === 'string' ? pickedId.id : null;
}

/**
 * Where a territory's card hangs.
 *
 * The centroid of its biggest drawn ring, and NOT the administrative centre
 * the `/areas` pack carries: the card must point at the shape on screen, and
 * for a multi-part area those two can be tens of kilometres apart. The centre
 * is still the fallback for an area whose outline never arrived.
 */
function territoryAnchor(record) {
  const anchor = record?.anchor
    || (Number.isFinite(record?.area?.lon) ? [record.area.lon, record.area.lat] : null);
  if (!anchor) return null;
  return Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1]);
}

/** A grouped integer: `12 400` in French, `12,400` in English. */
function fr(value) {
  return formatNumber(Number(value));
}

/** A published rate, to one decimal: `60,9` in French, `60.9` in English. */
function rate(value) {
  return Number.isFinite(value)
    ? formatDecimal(value, 1, { minimumFractionDigits: 1 })
    : null;
}

// --- Cards ------------------------------------------------------------------

/**
 * The mode breakdown as card lines — the five leaves, largest first, each with
 * its rate and its places.
 *
 * Only the leaves. The CNAF also publishes two subtotals (`eaje`, `ind`) that
 * are sums of these, and printing both on one card would make the same
 * children appear twice to a reader adding the column up.
 */
function modeLines(area) {
  const rows = [];
  for (const mode of PE_MODES) {
    const value = Number(area?.modes?.[mode]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const places = Number(area?.places?.[mode]);
    rows.push({ mode, value, places: Number.isFinite(places) ? places : null });
  }
  rows.sort((a, b) => b.value - a.value);
  const m = messages();
  return rows.map((row) => m.card.mode(
    peModeLabel(row.mode) || row.mode,
    rate(row.value),
    row.places !== null ? m.card.modePlaces(fr(row.places)) : '',
  ));
}

/** The one line that says how this area sits against France. */
function comparisonLine(area, national) {
  const m = messages();
  if (!Number.isFinite(area?.rate)) return m.card.noRateHere;
  const parts = [m.card.rate(rate(area.rate))];
  if (Number.isFinite(national) && national > 0) {
    const ratio = area.rate / national;
    const pct = Math.round(Math.abs(ratio - 1) * 100);
    if (pct === 0) parts.push(m.card.atNationalAverage);
    else {
      parts.push(ratio > 1
        ? m.card.aboveAverage(pct, rate(national))
        : m.card.belowAverage(pct, rate(national)));
    }
  }
  return parts.join(' — ');
}

/**
 * Card copy for one selected area. Every line is a published value or a stated
 * absence of one; nothing here is inferred.
 */
export function buildPeSelectionLabel(record) {
  const m = messages();
  const area = record?.area || {};
  const national = record?.national ?? null;
  const details = [];
  const title = area.name || area.code || m.card.untitled;

  // The scale is the first thing on the card, because three nested scales sit
  // under the cursor and a rate is meaningless without knowing whose it is.
  const scale = peScaleLabel(area.scale) || m.card.untitled;
  details.push(record?.year ? m.card.scaleAndYear(scale, record.year) : scale);

  details.push(comparisonLine(area, national));

  if (Number.isFinite(area.totalPlaces)) {
    details.push(m.card.totalPlaces(fr(area.totalPlaces)));
  }

  const lines = modeLines(area);
  if (lines.length) details.push(...lines);

  if (area.dominant) {
    details.push(m.card.dominant(peModeShortLabel(area.dominant) || area.dominant));
  }

  const where = [area.deptName, area.region].filter(Boolean).join(' · ');
  // i18n-ignore-next-line — a scale KEY from the CNAF's own payload.
  if (where && area.scale !== 'dep') details.push(where);

  // The commune scale exists only above 10 000 inhabitants, and a reader
  // looking at one needs to know it is not a complete map of communes.
  // i18n-ignore-next-line — a scale KEY.
  if (area.scale === 'com') details.push(m.card.communeScaleGap);
  // i18n-ignore-next-line — a scale KEY.
  if (area.scale === 'epci') details.push(m.card.epciDrawing);
  if (record?.simplified) details.push(m.card.simplified);

  if (area.code) details.push(m.card.code(area.code));
  return [title, ...details].join('\n');
}

/** Card copy for one département at national altitude. */
export function buildPeDepartementLabel(row, national) {
  const m = messages();
  const details = [];
  details.push(comparisonLine(row, national));
  if (Number.isFinite(row.totalPlaces)) details.push(m.card.placesHere(fr(row.totalPlaces)));
  details.push(...modeLines(row));
  if (row.dominant) {
    details.push(m.card.dominant(peModeShortLabel(row.dominant) || row.dominant));
  }
  if (row.region) details.push(row.region);
  return [row.name, ...details].join('\n');
}

function selectedOverlayEntry(id, position, copy) {
  const [title, ...details] = copy.split('\n');
  return {
    id: String(id),
    position,
    variant: 'selected',
    selected: true,
    protected: true,
    paintLane: 'selected',
    collisionGroup: 'ambient-card',
    priority: Number.MAX_SAFE_INTEGER,
    title,
    details,
    accent: SELECTED_COLOR,
    interactive: false,
    anchorRadiusPx: 9,
    minAnchorGapPx: 11,
    verticalOnly: true,
    placement: 'above',
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
  };
}

/** Protected selected-area entry for the shared overlay host. */
export function createPeSelectedOverlayEntry(record) {
  const position = record?.position || territoryAnchor(record);
  if (!record?.id || !position) return null;
  return selectedOverlayEntry(record.id, position, buildPeSelectionLabel(record));
}

/** Ambient label for one département at national altitude. */
export function createPeDepartementOverlayEntry(row, position) {
  return {
    id: `petite-enfance-fr:dep:${row.code}`,
    position,
    variant: 'label',
    title: messages().departementLabel(row.name, rate(row.rate) ?? '—'),
    accent: peBandColor(row.band) || '#9aa4ad',
    // The most extreme areas earn a label, both ways round: a diverging ramp
    // whose labels all sat at one end would report half the finding.
    priority: Number.isFinite(row.ratio) ? Math.abs(row.ratio - 1) * 1000 : 0,
    collisionGroup: 'ambient-label',
    paintLane: 'ambient-label',
    interactive: false,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
  };
}

/** Keep the most extreme départements, with stable identity as tie-break. */
export function selectPeLabelCohort(entries, limit = PE_FR_LABEL_COHORT_LIMIT) {
  const cap = Math.max(0, Math.min(PE_FR_LABEL_COHORT_LIMIT, Math.floor(Number(limit) || 0)));
  if (!Array.isArray(entries) || cap === 0) return [];
  return entries.slice()
    .sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)))
    .slice(0, cap);
}

// --- Selection --------------------------------------------------------------

function highlightSelectedDepartement() {
  if (!_selectedId?.startsWith('dep:')) return;
  // It fades with the level it highlights: a cyan département left at full
  // strength over territories that have taken over would be a lid.
  _depHighlightMaterial ??= fadingColorMaterial(
    Cesium.Color.fromCssColorString(SELECTED_COLOR).withAlpha(0.42),
    () => _nationalWeight,
  );
  for (const entity of _depEntities.get(_selectedId.slice(4)) || []) {
    if (entity.polygon) entity.polygon.material = _depHighlightMaterial;
  }
}

/**
 * Close a département's card when the territories take the legend over. The
 * département may still be drawn, fading, so its band fill is put back too.
 */
function dropDepartementSelection() {
  if (_selectedId?.startsWith?.('dep:')) {
    _selectedId = null;
    _overlayHost.clearSource(PE_FR_OVERLAY_SOURCE_ID);
    repaintDepartements();
  }
}

function clearSelection() {
  const departement = _selectedId?.startsWith?.('dep:');
  // Forgotten BEFORE the repaint: `repaintDepartements` re-applies the
  // highlight of whatever is still selected, and used to put the cyan straight
  // back on the département being deselected.
  _selectedId = null;
  if (departement) repaintDepartements();
  else clearSelectionPrimitives();
  _overlayHost.clearSource(PE_FR_OVERLAY_SOURCE_ID);
  governorRequestRender('petite-enfance-fr-deselect');
}

function selectArea(id) {
  const record = _pickRecords.get(id) || _records.get(id);
  if (!record) return;
  if (_selectedId && _selectedId !== id) clearSelection();
  _selectedId = id;
  drawSelectionPrimitives(record);
  const entry = createPeSelectedOverlayEntry(record);
  if (entry) {
    _overlayHost.setEntries(PE_FR_OVERLAY_SOURCE_ID, [entry], PE_FR_OVERLAY_SOURCE_OPTIONS);
  }
  governorRequestRender('petite-enfance-fr-select');
}

function selectDepartement(code) {
  const row = (_national?.departements || []).find((entry) => entry.code === code);
  if (!row || !row.band) return;
  if (_selectedId && _selectedId !== `dep:${code}`) clearSelection();
  _selectedId = `dep:${code}`;
  highlightSelectedDepartement();
  const anchor = _depMeta.get(code)?.anchor;
  if (anchor) {
    const entry = selectedOverlayEntry(
      `petite-enfance-fr:dep-card:${code}`,
      Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1]),
      buildPeDepartementLabel(row, _national?.national),
    );
    _overlayHost.setEntries(PE_FR_OVERLAY_SOURCE_ID, [entry], PE_FR_OVERLAY_SOURCE_OPTIONS);
  }
  governorRequestRender('petite-enfance-fr-select-dep');
}

function onKeyDown(event) {
  if (event.key === 'Escape' && _selectedId) clearSelection();
}

function pickedDepartementCode(picked) {
  const entity = picked?.id;
  if (!entity?.polygon) return null;
  const code = String(entity.properties?.code?.getValue?.() ?? '').trim();
  return code || null;
}

function installClickHandler(viewer) {
  if (_clickHandler) return;
  _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  _clickHandler.setInputAction((movement) => {
    const picked = pickAt(viewer.scene, movement.position);
    const id = peTerritoryIdOf(picked?.id);
    if (id && _pickRecords.has(id)) {
      selectArea(id);
      return;
    }
    // Wherever the département level is drawn — inside the band too, where
    // both levels are on screen and either can be the one under the cursor.
    if (_depShown) {
      const code = pickedDepartementCode(picked);
      if (code && _depEntities.has(code)) {
        selectDepartement(code);
        return;
      }
    }
    if (_selectedId) clearSelection();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  document.addEventListener('keydown', onKeyDown);
}

// --- National regime --------------------------------------------------------

async function ensureDepartementShapes() {
  if (_depShapesPromise) return _depShapesPromise;
  _depShapesPromise = (async () => {
    const geojson = await (await fetch(DEPARTEMENTS_URL)).json();
    _depMeta = parseDepartements(geojson);
    const source = await Cesium.GeoJsonDataSource.load(geojson, {
      clampToGround: true,
      fill: Cesium.Color.TRANSPARENT,
      stroke: Cesium.Color.TRANSPARENT,
      strokeWidth: 0,
    });
    source.name = messages().departementSourceName;
    source.show = _enabled;
    for (const entity of source.entities.values) {
      const code = String(entity.properties?.code?.getValue?.() ?? '').trim();
      if (!entity.polygon || !code) {
        entity.show = false;
        continue;
      }
      entity.polygon.outline = false;
      entity.polygon.classificationType = Cesium.ClassificationType.BOTH;
      entity.polygon.material = new Cesium.ColorMaterialProperty(Cesium.Color.TRANSPARENT);
      entity.show = false;
      const parts = _depEntities.get(code);
      if (parts) parts.push(entity);
      else _depEntities.set(code, [entity]);
    }
    if (_viewer) await _viewer.dataSources.add(source);
    _depDataSource = source;
    return source;
  })().catch((error) => {
    _depShapesPromise = null;
    throw error;
  });
  return _depShapesPromise;
}

/**
 * Give every département its band's fill, as a FADING material.
 *
 * One material per band, kept for the life of the module, whose colour is
 * re-read each frame from `_nationalWeight` — 112 polygons, which the shared
 * fade's entity adapter is sized for. A repaint that hands an entity the
 * object it already has changes nothing, so painting again is free and only a
 * band that actually moved costs a ground-batch rebuild. Visibility is the
 * fade's call ({@link setDepartementsShown}), not this function's.
 */
function repaintDepartements() {
  if (!_national) return;
  const painted = new Set();
  for (const row of _national.departements || []) {
    const color = peBandColor(row.band);
    if (!color) continue;
    let material = _depMaterials.get(row.band);
    if (!material) {
      material = fadingColorMaterial(
        Cesium.Color.fromCssColorString(color).withAlpha(peBandAlpha(row.band)),
        () => _nationalWeight,
      );
      _depMaterials.set(row.band, material);
    }
    const parts = _depEntities.get(row.code);
    if (!parts) continue;
    painted.add(row.code);
    for (const entity of parts) {
      if (!entity.polygon) continue;
      if (entity.polygon.material !== material) entity.polygon.material = material;
    }
  }
  // A département the CNAF does not cover is drawn as absence rather than as
  // one end of the diverging ramp — which would be the worst possible default,
  // because both ends of this ramp are strong claims.
  _depPaintedCodes = painted;
  applyDepartementShow();
  highlightSelectedDepartement();
  _viewer?.scene?.requestRender?.();
}

/** Write `_depShown` onto the entities — at a transition, never per frame. */
function applyDepartementShow() {
  for (const [code, parts] of _depEntities) {
    const show = _depShown && _depPaintedCodes.has(code);
    for (const entity of parts) {
      if (entity.show !== show) entity.show = show;
    }
  }
}

function setDepartementsShown(show) {
  if (show === _depShown) return;
  _depShown = show;
  applyDepartementShow();
}

function publishDepartementOverlay() {
  if (!_enabled || _regime !== 'national') {
    _overlayHost.clearSource(PE_FR_LABEL_SOURCE_ID);
    return;
  }
  const entries = [];
  for (const row of _national?.departements || []) {
    if (!row.band) continue;
    const anchor = _depMeta.get(row.code)?.anchor;
    if (!anchor) continue;
    entries.push(createPeDepartementOverlayEntry(
      row,
      Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1]),
    ));
  }
  _overlayHost.setEntries(PE_FR_LABEL_SOURCE_ID, selectPeLabelCohort(entries), {
    cohortLimit: PE_FR_LABEL_COHORT_LIMIT,
    collisionCapacity: PE_FR_LABEL_COLLISION_CAPACITY,
    moving: false,
  });
}

async function fetchJson(path, validate) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok) throw new Error(await serverFailureMessage(response));
    const payload = await response.json();
    if (!validate(payload)) throw new Error('malformed payload');
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureNational() {
  if (_national) return _national;
  if (_nationalPromise) return _nationalPromise;
  _nationalPromise = fetchJson('/api/petite-enfance-fr/departements', (p) => Array.isArray(p?.departements))
    .then((payload) => {
      _national = payload;
      _nationalError = null;
      return payload;
    })
    .catch((error) => {
      if (error?.name !== 'AbortError') {
        console.warn('[Data:PetiteEnfance-FR] national rollup failed:', error?.message || error);
        _nationalError = error?.message || 'national rollup unavailable';
      }
      return null;
    })
    .finally(() => { _nationalPromise = null; });
  return _nationalPromise;
}

function hideDepartements() {
  _depShown = false;
  applyDepartementShow();
  _overlayHost.clearSource(PE_FR_LABEL_SOURCE_ID);
}

/** `_loading` describes the level that owns the status line. */
function syncLoading() {
  _loading = _regime === 'national' ? _loadingNational : _loadingLocal;
}

/**
 * Load and paint the département level.
 *
 * It does NOT clear the territories any more: they stay drawn until the
 * départements are, and the frame callback drops them once their weight is
 * zero. A first paint plays the level's arrival ramp; a repaint of a level
 * already on screen (the six-hourly refresh) is a same-level swap and plays
 * none.
 */
async function loadNational(generation) {
  // i18n-ignore-next-line — a regime key, compared.
  const owns = () => _regime === 'national';
  _loadingNational = !_national;
  syncLoading();
  try {
    await ensureDepartementShapes();
  } catch (error) {
    console.warn('[Data:PetiteEnfance-FR] département polygons failed:', error?.message || error);
    _loadingNational = false;
    syncLoading();
    if (owns()) {
      _error = messages().errors.departementShapes;
      _status = 'error';
    }
    return;
  }
  await ensureNational();
  if (generation !== _requestGeneration || !_enabled || !_plan?.national) return;
  _loadingNational = false;
  syncLoading();
  if (!_national) {
    if (owns()) {
      _error = _nationalError || 'national rollup unavailable';
      _status = 'error';
    }
    return;
  }
  if (owns()) {
    _error = null;
    _count = _national.painted || 0;
    _lastUpdate = Number(_national.fetchedAt) || Date.now();
    _status = _count > 0 ? 'ready' : 'empty';
  }
  publishDepartementOverlay();
  if (_paintedNational === _national) return;
  const first = !_nationalPainted;
  _paintedNational = _national;
  repaintDepartements();
  _nationalPainted = true;
  if (first) _fade?.arrive('national');
  governorRequestRender('petite-enfance-fr-national');
}

// --- Local regime -----------------------------------------------------------

/**
 * The EPCI and commune areas, fetched once.
 *
 * Deferred until the camera leaves the choropleth: the national view is
 * answered by a ~35 KB rollup, and an operator who never zooms in should not
 * pay for a pack they will not see.
 */
async function ensurePack() {
  if (_pack) return _pack;
  if (_packPromise) return _packPromise;
  _packPromise = fetchJson('/api/petite-enfance-fr/areas', (p) => Array.isArray(p?.areas))
    .then((payload) => {
      _pack = payload;
      _packError = null;
      return payload;
    })
    .catch((error) => {
      if (error?.name !== 'AbortError') {
        console.warn('[Data:PetiteEnfance-FR] area pack failed:', error?.message || error);
        _packError = error?.message || 'area pack unavailable';
      }
      return null;
    })
    .finally(() => { _packPromise = null; });
  return _packPromise;
}

/**
 * Commune outlines for one snapped view box.
 *
 * The box is snapped OUTWARD to a 0,1° grid before it is asked about, so
 * panning across a city re-asks once every few screens instead of once per
 * camera settle, and the answers are worth keeping in an LRU at all. The pack
 * carries no rate — the browser already holds those from `/areas` — so it is
 * fetched independently of the coverage build and never invalidated by it.
 * Geography does not change between two camera moves.
 */
async function ensureContours(box) {
  const key = boxKey(box);
  if (_contourPacks.has(key)) return _contourPacks.get(key);
  if (_contourPromises.has(key)) return _contourPromises.get(key);
  const params = new URLSearchParams({
    south: box.south.toFixed(4),
    west: box.west.toFixed(4),
    north: box.north.toFixed(4),
    east: box.east.toFixed(4),
  });
  const promise = fetchJson(`/api/petite-enfance-fr/contours?${params}`, (p) => Array.isArray(p?.communes))
    .then((payload) => {
      _contourPacks.set(key, payload);
      _contourError = null;
      // LRU by insertion order: a Map preserves it, so the oldest key is first.
      while (_contourPacks.size > PE_BOX_CACHE) {
        const oldest = _contourPacks.keys().next().value;
        if (oldest === undefined) break;
        _contourPacks.delete(oldest);
      }
      return payload;
    })
    .catch((error) => {
      if (error?.name !== 'AbortError') {
        console.warn('[Data:PetiteEnfance-FR] contours unavailable:', error?.message || error);
        _contourError = error?.message || messages().errors.unavailable;
      }
      return null;
    })
    .finally(() => { _contourPromises.delete(key); });
  _contourPromises.set(key, promise);
  return promise;
}

/** The view box this layer asks about: the camera's, snapped to the cache grid. */
export function peContourBox(viewer) {
  const box = cameraPeBox(viewer, 0);
  return box ? snapBoxOutward(box, PE_BOX_STEP_DEG) : null;
}

/** The `/areas` pack indexed by its own `scale:code` id. */
export function indexPeAreas(areas) {
  const index = new Map();
  for (const area of Array.isArray(areas) ? areas : []) {
    if (area?.id) index.set(area.id, area);
  }
  return index;
}

/**
 * Turn contour packs plus published rates into the territories to fill.
 *
 * Exported and pure so the whole nesting decision can be tested without a
 * viewer: given outlines and rates, this is exactly what would be painted.
 *
 * ── The one rule ────────────────────────────────────────────────────────────
 * Every piece of ground goes to the FINEST scale the CNAF published for it,
 * and to exactly one scale. Below `COMMUNE_SPAN_DEG` a commune with its own
 * row takes its ground out of the EPCI's wash; above it, or where no commune
 * row exists, the ground belongs to the EPCI. So the two fills never overlap,
 * two translucent colours never blend into a third that means nothing, and a
 * reader clicking anywhere gets the number that actually covers that spot.
 *
 * ── The arrondissements ─────────────────────────────────────────────────────
 * Paris, Lyon and Marseille are published by arrondissement municipal, and
 * their parent commune is the same ground. Where an arrondissement carries a
 * row, the parent is dropped entirely — drawing both would paint Paris twice,
 * once in its EPCI's colour and once in twenty of its own. An arrondissement
 * the CNAF did not publish falls back to its parent's EPCI, which is why the
 * pack carries `codeEpci` on it.
 *
 * Ground whose area has no published rate is drawn as ABSENCE and counted, not
 * as one end of the ramp: both ends of a diverging ramp are strong claims.
 *
 * @param {object} input
 * @param {Array<object>} input.packs Contour packs, one per département.
 * @param {Array<object>|Map<string,object>} input.areas The `/areas` rows.
 * @param {boolean} [input.withCommunes] Whether the commune grain is on.
 * @param {?number} [input.national] National rate, for the cards.
 * @param {?number} [input.year]
 * @param {number} [input.limit]
 * @returns {{records:Array<object>, epci:number, communes:number, unmatched:number, unrated:number}}
 */
export function buildPeTerritoryRecords({
  packs, areas, withCommunes = false, national = null, year = null, limit = MAX_RENDERED_AREAS,
} = {}) {
  const byId = areas instanceof Map ? areas : indexPeAreas(areas);
  const pieces = new Map();
  const order = [];
  const seen = new Set();
  let unmatched = 0;
  let unrated = 0;

  for (const pack of Array.isArray(packs) ? packs : []) {
    const rows = Array.isArray(pack?.communes) ? pack.communes : [];
    // Which parent communes their own arrondissements replace in this pack.
    // Computed over the WHOLE pack first: the parent row can be read before
    // the arrondissement that supersedes it.
    const replaced = new Set();
    if (withCommunes) {
      for (const row of rows) {
        if (row?.a && byId.has(`com:${row.c}`)) replaced.add(row.a);
      }
    }
    for (const row of rows) {
      if (!Array.isArray(row?.p) || !row.p.length) continue;
      if (row.a ? !replaced.has(row.a) : replaced.has(row.c)) continue;
      if (seen.has(row.c)) continue;
      seen.add(row.c);
      const area = (withCommunes ? byId.get(`com:${row.c}`) : null)
        || (row.e ? byId.get(`epci:${row.e}`) : null);
      if (!area) {
        unmatched += 1;
        continue;
      }
      if (!area.band) {
        unrated += 1;
        continue;
      }
      let piece = pieces.get(area.id);
      if (!piece) {
        if (pieces.size >= limit) {
          unmatched += 1;
          continue;
        }
        piece = { area, parts: [], simplified: false };
        pieces.set(area.id, piece);
        order.push(piece);
      }
      for (const part of row.p) piece.parts.push(part);
      if (row.s) piece.simplified = true;
    }
  }

  let epci = 0;
  let communes = 0;
  const records = [];
  for (const piece of order) {
    if (!piece.parts.length) continue;
    if (piece.area.scale === 'com') communes += 1;
    else epci += 1;
    let biggest = piece.parts[0];
    for (const part of piece.parts) if (part.length > biggest.length) biggest = part;
    records.push({
      id: piece.area.id,
      area: piece.area,
      scale: piece.area.scale,
      parts: piece.parts,
      simplified: piece.simplified,
      anchor: ringAnchor(biggest),
      color: peBandColor(piece.area.band),
      alpha: peTerritoryAlpha(piece.area.band),
      national,
      year,
    });
  }
  return { records, epci, communes, unmatched, unrated };
}

/**
 * The pieces of ground one view draws, sorted by the weight each follows.
 *
 * Built from {@link buildPeTerritoryRecords} at one grain or both — its one
 * rule (every piece of ground to the finest scale published for it, and to
 * exactly one) is untouched at either grain. Inside the commune band both
 * grains are drawn, and a piece of ground then belongs to one of three
 * groups, decided by comparing which territory owns each ring at each grain:
 *
 *   local  ground the SAME territory owns at both grains — the EPCI wash
 *          outside the cut-outs. Drawn once, at the territories' weight.
 *   under  ground an EPCI owns only at the coarse grain: the communes the
 *          CNAF publishes, and Paris, Lyon and Marseille whole. Drawn in the
 *          EPCI's colour, fading out across the band.
 *   over   the same ground at the fine grain: each commune or arrondissement
 *          in its own colour, or in its EPCI's where the CNAF did not publish
 *          it. Fading in across the band.
 *
 * Outside the band only one grain is built and every piece is `local`, so
 * the drawing is exactly the one this layer drew before it faded, one
 * primitive per band colour. Rings are compared by identity: both grains
 * hand on the very arrays the contour pack carries.
 *
 * @param {object} input
 * @param {Array<object>} input.packs
 * @param {Array<object>|Map<string,object>} input.areas
 * @param {boolean} [input.under] Build the coarse grain (EPCI wash whole).
 * @param {boolean} [input.over] Build the fine grain (communes cut out).
 * @param {?number} [input.national]
 * @param {?number} [input.year]
 * @param {number} [input.limit]
 * @returns {{groups: {local: Array<{record: object, parts: Array}>, under: Array<object>,
 *   over: Array<object>}, coarse: ?object, fine: ?object}}
 */
export function buildPeTerritoryLevels({
  packs, areas, under = true, over = false, national = null, year = null, limit = MAX_RENDERED_AREAS,
} = {}) {
  const byId = areas instanceof Map ? areas : indexPeAreas(areas);
  const coarse = under
    ? buildPeTerritoryRecords({ packs, areas: byId, withCommunes: false, national, year, limit })
    : null;
  const fine = over
    ? buildPeTerritoryRecords({ packs, areas: byId, withCommunes: true, national, year, limit })
    : null;
  const groups = { local: [], under: [], over: [] };
  if (!coarse || !fine) {
    for (const record of (coarse || fine)?.records || []) groups.local.push({ record, parts: record.parts });
    return { groups, coarse, fine };
  }
  const owner = (built) => {
    const map = new Map();
    for (const record of built.records) for (const part of record.parts) map.set(part, record.id);
    return map;
  };
  const fineOwner = owner(fine);
  const coarseOwner = owner(coarse);
  for (const record of coarse.records) {
    const shared = [];
    const leaving = [];
    for (const part of record.parts) (fineOwner.get(part) === record.id ? shared : leaving).push(part);
    if (shared.length) groups.local.push({ record, parts: shared });
    if (leaving.length) groups.under.push({ record, parts: leaving });
  }
  for (const record of fine.records) {
    const arriving = record.parts.filter((part) => coarseOwner.get(part) !== record.id);
    if (arriving.length) groups.over.push({ record, parts: arriving });
  }
  return { groups, coarse, fine };
}

/** Flat `[lon, lat, …]` to Cartesian positions. */
function ringPositions(flat) {
  if (!Array.isArray(flat) || flat.length < 8) return null;
  return Cesium.Cartesian3.fromDegreesArray(flat);
}

/** One filled ring, as a ground-classified instance. */
function fillInstance(id, positions, color) {
  return new Cesium.GeometryInstance({
    id,
    geometry: new Cesium.PolygonGeometry({
      // Outer rings only: a commune's interior ring is another commune, and
      // that one is drawn in its own right at the same moment.
      polygonHierarchy: new Cesium.PolygonHierarchy(positions),
      vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
    }),
    attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
  });
}

/** One ring's outline, as a ground-classified polyline instance. */
function outlineInstance(id, positions, color, width) {
  return new Cesium.GeometryInstance({
    id,
    geometry: new Cesium.GroundPolylineGeometry({ positions: [...positions, positions[0]], width }),
    attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
  });
}

function buildFillPrimitive(instances) {
  if (!instances.length) return null;
  return new Cesium.GroundPrimitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
    classificationType: Cesium.ClassificationType.BOTH,
    asynchronous: true,
    releaseGeometryInstances: false,
  });
}

function buildOutlinePrimitive(instances) {
  if (!instances.length) return null;
  return new Cesium.GroundPolylinePrimitive({
    geometryInstances: instances,
    appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
    classificationType: Cesium.ClassificationType.BOTH,
    asynchronous: true,
    releaseGeometryInstances: false,
  });
}

function removePrimitive(primitive) {
  if (primitive && _viewer?.scene?.primitives) _viewer.scene.primitives.remove(primitive);
}

function clearSelectionPrimitives() {
  removePrimitive(_selectionFill);
  removePrimitive(_selectionOutline);
  _selectionFill = null;
  _selectionOutline = null;
  _selectionBatches = [];
}

/**
 * Draw the highlight for one territory, as two primitives of its own.
 *
 * Its own primitives and NOT a recolour of the batch. A batched
 * `GroundPrimitive` does not colour a pixel by the polygon that contains it:
 * Cesium classifies the whole batch in one stencil pass, then keeps the first
 * instance whose shadow volume covers the pixel and whose axis-aligned
 * BOUNDING RECTANGLE contains it (`ShadowVolumeAppearanceFS.glsl`,
 * `CULL_FRAGMENTS`). Communes' bounding rectangles overlap constantly, so a
 * lone differently-coloured instance inside a batch is painted over its
 * neighbours' boxes — a highlight with straight cuts through it belonging to
 * the commune next door. Measured on `cadastre-fr` in September 2026, which is
 * where this rule was written down.
 *
 * It fades with the level the territory belongs to, like everything else the
 * territories draw (see {@link selectionAlpha}).
 */
function drawSelectionPrimitives(record) {
  clearSelectionPrimitives();
  if (!record?.parts?.length || !_viewer?.scene?.primitives) return;
  const color = Cesium.Color.fromCssColorString(SELECTED_COLOR);
  const fillColor = color.withAlpha(SELECTED_FILL_ALPHA);
  const fills = [];
  const outlines = [];
  const fillEntries = [];
  const outlineEntries = [];
  record.parts.forEach((part, index) => {
    const positions = ringPositions(part);
    if (!positions) return;
    const fillId = new PeInstanceId(record.id, index);
    const outlineId = new PeInstanceId(record.id, index);
    fills.push(fillInstance(fillId, positions, fillColor));
    outlines.push(outlineInstance(outlineId, positions, color, SELECTED_OUTLINE_WIDTH_PX));
    fillEntries.push([fillId, fillColor]);
    outlineEntries.push([outlineId, color]);
  });
  _selectionFill = buildFillPrimitive(fills);
  _selectionOutline = buildOutlinePrimitive(outlines);
  for (const [primitive, entries] of [[_selectionFill, fillEntries], [_selectionOutline, outlineEntries]]) {
    if (!primitive) continue;
    primitive.show = _enabled;
    _viewer.scene.primitives.add(primitive);
    _selectionBatches.push({ primitive, entries });
  }
}

/** Every primitive a territory drawing holds, fills and outlines. */
function drawingPrimitives(drawing) {
  if (!drawing) return [];
  return [
    ...drawing.groups.local, ...drawing.groups.under, ...drawing.groups.over, ...drawing.outlines,
  ].map((batch) => batch.primitive);
}

function removeDrawing(drawing) {
  for (const primitive of drawingPrimitives(drawing)) removePrimitive(primitive);
}

/**
 * Build the territory drawing for one view, HIDDEN, as the pending drawing.
 *
 * ONE primitive per band colour and per group, never one per territory and
 * never one batch carrying several colours — the first is the frame-rate
 * cost batching exists to avoid and the second draws the wrong shapes
 * outright (see {@link drawSelectionPrimitives} for the whole of why). The
 * groups are what {@link buildPeTerritoryLevels} sorted; outside the commune
 * band there is only `local`, and this is the drawing the layer always drew.
 *
 * Every instance carries its own {@link PeInstanceId} so `fadeInstances` can
 * reach each ring of an EPCI, and the fade's `[id, colour]` list is kept in
 * instance order, which makes the first look-up pass linear.
 *
 * The drawing on screen stays until this one is built; the frame callback
 * then swaps them (`promotePendingLocal`). Clearing first, as this used to,
 * showed bare ground for the length of every build.
 *
 * @returns {object} The drawing: `{key, under, over, groups, outlines, records, pickRecords}`.
 */
function drawLocal(levels, { key, under, over, grain }) {
  const dominant = (grain === 'com' ? levels.fine : levels.coarse) || levels.fine || levels.coarse;
  const records = new Map((dominant?.records || []).map((record) => [record.id, record]));
  // Both grains answer a click: a commune fading in is still a commune. The
  // dominant grain's record wins where an id is in both, because its parts
  // are the ground the card and the highlight describe.
  const pickRecords = new Map();
  for (const built of [levels.coarse, levels.fine]) {
    for (const record of built?.records || []) pickRecords.set(record.id, record);
  }
  for (const [id, record] of records) pickRecords.set(id, record);

  const drawing = {
    key,
    under,
    over,
    groups: { local: [], under: [], over: [] },
    outlines: [],
    records,
    pickRecords,
  };
  if (!_viewer?.scene?.primitives) return drawing;

  const outlineColor = Cesium.Color
    .fromCssColorString(COMMUNE_OUTLINE_COLOR).withAlpha(COMMUNE_OUTLINE_ALPHA);
  let serial = 0;
  for (const group of ['local', 'under', 'over']) {
    /** @type {Map<string, {instances: Array, entries: Array}>} band colour → batch. */
    const byColor = new Map();
    const outline = { instances: [], entries: [] };
    for (const { record, parts } of levels.groups[group]) {
      const color = Cesium.Color.fromCssColorString(record.color).withAlpha(record.alpha);
      const colorKey = `${record.color}|${record.alpha}`;
      let batch = byColor.get(colorKey);
      if (!batch) {
        batch = { instances: [], entries: [] };
        byColor.set(colorKey, batch);
      }
      for (const part of parts) {
        const positions = ringPositions(part);
        if (!positions) continue;
        const id = new PeInstanceId(record.id, serial);
        serial += 1;
        batch.instances.push(fillInstance(id, positions, color));
        batch.entries.push([id, color]);
        // Only the commune grain is outlined — the EPCI's member communes
        // share one wash and must not read as thirty separate areas.
        if (record.scale === 'com') {
          const outlineId = new PeInstanceId(record.id, serial);
          serial += 1;
          outline.instances.push(outlineInstance(outlineId, positions, outlineColor, COMMUNE_OUTLINE_WIDTH_PX));
          outline.entries.push([outlineId, outlineColor]);
        }
      }
    }
    for (const batch of byColor.values()) {
      const primitive = buildFillPrimitive(batch.instances);
      if (!primitive) continue;
      primitive.show = false;
      _viewer.scene.primitives.add(primitive);
      drawing.groups[group].push({ primitive, entries: batch.entries });
    }
    const outlinePrimitive = buildOutlinePrimitive(outline.instances);
    if (outlinePrimitive) {
      outlinePrimitive.show = false;
      _viewer.scene.primitives.add(outlinePrimitive);
      drawing.outlines.push({ primitive: outlinePrimitive, entries: outline.entries, group });
    }
  }
  governorRequestRender('petite-enfance-fr-territories');
  return drawing;
}

/** Whether every primitive of a drawing is built (an empty drawing is). */
function localDrawingReady(drawing) {
  return drawingPrimitives(drawing).every((primitive) => primitive.ready === true);
}

function discardPendingLocal() {
  if (!_pendingLocal) return;
  removeDrawing(_pendingLocal);
  _pendingLocal = null;
}

/**
 * Put the drawing that has finished building in place of the one on screen,
 * and start the arrival ramp of whatever it brings that was not drawn before:
 * the territories themselves, or one grain of them. A drawing that replaces
 * one of the same grains (a pan) is a same-level swap and ramps nothing.
 */
function promotePendingLocal() {
  const next = _pendingLocal;
  _pendingLocal = null;
  const previous = _local;
  // The card belongs to the drawing it was opened on, as it always has.
  if (_selectedId && !_selectedId.startsWith('dep:')) clearSelection();
  removeDrawing(previous);
  _local = next;
  _records = next.records;
  _pickRecords = next.pickRecords;
  if (!previous) _fade?.arrive('local');
  else {
    if (next.over && !previous.over) _fade?.arrive('cut-outs');
    if (next.under && !previous.under) _fade?.arrive('epci-under');
  }
}

/** Drop the territories: the view no longer wants them and they are at zero. */
function dropLocal() {
  discardPendingLocal();
  if (_selectedId && !_selectedId.startsWith('dep:')) clearSelection();
  removeDrawing(_local);
  _local = null;
  _records = new Map();
  _pickRecords = new Map();
}

/** Reset the local regime's status counts. */
function clearLocalStats() {
  _inView = 0;
  _communesShown = 0;
  _unpainted = 0;
  _dropped = 0;
  _visibleDeps = [];
}

// --- The fade ---------------------------------------------------------------

/** Write one weight into one batch, hiding it at zero. */
function writeBatch(batch, weight) {
  const show = levelVisible(_enabled, weight);
  if (batch.primitive.show !== show) batch.primitive.show = show;
  if (show) fadeInstances(batch.primitive, batch.entries, weight);
}

/** The weight the selected territory's highlight is drawn at. */
function selectionAlpha(alphas) {
  const record = _selectedId ? _pickRecords.get(_selectedId) : null;
  if (!record) return alphas.epci;
  // i18n-ignore-next-line — a scale KEY.
  if (record.scale === 'com') return _local?.groups.over.length ? alphas.communes : alphas.epci;
  return alphas.epci;
}

/**
 * Per frame: promote a territory drawing that finished building, then draw
 * every level at the alpha its band gives it.
 *
 *   départements          outer band, coarse end
 *   EPCI wash             outer band, fine end
 *   EPCI under cut-outs   outer fine × inner coarse
 *   communes (+outlines)  outer fine × inner fine
 *
 * Nothing here fetches or builds. A département colour is a callback the
 * entity layer reads BEFORE this runs, so a changed département weight asks
 * for one more frame to land; a pending drawing or selection asks for frames
 * until it is built, because a ground primitive turns `ready` in an
 * after-render callback that requests none.
 */
function onFadeFrame(scale, now) {
  if (_pendingLocal && localDrawingReady(_pendingLocal)) promotePendingLocal();
  const span = scale?.latSpan;
  const arrival = (key) => _fade?.arrival(key, now) ?? 1;
  const outer = peBandAlphas(span, PE_NATIONAL_BAND, {
    fineReady: Boolean(_local),
    coarseReady: _nationalPainted,
    fineArrival: arrival('local'),
    coarseArrival: arrival('national'),
  });
  const inner = peBandAlphas(span, PE_COMMUNE_BAND, {
    fineReady: Boolean(_local?.over),
    coarseReady: Boolean(_local?.under),
    fineArrival: arrival('cut-outs'),
    coarseArrival: arrival('epci-under'),
  });
  const alphas = {
    departements: outer.coarse,
    epci: outer.fine,
    epciUnderCommunes: outer.fine * inner.coarse,
    communes: outer.fine * inner.fine,
  };

  const weight = quantizeFade(alphas.departements);
  if (weight !== _nationalWeight) {
    _nationalWeight = weight;
    governorRequestRender('petite-enfance-fr-fade');
  }
  setDepartementsShown(_nationalPainted && levelVisible(_enabled, alphas.departements));

  if (_local) {
    for (const batch of _local.groups.local) writeBatch(batch, alphas.epci);
    for (const batch of _local.groups.under) writeBatch(batch, alphas.epciUnderCommunes);
    for (const batch of _local.groups.over) writeBatch(batch, alphas.communes);
    for (const batch of _local.outlines) {
      writeBatch(batch, batch.group === 'over' ? alphas.communes : alphas.epci);
    }
  }
  if (_selectionBatches.length) {
    const highlight = selectionAlpha(alphas);
    for (const batch of _selectionBatches) writeBatch(batch, highlight);
  }

  // A level at zero that the view no longer asks for is dropped, not kept
  // invisible: an invisible primitive still costs its draw call.
  if (_local && _plan && !_plan.local && !levelVisible(true, alphas.epci)) dropLocal();

  let building = Boolean(_pendingLocal);
  for (const batch of _selectionBatches) if (batch.primitive.ready !== true) building = true;
  if (building) governorRequestRender('petite-enfance-fr-pending');

  _levelAlphas = alphas;
  _fade?.report({
    levels: alphas,
    // i18n-ignore-next-line — level KEYS.
    dominant: _regime === 'national' ? 'departements' : (_grain === 'com' ? 'communes' : 'epci'),
    bands: FADE_BANDS_REPORT,
    pending: Boolean(_pendingLocal),
  });
}

// --- Loading ----------------------------------------------------------------

/** The status counts of one built view, applied when the territories own the row. */
function applyLocalStats(stats) {
  if (!stats) return;
  _count = stats.count;
  _inView = stats.inView;
  _communesShown = stats.communes;
  _unpainted = stats.unpainted;
  _visibleDeps = stats.visibleDeps;
  _dropped = stats.dropped;
  _lastUpdate = stats.lastUpdate;
  _error = stats.error;
  _status = _count > 0 ? 'ready' : 'empty';
}

/**
 * Fill the départements in view.
 *
 * The rates come once, nationally; the outlines come per département and only
 * for the ones on screen. A département whose outlines fail to arrive leaves
 * its ground unfilled and says so on the row — it is never filled from a
 * neighbour's pack, and the rest of the view is still drawn.
 *
 * It no longer hides the départements: they stay drawn until the territories
 * are, and fade as the band says once both are on screen.
 */
async function loadLocal(box, plan, generation) {
  // i18n-ignore-next-line — a regime key, compared.
  const owns = () => _regime === 'local';
  _loadingLocal = !_pack;
  syncLoading();
  await ensurePack();
  if (generation !== _requestGeneration || !_enabled || !_plan?.local) return;
  if (!_pack) {
    _loadingLocal = false;
    syncLoading();
    if (owns()) {
      _error = _packError || 'area pack unavailable';
      _status = 'error';
    }
    return;
  }
  if (!_areaIndex.size) _areaIndex = indexPeAreas(_pack.areas);

  // A grain the drawing on screen still shows is built again, even where the
  // view no longer asks for it, so a jump across the commune band crossfades
  // on the arrival ramp instead of swapping: the grain on its way out is the
  // one that covers until the other is drawn.
  const under = plan.under || Boolean(_local?.under && levelVisible(true, _levelAlphas.epciUnderCommunes));
  const over = plan.over || Boolean(_local?.over && levelVisible(true, _levelAlphas.communes));
  const snapped = boxKey(box);
  // A camera settle on the same snapped box, with every grain the view needs
  // already drawn, is the same drawing — rebuilding it would re-tessellate
  // every polygon and drop the card the operator is reading, once per nudge.
  const covers = (drawing) => drawing?.key === snapped
    && (!under || drawing.under) && (!over || drawing.over);
  if (covers(_local) || covers(_pendingLocal)) {
    // A build for a box the camera has already come back from is not needed.
    if (covers(_local)) discardPendingLocal();
    _loadingLocal = false;
    syncLoading();
    if (owns()) applyLocalStats((_pendingLocal || _local).stats);
    return;
  }

  _loadingLocal = !_contourPacks.has(snapped);
  syncLoading();
  const pack = await ensureContours(box);
  if (generation !== _requestGeneration || !_enabled || !_plan?.local) return;
  _loadingLocal = false;
  syncLoading();
  if (!pack) {
    // The rates are still in hand and the choropleth above is untouched; what
    // failed is the geometry, and the row says exactly that. The territories
    // drawn for another box are dropped, so the départements cover the view
    // if they are drawn.
    dropLocal();
    if (owns()) {
      clearLocalStats();
      _count = 0;
      _error = _contourError
        ? messages().errors.communeContoursWhy(_contourError)
        : messages().errors.communeContours;
      _status = 'error';
    }
    return;
  }

  const levels = buildPeTerritoryLevels({
    packs: [pack],
    areas: _areaIndex,
    under,
    over,
    national: _pack.national ?? null,
    year: _pack.year ?? null,
  });
  // i18n-ignore-next-line — a grain KEY.
  const dominant = (plan.grain === 'com' ? levels.fine : levels.coarse) || levels.fine || levels.coarse;
  discardPendingLocal();
  const drawing = drawLocal(levels, {
    key: snapped, under, over, grain: plan.grain,
  });
  drawing.stats = {
    count: dominant.records.length,
    inView: dominant.epci + dominant.communes,
    communes: dominant.communes,
    unpainted: dominant.unmatched + dominant.unrated,
    visibleDeps: Array.isArray(pack.departements) ? pack.departements : [],
    dropped: Number(pack.dropped) || 0,
    lastUpdate: Number(_pack.fetchedAt) || Date.now(),
    // A département whose outlines never arrived is ground with no shape,
    // which looks exactly like ground with no rate and means something else
    // entirely.
    error: pack.unavailable?.length
      ? messages().errors.someContours(pack.unavailable.join(', '))
      : null,
  };
  _pendingLocal = drawing;
  if (owns()) applyLocalStats(drawing.stats);
  _fade?.frame();
}

/**
 * Read one settled view: plan the levels it needs, load each of them, and
 * leave the per-frame fade to show them.
 *
 * Loading stays here, on the settle; the frame callback only weighs what is
 * already drawn. Both levels of a band load at once inside it, and a level
 * the view no longer needs is dropped by the frame callback once its weight
 * reaches zero — after the level replacing it is on screen.
 */
async function loadViewport({ force = false } = {}) {
  if (!_enabled || !_viewer) return;
  // Whatever this call concludes — records, a zoom-in verdict or a failure —
  // it concludes it about the view the camera is showing right now. See
  // `cameraSettle.js`: an arrival on any other view has to be read afresh.
  markViewportRead(_viewer, PE_FR_LAYER_ID);
  const span = peViewSpanDeg(_viewer);
  // A camera that gives no usable rectangle has nothing to filter against;
  // the choropleth is the honest fallback.
  const box = peContourBox(_viewer);
  const plan = pePlanLevels(span, { hasBox: Boolean(box) });
  _plan = plan;
  _regime = plan.regime;
  _grain = plan.grain;
  const generation = ++_requestGeneration;
  if (force) {
    // Refetch, but keep what is drawn: it covers until the new answer is.
    _national = null;
    _pack = null;
    _areaIndex = new Map();
    _contourPacks.clear();
    _contourError = null;
    if (_local) _local.key = null;
    discardPendingLocal();
  }
  // `_error` is NOT cleared here. It describes the drawing that is on screen,
  // and a settle that changes nothing must not quietly retract the sentence
  // explaining a département whose outlines never arrived. The level that
  // owns the row sets it, including to null.
  // i18n-ignore-next-line — a regime key, compared.
  if (_regime === 'national') {
    if (_national) {
      _count = _national.painted || 0;
      _status = _count > 0 ? 'ready' : 'empty';
      _error = null;
    }
  } else {
    dropDepartementSelection();
    if (!_local && !_pendingLocal) clearLocalStats();
  }
  publishDepartementOverlay();
  if (!plan.local) discardPendingLocal();
  syncLoading();
  const tasks = [];
  if (plan.national) tasks.push(loadNational(generation));
  if (plan.local) tasks.push(loadLocal(box, plan, generation));
  _fade?.frame();
  await Promise.all(tasks);
}

function onCameraChanged() {
  clearTimeout(_cameraDebounceTimer);
  _cameraDebounceTimer = setTimeout(() => {
    void loadViewport();
  }, CAMERA_DEBOUNCE_MS);
}

/**
 * The camera has come to REST — read the view it stopped on. `camera.changed`
 * goes quiet before an eased flight lands, so the load a flight triggers
 * describes a camera still in the air; `cameraSettle.js` carries the
 * measurement and the "have we already read this view" short-circuit.
 *
 * It SUPERSEDES the pending debounce rather than racing it: on a hand pan
 * `moveEnd` arrives while that timer is still armed, and letting both run
 * would ask the same question twice.
 */
function onCameraSettled() {
  if (!_enabled) return;
  clearTimeout(_cameraDebounceTimer);
  _cameraDebounceTimer = null;
  void loadViewport();
}

function collectDetectableObjects(options = {}) {
  if (!_enabled || _regime !== 'local' || !_records.size) return [];
  const records = [...dispatchable()];
  if (!records.length) return [];

  const maxCount = Number.isFinite(options.maxCount)
    ? Math.max(1, Math.floor(options.maxCount))
    : records.length;
  const seed = Number.isFinite(options.seed) ? Math.floor(options.seed) : 0;
  const stride = Math.max(1, Math.ceil(records.length / maxCount));
  const start = ((seed % stride) + stride) % stride;

  const result = [];
  for (let i = start; i < records.length; i += stride) {
    const record = records[i];
    const position = territoryAnchor(record);
    if (!position) continue;
    result.push({
      position,
      sourceId: record.id,
      id: Number.isFinite(record.area?.rate) ? `${rate(record.area.rate)} / 100` : (record.area?.name || ''),
      type: 'Childcare Area',
      skipLabel: record.id === _selectedId,
    });
    if (result.length >= maxCount) break;
  }
  return result;
}

function* dispatchable() {
  for (const record of _records.values()) {
    // A territory with no drawn ring has no place to put a callout — it is not
    // on screen in any sense a reader could act on.
    if (!record.parts?.length && record.id !== _selectedId) continue;
    yield record;
  }
}

/** One line under the layer's toggle: what this view actually contains. */
export function buildPeLoadingLabel({
  regime = _regime,
  status = _status,
  loading = _loading,
  count = _count,
  inView = _inView,
  communes = _communesShown,
  unpainted = _unpainted,
  dropped = _dropped,
  national = _national,
} = {}) {
  const m = messages();
  if (regime === 'national') {
    if (loading) return m.status.loadingNational;
    if (status === 'error') return '';
    if (!national) return '';
    const parts = [m.status.national(national.painted, rate(national.national))];
    // The choropleth's own blind spot, stated where the choropleth is read —
    // and here it is the finding, not a footnote.
    if (national.unpainted?.length) {
      parts.push(m.status.overseas(national.unpainted.length));
    }
    return parts.join(' · ');
  }
  if (loading) return m.status.loadingContours;
  if (status === 'error') return '';
  if (!inView) return m.status.empty;
  const parts = [m.status.epci(fr(count - communes))];
  if (communes > 0) parts.push(m.status.communes(fr(communes)));
  // The two silences this regime can produce, named where it is read: ground
  // whose area publishes no rate, and départements the pack cap left out.
  if (unpainted > 0) parts.push(m.status.unpainted(fr(unpainted)));
  if (dropped > 0) parts.push(m.status.dropped(fr(dropped)));
  return parts.join(' · ');
}

// --- Layer ------------------------------------------------------------------

const petiteEnfanceFranceLayer = {
  id: PE_FR_LAYER_ID,
  // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
  name: 'Accueil du jeune enfant (FR)',
  icon: '🧸',
  source: 'Taux de couverture — Cnaf',
  // i18n-ignore-end
  updateInterval: POLL_INTERVAL_MS,

  init(viewer) {
    _viewer = viewer;

    _enabled = false;
    _records = new Map();
    _selectedId = null;
    _count = 0;
    _inView = 0;
    _communesShown = 0;
    _unpainted = 0;
    _visibleDeps = [];
    _lastUpdate = null;
    _loading = false;
    _error = null;
    _status = 'idle';
    _regime = 'national';
    _grain = 'epci';
    _plan = null;
    _nationalPainted = false;
    _paintedNational = null;

    _overlayHost.setVisible(PE_FR_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(PE_FR_LABEL_SOURCE_ID, false);
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    if (_depDataSource) _depDataSource.show = true;
    // Which level is drawn, and how strongly, is the fade's call per frame.
    _fade = watchZoomFade(viewer, PE_FR_LAYER_ID, onFadeFrame);
    _overlayHost.setVisible(PE_FR_OVERLAY_SOURCE_ID, true);
    _overlayHost.setVisible(PE_FR_LABEL_SOURCE_ID, true);
    installClickHandler(viewer);
    // Resolved through `resolvePickId`, so an instance id object arrives here
    // as its territory id string.
    registerPickOwner(PE_FR_LAYER_ID, (pickedId) => _pickRecords.has(pickedId));

    if (!_cameraChangedAttached) {
      viewer.camera.changed.addEventListener(onCameraChanged);
      claimCameraSensitivity(viewer, PE_FR_LAYER_ID);
      // Arrival, as opposed to motion — see `onCameraSettled`.
      watchCameraSettle(viewer, PE_FR_LAYER_ID, onCameraSettled);
      _cameraChangedAttached = true;
    }
    void loadViewport({ force: true });
  },

  disable(viewer) {
    _enabled = false;
    _fade?.release();
    _fade = null;
    _requestGeneration += 1;
    _regime = 'national';
    _grain = 'epci';
    _plan = null;
    _nationalPainted = false;
    _paintedNational = null;
    clearTimeout(_cameraDebounceTimer);
    _cameraDebounceTimer = null;

    clearSelection();
    dropLocal();
    clearLocalStats();
    _count = 0;
    hideDepartements();
    if (_depDataSource) _depDataSource.show = false;
    _overlayHost.setVisible(PE_FR_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(PE_FR_LABEL_SOURCE_ID, false);

    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
    document.removeEventListener('keydown', onKeyDown);
    unregisterPickOwner(PE_FR_LAYER_ID);

    if (_cameraChangedAttached) {
      viewer.camera.changed.removeEventListener(onCameraChanged);
      releaseCameraSensitivity(viewer, PE_FR_LAYER_ID);
      releaseCameraSettle(viewer, PE_FR_LAYER_ID);
      _cameraChangedAttached = false;
    }

    _loading = false;
    _status = 'idle';
  },

  async update() {
    if (!_enabled) return;
    await loadViewport({ force: true });
  },

  getDetectableObjects(options = {}) {
    return collectDetectableObjects(options);
  },

  getStats() {
    const stats = {
      count: _count,
      lastUpdate: _lastUpdate,
      loading: _loading,
      status: _status === 'ready' ? 'ok' : _status,
    };
    const label = buildPeLoadingLabel();
    if (label) stats.loadingLabel = label;
    if (_regime === 'national' ? _national?.stale : _pack?.stale) stats.stale = true;
    if (_error) stats.error = _error;
    return stats;
  },

  /** Provenance for the attribution popover and analyst surfaces. */
  getViewportSummary() {
    if (!_pack) return null;
    const { areas, ...summary } = _pack;
    return {
      ...summary,
      inView: _inView,
      drawn: _count,
      communes: _communesShown,
      unpainted: _unpainted,
      departements: _visibleDeps.slice(),
      contourSource: PE_GEO_SOURCE,
    };
  },

  /**
   * The territories as they are actually drawn, for a harness.
   *
   * Verbatim from the records — the same rings that were handed to Cesium —
   * so a pixel check written against this compares the screen with the SOURCE
   * geometry rather than with the layer's own idea of it. `parts` is flat
   * `[lon, lat, …]`, exactly as it arrived on the wire.
   * @returns {{regime:string, selected:?string, territories:Array<object>}}
   */
  getTerritoriesForQa() {
    return {
      regime: _regime,
      selected: _selectedId,
      // One entry per FILL primitive, so a harness can assert the batching
      // rule (one colour per primitive, never one primitive per territory)
      // without reaching into Cesium's scene graph for the colours.
      grain: _grain,
      fills: _local
        ? _local.groups.local.length + _local.groups.under.length + _local.groups.over.length
        : 0,
      outlines: _local ? _local.outlines.length : 0,
      // Inside the commune band the ground of the cut-out communes is drawn
      // twice, once per grain: `under` and `over` count those batches, and
      // `territories` below stays the dominant grain, which tiles.
      groups: _local
        ? {
          local: _local.groups.local.length, under: _local.groups.under.length, over: _local.groups.over.length,
        }
        : { local: 0, under: 0, over: 0 },
      levels: { ..._levelAlphas },
      pending: Boolean(_pendingLocal),
      selectionPrimitives: (_selectionFill ? 1 : 0) + (_selectionOutline ? 1 : 0),
      territories: [..._records.values()].map((record) => ({
        id: record.id,
        scale: record.scale,
        code: record.area?.code ?? null,
        band: record.area?.band ?? null,
        color: record.color,
        alpha: record.alpha,
        anchor: record.anchor,
        parts: record.parts,
      })),
    };
  },

  /**
   * Select one territory by id, for a harness that cannot click a pixel it is
   * about to measure — the card is painted over the very ground the check
   * reads. The production path, not a copy of it.
   * @param {string} id
   */
  selectAreaForQa(id) {
    selectArea(id);
  },

  /** National rollup, for the analyst and for tests. */
  getNationalSummary() {
    if (!_national) return null;
    const { departements, ...rest } = _national;
    return { ...rest, regime: _regime };
  },

  /** Colour legend for the control-panel row. */
  getRowControls() {
    const m = messages();
    const national = _regime === 'national' ? _national?.national : _pack?.national;
    const labels = peBandRangeLabels(national);
    const counts = Object.fromEntries(PE_BANDS.map((band) => [band, 0]));
    if (_regime === 'national') {
      for (const row of _national?.departements || []) {
        if (row.band) counts[row.band] += 1;
      }
    } else {
      for (const record of _records.values()) {
        const band = record.area?.band;
        if (band) counts[band] += 1;
      }
    }
    const legend = PE_BANDS
      .map((band, index) => ({
        label: m.legend.band(labels[index]),
        color: peBandColor(band),
        count: counts[band],
        blurb: bandBlurb(band),
      }))
      .filter((row) => row.count > 0);
    return { chips: [], legend };
  },

  destroy(viewer) {
    if (_enabled) this.disable(viewer);
    else {
      clearSelection();
      _overlayHost.setVisible(PE_FR_OVERLAY_SOURCE_ID, false);
      _overlayHost.setVisible(PE_FR_LABEL_SOURCE_ID, false);
      if (_clickHandler) {
        _clickHandler.destroy();
        _clickHandler = null;
      }
      document.removeEventListener('keydown', onKeyDown);
      unregisterPickOwner(PE_FR_LAYER_ID);
    }
    clearSelectionPrimitives();
    dropLocal();
    if (_depDataSource) {
      viewer.dataSources?.remove?.(_depDataSource, true);
      _depDataSource = null;
    }
    _depEntities.clear();
    _depMaterials.clear();
    _depHighlightMaterial = null;
    _depPaintedCodes = new Set();
    _depShown = false;
    _nationalPainted = false;
    _paintedNational = null;
    _depMeta = new Map();
    _depShapesPromise = null;
    _contourPacks.clear();
    _contourPromises.clear();
    _contourError = null;
    _areaIndex = new Map();
    _records = new Map();
    _pickRecords = new Map();
    _viewer = null;
  },
};

/** Seed rendered records so selection/card/legend paths run without WebGL. */
export function _setPeStateForTest({
  viewer, records, overlayHost, status, count, regime, national, depEntities, depMeta,
  pack, inView, communes, unpainted, dropped, visibleDeps,
} = {}) {
  _viewer = viewer || null;
  _records = new Map((records || []).map((record) => [record.id, record]));
  _pickRecords = new Map(_records);
  _selectedId = null;
  _overlayHost = overlayHost || DEFAULT_OVERLAY_HOST;
  _status = status || 'ready';
  _count = Number.isFinite(count) ? count : _records.size;
  _inView = Number.isFinite(inView) ? inView : _count;
  _communesShown = Number.isFinite(communes) ? communes : 0;
  _unpainted = Number.isFinite(unpainted) ? unpainted : 0;
  _visibleDeps = visibleDeps || [];
  _dropped = Number.isFinite(dropped) ? dropped : 0;
  _loading = false;
  _regime = regime || 'local';
  _national = national || null;
  _pack = pack || null;
  _depEntities = new Map(depEntities || []);
  _depMeta = new Map(depMeta || []);
  _enabled = true;
}

/** Exercise the production selection path in focused runtime tests. */
export function _selectPeForTest(id) {
  selectArea(id);
}

/** Exercise the production département selection path. */
export function _selectPeDepartementForTest(code) {
  selectDepartement(code);
}

/** Exercise the production clear path and restore the production host seam. */
export function _clearPeSelectionForTest() {
  clearSelection();
  _overlayHost = DEFAULT_OVERLAY_HOST;
  _national = null;
  _nationalPainted = false;
  _pack = null;
  _depEntities = new Map();
  _depMeta = new Map();
  _areaIndex = new Map();
  _contourPacks.clear();
  _visibleDeps = [];
  _unpainted = 0;
  _dropped = 0;
  _local = null;
  _pendingLocal = null;
  _records = new Map();
  _pickRecords = new Map();
  _plan = null;
  _grain = 'epci';
  _paintedNational = null;
  _depShown = false;
  _depPaintedCodes = new Set();
  _nationalWeight = 1;
  _regime = 'local';
  _enabled = false;
}

/**
 * Seed the levels the fade weighs, with stand-ins for the Cesium objects:
 * département entities are `{show, polygon}`, primitives `{ready, show}`.
 * `local` and `pending` are drawings as {@link drawLocal} returns them; a
 * missing field defaults to empty.
 */
export function _setPeLevelsForTest({
  viewer, plan = null, regime = 'national', grain = 'epci', nationalPainted = false,
  depEntities = [], depShown = false, local = null, pending = null, selectedId = null,
} = {}) {
  const drawing = (input) => (input
    ? {
      key: null,
      under: false,
      over: false,
      records: new Map(),
      pickRecords: new Map(),
      ...input,
      groups: { local: [], under: [], over: [], ...input.groups },
      outlines: input.outlines || [],
    }
    : null);
  _viewer = viewer || null;
  _enabled = true;
  _plan = plan;
  _regime = regime;
  _grain = grain;
  _nationalPainted = nationalPainted;
  _depEntities = new Map(depEntities);
  _depPaintedCodes = new Set(_depEntities.keys());
  _depShown = depShown;
  _local = drawing(local);
  _pendingLocal = drawing(pending);
  _records = _local?.records || new Map();
  _pickRecords = _local?.pickRecords || new Map();
  _selectedId = selectedId;
}

/**
 * One production fade frame at a given view span, with arrival ramps taken
 * as finished; returns what it decided.
 */
export function _peFadeFrameForTest(latSpan) {
  onFadeFrame({ latSpan }, 0);
  return {
    levels: { ..._levelAlphas },
    departementsShown: _depShown,
    nationalWeight: _nationalWeight,
    local: _local,
    pending: _pendingLocal,
  };
}

/** Row-control legend, for tests that do not construct a viewer. */
export function _peRowControlsForTest() {
  return petiteEnfanceFranceLayer.getRowControls();
}

/** Ambient département label cohort, for tests that do not construct a viewer. */
export function _peDepartementOverlayForTest() {
  const entries = [];
  for (const row of _national?.departements || []) {
    if (!row.band) continue;
    const anchor = _depMeta.get(row.code)?.anchor;
    if (!anchor) continue;
    entries.push(createPeDepartementOverlayEntry(row, { anchor }));
  }
  return selectPeLabelCohort(entries);
}

export default petiteEnfanceFranceLayer;
