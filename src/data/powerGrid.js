import * as Cesium from 'cesium';
import { governorRequestRender } from '../renderGovernor.js';
import { registerSpriteCollection, restoreSpriteOrder, unregisterSpriteCollection } from './spriteOrder.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import { cachedGroundFloor, warmGroundFloor } from './groundFloor.js';
import { provisionalFloor, sampleProvisionalFloors } from './provisionalFloor.js';
import { horizonOccluder } from './iconOrientation.js';
import {
  clearOverlaySource,
  hitTestWorldOverlay,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import { pickOverlayLabelId } from './overlayLabelPick.js';
import { mapIconGlyph } from './mapIcons.js';
import { nightAtlasActive, watchNightAtlas } from '../styles/nightAtlas.js';
import {
  POWER_GRID_CASING_COLOR,
  POWER_GRID_CASING_PX,
  POWER_GRID_MAX_BOX_DEG,
  POWER_GRID_TIERS,
  POWER_PYLON_ICON_PX,
  POWER_PYLON_MAX_MARKS,
  formatKilovolts,
  powerPositionKey,
  powerPylonMarks,
  powerPylonSpacingM,
  powerTierById,
  powerTierColor,
  POWER_GRID_NIGHT_DRESS,
  POWER_GRID_NIGHT_HALO_PX,
  powerTowerIndex,
  substationRoleLabel,
} from './powerGridFeed.js';
import {
  POWER_GRID_NATIONAL_BBOX,
  POWER_GRID_NATIONAL_CASING_PX,
  POWER_GRID_NATIONAL_POINT_PX,
  POWER_GRID_NATIONAL_POINT_SCALE_FROM_SPACE,
  POWER_GRID_NATIONAL_TIER_BLURBS,
  POWER_GRID_NATIONAL_WIDTH_PX,
  hydratePowerGridNationalPack,
  powerGridNationalBand,
} from './powerGridNational.js';
import { applyViewGate, cameraViewBox } from './viewGate.js';
import { boxesIntersect, focusedViewBox } from './viewportBox.js';
import { pickAt } from './pickAt.js';
import { formatDecimal, formatInteger, formatNumber } from '../i18n/format.js';
import { coverAlphas, fadeInstances, quantizeFade, watchZoomFade } from './zoomFade.js';
import messages from './powerGrid.i18n.js';

/**
 * Power Grid — the high-voltage network as OpenStreetMap has mapped it, for the
 * viewport you are looking at.
 *
 * Three things, drawn together because the grid only reads as a system when
 * they are:
 *
 *   **the routes**  — `power=line` and `power=cable` ways at 50 kV and above,
 *                     clamped to the ground, coloured by voltage band, with the
 *                     underground half dashed so it is never mistaken for a
 *                     pylon route
 *   **the nodes**   — `power=substation` yards at the same voltages, sized by
 *                     band, which is where those routes actually terminate
 *   **the pylons**  — a Temaki `power_tower` glyph on the mapped vertices of the
 *                     overhead ways, at the spacing the camera can read, tinted
 *                     with the route's own voltage colour
 *
 * Keyless, ODbL 1.0, all through the `/api/power-grid` proxy. The upstream traps
 * live in `powerGridFeed.js` under test against a captured Overpass response;
 * this module is the drawing.
 *
 * ── What the drawing is careful about ───────────────────────────────────────
 *
 * • **A stroke is on the ground because the height is not published.** A 400 kV
 *   conductor hangs 20-40 m up and OSM records that for about a third of pylons
 *   and for no line at all. So the routes are clamped ground polylines — the
 *   mapped ROUTE, drawn where it is known to be — and the card says so. Lifting
 *   them to a plausible catenary would be inventing the one number the data
 *   withholds.
 *
 * • **This is volunteer mapping, not a grid register.** RTE publishes no public
 *   geometry, which is why this layer exists at all; OSM's coverage of it is
 *   excellent in France and uneven elsewhere. An empty viewport means nothing is
 *   MAPPED there, and the empty state says exactly that rather than "no grid".
 *
 * • **Voltage is the filter because voltage is the evidence.** Anything OSM has
 *   not given a voltage is not drawn — not demoted, not guessed. That is also
 *   why the legend counts by band rather than by feature type.
 *
 * • **A stroke is not a line.** OSM splits one named liaison across dozens of
 *   ways at every junction and attribute change, so the layer reports both: the
 *   stroke count it drew, and the distinct mapped ROUTE names behind them.
 *
 * • **The ground is where these objects are.** Substations and pylons sit on the
 *   local ground floor, and strokes are clamped ground polylines classified
 *   against ONLY the active surface — the rule the submarine-cable, Vigicrues
 *   and gas layers established, with BOTH as the safe fallback for an unknown
 *   stack.
 *
 * ── WHAT THE 2026-09-14 PASS CHANGED, AND WHY ───────────────────────────────
 *
 * The operator's report was three sentences and every one of them was a real
 * defect. They are recorded here because each fix is a rule, not a tweak.
 *
 * 1. **"Il faut un certain zoom, une certaine inclinaison pour que le réseau
 *    daigne bien se montrer."** The request box was the span of
 *    `computeViewRectangle`, which on a tilted camera reaches the HORIZON —
 *    0.278° of longitude at Bayonne looking straight down from 19.5 km, and
 *    1.076° at a 35° pitch from the SAME altitude. The 0.8° ceiling fell
 *    between the two, so the layer refused the oblique view this globe opens
 *    on. The box is now `focusedViewBox` around what the camera is aiming at,
 *    sized from the ALTITUDE (`powerBoxDegForAltitude`) and gated on it
 *    (`POWER_GRID_MAX_ALTITUDE_M`). See `powerViewportBox`.
 *
 * 2. **"Le tracé se fait via un tout petit trait, c'est quasi invisible."**
 *    True at 1.6–3.2 px with no casing. The bands are 3–5.5 px now and every
 *    stroke is drawn twice, near-black and wider underneath. See `buildStrokes`.
 *
 * 3. **"J'ai pas l'impression qu'il y ait une légende."** There was one, and
 *    the layer was deleting it: a camera past the ceiling ran `clearRendered()`,
 *    which nulls `_payload`, and the key is built from `_payload.tiers`. A
 *    camera moving does not make mapped geometry wrong, so what was loaded now
 *    stays drawn — and keyed — until it leaves the shot. See `load`.
 *
 * ── WHAT THE 2026-09-19 PASS CHANGED: A NATIONAL LAYER UNDER THE VIEWPORT ───
 *
 * "Il met beaucoup de temps à s'afficher, et j'aimerais qu'il s'affiche même
 * avec une vue bien dézoomée et nationale." Both halves were true, and both
 * had the same cause: every route on screen came from a live Overpass query,
 * so nothing could be drawn above the 120 km that query tolerates, and every
 * box nobody had asked for yet cost 4 to 21 s of Overpass before a line
 * appeared. The gas layer, which the operator was happy with, has neither
 * problem because its whole network is one file.
 *
 * So the grid now has one too: `local_data/power_grid_fr/national.json`, every
 * high-voltage route and substation mapped in France, simplified to 50 m and
 * shipped as a static asset (`powerGridNational.js` says what was cut and why).
 * The layer draws it at ANY altitude, band by band (`powerGridNationalBand`):
 * the 400/225 kV backbone from space, the 63/90 kV mesh under 600 km. Under
 * 120 km the per-viewport path still loads — pylons, named yards, the exact
 * mapped vertices — and as its answer lands, the national strokes it covers
 * are hidden ONE WAY AT A TIME (`syncNationalHidden`), so the viewport answer
 * replaces them in place and the rest of the country stays drawn around it.
 * Until that answer arrives, and if it never does, the national strokes are
 * what the operator sees: the wait for Overpass is a refinement now, not a
 * blank globe.
 */

const GRID_URL = '/api/power-grid';
/**
 * The national pack. Resolved by Vite to a content-hashed asset, so it is
 * served pre-compressed (brotli, ~570 KB on the wire for 2.8 MB) and cached
 * as immutable — a second visit does not download it again.
 */
const NATIONAL_URL = new URL('./local_data/power_grid_fr/national.json', import.meta.url).href;
/** Render-id prefixes for the national strokes, their casings and their yards. */
const NATIONAL_STROKE_PREFIX = 'power-grid:nat:';
const NATIONAL_CASING_PREFIX = 'power-grid:nat-casing:';
const NATIONAL_SUBSTATION_PREFIX = 'power-grid:nat-substation:';
/** Retry delay after the pack itself failed to load. */
const NATIONAL_RETRY_MS = 30_000;
/**
 * Band order for the national batches, lowest voltage first: `groundPrimitives`
 * draws in insertion order, so this is also the paint order — the 400 kV
 * backbone lands on top of the mesh it crosses.
 */
const NATIONAL_TIER_ORDER = Object.freeze(POWER_GRID_TIERS.map((tier) => tier.id).reverse());

/** Layer id — also the share-link registry key and the voice-tool enum value. */
export const POWER_GRID_LAYER_ID = 'power-grid';
/** Ambient labels: the named high-voltage yards, which are the readable nodes. */
export const POWER_GRID_OVERLAY_SOURCE_ID = 'power-grid';
/** Selected-object card, on its own protected source. */
export const POWER_GRID_SELECTED_OVERLAY_SOURCE_ID = 'power-grid-selected';
/** Ambient-label entry-id prefix — the click surface the yard's NAME provides. */
export const POWER_GRID_LABEL_PREFIX = 'power-grid-label:';
/** Ambient-label cohort ceiling — the grid nodes worth naming at a glance. */
export const POWER_GRID_OVERLAY_COHORT_LIMIT = 14;
/** Shared ambient-label paint budget, matching the sibling infrastructure layers. */
export const POWER_GRID_OVERLAY_COLLISION_CAPACITY = 14;

export const POWER_GRID_SELECTED_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});

/** Debounce between the camera settling and the request that follows it. */
const REQUEST_DEBOUNCE_MS = 500;
/** First step of the failed-load backoff, and its ceiling. */
const RETRY_MIN_MS = 20_000;
const RETRY_CEIL_MS = 240_000;
/**
 * Idle refresh cadence. A transmission line is built over a decade and mapped
 * once; this exists so a session left open overnight picks up an edit, not
 * because anything is expected to move. The proxy holds 10 min in memory and
 * 7 days on disk in front of Overpass.
 */
const UPDATE_INTERVAL_MS = 20 * 60_000;
const REQUEST_TIMEOUT_MS = 60_000;

/** Points sit this far above the local ground floor. */
const POINT_LIFT_M = 2.5;
/**
 * How far a cell the rendered-surface probe budget did not reach may borrow a
 * floor from, in km. Wider than the street-scale layers' 10 km because a
 * transmission corridor is a long thin object: the pylons a 40-probe budget
 * misses are on the same relief as the ones it hit, tens of kilometres along
 * the same line.
 */
const FLOOR_FILL_KM = 20;

/**
 * Pylons.
 *
 * They used to be 4 px grey dots and the colour was `#9fb0c4` — deliberately
 * dim, so as not to compete with the routes. That was the wrong problem to
 * solve: at 4 px a pylon competes with nothing because it is not visible, and
 * what the overhead network needed was a mark that says "steel and conductors
 * overhead" rather than one that says "a point is here". They are now Temaki's
 * `power_tower` tinted with the route's OWN band colour, which is what makes a
 * 400 kV corridor read as one object instead of a line and some dots.
 */
const PYLON_ALPHA = 0.95;

const SELECTED_COLOR = '#00ffff';
const SELECTED_POINT_PX = 20;
const SELECTED_PYLON_PX = 26;
const SELECTED_STROKE_WIDTH = 6;

/** Stroke opacity — quiet infrastructure, not a warning. */
const STROKE_ALPHA = 0.9;
/**
 * Casing opacity. Below 1 on purpose: the casing is a shadow under the route,
 * not a second black line beside it, and at 0.72 the imagery still shows what
 * the route is crossing.
 */
const CASING_ALPHA = 0.72;

/** Underground strokes are dashed AND slightly dimmer: they are not overhead. */
const UNDERGROUND_ALPHA = 0.72;
const UNDERGROUND_DASH_LENGTH = 14;

/** Substation outline, so a yard reads as a node rather than a fat line vertex. */
const SUBSTATION_OUTLINE_ALPHA = 0.65;

/**
 * `MAP_STACKS` ids that render imagery on the SHOWN Cesium globe. An explicit
 * allowlist for the same reason the cable and gas layers keep one: a stack id
 * this module has never heard of must reach the documented BOTH fallback rather
 * than be asserted onto a surface that is not there.
 */
const POWER_GLOBE_STACK_IDS = Object.freeze(new Set(['bing-aerial', 'bing-labels', 'osm', 'ign-ortho', 'ign-plan']));

/**
 * Ground-line classification for one map stack.
 * @param {string|null|undefined} activeId MapStackController stack id.
 * @returns {Cesium.ClassificationType}
 */
export function powerClassificationTypeForStack(activeId) {
  if (activeId === 'photoreal') return Cesium.ClassificationType.CESIUM_3D_TILE;
  if (POWER_GLOBE_STACK_IDS.has(activeId)) return Cesium.ClassificationType.TERRAIN;
  return Cesium.ClassificationType.BOTH;
}

/**
 * Derive the active surface from live scene state, for the boot-time stack
 * settle that fires no `gev:map-stack-changed` event.
 * @param {Cesium.Scene|null|undefined} scene
 * @returns {Cesium.ClassificationType}
 */
export function powerClassificationTypeForScene(scene) {
  if (!scene?.globe) return Cesium.ClassificationType.BOTH;
  return scene.globe.show === false
    ? Cesium.ClassificationType.CESIUM_3D_TILE
    : Cesium.ClassificationType.TERRAIN;
}

const DEFAULT_OVERLAY_HOST = Object.freeze({
  setEntries: setOverlayEntries,
  setVisible: setOverlaySourceVisible,
  clearSource: clearOverlaySource,
  hitTest: hitTestWorldOverlay,
});

/**
 * Highest camera this layer will load for, in metres.
 *
 * The box ceiling is 0.8° ≈ 89 km of ground, and this is the altitude at which
 * that patch stops being most of the screen: a nadir camera sees roughly 1.15 ×
 * its height, so at 120 km the loaded grid still fills about three-quarters of
 * the view. Above it the layer would be drawing a postage stamp in the middle
 * of a continent, which is worse than saying so.
 */
export const POWER_GRID_MAX_ALTITUDE_M = 120_000;

/**
 * How much ground the request box spans, as a multiple of the camera's height.
 *
 * The ceiling is not the only thing that should size a request. A camera at
 * 3 km asking for the full 0.8° is asking for 89 km of Overpass to draw 12 km
 * of screen — slower to load, and no more visible for it.
 *
 * 4× is measured, not chosen: the tilted camera in the bug report (19.5 km,
 * 35° pitch) frames 87 km × 63 km of ground, and 4 × 19.5 km = 78 km covers
 * essentially all of it. Under a NADIR camera this never bites, because
 * `focusedViewBox` clips to the view and the view is the smaller of the two.
 *
 * It also restores something the focus box would otherwise have taken away.
 * Pylon RECORDS are fetched below `POWER_GRID_TOWER_MAX_BOX_DEG`, decided from
 * the box; a focus box pinned at the ceiling would have meant a tilted camera
 * never got one at any altitude. At 4× the records come back under ~7 km, which
 * is where a reference and a design are worth reading.
 */
export const POWER_GRID_BOX_PER_ALTITUDE = 4;
/** Metres per degree of latitude (WGS84 mean), to turn that into degrees. */
const M_PER_DEG_LAT = 111_320;
/** Never ask for less than the proxy's own snap step — a smaller box is free. */
const POWER_GRID_MIN_BOX_DEG = 0.05;

/**
 * The box span this camera should ask for, in degrees.
 * @param {number} altitudeM
 * @returns {number}
 */
