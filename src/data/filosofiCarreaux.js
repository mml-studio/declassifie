import * as Cesium from 'cesium';
import { governorRequestRender } from '../renderGovernor.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import { boxKey, snapBoxOutward } from './viewportBox.js';
import {
  TERRITORY_SELECTED_OVERLAY_SOURCE_ID,
  createTerritorySelectedOverlayEntry,
  fillTerritoryCollection,
  joinTerritories,
  loadTerritoryAnchors,
  resolveTerritoryPickId,
  territoryChips,
  territoryLegend,
  territoryStats,
} from './filosofiTerritoires.js';
import {
  TERRITORY_VINTAGE,
  resolveTerritoryMetric,
} from './filosofiTerritoiresFeed.js';
import {
  FILOSOFI_METRICS,
  FILOSOFI_RAMPS,
  FILOSOFI_SIZE_BREAKS,
  FILOSOFI_RAMP_SAMPLE,
  FILOSOFI_VINTAGE,
  cellCentre,
  cellClearanceM,
  cellColor,
  cellDisc,
  cellSymbol,
  metricBand,
  resolutionForBox,
  resolveMetric,
  filosofiMetrics,
} from './filosofiFeed.js';
import { pickAt } from './pickAt.js';
import { formatNumber } from '../i18n/format.js';
import messages from './filosofiCarreaux.i18n.js';
import {
  bandPosition,
  coverAlphas,
  createFadeColorAppearance,
  fadeBand,
  fadeCollection,
  levelVisible,
  quantizeFade,
  reveal,
  setAppearanceFade,
  watchZoomFade,
} from './zoomFade.js';
import { serverFailureMessage, serverMessage } from '../i18n/serverMessages.js';

/**
 * Carroyage INSEE — the demand side of a location, drawn as ground you can
 * stand a business on.
 *
 * WHY THIS LAYER EXISTS. Everything the app already draws over France is
 * SUPPLY: where the schools are, where the doctors are, what sold, what the
 * PLU allows. None of it says how many people live within a walk of the plot,
 * or what they earn. A commune average cannot answer that — Lyon 7e is one
 * code covering both the Guillotière and Gerland — so the unit has to be
 * smaller than the administration, and INSEE's 200 m carroyage is the only
 * national grid that is.
 *
 * A CELL IS A PLACE TO PUT A SYMBOL, NOT A TILE TO PAINT, AND THAT IS THE FIRST
 * RULE. The carroyage is 2.3 million contiguous squares; drawing each one edge
 * to edge turns a populated département into an opaque quilt with the map
 * underneath it — no streets, no place names, no marker from any other layer,
 * nothing to locate the statistic against. A layer that hides the map is not a
 * layer, it is a replacement. So each cell carries one flat translucent DISC at
 * its centre, capped at `FILOSOFI_MAX_FILL` of the cell, and both the gap
 * around it and the alpha through it are the map. See `cellSymbol` in
 * `filosofiFeed.js` for the ceiling and its price.
 *
 * FLAT, AND THAT WAS A CORRECTION. The count was the EXTRUSION first, which
 * failed three ways: a camera looking down reads no height at all, paying for
 * the tower with the cell's whole footprint cost the basemap, and a field of
 * prisms stands in front of the streets it is describing. Nothing here stands
 * up. The discs are laid a few metres clear of the terrain, which is all the
 * third dimension a statistic about people needs.
 *
 * TWO CHANNELS, AND THE SIZE IS NOT THE INDICATOR. Colour carries the chosen
 * indicator; AREA carries the COUNT that indicator was computed on. That is the
 * whole design and it is a correctness decision, not a style one: "27 100 € per
 * person" has no extent, and the eye reads extent as quantity, so a symbol
 * sized by an average is a picture of nothing.
 *
 * SIX SIZE CLASSES, on national quantiles of the count — the same shape as the
 * six-band colour ramp, and the same argument: the eye cannot read a continuous
 * magnitude back into a number, and the card carries the number anyway. A
 * strictly proportional scale was tried first and it cannot survive the range —
 * see `FILOSOFI_SIZE_BREAKS`, where the arithmetic is written down against a
 * measured viewport.
 *
 * THE HOLLOW DISCS ARE IMPUTED. INSEE publishes a flag meaning "this cell's
 * figures were modelled, because publishing the observation would have broken
 * confidentiality". In the 80 105-cell national sample the ramps were measured
 * on, 39 % of cells carry it. Drawing those identically to observed cells would
 * be drawing a model and calling it a census, so an imputed cell is drawn as a
 * RING — the map shows through where the data was inferred — and the legend
 * says so. The ring is grown to keep the area it loses to its hole, because the
 * hollow is a claim about PROVENANCE and must not double as a quieter claim
 * about the count.
 *
 * THE BREAKS ARE NATIONAL AND ABSOLUTE. A viewport-relative ramp would make
 * Neuilly and Roubaix the same picture, which is the opposite of the point.
 * `filosofiFeed.js` carries the measurement: population-weighted quantiles over
 * a 42-box national sample, so a colour means the same thing wherever the
 * camera is.
 *
 * ABOVE THE GRID'S CEILING THE LAYER CHANGES DATASET RATHER THAN GOING BLANK.
 * The carroyage refuses a box wider than 0.9°, and that refusal is right — 2.3
 * million squares sampled down to a page is a picture of the sample. It also
 * left the map empty at the altitude the app opens at. So past that ceiling the
 * layer draws INSEE's own aggregates instead: one disc per département, then
 * per région, from a second keyless API. It is a DIFFERENT DATASET — a median
 * where the grid has a mean, people where it has households, 2023 where the
 * relayed grid is 2019 — and `filosofiTerritoires.js` puts that on every card,
 * because a reader who thinks they are seeing the same numbers from further
 * away is being misled by the zoom.
 *
 * FOUR LEVELS, AND ONLY TWO OF THE THREE STEPS BETWEEN THEM FADE. Régions,
 * départements, the 1 km grid and the 200 m grid used to replace each other on
 * a hard cut, with a blank frame while the next one was fetched and built, and
 * the swap read as the map reloading. Within one dataset the levels now
 * crossfade over a band of zoom (`zoomFade.js`, after Kyle Walker's "fade on
 * zoom"): the 1 km disc is still there, fading, while its twenty-five 200 m
 * cells come in over it, because they ARE the same statistic at two resolutions
 * — same indicator, same national breaks. Between the départements and the grid
 * the cut stays a cut, for the reason in the paragraph above: a resting view
 * that showed both would show one colour meaning two numbers. It no longer
 * goes blank, though — the outgoing level holds until the incoming one is
 * drawn, and the two cross over 260 ms.
 *
 * @module data/filosofiCarreaux
 */

/** Layer id — share-link registry key and voice-tool enum value. */
export const FILOSOFI_LAYER_ID = 'filosofi-fr';
export const FILOSOFI_LAYER_NAME = 'Carroyage INSEE';
export const FILOSOFI_SELECTED_OVERLAY_SOURCE_ID = 'filosofi-fr-selected';
export const FILOSOFI_SELECTED_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});

/**
 * Widest view that still draws symbols, in degrees of latitude.
 *
 * Beyond this the 1 km grid hits its row ceiling and the map becomes a SAMPLE
 * of the country wearing the clothes of a picture of it. Refusing is the
 * honest answer, and `ensureViewGate` flies the camera in rather than leaving
 * the operator to guess how far.
 */
export const FILOSOFI_MAX_BOX_DEG = 0.9;

/**
 * Where the carroyage exists. Outside these, every request is a certain zero.
 *
 * All three are drawn, which was not true until 2026-09-03: INSEE grids
 * Martinique in EPSG:5490 and La Réunion in EPSG:2975 — their own UTM zones —
 * and the identifier parser accepted EPSG:3035 alone, so both territories were
 * declared here and silently dropped every cell. `filosofiFeed.js` now inverts
 * all three grids.
 */
const FILOSOFI_COVERAGE = Object.freeze([
  Object.freeze({ south: 41.2, west: -5.3, north: 51.2, east: 9.7 }), // mainland France + Corsica
  Object.freeze({ south: 14.3, west: -61.3, north: 15.0, east: -60.7 }), // Martinique
  Object.freeze({ south: -21.5, west: 55.1, north: -20.8, east: 55.9 }), // La Réunion
]);

const REQUEST_DEBOUNCE_MS = 450;
const REQUEST_TIMEOUT_MS = 45_000;
const RETRY_MIN_MS = 20_000;
const RETRY_CEIL_MS = 240_000;
/**
 * Idle refresh cadence. A statistical millésime does not move; this exists so a
 * session left open across a new INSEE edition eventually notices, not because
 * anything changes hourly.
 */
const UPDATE_INTERVAL_MS = 60 * 60_000;
/** Cache grid the box is snapped onto — matches the proxy's own step. */
const BOX_SNAP_DEG = 0.01;

