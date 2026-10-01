import * as Cesium from 'cesium';
import {
  DPE_GRID_M,
  DPE_LABELS,
  DPE_PARCEL_SNAP_M,
  DPE_POOR_SHARE_NATIONAL,
  DPE_SECTION_MIN_GRADED,
} from './dpeFeed.js';
import { addressMarkerGlyph, dpeLetterKind } from './addressMarkerIcons.js';
import {
  ADDRESS_SCAN_MIN_SHIFT_KM, cameraScanPoint, createAddressScanLayer, mapKeyCarriesSelection,
} from './addressScanLayer.js';
import { drawScanBoundary } from './scanBoundary.js';
import {
  SCAN_BANDS, SCAN_CELL_MIN_ALTITUDE_M, scanBandFor, scanCellParams, scanTileMask, scanTileMaskParam,
} from './scanRegime.js';
import { cameraViewBox } from './viewGate.js';
import { bdtopoLoadedFootprints } from './bdtopoBuildings.js';
import { createScanAreaLevels } from './scanAreaFade.js';
import { drawGroundHighlight } from './groundHighlight.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import {
  clearBuildingTheme,
  joinPointsToBuildings,
  registerBuildingTheme,
} from './buildingTheme.js';
import {
  dpeBuildingSummary,
  dpeGradeOf,
  dpeSitePlacementLine,
  dpeSummaryFromCounts,
  groupDpeSites,
} from './dpeSites.js';
import { gpuClassificationTypeForScene } from './urbanismeGpu.js';
import { governorRequestRender } from '../renderGovernor.js';
import { formatDate, formatDecimal, formatNumber } from '../i18n/format.js';
import messages from './dpeFrance.i18n.js';

/**
 * ADEME DPE — the energy label of this building, and of every one around it.
 *
 * A diagnostic is compulsory for any French sale, so the register is close to a
 * census of what has changed hands since July 2021 — 15,476,290 rows, geocoded
 * against the BAN. A listing shows one letter. This shows the street's.
 *
 * THE COLOURS ARE THE OFFICIAL ONES. A to G on the state's own DPE scale, dark
 * green through dark red. Inventing a palette here would make the layer
 * unreadable to the only people who already know what the letters mean.
 *
 * NO NEIGHBOURHOOD GRADE. The distribution is reported; the mean is not. A DPE
 * describes one dwelling's envelope and boiler, and the average of a street's
 * letters is not a property of the street.
 *
 * ── WHERE THE PROPERTY IS — one badge per site, on its own building ─────────
 *
 * Reported 2026-09-14: «les points bougent en même temps que je bouge la carte»
 * and «on ne comprend pas exactement où est situé le bien qui a ce DPE». Both
 * had the same cause, and it was not the seating.
 *
 * A default scan of Paris 13e serves 200 diagnostics carrying **14 distinct
 * coordinates**, 13 addresses and 5 RNB identifiers. One coordinate carried
 * **42 badges**. Only the topmost of each pile was ever visible or clickable,
 * the card a click opened was a lottery between forty-two flats, and the point
 * on screen was a BAN geocode — a point on a street, not a building. That is
 * the second complaint, exactly.
 *
 * It caused the first one too. `renderedSurface.js` lifts a mark onto the drawn
 * surface under a budget of 24 probes per pass over six passes, so 200 marks
 * never fit; dozens stayed on the scan-centre fallback height, and a mark at
 * the wrong height under a camera that is not overhead SLIDES when the camera
 * turns. Measured on the live app, 1400 × 900, nadir at 420 m, before and
 * after:
 *
 *                       badges   height error   screen offset   slide / 250 m pan
 *     before               200        25.2 m         25.5 px        **72.6 px**
 *     after                 10         0.0 m          0.0 px           0.0 px
 *
 * So the diagnostics are GROUPED — by building where the register names one, by
 * BAN address otherwise (`dpeSites.js` carries the rule and its one refusal) —
 * and each site draws three things instead of forty-two:
 *
 *   1. **the building's footprint**, washed in the site's own letter and
 *      outlined, clamped to whichever surface is being drawn. On the photoreal
 *      stack the classification climbs the facades, so the answer to «où est le
 *      bien» is a whole building lit in its own colour, with `Bâti 3D` off and
 *      nothing else switched on;
 *   2. **the parcel it stands on**, as a dashed achromatic line and never a
 *      wash — see `PARCEL_LINE_CSS` for why the colour channel cannot be spent
 *      twice;
 *   3. **one badge**, standing inside its own outline rather than on the street.
 *
 * The shapes come from the `/api/dpe` proxy, which resolves them from the RNB
 * (the register's own `id_rnb`, else the building under the BAN point) and the
 * cadastre box the `cadastre-fr` proxy already caches. Neither can withhold the
 * diagnostics: a site with no shape keeps its badge and its card, and the row
 * prints how many of the addresses got an outline.
 *
 * ── The volumes carry the letter now (representation audit, track 1, #78) ───
 *
 * `bdtopoBuildings.js` extrudes the BD TOPO footprints of the viewport, and
 * until now this layer drew a badge floating ABOVE the roof it was talking
 * about. It publishes a theme to `buildingTheme.js` instead: the volume takes
 * the diagnostic's own colour, and the badge stays as the handle and the card.
 * The badge is a SUPPLEMENT, never a replacement — with `Bâti 3D` switched off
 * nothing about this layer changes, byte for byte.
 *
 * • **Precedence 10** — ahead of the two other themes this seam is built for
 *   (€/m², permit state). Not because energy matters more, but because this is
 *   the densest register of the three (15.4 M rows against 4.4 M mutations) and
 *   the only one that grades the BUILDING rather than a transaction on it.
 *
 * • **The reduce rule is the MODE, and the mode is never invented.** Several
 *   diagnostics on one building is the normal case, not the edge case: a block
 *   of flats produces one per sale. The letter painted is the one held by the
 *   most diagnostics on that footprint — an observed value, present in the
 *   data, unlike a mean of letters, which would be an ordinal average of an
 *   ordinal scale whose classes are not evenly spaced (measured on the palette
 *   below: 21.1 to 53.1 ΔE76 between adjacent classes, a factor 2.5). The mode
 *   is also the one summary that survives the shape of the register: the
 *   envelope and the heating plant are SHARED by the whole building, so the
 *   letters of its flats genuinely cluster, and the cluster is the building.
 *
 *   Ties go to the WORSE letter — three C and three E paints E. A tie is a
 *   building the rule cannot summarise, and of the two readings the pessimistic
 *   one is the one that cannot mislead a reader into thinking a *passoire* is
 *   not there. It is also deterministic: the seven letters are distinct, so the
 *   answer never depends on the order the register returned its rows in.
 *
 *   Two rules that were considered and refused. **The most recent** diagnostic
 *   is a property of one flat that happened to sell last, not of the building.
 *   **The worst** turns one bad studio out of forty into a G on a whole block —
 *   the exact overstatement A1 exists to forbid, in the other direction.
 *
 * • **The diagnostic names its building, and that is how it reaches a volume.**
 *   Since 2026-09-07 the projection reads `id_rnb`, and `buildingTheme.js`
 *   joins on it before it looks at any coordinate. The BAN geocode was never a
 *   claim about a BUILDING: it is a point on a street, and it lands in the road
 *   or on a neighbour often enough to matter. Measured over four boxes, the
 *   share of diagnostics that reach a drawn volume goes from 81.8 % to 96.3 %
 *   in Paris 13e and from 40.4 % to 75.7 % in Lyon 2e, and 2 to 83 rows per box
 *   were being painted on the wrong roof. `rnbPivot.js` carries the reasoning;
 *   the two counts are kept apart on the row, because a colour decided by a key
 *   and a colour decided by a dot are not the same claim.
 *
 *   34.5 % to 73.7 % of the rows carry the key depending on the commune, so the
 *   geometric join is not gone — it is the fallback, and it is counted as one.
 *
 * • **What the mode cannot see, stated.** The register publishes `numero_dpe`
 *   (per diagnostic) and `identifiant_ban` (per ADDRESS), and no dwelling key
 *   at all. A flat re-diagnosed in 2021 and again in 2024 therefore votes
 *   twice. De-duplicating on `(identifiant_ban, surface_habitable_logement)`
 *   was tried on paper and refused: in a French apartment block the same floor
 *   plan is stacked storey after storey, so identical surfaces at one address
 *   are the NORMAL case and that key would collapse a whole column of flats
 *   into a single vote. A double vote is a smaller error than a deleted one.
 *
 * • **A site whose diagnostics disagree must not look homogeneous.** A badge
 *   goes QUIET (14 px instead of 22) when the volume under it already says its
 *   own letter, and keeps its full size otherwise. One rule, one meaning (A3):
 *   the size of a badge is how much of it is NOT already said by the volume.
 *   The two can genuinely differ, and the case is not hypothetical — a site is
 *   the set of diagnostics that agree about their ADDRESS, while the theme
 *   buckets by FOOTPRINT, so a courtyard building whose BAN geocode lands on
 *   the street building in front of it paints that footprint with letters no
 *   badge on it claims. A site with no published letter never agrees with
 *   anything, so it keeps its full 18 px — it is the one thing the paint cannot
 *   express. The card states the range in words on top of that.
 *
 * • **The palette is safe against "not measured", and fails the greyscale
 *   test.** Measured over the six BD TOPO usage hues, each washed by
 *   `unknownBuildingCss` and then darkened across the layer's whole height
 *   range: the closest any DPE class comes to any unjoined volume is ΔE76
 *   **58.5** (A `#319834` against a washed `Agricole`), against the 25 the seam
 *   asks for and the 2.3 of a just-noticeable difference. Nothing here can be
 *   read as an absence.
 *
 *   The honest half: converted to grey the official ramp is a HUMP, not a
 *   ladder — L* 55.4, 72.3, 92.8, 96.6, 83.8, 72.1, 52.7 for A to G. B and F
 *   land 0.2 L* apart and A and G 2.7 apart. The B4 test ("convert the ramp to
 *   greyscale, does the order survive?") fails, and it fails for the official
 *   French palette, not for ours. B4's own carve-out is why it is kept: a
 *   strong cultural code outranks Bertinian purity. What it costs is written
 *   down here — under a sensor pass, or for a deuteranope, the PAINTED VOLUME
 *   stops being readable while the BADGE, which draws the letter as a shape,
 *   does not. That is the second reason the badges stay.
 *
 * • **The scan is 200 m wide and the city is 9 km wide (A5, H1).** This layer
 *   asks the ADEME for the 200 nearest diagnostics within 200 m of the point
 *   the camera is looking at; the volumes on screen can span `BDTOPO_MAX_BOX_DEG`
 *   (0.08°, ~9 km). So the unpainted volumes are two different things at once —
 *   never diagnosed, and never asked about — and the theme's "no data" row says
 *   exactly that: *sans DPE dans le rayon scanné*. The row's coverage line
 *   carries the numbers that go with it: diagnostics served over diagnostics
 *   known within the radius (2,805 within 300 m of one Paris 13e point, so the
 *   200-row page is a truncation and says so), then volumes painted over
 *   volumes loaded.
 *
 * • **A theme with nothing to paint does not take the city's colours away.**
 *   When the scan comes back with no published letter at all — a rural point,
 *   or a camera above the scan ceiling — the theme is WITHDRAWN rather than
 *   registered empty. A grey city under an all-zero legend reads as a broken
 *   layer, and the wash only means anything as a contrast to a measurement that
 *   exists somewhere on screen.
 *
 * ── Why the join is run twice, and what it costs ────────────────────────────
 *
 * The seam runs its own join inside `bdtopoBuildings.js` to decide the colours.
 * This module runs a SECOND one, over `bdtopoLoadedFootprints()`, because the
 * badge and its card are drawn here and neither the badge size nor the card's
 * "immeuble : 12 DPE, de B à F" line can be written without knowing which
 * footprint a diagnostic landed on. Measured on this machine, best of nine,
 * with the ring copy included:
 *
 *     3 000 volumes × 200 diagnostics    0.6 ms copy + 0.9 ms join
 *     14 000 volumes (the cap) × 200     1.8 ms copy + 8.6 ms join
 *
 * — on a path already debounced 450 ms behind the camera settling, against the
 * 2 to 10 dropped frames the naive nested loop cost the seam. Both joins run
 * the same pure `dpeBuildingSummary()` over the same points, so they cannot
 * disagree about a building they both see.
 *
 * `registerBuildingTheme()` is not followed by an `applyBuildingTheme()` call
 * and the BD TOPO layer is not asked to repaint. Registering ALREADY notifies
 * it — it subscribes in its own `init()` — and the second call would be a
 * second full repaint of the batch per scan. In the one case where the
 * subscription does not exist yet, `Bâti 3D` never having been switched on, the
 * manager initialises layers lazily and an explicit call would find no records
 * either; the volumes are painted a moment later by the layer's own first
 * `drawRecords()`, which resolves the active theme before its first colour.
 *
 * The traffic runs the other way too — the volume layer reloads its tiles on
 * its own, without telling anyone — so this module treats a call to its own
 * `reduce()` as the signal that the city was repainted, and re-syncs the badges
 * on the microtask after it. That is the only notification the seam offers, and
 * it is what makes the badges quieten down when `Bâti 3D` comes on after this
 * layer, with no rescan and no request.
 *
 * @module data/dpeFrance
 */

const UPDATE_INTERVAL_MS = 600_000;
const SCAN_RADIUS_M = 200;
const SCAN_LIMIT = 200;

/**
 * Marker size, in CSS px. A letter needs more pixels than a dot did — 20 was
 * where A, B and G stopped trading places at a glance on the proof sheet, and
 * the filled plate (2026-09-21) takes 22 so its letter reads at the cap height
 * a sale listing prints it at. A diagnostic with no published grade draws
 * smaller: it is a marker that something exists here, not a grade.
 */
const SIZE_LABELLED_PX = 22;
const SIZE_UNLABELLED_PX = 18;

/**
 * A badge whose volume already says its letter.
 *
 * Not hidden: it is still the click target and the only way to the card, and a
 * volume carries ONE letter while a block carries many diagnostics. 12 px is
 * above the 10 px this repo draws its smallest markers at (`datacentersPack`),
 * and a selection grows it back to 20 px, so the handle never gets smaller than
 * what is already shipped elsewhere.
 */