export function powerBoxDegForAltitude(altitudeM) {
  if (!Number.isFinite(altitudeM) || altitudeM <= 0) return POWER_GRID_MIN_BOX_DEG;
  const span = (altitudeM * POWER_GRID_BOX_PER_ALTITUDE) / M_PER_DEG_LAT;
  return Math.min(POWER_GRID_MAX_BOX_DEG, Math.max(POWER_GRID_MIN_BOX_DEG, span));
}

/**
 * The point on the globe the middle of the screen is looking at.
 *
 * `pickEllipsoid` and not `globe.pick`: the ellipsoid always answers, terrain
 * may not have streamed yet, and a request box does not need centimetres — it
 * needs to be in the right kilometre. Null when the middle of the screen is
 * sky, which the caller handles rather than guessing. Same function, for the
 * same reason, as `cadastreFocusPoint`.
 * @param {?Cesium.Viewer} viewer
 * @returns {?{lat:number, lon:number}}
 */
export function powerFocusPoint(viewer) {
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
 * The viewport this layer will ask for, or null when there is nothing to ask.
 *
 * THE GATE IS THE CAMERA'S ALTITUDE, AND THE BOX IS AROUND WHAT IT IS LOOKING
 * AT. It used to be the span of `computeViewRectangle`, and that is the bug the
 * operator reported on 2026-09-14 as "il faut un certain zoom, une certaine
 * inclinaison pour que le réseau daigne bien se montrer".
 *
 * The rectangle a tilted camera reports reaches the HORIZON, so its span says
 * almost nothing about how close the camera is. Measured over Bayonne at
 * 19.5 km: **0.278° of longitude looking straight down, 1.076° at a 35° pitch**
 * — the same altitude, 3.9× the box, one side of the 0.8° ceiling each. This
 * globe opens on an oblique view, so the layer refused to load on exactly the
 * camera the app hands its operator, and the row told them to zoom in when the
 * lines were already under their nose.
 *
 * The repair is not a bigger ceiling — a bigger ceiling is a bigger Overpass
 * query for ground that is a smear at that distance. It is `focusedViewBox`:
 * a `maxDeg` box centred on the point the middle of the screen meets the globe,
 * clipped to the view. Nadir and low, the view is the smaller of the two and
 * the result IS the view. Tilted, it is the near and middle ground around what
 * is being looked at, and the far half of the screen — where a 400 kV line is a
 * third of a pixel — is simply not asked for. Lifted from `cadastreFeed.js`,
 * which learned it from the same bug report a fortnight earlier.
 *
 * @param {Cesium.Viewer|null} viewer
 * @returns {?{south:number, west:number, north:number, east:number}}
 */
export function powerViewportBox(viewer) {
  // The shared `cameraViewBox`, not a local conversion: the same arithmetic the
  // view gate solves its flights against, so the box this layer asks for and
  // the box a flight is planned from cannot drift apart.
  const view = cameraViewBox(viewer);
  if (!view) return null;
  const altitude = viewer?.camera?.positionCartographic?.height;
  if (!Number.isFinite(altitude) || altitude > POWER_GRID_MAX_ALTITUDE_M) return null;
  return focusedViewBox(view, powerFocusPoint(viewer), powerBoxDegForAltitude(altitude));
}

/**
 * Pixel size for a substation, from its voltage band.
 * A yard whose band is somehow unknown still draws, at the floor size, so it is
 * present and visibly unquantified rather than absent.
 * @param {?string} tierId
 * @returns {number}
 */
export function substationPointSize(tierId) {
  return powerTierById(tierId)?.pointPx ?? POWER_GRID_TIERS.at(-1).pointPx;
}

/**
 * Format a network length the way a control room writes it.
 * @param {?number} km
 * @returns {string}
 */
export function formatGridKm(km) {
  if (!Number.isFinite(km)) return '—';
  if (km >= 100) return `${formatInteger(km, { locale: 'en' })} km`;
  return `${formatDecimal(km, 1, { locale: 'en', minimumFractionDigits: 1 })} km`;
}

/**
 * The same length, written for the sentence around it: `89 058 km` in French,
 * where `89,058 km` reads as eighty-nine (the gas layer's lesson), and
 * `89,058 km` in English, where it reads as itself. The name is historical —
 * it is the locale-aware one of the pair.
 *
 * {@link formatGridKm} above stays US-grouped whatever the page is: it sits
 * inside the inherited English half of this layer's card and key.
 * @param {?number} km
 * @returns {string}
 */
export function formatGridKmFr(km) {
  if (!Number.isFinite(km)) return '—';
  if (km >= 100) return `${formatInteger(km)} km`;
  return `${formatDecimal(km, 1, { minimumFractionDigits: 1 })} km`;
}

/**
 * Card copy for a selected object. Every line is a mapped value or a stated
 * limit of the data — never an inference from one.
 *
 * @param {object} record Render record (`kind` is `stroke`, `substation` or `tower`).
 * @param {object} payload The loaded document, for its dictionaries.
 * @returns {string} Newline-separated card copy.
 */
export function buildPowerSelectionLabel(record, payload = {}) {
  const operators = Array.isArray(payload.operators) ? payload.operators : [];
  const routes = Array.isArray(payload.routes) ? payload.routes : [];
  const voltages = Array.isArray(payload.voltages) ? payload.voltages : [];
  const details = [];
  const m = messages();
  const operatorOf = (item) => (item?.o >= 0 ? operators[item.o] : null);
  const ceilingKm = Math.round(POWER_GRID_MAX_ALTITUDE_M / 1000);

  if (record?.kind === 'stroke') {
    const stroke = record.stroke || {};
    const voltage = voltages[stroke.vi] || {};
    const name = stroke.n >= 0 ? routes[stroke.n] : null;
    const kv = formatKilovolts(voltage.v);
    const title = name || (stroke.u ? m.card.cableTitle(kv) : m.card.lineTitle(kv));
    details.push(m.card.voltage(kv, voltage.all?.length > 1 ? m.card.voltageMapped(voltage.raw) : ''));
    const operator = operatorOf(stroke);
    if (operator) details.push(`🏢 ${operator}`);
    if (Number.isFinite(stroke.circuits)) details.push(m.card.circuits(stroke.circuits));
    details.push(stroke.u ? m.card.underground : m.card.overhead);
    if (Number.isFinite(stroke.km)) details.push(m.card.length(formatGridKm(stroke.km)));
    // A stroke from the national pack is drawn simplified, and the card is
    // where that is said: the length above is the MAPPED way's, the line on
    // screen is within `toleranceM` of it.
    if (Number.isFinite(payload.toleranceM)) {
      details.push(m.card.simplified(
        formatInteger(payload.toleranceM), formatInteger(ceilingKm),
      ));
    }
    details.push('© OpenStreetMap contributors (ODbL 1.0)');
    return [title, ...details].join('\n');
  }

  // A pylon mark. Two different objects wear one glyph and the card is where
  // the difference is stated: a mark that landed on a node tagged
  // `power=tower` is a PYLON with a record, and one that landed on an untagged
  // vertex of the mapped way is exactly that — a point someone surveyed on a
  // line that has pylons, which is not the same claim as "a pylon is here".
  if (record?.kind === 'tower' || record?.kind === 'pylon') {
    const tower = record.tower || null;
    if (!tower) {
      const voltage = voltages[record?.mark?.vi] || {};
      details.push(m.card.pylonRoute(formatKilovolts(voltage.v)));
      details.push(m.card.pylonUntaggedA);
      details.push(m.card.pylonUntaggedB);
      details.push('© OpenStreetMap contributors (ODbL 1.0)');
      return [m.card.pylonPositionTitle, ...details].join('\n');
    }
    const title = tower.portal ? m.card.portalTitle : m.card.pylonTitle;
    if (tower.ref) details.push(`# ${tower.ref}`);
    if (tower.design) details.push(`△ ${String(tower.design).replaceAll('_', ' ')}`);
    // Height is mapped for about a third of pylons; the rest say nothing and
    // this card says nothing rather than a prior.
    details.push(Number.isFinite(tower.h)
      ? m.card.height(formatInteger(tower.h))
      : m.card.heightUnmapped);
    const operator = operatorOf(tower);
    if (operator) details.push(`🏢 ${operator}`);
    details.push('© OpenStreetMap contributors (ODbL 1.0)');
    return [title, ...details].join('\n');
  }

  const substation = record?.substation || {};
  const voltage = voltages[substation.vi] || {};
  const title = substation.name
    || (substation.ref ? m.card.substationTitle(substation.ref) : m.card.substationFallbackTitle);
  details.push(m.card.voltage(
    formatKilovolts(voltage.v),
    voltage.all?.length > 1 ? m.card.voltageMapped(voltage.raw) : '',
  ));
  // The role travels on the record, labelled by the feed when the payload was
  // projected; a payload built in another language still reads here.
  details.push(`▣ ${substationRoleLabel(substation.role)}`);
  const operator = operatorOf(substation);
  if (operator) details.push(`🏢 ${operator}`);
  if (substation.ref) details.push(`# ${substation.ref}`);
  details.push(m.card.yardCentre);
  details.push('© OpenStreetMap contributors (ODbL 1.0)');
  return [title, ...details].join('\n');
}

/**
 * Protected selected-object entry for the shared overlay host.
 * @param {object} record
 * @param {object} payload
 * @returns {?object}
 */
export function createPowerSelectedOverlayEntry(record, payload) {
  const position = record?.position;
  if (!record?.id || !position) return null;
  const [title, ...details] = buildPowerSelectionLabel(record, payload).split('\n');
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

/**
 * Ambient label for one substation.
 * @param {object} substation
 * @param {Cesium.Cartesian3} position
 * @param {object} payload
 * @returns {object}
 */
export function createSubstationOverlayEntry(substation, position, payload = {}, { night = false } = {}) {
  const voltage = payload.voltages?.[substation.vi] || {};
  const tier = powerTierById(voltage.tier);
  const name = substation.name || messages().substationFallbackLabel(substation.ref || '').trim();
  return {
    id: `${POWER_GRID_LABEL_PREFIX}${substation.id}`,
    position,
    variant: 'label',
    title: `${name} · ${formatKilovolts(voltage.v)}`,
    accent: powerTierColor(tier, { night }) || powerTierColor(POWER_GRID_TIERS.at(-1), { night }),
    // The highest-voltage yard wins the collision; ties break on id.
    priority: Number.isFinite(voltage.v) ? Math.round(voltage.v) : 0,
    collisionGroup: 'ambient-label',
    paintLane: 'ambient-label',
    // The yard's name is a click surface, not a caption — see
    // `overlayLabelPick.js` for the mechanism and the pick-ordering rule.
    interactive: true,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
  };
}

/**
 * Which substations get a name on screen: the highest-voltage NAMED ones.
 *
 * An unnamed yard is excluded rather than labelled from its reference code — a
 * floating "SACL5" reads as noise, and the code is on the card for anyone who
 * clicks. Stable identity is the tie-break so the same yards keep their labels
 * across a pan.
 *
 * @param {Array<object>} entries
 * @param {number} [limit]
 * @returns {Array<object>}
 */
export function selectPowerOverlayCohort(entries, limit = POWER_GRID_OVERLAY_COHORT_LIMIT) {
  const cap = Math.max(0, Math.min(
    POWER_GRID_OVERLAY_COHORT_LIMIT,
    Math.floor(Number(limit) || 0),
  ));
  if (!Array.isArray(entries) || cap === 0) return [];
  return entries.slice().sort((a, b) => (
    b.priority - a.priority || String(a.id).localeCompare(String(b.id))
  )).slice(0, cap);
}

/**
 * Map one substation to a JSON-safe analyst record. Pure — no Cesium types.
 *
 * Only substations: a stroke is a fragment of a route and a pylon is a pole,
 * and neither is an object anyone asks a question about.
 *
 * @param {object|null|undefined} substation
 * @param {object} [payload]
 * @param {number} [index=0]
 * @returns {object}
 */
export function mapPowerAnalystRecord(substation, payload = {}, index = 0) {
  const str = (value) => {
    const trimmed = String(value ?? '').trim();
    return trimmed || null;
  };
  const voltage = payload.voltages?.[substation?.vi] || {};
  const operators = Array.isArray(payload.operators) ? payload.operators : [];
  return {
    id: str(substation?.id) || `GRID-${String(index).padStart(4, '0')}`,
    name: str(substation?.name),
    kind: 'substation',
    lat: Number.isFinite(substation?.lat) ? substation.lat : null,
    lon: Number.isFinite(substation?.lon) ? substation.lon : null,
    voltageV: Number.isFinite(voltage.v) ? voltage.v : null,
    voltageKv: Number.isFinite(voltage.v) ? Math.round(voltage.v / 1000) : null,
    role: str(substation?.role),
    roleLabel: str(substation?.roleLabel),
    operator: substation?.o >= 0 ? str(operators[substation.o]) : null,
    ref: str(substation?.ref),
  };
}

// --- Module state -----------------------------------------------------------

let _viewer = null;
let _points = null;
/** @type {?Cesium.BillboardCollection} The pylon glyphs along the overhead routes. */
let _pylons = null;
/** @type {Array<string>} Render ids currently held by `_pylons`, for a clean rebuild. */
let _pylonIds = [];
/** Ground metres between two drawn pylons on the last rebuild; 0 = none drawn. */
let _pylonSpacingM = 0;
let _overlayHost = DEFAULT_OVERLAY_HOST;
let _enabled = false;
let _classificationType = Cesium.ClassificationType.BOTH;
/** Whether the bands wear their night dress — see `POWER_GRID_NIGHT_DRESS`. */
let _night = false;
/** Stop following the night atlas. Null while this layer is off. */
let _unwatchNight = null;
let _mapStackListener = null;
let _clickHandler = null;
let _preRenderRemover = null;
let _moveEndRemover = null;
let _debounceTimer = null;
let _abort = null;
/** Pending timed retry while the last load failed (see scheduleUnavailableRetry). */
let _retryTimer = null;
/** Current backoff step for that retry; 0 = the next failure starts at the minimum. */
let _retryDelayMs = 0;
/** @type {?boolean} `GroundPolylinePrimitive.isSupported`, checked once. */
let _groundLinesSupported = null;

/** @type {Array<Cesium.GroundPolylinePrimitive>} The stroke batches on screen. */
let _strokePrimitives = [];
/**
 * What was handed to Cesium for each batch, paired with the live primitive.
 *
 * Cesium RELEASES `geometryInstances` once a primitive is built
 * (`releaseGeometryInstances` defaults to true), so after the first frame the
 * scene can no longer say what went into a batch — only that a batch exists.
 * This keeps the composition beside the object it describes, so a QA probe can
 * read the live `show` / `classificationType` / material off the real primitive
 * AND check what it was built from. It is a build record, not a second model:
 * it is written in the same loop that creates the instances.
 * @type {Array<{primitive: object, tierId: string, underground: boolean,
 *   widthPx: number, color: string, strokeIds: Array<string>}>}
 */
let _batchManifest = [];
/** @type {Map<string, object>} render id → record (strokes, substations, pylons). */
let _records = new Map();
/** @type {?string} */
let _selectedId = null;

/** @type {object} The loaded document — dictionaries included. */
let _payload = null;
/** @type {?object} The box `_payload` was loaded for, so a drift can be judged. */
let _loadedBox = null;
let _loading = false;
let _error = null;
let _status = 'idle';
let _lastUpdate = null;
let _stale = false;
let _towersShown = false;
/** Why the last viewport request failed, while the national pack still draws. */
let _localError = null;

// --- National pack state ----------------------------------------------------

/** @type {?object} The hydrated national pack, once loaded. */
let _national = null;
/** @type {?Promise<void>} The pack fetch in flight. */
let _nationalPromise = null;
/** @type {?string} Why the pack failed to load, if it did. */
let _nationalError = null;
/** Epoch-ms before which a failed pack is not asked for again. */
let _nationalRetryAt = 0;
/** @type {Map<string, Array<object>>} tier id → the pack's strokes in that band. */
let _nationalByTier = new Map();
/**
 * tier id → the batches built for that band, built LAZILY the first time the
 * band is drawn: a camera that never leaves the national view never pays for
 * the 39 000 segments of 63/90 kV mesh it would not be shown.
 * @type {Map<string, {tierId:string, casing:?object, overhead:?object,
 *   underground:?object, primitives:Array<object>, hidden:Set<string>}>}
 */
let _nationalBatches = new Map();
/** @type {?Cesium.PointPrimitiveCollection} The pack's substation dots. */
let _nationalPoints = null;
/** @type {Map<string, object>} render id → record, for the pack's strokes and yards. */
let _nationalRecords = new Map();
/** @type {Array<object>} The national yard records, for the per-frame horizon pass. */
let _nationalPointRecords = [];
/** @type {Map<string, string>} casing render id → the stroke it sits under. */
let _nationalAliases = new Map();
/** @type {?{id:string, strokeTiers:Array<string>, substationTiers:Array<string>}} */
let _nationalBand = null;
/**
 * OSM way ids the national batches should NOT draw, because the viewport
 * answer on screen draws them itself — applied to the batches by
 * `syncNationalHidden`, instance by instance.
 * @type {Set<string>}
 */
let _nationalHideTarget = new Set();
/**
 * A viewport answer's stroke batches, building HIDDEN behind the ones on
 * screen — see `stageStrokes`. Null while nothing is building.
 * @type {?{primitives: Array<object>, manifest: Array<object>, ids: Set<string>,
 *   overheadIds: Array<string>, casing: ?object, overhead: ?object}}
 */
let _stagedStrokes = null;
/** Stop the frame pump of the staged batches. */
let _stagePumpStop = null;
/** OSM way ids the viewport batches ON SCREEN draw. */
let _drawnWayIds = new Set();
/** way id → `{tierId, underground}` in the national pack, for the hand-over. */
let _nationalWayIndex = new Map();
/** The shared per-frame read, for the arrival ramp — see `onFadeFrame`. */
let _fadeHandle = null;
/**
 * The ways a viewport answer is taking over from the pack, crossfading — see
 * `startArrival`. Null when none is.
 * @type {?{ids: Array<string>, viewport: Map<object, Array>, national: Map<object, Array>, written: {fine: number, coarse: number}}}
 */
let _arrival = null;
/** What the last fade report said, so a still frame reports nothing. */
const _fadeReported = { viewport: -1, national: -1, arriving: -1, drawn: -1 };
/** Whether `_nationalHideTarget` has changes some batch has not applied yet. */
let _nationalHideDirty = false;

function setStatus(status, error = null) {
  if (_status === status && _error === error) return;
  _status = status;
  _error = error;
  governorRequestRender('power-grid-status');
}

/**
 * The pylon raster, built once.
 *
 * `mapIconGlyph` returns a data URI, and Cesium's billboard atlas keys on that
 * STRING — so six hundred pylons sharing one URI cost ONE atlas entry, where
 * six hundred canvases would have cost six hundred. 72 px covers the 17 CSS px
 * the glyph draws at, with room for a retina buffer; the atlas has no mipmaps,
 * so a much larger raster would only be minified into mush.
 * @returns {?string}
 */
function pylonGlyph() {
  if (_pylonGlyph === undefined) _pylonGlyph = mapIconGlyph('temaki', 'power_tower', { px: 72 });
  return _pylonGlyph;
}
/** @type {string|null|undefined} `undefined` = not built yet. */
let _pylonGlyph;

/**
 * A mark's ellipsoidal height: the DEM floor when it has landed, the surface
 * being DRAWN when it has not, and the ellipsoid only when neither answers.
 *
 * The middle term matters more here than it looks. `cachedGroundFloor` resolves
 * over the network, and until it answers a sprite drawn with
 * `disableDepthTestDistance: Infinity` still PAINTS — at height 0, hundreds of
 * metres under its own ground. A sprite that is not on the ground has a screen
 * position that is a function of the camera pose, so it SLIDES across the
 * landscape on every pan and then jumps into place. That was tolerable when
 * this layer drew a handful of yards; it is not with six hundred pylons on the
 * overhead routes. `provisionalFloor.js` reads the rendered surface
 * synchronously and is always overridden by the DEM.
 */
/**
 * The colour a band is drawn in right now, in the dress the map is wearing.
 * An unknown band draws as the lowest one, as it always has.
 * @param {object|string|null|undefined} tierOrId
 * @returns {string}
 */
function tierColor(tierOrId) {
  return powerTierColor(tierOrId, { night: _night })
    || powerTierColor(POWER_GRID_TIERS.at(-1), { night: _night });
}

/** The core's opacity: one value by day, fading with the band's rank at night. */
function tierStrokeAlpha(tier) {
  return (_night && POWER_GRID_NIGHT_DRESS[tier?.id]?.strokeAlpha) || STROKE_ALPHA;
}

/**
 * What is drawn under a band's core: a near-black casing by day, a halo of the
 * band's own colour at night, where a dark casing would shadow a dark ground.
 * @param {?object} tier
 * @param {number} casingPx The daylight casing's extra width for this batch.
 * @returns {{color: Cesium.Color, extraPx: number}}
 */
function tierUnderStroke(tier, casingPx) {
  if (_night) {
    return {
      color: Cesium.Color.fromCssColorString(tierColor(tier))
        .withAlpha(POWER_GRID_NIGHT_DRESS[tier?.id]?.haloAlpha ?? 0.12),
      extraPx: POWER_GRID_NIGHT_HALO_PX,
    };
  }
  return {
    color: Cesium.Color.fromCssColorString(POWER_GRID_CASING_COLOR).withAlpha(CASING_ALPHA),
    extraPx: casingPx,
  };
}

function pointPosition(lat, lon) {
  const floor = cachedGroundFloor(lat, lon);
  const resolved = Number.isFinite(floor) ? floor : provisionalFloor(lat, lon);
  const height = (Number.isFinite(resolved) ? resolved : 0) + POINT_LIFT_M;
  return Cesium.Cartesian3.fromDegrees(lon, lat, height);
}

function clearStrokePrimitives() {
  for (const primitive of _strokePrimitives) {
    _viewer?.scene?.groundPrimitives?.remove?.(primitive);
  }
  _strokePrimitives = [];
  _batchManifest = [];
  _drawnWayIds = new Set();
}

/** Prefix of a viewport casing instance — an alias of its stroke's id. */
const VIEWPORT_CASING_PREFIX = 'power-grid:casing:';
/** casing instance id → the stroke it sits under, for the batches on screen. */
let _strokeAliases = new Map();

/** A built set with nothing in it — the shape `buildStrokeBatches` returns. */
function emptyStrokeBatches() {
  return {
    primitives: [], manifest: [], ids: new Set(), overheadIds: [], casing: null, overhead: null, colors: new Map(),
  };
}

/**
 * Rebuild the clamped ground strokes for one loaded box.
 *
 * BATCHED, not one entity per way: a dense viewport is 2,200 strokes, and
 * 2,200 entity polylines is 2,200 collection-changed events and 2,200 draw
 * calls on every pan. `GroundPolylinePrimitive` merges them into a handful of
 * batches, which is what makes this layer pannable at all — the same technique
 * the traffic layer's congestion underlay uses.
 *
 * The split is by what has to differ: overhead strokes share ONE primitive and
 * carry their band colour as a per-instance attribute, while underground ones
 * need a dashed material and a material is per-primitive, so they get one batch
 * per band. Six batches at most, whatever the stroke count.
 *
 * ── THE CASING IS THE FIRST BATCH, AND IT IS WHY THIS LAYER IS VISIBLE ──────
 *
 * Every stroke is drawn TWICE: once near-black and `POWER_GRID_CASING_PX`
 * wider, then once in its band colour. Without it a #7ee0a8 line at 1.6 px over
 * a pine plantation is, in the operator's words, "quasi invisible" — a coloured
 * line on an orthophoto has no reliable background, and the answer cartography
 * has for that is a casing, not a louder hue. The casing instances go in FIRST,
 * in their own primitive, because `scene.groundPrimitives` draws in insertion
 * order and the core has to land on top of its own shadow.
 *
 * Per-instance colour is safe on a GROUND POLYLINE and is not safe on a ground
 * POLYGON: a polyline's shadow volume culls by distance to the line, so it does
 * not have the bounding-rectangle rule that forces one colour per batch on
 * `GroundPrimitive`. `PolylineOutline` would fold casing and core into one
 * pass and cannot be used at all here — Cesium's ground-polyline fragment
 * shader never declares the `v_width` varying that material reads, so the
 * primitive fails to link.
 *
 * BUILT HIDDEN, beside the batches on screen: see `stageStrokes`. Every
 * instance carries an id — the casing an alias of its stroke's, as in the
 * national batches — because the arrival crossfade writes each way's colour.
 *
 * @param {object} payload Projected `/api/power-grid` document.
 * @returns {{primitives: Array<object>, manifest: Array<object>, ids: Set<string>,
 *   overheadIds: Array<string>, casing: ?object, overhead: ?object,
 *   colors: Map<string, {casingId: string, casing: Cesium.Color, coreId: string, core: Cesium.Color}>}}
 */
function buildStrokeBatches(payload) {
  const built = emptyStrokeBatches();
  if (!_viewer?.scene?.groundPrimitives) return built;
  if (_groundLinesSupported === null) {
    _groundLinesSupported = Cesium.GroundPolylinePrimitive.isSupported(_viewer.scene);
    if (!_groundLinesSupported) {
      console.warn('[Data:Power Grid] GroundPolylinePrimitive unsupported — routes disabled');
    }
  }
  if (!_groundLinesSupported) return built;

  const aliases = new Map();
  const wayIds = built.ids;
  const colors = built.colors;
  const overheadWays = built.overheadIds;
  const strokes = Array.isArray(payload?.strokes) ? payload.strokes : [];
  const voltages = Array.isArray(payload?.voltages) ? payload.voltages : [];
  const casing = [];
  const overhead = [];
  /** @type {Map<string, Array<Cesium.GeometryInstance>>} tier id → dashed instances. */
  const underground = new Map();
  /** Per-bucket build record; see `_batchManifest`. */
  const casingIds = [];
  const overheadIds = [];
  const undergroundIds = new Map();
  const overheadWidths = new Map();

  for (let i = 0; i < strokes.length; i += 1) {
    const stroke = strokes[i];
    const coords = stroke?.c;
    if (!Array.isArray(coords) || coords.length < 4) continue;
    const voltage = voltages[stroke.vi];
    const tier = powerTierById(voltage?.tier);
    if (!tier) continue;
    const id = `power-grid:stroke:${stroke.id || i}`;
    const positions = Cesium.Cartesian3.fromDegreesArray(coords);
    const under = tierUnderStroke(tier, POWER_GRID_CASING_PX);
    // The casing is the same object as the core drawn wider. It carries an id
    // of its own so its colour can be written, and that id is an ALIAS of the
    // stroke's (`_strokeAliases`): a click on the dark edge selects the line,
    // never a second record.
    const casingId = `${VIEWPORT_CASING_PREFIX}${stroke.id || i}`;
    casing.push(new Cesium.GeometryInstance({
      id: casingId,
      geometry: new Cesium.GroundPolylineGeometry({
        positions,
        width: tier.widthPx + under.extraPx,
      }),
      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(under.color) },
    }));
    casingIds.push(id);
    aliases.set(casingId, id);
    const coreColor = Cesium.Color.fromCssColorString(tierColor(tier)).withAlpha(tierStrokeAlpha(tier));
    const instance = new Cesium.GeometryInstance({
      id,
      geometry: new Cesium.GroundPolylineGeometry({
        positions,
        width: tier.widthPx,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(coreColor),
      },
    });
    _records.set(id, { id, kind: 'stroke', stroke, tierId: tier.id });
    if (stroke.id) {
      wayIds.add(stroke.id);
      colors.set(stroke.id, { casingId, casing: under.color, coreId: id, core: coreColor });
    }
    if (stroke.u) {
      const bucket = underground.get(tier.id);
      if (bucket) bucket.push(instance);
      else underground.set(tier.id, [instance]);
      const ids = undergroundIds.get(tier.id);
      if (ids) ids.push(id);
      else undergroundIds.set(tier.id, [id]);
    } else {
      overhead.push(instance);
      overheadIds.push(id);
      overheadWidths.set(tier.id, tier.widthPx);
      if (stroke.id) overheadWays.push(stroke.id);
    }
  }
  _strokeAliases = aliases;

  if (casing.length) {
    // FIRST into the collection, so the coloured cores draw over their own
    // shadow rather than under it. Every stroke is in here, overhead and
    // underground alike: a dashed cable needs its gaps to read as gaps, and a
    // gap over a bright field is only a gap against something dark.
    const primitive = _viewer.scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({
      geometryInstances: casing,
      classificationType: _classificationType,
      appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
      show: false,
    }));
    built.casing = primitive;
    built.primitives.push(primitive);
    built.manifest.push({
      primitive,
      tierId: null,
      underground: false,
      casing: true,
      widthPx: [...new Set(POWER_GRID_TIERS.map((tier) => (
        tier.widthPx + (_night ? POWER_GRID_NIGHT_HALO_PX : POWER_GRID_CASING_PX)
      )))],
      // At night each halo wears its band's colour, so the batch is mixed.
      color: _night ? null : POWER_GRID_CASING_COLOR,
      night: _night,
      strokeIds: casingIds,
    });
  }

  if (overhead.length) {
    // One batch for every overhead stroke at every voltage: the band colour and
    // the band width travel per instance, so merging them costs no fidelity.
    const primitive = _viewer.scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({
      geometryInstances: overhead,
      classificationType: _classificationType,
      appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
      show: false,
    }));
    built.overhead = primitive;
    built.primitives.push(primitive);
    built.manifest.push({
      primitive,
      tierId: null,
      underground: false,
      casing: false,
      // Mixed by design — the per-instance widths this batch was built from.
      widthPx: [...overheadWidths.values()],
      color: null,
      strokeIds: overheadIds,
    });
  }
  for (const [tierId, instances] of underground) {
    const tier = powerTierById(tierId);
    // A dashed material is per-primitive, so underground strokes cannot share
    // the overhead batch and get one batch per band instead.
    const primitive = _viewer.scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({
      geometryInstances: instances,
      classificationType: _classificationType,
      appearance: new Cesium.PolylineMaterialAppearance({
        material: Cesium.Material.fromType('PolylineDash', {
          color: Cesium.Color.fromCssColorString(tierColor(tier)).withAlpha(UNDERGROUND_ALPHA),
          dashLength: UNDERGROUND_DASH_LENGTH,
        }),
      }),
      show: false,
    }));
    built.primitives.push(primitive);
    built.manifest.push({
      primitive,
      tierId,
      underground: true,
      casing: false,
      widthPx: [tier.widthPx],
      color: tierColor(tier),
      strokeIds: undergroundIds.get(tierId) || [],
    });
  }
  return built;
}

