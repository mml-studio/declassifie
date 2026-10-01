import * as Cesium from 'cesium';
import { claimCameraSensitivity, releaseCameraSensitivity } from './cameraSensitivity.js';
import { markViewportRead, releaseCameraSettle, watchCameraSettle } from './cameraSettle.js';
import { governorRequestRender } from '../renderGovernor.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import { parseDepartements } from './meteoFranceVigilance.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import { buildDepartementIndex } from './franceDepartements.js';
import { ringAnchor } from './communeContours.js';
import {
  CELL_PUBLISHED,
  CELL_SUPPRESSED,
  CELL_ZERO,
  DELINQUANCE_ATTRIBUTION,
  DELINQUANCE_CELL_LABELS,
  DELINQUANCE_COMMUNE_CELL_SLUGS,
  DELINQUANCE_COMMUNE_SLUGS,
  DELINQUANCE_SOURCE,
  DELINQUANCE_TOTAL_COMMUNE_SLUGS,
  DELINQUANCE_TOTAL_DEPARTEMENT_SLUGS,
  DELINQUANCE_TOTAL_EXCLUDED,
  DELINQUANCE_TOTAL_SLUG,
  delinquanceCaveatLine,
  delinquanceCountNoun,
  delinquanceDocumentationTitle,
  delinquanceIndicatorLabel,
  delinquanceIndicatorNote,
  delinquanceIndicatorShort,
  delinquanceRateUnit,
  delinquanceRule,
  delinquanceUnitLabel,
  indicatorForSlug,
} from './delinquanceFeed.js';
import {
  DELINQUANCE_DEPARTEMENT_BINS,
  delinquanceRateBin,
  departementsInBox,
  locateDelinquanceDepartement,
  projectDelinquanceNational,
} from './delinquanceDepartements.js';
import { pickAt } from './pickAt.js';
import { coverAlphas, levelVisible, watchZoomFade } from './zoomFade.js';
import { formatDecimal, formatNumber } from '../i18n/format.js';
import messages from './delinquanceFrance.i18n.js';
import { serverFailureMessage } from '../i18n/serverMessages.js';

/**
 * Recorded delinquency in France, drawn with the publisher's own caution.
 *
 * THIS IS NOT A MAP OF CRIME. It is a map of what police and gendarmerie
 * REGISTERED. A commune's number moves when its residents report more, when a
 * brigade opens, when a service changes how it records — and, for a whole
 * family of indicators, when the police go looking. `Usage de stupéfiants` is
 * counted in `Mis en cause`: people who were stopped. Drawing that as a
 * property of a place is drawing policing and labelling it crime, so the
 * sentence is on the card, on the legend, in DATA_SOURCES and here.
 *
 * A CHOROPLETH OF THIS DATA WITH NO CAVEAT IS A DEFAMATION MACHINE POINTED AT
 * WHOLE COMMUNES. Everything below exists to stop that.
 *
 * ── The three states, and why the third one is the whole layer ──────────────
 * The SSMSI suppresses small counts. Its rule, verbatim from the methodology
 * PDF: *« Les données diffusées sont limitées aux communes pour lesquelles
 * plus de 5 faits ont été enregistrés pendant 3 années successives »*, with the
 * other half — *« La base de données diffusée fournit également l'information
 * sur l'absence de faits enregistrés lorsqu'elle se reproduit sur 3 années
 * successives »* — meaning a published `0` is a real, deliberate zero. So
 * every cell is exactly one of three things and each gets its own visual:
 *
 *   PUBLIÉ       a measured rate — the six-band warm ramp.
 *   AUCUN FAIT   `diff` with 0 — the palest cool wash. Measured absence.
 *   NON DIFFUSÉ  `ndiff` — SLATE, at a heavier alpha, with a wider brighter
 *                outline. It is not the bottom of the ramp and it is not the
 *                zero wash; it is off the scale entirely, in a hue the ramp
 *                never reaches, because the honest statement is "this is
 *                withheld", not "this is low".
 *
 * Measured on the 2025 edition, 523 800 commune cells: 49 879 published
 * (9.52%), 222 776 zero (42.5%), **251 145 suppressed (47.9%)**. 25 314 of the
 * 34 920 communes — 72.5% — carry not one positive published value, and 7 have
 * all fifteen indicators suppressed. Nearly half of this map is a refusal, and
 * the layer is built so a reader sees the refusal rather than a colour.
 *
 * ── THE PARAPHRASE THIS FILE USED TO PRINT, AND WHY IT WAS WRONG ───────────
 * An earlier revision of this layer put « entre 1 et 5 faits » on the card of
 * every withheld commune. That is not the rule and the register refutes it.
 * The rule is a THREE-YEAR condition on the series, so a commune that fails it
 * can carry any number at all. Re-measured against the live 2026-07-09 edition
 * on 2026-09-02:
 *   - **4 735 of the 251 145 suppressed 2025 cells** belong to a (commune,
 *     indicateur) pair that published MORE than 5 facts in 2023 or 2024. Cessy
 *     (01071) published 16 `Vols de véhicule` in 2023, then went dark.
 *   - **36 (département, indicateur) pairs carry a withheld-commune mean above
 *     5.** Seine-Saint-Denis / `Usage de stupéfiants (AFD)` averages 22.33.
 * Every surface now prints {@link delinquanceCaveat}'s verbatim quotation of
 * the SSMSI's own sentence instead. A paraphrase of a suppression rule is a
 * claim about the values being suppressed, and this one was a false one.
 *
 * ── What a suppressed commune's card is allowed to say ─────────────────────
 * The `ndiff` rows are not empty: they carry `complement_info_*`, which the PDF
 * defines as *« Valeur moyenne parmi les communes du département sous secret
 * statistique »*. Measured on 2025, grouping every suppressed row on
 * (département, indicateur): **1 470 of 1 472 pairs carry exactly one distinct
 * value.** It is a departmental constant. So it is fetched ONCE PER
 * DÉPARTEMENT, never per commune, it never touches a fill, and the card prints
 * it under the label "moyenne des communes non diffusées du département" — the
 * publisher's own words, not this commune's number.
 *
 * ── And why the withheld value can never be reconstructed ──────────────────
 * Paris publishes 75056 and its 20 arrondissements. Measured for 2025: for 14
 * of 15 indicators the arrondissements sum EXACTLY to the commune. For `Vols
 * avec armes` the commune says 393 and the arrondissements sum to 375, because
 * 4 are suppressed — and the register suppressed extra cells precisely so the
 * 18-fact residual could not be pinned on one of them. Subtracting is
 * re-identification, not recovery, and nothing here does it.
 *
 * ── Two regimes, on the two geographies the register actually publishes ────
 *   départements — the default. 96 metropolitan polygons, filled by
 *                  `taux_pour_mille` for the selected indicator and year.
 *                  There is NO suppression at this grain (the DEP base has no
 *                  `est_diffuse` column at all: 17 711 positive cells, 469
 *                  zeros, 0 nulls), so the third band never lights up here —
 *                  and that difference between the zoom levels IS the point.
 *   communes      — below {@link COMMUNE_ENTER_SPAN_DEG}. Commune outlines
 *                  from geo.api.gouv.fr for the départements in view, filled
 *                  by the three states. This is where the refusal becomes
 *                  visible: at national zoom the map looks complete, and one
 *                  zoom later half of it is slate.
 *
 * ── Why the rate and not the count ─────────────────────────────────────────
 * `delinquanceDepartements.js` carries the measurement: by count the 2025
 * cambriolages leaders are Bouches-du-Rhône, Nord, Rhône and Paris — a list of
 * big départements; by rate the leaders are Guyane, **Cher**, Ain and Isère,
 * and the Nord drops from 2nd to 17th. And the rate's denominator is not
 * uniform: `Cambriolages de logement` is per 1 000 DWELLINGS, the other
 * fourteen per 1 000 inhabitants, verified on 45 386 of 45 386 non-cambriolage
 * cells against 0 of 4 493 cambriolage ones. Every card and every legend row
 * states its own denominator.
 *
 * ── The TOTAL, which this layer used to refuse to compute ──────────────────
 * An earlier revision of this header said the layer "never sums two
 * indicators", because their `unité de compte` differs — Victime, Victime
 * entendue, Infraction, Véhicule, Mis en cause — and a total adds victims to
 * vehicles. That objection is real and it has not gone away. What changed is
 * the alternative: refusing to total meant every reader had to pick one
 * offence before seeing anything at all, which is its own distortion — it
 * makes the map answer "where are burglaries" when the question was "where is
 * this register busy".
 *
 * So the total exists, under three conditions that keep it honest:
 *   1. it is labelled a CALCULATED total, GEV's arithmetic and not the
 *      SSMSI's — the register publishes eighteen indicators and no total;
 *   2. it names its own mixed unit on the card rather than calling itself
 *      "faits", and it drops the two `Usage de stupéfiants` sub-indicators,
 *      which are a decomposition of a third (measured: parent = AFD + hors
 *      AFD in 101 départements of 101, exactly), so nothing is counted twice;
 *   3. at commune grain it is a MINORANT wherever the register withholds a
 *      contributor, and the card says how many. Measured on 2025: of the
 *      34 920 communes, 9 606 carry a positive total — **9 428 of those are
 *      minorants and only 178 are complete** — 243 are a complete measured
 *      zero, and 25 071 publish nothing at all and are drawn slate.
 * At département grain there is no suppression, so the total is exact: 3 306
 * 254 facts over 68 350 798 inhabitants nationally, from 24.4 ‰ in the Cantal
 * to 109.9 ‰ in Paris.
 *
 * Two commune outliers are worth knowing before reading the commune map:
 * **Roissy-en-France (95527) tops it at 1 512 ‰** — 4 045 facts over 2 674
 * residents — and Paris 1er at 578 ‰. Neither is a dangerous village; both are
 * places whose population at risk is an airport and a museum, not their
 * residents. The denominator is the resident population for every indicator on
 * this layer, and the total makes that limit louder rather than new.
 *
 * ── Six chips out of eighteen, chosen by the data and not by hand ──────────
 * The panel row cannot carry eighteen indicators. Hand-picking six would be a
 * claim about which offences matter; instead the chip set is derived at build
 * time as the indicators with the most communes carrying a published positive
 * value — the maps with the most ground that can honestly be coloured. On the
 * 2025 edition that is escroqueries (8 134 communes), dégradations (7 350),
 * vols sans violence (5 181), violences intrafamiliales (4 682), cambriolages
 * (4 493) and violences hors famille (3 224). All fifteen commune-grain
 * indicators — and all eighteen at département grain — stay readable on a
 * clicked card; only six can be painted, and that is a stated limit.
 *
 * ── The palette, against the neighbours it will be stacked on ──────────────
 * Warm sequential gold → crimson for the published ramp. It is deliberately
 * NOT the Vigilance green→red (that ramp means "danger forecast", and this one
 * must never be read as a warning), not the IRVE blue→red power ramp, not the
 * sup-fr violet and not the schools-fr green. The slate of the suppressed band
 * sits outside the ramp's hue range entirely, so no amount of squinting turns
 * "withheld" into "a bit less than the palest gold".
 *
 * @module data/delinquanceFrance
 */