const SIZE_QUIET_PX = 14;

/** The official DPE scale, A (best) to G (worst). */
export const DPE_COLORS = Object.freeze({
  A: '#319834',
  B: '#33cc31',
  C: '#cbfc34',
  D: '#fbfe06',
  E: '#fbcc05',
  F: '#fc9935',
  G: '#fc0205',
});
const COLOR_UNLABELLED_CSS = '#7c8aa0';
const COLOR_UNLABELLED = Cesium.Color.fromCssColorString(COLOR_UNLABELLED_CSS);

/** The theme id published to the building registry — the layer's own id. */
export const DPE_THEME_ID = 'dpe-fr';

/**
 * Lowest of the three themes the seam is built for, so DPE paints when two are
 * on. See the header for why it wins rather than €/m².
 */
export const DPE_THEME_PRECEDENCE = 10;

/**
 * The energy axis of the 2021 classes, in kWh/m²/an of primary energy.
 *
 * The published class is the WORSE of two axes — energy and greenhouse gas —
 * so these bounds explain a class without predicting it, which is why the
 * blurbs say so. Arrêté du 31 mars 2021.
 */
const gradeEnergy = (letter) => messages().energy[letter];

/**
 * The layer's name, which the registry batch owns; the THEME label beside it
 * is read from the catalog when the theme is published, so the Bâti 3D row
 * says the same thing in whichever language the page is in.
 */
// i18n-ignore-next-line — registry field, not copy: see src/data/layerTaxonomy.i18n.js.
const THEME_LABEL = 'Performance énergétique (DPE)';

/**
 * What an unpainted volume means here, in the theme's own words.
 *
 * Two causes in one phrase on purpose: a building inside the scanned disc with
 * no diagnostic, and a building the scan never reached, are both true readings
 * of it. Separating them would need a second wash colour, which A1 spends on
 * "measured / not measured" and cannot spend twice.
 */
const themeUnknownLabel = () => messages().theme.unknown;

/**
 * Colour one diagnostic by its published label.
 * @param {string|null} label
 * @returns {object} Cesium colour.
 */
export function dpeColor(label) {
  const css = DPE_COLORS[label];
  return css ? Cesium.Color.fromCssColorString(css) : COLOR_UNLABELLED;
}

/**
 * The reduce rule, and the letter test, live in `dpeSites.js`.
 *
 * Re-exported under the name the theme, the tests and the sibling modules
 * already read, because MOVING the rule is not the same as changing it: the
 * grouping needs it before any Cesium module is loaded (the `/api/dpe` proxy
 * calls it in Node), and two copies of "what letter does this building hold"
 * is the one thing this layer cannot afford.
 */
export { dpeBuildingSummary } from './dpeSites.js';

/**
 * How big a site's badge is drawn, given what the volume under it already says.
 *
 * @param {?string} letter The site's own letter — the mode of its diagnostics —
 *   or null when none of them published one.
 * @param {?string} paintedGrade The letter painted on its building by the BD
 *   TOPO theme, or null when no volume is painted for it: `Bâti 3D` off,
 *   footprint not loaded, or a building the theme declined to grade.
 * @returns {number} CSS px.
 */
export function dpeMarkerSizePx(letter, paintedGrade = null) {
  if (!letter || !DPE_LABELS.includes(letter)) return SIZE_UNLABELLED_PX;
  return paintedGrade === letter ? SIZE_QUIET_PX : SIZE_LABELLED_PX;
}

/** `14 DPE` / `14 ratings` — how many diagnostics stand behind a mark. */
function ratings(n) {
  return messages().ratings(Number(n || 0));
}

/** The letters a site holds, as a phrase: `tous C`, `de B à F`. */
function spreadPhrase(summary) {
  const m = messages().site;
  if (!summary?.graded) return m.spreadNone;
  if (summary.mixed) return m.spreadMixed(summary.best, summary.worst, summary.grade);
  return m.spreadAll(summary.grade);
}

/** The card's title: the address, and how many diagnostics stand behind it. */
export function dpeSiteTitle(site) {
  const m = messages().site;
  const where = site?.address || m.noAddress;
  const n = site?.summary?.total ?? site?.points?.length ?? 0;
  return n > 1 ? m.title(where, ratings(n)) : where;
}

/**
 * The card of one SITE, as the ` · `-separated string the scan shell splits
 * into card lines.
 *
 * ── Why this card stopped being one diagnostic's ────────────────────────────
 *
 * It used to print `Énergie D · 28,6 m² · 639 €/an · diagnostic du 22/05/2023`
 * — one flat, picked by whichever of the forty-two billboards stacked on that
 * coordinate the click happened to land on. The other forty-one were drawn at
 * the same pixel and said something else. There was no way for a reader to know
 * which flat they had opened, and no way to ask for a different one.
 *
 * So the card answers for the BUILDING, which is the thing the outline under it
 * draws and the thing a reader can point at. The lines, in the order a reader
 * needs them:
 *
 *   1. the spread — `14 DPE, de C à G, majorité E`. The distribution IS the
 *      answer for a block; a single letter for forty-two flats would be the
 *      neighbourhood grade this layer has always refused to invent.
 *   2. how many are *passoires* (F or G), because that is the one cut of this
 *      register with a legal consequence attached to it.
 *   3. the median annual cost across the site's own diagnostics — a median, not
 *      a mean, and only when at least one row published one.
 *   4. the parcel, with the fiscal contenance beside the measured area.
 *   5. HOW THE SITE WAS PLACED, always, in `dpeSites.js`'s own words. A
 *      building the register named and a building found under a street geocode
 *      are drawn identically and are not the same claim.
 *   6. the BD TOPO line, when `Bâti 3D` is on and the volume disagrees.
 *
 * @param {object} site One entry of `payload.sites`.
 * @param {?object} painted The summary of the volume painted under it, or null.
 * @param {boolean} joinRan Whether any BD TOPO footprint was loaded at all —
 *   without one, "not on a building" is a statement about `Bâti 3D`, not about
 *   the DPE.
 * @returns {string}
 */
export function dpeSiteCardDescription(site, painted = null, joinRan = false) {
  const m = messages().site;
  const summary = site?.summary || dpeBuildingSummary(site?.points);
  const costs = (site?.points || [])
    .map((point) => point?.annualCostEur)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const median = costs.length ? costs[Math.floor((costs.length - 1) / 2)] : null;
  const poor = (summary.letters || []).filter((letter) => letter === 'F' || letter === 'G').length
    ? (site?.points || []).filter((point) => {
      const letter = dpeGradeOf(point);
      return letter === 'F' || letter === 'G';
    }).length
    : 0;
  const shape = site?.shape;
  const parcel = site?.parcel;
  // The volume under the badge only earns a line when it DISAGREES. When it
  // says the same letter the badge already went quiet, and repeating it in
  // words would spend one of the six lines saying nothing.
  let volume = null;
  if (painted?.grade && painted.grade !== summary.grade) {
    volume = m.volumePainted(painted.grade);
  } else if (!painted && joinRan) {
    volume = m.volumeOutside;
  }
  return [
    `${ratings(summary.total)}, ${spreadPhrase(summary)}`,
    summary.ungraded ? m.ungraded(summary.ungraded) : null,
    poor ? m.poor(poor) : null,
    median !== null ? m.cost(formatNumber(Math.round(median))) : null,
    shape?.areaM2 ? m.footprint(formatNumber(shape.areaM2)) : null,
    parcel
      ? `${m.parcel(parcel.idu)}${Number.isFinite(parcel.contenanceM2)
        ? m.parcelArea(formatNumber(parcel.contenanceM2)) : ''}`
      : null,
    dpeSitePlacementLine(site),
    volume,
    Number.isFinite(site?.distanceM) ? m.distance(site.distanceM) : null,
  ].filter(Boolean).join(' · ');
}

/**
 * The seven classes as a legend, always all seven.
 *
 * A frozen domain scale (C1): the DPE ladder is the state's, not this
 * viewport's, so a letter nobody drew is still printed at zero rather than
 * dropped. Removing D because no building on screen holds one would leave
 * A B C E F G, and a reader would decode the ramp against the wrong rungs.
 *
 * @param {Array<object>} values Building summaries the theme actually painted.
 * @returns {Array<{label: string, color: string, count: number, blurb: string}>}
 */
export function dpeThemeLegend(values) {
  const painted = new Map(DPE_LABELS.map((letter) => [letter, 0]));
  const disputed = new Map(DPE_LABELS.map((letter) => [letter, 0]));
  for (const value of values || []) {
    if (!value?.grade) continue;
    painted.set(value.grade, painted.get(value.grade) + 1);
    if (value.mixed) disputed.set(value.grade, disputed.get(value.grade) + 1);
  }
  const m = messages().legend;
  return DPE_LABELS.map((letter) => {
    const mixed = disputed.get(letter);
    return {
      label: letter,
      color: DPE_COLORS[letter],
      count: painted.get(letter),
      blurb: m.letterBlurb(gradeEnergy(letter))
        + (mixed ? m.mixed(mixed, letter) : ''),
    };
  });
}

/* ── the join this layer runs for itself ───────────────────────────────── */

/** The entities of the last draw, so a later repaint can resize its badges. */
let _dataSource = null;
/**
 * Every diagnostic of the last answer, drawable or not.
 *
 * The rows with no coordinate are kept in this list and handed to the theme,
 * because dropping them here would silently improve `unplacedPoints` — the A5
 * counter whose whole job is to say that a diagnostic exists and is painted
 * nowhere. They simply never get an entity.
 */
let _entries = [];
/**
 * The last answer's sites — one per building, address or bare coordinate.
 *
 * This is what is DRAWN: one badge, one footprint and one parcel outline each.
 * `_entries` stays beside it because the building theme reduces over raw
 * diagnostics and because every honesty counter on the row counts rows, not
 * sites.
 */
let _sites = [];
/**
 * Every site of the last answer, before the class filter — what `_sites` is
 * cut from, and what the key counts as the scan's addresses.
 */
let _allSites = [];
/** The last join: summaries by building, by point, and the honesty counters. */
let _join = null;
/** True while a badge re-sync is already queued behind a theme repaint. */
let _resyncQueued = false;
/**
 * Whether the answer changed since the theme was last published.
 *
 * The manager ticks this layer every ten minutes and the camera settles far
 * more often than that, and most of those passes find the scan centre inside
 * its 250 m threshold and refetch nothing. Re-registering an unchanged theme
 * would still notify the volume layer, which would repaint fourteen thousand
 * instances to arrive at the colours they already had.
 */
let _themeDirty = false;
/** Whether the manager has this layer switched on. */
let _enabled = false;
/** Pushed by the manager so a deferred re-sync can repaint the row. */
let _rowControlsListener = null;

/** The empty join — the shape every caller can read without a null check. */
function emptyJoin() {
  return {
    byPoint: new Map(),
    byBuilding: new Map(),
    buildings: 0,
    painted: 0,
    mixed: 0,
    matchedPoints: 0,
    // The two halves of `matchedPoints`, kept apart because they are not the
    // same claim: `matchedById` is the register naming the building, and
    // `matchedByPoint` is a geocode falling inside a polygon.
    matchedById: 0,
    matchedByPoint: 0,
    idOffScreen: 0,
    unmatchedPoints: 0,
    unplacedPoints: 0,
    ungradedPoints: 0,
  };
}

/**
 * Join the drawn diagnostics onto the volumes currently loaded.
 *
 * `bdtopoLoadedFootprints()` hands back COPIES of the rings, so nothing here
 * can reach the objects the primitive was built from. With `Bâti 3D` off it
 * returns an empty list and every counter below is honestly zero.
 *
 * @param {Array<object>} entries
 * @returns {object} see {@link emptyJoin}.
 */
function computeJoin(entries) {
  const result = emptyJoin();
  for (const entry of entries || []) {
    if (!dpeGradeOf(entry)) result.ungradedPoints += 1;
  }
  let footprints = [];
  try {
    footprints = bdtopoLoadedFootprints();
  } catch (error) {
    console.warn('[dpe-fr] building footprints unavailable:', error);
    return result;
  }
  if (!footprints.length || !entries?.length) return result;

  const join = joinPointsToBuildings(footprints, entries);
  result.buildings = join.buildings;
  result.matchedPoints = join.matchedPoints;
  result.matchedById = join.matchedById;
  result.matchedByPoint = join.matchedByPoint;
  result.idOffScreen = join.idOffScreen;
  result.unmatchedPoints = join.unmatchedPoints;
  result.unplacedPoints = join.unplacedPoints;
  for (const [buildingId, points] of join.byBuilding) {
    const summary = dpeBuildingSummary(points);
    result.byBuilding.set(buildingId, summary);
    if (summary.grade) {
      result.painted += 1;
      if (summary.mixed) result.mixed += 1;
    }
    for (const point of points) {
      if (point?.id !== undefined) result.byPoint.set(point.id, summary);
    }
  }
  return result;
}

/** Read a billboard number back off its Cesium property. */
function billboardNumber(property) {
  const value = property?.getValue?.(Cesium.JulianDate.now()) ?? property;
  return Number(value);
}

/**
 * The BD TOPO volume painted under one site, or null.
 *
 * Read off ANY of the site's diagnostics, because they all name the same
 * building: a site is exactly the set of rows that agree about which building
 * they are in, so the first one the geometric or identity join placed answers
 * for the site. Iterated rather than indexed on the first row alone — a row
 * with no coordinate reaches no footprint and would report the whole site as
 * unpainted.
 *
 * @param {object} site
 * @returns {?object} A building summary, or null.
 */
function sitePaintedSummary(site) {
  if (!_join?.byPoint.size) return null;
  for (const point of site?.points || []) {
    const summary = _join.byPoint.get(point?.id);
    if (summary) return summary;
  }
  return null;
}

/**
 * Resize the badges and rewrite their cards from the current join.
 *
 * The SELECTED badge is skipped, for the same reason the volume layer skips the
 * selected volume: the operator enlarged it themselves, and the shell holds a
 * snapshot of its size to put back on Escape. Writing over that snapshot's
 * subject would restore the wrong size.
 *
 * @param {?string} selectedId The shell's currently selected entity id.
 * @returns {number} badges changed.
 */