/**
 * Stage a viewport answer's strokes: build them hidden, and leave the batches
 * on screen where they are until every new one is ready (`commitStagedStrokes`).
 *
 * A PAN USED TO FLICKER EVERY ROUTE IT KEPT. The answer's batches were taken
 * off the globe the moment the next answer landed, the national pack's
 * simplified ways came back over the gap for the few hundred milliseconds
 * Cesium's workers take, and then the exact ways replaced them again — exact,
 * simplified, exact, on every line of the screen. Now the old batches stand
 * until the new ones can take their place in one frame (`zoomFade.js` rule:
 * a same-level redraw swaps, it does not fade).
 * @param {object} payload
 */
function stageStrokes(payload) {
  discardStagedStrokes();
  const built = buildStrokeBatches(payload);
  if (!built.primitives.length) {
    commitStrokes(built);
    return;
  }
  _stagedStrokes = built;
  pumpStagedStrokes();
}

/** Take a staged set that will never be shown off the globe. */
function discardStagedStrokes() {
  _stagePumpStop?.();
  _stagePumpStop = null;
  if (!_stagedStrokes) return;
  for (const primitive of _stagedStrokes.primitives) _viewer?.scene?.groundPrimitives?.remove?.(primitive);
  _stagedStrokes = null;
}