export const DELINQUANCE_FR_LAYER_ID = 'delinquance-fr';

export const DELINQUANCE_FR_OVERLAY_SOURCE_ID = 'delinquance-fr-selected';
export const DELINQUANCE_FR_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});
export const DELINQUANCE_FR_LABEL_SOURCE_ID = 'delinquance-fr-departements';
export const DELINQUANCE_FR_LABEL_COHORT_LIMIT = 14;
export const DELINQUANCE_FR_LABEL_COLLISION_CAPACITY = 12;

const DEPARTEMENTS_URL = new URL(
  './local_data/france_departements/departements.geojson',
  import.meta.url,
).href;

// --- Activation ------------------------------------------------------------
/**
 * View LATITUDE span (degrees) at or below which the commune regime is entered.
 *
 * 0.75° is about 83 km of France, which is a city and the country around it —
 * the scale at which "is this commune's cell published?" is a question a
 * reader can act on. It is NOT the 9.5° the point layers use to leave their
 * national view, and the reason is payload: a 9.5° box touches most of France,
 * and the contour packs are per-département. Measured on the real contours,
 * the biggest département in France (Pas-de-Calais, 887 communes) is 872 494
 * bytes of wire JSON — 276 537 gzipped — after decimation. Six of those is
 * already a heavy view; sixty would be a download.
 *
 * The exit threshold is higher than the entry one so a camera resting on the
 * boundary does not swap the whole map back and forth on sub-pixel drift.
 *
 * ── Why this is still a HARD CUT and not a fade ─────────────────────────────
 * Layers that change aggregation level with the camera can crossfade the two
 * levels across a band of scale (`zoomFade.js`). That is honest only between
 * two resolutions of ONE statistic on ONE set of colour breaks, and the two
 * levels of this layer are not that, for three reasons the code makes:
 *   1. Different breaks. The département ramp is cut in the browser over the
 *      96 metropolitan département rates (`projectDelinquanceNational`); the
 *      commune ramp is cut ONCE in the proxy over every published commune rate
 *      in France and shipped in each pack (`thresholds`, vite.config.js). Six
 *      colours, two sets of quantiles over two populations: under the total,
 *      the départements run from 24.4 ‰ (Cantal) to 109.9 ‰ (Paris) while the
 *      communes reach 1 512 ‰ (Roissy-en-France). A crimson département and a
 *      crimson commune are not the same rate, and inside a band one would be
 *      drawn through the other.
 *   2. A different total. The indicator the layer opens on sums 16
 *      contributors at département grain and is exact there; at commune grain
 *      it sums 14 and is a floor in 9 428 of the 9 606 communes that carry one.
 *   3. A state the coarse level does not have. Withheld (slate) exists only at
 *      commune grain. That the national map looks complete and one zoom later
 *      half of it is slate is the finding, and a crossfade would blur it into a
 *      gradual greying.
 * So the swap stays on this 0.75° / 1.1° hysteresis. What changed is that it
 * no longer goes blank while the next level is fetched and built: the level
 * being left stays fully drawn until the one replacing it is ready, and the
 * two then trade places in one frame — never a blend, never a resting state
 * with both on screen. See {@link delinquanceLevelAlphas}.
 */
export const COMMUNE_ENTER_SPAN_DEG = 0.75;
export const COMMUNE_EXIT_SPAN_DEG = 1.1;
/** Contour packs one view may ask for. See the byte measurement above. */
export const COMMUNE_MAX_PACKS = 6;
/** Packs kept in the browser between views, LRU. */
export const COMMUNE_PACK_CACHE = 8;

const CAMERA_DEBOUNCE_MS = 450;
/**
 * Poll cadence (ms). Six hours, and even that is generous: `frequency` on the
 * dataset is `annual` and the bases are rebuilt each July. The camera, not the
 * clock, drives this layer.
 */
const POLL_INTERVAL_MS = 6 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 120_000;

// --- Presentation ----------------------------------------------------------
/**
 * The published ramp, low to high. Warm sequential — see the module header for
 * why it is not any of the four ramps already on this globe.
 */
export const DELINQUANCE_RAMP = Object.freeze([
  '#ffe08a', '#ffb648', '#f97316', '#e03131', '#b02020', '#6d1414',
]);
/** Fill alpha per band — weight as well as hue. */
const RAMP_ALPHA = Object.freeze([0.30, 0.35, 0.41, 0.47, 0.54, 0.62]);
/**
 * `diff` with a count of zero: measured absence. A cool near-white wash, the
 * lightest thing on the map, because "nothing was recorded here, three years
 * running" should read as quiet rather than as a value.
 */
export const DELINQUANCE_ZERO_COLOR = '#dfe9f0';
const ZERO_ALPHA = 0.16;
/**
 * `ndiff`: withheld. Slate — off the warm ramp entirely — at a heavier alpha
 * than the palest published band so it cannot be mistaken for a low value, and
 * with its own wider, brighter outline so the eye finds the withheld cells
 * first.
 */
export const DELINQUANCE_SUPPRESSED_COLOR = '#5c6b8a';
const SUPPRESSED_ALPHA = 0.52;
/** A commune with a contour but no row at all in this edition. */
export const DELINQUANCE_MISSING_COLOR = '#2b2f36';

/**
 * The one chip in this layer's row that is not an indicator. Its id lives in
 * the same namespace as the indicator slugs, so it is declared here where the
 * collision would be visible.
 */
export const METHODO_CHIP_ID = 'methodo';

const OUTLINE_COLOR = '#0b0e12';
const OUTLINE_ALPHA = 0.35;
const OUTLINE_WIDTH_PX = 1.0;
const SUPPRESSED_OUTLINE_COLOR = '#aebbd6';
const SUPPRESSED_OUTLINE_ALPHA = 0.75;
const SUPPRESSED_OUTLINE_WIDTH_PX = 2.0;
const SELECTED_COLOR = '#00ffff';

/**
 * The three states mean something different under the computed total, so the
 * legend says something different. `published` in particular stops meaning
 * "measured" and starts meaning "measured floor", which is the whole reason
 * these three strings are not a reuse of the ones below.
 */
function totalStateBlurbs() {
  return messages().totalStateBlurbs;
}

/**
 * One-line explanations behind each legend swatch.
 *
 * These are hover copy on the layer row, so they are the surface with no length
 * budget at all — which is why the reporting-rate rule lives here in full as
 * well as behind the `méthodo` chip. Whatever a card compresses, the panel
 * still says word for word.
 */
function stateBlurbs() {
  const m = messages();
  return {
    published: m.stateBlurbs.published(delinquanceRule('plainte')),
    zero: m.stateBlurbs.zero(delinquanceRule('zero')),
    suppressed: m.stateBlurbs.suppressed(delinquanceRule('suppression')),
    missing: m.stateBlurbs.missing,
  };
}

const DEFAULT_OVERLAY_HOST = Object.freeze({
  setEntries: setOverlayEntries,
  setVisible: setOverlaySourceVisible,
  clearSource: clearOverlaySource,
});
let _overlayHost = DEFAULT_OVERLAY_HOST;

// --- Runtime state ---------------------------------------------------------
let _viewer = null;
let _enabled = false;
let _regime = 'departements';
// The layer OPENS on the computed total: picking an offence before seeing
// anything is a choice a reader should not have to make first. Every chip
// narrows from here.
let _indicator = DELINQUANCE_TOTAL_SLUG;
let _year = null;
let _clickHandler = null;
let _cameraChangedAttached = false;
let _cameraDebounceTimer = null;
let _selectedId = null;
/**
 * `méthodo` chip: cards quote the SSMSI's rules in full instead of stating
 * their claim in one line. Off by default — see the card-copy section.
 */
let _methodo = false;
let _count = 0;
let _lastUpdate = null;
let _loading = false;
let _error = null;
let _status = 'idle';

/** `/api/delinquance-fr/departements` payload. */
let _base = null;
let _basePromise = null;
let _national = null;
let _depDataSource = null;
let _depEntities = new Map();
let _depMeta = new Map();
let _depIndex = null;
let _depShapesPromise = null;
/**
 * One material per fill key, kept across repaints. Assigning a NEW material
 * object to an entity rebuilds its ground batch, so a repaint that hands every
 * département the object it already has is free — and showing the level again
 * after the commune regime is a show-attribute write, not a rebuild.
 */
const _depMaterials = new Map();
/** Codes the current indicator paints; the rest are drawn as absence. */
let _depPaintedCodes = new Set();
/** The département level carries the current indicator's fills. */
let _depPainted = false;
/** Whether the département level is shown, as the swap last decided. */
let _depShown = false;

/** Commune regime: the drawing on screen. */
let _packs = new Map();
let _packPromises = new Map();
let _packErrors = new Map();
let _communeRecords = new Map();
let _fills = null;
let _outlines = null;
let _suppressedOutlines = null;
/** Whether the commune drawing on screen is shown, as the swap last decided. */
let _communesShown = false;
/**
 * The commune level is drawn for the view the regime asked about — possibly
 * as nothing at all, over the sea or after a failed fetch. An empty answer is
 * an answer: the départements do not hold the screen at commune zoom for it.
 */
let _communeLevelDrawn = false;
/**
 * The commune drawing being built to replace the one on screen: built hidden,
 * promoted by the frame callback once every primitive in it is ready.
 * @type {?{fills:?object, outlines:?object, suppressedOutlines:?object, records:Map}}
 */
let _pendingCommunes = null;
let _visibleDeps = [];
let _classificationType = Cesium.ClassificationType.BOTH;
/** `watchZoomFade` handle while the layer is enabled. */
let _fade = null;

// --- Formatting ------------------------------------------------------------

