/**
 * @module sitadelFrance
 *
 * Sitadel — the only forward-looking layer on this globe, drawn on the exact
 * parcels the permits were granted for.
 *
 * `sitadelFeed.js` holds the join and every trap in it. This file is the
 * drawing, and it exists to settle three questions the feed deliberately
 * leaves open: WHERE the layer is allowed to ask, WHAT the two channels claim,
 * and HOW the permits it could not place stay visible without being drawn.
 *
 * ── Against the layer it sits beside ────────────────────────────────────────
 *
 * `dvf-sales` draws completed transactions: what changed hands, for how much,
 * with a latitude and a longitude already in the file. This draws
 * AUTHORISATIONS — what somebody has been given permission to build and has
 * not necessarily built. DVF looks backwards at price, Sitadel forwards at
 * supply, and on the same parcel the two compose. `bdtopo-buildings` is the
 * stock as surveyed and `urbanisme-gpu` is the rule; a permit is the moment
 * between them.
 *
 * Sitadel publishes NO coordinate — 94 columns on the housing file, 33 on the
 * demolitions, and `geoFields: ["REG","DEP"]` on both. Every position here was
 * computed by joining a cadastral reference to `cadastre-fr`'s own upstream,
 * so every card ends by saying so and by publishing the rate at which that
 * computation succeeded.
 *
 * ── ONE regime, and the arithmetic that forbids a second ────────────────────
 *
 * The four Sitadel files hold 3 020 749 permits over 1.30 GB of CSV, and DiDo
 * answers a filtered, column-projected commune query by SCANNING the whole
 * file: measured 2026-09-02, six sequential queries returned in 3.57–5.01 s
 * whatever their size — Nantes (2 049 rows) took 3.98 s and a single-column
 * probe of the same commune took 3.57 s. A national mesh regime would be
 * 34 945 commune queries at ~4 s, which is 39 hours for one pass. There is no
 * honest maillage, so this layer answers ONE COMMUNE at a time and says which.
 *
 * That also fixes the concurrency, and this is the measurement nobody upstream
 * of this file had: **DiDo refuses a fourth simultaneous request.** Six
 * parallel queries on 2026-09-02 returned three HTTP 200 and three HTTP 429
 * within 145 ms, body `max connections reached: 3` — 26 bytes of plain text,
 * with no `content-type`, no `retry-after` and NO `access-control-allow-origin`,
 * so a browser could not even read the refusal. Three at once are all served.
 * The proxy therefore holds a global semaphore of two and this layer never
 * fetches a second commune while one is in flight.
 *
 * ── The gate: 12 000 m, measured against the communes themselves ────────────
 *
 * At {@link SITADEL_MAX_ALTITUDE_M} a nadir camera at Cesium's default 60°
 * vertical FOV (`VIEW_GATE_DEFAULT_FOV_DEG`) sees 2·h·tan 30° = 13.86 km of
 * ground. The communes this layer answers with are 12.13 km wide (Nantes),
 * 13.29 km (Toulouse) and 17.85 km (Paris) — measured from the outer bounds of
 * their own Etalab cadastre, not estimated. Above that height the answer would
 * be one commune inside a view holding twenty, and the empty ground either side
 * would read as "no permits here" when it means "never asked".
 *
 * There is NO coverage rectangle, deliberately. Sitadel covers the DROM and so
 * does the Etalab cadastre: Saint-Denis de La Réunion (97411) answers with
 * 2 849 permits and a 10 449 654-byte parcel file. A metropolitan box would
 * have refused all of it while claiming national coverage, so the question
 * "is there a French commune under the middle of the screen" is put to
 * `geo.api.gouv.fr`, which is the only service entitled to answer it.
 *
 * ── What the two channels claim ─────────────────────────────────────────────
 *
 * The FILL on a parcel is the lifecycle band of the MOST RECENT authorisation
 * that names it — `ETAT_DAU` read through the three real dates. That is the
 * whole point of the layer: `2` Autorisé is a permit about which nothing
 * further has been reported, `5` Chantier ouvert has a DATE_REELLE_DOC, `6`
 * Travaux achevés has a DATE_REELLE_DAACT, and a permis de démolir is its own
 * band because its own `ETAT_PD` says nothing (1 497 of Nantes' 1 587
 * demolitions and 1 582 of Paris' 1 609 sit at Autorisé). A parcel that
 * carries several permits over thirteen years is coloured by the newest and
 * its card counts the rest; measured on Nantes, 2 747 placed permits sit on
 * 3 032 parcels, so the collision is rare and naming it is cheaper than
 * inventing a rule for it.
 *
 * ── The mark: one badge per permit, and the parcel under it ───────────────
 *
 * Since the approved mock of « Urbanisme » (2026-09-23) a permit is a BADGE —
 * a rounded square in its band colour with a building on it, struck through
 * for a demolition — standing on the anchor of the largest parcel it names,
 * with the parcel washed and outlined in the same colour under it. The badge
 * and its colours are `permitProjects.js`'s, which `ads-fr` draws too: the
 * row's two permit layers now wear ONE palette, and the key prints it once.
 *
 * WHAT IT REPLACED. A dot sized by the square root of the dwellings created,
 * and a 12 m opaque COLUMN per dossier, one metre per dwelling. Both were
 * honest encodings (the column was already the fix for extruding the parcel
 * itself, which had drawn a 45-dwelling permit in Ustaritz as 404 000 m³ of
 * orange), and neither read: a street of columns of four colours is a skyline,
 * not an answer, and the operator asked for the mock's marks. The dwelling
 * count moved to where it is read as a number — the tag the globe keeps over
 * a selected permit (« 40 logements ») and the first line of its card.
 *
 * ONE SIZE FOR EVERY BADGE, scaled down with distance so a commune seen from
 * 10 km is not one blot. A demolition is a badge like the others: the file has
 * 33 columns and none counts a dwelling, and the card says what it removes.
 *
 * A BADGE NEEDS A FLOOR, and a cold floor is not a floor. Billboards draw
 * through depth (`disableDepthTestDistance: Infinity`), so a badge built at
 * the ellipsoid — 44–55 m under metropolitan France — slides across the
 * rooftops with every camera move: measured over Paris on 2026-09-14, all
 * 4 753 dots of the old layer sat at 1.0 m while the drawn mesh read
 * 76.7–96.9 m. `sitadelFloorM` is the floor every mark reads — badge, card,
 * DETECT callout — and `reanchorPoints` re-seats the badges already on screen
 * once their floor lands.
 *
 * ── The period ──────────────────────────────────────────────────────────────
 *
 * The pack is the whole commune since 2013; the row's « Période » (the same
 * four windows as `ads-fr`, whose share-link option this layer mirrors)
 * keeps the permits AUTHORISED inside the window and draws nothing else. The
 * filter runs on the pack in hand: changing the period costs a redraw and no
 * request.
 *
 * ── What changes under the photorealistic stack ─────────────────────────────
 *
 * The parcels stay ground-classified, so on Google 3D they classify as
 * `CESIUM_3D_TILE` and the wash climbs the façades — the drape defect
 * `surfaceFillNotice.js` describes, which is why `getRowControls` declares
 * `surfaceFill` whenever a parcel is washed.
 *
 * The commune OUTLINE is not decoration. It is the scope of the answer, and
 * without it the neighbouring commune reads as "nothing was authorised here"
 * rather than "this was never asked". It is drawn from `geo.api.gouv.fr`'s own
 * `contour`, decimated by `projectGeometry` — Nantes 804 vertices to 269, Paris
 * 532 to 267, Toulouse 1 191 to 398 — which moves the drawn boundary by a mean
 * of 3.6–8.8 m and at worst 183 m (Nantes), 125 m (Paris), 242 m (Toulouse).
 * The row says the outline is simplified. It is never used to decide anything:
 * the commune under the camera is resolved upstream, by the geocoder.
 *
 * ── What is NOT drawn, and where it goes instead ────────────────────────────
 *
 * Measured 2026-09-02 over six communes, both files, against the Etalab
 * cadastre edition 2026-06-01:
 *
 *   Paris      75056   5 204 permits   4 753 placed  91.3%     0 ambiguous
 *   Nantes     44109   3 636           2 747         75.6%     0
 *   Ustaritz   64547     432             238         55.1%     0
 *   Beaupréau  49023     888             484         54.5%   294
 *   Marseille  13055   5 424           1 092         20.1%  4 007
 *   Toulouse   31555   5 687             430          7.6%  5 148
 *   ─────────────────────────────────────────────────────────────
 *   total             21 271           9 744         45.8%
 *
 * 45.8% is almost exactly the 44.8% DREAL Auvergne-Rhône-Alpes reached on the
 * same data with more time (362 038 permits, 162 171 with a geometry), which is
 * the correct calibration for anyone reading these numbers as a failure.
 *
 * The 11 527 that are not drawn are COUNTED on the row, in `getStats()` and on
 * every card, and they are not in the LEGEND — the panel's swatch IS the datum,
 * and there is no colour for a permit that is nowhere. Nothing is moved to a
 * commune centroid. The three failures are kept apart because a reader can act
 * on the difference: *ambiguous* means the commune publishes section préfixes
 * that Sitadel has no column for and NOTHING will fix it, *missing* means the
 * parcel was divided and renumbered — which is what happens when somebody
 * builds on it — and *noref* means the file is blank.
 *
 * ── The audit agrees with the diagnosis ─────────────────────────────────────
 *
 * `SUPERFICIE_TERRAIN` is the plot the applicant declared. It places nothing;
 * it audits. Over the same six communes the share of placed permits whose drawn
 * parcels agree with the declared terrain within a factor of two ranks the
 * communes in the SAME order as the placement rate: Paris 98.4% (4 556/4 630),
 * Nantes 94.2% (2 387/2 533), Beaupréau 86.4%, Ustaritz 84.7%, Marseille 68.6%,
 * Toulouse 51.5% (212/412). An independent measurement agreeing with the join
 * rate is the strongest evidence available that the parcels drawn under the
 * top of that table are the right ones — and the clearest possible warning
 * about the bottom of it. Every card prints its own permit's ratio and the
 * word CONCORDANT or DISCORDANT.
 *
 * ── Two of Sitadel's four files are not read ────────────────────────────────
 *
 * This layer reads the housing register (1 917 260 permits) and the demolitions
 * (202 895) — 2 120 155 of the 3 020 749, or 70.2%. The 792 588 non-residential
 * permits and the 108 006 permis d'aménager are not read, and that is a real
 * hole: Nantes alone has 1 881 non-residential permits and 129 permis
 * d'aménager on top of the 3 636 drawn here, measured through the same URLs.
 * They are omitted because the non-residential file answers a different
 * question — surfaces by destination across seven families, with no dwelling
 * count to size a dot by — and because a third and fourth concurrent DiDo query
 * is exactly the request DiDo answers with 429. The row says two files.
 */