/** Frames a staged set is pumped for while it builds, at most. */
const STAGE_FRAME_CAP = 240;

/**
 * Keep rendering while the staged batches build: the globe renders on demand,
 * and nothing else asks for the frame in which they could be swapped in.
 * Bounded; at the cap the set is swapped in as it is.
 */
function pumpStagedStrokes() {
  _stagePumpStop?.();
  _stagePumpStop = null;
  const scene = _viewer?.scene;
  if (!scene?.postRender?.addEventListener) return;
  let framesLeft = STAGE_FRAME_CAP;
  const stop = scene.postRender.addEventListener(() => {
    framesLeft -= 1;
    if (!_stagedStrokes || framesLeft <= 0) {
      stop();
      if (_stagePumpStop === stop) _stagePumpStop = null;
      if (_stagedStrokes) {
        _stagedStrokes.gaveUp = true;
        governorRequestRender('power-grid-stage');
      }
      return;
    }
    governorRequestRender('power-grid-stage');
  });
  _stagePumpStop = stop;
  governorRequestRender('power-grid-stage');
}

/** Whether every staged batch is ready — or the pump gave up on one. */
function stagedStrokesReady() {
  return Boolean(_stagedStrokes)
    && (_stagedStrokes.gaveUp === true || _stagedStrokes.primitives.every((primitive) => primitive.ready));
}

/** Swap the staged set in, if it is ready. Runs before the frame is drawn. */
function commitStagedStrokes() {
  if (!stagedStrokesReady()) return false;
  const built = _stagedStrokes;
  _stagedStrokes = null;
  _stagePumpStop?.();
  _stagePumpStop = null;
  commitStrokes(built);
  return true;
}

/**
 * Put a built set on screen in ONE frame: the old batches leave, the new ones
 * show, and the national pack stands down for exactly the ways they draw.
 *
 * THE WAYS NEWLY DRAWN EXACT CROSSFADE, the rest swap. Where a way was the
 * pack's — simplified to 50 m, drawn at the pack's widths — and is now the
 * answer's, the two are the same mapped route at two simplifications. Faded
 * into each other AT REST they would be a blur, one line drawn twice up to
 * 50 m apart; that is why there is no zoom band at 120 km. Handed over in one
 * frame, the line visibly jumps. So the new way plays a 260 ms arrival over
 * the old one, which steps down in the same proportion and is then hidden
 * (`startArrival`). Underground cables swap: their dashed batches carry one
 * colour per material, not per way.
 * @param {ReturnType<typeof buildStrokeBatches>} built
 */
function commitStrokes(built) {
  finishArrival();
  const previous = _drawnWayIds;
  for (const primitive of _strokePrimitives) _viewer?.scene?.groundPrimitives?.remove?.(primitive);
  _strokePrimitives = built.primitives;
  _batchManifest = built.manifest;
  _drawnWayIds = built.ids;
  for (const primitive of _strokePrimitives) primitive.show = _enabled;
  if (_strokePrimitives.length) restackGroundPrimitives();
  const incoming = built.overheadIds.filter((id) => !previous.has(id) && nationalDrawsWay(id));
  const crossing = new Set(incoming);
  setNationalHideTarget(new Set([...built.ids].filter((id) => !crossing.has(id))));
  if (incoming.length && _fadeHandle) startArrival(incoming, built);
  else if (incoming.length) setNationalHideTarget(new Set(built.ids));
  syncNationalHidden();
  governorRequestRender('power-grid-commit');
}

/**
 * Whether the pack draws this way right now, overhead, in a built batch — the
 * only ways an answer can cross over from.
 * @param {string} id OSM way id.
 * @returns {boolean}
 */
function nationalDrawsWay(id) {
  const where = _nationalWayIndex.get(id);
  if (!where || where.underground || !_enabled) return false;
  if (!_nationalBand?.strokeTiers?.includes(where.tierId)) return false;
  const batch = _nationalBatches.get(where.tierId);
  if (!batch?.casing?.ready || !batch?.overhead?.ready) return false;
  return !batch.hidden.has(id);
}

/** A band's casing and core colours in the pack, in the dress the map wears. */
function nationalWayColors(tierId) {
  const tier = powerTierById(tierId);
  return {
    casing: tierUnderStroke(tier, POWER_GRID_NATIONAL_CASING_PX).color,
    core: Cesium.Color.fromCssColorString(tierColor(tier)).withAlpha(tierStrokeAlpha(tier)),
  };
}

/**
 * Start the crossfade of the ways an answer takes over from the pack: each
 * exact way comes in over its simplified self in `zoomFade`'s arrival ramp
 * (260 ms), the simplified one steps down in the same proportion, and is then
 * hidden — the cover rule of `zoomFade.coverAlphas` with a hard target. A
 * colour attribute per way and per batch, written only while the ramp runs:
 * for a dense box of 2,200 strokes about 1,500 overhead ways, four instances
 * each, for the dozen frames of the ramp.
 * @param {Array<string>} ids Overhead way ids newly drawn exact.
 * @param {ReturnType<typeof buildStrokeBatches>} built
 */
function startArrival(ids, built) {
  const casing = [];
  const core = [];
  const national = new Map();
  const colorsByTier = new Map();
  const push = (primitive, entry) => {
    if (!primitive) return;
    const list = national.get(primitive);
    if (list) list.push(entry);
    else national.set(primitive, [entry]);
  };
  for (const id of ids) {
    const own = built.colors.get(id);
    if (own) {
      casing.push([own.casingId, own.casing]);
      core.push([own.coreId, own.core]);
    }
    const where = _nationalWayIndex.get(id);
    const batch = where ? _nationalBatches.get(where.tierId) : null;
    if (!batch) continue;
    let colors = colorsByTier.get(where.tierId);
    if (!colors) {
      colors = nationalWayColors(where.tierId);
      colorsByTier.set(where.tierId, colors);
    }
    push(batch.casing, [`${NATIONAL_CASING_PREFIX}${id}`, colors.casing]);
    push(batch.overhead, [`${NATIONAL_STROKE_PREFIX}${id}`, colors.core]);
  }
  const viewport = new Map();
  if (built.casing) viewport.set(built.casing, casing);
  if (built.overhead) viewport.set(built.overhead, core);
  _arrival = { ids, viewport, national, written: { fine: -1, coarse: -1 } };
  // Before the first frame draws the new batches: the arriving ways start at 0.
  writeArrival(0, 1);
  _fadeHandle?.arrive('viewport');
}

/** Write one instance list, unless its primitive has been rebuilt away. */
function writeInstances(primitive, entries, weight) {
  if (!primitive || primitive.isDestroyed?.() || !entries.length) return;
  fadeInstances(primitive, entries, weight, { force: true });
}

/**
 * The arrival's two weights: the exact ways at `fine`, their simplified
 * selves at `coarse`. Quantised; nothing written when neither moved a step.
 */
function writeArrival(fine, coarse, force = false) {
  if (!_arrival) return;
  const f = quantizeFade(fine);
  const c = quantizeFade(coarse);
  if (!force && f === _arrival.written.fine && c === _arrival.written.coarse) return;
  for (const [primitive, entries] of _arrival.viewport) writeInstances(primitive, entries, f);
  for (const [primitive, entries] of _arrival.national) writeInstances(primitive, entries, c);
  _arrival.written.fine = f;
  _arrival.written.coarse = c;
}

/**
 * End the crossfade now: the exact ways at full strength, the simplified ones
 * given their colour back and hidden — in the same frame.
 */
function finishArrival() {
  if (!_arrival) return;
  const { ids } = _arrival;
  writeArrival(1, 1, true);
  _arrival = null;
  setNationalHideTarget(new Set([..._nationalHideTarget, ...ids]));
  syncNationalHidden();
  governorRequestRender('power-grid-arrived');
}

/**
 * The per-frame read of the arrival ramp (`zoomFade.watchZoomFade`), and the
 * state the browser harness reads. Nothing is fetched here, and a frame with
 * no arrival running writes nothing.
 *
 * THERE IS NO ZOOM BAND AT 120 km, and on purpose. The pack and the answer are
 * the same mapped ways at two simplifications; drawn together at rest they
 * would be every line twice, up to 50 m apart. And 120 km is a REQUEST limit —
 * the Overpass box the proxy answers — not a choice of scale: the pack is drawn
 * everywhere the answer is not. So the answer replaces the pack way by way,
 * with a short arrival crossfade (`commitStrokes`), and the pack takes the ways
 * back in one frame when the camera climbs past the ceiling — where a pixel is
 * ~140 m and the 50 m simplification is under it.
 */
function onFadeFrame(_scale, nowMs) {
  if (!_enabled) return;
  let viewport = _strokePrimitives.length ? 1 : 0;
  let national = 1;
  if (_arrival) {
    const t = _fadeHandle?.arrival('viewport', nowMs) ?? 1;
    const alphas = coverAlphas({ fine: 1, coarse: 0 }, {
      fineReady: true, coarseReady: true, fineArrival: t, coarseArrival: 1,
    });
    writeArrival(alphas.fine, alphas.coarse);
    viewport = quantizeFade(alphas.fine);
    national = quantizeFade(alphas.coarse);
    if (t >= 1) finishArrival();
  }
  const arriving = _arrival ? _arrival.ids.length : 0;
  const drawn = _strokePrimitives.length;
  if (viewport === _fadeReported.viewport && national === _fadeReported.national
    && arriving === _fadeReported.arriving && drawn === _fadeReported.drawn) return;
  _fadeReported.viewport = viewport;
  _fadeReported.national = national;
  _fadeReported.arriving = arriving;
  _fadeReported.drawn = drawn;
  _fadeHandle?.report({
    // `national` is the weight of the pack's ways being handed over (1 when
    // none is); the rest of the pack is drawn at full, the covered ways hidden.
    levels: { national, viewport },
    dominant: _payload ? 'viewport' : 'national',
    bands: {},
    swap: { atM: POWER_GRID_MAX_ALTITUDE_M, unit: 'm', fade: 'arrival' },
    arriving,
    staged: Boolean(_stagedStrokes),
  });
}