/**
 * Where the 1 km grid fades into the 200 m one, on the camera's own view:
 * `max(latitude span, 0.66 × longitude span)`, the measure `resolutionForBox`
 * already switches on.
 *
 * THE BAND CAN ONLY SIT BELOW THE OLD SWITCH. The 200 m grid's request is
 * capped where it always was — `resolutionForBox` of the box snapped onto the
 * 0.01° cache grid must still say 200, a 0.12° box over Paris being ~4 000 of
 * the 5 000 cells a request may return — so above 0.12 there is no fine grid
 * to fade into, and the band's coarse end is 0.12. Near it the fine request is
 * made or refused by the same rule as before (the snap can widen the box by
 * up to 0.02°); where it is refused, the 1 km grid simply stays, as it did.
 *
 * The fine end, 0.07, puts the band at a ratio of 1.7 — three quarters of a
 * zoom level. The 1 km grid has to stay drawn that far down, and it costs
 * nothing there: a 0.12° view holds about 200 of its cells. Over the band the
 * grids `reveal` rather than crossfade, so the 200 m grid is at full strength
 * from the first 30 % of it: the city view the harness has always checked —
 * Lyon from 9 km at −75°, 0.101 on this measure — is a 200 m view still, with
 * the 1 km discs fading out behind it instead of vanishing.
 */
export const FILOSOFI_GRID_BAND = fadeBand(0.07, 0.12);

/**
 * Where the régions fade into the départements, on the same measure.
 *
 * 12° is `levelForBox`'s switch and stays the coarse end. Both levels are
 * national answers — 14 and 97 anchors, one keyless request each behind a
 * month-long proxy cache — so keeping the régions drawn down to 7.2° costs a
 * few points, and the band can take the full 0.6 ratio.
 */
export const FILOSOFI_TERRITORY_BAND = fadeBand(7.2, 12);

/**
 * Whether an indicator is a COUNT, whose colour is a number of people per
 * cell (or per territory).
 *
 * Those do not fade. A 1 km cell holds twenty-five times the people of a 200 m
 * one, so on the same breaks it sits in the top bands while its own cells sit
 * in the middle ones — two colours, both right, for what a crossfade would
 * present as one place at two resolutions. The territory levels say the same
 * thing in their own code: `population` is the one indicator banded on the
 * level's own size breaks. A count keeps a hard cut, at the band's coarse end,
 * which is where it was.
 *
 * @param {object} metric
 * @returns {boolean}
 */
export function filosofiCountMetric(metric) {
  return metric?.id === 'population';
}

/** Selection accent, matching the app's other selected-object cards. */
const SELECTED_COLOR = '#00ffff';

/**
 * How opaque a disc is drawn.
 *
 * The second half of "never hide the map": the gaps let it through BETWEEN the
 * discs, this lets it through UNDER them. 0.7 is where the band still reads as
 * its own colour over a busy basemap — much below it and the ramp starts
 * borrowing the hue of whatever it is lying on, which would make the indicator
 * a function of the map style.
 *
 * The cost is real and worth knowing: translucent geometry does not write
 * depth, so two symbols overlapping on screen blend in whatever order they were
 * batched. Flat discs on a shared plane never overlap from above and barely do
 * at a grazing angle, which is what makes the alpha affordable here and made it
 * unaffordable when every cell was an extruded tower.
 */
const DISC_ALPHA = 0.7;

/** Reused so a 5 000-cell payload does not mint 5 000 Cartographics. */
const _groundScratch = new Cesium.Cartographic();

const DEFAULT_OVERLAY_HOST = Object.freeze({
  setEntries: setOverlayEntries,
  setVisible: setOverlaySourceVisible,
  clearSource: clearOverlaySource,
});

let _viewer = null;
let _overlayHost = DEFAULT_OVERLAY_HOST;
let _enabled = false;

/**
 * One grid's drawing. There are two, so that both can be on screen inside
 * `FILOSOFI_GRID_BAND`.
 *
 * A redraw is built into `pending` — a hidden primitive, which Cesium still
 * builds — and only replaces `primitive` once it is ready. Clearing the old one
 * first, as the layer used to, left the map blank for the frames an
 * asynchronous build takes, on every pan.
 *
 * @param {200|1000} resolution
 */
function emptyGrid(resolution) {
  return {
    resolution,
    appearance: null,
    primitive: null,
    /** cell id -> drawn record, for `primitive` */
    records: new Map(),
    pending: null,
    pendingRecords: null,
    payload: null,
    loadedKey: null,
    abort: null,
    /** Whether the last settled view wants this grid at all. */
    wanted: false,
  };
}
let _grids = { 200: emptyGrid(200), 1000: emptyGrid(1000) };
/**
 * The grid that owns the legend, the stats and the card's commune names:
 * the stronger of the two on the last settled view.
 */
let _dominantResolution = 200;
/**
 * The indicator the discs are coloured by, once one has been chosen.
 *
 * Null until then rather than `FILOSOFI_METRICS[0]`: that constant is FRENCH
 * by construction (see `filosofiFeed.js`), and reading the catalog here would
 * be a message read while the module loads. {@link currentMetric} resolves it
 * at draw time instead.
 */
let _metric = null;
let _selectedId = null;
let _loading = false;
let _inflight = 0;
let _error = null;
let _status = 'idle';
let _lastUpdate = null;
let _debounceTimer = null;
/** Bumped by every settled view, so a superseded one does not write the row. */
let _loadGeneration = 0;
let _retryTimer = null;
let _retryDelayMs = 0;
let _clickHandler = null;
let _moveEndRemover = null;
/**
 * The manager's "repaint my row" callback. The panel is otherwise redrawn on a
 * toggle or a poll — hourly here — and never when an answer lands, so a legend
 * that follows the stronger of two grids would keep describing the one the
 * camera had left: measured over Lyon at 9 km, a 200 m view under a legend that
 * still read "carroyage 1 km".
 */
let _rowControlsListener = null;

// --- The national regime ---------------------------------------------------
/**
 * `'carreaux'` below the grid's ceiling, `'territoires'` above it — on the last
 * SETTLED view. Both regimes can be drawn for the length of a swap; this says
 * which one is arriving and owns the row.
 */
let _regime = 'carreaux';
/** The territory level that owns the row, the stronger on the last settled view. */
let _level = 'DEP';

/** One territory level's drawing. Two, for `FILOSOFI_TERRITORY_BAND`. */
function emptyTerritory(level) {
  return {
    level,
    points: null,
    /** territory id -> drawn record */
    records: new Map(),
    payload: null,
    loadedKey: null,
    /** The indicator the points were last filled with. */
    metricId: null,
    abort: null,
    wanted: false,
    /** The collection was refilled: its alphas must be rewritten. */
    dirty: false,
  };
}
let _territories = { DEP: emptyTerritory('DEP'), REG: emptyTerritory('REG') };
/** The per-frame fade, while the layer is on. */
let _fade = null;
/**
 * The indicator the national discs are coloured by, once one has been chosen.
 *
 * Null until then, for the same reason {@link currentMetric} exists: resolving
 * it here would read the page's language while the module is still loading.
 */
let _territoryMetric = null;
let _territoryAnchors = null;

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------
/**
 * @param {{south:number, west:number, north:number, east:number}} box
 * @returns {boolean} Whether the box touches carroyage coverage.
 */
export function filosofiCoverageIntersects(box) {
  if (!box) return false;
  return FILOSOFI_COVERAGE.some((area) => box.south <= area.north && box.north >= area.south
    && box.west <= area.east && box.east >= area.west);
}

/** @param {object} box @returns {boolean} */
export function filosofiBoxTooWide(box) {
  if (!box) return true;
  return (box.north - box.south) > FILOSOFI_MAX_BOX_DEG
    || (box.east - box.west) > FILOSOFI_MAX_BOX_DEG * 1.6;
}

/**
 * The viewport this layer will ask for, or null with the reason it will not.
 *
 * Coverage BEFORE width, so a wide view of the Atlantic is told it is outside
 * the country rather than told to zoom in — advice that would find nothing at
 * any altitude.
 *
 * @param {?Cesium.Viewer} viewer
 * @returns {{box: ?object, reason: ?string}}
 */