function fr(value) {
  const number = Number(value);
  return Number.isFinite(number) ? formatNumber(number) : messages().noValue;
}

/**
 * A `taux_pour_mille` as a card reads it.
 *
 * Three significant digits down to the thousandth, because homicide rates are
 * of the order of 0.01 per 1 000 and a two-decimal format would print every
 * département as `0.01`.
 */
export function formatDelinquanceRate(rate) {
  // `Number(null)` is 0 and `Number('')` is 0, and this layer is the one place
  // in the repo where that coercion is a safety bug rather than a nuisance: a
  // withheld cell's absent rate would print as « 0,000 pour 1 000 habitants »,
  // which is the exact sentence the three-state model exists to prevent. An
  // explicit nullish test comes first; a real published zero (Ardèche recorded
  // no homicide in 2025) still formats as 0,000, because that one is a claim.
  if (rate === null || rate === undefined || rate === '') return messages().noValue;
  const value = Number(rate);
  if (!Number.isFinite(value)) return messages().noValue;
  const decimals = value >= 10 ? 1 : (value >= 1 ? 2 : 3);
  return formatDecimal(value, decimals, { minimumFractionDigits: decimals });
}

/**
 * A count with the noun it is counted in — `2 597 victimes`, not `2 597 faits`.
 *
 * The register counts each indicator in its own unit, and four of the five are
 * not facts: escroqueries are victims, stupéfiants are people stopped, vehicle
 * theft is vehicles. Printing `faits` for all of them was both a paraphrase
 * and the reason a card's headline number could not be read at all.
 *
 * @param {string} slug
 * @param {number} count
 * @returns {string}
 */
export function formatDelinquanceCount(slug, count) {
  return messages().value.count(fr(count), delinquanceCountNoun(slug, count));
}

/**
 * The measured value of one cell, as one line.
 *
 * Count FIRST, rate second, joined by « soit »: the rate alone is the thing no
 * reader can parse — 6,22 of what, out of what — and naming the numerator once
 * makes the denominator that follows do its job.
 *
 * @param {string} slug
 * @param {number} count
 * @param {?number} rate
 * @returns {string}
 */
export function delinquanceValueLine(slug, count, rate) {
  return messages().value.line(
    formatDelinquanceCount(slug, count),
    formatDelinquanceRate(rate),
    delinquanceRateUnit(slug),
  );
}

/**
 * The same line for the computed total, which has no noun of its own.
 *
 * Its numerator mixes victims, offences, vehicles and people stopped, so it
 * cannot borrow `delinquanceCountNoun` — « faits » is the word this layer
 * refuses for it. `cumulés` plus the number of contributors says what the
 * number IS; the denominator stays spelled out, because a total recomputed on
 * the resident population is the one rate here that no reader can guess.
 *
 * @param {number} count
 * @param {?number} rate
 * @param {number} contributors Indicators summed at this grain.
 * @returns {string}
 */
export function delinquanceTotalValueLine(count, rate, contributors) {
  return messages().value.totalLine(fr(count), contributors, formatDelinquanceRate(rate));
}

// --- Colour ----------------------------------------------------------------

function bandIndex(bin) {
  const index = Number(bin);
  if (!Number.isFinite(index) || index < 0) return -1;
  return Math.min(DELINQUANCE_RAMP.length - 1, Math.floor(index));
}

/**
 * The fill for one cell.
 *
 * State FIRST, band second — a suppressed cell never reaches the ramp, whatever
 * else is on it. That ordering is the single most load-bearing branch in this
 * file: inverted, it paints a withheld cell as a value.
 *
 * @param {?number} state CELL_PUBLISHED | CELL_ZERO | CELL_SUPPRESSED | null
 * @param {number} [bin]
 * @returns {{css:string, alpha:number}}
 */
export function delinquanceFill(state, bin = -1) {
  if (state === CELL_SUPPRESSED) {
    return { css: DELINQUANCE_SUPPRESSED_COLOR, alpha: SUPPRESSED_ALPHA };
  }
  if (state === CELL_ZERO) return { css: DELINQUANCE_ZERO_COLOR, alpha: ZERO_ALPHA };
  if (state === CELL_PUBLISHED) {
    const index = bandIndex(bin);
    if (index < 0) return { css: DELINQUANCE_ZERO_COLOR, alpha: ZERO_ALPHA };
    return { css: DELINQUANCE_RAMP[index], alpha: RAMP_ALPHA[index] };
  }
  return { css: DELINQUANCE_MISSING_COLOR, alpha: 0.22 };
}

/**
 * Legend labels for the quantile ramp, built from the measured thresholds and
 * carrying the DENOMINATOR, which changes between indicators.
 * @param {Array<number>} thresholds
 * @param {string} slug
 * @returns {Array<string>}
 */
export function delinquanceBinLabels(thresholds, slug) {
  const m = messages();
  const bounds = (Array.isArray(thresholds) ? thresholds : []).map(Number).filter(Number.isFinite);
  const labels = [];
  let previous = 0;
  for (const bound of bounds) {
    labels.push(m.bins.range(formatDelinquanceRate(previous), formatDelinquanceRate(bound)));
    previous = bound;
  }
  labels.push(m.bins.above(formatDelinquanceRate(previous)));
  const unit = delinquanceRateUnit(slug);
  return labels.map((label) => m.bins.withUnit(label, unit));
}

// --- Camera ----------------------------------------------------------------

/** The view rectangle's latitude span in degrees, Infinity past the limb. */
export function delinquanceViewSpanDeg(viewer) {
  const rectangle = viewer?.camera?.computeViewRectangle?.();
  if (!rectangle) return Infinity;
  const south = Cesium.Math.toDegrees(rectangle.south);
  const north = Cesium.Math.toDegrees(rectangle.north);
  if (!Number.isFinite(south) || !Number.isFinite(north) || north <= south) return Infinity;
  return north - south;
}

/**
 * Which regime a span belongs to, given the one currently on screen.
 *
 * Hysteresis: entering the commune regime needs the tighter span, leaving it
 * needs the looser one, so a camera resting on the boundary does not rebuild
 * the whole map on drift.
 */
export function delinquanceRegimeFor(spanDeg, current = 'departements') {
  const span = Number(spanDeg);
  // i18n-ignore-start — the two regime KEYS, compared and returned.
  if (!Number.isFinite(span)) return 'departements';
  if (current === 'communes') return span > COMMUNE_EXIT_SPAN_DEG ? 'departements' : 'communes';
  return span <= COMMUNE_ENTER_SPAN_DEG ? 'communes' : 'departements';
  // i18n-ignore-end
}

/**
 * Which of the two levels is drawn, given the regime and what is on screen.
 *
 * The regime is the TARGET and stays a hard cut (see
 * {@link COMMUNE_ENTER_SPAN_DEG} for why it may not fade). What this adds is
 * the cover rule: the level being left holds full strength until the level
 * replacing it is actually drawn, so the swap never shows an empty globe for
 * the length of a pack fetch — up to six packs of ~276 KB gzipped on the way
 * in, a ground-batch build on the way out. The layer runs no arrival ramp, so
 * every alpha here is 0 or 1: the two levels trade places in one frame and are
 * never blended, not even for the 260 ms a fade layer would take.
 *
 * @param {{regime: string, departementsReady: boolean, communesReady: boolean}} state
 * @returns {{departements: number, communes: number}}
 */
export function delinquanceLevelAlphas({ regime, departementsReady = false, communesReady = false } = {}) {
  // i18n-ignore-next-line — a regime key, compared.
  const target = regime === 'communes' ? { fine: 1, coarse: 0 } : { fine: 0, coarse: 1 };
  const alphas = coverAlphas(target, { fineReady: communesReady, coarseReady: departementsReady });
  return { departements: alphas.coarse, communes: alphas.fine };
}

/** The camera rectangle as a plain box, padded. */
export function delinquanceViewBox(viewer, padFraction = 0.08) {
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
    south: south - padLat,
    north: north + padLat,
    west: west - padLon,
    east: east + padLon,
  };
}

// --- Card copy -------------------------------------------------------------
//
// TWO REGISTERS, one card. Everything this layer must say, it says in both —
// the difference is length, never content.
//
//   compact (default)  one line per claim, ≤ 60 characters, so nothing wraps
//   méthodo (chip on)  the SSMSI's own sentences, word for word, wrapped by
//                      the overlay's own shared 420 px ceiling
//
// The verbose card came first and was right about WHAT to say; it was wrong
// about how much of it a reader would finish. Measured on the 2025 edition, a
// Dordogne card ran 858 characters — 558 of them quotation, identical on every
// card of that indicator — around four numbers, which the overlay now has to
// wrap into a column of some twenty-five lines. The compact register keeps
// every claim the long one made (recorded ≠ committed, the 12 %/74 % reporting
// spread, the three-year suppression condition, the residence-not-scene note,
// and for the computed total its authorship) and drops the wording;
// the chip puts the wording back for the reader who wants to check it, and
// the row legend's blurbs carry the full quotes at all times.
//
// The one thing the compact register ADDS is the unit: `2 597 victimes, soit
// 6,22 pour 1 000 habitants`. The old card printed « 6,22 pour 1 000
// habitants · 2 597 faits », which named neither what was counted nor, for
// four indicators of five, the right noun.

/**
 * The caveat that rides on every card this layer draws.
 *
 * It is not decoration and it is not the same sentence for every indicator:
 * an offence counted in `Mis en cause` is a count of people the police
 * stopped, which is a different kind of claim from a victim's report, and the
 * card says which one the reader is looking at.
 *
 * In `méthodo` it QUOTES rather than paraphrases, and that is a correction,
 * not a style choice. This function used to tell a reader that a withheld cell
 * held « entre 1 et 5 faits ». Measured on 2026-09-02 over the real base, that
 * is false for **4 735 of the 251 145 suppressed 2025 cells**, whose own
 * (commune, indicateur) series published MORE than 5 facts in 2023 or 2024 —
 * Cessy (01071) published 16 `Vols de véhicule` in 2023 and is withheld now.
 * The rule is a THREE-YEAR condition on the series, not a ceiling on the
 * displayed year, so the card carries {@link DELINQUANCE_SUPPRESSION_RULE}
 * word for word and lets the reader apply it. The compact register states that
 * same condition — `Diffusé si > 5 faits 3 ans de suite — ni zéro, ni « peu »`
 * — because the claim, not the sentence, is what may never be dropped.
 *
 * The reporting-rate line is the publisher's own too, with the publisher's own
 * two numbers: 12 % of victims of sexual violence outside the household report
 * it, against 74 % of burglary victims. Two indicators of this same layer are
 * therefore not on a comparable scale, and no sentence written here would say
 * that as unarguably as the SSMSI saying it about itself — so both registers
 * carry those two numbers.
 *
 * @param {string} slug
 * @param {{state?:?number, methodo?:boolean}} [options] `CELL_SUPPRESSED` adds
 *   the suppression rule; `methodo` selects the verbatim register.
 * @returns {string} One or more lines; the caller splits on `\n`.
 */