/** Replace the drawn substations and pylons for one loaded box. */
function buildPoints(payload) {
  if (!_points) return;
  _points.removeAll();

  const substations = Array.isArray(payload?.substations) ? payload.substations : [];
  const voltages = Array.isArray(payload?.voltages) ? payload.voltages : [];
  const warm = [];
  sampleProvisionalFloors(_viewer?.scene, substations, { fillKm: FLOOR_FILL_KM });

  for (const substation of substations) {
    if (!Number.isFinite(substation?.lat) || !Number.isFinite(substation?.lon)) continue;
    const id = `power-grid:substation:${substation.id}`;
    const position = pointPosition(substation.lat, substation.lon);
    const tier = powerTierById(voltages[substation.vi]?.tier);
    const size = substationPointSize(tier?.id);
    const color = Cesium.Color.fromCssColorString(tierColor(tier));
    const point = _points.add({
      id,
      position,
      color,
      pixelSize: size,
      outlineColor: Cesium.Color.BLACK.withAlpha(SUBSTATION_OUTLINE_ALPHA),
      outlineWidth: 1.5,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    _records.set(id, {
      id, kind: 'substation', substation, position, point, baseColor: color, baseSize: size,
    });
    warm.push({ lat: substation.lat, lon: substation.lon });
  }

  warmGroundFloor(warm.slice(0, 600));
}

// --- National pack ----------------------------------------------------------

/** The record behind a render id, from the viewport answer or the pack. */
function recordFor(id) {
  if (id === null || id === undefined) return null;
  return _records.get(id) || _nationalRecords.get(id) || null;
}

/** Whether a picked id belongs to this layer — casings included. */
function hasRecord(id) {
  return _records.has(id) || _nationalRecords.has(id) || _nationalAliases.has(id) || _strokeAliases.has(id);
}

/** A casing answers a pick as the stroke it sits under. */
function canonicalId(id) {
  return _nationalAliases.get(id) || _strokeAliases.get(id) || id;
}

/**
 * Whether the camera is looking at any of the ground the pack covers.
 * A view the globe cannot rectangle (the whole planet, or sky) is given the
 * benefit of the doubt: the pack is drawn, and France may well be in shot.
 * @returns {boolean}
 */
function nationalCoversView() {
  if (!_national) return false;
  const view = cameraViewBox(_viewer);
  if (!view) return true;
  return boxesIntersect(view, POWER_GRID_NATIONAL_BBOX);
}

/**
 * Where a national yard's dot is drawn: the DEM floor when it is already
 * cached, the ellipsoid otherwise. These dots are only drawn above 120 km,
 * where a pixel is 140 m of ground and the relief under a yard is not a
 * question anyone can see the answer to — so no probe is spent on them.
 */
function nationalPointPosition(lat, lon) {
  const floor = cachedGroundFloor(lat, lon);
  return Cesium.Cartesian3.fromDegrees(lon, lat, (Number.isFinite(floor) ? floor : 0) + POINT_LIFT_M);
}

/** File the pack's strokes by band, and draw its substation dots (hidden until a band shows them). */
function indexNational(pack) {
  _nationalByTier = new Map();
  _nationalWayIndex = new Map();
  for (const stroke of pack.strokes) {
    const tierId = pack.voltages[stroke.vi]?.tier;
    if (!tierId || !Array.isArray(stroke.c) || stroke.c.length < 4) continue;
    const list = _nationalByTier.get(tierId);
    if (list) list.push(stroke);
    else _nationalByTier.set(tierId, [stroke]);
    _nationalWayIndex.set(stroke.id, { tierId, underground: Boolean(stroke.u) });
  }
  if (!_nationalPoints) return;
  _nationalPoints.removeAll();
  _nationalPointRecords = [];
  for (const substation of pack.substations) {
    if (!Number.isFinite(substation?.lat) || !Number.isFinite(substation?.lon)) continue;
    const tier = powerTierById(pack.voltages[substation.vi]?.tier);
    if (!tier) continue;
    const id = `${NATIONAL_SUBSTATION_PREFIX}${substation.id}`;
    const position = nationalPointPosition(substation.lat, substation.lon);
    const size = POWER_GRID_NATIONAL_POINT_PX[tier.id] ?? POWER_GRID_NATIONAL_POINT_PX['hv-low'];
    const color = Cesium.Color.fromCssColorString(tierColor(tier));
    const point = _nationalPoints.add({
      id,
      position,
      color,
      pixelSize: size,
      outlineColor: Cesium.Color.BLACK.withAlpha(SUBSTATION_OUTLINE_ALPHA),
      outlineWidth: 1,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: false,
    });
    const record = {
      id,
      kind: 'substation',
      national: true,
      substation,
      tierId: tier.id,
      doc: pack,
      position,
      point,
      baseColor: color,
      baseSize: size,
    };
    _nationalRecords.set(id, record);
    _nationalPointRecords.push(record);
  }
}

/**
 * Build the batches for ONE band of the pack.
 *
 * Same construction as `buildStrokes` — a near-black casing batch under a
 * coloured core batch, underground dashed in a batch of its own — with two
 * differences the handover needs. Every instance, casing included, carries an
 * id, and every one carries a `show` attribute: that pair is what lets
 * `syncNationalHidden` switch off exactly the ways a viewport answer draws,
 * without rebuilding 60 000 segments of batch around them. The casing's id is
 * an ALIAS of its stroke's (`_nationalAliases`), so clicking the dark edge of a
 * line selects the line rather than nothing.
 *
 * @param {string} tierId
 */
function buildNationalTier(tierId) {
  if (!_viewer || !_national || !_groundLinesSupported) return;
  const tier = powerTierById(tierId);
  const strokes = _nationalByTier.get(tierId) || [];
  if (!tier || !strokes.length) return;
  const width = POWER_GRID_NATIONAL_WIDTH_PX[tierId] ?? POWER_GRID_NATIONAL_WIDTH_PX['hv-low'];
  const under = tierUnderStroke(tier, POWER_GRID_NATIONAL_CASING_PX);
  const casingColor = Cesium.ColorGeometryInstanceAttribute.fromColor(under.color);
  const coreColor = Cesium.ColorGeometryInstanceAttribute.fromColor(
    Cesium.Color.fromCssColorString(tierColor(tier)).withAlpha(tierStrokeAlpha(tier)),
  );
  const casing = [];
  const overhead = [];
  const underground = [];
  for (const stroke of strokes) {
    const positions = Cesium.Cartesian3.fromDegreesArray(stroke.c);
    const coreId = `${NATIONAL_STROKE_PREFIX}${stroke.id}`;
    const casingId = `${NATIONAL_CASING_PREFIX}${stroke.id}`;
    // Built already hidden when a viewport answer on screen draws this way.
    const visible = !_nationalHideTarget.has(stroke.id);
    casing.push(new Cesium.GeometryInstance({
      id: casingId,
      geometry: new Cesium.GroundPolylineGeometry({ positions, width: width + under.extraPx }),
      attributes: {
        color: casingColor,
        show: new Cesium.ShowGeometryInstanceAttribute(visible),
      },
    }));
    const core = new Cesium.GeometryInstance({
      id: coreId,
      geometry: new Cesium.GroundPolylineGeometry({ positions, width }),
      attributes: {
        color: coreColor,
        show: new Cesium.ShowGeometryInstanceAttribute(visible),
      },
    });
    (stroke.u ? underground : overhead).push(core);
    _nationalRecords.set(coreId, {
      id: coreId,
      kind: 'stroke',
      national: true,
      stroke,
      tierId,
      doc: _national,
    });
    _nationalAliases.set(casingId, coreId);
  }
  const add = (instances, appearance) => (instances.length
    ? _viewer.scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({
      geometryInstances: instances,
      classificationType: _classificationType,
      appearance,
    }))
    : null);
  const batch = {
    tierId,
    casing: add(casing, new Cesium.PolylineColorAppearance({ translucent: true })),
    overhead: add(overhead, new Cesium.PolylineColorAppearance({ translucent: true })),
    underground: add(underground, new Cesium.PolylineMaterialAppearance({
      material: Cesium.Material.fromType('PolylineDash', {
        color: Cesium.Color.fromCssColorString(tierColor(tier)).withAlpha(UNDERGROUND_ALPHA),
        dashLength: UNDERGROUND_DASH_LENGTH,
      }),
    })),
    primitives: [],
    // What this batch was BUILT hiding; `syncNationalHidden` diffs against it.
    hidden: new Set(strokes.filter((stroke) => _nationalHideTarget.has(stroke.id)).map((stroke) => stroke.id)),
  };
  batch.primitives = [batch.casing, batch.overhead, batch.underground].filter(Boolean);
  for (const primitive of batch.primitives) primitive.show = false;
  _nationalBatches.set(tierId, batch);
}

/** Remove every national batch from the scene (the pack itself stays loaded). */
function clearNationalBatches() {
  // An arrival writes into these batches: it ends before they go.
  finishArrival();
  for (const batch of _nationalBatches.values()) {
    for (const primitive of batch.primitives) _viewer?.scene?.groundPrimitives?.remove?.(primitive);
  }
  _nationalBatches = new Map();
  for (const id of [..._nationalRecords.keys()]) {
    if (id.startsWith(NATIONAL_STROKE_PREFIX)) _nationalRecords.delete(id);
  }
  _nationalAliases = new Map();
}

/**
 * Put this layer's ground batches back in paint order.
 *
 * `groundPrimitives` paints in insertion order, and the national bands are
 * built lazily — so a 63/90 kV batch built on the first descent lands ON TOP
 * of the 400 kV backbone and of the viewport answer. Order, bottom to top:
 * every national casing, the national cores lowest voltage first, then the
 * viewport answer's batches, then a selection highlight.
 */
function restackGroundPrimitives() {
  const ground = _viewer?.scene?.groundPrimitives;
  if (typeof ground?.raiseToTop !== 'function') return;
  const order = [];
  for (const tierId of NATIONAL_TIER_ORDER) {
    const batch = _nationalBatches.get(tierId);
    if (batch?.casing) order.push(batch.casing);
  }
  for (const tierId of NATIONAL_TIER_ORDER) {
    const batch = _nationalBatches.get(tierId);
    if (batch?.overhead) order.push(batch.overhead);
    if (batch?.underground) order.push(batch.underground);
  }
  for (const primitive of _strokePrimitives) order.push(primitive);
  const highlight = recordFor(_selectedId)?.highlight;
  if (highlight) order.push(highlight);
  for (const primitive of order) {
    if (typeof ground.contains !== 'function' || ground.contains(primitive)) ground.raiseToTop(primitive);
  }
}

/**
 * Draw the bands the camera's altitude calls for, building any that have not
 * been built yet. Cheap when nothing changed, so it runs every frame.
 *
 * SWITCHED, NOT FADED, and that is a choice. A band adds the lower-voltage
 * lines of the same pack as the camera comes down — a subset shown by
 * importance, not the same lines at another level of aggregation — and a
 * ground polyline takes no fade uniform: fading the 63/90 kV mesh in would
 * write ~16 700 instance colours per step (8 368 ways in the pack, casing and
 * core each). Its batch's `show` is the cheap, honest switch.
 * @param {boolean} [force]
 */
function applyNationalBand(force = false) {
  if (!_national || !_viewer) return;
  const altitude = _viewer.camera?.positionCartographic?.height;
  const band = powerGridNationalBand(altitude, POWER_GRID_MAX_ALTITUDE_M);
  const changed = force || band.id !== _nationalBand?.id;
  _nationalBand = band;
  if (!changed) return;
  // No ground collection means no scene to draw into (a unit test's stand-in
  // viewer): the band is still decided, so the key and the row can read it.
  if (!_viewer.scene?.groundPrimitives) return;
  if (_groundLinesSupported === null) {
    _groundLinesSupported = Cesium.GroundPolylinePrimitive.isSupported(_viewer.scene);
  }
  let built = false;
  if (_enabled) {
    for (const tierId of band.strokeTiers) {
      if (_nationalBatches.has(tierId)) continue;
      buildNationalTier(tierId);
      built = true;
    }
  }
  if (built) restackGroundPrimitives();
  for (const [tierId, batch] of _nationalBatches) {
    const show = _enabled && band.strokeTiers.includes(tierId);
    for (const primitive of batch.primitives) primitive.show = show;
  }
  if (_nationalPoints) _nationalPoints.show = _enabled && band.substationTiers.length > 0;
  // Dot size follows the band: from space the yards are the backbone's nodes,
  // not discs sitting on it. `baseSize` moves with it, so a deselect restores
  // the size the CURRENT band draws.
  const scale = band.id === 'national' ? POWER_GRID_NATIONAL_POINT_SCALE_FROM_SPACE : 1;
  for (const record of _nationalPointRecords) {
    const size = (POWER_GRID_NATIONAL_POINT_PX[record.tierId] ?? POWER_GRID_NATIONAL_POINT_PX['hv-low']) * scale;
    record.baseSize = size;
    if (record.id !== _selectedId) record.point.pixelSize = size;
  }
  governorRequestRender('power-grid-national-band');
}

/**
 * Ask the national batches to stand down for exactly these ways.
 * @param {Set<string>} ids OSM way ids (`w123`).
 */
function setNationalHideTarget(ids) {
  _nationalHideTarget = ids;
  _nationalHideDirty = true;
}

/**
 * Apply `_nationalHideTarget` to every national batch that can take it.
 *
 * A per-instance `show` flip on a built batch, never a rebuild. A batch still
 * building in Cesium's workers cannot be addressed yet — its per-instance
 * table does not exist — so it is left dirty and retried on the next frame;
 * a batch built AFTER the target was set was built with it already applied.
 *
 * The lookups go in pack order on purpose: Cesium finds an instance by
 * scanning its id list from the last hit, so ids asked for in the order they
 * were added cost one pass over the batch rather than one pass each.
 */
function syncNationalHidden() {
  if (!_nationalHideDirty) return;
  let pending = false;
  for (const [tierId, batch] of _nationalBatches) {
    if (!batch.primitives.every((primitive) => primitive.ready)) {
      pending = true;
      continue;
    }
    for (const stroke of _nationalByTier.get(tierId) || []) {
      const hide = _nationalHideTarget.has(stroke.id);
      if (hide === batch.hidden.has(stroke.id)) continue;
      const value = Cesium.ShowGeometryInstanceAttribute.toValue(!hide);
      const core = stroke.u ? batch.underground : batch.overhead;
      const coreAttributes = core?.getGeometryInstanceAttributes(`${NATIONAL_STROKE_PREFIX}${stroke.id}`);
      const casingAttributes = batch.casing?.getGeometryInstanceAttributes(`${NATIONAL_CASING_PREFIX}${stroke.id}`);
      if (coreAttributes) coreAttributes.show = value;
      if (casingAttributes) casingAttributes.show = value;
      if (hide) batch.hidden.add(stroke.id);
      else batch.hidden.delete(stroke.id);
    }
  }
  _nationalHideDirty = pending;
  governorRequestRender('power-grid-national-handover');
}

/**
 * Fetch and draw the national pack, once per session.
 *
 * Fetched ONCE and held, like the gas network: the file is content-hashed,
 * so there is nothing a second fetch in the same session could bring. A
 * failure is retried no sooner than `NATIONAL_RETRY_MS`, and until then the
 * layer is exactly what it was before the pack existed.
 * @returns {?Promise<void>}
 */
function ensureNational() {
  if (_national || _nationalPromise) return _nationalPromise;
  if (Date.now() < _nationalRetryAt) return null;
  _nationalPromise = (async () => {
    try {
      const response = await fetch(NATIONAL_URL);
      if (!response.ok) throw new Error(`national pack HTTP ${response.status}`);
      const pack = hydratePowerGridNationalPack(await response.json());
      if (!_viewer) return;
      _national = pack;
      _nationalError = null;
      indexNational(pack);
      applyNationalBand(true);
      syncNationalGate();
      console.log(
        `[Data:Power Grid] national pack: ${pack.stats?.strokes ?? 0} strokes /`
        + ` ${formatGridKm(pack.stats?.lengthKm)}, ${pack.stats?.substations ?? 0} substations`,
      );
    } catch (error) {
      _nationalError = error?.message || 'national pack unavailable';
      _nationalRetryAt = Date.now() + NATIONAL_RETRY_MS;
      console.warn('[Data:Power Grid] national pack unavailable:', _nationalError);
    } finally {
      _nationalPromise = null;
    }
  })();
  return _nationalPromise;
}

/**
 * The status a camera above the viewport ceiling earns, now that the pack may
 * be drawing under it. Called when the pack lands, so a layer that said "zoom
 * in" a second earlier stops saying it the moment it has a map to show.
 */
function syncNationalGate() {
  if (!_enabled || _loading) return;
  if (powerViewportBox(_viewer)) return;
  if (_national && _payload) clearRendered();
  setNationalHideTarget(new Set());
  setStatus(_national && nationalCoversView() ? 'ready' : (_payload ? 'out-of-gate' : 'zoom-in'), null);
}

/**
 * Per-frame pass over the national yard dots: shown when their band is, and
 * when the planet is not in the way. Only the dots of a band on screen are
 * walked; the rest were switched off when their band went.
 * @param {object} occluder From `horizonOccluder`.
 */
function updateNationalPoints(occluder) {
  if (!_nationalPoints?.show || !_nationalBand) return;
  const tiers = _nationalBand.substationTiers;
  for (const record of _nationalPointRecords) {
    const inBand = tiers.includes(record.tierId);
    record.point.show = inBand && (record.id === _selectedId || occluder.isPointVisible(record.position));
  }
}

/**
 * Metres of ground one screen pixel covers, at the point the camera looks at.
 *
 * Solved at the FOCUS DISTANCE rather than from the camera's altitude, because
 * a tilted camera is much further from what it is aiming at than it is high —
 * sizing the pylon rhythm off the altitude would put the marks four times too
 * close together on exactly the oblique view this globe opens on.
 *
 * @param {?Cesium.Viewer} viewer
 * @returns {number} Metres per CSS pixel; 0 when nothing can be solved.
 */
export function powerMetresPerPixel(viewer) {
  const camera = viewer?.camera;
  const scene = viewer?.scene;
  if (!camera || !scene) return 0;
  const height = scene.canvas?.clientHeight;
  if (!height) return 0;
  const focus = powerFocusPoint(viewer);
  const ellipsoid = scene.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
  // No focus point means the middle of the screen is sky; the altitude is then
  // the only distance there is, and it is a floor on the real one.
  const distance = focus
    ? Cesium.Cartesian3.distance(
      camera.positionWC,
      Cesium.Cartesian3.fromDegrees(focus.lon, focus.lat, 0, ellipsoid),
    )
    : camera.positionCartographic?.height;
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  const fovy = scene.camera?.frustum?.fovy;
  const halfAngle = Number.isFinite(fovy) ? fovy / 2 : Cesium.Math.toRadians(30);
  return (2 * distance * Math.tan(halfAngle)) / height;
}

/**
 * Draw a pylon along every mapped overhead route, at the rhythm this camera can
 * read.
 *
 * ── WHY THIS EXISTS AND WHAT IT IS ALLOWED TO CLAIM ─────────────────────────
 *
 * The layer used to draw `power=tower` nodes as 4 px grey dots, below 0.25° of
 * view and nowhere else. At that size a pylon is not a structure, it is a
 * speck; and above that zoom the overhead network had nothing on it at all, so
 * a red line and a red dashed line were the only difference between a corridor
 * of 400 kV steel and a trench.
 *
 * So the mark is Temaki's `power_tower` — CC0, the glyph the OpenStreetMap iD
 * editor puts on the tag — tinted with the route's own voltage colour, and it
 * is placed by `powerPylonMarks` on the MAPPED VERTICES of the overhead ways.
 * Not at an interpolated spacing: the vertices of a `power=line` way ARE its
 * pylons (574 of 574 tagged towers fell on one at Bayonne, 750 of 775 at
 * Saclay, see `powerPylonMarks` for what the 25 are), so the rhythm can be
 * honoured by SKIPPING vertices and never by inventing one between them.
 *
 * Two consequences are load-bearing:
 *
 *   • The mark is drawn from the STROKES, so it appears at every zoom the
 *     strokes do — there is no second request and no second ceiling. The
 *     `power=tower` NODES are still fetched below
 *     `POWER_GRID_TOWER_MAX_BOX_DEG`, and what they add is the CARD: a
 *     reference, a design, a height. A mark that finds one is a pylon with a
 *     record; a mark that does not is a vertex of the mapped way, and its card
 *     says exactly that rather than promoting it.
 *
 *   • The spacing is re-solved on every camera settle, not once per load.
 *     Zooming out thins the marks instead of clumping them; zooming in walks
 *     back down to every mapped vertex, which on a French 400 kV line is every
 *     pylon there is.
 */
function buildPylons() {
  if (!_pylons) return;
  // A rebuild replaces every pylon RECORD, so a selected one would be left
  // pointing at an object that no longer exists — a card anchored to a deleted
  // billboard, which is a card the operator cannot dismiss by clicking away.
  // The id is remembered across the rebuild and re-selected if the new spacing
  // still draws it; if it does not, the selection goes with the mark.
  const selectedPylon = _pylonIds.includes(_selectedId) ? _selectedId : null;
  if (selectedPylon) clearSelection();
  for (const id of _pylonIds) _records.delete(id);
  _pylonIds = [];
  _pylons.removeAll();
  if (!_payload || !_viewer) {
    _pylonSpacingM = 0;
    return;
  }

  const spacing = powerPylonSpacingM(powerMetresPerPixel(_viewer));
  _pylonSpacingM = spacing;
  const marks = powerPylonMarks(_payload, { spacingM: spacing, maxCount: POWER_PYLON_MAX_MARKS });
  // Ground the cold cells against the surface actually being drawn BEFORE the
  // positions below are taken: synchronous, no network of ours, ≤40 probes, and
  // nothing at all above 25 km of camera. A route corridor is a long thin thing,
  // so the borrow radius is generous — the pylons a budget did not reach are
  // still on the same hillside as the ones it did.
  sampleProvisionalFloors(_viewer?.scene, marks, { fillKm: FLOOR_FILL_KM });
  const towers = powerTowerIndex(_payload);
  const voltages = Array.isArray(_payload.voltages) ? _payload.voltages : [];
  const glyph = pylonGlyph();
  if (!glyph) return;
  const warm = [];

  for (const mark of marks) {
    const tier = powerTierById(voltages[mark.vi]?.tier);
    const tower = towers.get(powerPositionKey(mark.lat, mark.lon)) || null;
    const id = tower
      ? `power-grid:tower:${tower.id}`
      : `power-grid:pylon:${mark.strokeId}:${mark.lat.toFixed(5)},${mark.lon.toFixed(5)}`;
    // A junction vertex belongs to two ways and can be offered twice under two
    // stroke ids; the spacing grid drops the second, but a tagged tower keyed
    // by its own id could still collide with itself across a rebuild.
    if (_records.has(id)) continue;
    const position = pointPosition(mark.lat, mark.lon);
    const color = Cesium.Color.fromCssColorString(tierColor(tier))
      .withAlpha(PYLON_ALPHA);
    const billboard = _pylons.add({
      id,
      position,
      image: glyph,
      width: POWER_PYLON_ICON_PX,
      height: POWER_PYLON_ICON_PX,
      color,
      // The glyph stands ON its coordinate, so the base of the pylon is the
      // mapped point rather than its middle.
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      // One depth for a whole square draws a PARASOL on a tilted camera; the
      // horizon curtain in `onPreRender` is the other half of this pair.
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    _records.set(id, {
      id,
      kind: 'pylon',
      tower,
      mark,
      tierId: tier?.id || null,
      position,
      billboard,
      baseColor: color,
      baseSize: POWER_PYLON_ICON_PX,
    });
    _pylonIds.push(id);
    warm.push({ lat: mark.lat, lon: mark.lon });
  }
  warmGroundFloor(warm.slice(0, 400));
  if (selectedPylon && _records.has(selectedPylon)) selectObject(selectedPylon);
}

/** Ambient labels: the named yards only. 2,000 pylon labels is not a map. */
function publishOverlay() {
  if (!_enabled || !_payload) {
    _overlayHost.clearSource(POWER_GRID_OVERLAY_SOURCE_ID);
    return;
  }
  const entries = [];
  for (const substation of _payload.substations || []) {
    if (!substation.name) continue;
    const record = _records.get(`power-grid:substation:${substation.id}`);
    if (!record?.position) continue;
    entries.push(createSubstationOverlayEntry(substation, record.position, _payload, { night: _night }));
  }
  _overlayHost.setEntries(
    POWER_GRID_OVERLAY_SOURCE_ID,
    selectPowerOverlayCohort(entries),
    {
      cohortLimit: POWER_GRID_OVERLAY_COHORT_LIMIT,
      collisionCapacity: POWER_GRID_OVERLAY_COLLISION_CAPACITY,
      moving: false,
    },
  );
}

/**
 * Re-classify every stroke batch against the active surface, in one pass.
 * @param {Cesium.ClassificationType|undefined} next
 */
function applyClassification(next) {
  if (next === undefined || next === _classificationType) return;
  _classificationType = next;
  // `classificationType` is baked into a built GroundPolylinePrimitive, so the
  // batches are rebuilt rather than mutated — the geometry is already in hand,
  // and this happens only when the operator switches map stacks.
  if (_payload) stageStrokes(_payload);
  if (_nationalBatches.size) {
    // A selected national stroke's record is about to be replaced; its
    // highlight goes with it rather than outliving the record that owns it.
    if (_selectedId?.startsWith(NATIONAL_STROKE_PREFIX)) clearSelection();
    // Only the bands already built are rebuilt; the rest stay lazy.
    const built = [..._nationalBatches.keys()];
    clearNationalBatches();
    for (const tierId of built) buildNationalTier(tierId);
    // A rebuilt batch is built hidden; the band pass decides what shows, and
    // the rebuilt batches must go back UNDER the viewport answer.
    restackGroundPrimitives();
    applyNationalBand(true);
  }
  _viewer?.scene?.requestRender?.();
}

/**
 * Put the bands in their night dress, or take it off.
 *
 * Same shape as `applyClassification`, for the same reason: a colour is baked
 * into a built batch, so the batches are rebuilt from the geometry already in
 * hand rather than mutated. Substations and pylons are rebuilt with them, the
 * pack's points are recoloured in place, and the labels re-published so their
 * accent follows. Runs only while the layer is on; `enable()` catches up with
 * a preset changed while it was off.
 * @param {boolean} next
 */
function applyNightDress(next) {
  if (Boolean(next) === _night) return;
  _night = Boolean(next);
  if (!_viewer) return;
  const selected = _selectedId;
  clearSelection();
  if (_payload) {
    stageStrokes(_payload);
    buildPoints(_payload);
    buildPylons();
  }
  for (const record of _nationalPointRecords) {
    const color = Cesium.Color.fromCssColorString(tierColor(record.tierId));
    record.baseColor = color;
    if (record.point) record.point.color = color;
  }
  if (_nationalBatches.size) {
    const built = [..._nationalBatches.keys()];
    clearNationalBatches();
    for (const tierId of built) buildNationalTier(tierId);
  }
  restackGroundPrimitives();
  applyNationalBand(true);
  publishOverlay();
  if (selected && hasRecord(selected)) selectObject(selected);
  governorRequestRender('power-grid-night');
}

function restoreRecordStyle(record) {
  if (!record) return;
  if (record.kind === 'stroke') {
    // A batched instance cannot be restyled without rebuilding the batch, so
    // the selected stroke is drawn as its own overlay primitive instead; the
    // batch underneath was never touched.
    if (record.highlight) {
      _viewer?.scene?.groundPrimitives?.remove?.(record.highlight);
      record.highlight = null;
    }
    return;
  }
  if (record.billboard) {
    record.billboard.color = record.baseColor;
    record.billboard.width = record.baseSize;
    record.billboard.height = record.baseSize;
    return;
  }
  if (!record.point) return;
  record.point.color = record.baseColor;
  record.point.pixelSize = record.baseSize;
}

function clearSelection() {
  if (_selectedId) restoreRecordStyle(recordFor(_selectedId));
  _selectedId = null;
  _overlayHost.clearSource(POWER_GRID_SELECTED_OVERLAY_SOURCE_ID);
}

function selectObject(id) {
  clearSelection();
  const record = recordFor(id);
  if (!record) return;
  _selectedId = id;
  if (record.kind === 'stroke') {
    if (_groundLinesSupported && Array.isArray(record.stroke?.c)) {
      record.highlight = _viewer.scene.groundPrimitives.add(new Cesium.GroundPolylinePrimitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.GroundPolylineGeometry({
            positions: Cesium.Cartesian3.fromDegreesArray(record.stroke.c),
            width: SELECTED_STROKE_WIDTH,
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
              Cesium.Color.fromCssColorString(SELECTED_COLOR).withAlpha(0.85),
            ),
          },
        }),
        classificationType: _classificationType,
        appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
      }));
    }
  } else if (record.billboard) {
    record.billboard.color = Cesium.Color.fromCssColorString(SELECTED_COLOR);
    record.billboard.width = SELECTED_PYLON_PX;
    record.billboard.height = SELECTED_PYLON_PX;
  } else if (record.point) {
    record.point.color = Cesium.Color.fromCssColorString(SELECTED_COLOR);
    record.point.pixelSize = SELECTED_POINT_PX;
  }
  // A national record carries the pack it came from: its dictionary indices
  // mean nothing against a viewport answer's, and the reverse.
  const entry = createPowerSelectedOverlayEntry(record, record.doc || _payload || {});
  if (entry) {
    _overlayHost.setEntries(
      POWER_GRID_SELECTED_OVERLAY_SOURCE_ID,
      [entry],
      POWER_GRID_SELECTED_OVERLAY_SOURCE_OPTIONS,
    );
  }
  governorRequestRender('power-grid-select');
}