import * as Cesium from 'cesium';
import { governorRequestRender } from '../renderGovernor.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import { publishJoin } from './layerJoins.js';
import { cadastralParcelId } from './buildingDossier.js';
import {
  registerSpriteCollection,
  restoreSpriteOrder,
  unregisterSpriteCollection,
} from './spriteOrder.js';
import { cachedGroundFloor, warmGroundFloor } from './groundFloor.js';
import {
  provisionalFloor,
  provisionalFloorRetryDelayMs,
  sampleProvisionalFloors,
} from './provisionalFloor.js';
import { cameraViewBox } from './viewGate.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import { powerClassificationTypeForScene, powerClassificationTypeForStack } from './powerGrid.js';
import {
  SITADEL_BANDS,
  SITADEL_LICENCE,
  SITADEL_SOURCE,
  buildSitadelPermitCard,
  buildSitadelPermitDetails,
  finiteOrNull,
  sitadelBandColor,
  sitadelBandLabel,
  sitadelLoadingLabel,
  sitadelNatureLabel,
  sitadelPermitTitle,
  sitadelTypeLabel,
  sitadelUnplacedLines,
} from './sitadelFeed.js';
import {
  PERMIT_BADGE_PX,
  PERMIT_BADGE_SELECTED_PX,
  permitBadgeImage,
  permitClassOfSitadelBand,
  permitProjectCard,
  permitProjectFoldTitle,
  permitProjectLegend,
  permitProjectTag,
  PERMIT_DRAWN_ON_PARCEL_JOIN,
} from './permitProjects.js';
import { mapKeyCarriesSelection, watchMapKeyCarriesSelection } from './mapKeySelection.js';
import { dossierKey } from './adsFeed.js';
import { formatNumber, formatPercent } from '../i18n/format.js';
import messages from './sitadelFrance.i18n.js';
import { pickAt } from './pickAt.js';
import { serverFailureMessage } from '../i18n/serverMessages.js';

/** Layer id — also the share-link registry key and the voice-tool enum value. */
export const SITADEL_FR_LAYER_ID = 'sitadel-fr';

/** Selected-permit card, on its own protected overlay source. */
export const SITADEL_FR_OVERLAY_SOURCE_ID = 'sitadel-fr-selected';
export const SITADEL_FR_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});

/** Keyless, same-origin. See `sitadelFranceProxy` in vite.config.js. */
// i18n-ignore-next-line — a route, not prose
export const SITADEL_COMMUNE_URL = '/api/sitadel-fr/commune';

/**
 * Highest camera this layer will ask from.
 *
 * 12 000 m. At Cesium's default 60° vertical FOV a nadir camera sees
 * 2 · 12 000 · tan 30° = 13 856 m of ground, and the communes this layer
 * answers with are 12.13 km (Nantes), 13.29 km (Toulouse) and 17.85 km (Paris)
 * across — measured from the bounds of their own Etalab parcel files on
 * 2026-09-02. One commune is the whole answer, so the gate is set where one
 * commune is most of the view.
 */
export const SITADEL_MAX_ALTITUDE_M = 12_000;

/**
 * Grid the camera focus is rounded onto before the commune is re-asked.
 *
 * 0.01° ≈ 1.11 km north–south. Panning inside a cell asks nothing at all;
 * crossing one costs a reverse geocode the proxy answers from memory, and the
 * pack is only re-fetched when the INSEE code actually changes — which is why
 * the request carries `have=`. The gap between this grid and the commune
 * boundary is deliberate: an approximate boundary must never be what decides
 * whether a permit belongs to the commune under the camera.
 */
export const SITADEL_FOCUS_GRID_DEG = 0.01;

/**
 * Fill alpha for a parcel.
 *
 * 0.42 — higher than `fraicheur-fr`'s 0.34 and lower than an opaque fill,
 * because these are 800 m² plots rather than parks: at street level a parcel
 * covers a few hundred screen pixels and a 0.34 fill over a photoreal roof is
 * not a colour anyone can name. `cadastre-fr` and `urbanisme-gpu` clamp their
 * own surfaces to the same ground, so the boundary underneath still has to
 * read through.
 */
export const SITADEL_FILL_ALPHA = 0.42;

/** Commune boundary — the scope of the answer, not a datum. */
export const SITADEL_OUTLINE_COLOR = '#7f8ea3';
const OUTLINE_WIDTH_PX = 2;
const OUTLINE_ALPHA = 0.75;

/**
 * Parcel edge, in the parcel's own band colour: the mock outlines each plot in
 * the colour of the badge standing on it, and two adjacent plots in the same
 * band still read as two.
 */
const PARCEL_EDGE_ALPHA = 0.9;
const PARCEL_EDGE_WIDTH_PX = 1.8;

const SELECTED_COLOR = '#00ffff';
const SELECTED_WIDTH_PX = 5;

/** A badge at full size up to 500 m of camera distance, 40 % of it from 10 km. */
const BADGE_SCALE = new Cesium.NearFarScalar(500, 1, 10_000, 0.4);

/**
 * The windows of the row's « Période », the same four as `ads-fr`: 6 months,
 * 1 year, 3 years, and the whole of Sitadel (13 years). A closed set, like
 * every param reachable from a share link.
 */
export const SITADEL_WINDOWS = Object.freeze(['6', '12', '36', '156']);
/** The window a reader who has chosen nothing is on — `ads-fr`'s. */
export const SITADEL_WINDOW_DEFAULT = '36';

/**
 * Idle refresh.
 *
 * Six hours, and it is generous: DiDo publishes monthly (`frequency: "monthly"`,
 * `frequency_date: "2026-09-29"` on dataset 6513f0189d7d312c80ec5b5b) and the
 * Etalab cadastre republishes about quarterly (`latest` resolved to the
 * 2026-06-01 edition on 2026-09-02). This exists so a session left open across
 * a publication does not keep drawing the previous millésime, not because
 * anything moves.
 */
const UPDATE_INTERVAL_MS = 6 * 60 * 60_000;
/** A cold commune build is 5.9–6.6 s measured end to end; the timeout has to clear it. */
const REQUEST_TIMEOUT_MS = 60_000;
const CAMERA_DEBOUNCE_MS = 450;

/** Card anchor lift above the ground floor, in metres. */
const CARD_LIFT_M = 4;
/** Badge lift above the ground floor, in metres. */
const POINT_LIFT_M = 1;
/** Ground-floor warm-up budget. Paris draws 4 753 badges; the floor grid is coarse. */
const FLOOR_WARM_LIMIT = 600;
/**
 * How far a cell the probe budget did not reach may borrow a sampled floor
 * from, in km.
 *
 * One commune, and the largest this layer answers with is 17.85 km across
 * (Paris, measured from its own Etalab parcel file). A borrowed floor inside
 * that radius is a reading from the same city basin; `provisionalFloor.js`'s
 * own 25 km default would reach into the next one. It is always a stand-in:
 * the cell is re-probed as soon as its tiles drain, and the DEM overrides it
 * outright when it lands.
 */
const FLOOR_FILL_KM = 18;
/**
 * Metres a floor has to move before a badge is rewritten.
 *
 * A quarter of a metre — `renderedSurface.js`'s own seating epsilon. Below it
 * the write is invisible at any camera this layer draws at, and the comparison
 * runs over every dot in the commune on every deferred pass.
 */
const FLOOR_EPSILON_M = 0.25;
/**
 * Ellipsoidal band a floor has to fall in to be believed, because this layer
 * only ever answers for FRENCH ground.
 *
 * −100 m to 5 000 m. The low bound clears every French sea-level shore
 * including the Antilles, where the geoid runs about −42 m, and the Dunkerque
 * polders at −4 m under a +47 m geoid; the high bound clears Mont Blanc
 * (4 809 m under a ~+52 m geoid).
 *
 * It exists because the WORLD band `provisionalFloor.js` guards with (−500 m,
 * the Dead Sea shore) is too wide to catch the failure that actually happens.
 * Measured over Nantes on 2026-09-14, with the tileset reporting
 * `tilesLoaded: true`: 81 probes on a 1,3 km grid ALL answered between
 * −424.9 m and −360.2 m in a smooth 5 % ramp — a planet-scale root tile
 * answering for a city. Every reading passed the world band, every one was
 * latched, one of them was lent to the whole commune by the fill radius, and
 * the layer drew 9 dots on 9 at 200–430 m UNDER the ellipsoid. That is worse
 * than the bug this file set out to fix.
 *
 * A reading outside this band is a malfunction, not a measurement: it is
 * refused, recorded as a refusal, and re-probed on every later pass.
 */
export const SITADEL_FLOOR_MIN_M = -100;
export const SITADEL_FLOOR_MAX_M = 5_000;

const DEFAULT_OVERLAY_HOST = Object.freeze({
  setEntries: setOverlayEntries,
  setVisible: setOverlaySourceVisible,
  clearSource: clearOverlaySource,
});
let _overlayHost = DEFAULT_OVERLAY_HOST;

// --- Runtime state ----------------------------------------------------------
let _viewer = null;
let _enabled = false;
/** @type {Map<string, object>} render id → record */
let _records = new Map();
/** @type {?object} the one commune pack in hand */
let _payload = null;
/** Take-down for the per-parcel offer. Null while nothing is offered. */
let _unpublishByParcel = null;
/** @type {Map<number, {permit: object, index: number, permits: number}>} parcel slot → owner */
let _owners = new Map();
/** @type {?Cesium.BillboardCollection} One badge per placed permit. */
let _badges = null;
/** @type {?Cesium.GroundPrimitive} */
let _fills = null;
/** The row's « Période », in months of authorisations drawn. */
let _months = SITADEL_WINDOW_DEFAULT;
/** The pack as drawn: the one in hand, cut to the period. */
let _drawn = null;
/** Whether the card on the globe was last published as a tag alone. */
let _publishedTagOnly = false;
/** Stops watching the key being folded or hidden while a permit is selected. */
let _stopKeyWatch = null;
/** Take-down for the drawn-dossiers offer `ads-fr` reads. */
let _unpublishDrawn = null;
/** Bounded ladder that re-seats the badges as the surface under them arrives. */
let _floorRetryTimer = null;
let _floorRetries = 0;
/** @type {?Cesium.GroundPolylinePrimitive} */
let _edges = null;
/** @type {?Cesium.GroundPolylinePrimitive} */
let _outline = null;
/** @type {?Cesium.GroundPolylinePrimitive} */
let _highlight = null;
let _selectedId = null;
let _clickHandler = null;
let _moveEndRemover = null;
let _debounceTimer = null;
let _abort = null;
let _mapStackListener = null;
let _classificationType = Cesium.ClassificationType.BOTH;
/** @type {?boolean} `GroundPolylinePrimitive.isSupported`, checked once. */
let _groundLinesSupported = null;
let _loading = false;
let _error = null;
let _status = 'idle';
let _stale = false;
let _lastUpdate = null;
/** Rounded focus cell already asked for; null re-arms the ask. */
let _focusKey = null;
/** The commune the last answer named, even when it carried no pack. */
let _communeName = null;
let _fetchImpl = null;