export function delinquanceCaveat(slug, { state = null, methodo = _methodo } = {}) {
  const m = messages();
  const meta = indicatorForSlug(slug);
  // i18n-ignore-next-line — the register's own `unite` value, matched as published.
  const misEnCause = meta?.unite === 'Mis en cause';
  const total = slug === DELINQUANCE_TOTAL_SLUG;
  const lines = [];
  if (!methodo) {
    // The computed total's three claims — authorship, mixed units, no double
    // count — are three sentences in the verbatim register and three lines
    // here. None of them may be dropped: the first one is the only thing that
    // tells a reader this number is GEV's arithmetic and not the register's.
    if (total) {
      lines.push(delinquanceCaveatLine('totalAuthorship'));
      lines.push(delinquanceCaveatLine('totalUnits'));
      lines.push(delinquanceCaveatLine('totalAfd'));
    } else {
      lines.push(delinquanceCaveatLine(misEnCause ? 'misEnCause' : 'enregistree'));
    }
    const note = delinquanceIndicatorNote(slug, { short: true });
    if (note) lines.push(note);
    if (state === CELL_SUPPRESSED) lines.push(delinquanceCaveatLine('suppression'));
    lines.push(`${delinquanceCaveatLine('plainte')} · ${delinquanceCaveatLine('documentation')}`);
    return lines.join('\n');
  }
  if (total) {
    // The total is the one indicator on this layer that the SSMSI does not
    // publish, so its first line is not about crime — it is about authorship.
    lines.push(m.methodo.totalAuthorship(
      DELINQUANCE_TOTAL_COMMUNE_SLUGS.length,
      DELINQUANCE_TOTAL_DEPARTEMENT_SLUGS.length,
    ));
    lines.push(m.methodo.totalUnits);
    lines.push(m.methodo.totalAfd);
  } else {
    lines.push(misEnCause ? m.methodo.misEnCause : m.methodo.enregistree);
  }
  lines.push(m.methodo.plainte(delinquanceRule('plainte')));
  const note = delinquanceIndicatorNote(slug);
  if (note) lines.push(note);
  if (state === CELL_SUPPRESSED) {
    lines.push(m.methodo.suppressionRule(delinquanceRule('suppression')));
    lines.push(m.methodo.suppressionYears);
  }
  lines.push(delinquanceDocumentationTitle());
  return lines.join('\n');
}

/**
 * How many inhabitants, and how many dwellings when dwellings are what the
 * rate is divided by.
 *
 * Compact cards print the DENOMINATOR of the rate above them and nothing else:
 * `266 451 logements` under a per-1 000-habitants rate is a number with no
 * question attached to it.
 */
function populationLine(pop, log, slug, methodo) {
  if (!(pop > 0)) return null;
  // i18n-ignore-next-line — `per` is a column key of the indicator table.
  const wantsLog = methodo || indicatorForSlug(slug)?.per === 'logements';
  const m = messages();
  return wantsLog && log > 0
    ? m.population.residentsAndDwellings(fr(pop), fr(log))
    : m.population.residents(fr(pop));
}

/**
 * The commune census — what turns a solid-looking département into an honest
 * one, by saying how much of the finer map underneath is withheld.
 */
function communeCensusLine(communes, methodo) {
  const m = messages();
  const total = communes.published + communes.zero + communes.suppressed;
  const share = ((100 * communes.suppressed) / Math.max(1, total)).toFixed(0);
  return methodo
    ? m.census.methodo(fr(communes.suppressed), fr(total), share, fr(communes.published))
    : m.census.compact(
      fr(total),
      fr(communes.suppressed),
      communes.suppressed,
      share,
      fr(communes.published),
      communes.published,
    );
}

/** Card copy for one département. */
export function buildDelinquanceDepartementLabel(row, context = {}) {
  const m = messages();
  const slug = context.indicator || _indicator;
  const methodo = context.methodo ?? _methodo;
  const details = [];
  details.push(m.departement.header(
    delinquanceIndicatorLabel(slug),
    context.year || _year || m.noValue,
  ));
  if (slug === DELINQUANCE_TOTAL_SLUG && row.state === CELL_PUBLISHED) {
    // No `est_diffuse` column exists at this grain, so this total is complete
    // — the one place on this layer where a total is a value and not a floor.
    details.push(methodo
      ? m.departement.totalMethodo(
        formatDelinquanceRate(row.rate),
        fr(row.count),
        DELINQUANCE_TOTAL_DEPARTEMENT_SLUGS.length,
      )
      : delinquanceTotalValueLine(row.count, row.rate, DELINQUANCE_TOTAL_DEPARTEMENT_SLUGS.length));
    details.push(methodo ? m.departement.totalExactMethodo : m.departement.totalExact);
  } else if (row.state === CELL_PUBLISHED) {
    details.push(delinquanceValueLine(slug, row.count, row.rate));
  } else if (row.state === CELL_ZERO) {
    details.push(DELINQUANCE_CELL_LABELS.zero);
  } else {
    details.push(m.departement.noRow);
  }
  const population = populationLine(row.pop, row.log, slug, methodo);
  if (population) details.push(population);
  if (row.communes) details.push(communeCensusLine(row.communes, methodo));
  details.push(delinquanceCaveat(slug, { state: row.state, methodo }));
  return [row.name, ...details].join('\n');
}

/**
 * Characters a compact card line may run to.
 *
 * Not a wrapping mechanism — the overlay wraps every stacked card under its own
 * shared 420 px ceiling, and one implementation of that is enough. This is an
 * EDITORIAL budget: a compact line is one claim, and a claim that needs more
 * than sixty characters belongs in the verbatim register instead. 60 monospace
 * characters measure ~376 px, so a compact card reaches the overlay already
 * under the ceiling and is never folded on the way out.
 */
const COMPACT_LINE_BUDGET = 60;

/**
 * Every OTHER indicator for this commune, so the reader is never stuck with
 * the one that happens to be painted.
 *
 * `méthodo` lists all fifteen on one line, published values and ✕ marks
 * together — 223 characters on a Périgueux card, four drawn lines of chips
 * once wrapped. The compact register fills ONE line with the ones that have a
 * value and counts the rest, because a withheld indicator's name tells the
 * reader nothing its count does not.
 *
 * Under the total, `méthodo` marks the contributors excluded from it — a
 * reader adding the list up by hand must see why it does not reconcile with
 * the number above. The compact card says the same thing once, in its caveat
 * ({@link DELINQUANCE_TOTAL_AFD_SHORT}), rather than thirteen characters at a
 * time inside a line that has sixty.
 */
function otherIndicatorLines(record, slug, methodo, total = false) {
  const m = messages();
  const published = [];
  const all = [];
  let suppressed = 0;
  for (let i = 0; i < DELINQUANCE_COMMUNE_SLUGS.length; i += 1) {
    const other = DELINQUANCE_COMMUNE_SLUGS[i];
    if (other === slug) continue;
    const value = record?.cells?.[i];
    if (!value) continue;
    const name = delinquanceIndicatorShort(other);
    const marked = total && DELINQUANCE_TOTAL_EXCLUDED.includes(other)
      ? m.others.excluded(name)
      : name;
    if (value[0] === CELL_PUBLISHED) {
      published.push(m.others.value(name, fr(value[1])));
      all.push(m.others.value(marked, fr(value[1])));
    } else if (value[0] === CELL_SUPPRESSED) {
      suppressed += 1;
      all.push(m.others.withheld(marked));
    }
  }
  if (methodo) return all.length ? [all.join(' · ')] : [];
  const lines = [];
  if (published.length) {
    // Drop chips from the end until the line fits, counting whatever the trim
    // leaves behind. One chip always survives, however long its name is.
    const shown = published.slice();
    while (shown.length > 1 && chipLine(shown, published.length - shown.length).length
      > COMPACT_LINE_BUDGET) shown.pop();
    lines.push(chipLine(shown, published.length - shown.length));
  }
  if (suppressed) lines.push(m.others.suppressedCount(fr(suppressed), suppressed));
  return lines;
}

/** One compact chip line, with the count of the chips it did not fit. */
function chipLine(shown, hidden) {
  return shown.join(' · ') + (hidden ? messages().others.more(fr(hidden), hidden) : '');
}