function onKeyDown(event) {
  if (event.key === 'Escape' && _selectedId) clearSelection();
}

/** Resolve a Cesium pick into one of this layer's render ids. */
export function resolvePowerPickId(picked, has = hasRecord) {
  if (!picked) return null;
  const primitiveId = picked.primitive?.id;
  if (typeof primitiveId === 'string' && has(primitiveId)) return primitiveId;
  // A batched GroundPolylinePrimitive reports the GeometryInstance id.
  if (typeof picked.id === 'string' && has(picked.id)) return picked.id;
  const entityId = picked.id?.id;
  if (typeof entityId === 'string' && has(entityId)) return entityId;
  return null;
}

function installClickHandler(viewer) {
  if (_clickHandler) return;
  _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  _clickHandler.setInputAction((click) => {
    const id = canonicalId(resolvePowerPickId(pickAt(viewer.scene, click.position)));
    if (id) {
      // A stroke has no single position, so its card is anchored where the user
      // clicked rather than at a midpoint that could be a département away.
      const record = recordFor(id);
      if (record?.kind === 'stroke') {
        record.position = viewer.scene.pickPosition?.(click.position)
          || viewer.camera.pickEllipsoid?.(click.position)
          || record.position;
        if (!record.position) return;
      }
      selectObject(id);
      return;
    }
    // The label plane the depth buffer knows nothing about, resolved after the
    // native pick so a name drawn across a neighbouring yard cannot steal it.
    const labelled = pickOverlayLabelId(click.position, {
      sourceId: POWER_GRID_OVERLAY_SOURCE_ID,
      prefix: POWER_GRID_LABEL_PREFIX,
      has: (recordId) => _records.has(recordId),
      hitTest: _overlayHost.hitTest,
    });
    if (labelled) {
      selectObject(labelled);
      return;
    }
    if (_selectedId) clearSelection();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  if (typeof document !== 'undefined') document.addEventListener('keydown', onKeyDown);
}

/**
 * Per-frame horizon pass for the point primitives.
 *
 * Points draw with depth testing disabled so a substation is not swallowed by
 * the terrain it sits on, which also means one on the far side of the planet
 * would paint straight through the globe. Nothing here animates — a grid does
 * not move — so this is the layer's only per-frame work. The strokes are
 * clamped ground geometry and need none of it.
 */
function onPreRender() {
  if (!_enabled) return;
  const camera = _viewer?.camera;
  if (!camera) return;
  // The national bands follow the camera DURING a zoom, not after it: the
  // 63/90 kV mesh comes in as the camera passes 600 km, on that frame.
  applyNationalBand();
  // A viewport answer's batches take over — from the ones on screen and from
  // the pack — only once they have finished building, in the frame about to
  // be drawn: never a frame with neither on screen.
  commitStagedStrokes();
  syncNationalHidden();
  if (!_records.size && !_nationalPoints?.show) return;
  const occluder = horizonOccluder(camera);
  updateNationalPoints(occluder);
  for (const record of _records.values()) {
    // Both the yard discs and the pylon glyphs draw with depth testing off, so
    // both need the curtain: without it a substation on the far side of the
    // planet paints straight through the globe.
    const sprite = record.point || record.billboard;
    if (!sprite) continue;
    sprite.show = occluder.isPointVisible(record.position);
  }
}

/**
 * Backoff progression for the failed-load retry: 20 s, doubling to a 240 s
 * ceiling. Pure so the progression is pinnable without booting the layer.
 * @param {number} prevDelayMs
 * @returns {number}
 */
export function powerRetryDelayMs(prevDelayMs) {
  if (!Number.isFinite(prevDelayMs) || prevDelayMs <= 0) return RETRY_MIN_MS;
  return Math.min(prevDelayMs * 2, RETRY_CEIL_MS);
}

/**
 * A failed load must not strand the layer until the idle refresh.
 *
 * Fetches otherwise fire only on enable, on camera moveEnd, and every
 * UPDATE_INTERVAL_MS — so a parked camera whose request died would show an
 * error for twenty minutes while the proxy sat healthy. This is not
 * hypothetical: the first live request of 2026-08-27 got 504 / 502 / 504 and a
 * timeout from four public mirrors in a row, and the one after it succeeded in
 * 2.2 s. While the layer is enabled and failing, retry on a 20 s → 240 s
 * backoff; any success, user-driven load, zoom-out, or disable cancels it.
 */
function scheduleUnavailableRetry() {
  if (!_enabled) return;
  clearTimeout(_retryTimer);
  _retryDelayMs = powerRetryDelayMs(_retryDelayMs);
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    if (_enabled && !_loading) void load();
  }, _retryDelayMs);
}

function clearUnavailableRetry({ resetBackoff = true } = {}) {
  clearTimeout(_retryTimer);
  _retryTimer = null;
  if (resetBackoff) _retryDelayMs = 0;
}

/**
 * The camera settled: re-space the pylons NOW, ask for geometry in a moment.
 *
 * Two different clocks on purpose. The pylon rhythm is solved from geometry
 * already in hand, so it can follow the camera on the frame it stops — waiting
 * out the request debounce would leave the marks visibly clumped or thinned for
 * half a second after every zoom. The REQUEST keeps its debounce, because it
 * crosses the network.
 */
function onCameraSettle() {
  if (!_enabled) return;
  if (_payload) {
    buildPylons();
    governorRequestRender('power-grid-pylon-spacing');
  }
  scheduleLoad();
}

function scheduleLoad() {
  if (!_enabled) return;
  // A camera-driven load supersedes any pending retry; the load reschedules on
  // failure, so the backoff step is KEPT rather than reset — a viewport that
  // keeps failing must not reset itself to 20 s on every pan.
  clearUnavailableRetry({ resetBackoff: false });
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => { void load(); }, REQUEST_DEBOUNCE_MS);
}

/**
 * Take the viewport answer off the globe. The national pack is NOT touched —
 * it is a different layer of the same map, and the caller decides whether its
 * hidden ways come back (leaving the local band) or stay hidden until the next
 * answer replaces them (a pan inside it).
 */
function clearRendered() {
  finishArrival();
  discardStagedStrokes();
  clearSelection();
  clearStrokePrimitives();
  _points?.removeAll();
  _pylons?.removeAll();
  _pylonIds = [];
  _pylonSpacingM = 0;
  _records.clear();
  _payload = null;
  _loadedBox = null;
  _overlayHost.clearSource(POWER_GRID_OVERLAY_SOURCE_ID);
}

/**
 * Whether the box last loaded is still anywhere in shot.
 *
 * The camera's FULL rectangle on purpose, horizon included — the question is
 * "could the operator see this", not "would the layer ask for it", and those
 * are two different questions in a layer whose request box is deliberately
 * smaller than its view.
 * @returns {boolean}
 */
function viewIntersectsLoadedBox() {
  if (!_loadedBox) return false;
  const view = cameraViewBox(_viewer);
  if (!view) return false;
  return boxesIntersect(view, _loadedBox);
}