export function filosofiViewportBox(viewer) {
  const rectangle = viewer?.camera?.computeViewRectangle(viewer.scene?.globe?.ellipsoid);
  if (!rectangle) return { box: null, reason: 'no-view' };
  const box = {
    south: Cesium.Math.toDegrees(rectangle.south),
    north: Cesium.Math.toDegrees(rectangle.north),
    west: Cesium.Math.toDegrees(rectangle.west),
    east: Cesium.Math.toDegrees(rectangle.east),
  };
  if (!Number.isFinite(box.south) || !Number.isFinite(box.west)) return { box: null, reason: 'no-view' };
  if (box.west >= box.east || box.south >= box.north) return { box: null, reason: 'no-view' };
  if (!filosofiCoverageIntersects(box)) return { box: null, reason: 'off-coverage', raw: box };
  if (filosofiBoxTooWide(box)) return { box: null, reason: 'too-wide', raw: box };
  return { box, reason: null, raw: box };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
/** Terrain height the globe is actually rendering under a point, or null. */
function renderedGroundM(lat, lon) {
  const globe = _viewer?.scene?.globe;
  if (!globe?.getHeight) return null;
  _groundScratch.longitude = Cesium.Math.toRadians(lon);
  _groundScratch.latitude = Cesium.Math.toRadians(lat);
  _groundScratch.height = 0;
  const height = globe.getHeight(_groundScratch);
  return Number.isFinite(height) ? height : null;
}

/**
 * The outline of one drawn symbol, concentric with its cell.
 *
 * Serves both the disc and the hole an imputed disc carries: they differ only
 * by the fraction handed in.
 *
 * @param {object} cell
 * @param {number} resolution
 * @param {number} fraction Diameter as a share of the cell's side.
 * @returns {Array<[number, number]>}
 */
export function drawnOutline(cell, resolution, fraction) {
  return cellDisc({
    res: resolution, n: cell.n, e: cell.e, crs: cell.crs ?? 3035,
  }, fraction);
}

/**
 * A stable, human-readable id for one drawn cell.
 *
 * The GRID is part of the identity, not decoration: métropole is EPSG:3035 and
 * the overseas grids are their own UTM zones, so two cells in two territories
 * can carry the same northing and easting and mean different places.
 */
export function cellId(cell, resolution) {
  return `filosofi:${cell.crs ?? 3035}:${resolution}:${cell.n}:${cell.e}`;
}

/** Both grids, fine first. */
function gridList() {
  return [_grids[200], _grids[1000]];
}

/** The drawn record behind a cell id, in whichever grid holds it. */
function findCellRecord(id) {
  for (const grid of gridList()) {
    const record = grid.records.get(id);
    if (record) return { grid, record };
  }
  return null;
}

/**
 * The grid whose answer the row describes: the dominant one when it has
 * answered, otherwise whichever has, so the panel never reads empty while a
 * second grid is on screen.
 */
function rowGrid() {
  const dominant = _grids[_dominantResolution];
  if (dominant.payload) return dominant;
  return gridList().find((grid) => grid.payload) || dominant;
}

function removePrimitive(primitive) {
  if (primitive && _viewer?.scene) _viewer.scene.primitives.remove(primitive);
}

/** Drop one grid's drawing and answer. */
function clearGrid(grid) {
  grid.abort?.abort();
  grid.abort = null;
  if (_selectedId && grid.records.has(_selectedId)) clearSelection();
  removePrimitive(grid.primitive);
  removePrimitive(grid.pending);
  grid.primitive = null;
  grid.pending = null;
  grid.pendingRecords = null;
  grid.records = new Map();
  grid.payload = null;
  grid.loadedKey = null;
}

function clearGrids() {
  for (const grid of gridList()) clearGrid(grid);
}

/**
 * What the layer draws, one record per populated cell.
 *
 * Falls back to the viewport's own first answer where the globe has no tile
 * yet, so a cold tile does not drop one symbol to sea level next to its
 * neighbours.
 *
 * @param {Array<object>} cells
 * @param {number} resolution
 * @returns {{records: Array<object>, coldGround: number}}
 */
function buildRecords(cells, resolution, vintage = FILOSOFI_VINTAGE) {
  const records = [];
  let coldGround = 0;
  let fallbackM = null;
  for (const cell of cells) {
    const symbol = cellSymbol(cell, currentMetric(), { resolution });
    if (symbol.fill <= 0) continue;
    const [lon, lat] = cellCentre({
      res: resolution, n: cell.n, e: cell.e, crs: cell.crs ?? 3035,
    });
    // ONE sample, at the centre. Probing the footprint instead was measured at
    // 400 ms per redraw against 85 ms for the same 484 cells; the clearance
    // below absorbs the relief that costs.
    let groundM = renderedGroundM(lat, lon);
    if (groundM === null) {
      coldGround += 1;
      groundM = fallbackM ?? 0;
    } else if (fallbackM === null) {
      fallbackM = groundM;
    }
    const color = cellColor(cell, currentMetric());
    if (!color) continue;
    const baseM = groundM + cellClearanceM(resolution, symbol.fill);
    records.push({
      id: cellId(cell, resolution),
      cell,
      resolution,
      vintage,
      color,
      fill: symbol.fill,
      baseM,
      lon,
      lat,
      corners: drawnOutline(cell, resolution, symbol.fill),
      holeCorners: symbol.hole > 0 ? drawnOutline(cell, resolution, symbol.hole) : null,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, baseM),
    });
  }
  return { records, coldGround };
}

/**
 * The polygon one record draws: its disc, with the hole an imputed cell has.
 *
 * A hole rather than a second, smaller instance in the basemap's colour: the
 * ring has to be genuinely open, or the map does not show through it and the
 * hollow means nothing.
 *
 * @param {object} record
 * @returns {Cesium.PolygonHierarchy}
 */
function symbolHierarchy(record) {
  const ring = [];
  for (const [lon, lat] of record.corners) ring.push(lon, lat);
  const positions = Cesium.Cartesian3.fromDegreesArray(ring);
  if (!record.holeCorners) return new Cesium.PolygonHierarchy(positions);
  const hole = [];
  for (const [lon, lat] of record.holeCorners) hole.push(lon, lat);
  return new Cesium.PolygonHierarchy(positions, [
    new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(hole)),
  ]);
}

/**
 * Build one batched primitive for a grid's whole viewport.
 *
 * Into `pending`, hidden: the frame callback promotes it once Cesium reports it
 * ready, and only then removes the drawing it replaces. An empty answer clears
 * the grid at once — there is nothing to wait for.
 *
 * @param {object} grid
 * @param {Array<object>} records
 */
function drawGrid(grid, records) {
  // A redraw that finished building but was never shown (no frame rendered in
  // between) is the freshest drawing there is: it goes on screen rather than
  // into the bin.
  promotePending(grid);
  removePrimitive(grid.pending);
  grid.pending = null;
  grid.pendingRecords = null;
  if (!_viewer) return;
  if (!records.length) {
    if (_selectedId && grid.records.has(_selectedId)) clearSelection();
    removePrimitive(grid.primitive);
    grid.primitive = null;
    grid.records = new Map();
    governorRequestRender('filosofi-fr');
    return;
  }

  const pendingRecords = new Map();
  const instances = [];
  for (const record of records) {
    pendingRecords.set(record.id, record);
    instances.push(new Cesium.GeometryInstance({
      id: record.id,
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: symbolHierarchy(record),
        // FLAT, and at one height: no extrusion, no walls, nothing standing up
        // off the map. The count is the disc's area; a prism would say it twice
        // and stand in front of the streets it is describing.
        height: record.baseM,
        vertexFormat: Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(instanceColor(record)),
      },
    }));
  }

  // Flat shading, because there is no form left to shade and a headlight on a
  // horizontal disc only tints it: `flat` puts the exact band colour on the
  // map, which is what the panel's legend swatch promises. The appearance is
  // the grid's own and outlives its primitives: its one uniform is how the
  // whole grid fades, whatever the number of discs.
  grid.appearance ??= createFadeColorAppearance({ flat: true, closed: false });
  grid.pending = new Cesium.Primitive({
    geometryInstances: instances,
    appearance: grid.appearance,
    asynchronous: true,
    releaseGeometryInstances: false,
  });
  grid.pending.show = false;
  grid.pendingRecords = pendingRecords;
  _viewer.scene.primitives.add(grid.pending);
  governorRequestRender('filosofi-fr');
}

/**
 * Swap a grid's ready redraw in for the drawing it replaces.
 *
 * The selection survives a redraw that still holds its cell — a pan of a few
 * streets used to drop the highlight and leave the card standing alone — and
 * closes with it when the cell has left the view.
 *
 * @param {object} grid
 * @returns {boolean} Whether a drawing was promoted.
 */
function promotePending(grid) {
  if (!grid.pending?.ready) return false;
  removePrimitive(grid.primitive);
  grid.primitive = grid.pending;
  grid.records = grid.pendingRecords || new Map();
  grid.pending = null;
  grid.pendingRecords = null;
  if (_selectedId && cellResolution(_selectedId) === grid.resolution) {
    if (grid.records.has(_selectedId)) {
      applyInstanceColor(_selectedId, Cesium.Color.fromCssColorString(SELECTED_COLOR).withAlpha(DISC_ALPHA));
    } else {
      clearSelection();
    }
  }
  return true;
}

/** The grid a cell id belongs to, read off the id itself. */
function cellResolution(id) {
  return String(id).startsWith('filosofi:') ? Number(String(id).split(':')[2]) : null;
}

/**
 * A cell's drawn colour: its band, at the layer's one alpha.
 *
 * The brightness used to carry the extrusion, to separate two neighbours in the
 * same band that shared an edge. Nothing shares an edge now: every symbol
 * stands inside its own cell with a gutter around it, so the band can be the
 * band, and two cells of the same colour are two cells with the same value.
 *
 * One alpha for every disc, and that matters: varying it per cell would make
 * transparency a third data channel nobody declared, and the map underneath
 * would read as part of the statistic.
 *
 * @param {object} record
 * @returns {Cesium.Color}
 */
export function instanceColor(record) {
  return Cesium.Color.fromCssColorString(record.color).withAlpha(DISC_ALPHA);
}