function applyBadges(selectedId = null) {
  if (!_dataSource) return 0;
  let changed = 0;
  for (const site of _sites) {
    const entityId = `dpe:${site.key}`;
    if (entityId === selectedId) continue;
    const entity = _dataSource.entities.getById?.(entityId);
    if (!entity?.billboard) continue;
    const painted = sitePaintedSummary(site);
    const size = dpeMarkerSizePx(site.summary?.grade ?? null, painted?.grade ?? null);
    entity.description = dpeSiteCardDescription(site, painted, Boolean(_join?.buildings));
    if (billboardNumber(entity.billboard.width) === size) continue;
    entity.billboard.width = size;
    entity.billboard.height = size;
    changed += 1;
  }
  if (changed) governorRequestRender('dpe-badges');
  return changed;
}

/**
 * Re-run the join and the badges on the microtask after a theme repaint.
 *
 * The volume layer repaints on its own schedule — a tile load, a camera settle,
 * another theme being withdrawn — and publishes no event for it. The one signal
 * that reaches this module is its own `reduce()` being called, which happens
 * once per building inside that repaint; a single deferred pass therefore
 * coalesces the whole batch into one join. It is also what makes turning
 * `Bâti 3D` ON after this layer work: the badges quieten down without a rescan.
 */
function queueBadgeResync() {
  if (_resyncQueued) return;
  _resyncQueued = true;
  queueMicrotask(() => {
    _resyncQueued = false;
    if (!_enabled || !_dataSource) return;
    _join = computeJoin(_entries);
    applyBadges(dpeScanLayer.getStats().selectedId);
    _rowControlsListener?.();
  });
}

/* ── the theme ─────────────────────────────────────────────────────────── */

/**
 * Publish, or withdraw, the building theme.
 *
 * Withdrawn rather than registered empty when nothing on screen carries a
 * letter: see the header. Re-registering the same id keeps the theme's place in
 * the precedence queue and notifies the volume layer, which is the whole repaint
 * path — no call into `bdtopoBuildings.js` is needed and none is made.
 *
 * @returns {boolean} whether a theme is now registered.
 */
function publishTheme() {
  const graded = _entries.some((entry) => dpeGradeOf(entry));
  if (!_enabled || !graded) {
    _themeDirty = false;
    clearBuildingTheme(DPE_THEME_ID);
    return false;
  }
  _themeDirty = false;
  registerBuildingTheme({
    id: DPE_THEME_ID,
    label: messages().theme.label,
    precedence: DPE_THEME_PRECEDENCE,
    unknownLabel: themeUnknownLabel(),
    // Every diagnostic, not only the graded ones: an ungraded diagnostic still
    // lands on a building, still counts as matched, and is still one of the
    // reasons a volume can be painted a letter that a badge on its roof
    // disagrees with. Dropping them here would silently improve the A5 counts.
    points: _entries,
    reduce(points) {
      // The signal the seam does not otherwise give: being asked to reduce
      // means the batch is being repainted right now.
      queueBadgeResync();
      const summary = dpeBuildingSummary(points);
      return summary.grade ? summary : null;
    },
    colorFor: (value) => DPE_COLORS[value?.grade] || null,
    legend: DPE_LABELS.map((letter) => ({ label: letter, color: DPE_COLORS[letter] })),
    legendFor: dpeThemeLegend,
  });
  return true;
}

/** Withdraw the theme and let the volumes go back to their usage colours. */
function withdrawTheme() {
  clearBuildingTheme(DPE_THEME_ID);
}

/* ── the row, and the stats ────────────────────────────────────────────── */

/**
 * The key's block in the building regime: the seven classes as a filter, the
 * diagnostics loaded per class, and one line on what the scan reached.
 *
 * ── Redrawn on 2026-09-21 ───────────────────────────────────────────────────
 *
 * The block printed seven letters each under the same two-line sentence — the
 * energy bounds, then "the published class is the worse of the two axes" seven
 * times — and a reader had to scroll the key to reach the eighth row. The rule
 * is now said ONCE, above the classes (`legendNote`); the bounds stay on each
 * letter as its tooltip; and the counts sit two to a line.
 *
 * THE LETTERS ARE THE FILTER. The seven plates above the counts are the key's
 * segmented control: a press shows only that class, the next presses add or
 * remove one (see {@link dpeClassFilterToggle}). A filter over diagnostics
 * already served, so it redraws without a request (`drawOnlyParams`).
 *
 * The seven letters count DIAGNOSTICS, because that is what this layer draws.
 * When the theme is painting, the `Bâti 3D` row publishes the same seven
 * colours counting VOLUMES — a different population of the same classes — and
 * the two are not merged: one legend per channel, and neither row invents a
 * count for a mark it does not draw. The counts are the whole answer, not the
 * filtered one: the dimmed plates say what is hidden, and how much.
 *
 * The eighth row is the one A1 has always been owed here: a diagnostic with no
 * published letter draws a grey badge and needs its own entry.
 *
 * @param {object} payload The answer that is actually on screen.
 * @param {Record<string, string>} [runtime] The runtime params in force.
 * @returns {object} Row controls: the key and its filter.
 */
export function dpeRowControls(payload, runtime = {}) {
  const m = messages().legend;
  const k = messages().key;
  const distribution = payload?.distribution || {};
  const filter = runtime?.classes ?? DPE_CLASS_FILTER_ALL;
  const shown = new Set(dpeClassFilterLetters(filter));
  const filtering = shown.size < DPE_LABELS.length;
  const legend = DPE_LABELS.map((letter) => ({
    label: letter,
    color: DPE_COLORS[letter],
    count: distribution[letter] || 0,
    blurb: m.letterBlurbShort(gradeEnergy(letter)),
    channel: k.loaded,
  }));
  legend.push({
    label: m.ungraded.label,
    color: COLOR_UNLABELLED_CSS,
    count: (payload?.entries || []).filter((entry) => !dpeGradeOf(entry)).length,
    blurb: m.ungraded.blurb,
    channel: k.loaded,
  });
  let title = (letter) => k.showOnly(letter, gradeEnergy(letter));
  if (filtering) title = (letter) => (shown.has(letter) ? k.hide(letter) : k.showToo(letter));
  return {
    legend,
    legendNote: k.source,
    legendColumns: 2,
    legendSegmentsLabel: k.filterLabel,
    legendSegments: DPE_LABELS.map((letter) => ({
      label: letter,
      color: DPE_COLORS[letter],
      active: shown.has(letter),
      title: title(letter),
      toggle: { param: 'classes', value: dpeClassFilterToggle(filter, letter) },
    })),
    note: dpeKeyNote(payload, filter),
    legendSelection: dpeSelectionPanel(),
  };
}

/**
 * The key's one line on what the scan reached: `200 / 1 257 diagnostics ·
 * rayon 200 m · 39 adresses`, and the filter when one is on.
 *
 * Shorter than the row's coverage line on purpose — that one keeps the
 * outlines and the volumes; this one says how far the answer goes.
 *
 * @param {object} payload
 * @param {?string} filter
 * @returns {string}
 */
export function dpeKeyNote(payload, filter = DPE_CLASS_FILTER_ALL) {
  const k = messages().key;
  const served = (payload?.entries || []).length;
  const total = payload?.total ?? null;
  const parts = [
    total !== null && total > served
      ? k.scanTruncated(formatNumber(served), formatNumber(total), SCAN_RADIUS_M)
      : k.scanWhole(ratings(served), SCAN_RADIUS_M),
  ];
  const all = Array.isArray(payload?.sites) && payload.sites.length
    ? payload.sites.length : _allSites.length;
  if (all) parts.push(k.sites(all));
  const letters = dpeClassFilterLetters(filter);
  if (letters.length < DPE_LABELS.length) {
    parts.push(k.filtered(letters.join(', '), _sites.length));
  }
  return parts.join(' · ');
}

/**
 * What this layer adds to `getStats()`.
 *
 * The A5 sentence goes in `coverage` rather than in `loadingLabel`, because the
 * manager prints coverage BEFORE the age and `loadingLabel` INSTEAD of it: the
 * boundary of the answer and the age of the answer both have to reach the row.
 *
 * @param {object} payload
 * @returns {object}
 */
export function dpeSummarize(payload) {
  if (dpeAreaUnit(payload)) return dpeAreaSummarize(payload);
  const distribution = payload?.distribution || {};
  const labelled = DPE_LABELS.reduce((sum, letter) => sum + (distribution[letter] || 0), 0);
  const poor = (distribution.F || 0) + (distribution.G || 0);
  const served = (payload?.entries || []).length;
  const total = payload?.total ?? null;
  const join = _join || emptyJoin();
  const painting = Boolean(_enabled && join.painted);
  const m = messages().coverage;
  const scan = total !== null && total > served
    ? m.truncated(formatNumber(served), formatNumber(total), SCAN_RADIUS_M)
    : m.served(ratings(served), SCAN_RADIUS_M);
  const paint = painting
    ? m.painted(join.painted, formatNumber(join.buildings))
    : '';
  // The sites, and the two things that can be true of one at once: it draws a
  // badge, and it may or may not have an outline. Printed as "8 of 10" rather
  // than as a share, because the five sites the RNB could not place are the
  // reader's cue that the ground under those badges is a street geocode.
  const coverage = payload?.siteCoverage || null;
  const sites = coverage?.sites ?? _sites.length;
  const outlined = coverage?.outlined ?? _sites.filter((site) => site?.shape).length;
  const ground = sites ? m.sites(sites, outlined) : '';
  return {
    // "2,805 diagnostics within 300 m" against "here are the 200 nearest".
    diagnosticsTotal: total,
    diagnosticsServed: served,
    truncated: payload?.truncated === true,
    distribution,
    // Share of F and G — the *passoires thermiques* whose letting is being
    // phased out, and the single most decision-relevant cut of this register.
    poorCount: poor,
    poorShare: labelled ? Math.round((poor / labelled) * 100) : null,
    medianCoutAnnuel: payload?.medianCoutAnnuel ?? null,
    coverage: `${scan}${ground}${paint}`,
    // The grouping, published rather than only printed. `sites` is what is
    // DRAWN; the other three are the ways a site can be on screen without an
    // outline, and they are kept apart because they are three different
    // failures: the register places nothing, the budget ran out, the RNB has no
    // footprint for it.
    sites,
    sitesOutlined: outlined,
    sitesParcelled: coverage?.parcelled ?? _sites.filter((site) => site?.parcel).length,
    sitesUnplaceable: coverage?.unplaceable ?? 0,
    sitesOverBudget: coverage?.overBudget ?? 0,
    // A5, published rather than only printed: painted over loaded, and the two
    // ways a diagnostic can fail to reach a volume.
    themePainting: painting,
    themeBuildings: join.buildings,
    themePainted: join.painted,
    themeUnpainted: Math.max(0, join.buildings - join.painted),
    themeMixedBuildings: join.mixed,
    // How the diagnostics reached their volumes. `themeMatchedById` is the
    // register's own key (`rnbPivot.js`); `themeMatchedByPoint` is the BAN
    // geocode falling inside a footprint, which is a guess and is counted as
    // one. `themeIdOffScreen` names a building this viewport does not draw.
    themeMatchedById: join.matchedById,
    themeMatchedByPoint: join.matchedByPoint,
    themeIdOffScreen: join.idOffScreen,
    // The ceiling on the first of those: the share of the SERVED rows that name
    // a building at all. 34.5 % over Ustaritz against 73.7 % over Paris 13e, so
    // a low identity count is often the edition and not the join.
    rnbCoverage: payload?.rnbCoverage ?? null,
    themeUnmatchedPoints: join.unmatchedPoints,
    themeUnplacedPoints: join.unplacedPoints,
    themeUngradedPoints: join.ungradedPoints,
  };
}

/* ── the ground under a site ───────────────────────────────────────────── */

/**
 * How much ink a building's footprint puts on the ground.
 *
 * Heavier than the permit layer's 0.18 and lighter than the cadastre's 0.28, on
 * purpose: here the BUILDING is the subject — it is the answer to «où est situé
 * le bien» — while for a permit the plot is the ground under the news. At 0.26
 * the letter reads against its own wash at street zoom and the roof underneath
 * is still visible through it on the photoreal stack, which matters because a
 * reader uses the roof to recognise the building.
 */
const FOOTPRINT_FILL_ALPHA = 0.26;
/** The boundary, which is the part that survives being small. */
const FOOTPRINT_OUTLINE_ALPHA = 0.95;
const FOOTPRINT_OUTLINE_WIDTH_PX = 2;

/**
 * The parcel is drawn as a LINE and never as a wash.
 *
 * Two reasons, and the first is A1. The colour channel of this layer is spent,
 * entirely, on the seven official letters; a second filled shape in any colour
 * would be a second thing the ramp has to mean. And the parcel is not graded —
 * a DPE says nothing whatsoever about the land — so a wash that took the
 * building's letter would be claiming the plot is an F.
 *
 * Deliberately achromatic for the same reason: a reader who sees a grey line
 * around a coloured footprint cannot mistake it for a measurement.
 */
const PARCEL_LINE_CSS = '#c9d4e3';
const PARCEL_LINE_ALPHA = 0.6;
const PARCEL_LINE_WIDTH_PX = 1.2;
/** Dash pattern: the cadastre's own lines have no legal force (`cadastreFeed.js`). */
const PARCEL_DASH_PATTERN = 0b1111000011110000;

/** Positions for one ring, closed. Three points is the least that encloses anything. */
function ringPositions(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  return Cesium.Cartesian3.fromDegreesArray(ring.flat());
}