async function load() {
  if (!_enabled || !_viewer) return false;
  void ensureNational();
  const box = powerViewportBox(_viewer);
  if (!box) {
    _abort?.abort();
    _abort = null;
    _loading = false;
    _localError = null;
    clearUnavailableRetry();
    if (_national) {
      // ABOVE THE CEILING THE PACK IS THE MAP. The viewport answer goes, its
      // ways come back into the national batches, and the key is the pack's —
      // so the "grid held from the last framed view" state below is only ever
      // reached by a session whose pack failed to load.
      if (_payload) clearRendered();
      setNationalHideTarget(new Set());
      applyNationalBand();
      setStatus(nationalCoversView() ? 'ready' : 'zoom-in', null);
      governorRequestRender('power-grid-national');
      return false;
    }
    // THE GRID ALREADY DRAWN STAYS DRAWN, as long as it is still under the
    // camera. This used to `clearRendered()`, and that one line took the map
    // AND THE LEGEND WITH IT: `getRowControls()` builds the voltage key from
    // `_payload.tiers`, so a camera that climbed past the ceiling did not just
    // stop adding — it erased what was there and left the key an empty block,
    // which is the "il n'y a pas de légende" the operator reported on
    // 2026-09-14. Nothing about the mapped grid went stale when the camera
    // moved; what expired is the layer's licence to ask for MORE of it. Kept
    // only while the loaded box is still in shot — a patch of the Landes has
    // no business hanging under a camera over Poland.
    if (_loadedBox && !viewIntersectsLoadedBox()) clearRendered();
    setStatus(_payload ? 'out-of-gate' : 'zoom-in', null);
    governorRequestRender('power-grid-zoom-out');
    return false;
  }

  _abort?.abort();
  const requestAbort = new AbortController();
  _abort = requestAbort;
  _loading = true;
  const timer = setTimeout(() => requestAbort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const query = new URLSearchParams(
      Object.entries(box).map(([key, value]) => [key, value.toFixed(5)]),
    );
    const response = await fetch(`${GRID_URL}?${query}`, { signal: requestAbort.signal });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || `Power-grid feed HTTP ${response.status}`);
    if (!Array.isArray(payload?.strokes)) throw new Error('malformed power-grid document');
    // A newer request already superseded this one; its answer is stale by
    // definition and must not overwrite what the newer one is about to draw.
    if (requestAbort.signal.aborted || _abort !== requestAbort || !_enabled) return false;

    // The marks of the last answer go; its STROKES stay on screen, and the
    // pack stays hidden under them, until the new answer's batches have built
    // and can take their place in one frame (`stageStrokes`) — a pan keeps
    // every route it shares with the last view, and gains the others without
    // a frame of bare ground.
    clearSelection();
    _points?.removeAll();
    _pylons?.removeAll();
    _pylonIds = [];
    _pylonSpacingM = 0;
    _records.clear();
    _payload = payload;
    _loadedBox = box;
    stageStrokes(payload);
    buildPoints(payload);
    buildPylons();
    publishOverlay();
    _stale = payload.status === 'stale';
    _towersShown = Boolean(payload.towersRequested);
    _lastUpdate = Date.now();
    _localError = null;
    clearUnavailableRetry();
    const drawn = payload.stats?.strokes || 0;
    setStatus(drawn || payload.stats?.substations ? (_stale ? 'stale' : 'ready') : 'empty', null);
    governorRequestRender('power-grid-load');
    console.log(
      `[Data:Power Grid] ${drawn} strokes / ${formatGridKm(payload.stats?.lengthKm)},`
      + ` ${payload.stats?.substations ?? 0} substations,`
      + ` ${payload.stats?.towers ?? 0} pylons`,
    );
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    console.warn('[Data:Power Grid] load error:', error);
    if (_national && nationalCoversView()) {
      // The national routes are still on screen under the camera: a failed
      // refinement is a note on the row, not a red layer. The retry still runs.
      _localError = error?.message || 'Mapped power grid unavailable';
      setStatus(_payload ? (_stale ? 'stale' : 'ready') : 'ready', null);
    } else {
      setStatus('error', error?.message || 'Mapped power grid unavailable');
    }
    scheduleUnavailableRetry();
    return false;
  } finally {
    clearTimeout(timer);
    // An older aborted request must not clear a newer request's busy state.
    if (_abort === requestAbort) {
      _abort = null;
      _loading = false;
    }
  }
}

/** Deterministic subsample of drawn substations for the detection overlay. */
function collectDetectableObjects(options = {}) {
  if (!_enabled || (!_payload && !_national)) return [];
  const yards = [];
  for (const record of _records.values()) {
    if (record.kind !== 'substation') continue;
    if (!record.point?.show && record.id !== _selectedId) continue;
    yards.push(record);
  }
  // The national dots, when a band is drawing them: at a national camera they
  // are the only yards on screen.
  for (const record of _nationalPointRecords) {
    if (!record.point?.show && record.id !== _selectedId) continue;
    yards.push(record);
  }
  if (!yards.length) return [];

  const maxCount = Number.isFinite(options.maxCount)
    ? Math.max(1, Math.floor(options.maxCount))
    : yards.length;
  const seed = Number.isFinite(options.seed) ? Math.floor(options.seed) : 0;
  const stride = Math.max(1, Math.ceil(yards.length / maxCount));
  const start = ((seed % stride) + stride) % stride;

  const result = [];
  for (let i = start; i < yards.length; i += stride) {
    const record = yards[i];
    const voltage = (record.doc || _payload)?.voltages?.[record.substation.vi] || {};
    result.push({
      position: record.position,
      sourceId: record.id,
      // i18n-ignore-next-line — a synthetic id for the detection rail, not a label.
      id: String(record.substation.name || record.substation.ref || 'POSTE')
        .toUpperCase().slice(0, 22),
      type: Number.isFinite(voltage.v) ? `${Math.round(voltage.v / 1000)}KV` : 'SUB',
      skipLabel: record.id === _selectedId,
    });
    if (result.length >= maxCount) break;
  }
  return result;
}

/**
 * Route length the pack draws in the current band, km.
 * @returns {number}
 */
function nationalBandKm() {
  const tiers = _nationalBand?.strokeTiers || [];
  let km = 0;
  for (const tier of _national?.tiers || []) {
    if (tiers.includes(tier.id)) km += tier.lengthKm || 0;
  }
  return km;
}

/**
 * The row's sentence while the pack is what is on screen.
 * @returns {string}
 */
function nationalLoadingLabel() {
  const m = messages().row;
  const ceiling = formatInteger(Math.round(POWER_GRID_MAX_ALTITUDE_M / 1000));
  if (_status === 'zoom-in') return m.nationalZoomIn(ceiling);
  const parts = [];
  if (_nationalBand?.id === 'national') {
    parts.push(m.nationalBackbone(formatGridKmFr(nationalBandKm())));
    parts.push(m.nationalBackboneMore);
  } else {
    parts.push(m.nationalAll(formatGridKmFr(nationalBandKm())));
    parts.push(m.nationalAllMore(ceiling));
  }
  return parts.join(' · ');
}

function buildLoadingLabel() {
  const m = messages().row;
  if (_loading) {
    return _national && nationalCoversView() ? m.refining : m.loading;
  }
  if (!_payload && _national && _status !== 'error') {
    const label = nationalLoadingLabel();
    return _localError ? `${label}${m.localUnavailable}` : label;
  }
  if (_status === 'zoom-in') {
    return m.zoomIn(formatInteger(Math.round(POWER_GRID_MAX_ALTITUDE_M / 1000)));
  }
  if (_status === 'error') return _error || m.unavailable;
  if (_status === 'empty') return m.empty;
  const stats = _payload?.stats;
  if (!stats) return '';
  const parts = [m.mappedRoute(formatGridKm(stats.lengthKm))];
  if (stats.substations) parts.push(m.substations(stats.substations));
  if (_pylonIds.length) parts.push(m.pylons(_pylonIds.length));
  const truncated = Object.entries(_payload?.saturated || {})
    .filter(([, value]) => value)
    .map(([key]) => key);
  if (truncated.length) parts.push(m.truncated(truncated.join(' + ')));
  if (_stale) parts.push(m.cached);
  if (_localError) parts.push(m.refreshFailed);
  // LAST, and phrased as what the operator is looking at rather than as an
  // instruction: the grid on screen is real, it is simply the last box asked
  // for, and the camera has since moved off it.
  if (_status === 'out-of-gate') parts.push(m.heldView);
  return parts.join(' · ');
}

/**
 * Whether the mapped grid in view is (almost) all underground.
 *
 * SILENCE IS THE WRONG ANSWER HERE, and it is the one the operator got. Over
 * the Trocadéro on 2026-09-14 the layer drew 126 km of mapped grid, every
 * metre of it underground, and no pylon — correctly, because a cable has none.
 * But the key said nothing at all, so the reasonable reading was "the pylons
 * are broken". An absence with a reason is information; an absence on its own
 * is a bug report. The key says it in one line (`plainLegend.allUnderground`).
 *
 * NOT `overheadKm <= 0`: that is the very case the sentence exists for — a
 * view with nothing overhead in it. Only an absent or empty payload has
 * nothing to say.
 * @returns {boolean}
 */
function viewIsAllUnderground() {
  if (_pylonIds.length) return false;
  const stats = _payload?.stats;
  if (!stats || !(stats.lengthKm > 0) || !Number.isFinite(stats.undergroundKm)) return false;
  return stats.undergroundKm / stats.lengthKm >= 0.98;
}

/**
 * A pylon spacing, written the way a distance on a map is read.
 * @param {?number} metres
 * @returns {string}
 */
export function formatSpacing(metres) {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  if (metres >= 1000) return `${(metres / 1000).toFixed(metres >= 10_000 ? 0 : 1)} km`;
  return `${Math.round(metres / 10) * 10} m`;
}

/**
 * What the stroke batches on screen were built from, beside what they ARE now.
 *
 * The composition fields come from the build record: Cesium RELEASES
 * `geometryInstances` once a primitive is built, so after the first frame the
 * scene can no longer say what went into a batch — only that a batch exists.
 * `show`, `ready`, `classificationType` and the material are read LIVE off the
 * primitive the record points at, so the two halves cannot drift apart.
 *
 * @returns {Array<object>}
 */
function renderDiagnostics() {
  return _batchManifest.map((entry) => ({
    tierId: entry.tierId,
    underground: entry.underground,
    casing: entry.casing === true,
    widthPx: entry.widthPx,
    color: entry.color,
    strokes: entry.strokeIds.length,
    strokeIds: entry.strokeIds,
    // Live, off the real Cesium object.
    show: entry.primitive?.show !== false,
    ready: entry.primitive?.ready === true,
    classificationType: String(entry.primitive?.classificationType ?? ''),
    materialType: entry.primitive?.appearance?.material?.type ?? null,
    // Membership in `scene.groundPrimitives` is itself the proof that a batch is
    // draped rather than drawn at a height — a ground primitive has no height to
    // set, which is exactly why this layer uses one.
    inGroundCollection: (() => {
      const ground = _viewer?.scene?.groundPrimitives;
      if (!ground) return null;
      for (let i = 0; i < ground.length; i += 1) {
        if (ground.get(i) === entry.primitive) return true;
      }
      return false;
    })(),
  }));
}

/**
 * One key row per voltage band, in plain words — see `plainLegend` in the
 * catalog. No counts: a stroke-plus-yard total means nothing to the reader
 * this key is for, and the kilometres are on the cards.
 * @param {Array<{id: string}>} tiers Bands present, highest first.
 * @returns {Array<object>}
 */
function plainTierRows(tiers) {
  const words = messages().plainLegend.tiers;
  return tiers.filter((tier) => words[tier.id]).map((tier) => ({
    label: words[tier.id].label,
    color: tierColor(tier.id),
    blurb: words[tier.id].blurb,
  }));
}

/**
 * The key while the national pack is what is drawn: the bands the camera's
 * altitude shows, where the lines come from, and that zooming in brings the
 * exact route.
 * @returns {{chips: Array<object>, legend: Array<object>, note: string}}
 */
function nationalRowControls() {
  const shown = _nationalBand?.strokeTiers || [];
  const tiers = (_national?.tiers || []).filter((tier) => !shown.length || shown.includes(tier.id));
  const m = messages().plainLegend;
  const base = _national?.osmBase ? String(_national.osmBase).slice(0, 10) : null;
  const note = [];
  if (tiers.some((tier) => tier.undergroundKm > 0)) note.push(m.dashed);
  note.push(m.source(base), m.zoom);
  return { chips: [], legend: plainTierRows(tiers), note: note.join(' ') };
}

/** `getStats` while the pack is what is on screen. @returns {object} */
function nationalStats() {
  const stats = _national?.stats || {};
  const result = {
    count: (stats.substations || 0) + (stats.strokes || 0),
    lastUpdate: _lastUpdate,
    loading: _loading,
    status: _status === 'ready' ? 'ok' : _status,
    stale: false,
    national: true,
    nationalBand: _nationalBand?.id || null,
    strokes: stats.strokes ?? null,
    routes: stats.routes ?? null,
    lengthKm: stats.lengthKm ?? null,
    bandLengthKm: Number(nationalBandKm().toFixed(1)),
    undergroundKm: stats.undergroundKm ?? null,
    substations: stats.substations ?? null,
    towers: null,
    pylonsDrawn: null,
    pylonSpacingM: null,
    saturated: false,
    feedSource: _national?.source || null,
    osmBase: _national?.osmBase || null,
  };
  const label = buildLoadingLabel();
  if (label) result.loadingLabel = label;
  if (_error) result.error = _error;
  return result;
}

/** See `powerGridLayer.getNationalDiagnostics`. @returns {object} */
function nationalDiagnostics() {
  const batches = [];
  for (const tierId of NATIONAL_TIER_ORDER) {
    const batch = _nationalBatches.get(tierId);
    if (!batch) continue;
    for (const [part, primitive] of [['casing', batch.casing], ['overhead', batch.overhead], ['underground', batch.underground]]) {
      if (!primitive) continue;
      batches.push({
        tierId,
        part,
        show: primitive.show !== false,
        ready: primitive.ready === true,
        hidden: batch.hidden.size,
      });
    }
  }
  return {
    loaded: Boolean(_national),
    error: _nationalError,
    band: _nationalBand?.id || null,
    strokeTiers: _nationalBand?.strokeTiers || [],
    substationTiers: _nationalBand?.substationTiers || [],
    strokes: _national?.strokes?.length ?? 0,
    substations: _national?.substations?.length ?? 0,
    osmBase: _national?.osmBase || null,
    batches,
    hideTarget: _nationalHideTarget.size,
    hidePending: Boolean(_stagedStrokes) || _nationalHideDirty,
    arriving: _arrival ? _arrival.ids.length : 0,
    pointsShown: _nationalPointRecords.reduce((count, record) => count + (record.point?.show ? 1 : 0), 0),
    pointsCollectionShown: Boolean(_nationalPoints?.show),
  };
}