// --- Camera -----------------------------------------------------------------

/**
 * The point on the globe the middle of the screen is looking at.
 *
 * `pickEllipsoid` and not the camera's own carto position: a 25°-pitched camera
 * 300 m above the Seine is asking about a commune two kilometres away, and the
 * question this layer answers is "which commune am I looking at", never "which
 * commune am I over".
 * @param {?object} viewer
 * @returns {?{lat: number, lon: number}}
 */
export function sitadelFocusPoint(viewer) {
  const scene = viewer?.scene;
  const camera = viewer?.camera;
  if (!scene || typeof camera?.pickEllipsoid !== 'function') return null;
  const width = scene.canvas?.clientWidth;
  const height = scene.canvas?.clientHeight;
  if (!width || !height) return null;
  const ellipsoid = scene.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
  const hit = camera.pickEllipsoid(new Cesium.Cartesian2(width / 2, height / 2), ellipsoid);
  if (!hit) return null;
  const carto = ellipsoid.cartesianToCartographic(hit);
  if (!carto) return null;
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const lon = Cesium.Math.toDegrees(carto.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/**
 * The rounded cell a focus point falls in, or null.
 *
 * Rounded rather than floored so the key is symmetric about the grid line and a
 * camera nudged a metre back and forth does not alternate between two cells.
 * @param {?{lat: number, lon: number}} focus
 * @param {number} [gridDeg]
 * @returns {?string}
 */
export function sitadelFocusKey(focus, gridDeg = SITADEL_FOCUS_GRID_DEG) {
  const lat = finiteOrNull(focus?.lat);
  const lon = finiteOrNull(focus?.lon);
  if (lat === null || lon === null || !(gridDeg > 0)) return null;
  return `${Math.round(lat / gridDeg)},${Math.round(lon / gridDeg)}`;
}

/**
 * Where this camera may ask about, or the reason it may not.
 *
 * Three distinct refusals, kept distinct because each needs its own sentence:
 * no camera rectangle at all, a camera above the gate, and a camera whose
 * middle of screen does not land on the globe (looking at the sky over a
 * horizon). There is deliberately NO coverage refusal — see the header.
 * @param {?object} viewer
 * @returns {{focus: ?{lat: number, lon: number}, reason: ?string}}
 */
export function sitadelViewport(viewer) {
  if (!cameraViewBox(viewer)) return { focus: null, reason: 'no-view' };
  const altitude = viewer?.camera?.positionCartographic?.height;
  if (!Number.isFinite(altitude)) return { focus: null, reason: 'no-view' };
  if (altitude > SITADEL_MAX_ALTITUDE_M) return { focus: null, reason: 'too-high' };
  const focus = sitadelFocusPoint(viewer);
  if (!focus) return { focus: null, reason: 'no-view' };
  return { focus, reason: null };
}

// --- Projection of the pack into what is drawn ------------------------------

/**
 * Which permit colours each parcel, and how many others share it.
 *
 * `projectSitadelCommune` sorts `permits` newest authorisation first, so the
 * FIRST permit naming a slot is the most recent one — the parcel is coloured by
 * where its pipeline has got to, not by where it started. The count of the rest
 * is kept because it is the plot's history and the card prints it: measured on
 * Nantes, 2 747 placed permits name 3 032 distinct parcels, so most parcels
 * carry exactly one and the ones that carry more are the interesting ones.
 * @param {?object} payload
 * @returns {Map<number, {permit: object, index: number, permits: number}>}
 */
export function sitadelParcelOwners(payload) {
  const owners = new Map();
  const permits = Array.isArray(payload?.permits) ? payload.permits : [];
  for (let index = 0; index < permits.length; index += 1) {
    for (const slot of permits[index]?.px || []) {
      const held = owners.get(slot);
      if (held) held.permits += 1;
      else owners.set(slot, { permit: permits[index], index, permits: 1 });
    }
  }
  return owners;
}

/**
 * Where one permit's dot stands: the anchor of the LARGEST parcel it names.
 *
 * Largest and not first, and never a midpoint between them. 426 of Nantes'
 * 2 747 placed permits name several parcels, and the mean of two centroids is a
 * coordinate nobody published — it can land in the street between them. The
 * anchor of the biggest plot is a point the cadastre's own geometry produced.
 * @param {?object} permit
 * @param {Array<object>} parcels
 * @returns {?{lat: number, lon: number}}
 */
export function sitadelPermitAnchor(permit, parcels = []) {
  let best = null;
  let bestArea = -Infinity;
  for (const slot of permit?.px || []) {
    const parcel = parcels?.[slot];
    const point = parcel?.p;
    if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const area = finiteOrNull(parcel.a) ?? 0;
    if (area > bestArea) { bestArea = area; best = point; }
  }
  return best ? { lon: best[0], lat: best[1] } : null;
}

/** Colour for one permit — its lifecycle band, or the demolition band. */
export function sitadelPermitColor(permit) {
  return sitadelBandColor(permit?.b);
}

/**
 * The permits of a pack authorised inside the period — the row's « Période ».
 *
 * By the date of AUTHORISATION (`DATE_REELLE_AUTORISATION`), the date the
 * `ads-fr` window counts from too, so the two permit layers answer the same
 * question. The whole window (156 months, Sitadel's span) keeps every permit,
 * including the few with no date at all; a shorter one keeps only those it can
 * date inside it.
 * @param {?object} payload
 * @param {string} months One of {@link SITADEL_WINDOWS}.
 * @param {number} [now] Epoch ms, for tests.
 * @returns {?object} The payload with its `permits` cut, parcels untouched.
 */
export function sitadelPayloadForPeriod(payload, months, now = Date.now()) {
  if (!payload || !Array.isArray(payload.permits)) return payload;
  const span = Number(months);
  if (!Number.isFinite(span) || String(months) === SITADEL_WINDOWS[SITADEL_WINDOWS.length - 1]) return payload;
  const floor = new Date(now);
  floor.setUTCMonth(floor.getUTCMonth() - span);
  const since = floor.toISOString().slice(0, 10);
  return {
    ...payload,
    permits: payload.permits.filter((permit) => {
      const date = /^\d{4}-\d{2}-\d{2}/.test(String(permit?.da ?? '')) ? String(permit.da).slice(0, 10) : null;
      return date !== null && date >= since;
    }),
  };
}

/**
 * The ellipsoidal floor under one coordinate: the shared DEM cell when it is
 * warm, the PROVISIONAL rendered-surface read when it is not, null when neither
 * has an answer.
 *
 * WHY THE SECOND SOURCE EXISTS — measured in this app, Paris, 2026-09-14,
 * nadir-ish camera at 500 m. The DEM answers over the NETWORK: `drawPack`
 * places its dots synchronously, `warmGroundFloor` posts the miss, and the
 * answer lands a second later — after every dot has already been built. The
 * dots were never moved again, so all **4 753 of them sat at ellipsoidal
 * height 1.0 m for the whole session**, while `scene.sampleHeight` read the
 * drawn Paris mesh under those same coordinates at **76.7 to 96.9 m**.
 *
 * A dot 80 m under the city is still PAINTED, because these draw with
 * `disableDepthTestDistance: Infinity` so a marker is not swallowed by the kerb
 * it stands on. Its screen position is then a function of the CAMERA POSE:
 * rotate or pan and the whole layer slides across the rooftops, landing
 * anywhere but on its own parcel. That is the reported "the points are in the
 * middle of nowhere and they move when I turn the map", and it is the same
 * defect `sharedMobilityFrance.js` and `provisionalFloor.js` already carry the
 * argument for.
 *
 * Precedence is DEM first because it is the measured survey and the provisional
 * store steps aside for it by design (`collectProvisionalCells` drops a cell
 * the moment its DEM floor lands).
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {?number} Ellipsoidal floor in metres, or null.
 */
export function sitadelFloorM(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const floor = cachedGroundFloor(lat, lon);
  if (frenchFloor(floor) !== null) return floor;
  return frenchFloor(provisionalFloor(lat, lon));
}

/** A floor, or null when it is not a height French ground can have. Applied to
 *  BOTH sources: a DEM answer outside the band is as broken as a mesh one. */
function frenchFloor(value) {
  if (!Number.isFinite(value)) return null;
  if (value < SITADEL_FLOOR_MIN_M || value > SITADEL_FLOOR_MAX_M) return null;
  return value;
}

/**
 * Render records for one pack, one per PLACED permit.
 *
 * The id carries the commune, the file and the permit's ordinal, never
 * `NUM_DAU` alone: the registration number is not a primary key — 3 561
 * distinct values across Paris' 3 595 housing rows, so 34 permits share one
 * with another — and two records under one id would silently drop a card.
 * @param {?object} payload
 * @returns {Array<object>}
 */
export function sitadelPermitRecords(payload) {
  const parcels = Array.isArray(payload?.parcels) ? payload.parcels : [];
  const insee = String(payload?.insee ?? '');
  const records = [];
  const permits = Array.isArray(payload?.permits) ? payload.permits : [];
  for (let index = 0; index < permits.length; index += 1) {
    const permit = permits[index];
    const at = sitadelPermitAnchor(permit, parcels);
    // A permit with no usable anchor is not drawn and not counted as drawn.
    // `projectSitadelCommune` already refuses to emit a parcel it could not
    // anchor, so this only fires on a malformed payload — and it fires quietly
    // rather than putting a NaN at the centre of the Earth.
    if (!at) continue;
    records.push({
      id: `${SITADEL_FR_LAYER_ID}:${insee}:${permit.f || 'lgt'}:${index}`,
      kind: 'permit',
      permit,
      index,
      at,
      color: sitadelPermitColor(permit),
      classId: permitClassOfSitadelBand(permit?.b),
    });
  }
  return records;
}

// --- Geometry ---------------------------------------------------------------

/**
 * Cesium positions for one ring, dropping the repeated closing vertex.
 *
 * `PolygonGeometry` closes its own rings and a duplicated last point makes a
 * degenerate triangle at the seam; `GroundPolylineGeometry` needs the closure
 * put back, which the two callers below do explicitly.
 * @param {Array<number[]>} ring
 * @returns {?object}
 */
export function sitadelRingPositions(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  const last = ring.length - 1;
  const closed = ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1];
  const degrees = [];
  const stop = closed ? last : ring.length;
  for (let i = 0; i < stop; i += 1) {
    const point = ring[i];
    if (!Array.isArray(point)) continue;
    const [lon, lat] = point;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    degrees.push(lon, lat);
  }
  return degrees.length >= 6 ? Cesium.Cartesian3.fromDegreesArray(degrees) : null;
}

function removeGround(primitive) {
  if (!primitive) return;
  _viewer?.scene?.groundPrimitives?.remove?.(primitive);
}

function clearHighlight() {
  if (_highlight) {
    removeGround(_highlight);
    _highlight = null;
  }
}

function clearSurfaces() {
  removeGround(_fills);
  removeGround(_edges);
  removeGround(_outline);
  _fills = null;
  _edges = null;
  _outline = null;
  clearHighlight();
}

function groundLinesSupported() {
  if (_groundLinesSupported === null && _viewer?.scene) {
    _groundLinesSupported = Cesium.GroundPolylinePrimitive.isSupported(_viewer.scene);
    if (!_groundLinesSupported) {
      console.warn('[Data:Sitadel FR] GroundPolylinePrimitive unsupported — parcel edges and commune outline disabled');
    }
  }
  return _groundLinesSupported !== false;
}

// --- Drawing ----------------------------------------------------------------

/**
 * Rebuild the three ground batches for the whole commune.
 *
 * THREE primitives and not 4 500: measured 2026-09-02, Paris' pack draws 4 500
 * parcel parts and 70 766 vertices and Nantes' 3 032 parts and 47 676, which is
 * one batched tessellation each — `fraicheur-fr` already batches 127 465 on
 * this globe. `releaseGeometryInstances` stays false so a selection can recolour
 * one instance in place instead of paying a second full tessellation to light
 * one plot.
 *
 * Each parcel is washed and outlined in the band of the permit that owns it,
 * the colour of the badge standing on it.
 * @param {?object} payload The pack as drawn (already cut to the period).
 * @param {Map<string, object>} [records] Render records, keyed by id.
 */
function drawSurfaces(payload, records = _records) {
  clearSurfaces();
  if (!_viewer?.scene?.groundPrimitives || !payload) return;
  const parcels = Array.isArray(payload.parcels) ? payload.parcels : [];
  const fillInstances = [];
  const edgeInstances = [];

  for (let slot = 0; slot < parcels.length; slot += 1) {
    const owner = _owners.get(slot);
    if (!owner) continue;
    const record = records.get(recordIdFor(payload, owner));
    if (!record) continue;
    const band = Cesium.Color.fromCssColorString(record.color);
    const color = band.withAlpha(SITADEL_FILL_ALPHA);
    const edgeColor = band.withAlpha(PARCEL_EDGE_ALPHA);

    for (const part of parcels[slot]?.g || []) {
      const outer = sitadelRingPositions(part[0]);
      if (!outer) continue;
      const holes = [];
      for (let h = 1; h < part.length; h += 1) {
        const hole = sitadelRingPositions(part[h]);
        // 190 of Nantes' 58 099 parcels carry an interior ring. Kept: a hole
        // filled in is ground attributed to a permit that does not cover it.
        if (hole) holes.push(new Cesium.PolygonHierarchy(hole));
      }
      fillInstances.push(new Cesium.GeometryInstance({
        id: record.id,
        geometry: new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(outer, holes),
          vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
      }));
      for (const ring of part) {
        const positions = sitadelRingPositions(ring);
        if (!positions) continue;
        edgeInstances.push(new Cesium.GeometryInstance({
          id: record.id,
          geometry: new Cesium.GroundPolylineGeometry({
            positions: [...positions, positions[0]],
            width: PARCEL_EDGE_WIDTH_PX,
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(edgeColor),
          },
        }));
      }
    }
  }

  if (fillInstances.length) {
    _fills = _viewer.scene.groundPrimitives.add(new Cesium.GroundPrimitive({
      geometryInstances: fillInstances,
      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
      classificationType: _classificationType,
      asynchronous: true,
      releaseGeometryInstances: false,
    }));
    _fills.show = _enabled;
  }
  if (edgeInstances.length && groundLinesSupported()) {
    _edges = _viewer.scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({
      geometryInstances: edgeInstances,
      appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
      classificationType: _classificationType,
      asynchronous: true,
      releaseGeometryInstances: false,
    }));
    _edges.show = _enabled;
  }

  const outlineInstances = [];
  for (const part of payload.outline?.parts || []) {
    for (const ring of part) {
      const positions = sitadelRingPositions(ring);
      if (!positions) continue;
      outlineInstances.push(new Cesium.GeometryInstance({
        geometry: new Cesium.GroundPolylineGeometry({
          positions: [...positions, positions[0]],
          width: OUTLINE_WIDTH_PX,
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(
            Cesium.Color.fromCssColorString(SITADEL_OUTLINE_COLOR).withAlpha(OUTLINE_ALPHA),
          ),
        },
      }));
    }
  }
  if (outlineInstances.length && groundLinesSupported()) {
    _outline = _viewer.scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({
      geometryInstances: outlineInstances,
      appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
      classificationType: _classificationType,
      asynchronous: true,
    }));
    _outline.show = _enabled;
  }
}

/** The render id of the permit that owns a parcel, from the owner entry. */
function recordIdFor(payload, owner) {
  return `${SITADEL_FR_LAYER_ID}:${String(payload?.insee ?? '')}:${owner.permit?.f || 'lgt'}:${owner.index}`;
}

/**
 * The floor one permit's mark stands on, remembering the last one it had.
 *
 * The memo is what keeps a permit's three marks — the badge, the selected
 * card and the DETECT callout — in ONE place. They are built at different moments
 * from the same shared stores, and those stores can stop answering for a cell
 * between two of them: `provisionalFloor.js` evicts its oldest entries past
 * 4 000, which a commune the size of Paris can reach on its own. Without the
 * memo the callout for a seated badge would be rebuilt at the ellipsoid and the
 * label would hang 80 m under its own mark.
 * @param {object} record
 * @returns {?number}
 */
function recordFloorM(record) {
  const floor = sitadelFloorM(record.at.lat, record.at.lon);
  if (floor !== null) {
    record.floorM = floor;
    return floor;
  }
  return Number.isFinite(record.floorM) ? record.floorM : null;
}

/**
 * Where one permit's mark belongs: its own coordinate, on the floor under it.
 *
 * `?? 0` is the last resort and not a floor — nothing has answered yet and the
 * mark has to be somewhere. `reanchorPoints` is what makes that state
 * temporary.
 * @param {object} record
 * @param {number} liftM
 * @returns {Cesium.Cartesian3}
 */
function recordPosition(record, liftM) {
  return Cesium.Cartesian3.fromDegrees(
    record.at.lon, record.at.lat, (recordFloorM(record) ?? 0) + liftM,
  );
}

/**
 * Move the badges already on screen onto the floor that has since arrived.
 *
 * The DEM answers over the network and the photoreal tiles stream, so the
 * floor under a badge is routinely unknown at the instant `drawPack` builds it
 * and known a second later — and a billboard built at the ellipsoid stays at
 * the ellipsoid until something writes its `position` again.
 *
 * Writes only when the floor actually moves the badge, so a settled commune
 * costs a comparison per badge and no render at all.
 *
 * A badge whose floor is UNKNOWN is left exactly where it is. That is not
 * defensive tidiness: `provisionalFloor.js` evicts its oldest cells past 4 000
 * — a commune the size of Paris plus the layers sharing the store can reach
 * that — and re-deriving a position from a missing answer would push a
 * correctly seated badge back down to the ellipsoid. Nothing may overwrite a
 * measurement with a silence.
 * @returns {number} Badges moved.
 */
function reanchorPoints() {
  if (!_badges || _badges.isDestroyed?.()) return 0;
  let moved = 0;
  for (const record of _records.values()) {
    const badge = record.badge;
    if (!badge || !badge.position) continue;
    const floor = recordFloorM(record);
    if (floor === null) continue;
    const next = Cesium.Cartesian3.fromDegrees(
      record.at.lon, record.at.lat, floor + POINT_LIFT_M,
    );
    if (Cesium.Cartesian3.equalsEpsilon(badge.position, next, 0, FLOOR_EPSILON_M)) continue;
    badge.position = next;
    moved += 1;
  }
  return moved;
}

/** True while any drawn permit is still standing on no floor at all. */
function hasColdFloor() {
  for (const record of _records.values()) {
    if (recordFloorM(record) === null) return true;
  }
  return false;
}

/** One deferred floor pass: sample again, re-seat, decide whether to return. */
function refreshFloors() {
  if (!_enabled || !_viewer || !_records.size) return;
  const anchors = [];
  for (const record of _records.values()) anchors.push(record.at);
  const { pending } = sampleProvisionalFloors(_viewer.scene, anchors, {
    fillKm: FLOOR_FILL_KM, minM: SITADEL_FLOOR_MIN_M, maxM: SITADEL_FLOOR_MAX_M,
  });
  const moved = reanchorPoints();
  if (moved) {
    // The card reads the same floor, so a badge that moved took its card with
    // it — republish rather than leave the two apart.
    publishSelectedCard();
    governorRequestRender('sitadel-fr-reanchor');
  }
  if (pending || hasColdFloor()) scheduleFloorReanchor();
}

/**
 * Come back for the badges the surface could not place yet.
 *
 * A probe misses while the tiles under a commune are still streaming, and the
 * DEM is a network round trip — the ordinary state for the second or two after
 * arriving somewhere. A parked camera produces no rebuild, so without this
 * nothing would ever ask again. Bounded on purpose: five doubling wakeups
 * (~37 s in total, `provisionalFloor.js`), refilled whenever the commune
 * changes, so ground with no photoreal coverage cannot undo the render
 * governor's idle parking.
 */
function scheduleFloorReanchor() {
  if (_floorRetryTimer != null) return;
  const delay = provisionalFloorRetryDelayMs(_floorRetries);
  if (delay == null) return; // budget spent — wait for the camera to move
  _floorRetries += 1;
  _floorRetryTimer = setTimeout(() => {
    _floorRetryTimer = null;
    refreshFloors();
  }, delay);
}

/** Drop a pending re-anchor and refill its budget (a new commune, a new one). */
function resetFloorRetries() {
  if (_floorRetryTimer != null) {
    clearTimeout(_floorRetryTimer);
    _floorRetryTimer = null;
  }
  _floorRetries = 0;
}

/**
 * Rebuild every record and every primitive from the pack in hand, cut to the
 * row's period.
 *
 * The selection is dropped rather than restored, unlike `fraicheur-fr`'s
 * refresh: this runs when the COMMUNE or the PERIOD changed, so the card the
 * reader was looking at may describe a permit that is no longer drawn.
 * `applyClassification` re-selects, because that rebuild is the same draw.
 * @param {?object} payload The whole commune pack.
 */
function drawPack(payload) {
  clearSelection();
  resetFloorRetries();
  _drawn = sitadelPayloadForPeriod(payload, _months);
  _records = new Map();
  _owners = sitadelParcelOwners(_drawn);
  _badges?.removeAll();

  const records = sitadelPermitRecords(_drawn);
  // Ground the cold cells against the surface actually being DRAWN before a
  // single position below is taken. Synchronous, no network of ours, ≤40 probes
  // and nothing at all above 25 km of camera (`provisionalFloor.js`). Without
  // it every badge here is built on the ellipsoid and stays there — see
  // `sitadelFloorM`.
  sampleProvisionalFloors(_viewer?.scene, records.map((record) => record.at), {
    fillKm: FLOOR_FILL_KM, minM: SITADEL_FLOOR_MIN_M, maxM: SITADEL_FLOOR_MAX_M,
  });

  const warm = [];
  for (const record of records) {
    if (_badges) {
      record.badge = _badges.add({
        id: record.id,
        position: recordPosition(record, POINT_LIFT_M),
        image: permitBadgeImage(record.classId),
        width: PERMIT_BADGE_PX,
        height: PERMIT_BADGE_PX,
        scaleByDistance: BADGE_SCALE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
    _records.set(record.id, record);
    if (warm.length < FLOOR_WARM_LIMIT) warm.push(record.at);
  }
  drawSurfaces(_drawn);
  publishDrawnDossiers();
  if (warm.length) warmGroundFloor(warm);
  // The DEM is still in flight and the tiles under half the commune have not
  // streamed. Come back for both.
  scheduleFloorReanchor();
  governorRequestRender('sitadel-fr-draw');
}

/** Re-classify against the active surface, rebuilding the baked ground batches. */
function applyClassification(next) {
  if (next === undefined || next === _classificationType) return;
  _classificationType = next;
  // `classificationType` is read when a ground primitive is built, so an
  // already-built one has to be rebuilt rather than mutated. The pack is still
  // in hand, so this costs a re-tessellation and no network at all.
  const selected = _selectedId;
  if (_drawn) drawSurfaces(_drawn);
  // `drawSurfaces` tears down the highlight with the batch it was drawn over,
  // so a permit selected when the operator switches map stack would keep its
  // card and silently lose its outline.
  if (selected && _records.has(selected)) selectPermit(selected);
  _viewer?.scene?.requestRender?.();
}

// --- Cards ------------------------------------------------------------------

/** A count, grouped the way the reader's language groups one. */
function fr(value) {
  return formatNumber(value);
}

function pct(part, whole) {
  if (!(whole > 0)) return null;
  return formatPercent((100 * part) / whole, { maximumFractionDigits: 1 });
}

/**
 * The provenance block every card ends with.
 *
 * Three lines, and none of them is optional. The first is the commune's own
 * join rate, because a permit drawn in Toulouse (7.6% placed) and a permit
 * drawn in Paris (91.3%) are not the same kind of claim. The second is the
 * YEAR's rate, because the failure is age-dependent — a parcel is divided and
 * renumbered precisely when somebody builds on it, so 2013 places at 60% in
 * Nantes and 2026 at 97%. The third names the two editions the join was made
 * between, since neither is pinned.
 * @param {?object} payload
 * @param {?object} [permit] Adds the permit's own year band when given.
 * @returns {string[]}
 */
export function sitadelJoinLines(payload, permit = null) {
  const summary = payload?.summary;
  if (!summary) return [];
  const m = messages().join;
  const lines = [];
  const name = payload.commune || payload.insee || m.thisCommune;
  lines.push(m.communeRate(
    name, fr(summary.placed), fr(summary.permits),
    pct(summary.placed, summary.permits) || '—',
  ));
  const year = permit?.y;
  const tally = year ? (payload.years || []).find((entry) => entry.year === year) : null;
  if (tally && tally.permits > 0) {
    lines.push(m.yearRate(
      year, fr(tally.placed), fr(tally.permits), pct(tally.placed, tally.permits),
    ));
  }
  lines.push(m.editions(payload.millesime || '—', payload.cadastreEdition || '—'));
  return lines;
}

/**
 * Card copy for one selected permit.
 *
 * The feed builds the permit's own card — what was authorised, how far it has
 * got, what it creates, what it removes, which parcel and how well the area
 * checks out. This adds the two things only the drawing knows: how many OTHER
 * authorisations share this plot, and the rates above.
 * @param {?object} record
 * @param {?object} [payload]
 * @returns {string}
 */
export function buildSitadelSelectionLabel(record, payload = _drawn) {
  const permit = record?.permit;
  if (!permit) return '';
  const parcels = Array.isArray(payload?.parcels) ? payload.parcels : [];
  const [title, ...details] = buildSitadelPermitCard(permit, parcels);

  // The plot's own history. `owners` counts every permit that names the parcel,
  // so the "others" are that minus this one — and it is only printed when the
  // parcel really is shared, which measured on Nantes is the minority.
  let shared = 0;
  for (const slot of permit.px || []) {
    shared = Math.max(shared, (_owners.get(slot)?.permits || 1) - 1);
  }
  if (shared > 0) details.push(messages().join.sharedPlot(fr(shared), shared));
  details.push(...sitadelJoinLines(payload, permit));
  details.push(messages().join.credit(SITADEL_LICENCE));
  return [title, ...details.filter(Boolean)].join('\n');
}

/**
 * The details a selected permit's card folds under « Voir les détails du
 * permis »: the file (parcels, land check, placement, number), the plot's other
 * permits, the placement rates and the credit — everything the card's head
 * does not already say.
 * @param {object} record
 * @param {?object} payload The pack as drawn.
 * @returns {string[]}
 */
function sitadelPermitDetails(record, payload) {
  const permit = record.permit;
  const parcels = Array.isArray(payload?.parcels) ? payload.parcels : [];
  const details = buildSitadelPermitDetails(permit, parcels);
  let shared = 0;
  for (const slot of permit.px || []) {
    shared = Math.max(shared, (_owners.get(slot)?.permits || 1) - 1);
  }
  if (shared > 0) details.push(messages().join.sharedPlot(fr(shared), shared));
  if (permit.dem) details.push(permit.dem);
  details.push(...sitadelJoinLines(payload, permit));
  details.push(messages().join.credit(SITADEL_LICENCE));
  return details.filter(Boolean);
}

/**
 * The card of the selected permit, as the map key prints it — see
 * `permitProjectCard`, which `ads-fr` fills the same way. Placed on its own
 * parcel by the cadastral join, so the marker is never « approximatif » here.
 * @param {?object} record
 * @param {?object} [payload] The pack as drawn.
 * @returns {?object} The `legendSelection` slot of the key.
 */
export function sitadelPermitPanel(record, payload = _drawn) {
  const permit = record?.permit;
  if (!permit) return null;
  const created = finiteOrNull(permit.lgt);
  return permitProjectCard({
    key: String(record.id),
    type: sitadelTypeLabel(permit.t)
      || (permit.f === 'dem' ? sitadelBandLabel('demolition') : messages().detectFallback),
    classId: permitClassOfSitadelBand(permit.b),
    dwellings: created,
    surfaceM2: finiteOrNull(permit.srf),
    demolishedDwellings: finiteOrNull(permit.dlg),
    nature: sitadelNatureLabel(permit.np) || null,
    address: [permit.an, permit.av].filter(Boolean).join(' ') || null,
    commune: payload?.commune || null,
    dates: { granted: permit.da, started: permit.do, completed: permit.df },
    details: sitadelPermitDetails(record, payload),
    source: 'Sitadel · SDES', // i18n-ignore-line — the publisher's name
  });
}

/**
 * Protected selected-permit entry for the shared overlay host: the whole card,
 * or — while the map key carries the card — the tag alone (« 40 logements »).
 * @param {object} record
 * @param {?object} [payload] The pack as drawn.
 * @returns {?object}
 */
export function createSitadelSelectedOverlayEntry(record, payload = _drawn) {
  if (!record?.id || !record?.at) return null;
  const position = recordPosition(record, CARD_LIFT_M);
  const text = buildSitadelSelectionLabel(record, payload);
  if (!text) return null;
  _publishedTagOnly = mapKeyCarriesSelection();
  const [title, ...details] = _publishedTagOnly
    ? [permitProjectTag({ dwellings: finiteOrNull(record.permit?.lgt), classId: record.classId })]
    : text.split('\n');
  return {
    id: String(record.id),
    position,
    variant: 'selected',
    selected: true,
    protected: true,
    paintLane: 'selected',
    collisionGroup: 'ambient-card',
    priority: Number.MAX_SAFE_INTEGER,
    title,
    details,
    accent: record.color || SELECTED_COLOR,
    interactive: false,
    anchorRadiusPx: 10,
    minAnchorGapPx: 12,
    verticalOnly: true,
    placement: 'above',
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
  };
}

// --- Selection --------------------------------------------------------------

/**
 * Tell the key the card changed. This layer's own repaint is its six-hour poll
 * away, and a card that waits for another layer's tick to appear is a click
 * that seems to do nothing. The literal is `LAYER_DRAW_CHANGED_EVENT` of
 * `addressScanLayer.js`, as in `anfrFrance.js`.
 */
function announceSelectionChanged() {
  if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('gev:layer-draw-changed', {
    detail: { layerId: SITADEL_FR_LAYER_ID, selection: true },
  }));
}

/** Publish the selected permit's globe card, whole or as a tag, as the key allows. */
function publishSelectedCard() {
  const entry = _selectedId && _records.has(_selectedId)
    ? createSitadelSelectedOverlayEntry(_records.get(_selectedId), _drawn)
    : null;
  if (entry) {
    _overlayHost.setEntries(SITADEL_FR_OVERLAY_SOURCE_ID, [entry], SITADEL_FR_OVERLAY_SOURCE_OPTIONS);
  }
}

function clearSelection() {
  clearHighlight();
  _stopKeyWatch?.();
  _stopKeyWatch = null;
  const record = _selectedId ? _records.get(_selectedId) : null;
  if (record?.badge) {
    record.badge.image = permitBadgeImage(record.classId);
    record.badge.width = PERMIT_BADGE_PX;
    record.badge.height = PERMIT_BADGE_PX;
  }
  if (_selectedId) {
    _selectedId = null;
    _overlayHost.clearSource(SITADEL_FR_OVERLAY_SOURCE_ID);
    governorRequestRender('sitadel-fr-deselect');
    announceSelectionChanged();
  }
}

/**
 * Select one permit, from its badge or from any parcel it was drawn on.
 *
 * The badge is a billboard and mutable, so it is enlarged and ringed in place.
 * The parcels are batched geometry instances and are not, so the plot is
 * ringed with a second ground polyline — the same technique `cadastre-fr`,
 * `fraicheur-fr` and `comptages-fr` use, and for the same reason: rebuilding
 * 70 766 vertices to light one plot is not a click.
 * @param {string} id
 */
function selectPermit(id) {
  clearSelection();
  const record = _records.get(id);
  if (!record || !_viewer) return;
  _selectedId = id;
  if (record.badge) {
    record.badge.image = permitBadgeImage(record.classId, { selected: true });
    record.badge.width = PERMIT_BADGE_SELECTED_PX;
    record.badge.height = PERMIT_BADGE_SELECTED_PX;
  }
  const parcels = Array.isArray(_drawn?.parcels) ? _drawn.parcels : [];
  // THE RING GOES ON THE GROUND, on every plot the dossier names.
  const cyan = Cesium.Color.fromCssColorString(SELECTED_COLOR).withAlpha(0.85);
  const groundInstances = [];
  for (const slot of record.permit?.px || []) {
    for (const part of parcels[slot]?.g || []) {
      for (const ring of part) {
        const positions = sitadelRingPositions(ring);
        if (!positions) continue;
        groundInstances.push(new Cesium.GeometryInstance({
          geometry: new Cesium.GroundPolylineGeometry({
            positions: [...positions, positions[0]],
            width: SELECTED_WIDTH_PX,
          }),
          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(cyan) },
        }));
      }
    }
  }
  if (groundInstances.length && groundLinesSupported()) {
    _highlight = _viewer.scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({
      geometryInstances: groundInstances,
      appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
      classificationType: _classificationType,
    }));
  }
  publishSelectedCard();
  // Folding the key after the click must bring the whole card back to the
  // globe, and unfolding it take the card off again (`mapKeySelection.js`).
  _stopKeyWatch = watchMapKeyCarriesSelection(() => {
    publishSelectedCard();
    governorRequestRender('sitadel-fr-card');
  }, _publishedTagOnly);
  governorRequestRender('sitadel-fr-select');
  announceSelectionChanged();
}

function onKeyDown(event) {
  if (event.key === 'Escape' && _selectedId) clearSelection();
}

/**
 * Resolve a Cesium pick into one of this layer's ids.
 *
 * A `PointPrimitive` reports the id it was added with; a batched ground
 * primitive reports the `GeometryInstance` id. Both are strings here and both
 * are checked against the record index rather than trusted, because
 * `cadastre-fr` clamps its own parcels to the same ground.
 * @param {?object} picked
 * @param {(id: string) => boolean} [has]
 * @returns {?string}
 */
export function resolveSitadelPickId(picked, has = (id) => _records.has(id)) {
  if (!picked) return null;
  if (typeof picked.id === 'string' && has(picked.id)) return picked.id;
  const nested = picked.id?.id;
  if (typeof nested === 'string' && has(nested)) return nested;
  return null;
}

function installClickHandler(viewer) {
  if (_clickHandler) return;
  _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  _clickHandler.setInputAction((movement) => {
    const id = resolveSitadelPickId(pickAt(viewer.scene, movement.position));
    if (id) {
      selectPermit(id);
      return;
    }
    if (_selectedId) clearSelection();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  if (typeof document !== 'undefined') document.addEventListener('keydown', onKeyDown);
}

// --- Loading ----------------------------------------------------------------

/**
 * Ask the proxy about the commune under the middle of the screen.
 *
 * `have=` is the whole reason this is cheap. The proxy resolves the commune
 * from `geo.api.gouv.fr` — which is the only service that knows where a commune
 * boundary is — and when the answer is the commune already in hand it replies
 * `{unchanged: true}` in a few hundred bytes instead of the 0.07–0.68 MB pack.
 * So panning across a city costs one small round trip per 0.01° cell and
 * crossing into the next commune costs the pack once.
 * @param {object} [options]
 * @returns {Promise<boolean>} Whether anything was redrawn.
 */
async function load({ force = false } = {}) {
  if (!_enabled || !_viewer) return false;
  const { focus, reason } = sitadelViewport(_viewer);
  if (!focus) {
    // A refusal is guidance, not a fault, and it must not blank a pack the
    // operator can still read by descending again. The drawing stays; the row
    // says why nothing new is coming.
    _status = reason === 'too-high' ? 'too-high' : 'no-view';
    _loading = false;
    _focusKey = null;
    return false;
  }
  const key = sitadelFocusKey(focus);
  if (!force && key && key === _focusKey) return false;
  _focusKey = key;

  _abort?.abort();
  const controller = new AbortController();
  _abort = controller;
  _loading = !_payload;
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const fetchImpl = _fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!fetchImpl) throw new Error('no fetch available');
    const params = new URLSearchParams({ lat: focus.lat.toFixed(6), lon: focus.lon.toFixed(6) });
    if (_payload?.insee && !force) params.set('have', String(_payload.insee));
    const response = await fetchImpl(`${SITADEL_COMMUNE_URL}?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(await serverFailureMessage(response));
    const body = await response.json();
    if (controller.signal.aborted || !_enabled) return false;

    if (body?.unchanged === true) {
      _error = null;
      _status = _records.size ? 'ready' : 'empty';
      return false;
    }
    if (!body?.insee) {
      // geo.api.gouv.fr found no French commune under that point. Not an error:
      // the operator is over the sea, over Switzerland, or over a lake. The
      // previous commune is cleared, because leaving it drawn would attribute
      // its permits to ground it does not cover.
      _communeName = null;
      _payload = null;
      _drawn = null;
      _records = new Map();
      _owners = new Map();
      _badges?.removeAll();
      resetFloorRetries();
      clearSurfaces();
      publishDrawnDossiers();
      governorRequestRender('sitadel-fr-no-commune');
      _status = 'no-commune';
      _error = null;
      return true;
    }
    if (!Array.isArray(body.permits) || !Array.isArray(body.parcels)) throw new Error('malformed payload');
    _payload = body;
    publishByParcel();
    _communeName = body.commune || body.insee;
    _stale = Boolean(body.stale);
    _lastUpdate = Number(body.fetchedAt) || Date.now();
    _error = null;
    drawPack(body);
    _status = _records.size ? 'ready' : 'empty';
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    console.warn('[Data:Sitadel FR] commune unavailable:', error?.message || error);
    // A pack already in hand still describes the same commune — DiDo publishes
    // monthly. Keep drawing it and say the refresh failed rather than blanking
    // a city because one query timed out.
    _error = _payload ? messages().error.refresh : messages().error.unavailable;
    _status = _payload ? 'ready' : 'unavailable';
    // Re-arm: the cell was never actually answered, so the next camera settle
    // must be allowed to ask again.
    _focusKey = null;
    return false;
  } finally {
    clearTimeout(timer);
    _loading = false;
    if (_abort === controller) _abort = null;
  }
}

function scheduleLoad() {
  clearTimeout(_debounceTimer);
  // A camera that came to rest is the one event that can improve a floor
  // without a new pack: different tiles have streamed, and the cells the probe
  // budget could not reach last time are now the nearest ones. Refill the
  // ladder so a commune that exhausted its five wakeups over blank ground gets
  // another go the moment the reader moves. Cheap when there is nothing to do —
  // `refreshFloors` writes nothing and requests no render.
  resetFloorRetries();
  scheduleFloorReanchor();
  _debounceTimer = setTimeout(() => { void load(); }, CAMERA_DEBOUNCE_MS);
}

// --- Detection --------------------------------------------------------------

/**
 * Candidates for the DETECT callout, in the order they are worth calling out.
 *
 * NOT a stride over every permit. A commune answers with up to 4 753 of them
 * and they are not equally interesting: what is being BUILT right now
 * (`Chantier ouvert`) is the finding, then what is authorised and has not
 * started, then what is coming down, and a permit finished years ago is the
 * thing `bdtopo-buildings` already draws. Inside each tier the biggest
 * creations come first, because "553 dwellings" is a callout and "1 dwelling"
 * is a hundred thousand callouts.
 * @param {object} [options]
 * @returns {Array<object>}
 */
function collectDetectableObjects(options = {}) {
  if (!_enabled || !_records.size) return [];
  const maxCount = Number.isFinite(options.maxCount)
    ? Math.max(1, Math.floor(options.maxCount))
    : 2600;
  const tiers = [[], [], [], []];
  for (const record of _records.values()) {
    const band = record.permit?.b;
    if (band === 'commence') tiers[0].push(record);
    else if (band === 'autorise') tiers[1].push(record);
    else if (band === 'demolition') tiers[2].push(record);
    else tiers[3].push(record);
  }
  const byDwellings = (a, b) => (finiteOrNull(b.permit?.lgt) ?? 0) - (finiteOrNull(a.permit?.lgt) ?? 0);
  const ordered = [];
  for (const tier of tiers) ordered.push(...tier.sort(byDwellings));
  if (!ordered.length) return [];
  const seed = Number.isFinite(options.seed) ? Math.floor(options.seed) : 0;
  const stride = Math.max(1, Math.ceil(ordered.length / maxCount));
  const start = ((seed % stride) + stride) % stride;

  const result = [];
  for (let i = start; i < ordered.length; i += stride) {
    const record = ordered[i];
    result.push({
      position: recordPosition(record, CARD_LIFT_M),
      sourceId: record.id,
      id: sitadelDetectLabel(record),
      type: sitadelDetectType(record),
      skipLabel: record.id === _selectedId,
    });
    if (result.length >= maxCount) break;
  }
  return result;
}

/** The one line the DETECT callout shows for a permit. */
export function sitadelDetectLabel(record) {
  const permit = record?.permit;
  if (!permit) return messages().detectFallback;
  const street = [permit.an, permit.av].filter(Boolean).join(' ');
  return street || permit.dem || sitadelPermitTitle(permit);
}

/** The type noun under the DETECT callout: which kind of permit this is. */
export function sitadelDetectType(record) {
  const m = messages().detectType;
  if (record?.permit?.f === 'dem') return m.demolition;
  if (record?.permit?.b === 'commence') return m.buildingSite;
  return m.building;
}

// --- Row label --------------------------------------------------------------

/**
 * One line under the layer's toggle: which commune answered, and what it did
 * NOT place.
 *
 * The commune comes first on purpose. This layer holds ONE commune, and a
 * reader who does not know that reads the empty commune next door as "nothing
 * was authorised there" instead of "that was never asked".
 * @param {object} [state]
 * @returns {?string}
 */
export function buildSitadelLoadingLabel({
  payload = _payload,
  status = _status,
  loading = _loading,
  commune = _communeName,
} = {}) {
  const m = messages().row;
  if (loading) return sitadelLoadingLabel({ status: 'loading', commune });
  if (status === 'too-high') return sitadelLoadingLabel({ status: 'too-high' });
  if (status === 'no-view') return m.noGround;
  if (status === 'no-commune') return sitadelLoadingLabel({ status: 'no-commune' });
  if (!payload?.summary) return null;
  const head = sitadelLoadingLabel({
    status: 'ready',
    commune: payload.commune,
    summary: payload.summary,
    millesime: payload.millesime,
  });
  const notes = [];
  if (payload.summary.demolitionAvailable === false) notes.push(m.noDemolitionFile);
  if (payload.outline?.simplified) notes.push(m.simplifiedOutline);
  return notes.length ? `${head} · ${notes.join(' · ')}` : head;
}

// --- Layer ------------------------------------------------------------------

/**
 * Offer the permits this commune pack already holds, keyed on the PARCEL.
 *
 * The building layer's card asks "what has been authorised on this ground",
 * and the answer is already in memory: this layer placed each permit on the
 * exact cadastral parcel its reference names. What it does NOT hold is the
 * 14-character id everything else joins on — Sitadel publishes the commune,
 * the section and the number separately and no préfixe at all, which the
 * cadastre supplies when the parcel is resolved. `cadastralParcelId` assembles
 * it, and refuses rather than pads when a piece is missing.
 *
 * Offered rather than imported, so a reader who closes this row takes the line
 * off that card and nothing else changes.
 */
function publishByParcel() {
  const permits = Array.isArray(_payload?.permits) ? _payload.permits : [];
  const parcels = Array.isArray(_payload?.parcels) ? _payload.parcels : [];
  if (!permits.length || !parcels.length) {
    _unpublishByParcel?.();
    _unpublishByParcel = null;
    return;
  }
  const idBySlot = parcels.map((parcel) => cadastralParcelId({
    commune: parcel?.m, prefixe: parcel?.x, section: parcel?.s, numero: parcel?.n,
  }));
  const byParcel = new Map();
  for (const permit of permits) {
    for (const slot of permit?.px || []) {
      const id = idBySlot[slot];
      if (!id) continue;
      let bucket = byParcel.get(id);
      if (!bucket) { bucket = []; byParcel.set(id, bucket); }
      bucket.push(permit);
    }
  }
  _unpublishByParcel?.();
  _unpublishByParcel = publishJoin('sitadel/byParcel', (parcelId) => {
    const bucket = byParcel.get(String(parcelId || '').trim());
    if (!bucket?.length) return null;
    // `permits` arrives sorted newest-authorisation first, so the first entry
    // of a bucket is the newest without a second sort.
    const newest = bucket[0];
    const band = SITADEL_BANDS.find((entry) => entry.id === newest.b) || null;
    return {
      count: bucket.length,
      newest: {
        date: newest.da || null,
        label: [newest.t, band ? sitadelBandLabel(band.id) : null].filter(Boolean).join(' · ') || null,
        dwellings: Number.isFinite(newest.lgt) ? newest.lgt : null,
      },
    };
  });
}

/**
 * Offer the dossiers this layer has drawn on their parcels, keyed as `ads-fr`
 * keys them (`series|number`), so the row's other permit layer lays no second
 * badge on the same plot — see `PERMIT_DRAWN_ON_PARCEL_JOIN`.
 *
 * Taken down and put back on every draw rather than updated in place: the
 * board announces a key coming and going, and that announcement is how
 * `ads-fr` learns the set changed and redraws from the answer it holds.
 */
function publishDrawnDossiers() {
  _unpublishDrawn?.();
  _unpublishDrawn = null;
  if (!_enabled || !_records.size) return;
  const keys = new Set();
  for (const record of _records.values()) {
    const number = dossierKey(record.permit?.i);
    if (number) keys.add(`${record.permit.f === 'dem' ? 'PD' : 'DAU'}|${number}`);
  }
  _unpublishDrawn = publishJoin(PERMIT_DRAWN_ON_PARCEL_JOIN, () => keys);
}

const sitadelFranceLayer = {
  id: SITADEL_FR_LAYER_ID,
  // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
  name: 'Autorisations d’urbanisme (Sitadel)',
  // 🏗 and not 🏠/🏢: the BÂTI & TERRITOIRE neighbours are € (DVF), ▤ (DPE and
  // GPU), ▦ (bâti 3D and cadastre), 🎓 (écoles) and 🏛 (enseignement
  // supérieur). A crane is the one glyph on that shelf that says "not built
  // yet", which is the entire distinction between this layer and its siblings.
  icon: '🏗',
  source: SITADEL_SOURCE,
  // i18n-ignore-end
  updateInterval: UPDATE_INTERVAL_MS,

  init(viewer) {
    _viewer = viewer;
    _enabled = false;
    _records = new Map();
    _owners = new Map();
    _payload = null;
    _selectedId = null;
    _loading = false;
    _error = null;
    _status = 'idle';
    _stale = false;
    _lastUpdate = null;
    _focusKey = null;
    _communeName = null;
    _drawn = null;
    resetFloorRetries();
    _classificationType = powerClassificationTypeForScene(viewer?.scene);

    _badges = new Cesium.BillboardCollection({ scene: viewer.scene });
    _badges.show = false;
    viewer.scene.primitives.add(_badges);
    registerSpriteCollection(SITADEL_FR_LAYER_ID, _badges);
    restoreSpriteOrder(viewer);

    if (typeof window !== 'undefined' && !_mapStackListener) {
      _mapStackListener = (event) => {
        applyClassification(event?.detail?.activeId !== undefined
          ? powerClassificationTypeForStack(event.detail.activeId)
          : powerClassificationTypeForScene(_viewer?.scene));
      };
      window.addEventListener('gev:map-stack-changed', _mapStackListener);
    }
    _overlayHost.setVisible(SITADEL_FR_OVERLAY_SOURCE_ID, false);
    console.log('[Data:Sitadel FR] Initialized');
  },


  enable(viewer) {
    _enabled = true;
    _error = null;
    if (_badges) _badges.show = true;
    if (_fills) _fills.show = true;
    if (_edges) _edges.show = true;
    if (_outline) _outline.show = true;
    // The boot-time stack settle fires no event, so re-derive on every enable
    // rather than trusting whatever the last event left behind.
    applyClassification(powerClassificationTypeForScene(viewer?.scene || _viewer?.scene));
    restoreSpriteOrder(viewer);
    _overlayHost.setVisible(SITADEL_FR_OVERLAY_SOURCE_ID, true);
    installClickHandler(viewer);
    registerPickOwner(SITADEL_FR_LAYER_ID, (pickedId) => _records.has(pickedId));
    // Republish what is already in hand: a row switched off and on again gets
    // an `unchanged` answer from the proxy, so the load path would not run and
    // the offer would stay down under a pack that is right there.
    publishByParcel();
    publishDrawnDossiers();
    if (!_moveEndRemover) {
      _moveEndRemover = viewer.camera.moveEnd.addEventListener(scheduleLoad);
    }
    // DataLayerManager calls update() immediately after enable(), which owns
    // the first fetch. Avoid racing it with a second aborting request here.
  },

  disable() {
    _enabled = false;
    clearSelection();
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
    _abort?.abort();
    _abort = null;
    if (_badges) _badges.show = false;
    if (_fills) _fills.show = false;
    if (_edges) _edges.show = false;
    if (_outline) _outline.show = false;
    resetFloorRetries();
    _overlayHost.setVisible(SITADEL_FR_OVERLAY_SOURCE_ID, false);
    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
    if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeyDown);
    unregisterPickOwner(SITADEL_FR_LAYER_ID);
    _unpublishByParcel?.();
    _unpublishByParcel = null;
    _unpublishDrawn?.();
    _unpublishDrawn = null;
    if (_moveEndRemover) {
      _moveEndRemover();
      _moveEndRemover = null;
    }
    _loading = false;
    _status = 'idle';
  },

  async update() {
    if (!_enabled) return false;
    // `load()` answers "did I redraw", which is false for a camera above the
    // gate and false when the commune has not changed. Neither is a refusal of
    // the lifecycle transition, and DataLayerManager reads a literal `false`
    // from update() as exactly that.
    await load({ force: true });
    return true;
  },

  getDetectableObjects(options = {}) {
    return collectDetectableObjects(options);
  },

  getStats() {
    const summary = _payload?.summary || null;
    const stats = {
      count: _records.size,
      lastUpdate: _lastUpdate,
      loading: _loading,
      // `zoom-in` and `empty` are GUIDANCE_STATUSES: the panel keeps a green ON
      // chip and shows the prompt, instead of reading a camera that is too
      // high as a broken feed.
      status: _status === 'ready' ? 'ok'
        : _status === 'too-high' ? 'zoom-in'
          : _status === 'no-commune' || _status === 'no-view' ? 'empty'
            : _status,
      stale: _stale,
      insee: _payload?.insee ?? null,
      commune: _communeName,
      departement: _payload?.deptName ?? null,
      // The honesty numbers, surfaced rather than buried in a tooltip.
      permits: summary?.permits ?? null,
      placed: summary?.placed ?? null,
      ambiguous: summary?.ambiguous ?? null,
      missing: summary?.missing ?? null,
      noref: summary?.noref ?? null,
      placementRate: summary && summary.permits > 0
        ? Math.round((1000 * summary.placed) / summary.permits) / 10 : null,
      parcels: summary?.parcels ?? null,
      multiParcel: summary?.multiParcel ?? null,
      dwellings: summary?.dwellings ?? null,
      dwellingsDrawn: summary?.dwellingsDrawn ?? null,
      surfaceCreated: summary?.surfaceCreated ?? null,
      dwellingsDemolished: summary?.dwellingsDemolished ?? null,
      terrainChecked: summary?.terrainChecked ?? null,
      terrainAgreeing: summary?.terrainAgreeing ?? null,
      mojibakeRepaired: summary?.mojibake ?? null,
      demolitionAvailable: summary?.demolitionAvailable ?? null,
      cadastreParcels: summary?.cadastreParcels ?? null,
      millesime: _payload?.millesime ?? null,
      cadastreEdition: _payload?.cadastreEdition ?? null,
      // The row's « Période », and how many permits it keeps.
      months: _months,
      drawnInPeriod: _drawn?.permits?.length ?? null,
    };
    const label = buildSitadelLoadingLabel();
    if (label) stats.loadingLabel = label;
    if (_error) stats.error = _error;
    return stats;
  },

  /** Provenance for the attribution popover and the analyst surfaces. */
  getViewportSummary() {
    if (!_payload) return null;
    const { permits, parcels, outline, ...rest } = _payload;
    return {
      ...rest,
      drawn: _records.size,
      parcelsDrawn: parcels?.length ?? 0,
      outline: outline ? { parts: outline.parts?.length ?? 0, simplified: Boolean(outline.simplified) } : null,
      unplaced: sitadelUnplacedLines(_payload.summary),
      maxAltitudeM: SITADEL_MAX_ALTITUDE_M,
    };
  },

  /**
   * The key: one plain line per class drawn, folded under « Couleurs des
   * projets » with the selected permit's card above it.
   *
   * ONLY the classes actually drawn. The permits that could not be placed are
   * NOT here: the swatch is the colour those objects are painted, and there is
   * no colour for an object that is nowhere. They are on the row line, in
   * `getStats()` and on every card instead.
   */
  getRowControls() {
    const present = new Set([..._records.values()].map((record) => record.classId));
    const selected = _selectedId ? _records.get(_selectedId) : null;
    return {
      chips: [],
      legend: permitProjectLegend(present),
      legendFold: permitProjectFoldTitle(),
      // Declared while a parcel is washed: on Google 3D the wash climbs the
      // façades (`surfaceFillNotice.js`).
      surfaceFill: _records.size > 0,
      legendSelection: selected ? sitadelPermitPanel(selected, _drawn) : null,
    };
  },

  /** The key's close button: dismiss the selected permit, as Escape does. */
  clearSelectedCard() {
    clearSelection();
  },

  /** The row's « Période », mirrored from `ads-fr` in a share link. */
  getParams() {
    return { months: _months };
  },

  /**
   * Whether a set of params is one this layer takes — the fan-out of the row's
   * « Période » asks before it sends (`_offerParamsToRow` in manager.js).
   * @param {object} params
   * @returns {boolean}
   */
  acceptsParams(params) {
    const keys = Object.keys(params || {});
    return keys.length > 0 && keys.every((key) => key === 'months')
      && SITADEL_WINDOWS.includes(String(params.months));
  },

  /**
   * Change the period. A closed set — refused, never clamped, since a share
   * link reaches here. Redraws from the pack in hand: no request.
   * @param {object} params
   * @returns {boolean}
   */
  setParams(params = {}) {
    if (!Object.hasOwn(params, 'months')) return Object.keys(params).length === 0;
    if (!this.acceptsParams(params)) return false;
    const next = String(params.months);
    if (next === _months) return true;
    _months = next;
    if (_payload && _viewer) {
      drawPack(_payload);
      _status = _records.size ? 'ready' : 'empty';
    }
    return true;
  },

  destroy(viewer) {
    if (_enabled) this.disable(viewer);
    else {
      clearSelection();
      if (_clickHandler) {
        _clickHandler.destroy();
        _clickHandler = null;
      }
      if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeyDown);
      unregisterPickOwner(SITADEL_FR_LAYER_ID);
    }
    if (typeof window !== 'undefined' && _mapStackListener) {
      window.removeEventListener('gev:map-stack-changed', _mapStackListener);
      _mapStackListener = null;
    }
    if (_moveEndRemover) {
      _moveEndRemover();
      _moveEndRemover = null;
    }
    resetFloorRetries();
    clearSurfaces();
    if (_badges) {
      unregisterSpriteCollection(SITADEL_FR_LAYER_ID, _badges);
      (viewer || _viewer)?.scene?.primitives?.remove?.(_badges);
      _badges = null;
    }
    _records.clear();
    _owners.clear();
    _payload = null;
    _drawn = null;
    _viewer = null;
  },
};

// --- Test seams -------------------------------------------------------------

/**
 * Seed rendered records so the selection, card, legend, stats and detection
 * paths run without WebGL.
 *
 * The badges are seeded as plain objects rather than billboards, so a test can
 * drive `selectPermit()` — which mutates the billboard it selected — with no GL
 * context. The pack is seeded as drawn, whatever the period. `viewer` is still
 * supplied by the tests that exercise the parcel highlight, which really does
 * add a `GroundPolylinePrimitive`.
 * @param {object} [state]
 */
export function _setSitadelStateForTest({
  viewer, payload = null, overlayHost, enabled = true, status = 'ready',
  loading = false, fetchImpl, focusKey = null, error = null, badges,
} = {}) {
  _fetchImpl = fetchImpl || null;
  _viewer = viewer || null;
  // The badge collection is OPT-IN: most tests seed plain-object badges below
  // and never draw. A test that hands one over is asking for the real
  // `drawPack`.
  _badges = badges || null;
  _overlayHost = overlayHost || DEFAULT_OVERLAY_HOST;
  _payload = payload;
  _drawn = payload;
  _owners = sitadelParcelOwners(payload);
  _records = new Map();
  for (const record of sitadelPermitRecords(payload)) {
    record.badge = { image: permitBadgeImage(record.classId), width: PERMIT_BADGE_PX, height: PERMIT_BADGE_PX };
    _records.set(record.id, record);
  }
  _enabled = enabled;
  _selectedId = null;
  _loading = loading;
  _error = error;
  _status = status;
  _stale = Boolean(payload?.stale);
  _lastUpdate = payload ? (Number(payload.fetchedAt) || Date.now()) : null;
  _focusKey = focusKey;
  _communeName = payload?.commune || payload?.insee || null;
  // `GroundPolylinePrimitive.isSupported` reads a live WebGL context and there
  // is none under `node --test`. A test that supplies a viewer is asking for
  // the parcel-highlight and outline paths to RUN, so the capability probe is
  // answered here instead of being asked; `_clearSitadelSelectionForTest`
  // puts it back to null so production still probes for itself.
  _groundLinesSupported = Boolean(viewer);
}

/** Exercise the production selection path in focused runtime tests. */
export function _selectSitadelForTest(id) {
  selectPermit(id);
}

/** Exercise the production clear path and restore the production seams. */
export function _clearSitadelSelectionForTest() {
  clearSelection();
  resetFloorRetries();
  _months = SITADEL_WINDOW_DEFAULT;
  _drawn = null;
  _fetchImpl = null;
  _overlayHost = DEFAULT_OVERLAY_HOST;
  _payload = null;
  _records = new Map();
  _owners = new Map();
  _enabled = false;
  _status = 'idle';
  _loading = false;
  _error = null;
  _stale = false;
  _focusKey = null;
  _communeName = null;
  _groundLinesSupported = null;
  _badges = null;
  _viewer = null;
}

/** @returns {?string} */
export function _sitadelSelectedIdForTest() {
  return _selectedId;
}

/** Row-control legend, for tests that do not construct a viewer. */
export function _sitadelRowControlsForTest() {
  return sitadelFranceLayer.getRowControls();
}

/** Stats, for tests that do not construct a viewer. */
export function _sitadelStatsForTest() {
  return sitadelFranceLayer.getStats();
}

/** Detection candidates, for tests that do not construct a viewer. */
export function _sitadelDetectablesForTest(options = {}) {
  return collectDetectableObjects(options);
}

/** One render record by id, so a test can assert on what was seeded. */
export function _sitadelRecordForTest(id) {
  return _records.get(id) || null;
}

/** Every render id, in draw order. */
export function _sitadelRecordIdsForTest() {
  return [..._records.keys()];
}

/**
 * Drive the real `load()` — the gate, the focus key, the `have=` round trip,
 * the no-commune branch and the degraded branch — against an injected fetch.
 * @param {object} [options]
 * @returns {Promise<boolean>}
 */
export async function _sitadelLoadForTest(options = {}) {
  return load(options);
}

/**
 * Build the three ground batches against a seeded pack.
 *
 * `_setSitadelStateForTest` deliberately does not draw — it seeds records so the
 * card and legend paths run without a scene. This is the seam for the geometry
 * itself: it runs the REAL `drawSurfaces`, so the edge colour is the
 * production one.
 * @returns {{fills: ?object, edges: ?object, outline: ?object}}
 */
export function _drawSitadelSurfacesForTest(payload = _drawn) {
  drawSurfaces(payload);
  return { fills: _fills, edges: _edges, outline: _outline };
}

/**
 * Drive the real `drawPack` against a supplied `BillboardCollection`.
 *
 * The seam the FLOOR tests need: `_setSitadelStateForTest` seeds plain-object
 * badges, which cannot answer "where is this mark in the world". This runs the
 * production path — the period, the provisional sampling, the anchor, the
 * ladder — and hands back the collection that was actually written to. The
 * period defaults to the whole register, so a fixture of any age is drawn.
 * @param {?object} payload
 * @param {{months?: string}} [options]
 * @returns {?Cesium.BillboardCollection}
 */
export function _drawSitadelPackForTest(payload = _payload, { months = SITADEL_WINDOWS[SITADEL_WINDOWS.length - 1] } = {}) {
  _payload = payload;
  _months = months;
  drawPack(payload);
  return _badges;
}

/**
 * Run one deferred floor pass now, without waiting out the ladder's timer.
 *
 * Disarms first, exactly as the timer's own callback does, so a test can read
 * `_sitadelFloorReanchorPendingForTest` afterwards and learn whether THIS pass
 * asked for another one rather than seeing the wakeup that scheduled it.
 */
export function _sitadelRefreshFloorsForTest() {
  if (_floorRetryTimer != null) {
    clearTimeout(_floorRetryTimer);
    _floorRetryTimer = null;
  }
  refreshFloors();
}

/** Whether a re-anchor is armed, without exposing the timer. */
export function _sitadelFloorReanchorPendingForTest() {
  return Boolean(_floorRetryTimer);
}

/** What the layer thinks about its own camera state right now. */
export function _sitadelGateStateForTest() {
  return { status: _status, focusKey: _focusKey, commune: _communeName, drawn: _records.size };
}

export default sitadelFranceLayer;