/**
 * Draw the ground one site stands on: its building, then its parcel.
 *
 * ── Why a fill and a polyline, and not `polygon.outline` ───────────────────
 *
 * A ground-clamped `polygon` cannot draw its own stroke in Cesium: `outline:
 * true` is silently ignored once the polygon is classified onto terrain. The
 * permit layer learnt this first and this follows it — including giving both
 * entities the same name and description, so the EDGE of a building opens the
 * same card as its middle rather than a card titled with an entity id.
 *
 * ── Why every fill in one colour is safe, and a two-colour fill would not be ─
 *
 * Cesium batches ground-classified entity fills BY COLOUR, and inside one batch
 * it decides which instance owns a pixel by each instance's axis-aligned
 * bounding RECTANGLE rather than by its polygon — neighbours repaint each other
 * along rectangle edges (`scripts/qa-cadastre-highlight.mjs` measured this on
 * the parcels). It is invisible while a batch is one colour and glaring the
 * moment one instance differs. Here every instance of a given DPE letter shares
 * that letter's colour exactly, so the seven letters make seven single-colour
 * batches and the artefact cannot appear. A per-site tint — a brighter F for a
 * site with more diagnostics, say — would break that, and is why there is not
 * one.
 *
 * @param {object} dataSource
 * @param {object} site
 * @param {number} classificationType Cesium surface to clamp onto.
 * @returns {number} Entities added.
 */
function drawSiteGround(dataSource, site, classificationType) {
  let added = 0;
  const title = dpeSiteTitle(site);
  const description = dpeSiteCardDescription(
    site, sitePaintedSummary(site), Boolean(_join?.buildings),
  );
  const parcelParts = site?.parcel?.parts || [];
  for (const [index, rings] of parcelParts.entries()) {
    for (const [ringIndex, ring] of rings.entries()) {
      const positions = ringPositions(ring);
      if (!positions) continue;
      dataSource.entities.add({
        id: `dpe:parcelle:${site.key}:${index}:${ringIndex}`,
        name: title,
        description,
        properties: { kind: 'dpe-parcelle', siteKey: site.key, idu: site.parcel.idu },
        polyline: {
          positions: [...positions, positions[0]],
          width: PARCEL_LINE_WIDTH_PX,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString(PARCEL_LINE_CSS)
              .withAlpha(PARCEL_LINE_ALPHA),
            dashPattern: PARCEL_DASH_PATTERN,
          }),
          clampToGround: true,
          classificationType,
        },
      });
      added += 1;
    }
  }

  const parts = site?.shape?.parts || [];
  if (!parts.length) return added;
  const letter = site.summary?.grade ?? null;
  const base = dpeColor(letter);
  const fill = base.withAlpha(FOOTPRINT_FILL_ALPHA);
  const stroke = base.withAlpha(FOOTPRINT_OUTLINE_ALPHA);
  // A POLYGON ENTITY HAS NO POSITION OF ITS OWN, and `cardFromEntity` needs
  // one: without it the wash is drawn, is picked, and selects nothing — a
  // building a reader can see, can click, and cannot open. Measured exactly
  // that way before this line existed. It goes to the first part actually
  // DRAWN rather than to part zero, because a part whose outer ring did not
  // survive is skipped and hanging the card on it would leave the building on
  // screen with nothing to click. The permit layer learnt this first.
  let anchored = false;
  for (const [index, rings] of parts.entries()) {
    const outer = ringPositions(rings[0]);
    if (!outer) continue;
    const holes = [];
    for (let h = 1; h < rings.length; h += 1) {
      const hole = ringPositions(rings[h]);
      // A courtyard is not part of the building. Filled in, the area on the
      // card stops describing the shape beside it.
      if (hole) holes.push(new Cesium.PolygonHierarchy(hole));
    }
    dataSource.entities.add({
      id: `dpe:bati:${site.key}:${index}`,
      // One card per building, not one per fragment of it. Giving it this
      // position also means the card is seated on terrain by the same pass
      // that seats the badges.
      position: anchored || !Number.isFinite(site.lon)
        ? undefined
        : Cesium.Cartesian3.fromDegrees(site.lon, site.lat),
      name: title,
      description,
      properties: { kind: 'dpe-bati', siteKey: site.key, rnbId: site.shape.rnbId },
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(outer, holes),
        material: fill,
        classificationType,
        outline: false,
      },
    });
    anchored = true;
    added += 1;
    for (const [ringIndex, ring] of rings.entries()) {
      const positions = ringPositions(ring);
      if (!positions) continue;
      dataSource.entities.add({
        id: `dpe:bati:${site.key}:${index}:${ringIndex}`,
        name: title,
        description,
        properties: { kind: 'dpe-bati', siteKey: site.key, rnbId: site.shape.rnbId },
        polyline: {
          positions: [...positions, positions[0]],
          width: FOOTPRINT_OUTLINE_WIDTH_PX,
          material: new Cesium.ColorMaterialProperty(stroke),
          clampToGround: true,
          classificationType,
        },
      });
      added += 1;
    }
  }
  return added;
}

/* ── the class filter ──────────────────────────────────────────────────── */

/**
 * The runtime value that shows every class: the ladder's letters, in order.
 *
 * The filter is carried as the LETTERS SHOWN, so "everything" is the full set
 * rather than a special token, and a share link reads as what is on screen.
 */
export const DPE_CLASS_FILTER_ALL = DPE_LABELS.join('');

/**
 * Every value the filter may take: the 127 non-empty subsets of the ladder,
 * each written in ladder order.
 *
 * ENUMERATED because the scan shell rejects any value it was not given — a
 * share link is a stranger's URL. The EMPTY set is deliberately not one of
 * them: a filter that hides all seven classes is a blank map that looks like
 * a street with no diagnostic, and the key's toggle falls back to everything
 * rather than send it.
 */
export const DPE_CLASS_FILTER_VALUES = Object.freeze(
  Array.from({ length: (2 ** DPE_LABELS.length) - 1 }, (_, index) => DPE_LABELS
    .filter((_letter, bit) => ((index + 1) >> bit) & 1)
    .join('')),
);

/**
 * The letters a filter value shows, or all seven for anything unrecognised.
 * @param {?string} value
 * @returns {string[]}
 */
export function dpeClassFilterLetters(value) {
  const text = String(value ?? '');
  return DPE_CLASS_FILTER_VALUES.includes(text) ? [...text] : [...DPE_LABELS];
}

/**
 * What pressing one letter of the key does to the filter.
 *
 * From "everything", a press means "only this one" — the reader pointed at a
 * class and asked to see it. Once filtering, a press adds or removes that one
 * letter, so F then G is the *passoires* in two presses. Removing the last
 * letter shows everything again rather than nothing.
 *
 * @param {?string} value The filter in force.
 * @param {string} letter A–G.
 * @returns {string} The next value, always one of {@link DPE_CLASS_FILTER_VALUES}.
 */
export function dpeClassFilterToggle(value, letter) {
  const shown = dpeClassFilterLetters(value);
  if (!DPE_LABELS.includes(letter)) return shown.join('');
  let next;
  if (shown.length === DPE_LABELS.length) next = [letter];
  else if (shown.includes(letter)) next = shown.filter((kept) => kept !== letter);
  else next = [...shown, letter];
  return next.length ? DPE_LABELS.filter((kept) => next.includes(kept)).join('') : DPE_CLASS_FILTER_ALL;
}

/**
 * The sites a filter leaves on the map, each re-summarised on the diagnostics
 * it still shows.
 *
 * THE FILTER IS OVER DIAGNOSTICS, NOT OVER BADGES. Asked for E, a building
 * holding C, D and E stays — it has E diagnostics — and its badge becomes E,
 * with the count of E. Filtering on the badge's own letter instead would hide
 * the E flats of every block whose majority is something else, which is most
 * of the ones a reader filtering for E is looking for. A diagnostic with no
 * published letter is in no class, so any filter hides it.
 *
 * @param {Array<object>} sites
 * @param {?string} value
 * @returns {Array<object>} The same array when nothing is filtered; otherwise
 *   copies carrying `unfiltered`, the site's whole summary, for the card.
 */
export function dpeFilterSites(sites, value) {
  const list = Array.isArray(sites) ? sites : [];
  const letters = dpeClassFilterLetters(value);
  if (letters.length === DPE_LABELS.length) return list;
  const keep = new Set(letters);
  const out = [];
  for (const site of list) {
    const points = (site?.points || []).filter((point) => keep.has(dpeGradeOf(point)));
    if (!points.length) continue;
    out.push({
      ...site,
      points,
      summary: dpeBuildingSummary(points),
      unfiltered: site.summary || dpeBuildingSummary(site.points),
    });
  }
  return out;
}

/* ── the selected site: a tag on the map, a card in the key ────────────── */

/** The register a card's source line opens — the page `dataCredits.js` credits. */
export const DPE_SOURCE_URL = 'https://data.ademe.fr/datasets/dpe03existant';

/**
 * One diagnostic's own page on the ADEME observatory. Checked 2026-09-21 in a
 * browser: `…/afficher-dpe/2569E2000837C` opens that diagnostic, its labels and
 * its attestation. Behind a bot challenge, so a plain `curl` sees a 403.
 */
export const DPE_OBSERVATORY_URL = 'https://observatoire-dpe-audit.ademe.fr/afficher-dpe/';

/**
 * The observatory page of one diagnostic, or null for a number that is not
 * one — the page only accepts the 2021 format, four digits, a letter, seven
 * digits, a letter. A made-up id (`dpe-3`) gets no link rather than a dead one.
 * @param {?string} id `numero_dpe`.
 * @returns {?string}
 */
export function dpeObservatoryUrl(id) {
  const number = String(id ?? '').trim().toUpperCase();
  return /^\d{4}[A-Z]\d{7}[A-Z]$/.test(number) ? `${DPE_OBSERVATORY_URL}${number}` : null;
}

/**
 * The BAN address split into its street and its locality — `30 Rue de la
 * République` over `69002 Lyon`, as the card prints them.
 * @param {?string} address `adresse_ban`.
 * @returns {{street: ?string, locality: ?string}}
 */
export function dpeSplitAddress(address) {
  const text = String(address ?? '').trim();
  const match = text.match(/^(.*\S)\s+(\d{5}\s+\S.*)$/);
  return match ? { street: match[1], locality: match[2] } : { street: text || null, locality: null };
}

/**
 * The site's tag on the map while its card is in the key: the letters, then
 * how many diagnostics — `C–E · 16`, `D · 2`, `F`.
 *
 * The RANGE, not the mode: a building holding C, D and E is not a D building,
 * and a tag that said D would be the neighbourhood grade this layer refuses,
 * shrunk to one address. The mode is in the card, named as what it is.
 *
 * @param {object} site
 * @returns {string}
 */
export function dpeSiteTag(site) {
  const summary = site?.summary || dpeBuildingSummary(site?.points);
  let letters = '?';
  if (summary.graded) letters = summary.mixed ? `${summary.best}–${summary.worst}` : summary.grade;
  return summary.total > 1 ? `${letters} · ${formatNumber(summary.total)}` : letters;
}