function applyInstanceColor(id, color) {
  const primitive = findCellRecord(id)?.grid.primitive;
  if (!primitive?.ready) return;
  const attributes = primitive.getGeometryInstanceAttributes(id);
  if (!attributes) return;
  attributes.color = Cesium.ColorGeometryInstanceAttribute.toValue(color, attributes.color);
  governorRequestRender('filosofi-recolor');
}

function clearSelection() {
  if (_selectedId) {
    const found = findCellRecord(_selectedId);
    if (found) applyInstanceColor(_selectedId, instanceColor(found.record));
  }
  _selectedId = null;
  _overlayHost.clearSource(FILOSOFI_SELECTED_OVERLAY_SOURCE_ID);
  _overlayHost.clearSource(TERRITORY_SELECTED_OVERLAY_SOURCE_ID);
}

/** The grid indicator in force, in the page's language. */
function currentMetric() {
  return _metric ?? resolveMetric(null);
}

/** The territory indicator in force, in the page's language. */
function currentTerritoryMetric() {
  return _territoryMetric ?? resolveTerritoryMetric(null);
}


// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------
/** A number, grouped the way the reader's language groups one. */
function _fmt(value) {
  return formatNumber(value);
}

/** @param {?number} value @returns {string} */
function count(value) {
  return Number.isFinite(value) ? _fmt(Math.round(value)) : '—';
}

/** @param {?number} value @returns {string} */
function published(value) {
  return Number.isFinite(value) ? _fmt(value) : messages().notPublished;
}

/**
 * The card for one selected cell.
 *
 * Every line is either a published value or an explicit statement that the
 * value is absent — and the imputation line is never omitted, because a
 * modelled figure that looks like a measured one is the single way this layer
 * could mislead.
 *
 * @param {object} record
 * @param {Object<string,string>} communes
 * @returns {?object}
 */