/** Power Grid layer. @type {Object} */
const powerGridLayer = {
  id: POWER_GRID_LAYER_ID,
  name: 'Power Grid',
  icon: '⌁',
  source: 'OpenStreetMap (Overpass)',
  updateInterval: UPDATE_INTERVAL_MS,

  init(viewer) {
    _viewer = viewer;
    _points = new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.OPAQUE_AND_TRANSLUCENT });
    _points.show = false;
    viewer.scene.primitives.add(_points);
    registerSpriteCollection(POWER_GRID_LAYER_ID, _points);
    _pylons = new Cesium.BillboardCollection({ scene: viewer.scene });
    _pylons.show = false;
    viewer.scene.primitives.add(_pylons);
    registerSpriteCollection(POWER_GRID_LAYER_ID, _pylons);
    _nationalPoints = new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.OPAQUE_AND_TRANSLUCENT });
    _nationalPoints.show = false;
    viewer.scene.primitives.add(_nationalPoints);
    registerSpriteCollection(POWER_GRID_LAYER_ID, _nationalPoints);

    _enabled = false;
    _records = new Map();
    _strokePrimitives = [];
    _selectedId = null;
    _payload = null;
    _loading = false;
    _error = null;
    _status = 'idle';
    _lastUpdate = null;
    _stale = false;
    _towersShown = false;
    _pylonIds = [];
    _pylonSpacingM = 0;
    _retryDelayMs = 0;
    _localError = null;
    _national = null;
    _nationalPromise = null;
    _nationalError = null;
    _nationalRetryAt = 0;
    _nationalByTier = new Map();
    _nationalBatches = new Map();
    _nationalRecords = new Map();
    _nationalPointRecords = [];
    _nationalAliases = new Map();
    _nationalBand = null;
    _nationalHideTarget = new Set();
    _stagedStrokes = null;
    _drawnWayIds = new Set();
    _strokeAliases = new Map();
    _arrival = null;
    _nationalWayIndex = new Map();
    _nationalHideDirty = false;
    _classificationType = powerClassificationTypeForScene(viewer?.scene);

    if (typeof window !== 'undefined' && !_mapStackListener) {
      _mapStackListener = (event) => {
        applyClassification(event?.detail?.activeId !== undefined
          ? powerClassificationTypeForStack(event.detail.activeId)
          : powerClassificationTypeForScene(_viewer?.scene));
      };
      window.addEventListener('gev:map-stack-changed', _mapStackListener);
    }

    _overlayHost.setVisible(POWER_GRID_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(POWER_GRID_SELECTED_OVERLAY_SOURCE_ID, false);
    restoreSpriteOrder(viewer);
    console.log('[Data:Power Grid] Initialized');
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    if (_points) _points.show = true;
    if (_pylons) _pylons.show = true;
    for (const primitive of _strokePrimitives) primitive.show = true;
    // The boot-time stack settle fires no event, so re-derive on every enable
    // rather than trusting whatever the last event left behind.
    applyClassification(powerClassificationTypeForScene(viewer?.scene || _viewer?.scene));
    // The night atlas may have come on or gone off while this layer was off.
    applyNightDress(nightAtlasActive());
    _unwatchNight?.();
    _unwatchNight = watchNightAtlas((night) => applyNightDress(night));
    _overlayHost.setVisible(POWER_GRID_OVERLAY_SOURCE_ID, true);
    _overlayHost.setVisible(POWER_GRID_SELECTED_OVERLAY_SOURCE_ID, true);
    installClickHandler(viewer);
    registerPickOwner(POWER_GRID_LAYER_ID, (pickedId) => hasRecord(pickedId));
    if (!_preRenderRemover) {
      _preRenderRemover = viewer.scene.preRender.addEventListener(onPreRender);
    }
    // The arrival crossfade of an answer over the pack — see `onFadeFrame`.
    _fadeHandle = watchZoomFade(viewer, POWER_GRID_LAYER_ID, onFadeFrame);
    if (!_moveEndRemover) {
      _moveEndRemover = viewer.camera.moveEnd.addEventListener(onCameraSettle);
    }
    publishOverlay();
    restoreSpriteOrder(viewer);
    // The pack is a static file, not a viewport request, so it starts NOW
    // rather than waiting on update(): on a national camera it is the whole
    // layer. A pack already held from an earlier enable is simply re-shown.
    void ensureNational();
    applyNationalBand(true);
    // DataLayerManager invokes update() immediately after enable(), which owns
    // the first viewport fetch. Avoid racing it with a second aborting request.
  },

  disable() {
    // A crossfade cut short ends at once, the pack's colours given back.
    finishArrival();
    _fadeHandle?.release();
    _fadeHandle = null;
    _enabled = false;
    _unwatchNight?.();
    _unwatchNight = null;
    clearSelection();
    clearUnavailableRetry();
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
    _abort?.abort();
    _abort = null;
    if (_points) _points.show = false;
    if (_pylons) _pylons.show = false;
    for (const primitive of _strokePrimitives) primitive.show = false;
    // The pack's batches are kept, hidden: a re-enable in the same session
    // shows them again without re-tessellating the country.
    applyNationalBand(true);
    _overlayHost.clearSource(POWER_GRID_OVERLAY_SOURCE_ID);
    _overlayHost.setVisible(POWER_GRID_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(POWER_GRID_SELECTED_OVERLAY_SOURCE_ID, false);
    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
    if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeyDown);
    unregisterPickOwner(POWER_GRID_LAYER_ID);
    if (_preRenderRemover) {
      _preRenderRemover();
      _preRenderRemover = null;
    }
    if (_moveEndRemover) {
      _moveEndRemover();
      _moveEndRemover = null;
    }
    _loading = false;
    _status = 'idle';
  },

  /**
   * Bring the camera inside the box this layer loads behind, on the way in.
   * The grid is wherever the camera is, so the view centre is the target and
   * there is no coverage table to pull it towards.
   * @param {?Cesium.Viewer} viewer
   * @param {{signal?: ?AbortSignal}} [options]
   * @returns {Promise<boolean>} Whether the camera ended inside the gate.
   */
  async ensureViewGate(viewer, { signal } = {}) {
    const target = viewer || _viewer;
    if (!target) return false;
    return applyViewGate(target, {
      fits: () => Boolean(powerViewportBox(target)),
      maxDeg: POWER_GRID_MAX_BOX_DEG,
      signal,
      reason: 'power-grid-view-gate',
    });
  },

  async update() {
    if (!_enabled) return false;
    const loaded = await load();
    // A load that fetched nothing because the camera is too wide asked for a
    // zoom, and asking is not failing. Only the error state is a failed refresh
    // — reporting the guidance state as one tore the layer back down on enable.
    return loaded || _status !== 'error';
  },

  getDetectableObjects(options = {}) {
    return collectDetectableObjects(options);
  },

  /**
   * Snapshot the substations for the analyst query engine. On-demand only, and
   * the strokes are deliberately absent: a way is a fragment of a route, not an
   * object anyone can ask a question about.
   * @param {number} [maxCount=400]
   * @returns {Array<Object>}
   */
  getAnalystRecords(maxCount = 400) {
    if (!_enabled) return [];
    const limit = Number.isFinite(maxCount) ? Math.max(1, Math.floor(maxCount)) : 400;
    const result = [];
    if (_payload) {
      for (const substation of _payload.substations || []) {
        if (result.length >= limit) break;
        result.push(mapPowerAnalystRecord(substation, _payload, result.length));
      }
      return result;
    }
    // A national camera: the pack's yards, highest voltage first, because a
    // 400-record answer about a whole country should be the backbone.
    if (!_national) return [];
    const voltageOf = (substation) => _national.voltages[substation.vi]?.v || 0;
    const ranked = _national.substations.slice()
      .sort((a, b) => voltageOf(b) - voltageOf(a) || String(a.id).localeCompare(String(b.id)));
    for (const substation of ranked) {
      if (result.length >= limit) break;
      result.push(mapPowerAnalystRecord(substation, _national, result.length));
    }
    return result;
  },

  /**
   * The key to what is on screen: the voltage bands, in order.
   *
   * Bands rather than feature types, because voltage is what this layer filters
   * on and therefore the only thing the colours can honestly mean.
   *
   * THE PYLONS GET NO ROW OF THEIR OWN, and that is the house rule rather than
   * an omission. `#map-legend` carries the COLOUR channel: a shape a reader
   * decodes without a key does not earn a line, and a picture of a pylon is a
   * pylon. A row would also have to invent a swatch colour, because a pylon
   * wears the colour of the route it stands on — four different ones on screen
   * at once.
   *
   * IN PLAIN WORDS since 2026-09-21: the key is read by anyone who opens the
   * scene. The rows name the bands in words with one sentence each, and the
   * note says only what a reader could misread — dashes are underground, an
   * all-underground view has no pylons — and where the lines come from. The
   * kilometres, the yard counts and the drawing's caveats are on the cards.
   * @returns {{chips: Array<object>, legend: Array<object>, note: string}}
   */
  getRowControls() {
    if (!_payload && _national) return nationalRowControls();
    const m = messages().plainLegend;
    const tiers = _payload?.tiers || [];
    const note = [];
    if (tiers.some((tier) => tier.undergroundKm > 0)) note.push(m.dashed);
    if (viewIsAllUnderground()) note.push(m.allUnderground);
    // An empty answer has nothing to attribute: the note goes with the map.
    if (tiers.length || note.length) note.push(m.source(null));
    return { chips: [], legend: plainTierRows(tiers), note: note.join(' ') };
  },

  /**
   * The stroke batches on screen: what each was built from, and what it is now.
   * Read by `scripts/qa-power-grid.mjs`, which cannot ask the scene directly
   * because Cesium releases a primitive's geometry instances once it is built.
   * @returns {Array<object>}
   */
  getRenderDiagnostics() {
    return renderDiagnostics();
  },

  /**
   * The national pack as the scene holds it: which bands are built, which are
   * shown, whether their batches finished building, and how many ways stand
   * down for the viewport answer. Read by `scripts/qa-power-grid-national.mjs`.
   * @returns {object}
   */
  getNationalDiagnostics() {
    return nationalDiagnostics();
  },

  getStats() {
    if (!_payload && _national) return nationalStats();
    const stats = _payload?.stats;
    const result = {
      count: (stats?.substations || 0) + (stats?.strokes || 0),
      lastUpdate: _lastUpdate,
      loading: _loading,
      // `out-of-gate` is a camera state, not a data state: the payload beneath it
      // is the one that loaded cleanly, so the row must not go amber for it.
      status: (_status === 'ready' || _status === 'out-of-gate') ? 'ok' : _status,
      stale: _stale,
      strokes: stats?.strokes ?? null,
      // OSM splits one liaison across many ways, so the honest "how many lines"
      // answer is the distinct mapped route names, reported beside the strokes.
      routes: stats?.routes ?? null,
      lengthKm: stats?.lengthKm ?? null,
      undergroundKm: stats?.undergroundKm ?? null,
      substations: stats?.substations ?? null,
      // Two different numbers, and they answer two different questions. `towers`
      // is how many nodes OpenStreetMap has TAGGED `power=tower` in this box
      // (only asked for below POWER_GRID_TOWER_MAX_BOX_DEG). `pylonsDrawn` is
      // how many glyphs are on screen, which is set by the camera, not the data.
      towers: _towersShown ? (stats?.towers ?? null) : null,
      pylonsDrawn: _pylonIds.length || null,
      pylonSpacingM: _pylonSpacingM || null,
      saturated: Boolean(_payload?.saturated
        && Object.values(_payload.saturated).some(Boolean)),
      feedSource: _payload?.source || null,
    };
    const label = buildLoadingLabel();
    if (label) result.loadingLabel = label;
    if (_error) result.error = _error;
    return result;
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
      unregisterPickOwner(POWER_GRID_LAYER_ID);
    }
    if (typeof window !== 'undefined' && _mapStackListener) {
      window.removeEventListener('gev:map-stack-changed', _mapStackListener);
      _mapStackListener = null;
    }
    if (_preRenderRemover) {
      _preRenderRemover();
      _preRenderRemover = null;
    }
    if (_moveEndRemover) {
      _moveEndRemover();
      _moveEndRemover = null;
    }
    clearStrokePrimitives();
    clearNationalBatches();
    if (_points) {
      unregisterSpriteCollection(POWER_GRID_LAYER_ID, _points);
      viewer?.scene?.primitives?.remove?.(_points);
      _points = null;
    }
    if (_nationalPoints) {
      unregisterSpriteCollection(POWER_GRID_LAYER_ID, _nationalPoints);
      viewer?.scene?.primitives?.remove?.(_nationalPoints);
      _nationalPoints = null;
    }
    _nationalRecords = new Map();
    _nationalPointRecords = [];
    _national = null;
    _nationalBand = null;
    _nationalHideTarget = new Set();
    _arrival = null;
    discardStagedStrokes();
    if (_pylons) {
      unregisterSpriteCollection(POWER_GRID_LAYER_ID, _pylons);
      viewer?.scene?.primitives?.remove?.(_pylons);
      _pylons = null;
    }
    _pylonIds = [];
    _records.clear();
    _payload = null;
    _viewer = null;
  },
};

/** Seed rendered records so selection/card/legend paths run without WebGL. */
export function _setPowerGridStateForTest({
  viewer, records, payload, overlayHost, towersShown = true, enabled = true,
  pylonIds = [], pylonSpacingM = 0, status = 'ready', loadedBox = null,
  national = null, nationalBandId = null, localError = null,
} = {}) {
  _viewer = viewer || null;
  // The pack is state like any other here: absent unless a test hands one in,
  // so a legend test written before the pack existed still reads the
  // viewport document it seeded.
  _national = national;
  // No pack handed in means none is coming: a unit test must not reach for
  // the asset over a `file:` URL Node's fetch cannot read.
  _nationalRetryAt = national ? 0 : Number.POSITIVE_INFINITY;
  _nationalBand = nationalBandId
    ? { ...powerGridNationalBand(
      nationalBandId === 'national' ? 1e9 : (nationalBandId === 'regional' ? POWER_GRID_MAX_ALTITUDE_M + 1 : 0),
      POWER_GRID_MAX_ALTITUDE_M,
    ) }
    : null;
  _localError = localError;
  if (records) _records = records instanceof Map ? records : new Map(Object.entries(records));
  if (payload !== undefined) _payload = payload;
  _overlayHost = overlayHost || DEFAULT_OVERLAY_HOST;
  _enabled = enabled;
  _towersShown = towersShown;
  // The pylon glyphs are placed by the CAMERA, so a headless test states how
  // many are on screen rather than making one appear. Reset by DEFAULT: this
  // is drawn state, and a seed that silently inherited the previous test's
  // cohort would let a legend row survive into a test that drew nothing.
  _pylonIds = [...pylonIds];
  _pylonSpacingM = pylonSpacingM;
  _loadedBox = loadedBox;
  _selectedId = null;
  _status = status;
}

/** @returns {?string} */
export function _powerSelectedIdForTest() {
  return _selectedId;
}

export function _selectPowerObjectForTest(id) {
  selectObject(id);
}

export function _clearPowerSelectionForTest() {
  clearSelection();
}

export function _powerRowControlsForTest() {
  return powerGridLayer.getRowControls();
}

export function _powerDetectablesForTest(options) {
  return collectDetectableObjects(options);
}

export function _powerStatsForTest() {
  return powerGridLayer.getStats();
}

/** @returns {Array<object>} See `powerGridLayer.getRenderDiagnostics`. */
export function _powerBatchesForTest() {
  return renderDiagnostics();
}

/**
 * Seed the national pack as the layer draws it — indexed, and its bands built
 * for the seeded camera — so the hand-over to a viewport answer can run.
 * @returns {Array<string>} The bands built.
 */
export function _buildPowerNationalForTest(pack) {
  _national = pack;
  _nationalBatches = new Map();
  _nationalRecords = new Map();
  _nationalAliases = new Map();
  _nationalHideTarget = new Set();
  _nationalHideDirty = false;
  indexNational(pack);
  applyNationalBand(true);
  return [..._nationalBatches.keys()];
}

/** Stage a viewport answer's strokes, as an answer that just landed does. */
export function _stagePowerStrokesForTest(payload) {
  _payload = payload;
  stageStrokes(payload);
  return _stagedStrokes ? _stagedStrokes.primitives.slice() : [];
}

/**
 * The part of a frame that swaps a staged set in and applies the hand-over,
 * with a stand-in for the shared read when the layer holds none.
 * @returns {{committed: boolean, arrivals: Array<string>}}
 */
export function _powerCommitFrameForTest() {
  const arrivals = [];
  const previous = _fadeHandle;
  _fadeHandle ??= {
    arrive: (key) => arrivals.push(key), arrival: () => 0, report() {}, release() {},
  };
  try {
    const committed = commitStagedStrokes();
    syncNationalHidden();
    return { committed, arrivals };
  } finally {
    _fadeHandle = previous;
  }
}

/** One frame of the arrival ramp at `arrival` (0..1); what it reported. */
export function _powerFadeFrameForTest({ arrival = 1 } = {}) {
  let reported = null;
  const previous = _fadeHandle;
  _fadeHandle = {
    arrive() {}, arrival: () => arrival, report(state) { reported = state; }, release() {},
  };
  _fadeReported.viewport = -1;
  try {
    onFadeFrame(null, 0);
  } finally {
    _fadeHandle = previous;
  }
  return reported;
}

/** The hand-over between the pack and the answer, as the layer holds it. */
export function _powerHandoverForTest() {
  return {
    drawn: [..._drawnWayIds],
    hideTarget: new Set(_nationalHideTarget),
    arriving: _arrival ? [..._arrival.ids] : [],
    staged: Boolean(_stagedStrokes),
    strokes: _strokePrimitives.slice(),
    batches: _nationalBatches,
  };
}

/** Take every stroke batch down, the pack's too, between tests. */
export function _resetPowerStrokesForTest() {
  finishArrival();
  discardStagedStrokes();
  clearStrokePrimitives();
  clearNationalBatches();
  _nationalHideTarget = new Set();
  _nationalWayIndex = new Map();
  _strokeAliases = new Map();
  _national = null;
}

/** Re-space and redraw the pylon glyphs, as a camera settle would. */
export function _buildPowerPylonsForTest() {
  buildPylons();
  return _pylonIds.slice();
}

export default powerGridLayer;