/** The day a diagnostic was issued, `18 juin 2025`, read and printed in UTC. */
function issuedOn(iso) {
  const text = String(iso || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text || null;
  return formatDate(`${text}T00:00:00Z`, { dateStyle: 'medium', timeZone: 'UTC' });
}

/**
 * The selected site as the map key prints it (`legendSelection`).
 *
 * THE CARD ANSWERS FOR AN ADDRESS AND THE DIAGNOSTICS FILED THERE, never for
 * the building. Sixteen flats at one address are sixteen ratings, so the
 * headline is the count, the letters present come as a row of plates with
 * their range spelled out, and the mode is printed as what it is — «classe la
 * plus fréquente» — with a tie named rather than hidden behind the worse
 * letter it resolves to. Every diagnostic is listed, newest first, each with a
 * link to its own page on the ADEME observatory.
 *
 * @param {object} site A drawn site.
 * @returns {object} The key's `legendSelection` slot.
 */
export function dpeSitePanel(site) {
  const m = messages().panel;
  const s = messages().site;
  const points = site?.points || [];
  const summary = site?.summary || dpeBuildingSummary(points);
  const { street, locality } = dpeSplitAddress(site?.address);
  const counts = new Map();
  for (const point of points) {
    const letter = dpeGradeOf(point);
    if (letter) counts.set(letter, (counts.get(letter) || 0) + 1);
  }
  const tied = summary.grade
    ? summary.letters.filter((letter) => letter !== summary.grade && counts.get(letter) === summary.votes)
    : [];
  const poor = (counts.get('F') || 0) + (counts.get('G') || 0);
  const costs = points.map((point) => point?.annualCostEur)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const median = costs.length ? costs[Math.floor((costs.length - 1) / 2)] : null;
  let range = null;
  if (summary.graded) {
    if (summary.mixed) range = m.range(summary.best, summary.worst);
    else range = summary.graded > 1 ? m.all(summary.grade) : m.one(summary.grade);
  }
  const whole = site?.unfiltered?.total;
  const items = [...points]
    .sort((a, b) => String(b?.issuedOn || '').localeCompare(String(a?.issuedOn || '')))
    .map((point) => {
      const letter = dpeGradeOf(point);
      const href = dpeObservatoryUrl(point?.id);
      return {
        label: letter || '?',
        color: letter ? DPE_COLORS[letter] : COLOR_UNLABELLED_CSS,
        text: [
          Number.isFinite(point?.surfaceM2)
            ? m.surface(formatNumber(point.surfaceM2, { maximumFractionDigits: 1 })) : null,
          issuedOn(point?.issuedOn),
        ].filter(Boolean).join(' · ') || String(point?.id ?? ''),
        href,
        title: href ? m.openRating(point.id) : null,
      };
    });
  let mode = null;
  if (summary.mixed) mode = tied.length ? m.modeTie(summary.grade, tied.join(', ')) : m.mode(summary.grade);
  return {
    key: `dpe-site:${site?.key}:${points.length}`,
    title: street || s.noAddress,
    meta: locality,
    headline: m.count(summary.total),
    chips: summary.letters.length
      ? {
        caption: m.present,
        items: summary.letters.map((letter) => ({ label: letter, color: DPE_COLORS[letter] })),
        text: range,
      }
      : null,
    lines: [
      mode,
      summary.ungraded ? s.ungraded(summary.ungraded) : null,
      poor ? s.poor(poor) : null,
      median !== null ? s.cost(formatNumber(Math.round(median))) : null,
      Number.isFinite(whole) && whole > summary.total ? m.filtered(summary.total, whole) : null,
    ].filter(Boolean),
    footnote: [
      summary.total > 1 ? m.perDwelling : null,
      dpeSitePlacementLine(site),
      site?.parcel?.idu ? s.parcel(site.parcel.idu) : null,
    ].filter(Boolean).join(' · ') || null,
    list: items.length ? { caption: m.listCaption, summary: m.seeAll(items.length), items } : null,
    link: { href: DPE_SOURCE_URL, label: m.source },
  };
}

/**
 * THE SELECTED SITE, OUTLINED IN WHITE (2026-09-21).
 *
 * Every drawn site already washes its building in its letter and rings its
 * parcel in a dashed grey. A click lifts ONE of them out: the building's
 * outline and its parcel's go white and solid, and the building's wash doubles
 * in strength — so the answer to «which building is this card about» is on the
 * map, not only in the key.
 *
 * WHITE, WHERE THE DVF CHOSE THE CLASS COLOUR. A ring on the photoreal mesh
 * drapes down the walls on its boundary, and the DVF's cyan painted a street
 * front a colour its key did not name. Here the class colour is already on
 * every building of the layer — a ring in it would say nothing new — while
 * white is spent on nothing else in this layer, and a white street front reads
 * as what it is: the building the card is about.
 */
const SELECTED_FILL_ALPHA = 0.55;
const SELECTED_OUTLINE = Object.freeze({ alpha: 0.95, widthPx: 3 });
const SELECTED_PARCEL = Object.freeze({ alpha: 0.8, widthPx: 2 });

/** The lit building and parcel, as `drawGroundHighlight` handed them back. */
let _highlight = null;
/** The viewer the last draw went to — the highlight is drawn on the same one. */
let _drawViewer = null;
/** The key of the site whose card is open, or null. */
let _selectedSiteKey = null;
/** The open card when it is not a site's — a cell's, above 600 m. */
let _selectedCard = null;

/** Take the lit site off the globe. Idempotent. */
function clearSiteHighlight() {
  _highlight?.clear();
  _highlight = null;
}

/**
 * Light one site: its building filled and ringed, its parcel ringed.
 * @param {object} viewer
 * @param {object} site
 * @returns {boolean} True when something was drawn.
 */
function drawSiteHighlight(viewer, site) {
  clearSiteHighlight();
  const white = Cesium.Color.WHITE;
  const shapes = [];
  if (site?.parcel?.parts?.length) {
    shapes.push({
      parts: site.parcel.parts,
      stroke: white.withAlpha(SELECTED_PARCEL.alpha),
      widthPx: SELECTED_PARCEL.widthPx,
    });
  }
  if (site?.shape?.parts?.length) {
    shapes.push({
      parts: site.shape.parts,
      fill: dpeColor(site.summary?.grade ?? null).withAlpha(SELECTED_FILL_ALPHA),
      stroke: white.withAlpha(SELECTED_OUTLINE.alpha),
      widthPx: SELECTED_OUTLINE.widthPx,
    });
  }
  _highlight = shapes.length ? drawGroundHighlight(viewer, shapes, 'dpe-highlight') : null;
  return _highlight !== null;
}

/**
 * Light one area shape: refilled in its class colour, ringed in white — the
 * site highlight's grammar, one scale up.
 * @param {object} viewer @param {{parts: Array, css: string}} shape
 * @returns {boolean}
 */
function drawShapeHighlight(viewer, shape) {
  clearSiteHighlight();
  if (!shape?.parts?.length) return false;
  _highlight = drawGroundHighlight(viewer, [{
    parts: shape.parts,
    fill: Cesium.Color.fromCssColorString(shape.css || COLOR_UNLABELLED_CSS).withAlpha(SELECTED_FILL_ALPHA),
    stroke: Cesium.Color.WHITE.withAlpha(SELECTED_OUTLINE.alpha),
    widthPx: SELECTED_OUTLINE.widthPx,
  }], 'dpe-highlight');
  return _highlight !== null;
}

/** The drawn site a card id names, or null. */
function siteForCard(card) {
  const id = String(card?.id ?? '');
  if (!id.startsWith('dpe:')) return null;
  return _sites.find((site) => `dpe:${site.key}` === id) || null;
}

/**
 * The shell's selection hook: remember the site, light its ground, and keep
 * its plate in its own colour.
 *
 * The shell tints a selected marker in its selection cyan, which on a filled
 * plate paints over the one thing the plate says. The plate keeps its class
 * colour and the growth the shell gave it; the white outline and the tag carry
 * the selection instead.
 * @param {?object} card
 */
function onDpeSelectionChange(card) {
  clearSiteHighlight();
  const wasPinned = _selectedSiteKey !== null;
  const site = card ? siteForCard(card) : null;
  _selectedSiteKey = site ? site.key : null;
  // Above 600 m a card is opened on bare ground, and it is about the parcel
  // or section under that point — found by geometry, as the card was.
  _selectedShape = !site && _areaUnit && Number.isFinite(card?.lon) && Number.isFinite(card?.lat)
    ? _areaLevels.shapeAt(card.lon, card.lat)
    : null;
  _selectedCard = card && !site && !_selectedShape ? card : null;
  if (_selectedShape) {
    if (_drawViewer) drawShapeHighlight(_drawViewer, _selectedShape);
    return;
  }
  if (!site) {
    // The plate it pinned may fold back into its neighbours' pill.
    if (wasPinned) declutter();
    return;
  }
  const badge = _dataSource?.entities?.getById?.(`dpe:${site.key}`);
  if (badge?.billboard) badge.billboard.color = dpeColor(site.summary?.grade ?? null);
  if (_drawViewer) drawSiteHighlight(_drawViewer, site);
  // Out of any pill it was folded into: the reader is looking at this one.
  declutter();
}

/**
 * The key's selection slot for whatever is open, or null.
 * @returns {?object}
 */
export function dpeSelectionPanel() {
  if (_selectedSiteKey !== null) {
    const site = _sites.find((entry) => entry.key === _selectedSiteKey);
    if (site) return dpeSitePanel(site);
  }
  if (_selectedShape) {
    return _selectedShape.kind === 'section'
      ? dpeSectionPanel(_selectedShape.record, _areaLevels.payloadOf(_selectedShape) || _areaPayload)
      : dpeParcelPanel(_selectedShape.record);
  }
  if (_selectedCard?.title) {
    // A card this layer cannot resolve: its own lines, as the card on the
    // globe would have printed them.
    return {
      key: `card:${_selectedCard.id}:${_selectedCard.title}`,
      title: _selectedCard.title,
      lines: Array.isArray(_selectedCard.details) ? _selectedCard.details.filter(Boolean) : [],
      link: { href: DPE_SOURCE_URL, label: messages().panel.source },
    };
  }
  return null;
}

/**
 * The globe's half of the card: a tag while the key carries the rest, the
 * whole card otherwise.
 * @param {object} card
 * @returns {boolean|string}
 */
function dpeCompactCard(card) {
  if (!mapKeyCarriesSelection()) return false;
  const site = siteForCard(card);
  if (site) return dpeSiteTag(site);
  // Resolved from the card itself: the shell asks for the compact form BEFORE
  // it tells `onSelectionChange`, so `_selectedShape` may still be the last one.
  const shape = _areaUnit && Number.isFinite(card?.lon) && Number.isFinite(card?.lat)
    ? _areaLevels.shapeAt(card.lon, card.lat)
    : null;
  return shape ? dpeAreaTag(shape) : true;
}

/* ── plates that overlap, grouped ──────────────────────────────────────── */

/**
 * WHERE PLATES MEET, ONE PILL (2026-09-21).
 *
 * A street of flats seen at a slant stacks its addresses on screen: measured
 * over Lyon 2e at 350 m and −35°, eight plates of rue de la République stood
 * on one another in a column, and only the top one could be read or clicked.
 * So plates that touch are grouped into one pill that says what the group
 * holds — its letters' RANGE, each letter in its class colour, and how many
 * diagnostics: `D–F · 38`, the same grammar as a selected site's tag. A click
 * on the pill brings the camera closer until the plates part; nothing is
 * averaged, and every site stays one click away.
 *
 * NOT CESIUM'S `EntityCluster`, which was tried first and measured: it groups
 * each seed with the neighbours of its own ORIGINAL box, so the pills it
 * produces — wider than the plates they replace — landed on each other, eight
 * overlapping pairs among 26 marks on that same view; and it re-clusters on a
 * camera change of half the view, so plates lifted onto the surface after the
 * first pass kept their stale groups. The grouping below is greedy in screen
 * space, sizes each group by the pill it will actually draw, merges groups
 * until no two marks touch, and runs when the camera settles or a plate moves.
 */
/** Height of the pill, CSS px — about the plate's own size, so a pill reads as one. */
const CLUSTER_PILL_PX = 24;
/** Raster scale, for a crisp pill on a Retina screen. */
const CLUSTER_RASTER_SCALE = 2;
/** Clear space kept between two marks, px. */
const CLUSTER_GAP_PX = 2;

/**
 * What a group of sites holds, as its pill says it.
 * @param {Array<object>} sites
 * @returns {{best: ?string, worst: ?string, total: number, sites: number}}
 */
export function dpeClusterSummary(sites) {
  let best = null;
  let worst = null;
  let total = 0;
  for (const site of sites || []) {
    const summary = site?.summary || dpeBuildingSummary(site?.points);
    total += summary.total || 0;
    if (summary.best && (best === null || DPE_LABELS.indexOf(summary.best) < DPE_LABELS.indexOf(best))) {
      best = summary.best;
    }
    if (summary.worst && (worst === null || DPE_LABELS.indexOf(summary.worst) > DPE_LABELS.indexOf(worst))) {
      worst = summary.worst;
    }
  }
  return { best, worst, total, sites: (sites || []).length };
}

/** The pill's text, as coloured runs: `[{text: 'D', color}, {text: '–'}, …]`. */
export function dpeClusterRuns(summary) {
  const runs = [];
  if (summary.best) {
    runs.push({ text: summary.best, color: DPE_COLORS[summary.best] });
    if (summary.worst && summary.worst !== summary.best) {
      runs.push({ text: '–' }, { text: summary.worst, color: DPE_COLORS[summary.worst] });
    }
  } else {
    runs.push({ text: '?', color: COLOR_UNLABELLED_CSS });
  }
  runs.push({ text: ` · ${formatNumber(summary.total)}` });
  return runs;
}

/**
 * A pill's width, estimated from its characters — the drawing measures the
 * real one. Deliberately generous, so a group is never sized smaller than it
 * draws and cannot land on a neighbour.
 * @param {Array<{text: string}>} runs
 * @returns {number} CSS px.
 */
export function dpeClusterPillWidth(runs) {
  const chars = runs.reduce((sum, run) => sum + String(run.text).length, 0);
  return Math.ceil(chars * 9 + 18);
}

/**
 * Group the marks on screen so that none touches another.
 *
 * GREEDY, BIGGEST FIRST. Marks are taken by how many diagnostics they carry,
 * so the address a group is anchored on — and named after on screen — is the
 * one that says the most. A mark that touches an existing group joins it;
 * then groups are re-sized to the mark they will actually draw (a plate for
 * one site, a pill for more) and merged while any two still touch, because a
 * pill is wider than the plates it replaces.
 *
 * Pure: marks in, groups out, no Cesium.
 *
 * @param {Array<{key: string, x: number, y: number, size: number, weight: number,
 *   site: object, pinned?: boolean}>} marks Screen positions, CSS px.
 * @param {{gapPx?: number, pillWidth?: (runs: Array<object>) => number}} [options]
 * @returns {Array<{seed: object, members: Array<object>}>} In seed order.
 */
export function dpeDeclutterGroups(marks, { gapPx = CLUSTER_GAP_PX, pillWidth = dpeClusterPillWidth } = {}) {
  const sorted = [...(marks || [])]
    .filter((mark) => Number.isFinite(mark?.x) && Number.isFinite(mark?.y))
    .sort((a, b) => (b.pinned === true) - (a.pinned === true) || b.weight - a.weight);
  const boxOf = (group) => {
    if (group.members.length === 1) {
      const { size } = group.seed;
      return { x: group.seed.x, y: group.seed.y, w: size, h: size };
    }
    const runs = dpeClusterRuns(dpeClusterSummary(group.members.map((mark) => mark.site)));
    return { x: group.seed.x, y: group.seed.y, w: pillWidth(runs), h: CLUSTER_PILL_PX };
  };
  const touches = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w + gapPx * 2
    && Math.abs(a.y - b.y) * 2 < a.h + b.h + gapPx * 2;
  let groups = [];
  for (const mark of sorted) {
    const box = { x: mark.x, y: mark.y, w: mark.size, h: mark.size };
    // A pinned mark — the selected site — is never folded into a pill: the
    // reader is looking at it, and its tag is anchored on it.
    const host = mark.pinned ? null : groups.find((group) => !group.seed.pinned && touches(boxOf(group), box));
    if (host) host.members.push(mark);
    else groups.push({ seed: mark, members: [mark] });
  }
  for (let pass = 0; pass < 8; pass += 1) {
    let merged = false;
    const next = [];
    for (const group of groups) {
      const host = group.seed.pinned
        ? null
        : next.find((kept) => !kept.seed.pinned && touches(boxOf(kept), boxOf(group)));
      if (host) {
        host.members.push(...group.members);
        merged = true;
      } else {
        next.push(group);
      }
    }
    groups = next;
    if (!merged) break;
  }
  return groups;
}

/** @type {Map<string, {image: string, width: number, height: number}>} */
const _clusterPills = new Map();

/**
 * The pill as a billboard image, drawn once per text and reused — each
 * distinct image is an atlas entry, and a re-group on every camera settle
 * would otherwise grow the atlas without bound.
 * @param {Array<{text: string, color?: string}>} runs
 * @returns {?{image: string, width: number, height: number}}
 */
function clusterPill(runs) {
  const key = runs.map((run) => `${run.text}${run.color || ''}`).join('|');
  const cached = _clusterPills.get(key);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const scale = CLUSTER_RASTER_SCALE;
  const height = CLUSTER_PILL_PX * scale;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  const font = `700 ${14 * scale}px 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif`; // i18n-ignore-line — a CSS font, not copy.
  context.font = font;
  const padding = 9 * scale;
  const widths = runs.map((run) => context.measureText(run.text).width);
  const width = Math.ceil(widths.reduce((sum, value) => sum + value, 0) + (padding * 2));
  canvas.width = width;
  canvas.height = height;
  const rim = 1.5 * scale;
  const radius = 7 * scale;
  context.beginPath();
  context.roundRect(rim / 2, rim / 2, width - rim, height - rim, radius);
  context.fillStyle = 'rgba(11, 18, 16, 0.92)';
  context.fill();
  context.lineWidth = rim;
  context.strokeStyle = 'rgba(247, 244, 234, 0.9)';
  context.stroke();
  context.font = font;
  context.textBaseline = 'middle';
  let x = padding;
  runs.forEach((run, index) => {
    context.fillStyle = run.color || 'rgba(247, 244, 234, 0.96)';
    context.fillText(run.text, x, height / 2 + scale);
    x += widths[index];
  });
  const pill = { image: canvas.toDataURL('image/png'), width: width / scale, height: CLUSTER_PILL_PX };
  _clusterPills.set(key, pill);
  return pill;
}

/** The pills on the globe: one primitive collection, rebuilt on each grouping. */
let _pills = null;
/** Remover of the camera-settle listener that re-groups. */
let _removeMoveEnd = null;

/** Take the pills off the globe. Idempotent. */
function clearPills() {
  if (!_pills) return;
  const primitives = _pills.viewer?.scene?.primitives;
  if (primitives && !primitives.isDestroyed?.()) primitives.remove(_pills.collection);
  _pills = null;
}

/**
 * Group the plates on screen now, hiding the ones a pill stands for.
 *
 * Run when the camera settles, after every draw and every seating pass that
 * moved a plate, and when the selection changes. During a camera move the
 * groups hold — they are anchored in the world, so they travel with the map,
 * and the next settle re-groups for the new view.
 *
 * @returns {number} Pills drawn.
 */
function declutter() {
  const scene = _drawViewer?.scene;
  if (!scene || !_dataSource || _areaUnit || !_enabled) {
    clearPills();
    return 0;
  }
  const now = _drawViewer.clock?.currentTime ?? Cesium.JulianDate.now();
  const selectedKey = _selectedSiteKey;
  const marks = [];
  for (const site of _sites) {
    const entity = _dataSource.entities.getById?.(`dpe:${site.key}`);
    if (!entity?.billboard) continue;
    entity.billboard.show = true;
    const position = entity.position?.getValue?.(now);
    const point = position ? scene.cartesianToCanvasCoordinates(position) : null;
    if (!point || !Number.isFinite(point.x)) continue;
    marks.push({
      key: site.key,
      x: point.x,
      y: point.y,
      size: billboardNumber(entity.billboard.width) || SIZE_LABELLED_PX,
      weight: site.summary?.total ?? site.points?.length ?? 0,
      pinned: site.key === selectedKey,
      site,
      entity,
      position,
    });
  }
  const groups = dpeDeclutterGroups(marks);
  clearPills();
  let collection = null;
  let drawn = 0;
  for (const group of groups) {
    if (group.members.length < 2) continue;
    const pill = clusterPill(dpeClusterRuns(dpeClusterSummary(group.members.map((mark) => mark.site))));
    if (!pill) continue;
    if (!collection) collection = new Cesium.BillboardCollection({ scene });
    for (const mark of group.members) mark.entity.billboard.show = false;
    collection.add({
      position: group.seed.position,
      image: pill.image,
      width: pill.width,
      height: pill.height,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      // The entities it stands for, as a Cesium cluster files them: the shell
      // hands a click on an entity ARRAY to `clusterClick`.
      id: group.members.map((mark) => mark.entity),
    });
    drawn += 1;
  }
  if (collection) {
    scene.primitives.add(collection);
    _pills = { viewer: _drawViewer, collection };
  }
  governorRequestRender('dpe-declutter');
  return drawn;
}

/**
 * A click on a pill: fly closer, keeping the heading and the tilt, until the
 * plates it groups can part — a third of the way in, never nearer than 60 m.
 * @param {Array<object>} entities
 * @param {{viewer: object}} context
 * @returns {boolean}
 */
function zoomIntoCluster(entities, { viewer }) {
  const camera = viewer?.camera;
  const now = viewer?.clock?.currentTime;
  const positions = (entities || [])
    .map((entity) => entity?.position?.getValue?.(now))
    .filter(Boolean);
  if (!camera || !positions.length) return false;
  const sphere = Cesium.BoundingSphere.fromPoints(positions);
  const distance = Cesium.Cartesian3.distance(camera.positionWC, sphere.center);
  const range = Math.max(60, sphere.radius * 4, distance / 3);
  camera.flyToBoundingSphere(sphere, {
    offset: new Cesium.HeadingPitchRange(camera.heading, camera.pitch, range),
    duration: 0.8,
  });
  return true;
}

/* ── the layer ─────────────────────────────────────────────────────────── */

/* ── the area regimes ──────────────────────────────────────────────────── */
/**
 * Above 600 m this layer stops drawing one badge per building and paints the
 * CADASTRE, the way the price layer does: from 600 m to 1 800 m every parcel a
 * rating in the box stands on, above that every cadastral section. Each shape
 * is painted on the official A–G scale by the MOST FREQUENT class of its own
 * ratings, ties to the worse — the rule a building's footprint follows below
 * 600 m (`dpeSummaryFromCounts`), so a parcel keeps the colour its building
 * wore close up.
 *
 * WHY NOT DISCS ANY MORE. Until 2026-09-22 both bands drew geohash cells as
 * discs sized by their count and coloured by their share of F and G, on a
 * blue-to-magenta ramp of their own. The operator's request, on screen over
 * Lyon's Presqu'île: « qu'on ne vienne pas afficher ces espèces de cercles
 * mais bien directement les parcelles des bâtiments concernés par une donnée
 * DPE », on the DPE scale « même sur la vue dézoomée ». A disc fell across two
 * blocks and a river quay and named no ground a reader could point at.
 *
 * THE LETTER OF A SHAPE IS NOT A NEIGHBOURHOOD GRADE, and the refusal this
 * module has always made still holds: no mean of letters is ever computed.
 * The mode is an observed class, the card names it as « la classe la plus
 * fréquente » and prints every class present beside it, and the share of F
 * and G the discs carried stays in the key.
 *
 * HOW A RATING REACHES A SHAPE, and what each band admits, is the proxy's
 * business (`dpeFeed.js`, `shapeLocator.js`): a BAN point placed on the parcel
 * it stands on, or 3 m off its frontage; a 50 m square of the register given
 * to the section under its centre, a section painted only when three ratings
 * fall in squares wholly inside it. The key prints both admissions.
 *
 * DRAWN BY `groundAreaPaint.js`, shared with the price layer: primitives, one
 * classification batch per colour, a click answered by geometry.
 */

/** Ink — the price layer's, for the same reasons (see `dvfSales.js`, `AREA_STYLE`). */
const DPE_AREA_STYLE = Object.freeze({
  parcels: Object.freeze({ fill: 0.34, outline: 0.9, widthPx: 1.2 }),
  sections: Object.freeze({ fill: 0.24, outline: 0.85, widthPx: 1.4 }),
});

/** Top of the parcel band — the altitude a section card sends a reader under. */
const PARCEL_BAND_MAX_ALTITUDE_M = SCAN_BANDS.find((band) => band.dvfUnit === 'plots')?.maxAltitudeM;

/**
 * The parcels and the sections on the globe, as two levels that fade into
 * each other between 1 080 m and 1 800 m (`scanRegime.SCAN_SECTION_FADE`) —
 * see `scanAreaFade.js`, and `dvfSales.js` for the same arrangement.
 *
 * WHY THE TWO MAY FADE: both wear the most frequent letter of the ratings they
 * hold, on the official scale — the same statistic over a parcel and over a
 * section. The section counts the register's 50 m squares lying wholly inside
 * it and is painted from three up; measured against the exact placement it
 * wore the same letter on every section painted (14 of 14, `dpeFeed.js`).
 *
 * WHAT A FADE STEP COSTS: one colour attribute per instance, written only when
 * the quantised weight moves — the densest parcel box measured holds 2 469
 * parcels (Lyon Presqu'île), a section box a few hundred.
 */
const _areaLevels = createScanAreaLevels({
  ownerId: 'dpe-fr',
  names: { fine: 'parcels', coarse: 'sections' },
  renderReason: 'dpe-area-build',
  endpoint: '/api/dpe',
  unitOf: (payload) => {
    const unit = dpeAreaUnit(payload);
    if (unit === 'parcels') return 'fine';
    return unit === 'sections' ? 'coarse' : null;
  },
  paintOf: (level, payload, runtime) => dpeAreaPaint(payload,
    new Set(dpeClassFilterLetters(runtime?.classes ?? DPE_CLASS_FILTER_ALL))),
  // The shell's own question, lifted to the coarse band: the 0.08° box, and
  // only the tiles the screen shows.
  coarseParams: (point, viewer) => dpeScanParams(point, cameraViewBox(viewer)),
  scanPoint: cameraScanPoint,
});

/**
 * Which area answer is on screen: `'parcels'`, `'sections'`, or null for the
 * disc regime. Set by `render` from the payload, never from the camera — see
 * `dvfSales.js` for the window in which the two disagree.
 */
let _areaUnit = null;
/** The answer on screen, so a selection can be resolved against it. */
let _areaPayload = null;
/** The area shape whose card is open, or null. */
let _selectedShape = null;

/**
 * The regime a payload answers in.
 * @param {?object} payload
 * @returns {?string} `'parcels'`, `'sections'`, or null for the disc.
 */
export function dpeAreaUnit(payload) {
  if (Array.isArray(payload?.parcels)) return 'parcels';
  if (Array.isArray(payload?.sections)) return 'sections';
  return null;
}

/**
 * Whether a pick id is one of this layer's area shapes.
 * @param {?string} pickedId @returns {boolean}
 */
export function isDpeAreaPickId(pickedId) {
  const id = String(pickedId ?? '');
  return id.startsWith('dpe-parcel:') || id.startsWith('dpe-section:');
}

/**
 * A shape's counts with the key's filter applied: the letters it hides are
 * zeroed, exactly as a site below 600 m keeps only its shown diagnostics.
 * @param {object} record @param {Set<string>} shown
 * @returns {number[]}
 */
function shownCounts(record, shown) {
  return DPE_LABELS.map((letter, i) => (shown.has(letter) ? Number(record?.counts?.[i]) || 0 : 0));
}

/**
 * The summary a shape is painted from — `dpeSummaryFromCounts` over its
 * shown letters. The ungraded ratings only count while nothing is filtered:
 * the filter hides unlabelled ratings below 600 m too.
 * @param {object} record
 * @param {Set<string>} [shown]
 * @returns {ReturnType<typeof dpeSummaryFromCounts>}
 */
export function dpeAreaSummary(record, shown = new Set(DPE_LABELS)) {
  const everything = shown.size === DPE_LABELS.length;
  return dpeSummaryFromCounts(shownCounts(record, shown), everything ? record?.ungraded : 0);
}

/**
 * Whether a section holds enough certain ratings to be painted — see
 * `DPE_SECTION_MIN_GRADED`. Read on the WHOLE answer, never the filtered one:
 * the filter chooses which letters show, not which ground is known.
 * @param {object} record @returns {boolean}
 */
export function dpeSectionIsPainted(record) {
  return (Number(record?.whole) || 0) >= DPE_SECTION_MIN_GRADED;
}

/**
 * The letter a shape is painted in, or null for neutral.
 * @param {string} unit @param {object} record @param {Set<string>} [shown]
 * @returns {?string}
 */
export function dpeAreaGrade(unit, record, shown) {
  if (unit === 'sections' && !dpeSectionIsPainted(record)) return null;
  return dpeAreaSummary(record, shown).grade;
}

/** The CSS colour a shape is painted in. */
export function dpeAreaColorCss(unit, record, shown) {
  const letter = dpeAreaGrade(unit, record, shown);
  return letter ? DPE_COLORS[letter] : COLOR_UNLABELLED_CSS;
}

/**
 * The shapes the key's filter leaves on the map: those holding at least one
 * rating of a shown letter. With every letter shown, all of them — the ones
 * with no published letter included, since they are ground the register did
 * rate.
 * @param {Array<object>} records @param {Set<string>} shown
 * @returns {Array<object>}
 */
export function dpeFilterAreaRecords(records, shown) {
  if (shown.size === DPE_LABELS.length) return records || [];
  return (records || []).filter((record) => shownCounts(record, shown).some((n) => n > 0));
}

/** The records of an area answer, by unit. */
function areaRecords(payload) {
  const unit = dpeAreaUnit(payload);
  if (unit === 'parcels') return payload.parcels;
  if (unit === 'sections') return payload.sections;
  return [];
}

/**
 * The key in an area regime: the seven classes counted in SHAPES — how many
 * parcels, or sections, each letter paints — and the neutral row the unit
 * needs, then the same filter plates as close up.
 * @param {object} payload
 * @param {Record<string, string>} [runtime]
 * @returns {object}
 */
export function dpeAreaRowControls(payload, runtime = {}) {
  const m = messages();
  const k = m.key;
  const unit = dpeAreaUnit(payload);
  const filter = runtime?.classes ?? DPE_CLASS_FILTER_ALL;
  const shown = new Set(dpeClassFilterLetters(filter));
  const filtering = shown.size < DPE_LABELS.length;
  // The WHOLE answer, as close up: the plates the filter dims say what is
  // hidden, and how much.
  const counts = new Map();
  for (const record of areaRecords(payload)) {
    const letter = dpeAreaGrade(unit, record) || 'neutral';
    counts.set(letter, (counts.get(letter) || 0) + 1);
  }
  const channel = m.area.painted(unit);
  const legend = DPE_LABELS.map((letter) => ({
    label: letter,
    color: DPE_COLORS[letter],
    count: counts.get(letter) || 0,
    blurb: m.legend.letterBlurbShort(gradeEnergy(letter)),
    channel,
  }));
  legend.push(unit === 'sections'
    ? {
      label: m.area.sections.neutral.label(DPE_SECTION_MIN_GRADED),
      color: COLOR_UNLABELLED_CSS,
      count: counts.get('neutral') || 0,
      blurb: m.area.sections.neutral.blurb(DPE_SECTION_MIN_GRADED, payload?.summary?.gridM ?? DPE_GRID_M),
      channel,
    }
    : {
      label: m.legend.ungraded.label,
      color: COLOR_UNLABELLED_CSS,
      count: counts.get('neutral') || 0,
      blurb: m.legend.ungraded.blurb,
      channel,
    });
  let title = (letter) => k.showOnly(letter, gradeEnergy(letter));
  if (filtering) title = (letter) => (shown.has(letter) ? k.hide(letter) : k.showToo(letter));
  return {
    legend,
    legendNote: dpeAreaLegendNote(payload),
    legendColumns: 2,
    legendSegmentsLabel: k.filterLabel,
    legendSegments: DPE_LABELS.map((letter) => ({
      label: letter,
      color: DPE_COLORS[letter],
      active: shown.has(letter),
      title: title(letter),
      toggle: { param: 'classes', value: dpeClassFilterToggle(filter, letter) },
    })),
    note: dpeAreaDisclosure(payload),
    legendSelection: dpeSelectionPanel(),
  };
}

/** The share of F and G over the box's labelled ratings, one decimal, or null. */
function areaPoorShare(summary) {
  const graded = Number(summary?.graded) || 0;
  if (!graded) return null;
  const distribution = summary.distribution || {};
  return Math.round((((distribution.F || 0) + (distribution.G || 0)) / graded) * 1000) / 10;
}

/**
 * The note above the key in an area regime: what a letter is (the worse of
 * two grades), what one painted shape is, and the share of F and G the discs
 * used to carry — here, and in the whole register (A2).
 * @param {object} payload @returns {string}
 */
export function dpeAreaLegendNote(payload) {
  const m = messages();
  const unit = dpeAreaUnit(payload);
  const share = areaPoorShare(payload?.summary);
  return [
    m.key.source,
    unit === 'sections' ? m.area.sections.unit : m.area.parcels.unit,
    share !== null ? m.area.poorHere(formatNumber(share), formatNumber(DPE_POOR_SHARE_NATIONAL)) : null,
    m.area.registerNotStock,
  ].filter(Boolean).join(' · ');
}

/**
 * The A5 line in an area regime: the box, what was drawn from it, and every
 * way a rating can be on the ground without being on a shape.
 * @param {object} payload @returns {string}
 */
export function dpeAreaDisclosure(payload) {
  const m = messages().area;
  const unit = dpeAreaUnit(payload);
  const summary = payload?.summary || {};
  const spanKm = payload?.box
    ? formatDecimal((payload.box.north - payload.box.south) * 110.54, 1,
      { minimumFractionDigits: 1 })
    : null;
  const span = spanKm ? `${spanKm} km` : m.box;
  const parts = [];
  if (unit === 'sections') {
    parts.push(m.sections.drawn(span, Number(summary.sections || 0), ratings(summary.total || 0)));
    parts.push(m.sections.grid(summary.gridM ?? DPE_GRID_M));
  } else {
    parts.push(m.parcels.drawn(span, ratings(summary.total || 0), Number(summary.parcels || 0)));
    if (summary.snapped > 0) parts.push(m.parcels.snapped(ratings(summary.snapped), DPE_PARCEL_SNAP_M));
  }
  if (summary.tilesInBox > summary.tiles) parts.push(m.visibleOnly(summary.tiles, summary.tilesInBox));
  if (summary.unplaced > 0) parts.push(m.unplaced(ratings(summary.unplaced)));
  if ((summary.communesMissing || []).length) parts.push(m.communesMissing(summary.communesMissing.length));
  if (summary.tilesMissing > 0) parts.push(m.tilesMissing(summary.tilesMissing, summary.tiles));
  if (summary.tilesPartial > 0 || summary.truncated) parts.push(m.partial);
  parts.push(unit === 'sections'
    ? m.sections.descend(PARCEL_BAND_MAX_ALTITUDE_M)
    : m.parcels.descend(SCAN_CELL_MIN_ALTITUDE_M));
  const line = parts.join(' · ');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

/**
 * The section's own code as the cadastre prints it: `AH`, and `A` rather
 * than the file's zero-padded `0A`.
 */
function sectionCode(id) {
  const code = String(id || '').slice(8);
  return code.startsWith('0') ? code.slice(1) : code;
}

/** The commune a section is in, named when the proxy could name it. */
function sectionCommune(record, payload) {
  return payload?.communeNames?.[record?.communeCode] || record?.communeCode || '';
}

/**
 * The lines both area cards share: the classes present and their range, the
 * mode named as what it is, the unlabelled and the *passoires*.
 */
function areaLines(summary, record) {
  const m = messages();
  const p = m.panel;
  let range = null;
  if (summary.graded) {
    if (summary.mixed) range = p.range(summary.best, summary.worst);
    else range = summary.graded > 1 ? p.all(summary.grade) : p.one(summary.grade);
  }
  const counts = record?.counts || [];
  const tied = summary.grade
    ? summary.letters.filter((letter) => letter !== summary.grade
      && (Number(counts[DPE_LABELS.indexOf(letter)]) || 0) === summary.votes)
    : [];
  let mode = null;
  if (summary.mixed) mode = tied.length ? p.modeTie(summary.grade, tied.join(', ')) : p.mode(summary.grade);
  const poor = (Number(counts[5]) || 0) + (Number(counts[6]) || 0);
  return {
    range,
    lines: [
      mode,
      summary.ungraded ? m.site.ungraded(summary.ungraded) : null,
      poor ? m.site.poor(poor) : null,
    ].filter(Boolean),
  };
}

/**
 * The key's card for a PARCEL: its busiest address, the ratings filed on it,
 * the classes present and the one it is painted in, and how the ratings got
 * there.
 * @param {object} record @param {object} payload
 * @returns {object} The key's `legendSelection` slot.
 */
export function dpeParcelPanel(record) {
  const m = messages();
  const summary = dpeAreaSummary(record);
  const { street, locality } = dpeSplitAddress(record?.addresses?.[0]);
  const { range, lines } = areaLines(summary, record);
  const more = Number(record?.moreAddresses) || 0;
  const others = (record?.addresses || []).slice(1).map((address) => dpeSplitAddress(address).street);
  if (others.length || more) {
    lines.unshift([...others, more ? m.area.parcels.moreAddresses(more) : null].filter(Boolean).join(' · '));
  }
  if (record?.snapped > 0) lines.push(m.area.parcels.snappedCard(record.snapped));
  return {
    key: `dpe-parcel:${record?.id}`,
    title: street || m.area.parcels.fallbackTitle(record?.id ?? ''),
    meta: locality,
    headline: m.panel.count(summary.total),
    chips: summary.letters.length
      ? {
        caption: m.panel.present,
        items: summary.letters.map((letter) => ({ label: letter, color: DPE_COLORS[letter] })),
        text: range,
      }
      : null,
    lines,
    footnote: [
      summary.total > 1 ? m.panel.perDwelling : null,
      record?.id ? m.site.parcel(record.id) : null,
      m.area.parcels.descend(SCAN_CELL_MIN_ALTITUDE_M),
    ].filter(Boolean).join(' · '),
    link: { href: DPE_SOURCE_URL, label: m.panel.source },
  };
}

/**
 * The key's card for a SECTION: which section of which commune, the ratings
 * counted in it, and — when it is neutral — why.
 * @param {object} record @param {object} payload
 * @returns {object}
 */
export function dpeSectionPanel(record, payload) {
  const m = messages();
  const summary = dpeAreaSummary(record);
  const { range, lines } = areaLines(summary, record);
  const painted = dpeSectionIsPainted(record);
  lines.push(painted
    ? m.area.sections.whole(Number(record?.whole) || 0)
    : m.area.sections.neutralCard(DPE_SECTION_MIN_GRADED));
  return {
    key: `dpe-section:${record?.id}`,
    title: m.area.sections.title(sectionCode(record?.id), sectionCommune(record, payload)),
    meta: null,
    headline: m.panel.count(summary.total),
    chips: summary.letters.length
      ? {
        caption: m.panel.present,
        items: summary.letters.map((letter) => ({ label: letter, color: DPE_COLORS[letter] })),
        text: range,
      }
      : null,
    lines,
    footnote: [
      m.area.sections.grid(payload?.summary?.gridM ?? DPE_GRID_M),
      m.area.sections.descend(PARCEL_BAND_MAX_ALTITUDE_M),
    ].join(' · '),
    link: { href: DPE_SOURCE_URL, label: m.panel.source },
  };
}

/**
 * The card on the globe for a shape — its title and the lines the key would
 * print, flattened, for when the key is folded or on a phone.
 * @param {{kind: string, record: object}} shape @param {object} payload
 * @returns {{title: string, details: string[]}}
 */
export function dpeAreaCard(shape, payload) {
  const panel = shape?.kind === 'section'
    ? dpeSectionPanel(shape.record, payload)
    : dpeParcelPanel(shape?.record);
  return {
    title: panel.title,
    details: [
      panel.meta,
      [panel.headline, panel.chips?.text].filter(Boolean).join(' · '),
      ...panel.lines,
      panel.footnote,
    ].filter(Boolean),
  };
}

/** The tag a selected shape keeps on the globe: `C–E · 16`. */
export function dpeAreaTag(shape) {
  const summary = dpeAreaSummary(shape?.record);
  let letters = '?';
  if (summary.graded) letters = summary.mixed ? `${summary.best}–${summary.worst}` : summary.grade;
  return summary.total > 1 ? `${letters} · ${formatNumber(summary.total)}` : letters;
}

/**
 * The card for a click on the ground, in an area regime. Null in the disc
 * regime — its marks are entities with cards of their own — and off every
 * shape, so the click falls through to a dismissal.
 */
function dpeAreaGroundCard({ lon, lat, payload }) {
  if (!dpeAreaUnit(payload)) return null;
  const shape = _areaLevels.shapeAt(lon, lat);
  // Read against the answer the shape was painted from — inside the band a
  // section and a parcel come from two answers.
  return shape ? dpeAreaCard(shape, _areaLevels.payloadOf(shape) || payload) : null;
}

/**
 * What one area answer paints through the class filter: a shape per parcel or
 * section holding a shown letter, in its letter's colour.
 * @param {object} payload @param {Set<string>} shown
 * @returns {{items: Array<object>, style: ?object}}
 */
function dpeAreaPaint(payload, shown) {
  const unit = dpeAreaUnit(payload);
  if (!unit) return { items: [], style: null };
  const kind = unit === 'parcels' ? 'parcel' : 'section';
  const items = dpeFilterAreaRecords(areaRecords(payload), shown).map((record) => ({
    id: `dpe-${kind}:${record.id}`,
    kind,
    record,
    parts: record?.parts,
    css: dpeAreaColorCss(unit, record, shown),
  }));
  return { items, style: DPE_AREA_STYLE[unit] };
}

/**
 * Paint an area answer as the shell's level; the other level follows
 * (`scanAreaFade.js`).
 * @returns {number} Shapes drawn.
 */
function drawDpeArea(payload, context) {
  if (!dpeAreaUnit(payload) || !context?.viewer?.scene?.primitives) {
    _areaLevels.clearAll();
    return 0;
  }
  return _areaLevels.primary(payload, context);
}

/** Take both area levels and the selection off the globe. */
function clearAreaDraw() {
  _areaLevels.clearAll();
  _areaUnit = null;
  _areaPayload = null;
  _selectedShape = null;
}

/**
 * The query for one scan: the disc close up; above 600 m the box, narrowed to
 * the tiles the screen shows (`scanRegime.scanTileMask`) — the reader's
 * « ne charge que ce qui est dans la vue ».
 * @param {?object} point The scan point.
 * @param {?{south: number, west: number, north: number, east: number}} view
 * @returns {Record<string, string>}
 */
export function dpeScanParams(point, view) {
  const cells = scanCellParams(point);
  if (!Object.keys(cells).length) return { radius: String(SCAN_RADIUS_M), limit: String(SCAN_LIMIT) };
  const band = scanBandFor(point);
  const box = {
    south: Number(cells.south), west: Number(cells.west), north: Number(cells.north), east: Number(cells.east),
  };
  const tiles = scanTileMaskParam(scanTileMask(box, band.tileDeg, view));
  return tiles ? { ...cells, tiles } : cells;
}

/**
 * What the area regime puts in `getStats()`.
 * @param {object} payload @returns {object}
 */
function dpeAreaSummarize(payload) {
  const unit = dpeAreaUnit(payload);
  const summary = payload?.summary || {};
  const distribution = summary.distribution || {};
  const share = areaPoorShare(summary);
  const controls = dpeAreaRowControls(payload);
  return {
    // `scanBasis` is what tells a caller which question was answered — the
    // voice surface reads it before quoting a number.
    scanBasis: unit,
    shapeCount: unit === 'sections' ? (summary.sections ?? 0) : (summary.parcels ?? 0),
    diagnosticsTotal: summary.total ?? 0,
    distribution,
    poorCount: (distribution.F || 0) + (distribution.G || 0),
    poorShare: share,
    poorShareNational: DPE_POOR_SHARE_NATIONAL,
    // The four ways a rating lands, published rather than only printed.
    placedInside: summary.inside ?? 0,
    placedSnapped: summary.snapped ?? 0,
    unplaced: summary.unplaced ?? 0,
    // How much of the box was asked for: the tiles on screen, of its four.
    tilesLoaded: summary.tiles ?? null,
    tilesInBox: summary.tilesInBox ?? summary.tiles ?? null,
    tilesMissing: summary.tilesMissing ?? 0,
    coverage: controls.note,
    legend: controls.legend,
  };
}

const dpeScanLayer = createAddressScanLayer({
  id: 'dpe-fr',
  // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
  name: THEME_LABEL,
  icon: '▤',
  source: 'ADEME — Observatoire DPE',
  // i18n-ignore-end
  endpoint: '/api/dpe',
  updateInterval: UPDATE_INTERVAL_MS,
  // Two questions, one route — see `dvfSales.js` for the contract.
  params: (point, viewer) => dpeScanParams(point, cameraViewBox(viewer)),
  // Half a tile in an area regime — the box is snapped, so a smaller move asks
  // the identical question. See `dvfSales.js`.
  minShiftKm: () => (_areaUnit ? 0.6 : ADDRESS_SCAN_MIN_SHIFT_KM),
  // ON, since the layer paints the cadastre from altitude: a classification
  // primitive reads its surface once, when it is built, so a draw addressed to
  // terrain survives a switch to the photoreal stack by showing nothing.
  redrawOnMapStack: true,
  // The classes the key shows. A filter over diagnostics already served, so it
  // redraws from the answer in hand and never reaches `params` — see
  // `dpeClassFilterToggle` and `DPE_CLASS_FILTER_VALUES`.
  runtimeParams: {
    classes: { values: DPE_CLASS_FILTER_VALUES, defaultValue: DPE_CLASS_FILTER_ALL },
  },
  drawOnlyParams: ['classes'],
  // The card goes to the key and the globe keeps a tag over the site, lit in
  // white on the ground — see the section above `dpeScanLayer`.
  onSelectionChange: onDpeSelectionChange,
  compactCard: dpeCompactCard,
  onClear: () => {
    clearSiteHighlight();
    clearPills();
    // NOT `clearAreaDraw`: the shell calls this before every redraw too, and
    // the levels keep what they hold until the new draw has built. When no
    // redraw follows (dormant above the ceiling) they go at the end of the task.
    _areaLevels.cleared();
    _areaUnit = null;
    _areaPayload = null;
    _selectedShape = null;
    _selectedSiteKey = null;
    _selectedCard = null;
  },
  // A parcel or a section is a geometry instance, not an entity: this is how a
  // click on one reaches `groundCard` instead of being ignored as nobody's.
  ownsPick: isDpeAreaPickId,
  groundCard: dpeAreaGroundCard,
  // Plates that touch are grouped into one pill — see the section above.
  clusterClick: zoomIntoCluster,
  onSeat: () => { declutter(); },
  afterDraw: () => { declutter(); },

  render({ payload, dataSource, viewer, point, runtime }) {
    _dataSource = dataSource;
    _drawViewer = viewer || _drawViewer;
    // The class filter from the key, applied to what is DRAWN and PAINTED and
    // never to what is counted: the key's counts and the row's coverage stay
    // the whole answer, so a reader can see what the filter is hiding.
    const filter = runtime?.classes ?? DPE_CLASS_FILTER_ALL;
    const shown = new Set(dpeClassFilterLetters(filter));
    // The payload decides, not the camera — see `dvfSales.js`. `cells` is the
    // shape a box answer had until 2026-09-22; a browser may hold one for the
    // five minutes its HTTP cache allows, and nothing of it is drawn.
    const unit = dpeAreaUnit(payload);
    if (unit || Array.isArray(payload?.cells)) {
      // The volumes are painted from a building's own diagnostics and a shape
      // seen from altitude holds counts, not rows. Withdrawn rather than left
      // standing: a city tinted from the block the reader flew away from is
      // the failure `withdrawTheme` exists for, reached by a different road.
      _entries = [];
      _sites = [];
      _allSites = [];
      _join = null;
      _themeDirty = false;
      withdrawTheme();
      const drawn = drawDpeArea(payload, {
        viewer, point, classificationType: gpuClassificationTypeForScene(viewer?.scene), runtime,
      });
      _areaUnit = unit;
      _areaPayload = payload;
      drawScanBoundary(dataSource, { id: 'dpe:scan-edge', box: payload.box });
      return drawn;
    }
    // Back under 600 m: whatever the box drew goes, even if the shell's own
    // teardown did not run first. A hard cut, not a fade: the disc answers 200
    // ratings at most within 200 m of one point, not a finer reading of the
    // box's parcels — see `scanRegime.scanAreaLevelsAt`.
    clearAreaDraw();
    const everything = shown.size === DPE_LABELS.length;
    _entries = everything
      ? (payload.entries || [])
      : (payload.entries || []).filter((entry) => shown.has(dpeGradeOf(entry)));
    // The proxy resolves the sites, because it is the only side that can buy
    // their shapes. `groupDpeSites` is run here anyway when it could not — an
    // RNB outage, a stale payload cached before this change — so the grouping
    // that stops forty-two badges sharing one pixel never depends on an
    // upstream. Those sites simply have no outline.
    _allSites = Array.isArray(payload.sites) && payload.sites.length
      ? payload.sites
      : groupDpeSites(payload.entries || []);
    _sites = dpeFilterSites(_allSites, filter);
    // Before the first billboard: the badge's size and its card both depend on
    // which volume the site landed on, and a marker drawn at 20 px and shrunk a
    // frame later is a flicker the reader has to interpret.
    _join = computeJoin(_entries);
    _themeDirty = true;

    const classificationType = gpuClassificationTypeForScene(viewer?.scene);
    let drawn = 0;
    for (const site of _sites) {
      drawSiteGround(dataSource, site, classificationType);
      if (!Number.isFinite(site.lon) || !Number.isFinite(site.lat)) continue;
      const painted = sitePaintedSummary(site);
      const letter = site.summary?.grade ?? null;
      const size = dpeMarkerSizePx(letter, painted?.grade ?? null);
      dataSource.entities.add({
        id: `dpe:${site.key}`,
        position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat),
        billboard: {
          // THE LETTER ITSELF, framed. A DPE dot next to a DVF dot said
          // nothing about which register either came from, and the colour
          // channel was already spent on the official scale. Drawing the label
          // solves both at once: the shape says DPE, and the grade no longer
          // needs a click. See `addressMarkerIcons.js`.
          image: addressMarkerGlyph(`dpe:${dpeLetterKind(letter)}`),
          // Size is one statement: how much of this site the volume under it is
          // not already making. Full when nothing is painted, when the painted
          // letter differs, or when no letter was published; quiet when the roof
          // already says exactly this.
          width: size,
          height: size,
          // The glyph is white line-art; this tint is the official A–G scale.
          color: dpeColor(letter),
          // POSITIVE_INFINITY, not a distance. With a finite value the marker is
          // depth-tested as soon as the camera is further away than that, and
          // the terrain then eats the bottom half of every glyph — the reported
          // symptom was "the dots don't display properly", and at city zoom
          // they were rendering clipped by the ground under them. These are
          // annotations ON the world, not objects IN it.
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          kind: 'dpe',
          siteKey: site.key,
          etiquetteDpe: letter,
          diagnostics: site.summary?.total ?? site.points?.length ?? 0,
          rnbId: site.shape?.rnbId ?? site.rnb ?? null,
          parcelle: site.parcel?.idu ?? null,
          buildingGrade: painted?.grade ?? null,
        },
        name: dpeSiteTitle(site),
        description: dpeSiteCardDescription(site, painted, Boolean(_join.buildings)),
      });
      drawn += 1;
    }
    // The edge of the scanned disc — see `dvfSales.js` and `scanBoundary.js`.
    // Never counted: `drawn` is badges, and the row prints badges.
    drawScanBoundary(dataSource, {
      id: 'dpe:scan-edge',
      centre: point,
      radiusM: SCAN_RADIUS_M,
    });
    return drawn;
  },

  /**
   * Three marks, one subject: the footprint, the parcel line and the badge all
   * belong to one site, so a click on any of them selects the BADGE — the one
   * mark that has a size to grow and a colour to take. Without this the reader
   * clicks a building, gets the right card, and sees nothing change.
   */
  selectionFor(entityId) {
    const id = String(entityId ?? '');
    for (const prefix of ['dpe:bati:', 'dpe:parcelle:']) {
      if (!id.startsWith(prefix)) continue;
      // `dpe:bati:<key>:<part>` and `dpe:bati:<key>:<part>:<ring>` both name
      // the same site, so the trailing indices are stripped rather than parsed.
      const key = id.slice(prefix.length).replace(/(:\d+)+$/, '');
      return key ? `dpe:${key}` : null;
    }
    return null;
  },

  // Inside the fade band the key and the stats are the DOMINANT level's: the
  // sections' near the band's top, where they still outweigh the parcels the
  // shell holds.
  rowControls: (runtime, _summary, payload) => (dpeAreaUnit(payload)
    ? dpeAreaRowControls(_areaLevels.ownerPayload(payload), runtime)
    : dpeRowControls(payload, runtime)),

  summarize: (payload) => dpeSummarize(_areaLevels.ownerPayload(payload)),
});

/**
 * The scan layer, plus the theme lifecycle around it.
 *
 * Composition rather than a hook inside `addressScanLayer.js`: four sibling
 * layers share that shell and none of them paints a volume, so the seam belongs
 * to whichever layer opens it. The shell's own methods are kept by reference —
 * they close over its state, and none of them reads `this`.
 */
const dpeFranceLayer = {
  ...dpeScanLayer,

  // The lifecycle results are forwarded, not swallowed: the manager reads
  // `!== false` off each of these to decide whether a failed enable was cleanly
  // torn down, and a wrapper that returned its own `undefined` would answer for
  // a shell it did not ask.
  enable(...args) {
    _enabled = true;
    // Nothing is registered yet: the shell is about to force the next update to
    // rescan, and painting the city from a payload fetched three cities ago is
    // exactly the lie the wash is there to prevent.
    _entries = [];
    _sites = [];
    _allSites = [];
    _join = null;
    _themeDirty = false;
    clearAreaDraw();
    withdrawTheme();
    // Claimed so the sibling handlers that track or select read a click on a
    // parcel as somebody's and leave it alone — see `pickRegistry.js`.
    registerPickOwner('dpe-fr', isDpeAreaPickId);
    // A settle is finer than the half-view change Cesium re-clusters on.
    _removeMoveEnd?.();
    _removeMoveEnd = args[0]?.camera?.moveEnd?.addEventListener?.(() => { declutter(); }) || null;
    _areaLevels.enable(args[0]);
    return dpeScanLayer.enable(...args);
  },

  disable(...args) {
    _enabled = false;
    _entries = [];
    _sites = [];
    _allSites = [];
    clearSiteHighlight();
    _selectedSiteKey = null;
    _selectedCard = null;
    _join = null;
    _themeDirty = false;
    // Before the shell hides the markers, so the volumes and the badges leave
    // together rather than the city staying painted by a layer that is off.
    withdrawTheme();
    _removeMoveEnd?.();
    _removeMoveEnd = null;
    clearPills();
    const result = dpeScanLayer.disable(...args);
    // After the shell, which keeps its payload and redraws from a fresh scan
    // on `enable` — so the shapes go now rather than sitting on a hidden
    // layer's ground.
    _areaLevels.disable();
    clearAreaDraw();
    unregisterPickOwner('dpe-fr');
    return result;
  },

  destroy(...args) {
    _enabled = false;
    _entries = [];
    _sites = [];
    _allSites = [];
    clearSiteHighlight();
    _selectedSiteKey = null;
    _selectedCard = null;
    _drawViewer = null;
    _join = null;
    _themeDirty = false;
    _removeMoveEnd?.();
    _removeMoveEnd = null;
    clearPills();
    _dataSource = null;
    _rowControlsListener = null;
    withdrawTheme();
    const result = dpeScanLayer.destroy(...args);
    _areaLevels.disable();
    clearAreaDraw();
    unregisterPickOwner('dpe-fr');
    return result;
  },

  async update(...args) {
    const ok = await dpeScanLayer.update(...args);
    // The shell clears its draw when the camera climbs above the scan ceiling.
    // The theme has to go with it: a wash held over from 300 m up would claim
    // the whole region is undiagnosed on the strength of a 200 m disc.
    if (dpeScanLayer.getStats().dormant) {
      _entries = [];
      _sites = [];
      _allSites = [];
      _join = null;
      _themeDirty = false;
      withdrawTheme();
      return ok;
    }
    if (_themeDirty) publishTheme();
    return ok;
  },

  /**
   * The manager pushes a repaint callback here so a row can update outside its
   * own refresh tick — which is what a deferred badge re-sync needs after the
   * volume layer repaints on its own schedule.
   * @param {?Function} listener
   */
  setRowControlsListener(listener) {
    _rowControlsListener = typeof listener === 'function' ? listener : null;
    dpeScanLayer.setRowControlsListener?.(listener);
  },

  /**
   * What the area regime has on the globe, for the harnesses: a Cesium
   * primitive does not live in the data source the shell counts.
   * @returns {{unit: ?string, shapes: number, fills: number, ready: boolean}}
   */
  getAreaDraw() {
    return { unit: _areaUnit, ..._areaLevels.stats() };
  },
};

/* ── test seams ────────────────────────────────────────────────────────── */

/**
 * Drive the theme without a viewer: seed the drawn diagnostics, run the join
 * against whatever `bdtopoBuildings.js` currently holds, and publish.
 *
 * The same order the render path uses — join, then publish — so a test cannot
 * accidentally prove a sequence the layer never runs.
 *
 * @param {Array<object>} entries Diagnostics, with or without coordinates.
 * @param {{dataSource?: object, enabled?: boolean}} [options]
 * @returns {object} the join, in the shape `summarize()` reads.
 */
export function _seedDpeThemeForTest(entries, {
  dataSource = null, enabled = true, sites = null,
} = {}) {
  _enabled = enabled;
  _dataSource = dataSource;
  _entries = entries || [];
  // Grouped exactly as `render()` does when the proxy served no sites, so a
  // test that seeds raw diagnostics exercises the same badge keys the layer
  // draws rather than a shape only the test knows about.
  _sites = sites || groupDpeSites(_entries);
  _allSites = _sites;
  _join = computeJoin(_entries);
  _themeDirty = true;
  publishTheme();
  return _join;
}

/** Resize the badges of a seeded data source from the current join. */
export function _applyDpeBadgesForTest(selectedId = null) {
  return applyBadges(selectedId);
}

/** Forget everything this module remembers between tests. */
export function _resetDpeThemeForTest() {
  _enabled = false;
  _entries = [];
  _sites = [];
  _allSites = [];
  _selectedSiteKey = null;
  _selectedCard = null;
  _join = null;
  _themeDirty = false;
  _dataSource = null;
  _rowControlsListener = null;
  withdrawTheme();
}

export default dpeFranceLayer;