export function createFilosofiSelectedOverlayEntry(record, communes = {}) {
  if (!record?.id || !record.position) return null;
  const cell = record.cell;
  const side = record.resolution === 1000 ? '1 km' : '200 m';
  const commune = cell.com ? communes[cell.com] : null;
  const m = messages();
  const details = [];

  details.push(m.card.people(count(cell.ind), count(cell.men)));
  details.push(cell.niveau !== null
    ? m.card.standardOfLiving(published(cell.niveau))
    : m.card.noStandardOfLiving);
  if (cell.pauvrete !== null) details.push(m.card.poor(cell.pauvrete));
  if (cell.social !== null) details.push(m.card.social(cell.social));
  if (cell.jeunes !== null || cell.aines !== null) {
    details.push(m.card.ages(cell.jeunes ?? '—', cell.aines ?? '—'));
  }
  if (cell.proprietaires !== null) details.push(m.card.owners(cell.proprietaires));
  if (cell.solo !== null) details.push(m.card.alone(cell.solo));
  if (cell.surface !== null) details.push(m.card.surface(cell.surface));

  // The one line that must never be dropped — and never guessed either: with
  // the flag absent the card says the flag is absent, because "observé" is a
  // claim and a missing column does not support it.
  if (cell.est === 1) details.push(m.card.imputed);
  else if (cell.est === 0) details.push(m.card.observed);
  else details.push(m.card.imputationUnknown);
  // THE MILLÉSIME IS READ, NOT ASSERTED. The relay serves 2019 and a local pack
  // serves 2021, and Martinique and La Réunion stay on the relay even when
  // métropole has moved — so the year belongs to the ANSWER this cell came in,
  // not to the layer. A constant here is one upstream refresh away from
  // captioning 2021 figures with "2019".
  const vintage = record.vintage ?? FILOSOFI_VINTAGE;
  details.push(m.card.vintage(side, vintage));
  // Size is the count, not the indicator — stated on the card because it is the
  // one thing a viewer cannot read off the picture, and because a disc that
  // stops short of its cell must say what the space around it means: nobody
  // there, not no data there.
  const metric = currentMetric();
  details.push(m.card.channels(
    metric.weight === 'men' ? m.card.households : m.card.residents,
    metric.label.toLowerCase(),
  ));

  return {
    id: String(record.id),
    position: record.position,
    variant: 'selected',
    selected: true,
    protected: true,
    paintLane: 'selected',
    collisionGroup: 'ambient-card',
    priority: Number.MAX_SAFE_INTEGER,
    title: commune || (cell.com ? m.card.communeCode(cell.com) : m.card.cellTitle(side)),
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

/** @param {*} picked @param {(id:string)=>boolean} has @returns {?string} */
export function resolveFilosofiPickId(picked, has = (id) => Boolean(findCellRecord(id))) {
  const id = typeof picked?.id === 'string' ? picked.id : picked?.id?.id;
  return typeof id === 'string' && has(id) ? id : null;
}

function selectCell(id) {
  const found = findCellRecord(id);
  const record = found?.record;
  if (!record) return false;
  clearSelection();
  _selectedId = id;
  applyInstanceColor(id, Cesium.Color.fromCssColorString(SELECTED_COLOR).withAlpha(DISC_ALPHA));
  const entry = createFilosofiSelectedOverlayEntry(record, found.grid.payload?.communes || {});
  if (entry) {
    _overlayHost.setVisible(FILOSOFI_SELECTED_OVERLAY_SOURCE_ID, true);
    _overlayHost.setEntries(
      FILOSOFI_SELECTED_OVERLAY_SOURCE_ID, [entry], FILOSOFI_SELECTED_OVERLAY_SOURCE_OPTIONS,
    );
  }
  governorRequestRender('filosofi-select');
  return true;
}

function onKeyDown(event) {
  if (event.key === 'Escape' && _selectedId) clearSelection();
}

/**
 * The LEFT_CLICK rule, named so it can be tested without a canvas.
 *
 * ANY pick that is neither a cell nor a territory of ours closes the card. The
 * test used to be `!picked`, and over the photorealistic globe that is never
 * true — every on-globe pixel picks a 3D Tiles feature — so the card could not
 * be dismissed by clicking the map at all. See `pickRegistry.isWorldPick` for
 * the measurement.
 *
 * @param {*} picked Raw `scene.pick` result.
 * @returns {'territory'|'cell'|'close'|'ignore'}
 */
export function filosofiClick(picked) {
  const territory = resolveTerritoryPickId(picked, (id) => Boolean(findTerritoryRecord(id)));
  if (territory) return selectTerritory(territory) ? 'territory' : 'ignore';
  const id = resolveFilosofiPickId(picked);
  if (id) return selectCell(id) ? 'cell' : 'ignore';
  if (_selectedId) { clearSelection(); return 'close'; }
  return 'ignore';
}

function installClickHandler(viewer) {
  if (_clickHandler || !viewer?.scene?.canvas) return;
  _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  _clickHandler.setInputAction((click) => {
    filosofiClick(pickAt(viewer.scene, click.position));
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  if (typeof document !== 'undefined') document.addEventListener('keydown', onKeyDown);
}

// ---------------------------------------------------------------------------
// The national regime
// ---------------------------------------------------------------------------
function territoryList() {
  return [_territories.DEP, _territories.REG];
}

/** The drawn record behind a territory id, at whichever level holds it. */
function findTerritoryRecord(id) {
  for (const territory of territoryList()) {
    const record = territory.records.get(id);
    if (record) return { territory, record };
  }
  return null;
}

/** The territory level the row describes, with the same fallback as `rowGrid`. */
function rowTerritory() {
  const dominant = _territories[_level];
  if (dominant.payload) return dominant;
  return territoryList().find((territory) => territory.payload) || dominant;
}

function territoryShown(territory) {
  return Boolean(territory.points && territory.records.size);
}

function gridShown(grid) {
  return Boolean(grid.primitive && grid.records.size);
}

function clearTerritory(territory) {
  territory.abort?.abort();
  territory.abort = null;
  if (_selectedId && territory.records.has(_selectedId)) clearSelection();
  if (territory.points && _viewer?.scene) _viewer.scene.primitives.remove(territory.points);
  territory.points = null;
  territory.records = new Map();
  territory.payload = null;
  territory.loadedKey = null;
  territory.metricId = null;
  territory.dirty = false;
}

function clearTerritories() {
  for (const territory of territoryList()) clearTerritory(territory);
}

/**
 * Make one regime the one arriving.
 *
 * Nothing is cleared here any more, and that is the change: the regime being
 * left holds its drawing until the arriving one has drawn its own, the two
 * cross over the arrival ramp, and the frame callback retires the old one once
 * it has faded to nothing. Only one regime is ever on screen at REST.
 */
function enterRegime(next) {
  if (_regime === next) return;
  clearSelection();
  _regime = next;
}

/**
 * Start the arrival ramp of a level that has just been drawn from nothing.
 *
 * The REGIME's ramp when nothing of its regime was on screen — it crosses with
 * the other regime — and the level's own when its partner was, so the two
 * ramps never multiply into a slower one.
 *
 * @param {'grid'|'territory'} kind
 * @param {string|number} level
 * @param {boolean} partnerShown
 */
function noteArrival(kind, level, partnerShown) {
  if (!_fade) return;
  if (partnerShown) _fade.arrive(`${kind}:${level}`);
  else _fade.arrive(kind === 'grid' ? 'grids' : 'territories');
}

function drawTerritory(territory, records) {
  if (!_viewer?.scene) return;
  const wasShown = territoryShown(territory);
  const partnerShown = territoryList().some((other) => other !== territory && territoryShown(other));
  if (!territory.points) {
    territory.points = new Cesium.PointPrimitiveCollection();
    territory.points.show = false;
    _viewer.scene.primitives.add(territory.points);
  }
  const drawn = fillTerritoryCollection(territory.points, records, currentTerritoryMetric());
  territory.records = new Map(drawn.map((record) => [record.id, record]));
  territory.metricId = currentTerritoryMetric().id;
  // The refill put every point back at its full alpha; the next frame has to
  // write the fade again even though the weight has not moved.
  territory.dirty = true;
  if (!wasShown && territory.records.size) noteArrival('territory', territory.level, partnerShown);
  governorRequestRender('filosofi-territoires');
  _fade?.frame();
}

/** One level's records from the answer in hand, under the indicator in force. */
function territoryRecordsFor(territory) {
  if (!territory.payload || !_territoryAnchors) return [];
  const { records } = joinTerritories(territory.payload.territories, _territoryAnchors, territory.level);
  // The carreau millésime the proxy says it would serve, carried onto every
  // record so the card can name it without the client assuming a year.
  for (const record of records) record.carroyageVintage = territory.payload.vintage?.carroyage ?? null;
  return records;
}

/**
 * Fetch and draw one level of the national view.
 *
 * The anchors and the figures are fetched INDEPENDENTLY and cached
 * independently: the anchors are a bundled file that never changes within a
 * release, the figures are a millésime behind a month-long proxy cache. Tying
 * them into one request would re-download the outlines every time INSEE's
 * cache expired.
 *
 * @param {object} territory `_territories.DEP` or `_territories.REG`.
 * @returns {Promise<boolean>} Whether anything new was drawn.
 */
async function loadTerritory(territory) {
  const level = territory.level;
  const key = `territoires:${level}`;
  if (key === territory.loadedKey && territory.payload && !territory.error) {
    // Same level, same figures — redrawn only if the indicator changed since.
    if (territory.metricId !== currentTerritoryMetric().id) drawTerritory(territory, territoryRecordsFor(territory));
    return false;
  }

  territory.abort?.abort();
  const abort = new AbortController();
  territory.abort = abort;
  const signal = abort.signal;
  const timeout = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  territory.error = null;
  beginLoad();
  try {
    const [payload, anchors] = await Promise.all([
      fetch(`/api/filosofi/territoires?level=${level}`, { signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(await serverFailureMessage(response, { fallback: `territoires HTTP ${response.status}` }));
          }
          const body = await response.json();
          if (!Array.isArray(body?.territories)) throw new Error(messages().error.territories);
          return body;
        }),
      _territoryAnchors ? Promise.resolve(_territoryAnchors) : loadTerritoryAnchors(),
    ]);
    if (signal.aborted) return false;
    _territoryAnchors = anchors;
    const { unanchored } = joinTerritories(payload.territories, anchors, level);
    territory.payload = { ...payload, unanchored };
    const records = territoryRecordsFor(territory);
    territory.payload.drawn = records.length;
    drawTerritory(territory, records);
    territory.loadedKey = key;
    _lastUpdate = Date.now();
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    territory.error = error?.message || String(error);
    territory.loadedKey = null;
    console.warn('[Data:Carroyage INSEE] national view failed:', error);
    return false;
  } finally {
    clearTimeout(timeout);
    if (territory.abort === abort) territory.abort = null;
    endLoad();
  }
}

function selectTerritory(id) {
  const record = findTerritoryRecord(id)?.record;
  if (!record) return false;
  clearSelection();
  _selectedId = id;
  const entry = createTerritorySelectedOverlayEntry(record, currentTerritoryMetric());
  if (entry) {
    _overlayHost.setVisible(TERRITORY_SELECTED_OVERLAY_SOURCE_ID, true);
    _overlayHost.setEntries(
      TERRITORY_SELECTED_OVERLAY_SOURCE_ID, [entry], FILOSOFI_SELECTED_OVERLAY_SOURCE_OPTIONS,
    );
  }
  governorRequestRender('filosofi-territory-select');
  return true;
}

// ---------------------------------------------------------------------------
// The fade
// ---------------------------------------------------------------------------
/**
 * The measure both bands are on: `max(latitude span, 0.66 × longitude span)`
 * of a view box — the one `resolutionForBox` and `levelForBox` switch on.
 *
 * @param {?{south:number, north:number, west:number, east:number}} box
 * @returns {number} Infinity without a box: the coarsest view there is.
 */
export function filosofiViewScale(box) {
  if (!box) return Infinity;
  const lat = box.north - box.south;
  const lon = box.east - box.west;
  if (!(lat > 0) || !(lon > 0)) return Infinity;
  return Math.max(lat, lon * 0.66);
}

/**
 * Which grids a settled view loads, and which one owns the row.
 *
 * The 200 m grid only where the band gives it weight AND its request is one
 * the layer was already allowed to make (`resolutionForBox` of the snapped
 * box); the 1 km grid wherever it has weight, or as the only answer when the
 * fine one is refused. The row belongs to the 200 m grid as soon as the
 * `reveal` has it at half strength — the detail is what the reader zoomed in
 * for, and Paris from 9 km (0.107 on this measure, where the two grids cross
 * at 0.7 each) is a 200 m view in the harness as it was on the old switch —
 * and to the 200 m grid outright for a count, which cuts.
 *
 * @param {number} scale `filosofiViewScale` of the camera's box.
 * @param {object} metric
 * @param {200|1000} [snappedResolution] `resolutionForBox` of the snapped box.
 * @returns {{position: number, wanted: Array<200|1000>, dominant: 200|1000}}
 */
export function filosofiGridPlan(scale, metric, snappedResolution = 200) {
  const position = bandPosition(scale, FILOSOFI_GRID_BAND);
  const fine = position > 0 && snappedResolution === 200;
  const coarse = position < 1 || !fine;
  const wanted = [];
  if (fine) wanted.push(200);
  if (coarse) wanted.push(1000);
  let dominant = fine ? 200 : 1000;
  if (fine && coarse) dominant = levelTargets(position, filosofiCountMetric(metric)).fine >= 0.5 ? 200 : 1000;
  return { position, wanted, dominant };
}

/**
 * Which territory levels a settled view loads, and which one owns the row.
 * @param {number} scale
 * @param {object} metric The territory indicator in force.
 * @returns {{position: number, wanted: Array<'DEP'|'REG'>, dominant: 'DEP'|'REG'}}
 */
export function filosofiTerritoryPlan(scale, metric) {
  const position = bandPosition(scale, FILOSOFI_TERRITORY_BAND);
  const wanted = [];
  if (position > 0) wanted.push('DEP');
  if (position < 1) wanted.push('REG');
  let dominant = position > 0 ? 'DEP' : 'REG';
  // Same rule as the grids: the finer level owns the row from half strength.
  if (wanted.length === 2) dominant = levelTargets(position, filosofiCountMetric(metric)).fine >= 0.5 ? 'DEP' : 'REG';
  return { position, wanted, dominant };
}

/**
 * The weights two levels of one regime aim for at a band position: a `reveal`
 * — or, for a count, a hard cut where the finer level wins as soon as it has
 * weight, which is where the old switch put it.
 *
 * @param {number} position
 * @param {boolean} cut
 * @returns {{fine: number, coarse: number}}
 */
function levelTargets(position, cut) {
  if (cut) return position > 0 ? { fine: 1, coarse: 0 } : { fine: 0, coarse: 1 };
  return reveal(position);
}

/**
 * The alpha each of the four levels is drawn at.
 *
 * Three pairs, nested. The REGIMES are a hard cut (two datasets): whichever the
 * last settled view chose takes over once it is drawn. Inside each regime the
 * two levels `reveal` over their band — or cut, for a count indicator. The
 * cover rule (`coverAlphas`) applies at every step, so nothing dims that is not
 * being replaced by something already drawn.
 *
 * @param {{
 *   regime: 'carreaux'|'territoires',
 *   gridPosition: number, territoryPosition: number,
 *   gridCut?: boolean, territoryCut?: boolean,
 *   ready: {200?: boolean, 1000?: boolean, DEP?: boolean, REG?: boolean},
 *   arrival?: (key: string) => number,
 * }} state
 * @returns {{200: number, 1000: number, DEP: number, REG: number}}
 */
export function filosofiLevelAlphas(state) {
  const arrival = state.arrival || (() => 1);
  const ready = state.ready || {};
  const gridsReady = Boolean(ready[200] || ready[1000]);
  const territoriesReady = Boolean(ready.DEP || ready.REG);
  const regimes = coverAlphas(
    state.regime === 'territoires' ? { fine: 0, coarse: 1 } : { fine: 1, coarse: 0 },
    {
      fineReady: gridsReady,
      coarseReady: territoriesReady,
      fineArrival: arrival('grids'),
      coarseArrival: arrival('territories'),
    },
  );
  const grids = coverAlphas(
    levelTargets(state.gridPosition, state.gridCut),
    {
      fineReady: Boolean(ready[200]),
      coarseReady: Boolean(ready[1000]),
      fineArrival: arrival('grid:200'),
      coarseArrival: arrival('grid:1000'),
    },
  );
  const territories = coverAlphas(
    levelTargets(state.territoryPosition, state.territoryCut),
    {
      fineReady: Boolean(ready.DEP),
      coarseReady: Boolean(ready.REG),
      fineArrival: arrival('territory:DEP'),
      coarseArrival: arrival('territory:REG'),
    },
  );
  return {
    200: regimes.fine * grids.fine,
    1000: regimes.fine * grids.coarse,
    DEP: regimes.coarse * territories.fine,
    REG: regimes.coarse * territories.coarse,
  };
}

/**
 * Every rendered frame: promote ready redraws, write each level's alpha, and
 * retire a level that has faded out and that the settled view no longer wants.
 *
 * Retirement waits for every arrival ramp to finish, so a level is never
 * dropped while it is still the cover for one coming in.
 *
 * @param {ReturnType<import('./zoomFade.js').readViewScale>} scale
 * @param {number} now
 */
function onFadeFrame(scale, now) {
  for (const grid of gridList()) {
    const wasShown = gridShown(grid);
    const partnerShown = gridList().some((other) => other !== grid && gridShown(other));
    if (promotePending(grid) && !wasShown && gridShown(grid)) noteArrival('grid', grid.resolution, partnerShown);
  }
  const measure = Math.max(scale.latSpan, scale.lonSpan * 0.66);
  const alphas = filosofiLevelAlphas({
    regime: _regime,
    gridPosition: bandPosition(measure, FILOSOFI_GRID_BAND),
    territoryPosition: bandPosition(measure, FILOSOFI_TERRITORY_BAND),
    gridCut: filosofiCountMetric(currentMetric()),
    territoryCut: filosofiCountMetric(currentTerritoryMetric()),
    ready: {
      200: gridShown(_grids[200]),
      1000: gridShown(_grids[1000]),
      DEP: territoryShown(_territories.DEP),
      REG: territoryShown(_territories.REG),
    },
    arrival: (key) => _fade?.arrival(key, now) ?? 1,
  });

  for (const grid of gridList()) {
    const alpha = alphas[grid.resolution];
    if (grid.appearance) setAppearanceFade(grid.appearance, alpha);
    if (grid.primitive) grid.primitive.show = levelVisible(_enabled, alpha);
  }
  for (const territory of territoryList()) {
    if (!territory.points) continue;
    const alpha = alphas[territory.level];
    fadeCollection(territory.points, alpha, { force: territory.dirty });
    territory.dirty = false;
    territory.points.show = levelVisible(_enabled, alpha);
  }

  if (!_fade?.arriving()) {
    for (const grid of gridList()) {
      if (!grid.wanted && gridShown(grid) && quantizeFade(alphas[grid.resolution]) === 0) clearGrid(grid);
    }
    for (const territory of territoryList()) {
      if (!territory.wanted && territoryShown(territory) && quantizeFade(alphas[territory.level]) === 0) {
        clearTerritory(territory);
      }
    }
  }

  _fade?.report({
    levels: { 200: alphas[200], 1000: alphas[1000], DEP: alphas.DEP, REG: alphas.REG },
    dominant: _regime === 'territoires' ? _level : String(_dominantResolution),
    regime: _regime,
    // The unit is `filosofiViewScale`: max(latitude span, 0.66 × longitude span).
    bands: {
      grid: { ...FILOSOFI_GRID_BAND, unit: 'deg-max66' },
      territory: { ...FILOSOFI_TERRITORY_BAND, unit: 'deg-max66' },
    },
  });
}

function startFade() {
  if (_fade || !_viewer) return;
  _fade = watchZoomFade(_viewer, FILOSOFI_LAYER_ID, onFadeFrame);
  _fade.frame();
}

function stopFade() {
  _fade?.release();
  _fade = null;
  for (const grid of gridList()) if (grid.primitive) grid.primitive.show = false;
  for (const territory of territoryList()) if (territory.points) territory.points.show = false;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
function clearRetry() {
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
}

function scheduleLoad() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => { void load(); }, REQUEST_DEBOUNCE_MS);
}

function scheduleRetry() {
  clearRetry();
  _retryDelayMs = _retryDelayMs ? Math.min(_retryDelayMs * 2, RETRY_CEIL_MS) : RETRY_MIN_MS;
  _retryTimer = setTimeout(() => { void load(); }, _retryDelayMs);
}

function beginLoad() {
  _inflight += 1;
  _loading = true;
  _status = 'loading';
}

function endLoad() {
  _inflight = Math.max(0, _inflight - 1);
  _loading = _inflight > 0;
}

/** Drop a redraw nobody wants any more, without touching what is on screen. */
function dropPending(grid) {
  grid.abort?.abort();
  grid.abort = null;
  removePrimitive(grid.pending);
  grid.pending = null;
  grid.pendingRecords = null;
}

/**
 * Fetch and draw one grid for a snapped box.
 * @param {object} grid
 * @param {{south:number, west:number, north:number, east:number}} snapped
 * @returns {Promise<boolean>} Whether anything new was drawn.
 */
async function loadGrid(grid, snapped) {
  const key = `${grid.resolution}:${boxKey(snapped, 3)}`;
  if (key === grid.loadedKey && grid.payload && !grid.error) return false;

  grid.abort?.abort();
  const abort = new AbortController();
  grid.abort = abort;
  const signal = abort.signal;
  const timeout = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  grid.error = null;
  beginLoad();
  try {
    const query = new URLSearchParams({
      south: snapped.south.toFixed(5),
      west: snapped.west.toFixed(5),
      north: snapped.north.toFixed(5),
      east: snapped.east.toFixed(5),
      resolution: String(grid.resolution),
    });
    const response = await fetch(`/api/filosofi/carreaux?${query}`, { signal });
    if (!response.ok) {
      throw new Error(await serverFailureMessage(response, { fallback: `carroyage HTTP ${response.status}` }));
    }
    const payload = await response.json();
    if (signal.aborted) return false;
    if (!payload || payload.error) throw new Error(serverMessage(payload, { fallback: messages().error.cells }));

    const vintage = payload.vintage ?? FILOSOFI_VINTAGE;
    const { records, coldGround } = buildRecords(payload.cells || [], grid.resolution, vintage);
    drawGrid(grid, records);
    grid.payload = {
      ...payload, resolution: payload.resolution ?? grid.resolution, drawn: records.length, coldGround,
    };
    grid.loadedKey = key;
    _lastUpdate = Date.now();
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    grid.error = error?.message || String(error);
    grid.loadedKey = null;
    console.warn('[Data:Carroyage INSEE] load failed:', error);
    return false;
  } finally {
    clearTimeout(timeout);
    if (grid.abort === abort) grid.abort = null;
    endLoad();
  }
}

/**
 * Wait for one settled view's loads and publish what they came to.
 *
 * A later view supersedes this one: its loads aborted ours, and only the
 * latest generation writes the row's status.
 */
async function settle(generation, loads, levels) {
  const results = await Promise.all(loads);
  const drew = results.some(Boolean);
  if (generation !== _loadGeneration || !_enabled) return drew;
  const failed = levels.find((level) => level.error);
  _error = failed ? failed.error : null;
  if (_error) {
    _status = 'unavailable';
    scheduleRetry();
  } else {
    _status = 'ready';
    _retryDelayMs = 0;
    clearRetry();
  }
  _fade?.frame();
  governorRequestRender('filosofi-settled');
  _rowControlsListener?.();
  return drew;
}

/** Fetch and draw the carroyage for the current viewport. */
async function load() {
  if (!_enabled || !_viewer) return false;
  const generation = ++_loadGeneration;

  const { box, reason, raw } = filosofiViewportBox(_viewer);
  if (!box) {
    // TOO WIDE IS NOT NOTHING. The grid cannot answer here, but INSEE can: the
    // layer changes dataset rather than going blank, and says which one it is
    // on. Off-coverage and no-view still clear — there is no French aggregate
    // for a view of the Atlantic either.
    if (reason === 'too-wide') {
      enterRegime('territoires');
      // The grids are not cleared: whichever is drawn holds until the
      // territories are, then fades out under them and is retired.
      for (const grid of gridList()) {
        grid.wanted = false;
        dropPending(grid);
      }
      const plan = filosofiTerritoryPlan(filosofiViewScale(raw), currentTerritoryMetric());
      for (const territory of territoryList()) territory.wanted = plan.wanted.includes(territory.level);
      _level = plan.dominant;
      const levels = plan.wanted.map((level) => _territories[level]);
      return settle(generation, levels.map(loadTerritory), levels);
    }
    enterRegime('carreaux');
    clearGrids();
    clearTerritories();
    _error = null;
    _status = reason === 'off-coverage' ? 'off-coverage' : 'idle';
    governorRequestRender('filosofi-clear');
    return false;
  }

  enterRegime('carreaux');
  for (const territory of territoryList()) {
    territory.wanted = false;
    territory.abort?.abort();
  }
  const snapped = snapBoxOutward(box, BOX_SNAP_DEG);
  const plan = filosofiGridPlan(filosofiViewScale(raw), currentMetric(), resolutionForBox(snapped));
  for (const grid of gridList()) {
    grid.wanted = plan.wanted.includes(grid.resolution);
    if (!grid.wanted) dropPending(grid);
  }
  _dominantResolution = plan.dominant;
  const levels = plan.wanted.map((resolution) => _grids[resolution]);
  return settle(generation, levels.map((grid) => loadGrid(grid, snapped)), levels);
}

/**
 * Redraw the payloads ALREADY IN HAND under a new indicator.
 *
 * Not a refetch: the same cells carry every indicator at once, and the only
 * thing that changed is which column drives the colour and which count drives
 * the size. Asking the proxy again would buy the same bytes twice.
 *
 * @returns {boolean}
 */
function redrawForMetric() {
  if (!_viewer) return false;
  clearSelection();
  let redrawn = false;
  for (const grid of gridList()) {
    if (!grid.payload?.cells) continue;
    const vintage = grid.payload.vintage ?? FILOSOFI_VINTAGE;
    const { records, coldGround } = buildRecords(grid.payload.cells, grid.resolution, vintage);
    drawGrid(grid, records);
    grid.payload = { ...grid.payload, drawn: records.length, coldGround };
    redrawn = true;
  }
  return redrawn;
}

// ---------------------------------------------------------------------------
// The legend
// ---------------------------------------------------------------------------
/**
 * The two rows whose channel is SHAPE, drawn as the glyph they describe.
 *
 * Colour is the only channel a colour legend can explain, and this layer has
 * three. Without these rows the size of a disc — the population, the whole
 * denominator — is a thing the map states and the panel never mentions, and the
 * rings look like a rendering fault.
 */
const SHAPE_LEGEND_TINT = '#9ec8e0';
const svgGlyph = (body) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 13">${body}</svg>`,
)}`;
/** Three discs, small to large: the size channel, shown as itself. */
const SIZE_GLYPH = svgGlyph(
  '<circle cx="1.6" cy="10.4" r="1.6"/>'
  + '<circle cx="5.6" cy="9.4" r="2.6"/>'
  + '<circle cx="11.3" cy="8" r="4"/>',
);
/** A ring: an imputed cell, shown as itself. */
const HOLLOW_GLYPH = svgGlyph(
  '<path fill-rule="evenodd" d="M6.5 0.8a5.7 5.7 0 1 0 0 11.4a5.7 5.7 0 1 0 0-11.4z'
  + 'M6.5 3.65a2.85 2.85 0 1 1 0 5.7a2.85 2.85 0 1 1 0-5.7z"/>',
);

/**
 * The six bands, with the break that opens each and how many cells are in it.
 *
 * The break VALUES are on the legend rather than "faible / élevé", because the
 * whole claim of an absolute ramp is that the numbers travel with it.
 *
 * @param {object} metric
 * @param {Array<object>} cells
 * @returns {Array<object>}
 */
export function filosofiLegend(metric, cells = [], resolution = 200) {
  const breaks = FILOSOFI_RAMPS[metric.id === 'population' ? 'population' : metric.id];
  const counts = new Array(metric.ramp.length).fill(0);
  let unknown = 0;
  for (const cell of cells) {
    const band = metricBand(cell[metric.field], metric);
    if (band < 0) unknown += 1;
    else counts[band] += 1;
  }
  const m = messages().legend;
  const suffix = metric.unit.startsWith('%') ? m.percentSuffix : '';
  const legend = metric.ramp.map((color, index) => {
    const low = index === 0 ? null : breaks[index - 1];
    const high = index < breaks.length ? breaks[index] : null;
    const label = low === null
      ? m.below(_fmt(high), suffix)
      : high === null
        ? m.above(_fmt(low), suffix)
        : m.between(_fmt(low), _fmt(high), suffix);
    return {
      label,
      color,
      count: counts[index],
      blurb: index === 0
        ? m.lowDecile(metric.unit)
        : index === metric.ramp.length - 1
          ? m.highDecile(metric.unit)
          : `${metric.unit}`,
    };
  });
  if (unknown > 0) {
    legend.push({
      label: m.unpublished,
      color: '#4a5568',
      count: unknown,
      blurb: m.unpublishedBlurb,
    });
  }

  // The shape channels, after the colour ramp they qualify. Each carries the
  // count it is a legend FOR — the people the discs are sized on, and the
  // cells whose figures were modelled — so neither row is a caption without a
  // number.
  const weightField = metric.weight === 'men' ? 'men' : 'ind';
  let weightTotal = 0;
  let imputed = 0;
  for (const cell of cells) {
    if (Number.isFinite(cell?.[weightField])) weightTotal += cell[weightField];
    if (cell?.est === 1) imputed += 1;
  }
  // The class breaks, in words, because "six sizes" without the numbers is a
  // scale nobody can read back. Fine grid unless the payload says otherwise —
  // the legend is drawn before the first answer arrives.
  const sizeBreaks = (FILOSOFI_SIZE_BREAKS[resolution] || FILOSOFI_SIZE_BREAKS[200])[
    metric.weight === 'men' ? 'men' : 'ind'
  ];
  const words = messages().card;
  const unit = metric.weight === 'men' ? words.households : words.residents;
  const gridLabel = resolution === 1000 ? '1 km' : '200 m';
  legend.push({
    label: metric.weight === 'men' ? m.areaHouseholds : m.areaResidents,
    color: SHAPE_LEGEND_TINT,
    glyph: SIZE_GLYPH,
    count: Math.round(weightTotal),
    blurb: m.sizes(gridLabel, sizeBreaks.map((edge) => _fmt(edge)).join(' · '), unit),
  });
  if (imputed > 0) {
    legend.push({
      label: m.hollow,
      color: SHAPE_LEGEND_TINT,
      glyph: HOLLOW_GLYPH,
      count: imputed,
      blurb: m.hollowBlurb,
    });
  }
  return legend;
}

// ---------------------------------------------------------------------------
// The layer
// ---------------------------------------------------------------------------
const filosofiCarreauxLayer = {
  id: FILOSOFI_LAYER_ID,
  name: FILOSOFI_LAYER_NAME,
  icon: '▩',
  source: 'INSEE Filosofi (Géoplateforme)',
  updateInterval: UPDATE_INTERVAL_MS,

  init(viewer) {
    _viewer = viewer;
    _enabled = false;
    _grids = { 200: emptyGrid(200), 1000: emptyGrid(1000) };
    _dominantResolution = 200;
    _selectedId = null;
    _loading = false;
    _inflight = 0;
    _error = null;
    _status = 'idle';
    _lastUpdate = null;
    _retryDelayMs = 0;
    _metric = null;
    _regime = 'carreaux';
    _level = 'DEP';
    _territories = { DEP: emptyTerritory('DEP'), REG: emptyTerritory('REG') };
    _territoryMetric = null;
    _overlayHost.setVisible(FILOSOFI_SELECTED_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(TERRITORY_SELECTED_OVERLAY_SOURCE_ID, false);
    console.log('[Data:Carroyage INSEE] Initialized');
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    if (viewer) _viewer = viewer;
    // What was drawn before the layer was switched off comes back through the
    // fade, at the weight the camera gives it now.
    startFade();
    _overlayHost.setVisible(FILOSOFI_SELECTED_OVERLAY_SOURCE_ID, true);
    _overlayHost.setVisible(TERRITORY_SELECTED_OVERLAY_SOURCE_ID, true);
    installClickHandler(_viewer);
    registerPickOwner(FILOSOFI_LAYER_ID, (pickedId) => Boolean(findCellRecord(pickedId)));
    if (!_moveEndRemover && _viewer?.camera?.moveEnd) {
      _moveEndRemover = _viewer.camera.moveEnd.addEventListener(scheduleLoad);
    }
    // The manager calls update() immediately after enable(); no fetch here, or
    // the two race and one aborts the other.
  },

  disable() {
    _enabled = false;
    clearSelection();
    clearRetry();
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
    for (const grid of gridList()) dropPending(grid);
    for (const territory of territoryList()) {
      territory.abort?.abort();
      territory.abort = null;
    }
    stopFade();
    _overlayHost.setVisible(FILOSOFI_SELECTED_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(TERRITORY_SELECTED_OVERLAY_SOURCE_ID, false);
    if (_clickHandler) { _clickHandler.destroy(); _clickHandler = null; }
    if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeyDown);
    unregisterPickOwner(FILOSOFI_LAYER_ID);
    if (_moveEndRemover) { _moveEndRemover(); _moveEndRemover = null; }
    _loading = false;
    _inflight = 0;
    _status = 'idle';
  },

  // NO `ensureViewGate`, and its removal is the point. The layer used to fly
  // the camera down to a city when it was switched on from a national view,
  // because a wide box drew nothing. It now draws the country's départements
  // there, so moving the operator would be taking a decision away from them to
  // solve a problem that no longer exists. Zooming is how you ask for the grid.

  async update() {
    if (!_enabled) return false;
    for (const grid of gridList()) grid.loadedKey = null;
    for (const territory of territoryList()) territory.loadedKey = null;
    const loaded = await load();
    return loaded || !_error;
  },

  /**
   * Runtime params. `metric` recolours what is already drawn; it never refetches,
   * because every indicator arrived in the same answer.
   * @param {{metric?: string}} [params]
   * @returns {boolean} Whether anything was accepted.
   */
  setParams(params = {}) {
    if (params.metric === undefined) return false;
    // BOTH regimes are updated, always, whichever one is on screen. The chips
    // the operator can see belong to the regime they are in, but a share link
    // carries one id and the camera it restores decides which regime reads it —
    // so `niveau` has to mean the right thing on both sides of the threshold.
    const nextCarreau = resolveMetric(params.metric);
    const nextTerritory = resolveTerritoryMetric(params.metric);
    const changed = nextCarreau.id !== currentMetric().id
      || nextTerritory.id !== currentTerritoryMetric().id;
    if (!changed) return false;
    _metric = nextCarreau;
    _territoryMetric = nextTerritory;
    // Every level that is drawn is redrawn, not only the regime that owns the
    // row: during a swap or inside a band two of them are on screen, and the
    // one fading out must not keep the old colours.
    clearSelection();
    for (const territory of territoryList()) {
      if (territory.payload) drawTerritory(territory, territoryRecordsFor(territory));
    }
    redrawForMetric();
    _fade?.frame();
    governorRequestRender('filosofi-metric');
    return true;
  },

  /**
   * The runtime state a share link has to carry.
   *
   * Without this the manager has nothing to serialize and `lo=` comes back
   * empty: the link would restore the carroyage coloured by niveau de vie
   * whatever the sender was looking at, which is a different map with the same
   * cells. Measured in `scripts/qa-filosofi.mjs`, which reads the hash.
   * @returns {{metric: string}}
   */
  getParams() {
    // The regime on screen owns the answer: the national view has two
    // indicators the grid does not have at all, and serialising the carreau
    // chip while the operator is looking at Gini would share a different map.
    return { metric: _regime === 'territoires' ? currentTerritoryMetric().id : currentMetric().id };
  },

  /**
   * A carreau is not a contact. Nothing here moves, and a detection reticle over
   * every carreau in Paris would drown every layer that does.
   * @returns {Array}
   */
  getDetectableObjects() {
    return [];
  },

  setRowControlsListener(listener) {
    _rowControlsListener = typeof listener === 'function' ? listener : null;
  },

  getRowControls() {
    if (_regime === 'territoires') {
      const territory = rowTerritory();
      const records = [...territory.records.values()];
      return {
        chips: territoryChips(currentTerritoryMetric()),
        legend: territoryLegend(currentTerritoryMetric(), records, territory.level),
      };
    }
    const grid = rowGrid();
    const cells = grid.payload?.cells || [];
    const current = currentMetric();
    const row = messages().row;
    const chips = filosofiMetrics().map((metric) => ({
      id: metric.id,
      label: metric.short,
      active: current.id === metric.id,
      state: current.id === metric.id ? 'active' : 'idle',
      title: row.chipTitle(metric.label, metric.blurb, metric.unit),
      params: { metric: metric.id },
    }));
    return { chips, legend: filosofiLegend(current, cells, grid.payload?.resolution || grid.resolution) };
  },

  getStats() {
    if (_regime === 'territoires') {
      const shown = rowTerritory();
      const records = [...shown.records.values()];
      const stats = territoryStats(records, shown.level);
      const territory = currentTerritoryMetric();
      const result = {
        count: records.length,
        regime: 'territoires',
        level: shown.level,
        levelLabel: stats.levelLabel,
        cells: stats.territories,
        resolution: null,
        people: stats.people,
        niveau: stats.niveau,
        metric: territory.id,
        metricLabel: territory.label,
        // The year belongs to the number, and the two regimes disagree about
        // it. Publishing the vintage of the regime ON SCREEN is what stops the
        // panel from captioning a 2023 median with the grid's 2019.
        vintage: territory.year,
        vintages: TERRITORY_VINTAGE,
        scope: stats.scope,
        withoutFigures: stats.withoutFigures,
        lastUpdate: _lastUpdate,
        loading: _loading,
        status: _status === 'ready' ? 'ok' : _status,
        stale: Boolean(shown.payload?.stale),
        feedSource: messages().row.feedSource,
      };
      const row = messages().row;
      if (shown.payload?.partial) {
        result.degraded = true;
        result.loadingLabel = row.partial;
      } else if (_loading) {
        result.loadingLabel = row.loadingTerritories(stats.levelLabel.toLowerCase());
      } else if (records.length) {
        result.loadingLabel = row.territories(stats.levelLabel, TERRITORY_VINTAGE.filosofi);
      }
      if (_error) result.error = _error;
      return result;
    }
    const payload = rowGrid().payload;
    const summary = payload?.summary || null;
    const current = currentMetric();
    const row = messages().row;
    const result = {
      count: payload?.drawn ?? 0,
      cells: summary?.cells ?? 0,
      resolution: payload?.resolution ?? null,
      people: summary?.people ?? null,
      households: summary?.households ?? null,
      niveau: summary?.niveau ?? null,
      pauvrete: summary?.pauvrete ?? null,
      // The share of what is on screen that was modelled rather than observed.
      // Reported next to the totals, never below them: the totals are only as
      // good as this number.
      imputedCells: summary?.imputedCells ?? null,
      imputedShare: summary?.imputedShare ?? null,
      // A 0 % imputed share is only good news when nothing was left unsaid.
      imputedUnknown: summary?.imputedUnknown ?? null,
      truncated: Boolean(payload?.truncated),
      matched: payload?.matched ?? null,
      metric: current.id,
      metricLabel: current.label,
      regime: 'carreaux',
      // Whatever answered, not what the module was compiled believing.
      vintage: payload?.vintage ?? FILOSOFI_VINTAGE,
      vintageSource: payload?.source ?? null,
      rampSample: FILOSOFI_RAMP_SAMPLE.cells,
      lastUpdate: _lastUpdate,
      loading: _loading,
      status: _status === 'ready' ? 'ok' : _status,
      stale: Boolean(payload?.stale),
      feedSource: 'INSEE Filosofi — Licence Ouverte 2.0',
    };
    if (payload?.truncated) {
      result.degraded = true;
      result.loadingLabel = row.truncated(_fmt(payload.matched), _fmt(payload.returned));
    } else if (_status === 'off-coverage') {
      result.status = 'ok';
      result.loadingLabel = row.offCoverage;
    } else if (_loading) {
      result.loadingLabel = row.loadingCells;
    }
    if (_error) result.error = _error;
    return result;
  },

  destroy(viewer) {
    if (_enabled) this.disable(viewer);
    else {
      clearSelection();
      if (_clickHandler) { _clickHandler.destroy(); _clickHandler = null; }
      if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeyDown);
      unregisterPickOwner(FILOSOFI_LAYER_ID);
    }
    if (_moveEndRemover) { _moveEndRemover(); _moveEndRemover = null; }
    clearRetry();
    stopFade();
    clearGrids();
    clearTerritories();
    _viewer = null;
  },
};

/** Seed drawn state so selection, card and legend paths run without WebGL. */
export function _setFilosofiStateForTest({
  viewer, records, payload, overlayHost, metric, enabled = true,
} = {}) {
  _viewer = viewer || null;
  // One grid at a time, the one the payload (or the first record) is on; the
  // other is emptied so a seeded state is exactly what the test says it is.
  const seeded = records instanceof Map ? [...records.values()] : Object.values(records || {});
  const resolution = payload?.resolution ?? seeded[0]?.resolution ?? 200;
  if (records || payload !== undefined) {
    _dominantResolution = resolution;
    const other = _grids[resolution === 200 ? 1000 : 200];
    other.records = new Map();
    other.payload = null;
  }
  const grid = _grids[resolution];
  if (records) grid.records = records instanceof Map ? records : new Map(Object.entries(records));
  if (payload !== undefined) grid.payload = payload;
  _overlayHost = overlayHost || DEFAULT_OVERLAY_HOST;
  if (metric) _metric = resolveMetric(metric);
  _enabled = enabled;
  _selectedId = null;
  _status = 'ready';
}

/** @returns {?string} */
export function _filosofiSelectedIdForTest() {
  return _selectedId;
}

export function _selectFilosofiCellForTest(id) {
  return selectCell(id);
}

export function _clearFilosofiSelectionForTest() {
  clearSelection();
}

export function _filosofiRowControlsForTest() {
  return filosofiCarreauxLayer.getRowControls();
}

export function _filosofiStatsForTest() {
  return filosofiCarreauxLayer.getStats();
}

export function _filosofiSetParamsForTest(params) {
  return filosofiCarreauxLayer.setParams(params);
}

export function _filosofiMetricForTest() {
  return currentMetric();
}

export default filosofiCarreauxLayer;