/** Card copy for one commune. */
export function buildDelinquanceCommuneLabel(record, context = {}) {
  const m = messages();
  const slug = record?.indicator || _indicator;
  const methodo = context.methodo ?? _methodo;
  const details = [];
  details.push(m.departement.header(delinquanceIndicatorLabel(slug), record?.year || m.noValue));
  const cell = record?.cell || null;
  const state = cell?.[0] ?? null;
  const total = slug === DELINQUANCE_TOTAL_SLUG;
  // The fourth slot of a computed total cell: how many of its contributors the
  // register withheld. It is the difference between a value and a floor, so it
  // is the first thing the card says about the number it is about to print —
  // and it is said in both registers, at both lengths.
  const withheld = total ? Number(cell?.[3]) || 0 : 0;
  const contributors = DELINQUANCE_TOTAL_COMMUNE_SLUGS.length;
  if (total && state === CELL_PUBLISHED) {
    details.push(methodo
      ? m.commune.totalMethodo(formatDelinquanceRate(cell[2]), fr(cell[1]))
      : delinquanceTotalValueLine(cell[1], cell[2], contributors));
    if (withheld > 0) {
      details.push(methodo
        ? m.commune.lowerBoundMethodo(fr(withheld), contributors)
        : m.commune.lowerBound(fr(withheld), contributors));
    } else {
      details.push(methodo
        ? m.commune.completeMethodo(contributors)
        : m.commune.complete(contributors));
    }
  } else if (total && state === CELL_ZERO) {
    details.push(methodo
      ? m.commune.totalZeroMethodo(
        DELINQUANCE_CELL_LABELS.zero, contributors, delinquanceRule('zero'),
      )
      : m.commune.totalZero(DELINQUANCE_CELL_LABELS.zero, contributors));
  } else if (total && state === CELL_SUPPRESSED) {
    details.push(methodo ? m.commune.totalSuppressedMethodo : m.commune.totalSuppressed);
    details.push(methodo
      ? m.commune.totalUnknownMethodo(fr(withheld), contributors)
      : m.commune.totalUnknown(fr(withheld), contributors));
  } else if (state === CELL_PUBLISHED) {
    details.push(delinquanceValueLine(slug, cell[1], cell[2]));
  } else if (state === CELL_ZERO) {
    // A published zero is a CLAIM, and the claim rests on the three-year
    // condition — which the compact line states and `méthodo` quotes.
    details.push(methodo
      ? m.commune.zeroMethodo(DELINQUANCE_CELL_LABELS.zero, delinquanceRule('zero'))
      : m.commune.zero(DELINQUANCE_CELL_LABELS.zero));
  } else if (state === CELL_SUPPRESSED) {
    details.push(DELINQUANCE_CELL_LABELS.suppressed);
    const mean = record?.mean || null;
    if (mean && Number.isFinite(mean.rate)) {
      // `complement_info_taux` is a DÉPARTEMENTAL average over every withheld
      // commune, not this commune's value, and the label has to make that
      // impossible to misread — in either register. `méthodo` quotes the
      // column's own definition; the compact line names whose average it is.
      details.push(methodo
        ? m.commune.meanMethodo(
          m.commune.meanRate(formatDelinquanceRate(mean.rate), delinquanceRateUnit(slug)),
          delinquanceRule('complement'),
          mean.variants > 1 ? m.commune.meanVariants : '',
        )
        : m.commune.mean(formatDelinquanceRate(mean.rate)));
      if (!methodo && mean.variants > 1) details.push(m.commune.meanVariantsWarning);
    }
  } else {
    details.push(m.commune.noRow);
  }
  if (record?.pop === 0) {
    details.push(methodo ? m.commune.noPopulationMethodo : m.commune.noPopulation);
  } else if (record?.pop > 0) {
    const population = populationLine(record.pop, record.log, slug, methodo);
    if (population) details.push(population);
  }
  details.push(...otherIndicatorLines(record, slug, methodo, total));
  // A commune limit is a legal object and the drawn ring is not one. That
  // claim survives compression; only its sentence shortens.
  if (record?.simplified) {
    details.push(methodo ? m.commune.simplifiedMethodo : m.commune.simplified);
  }
  details.push(delinquanceCaveat(slug, { state, methodo }));
  return [record?.name || record?.code || m.commune.untitled, ...details].join('\n');
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

/** Ambient label for one département at national altitude. */
export function createDelinquanceDepartementOverlayEntry(row, position) {
  const m = messages();
  const value = row.state === CELL_PUBLISHED ? formatDelinquanceRate(row.rate) : m.noValue;
  return {
    id: `delinquance-fr:dep:${row.code}`,
    position,
    variant: 'label',
    title: m.departementLabel(row.name, value),
    accent: delinquanceFill(row.state, row.bin).css,
    priority: Number(row.rate) || 0,
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

/** Keep the highest-rate départements, with stable identity as tie-break. */
export function selectDelinquanceLabelCohort(entries, limit = DELINQUANCE_FR_LABEL_COHORT_LIMIT) {
  const cap = Math.max(0, Math.min(DELINQUANCE_FR_LABEL_COHORT_LIMIT, Math.floor(Number(limit) || 0)));
  if (!Array.isArray(entries) || cap === 0) return [];
  return entries.slice()
    .sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)))
    .slice(0, cap);
}

// --- Selection --------------------------------------------------------------

function clearSelection() {
  _selectedId = null;
  _overlayHost.clearSource(DELINQUANCE_FR_OVERLAY_SOURCE_ID);
}

function selectDepartement(code) {
  const row = _national?.departements?.find((entry) => entry.code === code);
  if (!row) return;
  const anchor = _depMeta.get(code)?.anchor;
  if (!anchor) return;
  _selectedId = `dep:${code}`;
  _overlayHost.setEntries(DELINQUANCE_FR_OVERLAY_SOURCE_ID, [selectedOverlayEntry(
    _selectedId,
    _viewer ? Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1]) : { anchor },
    buildDelinquanceDepartementLabel(row, { indicator: _indicator, year: _year }),
  )], DELINQUANCE_FR_OVERLAY_SOURCE_OPTIONS);
}

function selectCommune(id) {
  const record = _communeRecords.get(id);
  if (!record?.anchor) return;
  _selectedId = id;
  _overlayHost.setEntries(DELINQUANCE_FR_OVERLAY_SOURCE_ID, [selectedOverlayEntry(
    id,
    _viewer ? Cesium.Cartesian3.fromDegrees(record.anchor[0], record.anchor[1]) : { anchor: record.anchor },
    buildDelinquanceCommuneLabel(record),
  )], DELINQUANCE_FR_OVERLAY_SOURCE_OPTIONS);
}

/** The `méthodo` parameter as a boolean, or null when it says nothing. */
function readMethodo(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'on' || text === '1' || text === 'true') return true;
  if (text === 'off' || text === '0' || text === 'false') return false;
  return null;
}

/**
 * Redraw the open card in place.
 *
 * The `méthodo` chip changes the copy of a card that is already on screen, and
 * a reader who toggles it while a département is selected must see THAT card
 * change — not have to close and re-click it to find out what the chip did.
 */
function refreshSelection() {
  if (!_selectedId) return;
  if (_selectedId.startsWith('dep:')) selectDepartement(_selectedId.slice(4));
  else selectCommune(_selectedId);
}

function onKeyDown(event) {
  if (event.key === 'Escape') clearSelection();
}

function pickedDepartementCode(picked) {
  const code = picked?.id?.properties?.code?.getValue?.();
  return code ? String(code).trim() : null;
}

function installClickHandler(viewer) {
  if (_clickHandler || !viewer?.scene) return;
  _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  _clickHandler.setInputAction((movement) => {
    // NO `if (!picked)` SHORT-CIRCUIT, deliberately. This handler already ends
    // on an unconditional `clearSelection()`, so the empty pick was never a
    // case of its own — and the short-circuit that used to sit here is the
    // exact shape that broke four sibling handlers over the photorealistic
    // globe, where `!picked` is never true. See `pickRegistry.isWorldPick`.
    const picked = pickAt(viewer.scene, movement.position);
    if (typeof picked?.id === 'string' && _communeRecords.has(picked.id)) {
      selectCommune(picked.id);
      return;
    }
    const code = pickedDepartementCode(picked);
    if (code && _national) {
      selectDepartement(code);
      return;
    }
    clearSelection();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  document.addEventListener('keydown', onKeyDown);
}

// --- Département regime -----------------------------------------------------

async function ensureDepartementShapes() {
  if (_depShapesPromise) return _depShapesPromise;
  _depShapesPromise = (async () => {
    const geojson = await (await fetch(DEPARTEMENTS_URL)).json();
    _depMeta = parseDepartements(geojson);
    // The SAME bundle, indexed twice on purpose: `parseDepartements` gives the
    // label anchors, `buildDepartementIndex` gives the point-in-polygon tree
    // that answers which département the camera is over. Neither can do the
    // other's job.
    _depIndex = buildDepartementIndex(geojson);
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
 * Give every département the fill of the current indicator.
 *
 * Paints, and does not decide visibility: whether the level is on screen is
 * the swap's call ({@link delinquanceLevelAlphas}), made per frame. It runs in
 * BOTH regimes, so the level that covers a zoom-out already carries the
 * indicator the reader picked while they were looking at communes.
 */
function repaintDepartements() {
  if (!_national || !_depEntities.size) return;
  const painted = new Set();
  for (const row of _national.departements || []) {
    if (row.state === null || row.state === undefined) continue;
    const fill = delinquanceFill(row.state, row.bin);
    const key = `${fill.css}|${fill.alpha}`;
    let material = _depMaterials.get(key);
    if (!material) {
      material = new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString(fill.css).withAlpha(fill.alpha),
      );
      _depMaterials.set(key, material);
    }
    const parts = _depEntities.get(row.code);
    if (!parts) continue;
    painted.add(row.code);
    for (const entity of parts) {
      if (!entity.polygon) continue;
      // The same object again is no change at all; a new one is a rebuild.
      if (entity.polygon.material !== material) entity.polygon.material = material;
    }
  }
  // A département with no row at all is drawn as absence, not as the bottom
  // of the scale: it stays hidden whatever the swap decides.
  _depPaintedCodes = painted;
  _depPainted = true;
  applyDepartementShow();
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

function hideDepartements() {
  _depShown = false;
  applyDepartementShow();
  _overlayHost.clearSource(DELINQUANCE_FR_LABEL_SOURCE_ID);
}

function publishDepartementOverlay() {
  if (!_enabled || _regime !== 'departements') {
    _overlayHost.clearSource(DELINQUANCE_FR_LABEL_SOURCE_ID);
    return;
  }
  const entries = [];
  for (const row of _national?.departements || []) {
    if (row.state !== CELL_PUBLISHED) continue;
    const anchor = _depMeta.get(row.code)?.anchor;
    if (!anchor) continue;
    entries.push(createDelinquanceDepartementOverlayEntry(
      row,
      Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1]),
    ));
  }
  _overlayHost.setEntries(DELINQUANCE_FR_LABEL_SOURCE_ID, selectDelinquanceLabelCohort(entries), {
    cohortLimit: DELINQUANCE_FR_LABEL_COHORT_LIMIT,
    collisionCapacity: DELINQUANCE_FR_LABEL_COLLISION_CAPACITY,
    moving: false,
  });
}

// --- Fetching ---------------------------------------------------------------

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

async function ensureBase() {
  if (_base) return _base;
  if (_basePromise) return _basePromise;
  _basePromise = fetchJson('/api/delinquance-fr/departements', (p) => Array.isArray(p?.departements))
    .then((payload) => {
      _base = payload;
      _error = null;
      if (!_year) _year = payload.newestYear;
      // The chip SET is derived from the edition — see the module header — but
      // the default is the computed total, which is edition-independent. The
      // derived first chip is only the fallback for a payload that somehow
      // carries no total column at all.
      if (!DELINQUANCE_COMMUNE_CELL_SLUGS.includes(_indicator)
        && Array.isArray(payload.chips) && payload.chips.length) {
        _indicator = payload.chips[0];
      }
      return payload;
    })
    .catch((error) => {
      if (error?.name !== 'AbortError') {
        console.warn('[Data:Délinquance-FR] base unavailable:', error?.message || error);
        _error = messages().errors.base;
      }
      return null;
    })
    .finally(() => { _basePromise = null; });
  return _basePromise;
}

async function ensurePack(dep) {
  if (_packs.has(dep)) return _packs.get(dep);
  if (_packPromises.has(dep)) return _packPromises.get(dep);
  // i18n-ignore-next-line — a proxy route, not words.
  const promise = fetchJson(`/api/delinquance-fr/communes/${dep}`, (p) => Array.isArray(p?.communes))
    .then((payload) => {
      _packs.set(dep, payload);
      _packErrors.delete(dep);
      // LRU by insertion order: Map preserves it, so the oldest key is first.
      while (_packs.size > COMMUNE_PACK_CACHE) {
        const oldest = _packs.keys().next().value;
        if (oldest === undefined) break;
        _packs.delete(oldest);
      }
      return payload;
    })
    .catch((error) => {
      if (error?.name !== 'AbortError') {
        console.warn(`[Data:Délinquance-FR] commune pack ${dep} unavailable:`, error?.message || error);
        _packErrors.set(dep, error?.message || messages().errors.pack);
      }
      return null;
    })
    .finally(() => { _packPromises.delete(dep); });
  _packPromises.set(dep, promise);
  return promise;
}

// --- Commune regime ---------------------------------------------------------

function removePrimitives(list) {
  for (const primitive of list) {
    if (primitive && _viewer?.scene?.primitives) _viewer.scene.primitives.remove(primitive);
  }
}

/** Drop the commune drawing on screen. The one being built is left alone. */
function clearCommuneDrawing() {
  removePrimitives([_fills, _outlines, _suppressedOutlines]);
  _fills = null;
  _outlines = null;
  _suppressedOutlines = null;
  _communesShown = false;
  _communeLevelDrawn = false;
  _communeRecords = new Map();
}

/** The view has no commune to draw: that, too, replaces the départements. */
function drawNoCommunes() {
  discardPendingCommunes();
  clearCommuneDrawing();
  _communeLevelDrawn = true;
}

function discardPendingCommunes() {
  if (!_pendingCommunes) return;
  removePrimitives([_pendingCommunes.fills, _pendingCommunes.outlines, _pendingCommunes.suppressedOutlines]);
  _pendingCommunes = null;
}

function clearCommunePrimitives() {
  discardPendingCommunes();
  clearCommuneDrawing();
}

function setCommunesShown(show) {
  if (show === _communesShown) return;
  _communesShown = show;
  for (const primitive of [_fills, _outlines, _suppressedOutlines]) {
    if (primitive) primitive.show = show;
  }
}

/**
 * Whether every primitive of a drawing has been built. A `GroundPrimitive`
 * built with `asynchronous: true` is ready a few frames after it is added —
 * and it builds while hidden, which is what lets the next drawing wait out of
 * sight instead of the old one being cleared first.
 */
function communeDrawingReady(drawing) {
  if (!drawing) return false;
  const primitives = [drawing.fills, drawing.outlines, drawing.suppressedOutlines].filter(Boolean);
  return primitives.length > 0 && primitives.every((primitive) => primitive.ready === true);
}

/** Put the drawing that has finished building in place of the one on screen. */
function promotePendingCommunes() {
  const next = _pendingCommunes;
  _pendingCommunes = null;
  clearCommuneDrawing();
  _fills = next.fills;
  _outlines = next.outlines;
  _suppressedOutlines = next.suppressedOutlines;
  _communeRecords = next.records;
  _communeLevelDrawn = true;
  // Hidden as built; the swap shows it in this same frame.
  _communesShown = false;
}

/** Flat `[lon, lat, …]` to Cartesian positions. */
function ringPositions(flat) {
  if (!Array.isArray(flat) || flat.length < 8) return null;
  return Cesium.Cartesian3.fromDegreesArray(flat);
}

/**
 * Build the drawable record set for the packs currently in view.
 *
 * Exported and pure so the whole three-state decision can be tested without a
 * viewer: given packs and an indicator, this is exactly what would be painted.
 *
 * @param {object} input
 * @param {Array<object>} input.packs
 * @param {string} input.indicator
 * @returns {{records:Array<object>, states:{published:number, zero:number, suppressed:number, missing:number}}}
 */
export function buildDelinquanceCommuneRecords({ packs, indicator }) {
  // The CELL list, not the register's: the computed total occupies the slot
  // after the fifteen published indicators.
  const slot = DELINQUANCE_COMMUNE_CELL_SLUGS.indexOf(indicator);
  const records = [];
  const states = { published: 0, zero: 0, suppressed: 0, missing: 0 };
  for (const pack of Array.isArray(packs) ? packs : []) {
    const thresholds = pack?.thresholds?.[indicator] || [];
    const mean = pack?.means?.[indicator] || null;
    for (const commune of pack?.communes || []) {
      const cell = slot >= 0 ? (commune.v?.[slot] || null) : null;
      const state = cell ? cell[0] : null;
      if (state === CELL_PUBLISHED) states.published += 1;
      else if (state === CELL_ZERO) states.zero += 1;
      else if (state === CELL_SUPPRESSED) states.suppressed += 1;
      else states.missing += 1;
      records.push({
        id: `delinquance-fr:com:${commune.c}`,
        code: commune.c,
        name: commune.n,
        pop: commune.pop,
        log: commune.log,
        simplified: commune.s === 1,
        parts: commune.p || [],
        cells: commune.v || [],
        cell,
        state,
        // A suppressed cell has no rate, so `delinquanceRateBin` is never
        // reached for one: the bin is only computed for a published value.
        bin: state === CELL_PUBLISHED ? delinquanceRateBin(cell[2], thresholds) : -1,
        mean: state === CELL_SUPPRESSED ? mean : null,
        indicator,
        year: pack?.year || null,
        departement: pack?.departement || null,
        anchor: ringAnchor(commune.p?.[0]),
      });
    }
  }
  return { records, states };
}

/**
 * Build the commune drawing for one view, HIDDEN, as the pending drawing.
 *
 * The drawing on screen — the previous view's communes on a pan, the
 * départements on the way in — stays until this one is ready; the frame
 * callback then swaps them in one frame. Clearing first, as this used to,
 * showed an empty globe for the whole build, and on the way in for the pack
 * fetch before it.
 */
function drawCommunes(records) {
  discardPendingCommunes();
  if (!records.length || !_viewer) {
    drawNoCommunes();
    return;
  }

  const fillInstances = [];
  const outlineInstances = [];
  const suppressedOutlineInstances = [];
  const outlineColor = Cesium.Color.fromCssColorString(OUTLINE_COLOR).withAlpha(OUTLINE_ALPHA);
  const suppressedOutlineColor = Cesium.Color
    .fromCssColorString(SUPPRESSED_OUTLINE_COLOR).withAlpha(SUPPRESSED_OUTLINE_ALPHA);
  const pending = { fills: null, outlines: null, suppressedOutlines: null, records: new Map() };

  for (const record of records) {
    pending.records.set(record.id, record);
    const fill = delinquanceFill(record.state, record.bin);
    const color = Cesium.Color.fromCssColorString(fill.css).withAlpha(fill.alpha);
    for (const part of record.parts) {
      const positions = ringPositions(part);
      if (!positions) continue;
      fillInstances.push(new Cesium.GeometryInstance({
        id: record.id,
        geometry: new Cesium.PolygonGeometry({
          // Outer rings only: a commune's interior ring is another commune,
          // and that one is drawn in its own right at the same moment.
          polygonHierarchy: new Cesium.PolygonHierarchy(positions),
          vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
      }));
      const outline = new Cesium.GeometryInstance({
        id: record.id,
        geometry: new Cesium.GroundPolylineGeometry({
          positions: [...positions, positions[0]],
          width: record.state === CELL_SUPPRESSED ? SUPPRESSED_OUTLINE_WIDTH_PX : OUTLINE_WIDTH_PX,
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(
            record.state === CELL_SUPPRESSED ? suppressedOutlineColor : outlineColor,
          ),
        },
      });
      // The withheld cells get their own primitive so their outline is drawn
      // LAST and wins every overlap: the third state is the one the layer most
      // wants a reader to notice, and a neighbour's hairline must not hide it.
      if (record.state === CELL_SUPPRESSED) suppressedOutlineInstances.push(outline);
      else outlineInstances.push(outline);
    }
  }
  if (!fillInstances.length) {
    drawNoCommunes();
    return;
  }

  pending.fills = new Cesium.GroundPrimitive({
    geometryInstances: fillInstances,
    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
    classificationType: _classificationType,
    asynchronous: true,
    releaseGeometryInstances: false,
  });
  pending.fills.show = false;
  _viewer.scene.primitives.add(pending.fills);

  for (const [instances, target] of [[outlineInstances, 'plain'], [suppressedOutlineInstances, 'suppressed']]) {
    if (!instances.length) continue;
    const primitive = new Cesium.GroundPolylinePrimitive({
      geometryInstances: instances,
      appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
      classificationType: _classificationType,
      asynchronous: true,
      releaseGeometryInstances: false,
    });
    primitive.show = false;
    _viewer.scene.primitives.add(primitive);
    if (target === 'suppressed') pending.suppressedOutlines = primitive;
    else pending.outlines = primitive;
  }
  _pendingCommunes = pending;
  governorRequestRender('delinquance-draw');
}

// --- The swap between the two levels -----------------------------------------

/**
 * Per frame: promote a commune drawing that finished building, then show the
 * level the regime asks for — or, until it is drawn, the one it replaces.
 *
 * Nothing here fetches or builds. While a drawing is pending this asks for the
 * next frame itself: a ground primitive turns `ready` in an after-render
 * callback that requests no further frame, so in request-render mode the swap
 * would otherwise wait for the next camera move with both drawings built.
 */
function onLevelFrame() {
  if (_pendingCommunes && communeDrawingReady(_pendingCommunes)) promotePendingCommunes();
  const alphas = delinquanceLevelAlphas({
    regime: _regime,
    departementsReady: _depPainted,
    communesReady: _communeLevelDrawn,
  });
  setDepartementsShown(levelVisible(_enabled, alphas.departements));
  setCommunesShown(levelVisible(_enabled, alphas.communes));
  // A level at zero is dropped, not kept invisible: once the départements
  // have taken over, the commune drawing is released.
  // i18n-ignore-next-line — a regime key, compared.
  if (_regime === 'departements' && _communeLevelDrawn && !levelVisible(true, alphas.communes)) {
    clearCommuneDrawing();
  }
  if (_pendingCommunes) governorRequestRender('delinquance-fr-pending');
  _fade?.report({
    levels: { departements: alphas.departements, communes: alphas.communes },
    dominant: _regime,
    bands: {},
    hardCuts: {
      'departements-communes': {
        enter: COMMUNE_ENTER_SPAN_DEG, exit: COMMUNE_EXIT_SPAN_DEG, unit: 'deg-lat',
      },
    },
    pending: Boolean(_pendingCommunes),
  });
}

// --- Reconciliation ---------------------------------------------------------

function recomputeNational() {
  if (!_base || !_depIndex) return;
  _national = projectDelinquanceNational({
    departements: _base.departements,
    years: _base.years,
    index: _depIndex,
    indicator: _indicator,
    year: _year || _base.newestYear,
    binCount: DELINQUANCE_DEPARTEMENT_BINS,
    communeCensus: _base.censusByDepartement
      ? Object.fromEntries(Object.entries(_base.censusByDepartement)
        .map(([dep, byIndicator]) => [dep, byIndicator[_indicator] || null]))
      : null,
  });
}

async function loadViewport({ force = false } = {}) {
  if (!_enabled) return;
  // Whatever this call concludes — records, a zoom-in verdict or a failure —
  // it concludes it about the view the camera is showing right now. See
  // `cameraSettle.js`: an arrival on any other view has to be read afresh.
  markViewportRead(_viewer, DELINQUANCE_FR_LAYER_ID);
  _loading = true;
  _error = null;
  try {
    const [, shapes] = await Promise.all([ensureBase(), ensureDepartementShapes().catch((error) => {
      console.warn('[Data:Délinquance-FR] département shapes unavailable:', error?.message || error);
      _error = messages().errors.departementShapes;
      return null;
    })]);
    // No outlines is an answer too, and the row already says so: the commune
    // drawing must not hold the national view for a level that cannot come.
    if (!shapes) _depPainted = true;
    if (!_base) {
      _status = 'empty';
      _count = 0;
      return;
    }
    recomputeNational();

    const span = delinquanceViewSpanDeg(_viewer);
    _regime = delinquanceRegimeFor(span, _regime);

    // Both regimes repaint: the département level is the one that covers a
    // zoom-out, and it must already carry the indicator picked meanwhile.
    repaintDepartements();

    if (_regime === 'departements') {
      // The commune drawing is NOT cleared here. It stays on screen until the
      // départements are shown, and the frame callback drops it then; a
      // commune build still in flight is for a view the camera has left.
      discardPendingCommunes();
      publishDepartementOverlay();
      _count = _national?.painted || 0;
      _status = 'ok';
      _lastUpdate = new Date();
      _fade?.frame();
      return;
    }

    // The ambient labels belong to the département regime and leave with it;
    // the département FILLS stay until the communes are ready to replace them.
    _overlayHost.clearSource(DELINQUANCE_FR_LABEL_SOURCE_ID);
    const box = delinquanceViewBox(_viewer);
    const deps = departementsInBox(_depIndex, box, COMMUNE_MAX_PACKS);
    _visibleDeps = deps;
    if (!deps.length) {
      drawNoCommunes();
      _count = 0;
      _status = 'empty';
      _fade?.frame();
      return;
    }
    await Promise.all(deps.map((dep) => ensurePack(dep)));
    // The camera may have left the commune regime while the packs were in
    // flight; a drawing for that view would only be built to be dropped.
    // i18n-ignore-next-line — a regime key, compared.
    if (!_enabled || _regime !== 'communes') return;
    const packs = deps.map((dep) => _packs.get(dep)).filter(Boolean);
    const { records, states } = buildDelinquanceCommuneRecords({ packs, indicator: _indicator });
    drawCommunes(records);
    _fade?.frame();
    _count = records.length;
    _status = records.length ? 'ok' : 'empty';
    if (_packErrors.size && !records.length) _error = messages().errors.communeContours;
    _lastUpdate = new Date();
    void states;
  } finally {
    _loading = false;
  }
}

function onCameraChanged() {
  if (!_enabled) return;
  clearTimeout(_cameraDebounceTimer);
  _cameraDebounceTimer = setTimeout(() => { void loadViewport(); }, CAMERA_DEBOUNCE_MS);
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

/**
 * Loading copy — named for what is being waited on, because "chargement…" over
 * a 40 MB national fold and over one département's outlines are very different
 * waits.
 */
export function buildDelinquanceLoadingLabel({
  loading = _loading, regime = _regime, base = _base,
} = {}) {
  if (!loading) return null;
  const m = messages();
  if (!base) return m.loading.base;
  // i18n-ignore-next-line — a regime key, not a word.
  return regime === 'communes' ? m.loading.communes : m.loading.departements;
}

// --- Layer ------------------------------------------------------------------

const delinquanceFranceLayer = {
  id: DELINQUANCE_FR_LAYER_ID,
  // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
  name: 'Délinquance enregistrée (FR)',
  // 🚓 and not ⚠ or 🔥: the hazards group already carries weather and
  // industrial-risk glyphs, and this layer is not a warning — it is a register
  // of what a force wrote down.
  icon: '🚓',
  source: DELINQUANCE_SOURCE,
  // i18n-ignore-end
  updateInterval: POLL_INTERVAL_MS,

  init(viewer) {
    _viewer = viewer;
    _enabled = false;
    _regime = 'departements';
    _selectedId = null;
    _count = 0;
    _lastUpdate = null;
    _loading = false;
    _error = null;
    _status = 'idle';
    _classificationType = viewer?.scene?.globe?.show === false
      ? Cesium.ClassificationType.CESIUM_3D_TILE
      : Cesium.ClassificationType.BOTH;
    _overlayHost.setVisible(DELINQUANCE_FR_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(DELINQUANCE_FR_LABEL_SOURCE_ID, false);
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    if (_depDataSource) _depDataSource.show = true;
    // Which level is shown is the swap's call, made per frame — and nothing
    // else here is: arrivals are instant, so the handle only paces the swap
    // and publishes what is drawn for the harness.
    _fade = watchZoomFade(viewer, DELINQUANCE_FR_LAYER_ID, onLevelFrame, { arrivalMs: 0 });
    _overlayHost.setVisible(DELINQUANCE_FR_OVERLAY_SOURCE_ID, true);
    _overlayHost.setVisible(DELINQUANCE_FR_LABEL_SOURCE_ID, true);
    installClickHandler(viewer);
    registerPickOwner(DELINQUANCE_FR_LAYER_ID, (pickedId) => _communeRecords.has(pickedId));
    if (!_cameraChangedAttached) {
      viewer.camera.changed.addEventListener(onCameraChanged);
      claimCameraSensitivity(viewer, DELINQUANCE_FR_LAYER_ID);
      // Arrival, as opposed to motion — see `onCameraSettled`.
      watchCameraSettle(viewer, DELINQUANCE_FR_LAYER_ID, onCameraSettled);
      _cameraChangedAttached = true;
    }
    void loadViewport({ force: true });
  },

  disable(viewer) {
    _enabled = false;
    _fade?.release();
    _fade = null;
    clearTimeout(_cameraDebounceTimer);
    _cameraDebounceTimer = null;
    clearSelection();
    clearCommunePrimitives();
    hideDepartements();
    if (_depDataSource) _depDataSource.show = false;
    _overlayHost.setVisible(DELINQUANCE_FR_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(DELINQUANCE_FR_LABEL_SOURCE_ID, false);
    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
    document.removeEventListener('keydown', onKeyDown);
    unregisterPickOwner(DELINQUANCE_FR_LAYER_ID);
    if (_cameraChangedAttached) {
      viewer.camera.changed.removeEventListener(onCameraChanged);
      releaseCameraSensitivity(viewer, DELINQUANCE_FR_LAYER_ID);
      releaseCameraSettle(viewer, DELINQUANCE_FR_LAYER_ID);
      _cameraChangedAttached = false;
    }
    _loading = false;
    _status = 'idle';
  },

  async update() {
    if (!_enabled) return;
    await loadViewport({ force: true });
  },

  /**
   * Chips select the indicator. They are NOT serialized into the share link —
   * the layer is registered `enabled-only` — so a shared view always opens on
   * the computed total rather than on a silently different crime.
   */
  setParams(params = {}) {
    // `méthodo` is copy-only: it repaints the open card and nothing else. It
    // is handled BEFORE the indicator so the two can travel together. An
    // unrecognised value leaves the register alone rather than falling back to
    // one — the compact card is a default, not a fallback.
    const methodo = readMethodo(params?.methodo);
    if (methodo !== null && methodo !== _methodo) {
      _methodo = methodo;
      refreshSelection();
    }
    const next = String(params?.indicator || '').trim();
    if (!next || next === _indicator) return;
    if (!DELINQUANCE_COMMUNE_CELL_SLUGS.includes(next)) return;
    _indicator = next;
    clearSelection();
    void loadViewport({ force: true });
  },

  getParams() {
    return { indicator: _indicator, year: _year, methodo: _methodo ? 'on' : 'off' };
  },

  getStats() {
    const stats = {
      count: _count,
      lastUpdate: _lastUpdate,
      loading: _loading,
      status: _status,
    };
    const label = buildDelinquanceLoadingLabel();
    if (label) stats.loadingLabel = label;
    if (_base?.stale) stats.stale = true;
    if (_error) stats.error = _error;
    return stats;
  },

  /** National provenance, for the analyst and the attribution popover. */
  getNationalSummary() {
    if (!_base) return null;
    return {
      source: DELINQUANCE_SOURCE,
      attribution: DELINQUANCE_ATTRIBUTION,
      edition: _base.edition,
      year: _year,
      years: _base.years,
      indicator: _indicator,
      regime: _regime,
      communeCensus: _base.census?.[_indicator] || null,
      communes: _base.communes || null,
      offshore: _national?.offshore || [],
      painted: _national?.painted || 0,
      visibleDepartements: _visibleDeps,
    };
  },

  /**
   * Chips for the indicator, and the legend for whichever scale is on screen.
   *
   * The legend ALWAYS carries the three states, even at département grain
   * where the third never lights up: a legend whose meaning changes between
   * zoom levels is worse than a row that reads zero. The suppressed row's
   * count is the national one from the commune fold, so the number a reader
   * sees at national zoom is the number they will meet when they zoom in.
   *
   * The LAST chip is not an indicator: it is `méthodo`, and it is what makes
   * the compact card defensible. Cards state each rule's claim in one line;
   * this chip replaces those lines with the SSMSI's own sentences, on the card
   * the reader already has open. It sits last so switching register never
   * moves an indicator chip out from under a cursor.
   */
  getRowControls() {
    if (!_base) return { chips: [], legend: [] };
    // The total leads the row, because it is the state the layer opens in and
    // because the alternative — a reader who must choose an offence before
    // seeing any map — is the thing it exists to remove.
    const m = messages();
    const chipSlugs = [DELINQUANCE_TOTAL_SLUG, ...(_base.chips || [])];
    const chips = chipSlugs.map((slug) => ({
      id: slug,
      label: delinquanceIndicatorShort(slug),
      active: slug === _indicator,
      state: slug === _indicator ? 'active' : 'idle',
      title: slug === DELINQUANCE_TOTAL_SLUG
        ? m.chips.totalTitle(DELINQUANCE_TOTAL_COMMUNE_SLUGS.length)
        : m.chips.indicatorTitle(
          delinquanceIndicatorLabel(slug),
          delinquanceUnitLabel(slug) || m.noValue,
        ),
      params: { indicator: slug },
    }));
    chips.push({
      id: METHODO_CHIP_ID,
      label: m.chips.methodoLabel,
      active: _methodo,
      state: _methodo ? 'active' : 'idle',
      title: _methodo ? m.chips.methodoOn : m.chips.methodoOff,
      params: { methodo: _methodo ? 'off' : 'on' },
    });

    const legend = [];
    const blurbs = _indicator === DELINQUANCE_TOTAL_SLUG ? totalStateBlurbs() : stateBlurbs();
    if (_regime === 'departements' && _national) {
      const labels = delinquanceBinLabels(_national.thresholds, _indicator);
      const counts = new Array(labels.length).fill(0);
      for (const row of _national.departements || []) {
        if (row.bin >= 0 && row.bin < counts.length) counts[row.bin] += 1;
      }
      labels.forEach((label, bin) => {
        if (!counts[bin]) return;
        legend.push({
          label,
          color: DELINQUANCE_RAMP[bin],
          count: counts[bin],
          blurb: blurbs.published,
        });
      });
      if (_national.zeroed > 0) {
        legend.push({
          label: DELINQUANCE_CELL_LABELS.zero,
          color: DELINQUANCE_ZERO_COLOR,
          count: _national.zeroed,
          blurb: blurbs.zero,
        });
      }
    } else {
      const packs = _visibleDeps.map((dep) => _packs.get(dep)).filter(Boolean);
      const { states } = buildDelinquanceCommuneRecords({ packs, indicator: _indicator });
      if (states.published) {
        legend.push({
          label: _indicator === DELINQUANCE_TOTAL_SLUG
            ? m.legend.totalPublished
            : m.legend.published(delinquanceRateUnit(_indicator)),
          color: DELINQUANCE_RAMP[DELINQUANCE_RAMP.length - 2],
          count: states.published,
          blurb: blurbs.published,
        });
      }
      if (states.zero) {
        legend.push({
          label: DELINQUANCE_CELL_LABELS.zero,
          color: DELINQUANCE_ZERO_COLOR,
          count: states.zero,
          blurb: blurbs.zero,
        });
      }
      if (states.suppressed) {
        legend.push({
          label: DELINQUANCE_CELL_LABELS.suppressed,
          color: DELINQUANCE_SUPPRESSED_COLOR,
          count: states.suppressed,
          blurb: blurbs.suppressed,
        });
      }
      // The fourth cell state. `buildDelinquanceCommuneRecords` has always
      // counted it and `delinquanceFill` has always painted it; it simply never
      // reached the key, so the one state meaning "we have nothing here" was
      // the only one a reader could not name.
      if (states.missing) {
        legend.push({
          label: DELINQUANCE_CELL_LABELS.missing,
          color: DELINQUANCE_MISSING_COLOR,
          count: states.missing,
          // Always the register's own sentence, even under the computed
          // total: "we have nothing here" means the same thing either way,
          // and `totalStateBlurbs()` has no fourth entry by construction.
          blurb: stateBlurbs().missing,
        });
      }
    }
    // The national suppression count travels with the legend at every zoom:
    // it is the single number this layer exists to put in front of a reader.
    const national = _base.census?.[_indicator];
    if (national && !legend.some((row) => row.label === DELINQUANCE_CELL_LABELS.suppressed)) {
      legend.push({
        label: m.legend.nationalSuppressed(DELINQUANCE_CELL_LABELS.suppressed),
        color: DELINQUANCE_SUPPRESSED_COLOR,
        count: national[CELL_SUPPRESSED] || 0,
        blurb: blurbs.suppressed,
      });
    }
    // Ground-classified area fill — see surfaceFillNotice.js.
    return { chips, legend, surfaceFill: true };
  },

  destroy(viewer) {
    if (_enabled) this.disable(viewer);
    else {
      clearSelection();
      if (_clickHandler) {
        _clickHandler.destroy();
        _clickHandler = null;
      }
      document.removeEventListener('keydown', onKeyDown);
      unregisterPickOwner(DELINQUANCE_FR_LAYER_ID);
    }
    clearCommunePrimitives();
    if (_depDataSource) {
      viewer?.dataSources?.remove?.(_depDataSource, true);
      _depDataSource = null;
    }
    _depEntities.clear();
    _depMaterials.clear();
    _depPaintedCodes = new Set();
    _depPainted = false;
    _depShown = false;
    _depMeta = new Map();
    _depIndex = null;
    _depShapesPromise = null;
    _packs = new Map();
    _packPromises = new Map();
    _packErrors = new Map();
    _viewer = null;
  },
};

// --- Test seams -------------------------------------------------------------

/** Seed the layer's state so cards, legends and selection run without WebGL. */
export function _setDelinquanceStateForTest({
  viewer, overlayHost, base, national, packs, communeRecords, depMeta, depIndex,
  indicator, year, regime, status, count, visibleDeps, methodo = false,
} = {}) {
  _methodo = methodo === true;
  _viewer = viewer || null;
  _overlayHost = overlayHost || DEFAULT_OVERLAY_HOST;
  _base = base || null;
  _national = national || null;
  _packs = new Map(packs || []);
  _communeRecords = new Map((communeRecords || []).map((record) => [record.id, record]));
  _depMeta = new Map(depMeta || []);
  _depIndex = depIndex || null;
  _indicator = indicator || _indicator;
  _year = year || _year;
  _regime = regime || 'departements';
  _status = status || 'ok';
  _count = Number.isFinite(count) ? count : _communeRecords.size;
  _visibleDeps = visibleDeps || [];
  _loading = false;
  _enabled = true;
}

/** Exercise the production département selection path. */
export function _selectDelinquanceDepartementForTest(code) {
  selectDepartement(code);
}

/** Exercise the production commune selection path. */
export function _selectDelinquanceCommuneForTest(id) {
  selectCommune(id);
}

/** Exercise the production clear path and restore the production host seam. */
export function _clearDelinquanceSelectionForTest() {
  clearSelection();
  _methodo = false;
  _overlayHost = DEFAULT_OVERLAY_HOST;
  // Back to the indicator a fresh boot opens on, so one test's chip choice
  // cannot become the next test's default.
  _indicator = DELINQUANCE_TOTAL_SLUG;
  _base = null;
  _national = null;
  _packs = new Map();
  _communeRecords = new Map();
  _depMeta = new Map();
  _depIndex = null;
  _regime = 'departements';
  _visibleDeps = [];
  _enabled = false;
  _pendingCommunes = null;
  _fills = null;
  _outlines = null;
  _suppressedOutlines = null;
  _communesShown = false;
  _communeLevelDrawn = false;
  _depEntities = new Map();
  _depPaintedCodes = new Set();
  _depPainted = false;
  _depShown = false;
}

/**
 * Seed the two levels as the swap sees them, with stand-ins for the Cesium
 * objects: entities are `{show}`, primitives `{ready, show}`. The production
 * frame callback then runs against them through {@link _delinquanceLevelFrameForTest}.
 */
export function _setDelinquanceLevelsForTest({
  viewer, regime = 'departements', depEntities = [], depPaintedCodes = null,
  depPainted = false, depShown = false, current = null, pending = null, communeLevelDrawn = null,
} = {}) {
  _viewer = viewer || null;
  _enabled = true;
  _regime = regime;
  _depEntities = new Map(depEntities);
  _depPaintedCodes = new Set(depPaintedCodes || _depEntities.keys());
  _depPainted = depPainted;
  _depShown = depShown;
  _fills = current?.fills || null;
  _outlines = current?.outlines || null;
  _suppressedOutlines = current?.suppressedOutlines || null;
  _communeRecords = current?.records || new Map();
  _communesShown = Boolean(current?.fills?.show);
  _communeLevelDrawn = communeLevelDrawn ?? Boolean(current);
  _pendingCommunes = pending
    ? { fills: null, outlines: null, suppressedOutlines: null, records: new Map(), ...pending }
    : null;
}

/** One production frame of the level swap; returns what it decided. */
export function _delinquanceLevelFrameForTest() {
  onLevelFrame();
  return {
    departementsShown: _depShown,
    communesShown: _communesShown,
    communeLevelDrawn: _communeLevelDrawn,
    fills: _fills,
    pending: _pendingCommunes,
  };
}

/** Row controls, for tests that do not construct a viewer. */
export function _delinquanceRowControlsForTest() {
  return delinquanceFranceLayer.getRowControls();
}

/** Ambient département label cohort, for tests that do not construct a viewer. */
export function _delinquanceDepartementOverlayForTest() {
  const entries = [];
  for (const row of _national?.departements || []) {
    if (row.state !== CELL_PUBLISHED) continue;
    const anchor = _depMeta.get(row.code)?.anchor;
    if (!anchor) continue;
    entries.push(createDelinquanceDepartementOverlayEntry(row, { anchor }));
  }
  return selectDelinquanceLabelCohort(entries);
}

export default delinquanceFranceLayer;
