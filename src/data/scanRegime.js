/**
 * When a point-centred French scan stops drawing points and starts drawing
 * cells, and the box it asks about when it does.
 *
 * WHY THIS EXISTS. `addressScanLayer.js` asks the register about a DISC around
 * the point the camera is looking at — 300 m for DVF, 200 m for the DPE. That
 * is the right question at street level and the wrong one from a thousand
 * metres up, where the disc covers a few percent of what is on screen and the
 * answer reads as a patch of confetti in the middle of an empty city. Measured
 * on the view that prompted this module: 0.28 km² scanned against ~5 km²
 * visible, 6 %.
 *
 * THE FIX IS NOT MORE DOTS. Widening the disc to the view was measured too —
 * ~3 000 mutations and ~12 000 diagnostics for one Lyon viewport, 10 MB of
 * rows — and it buys nothing a reader can use: three thousand € markers carry
 * the same information as four hundred, made unreadable. The question changes
 * with the altitude. "What did THIS building sell for" is only askable close
 * in; from higher up the question is "which block is dear", and that is a
 * different mark: one symbol per cell, not one per sale.
 *
 * So each layer runs two regimes and this module owns the switch:
 *
 *   - below {@link SCAN_CELL_MIN_ALTITUDE_M}, the disc, unchanged;
 *   - above it, a grid-aligned BOX, aggregated into cells by the proxy.
 *
 * THE BOX IS BUILT FROM THE LOOK-AT POINT, NEVER FROM `computeViewRectangle`.
 * That is the lesson `cadastreFeed.js` and `urbanismeGpu.js` both paid for: on
 * the oblique camera this globe opens with, the view rectangle runs to the
 * horizon, so a box cut from it is tens of kilometres deep and centred
 * nowhere near what the reader is looking at. Gating on ALTITUDE and centring
 * on the look-at point is the same arithmetic those two layers settled on.
 *
 * THE BOX SNAPS TO A GRID, and that is what makes panning free. A box derived
 * continuously from the camera moves with every settle, so every settle is a
 * new cache key and a new round trip. Snapped to the band's tile, a reader
 * panning a few streets asks the identical question and `runScan`'s own
 * signature guard answers it from what is already drawn.
 *
 * Dependency-free and side-effect-free — no Cesium, no DOM — so the layers,
 * the Vite proxy and `node --test` all read the same box arithmetic.
 *
 * @module data/scanRegime
 */

/**
 * Altitude at which a scan stops being about a place and starts being about an
 * area, in metres.
 *
 * 600 m, because that is where the disc stops covering the view. A nadir camera
 * at 600 m sees about 700 m of ground across the short side, which the 300 m
 * DVF disc fills; at 1 300 m — the altitude this globe lands on after a flight
 * to an address — it sees some 5 km² and the disc covers 6 % of it.
 *
 * Below this the reader can point at a building and expects one sale, one
 * diagnostic, one parcel. Above it they cannot resolve a building at all, and
 * a mark per sale is ink spent on a distinction the screen cannot carry.
 */
export const SCAN_CELL_MIN_ALTITUDE_M = 600;

/**
 * The two cell bands, and why there are exactly two.
 *
 * `tileDeg` is the unit the box is built and cached in; a box is always TWO
 * tiles on each axis, so a scan is always four tiles whatever the band. That
 * constant is deliberate: it fixes the upstream cost of a camera settle at
 * eight requests (two per tile for the DPE — see `dpeFeed.js`) instead of
 * letting it grow with altitude.
 *
 * `dvfUnit` is the shape the DVF proxy draws a box's sales on, and since
 * 2026-09-21 it is the cadastre's own, not a grid: the PLOTS the sales name on
 * the fine band, their cadastral SECTIONS on the coarse one — see
 * `dvfFeed.aggregateSalesIntoPlots` for the measurement that put the switch
 * here. The DPE keeps its cells, whose size the ADEME's `geo_agg` picks from
 * the span of the box (geohash precision 7, ~107 × 152 m, for a 0.01° tile;
 * precision 6, ~853 × 607 m, for a 0.04° one — measured 2026-09-14 at Lyon).
 *
 * `maxAltitudeM` is the top of the band, not of the layer: the layer's own
 * ceiling (12 km for both) still applies above the last band.
 */
export const SCAN_BANDS = Object.freeze([
  Object.freeze({ id: 'fine', maxAltitudeM: 1_800, tileDeg: 0.01, dvfUnit: 'plots' }),
  Object.freeze({ id: 'coarse', maxAltitudeM: Infinity, tileDeg: 0.04, dvfUnit: 'sections' }),
]);

/** Every tile span a box may legitimately be built from. */
const TILE_DEGS = Object.freeze(SCAN_BANDS.map((band) => band.tileDeg));

/**
 * THE BAND IN WHICH THE PLOTS AND THE SECTIONS ARE BOTH DRAWN (2026-10-01), in
 * metres of camera altitude — the unit {@link scanBandFor} reads.
 *
 * Until then a zoom across 1 800 m swapped one wash for the other on a hard
 * cut, and the swap read as the map reloading. Both are the same statistic at
 * two resolutions, so they fade into each other between the two ends below
 * (`zoomFade.js`). For the price layer a plot wears its latest sale's ratio to
 * its own commune's median, a section the MEDIAN of the same ratios over its
 * sales — the same rows (`dvfFeed.areaInputs`), the same denominators, the
 * same five frozen classes; the section's floor of three priced sales paints
 * the rest neutral, which is the honest colour of a median not computed. For
 * the energy layer a parcel and a section both wear the most frequent letter
 * of the ratings they hold, on the official A–G scale; the section counts the
 * register's 50 m squares lying wholly inside it, and painted the same letter
 * as the exact placement on every section measured (14 of 14, `dpeFeed.js`).
 *
 * `coarse` is the fine band's top — where the plots start loading today — so
 * their box, their tiles and their caps are unchanged. `fine` is 0.6 of it:
 * 1 080 m, a ratio of 1.67. The sections are therefore asked for down to
 * 1 080 m, which costs the same question they answer at 1 800 m — the same
 * 0.08° box, snapped to the same 0.04° grid, so a pan inside a tile asks
 * nothing new — and for the energy layer fewer tiles, since only those on
 * screen are asked for and the screen is smaller.
 *
 * Plain numbers rather than a `zoomFade.fadeBand`, because this module stays
 * free of Cesium for the proxy's sake; the layers wrap it.
 */
export const SCAN_SECTION_FADE = Object.freeze({
  fine: SCAN_BANDS[0].maxAltitudeM * 0.6,
  coarse: SCAN_BANDS[0].maxAltitudeM,
});

/**
 * Which area levels a settled camera draws: the plots in the fine band, the
 * sections above the fade band's fine end — both inside it — and neither for
 * the disc regime or a pinned scan, which is a disc whatever the altitude.
 *
 * THE 600 m SWITCH IS NOT A FADE, and stays the cut it was: below it the disc
 * answers a different QUESTION — the sales or diagnostics within 300 m or
 * 200 m of one point, capped at 400 sales or 200 ratings and drawn one mark
 * each — while the plots answer a 2 × 2 km box, uncapped, one wash per plot.
 * The colour is the same; the samples are not, and fading one into the other
 * would blend a capped disc into an uncapped box as if one were a coarser
 * reading of the other.
 *
 * @param {?{altitudeM: number, pinned?: boolean}} point
 * @returns {{fine: boolean, coarse: boolean}}
 */
export function scanAreaLevelsAt(point) {
  if (point?.pinned) return { fine: false, coarse: false };
  const altitudeM = Number(point?.altitudeM);
  if (!Number.isFinite(altitudeM) || altitudeM < SCAN_CELL_MIN_ALTITUDE_M) return { fine: false, coarse: false };
  return {
    fine: altitudeM < SCAN_SECTION_FADE.coarse,
    coarse: altitudeM > SCAN_SECTION_FADE.fine,
  };
}

/**
 * The point a coarse-band question is asked from: the same place, lifted to
 * the coarse band's floor, so the layers' own `params` build the section box
 * (and the energy layer its tile mask) exactly as they do above 1 800 m.
 * @param {{lat: number, lon: number, altitudeM: number}} point
 * @returns {object}
 */
export function scanCoarsePoint(point) {
  return { ...point, altitudeM: Math.max(Number(point?.altitudeM) || 0, SCAN_SECTION_FADE.coarse) };
}

/**
 * The band a camera altitude falls in, or null when the scan stays a disc.
 *
 * A PINNED scan is always a disc, whatever the altitude, and that is not an
 * exception to the rule — it is the rule. The pin exists because the reader
 * pointed at ONE address and asked about it; answering with a field of cells
 * would discard the only thing they said.
 *
 * @param {?{altitudeM: number, pinned?: boolean}} point
 * @returns {?{id: string, tileDeg: number, dvfUnit: string}}
 */
export function scanBandFor(point) {
  if (point?.pinned) return null;
  const altitudeM = Number(point?.altitudeM);
  if (!Number.isFinite(altitudeM) || altitudeM < SCAN_CELL_MIN_ALTITUDE_M) return null;
  return SCAN_BANDS.find((band) => altitudeM < band.maxAltitudeM) || null;
}

/**
 * The grid-aligned box a cell scan asks about: two tiles on each axis, centred
 * on the tile line nearest the look-at point.
 *
 * ROUNDED TO THE NEAREST LINE RATHER THAN FLOORED, so the point sits within
 * half a tile of the middle of its own box. Flooring would put it in the
 * bottom-left quadrant and give the reader a box that reaches a tile and a half
 * north of what they are looking at and half a tile south of it.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} tileDeg
 * @returns {?{south: number, west: number, north: number, east: number}}
 */
export function scanCellBox(lat, lon, tileDeg) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!Number.isFinite(tileDeg) || tileDeg <= 0) return null;
  const line = (value) => Number((Math.round(value / tileDeg) * tileDeg).toFixed(6));
  const latLine = line(lat);
  const lonLine = line(lon);
  const box = {
    south: Number((latLine - tileDeg).toFixed(6)),
    west: Number((lonLine - tileDeg).toFixed(6)),
    north: Number((latLine + tileDeg).toFixed(6)),
    east: Number((lonLine + tileDeg).toFixed(6)),
  };
  // A box straddling a pole or the dateline is not a small request, it is a
  // broken one — and neither register publishes anything there.
  if (box.south < -90 || box.north > 90 || box.west < -180 || box.east > 180) return null;
  return box;
}

/**
 * The four tiles a box is made of, in a stable order.
 *
 * Stable because the order is the cache's: two readers arriving at the same
 * block from different directions must queue on the same four keys, not on
 * eight.
 *
 * @param {{south: number, west: number, north: number, east: number}} box
 * @param {number} tileDeg
 * @returns {Array<{south: number, west: number, north: number, east: number}>}
 */
export function scanTiles(box, tileDeg) {
  const tiles = [];
  const steps = Math.max(1, Math.round((box.north - box.south) / tileDeg));
  const cols = Math.max(1, Math.round((box.east - box.west) / tileDeg));
  for (let row = 0; row < steps; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push({
        south: Number((box.south + (row * tileDeg)).toFixed(6)),
        west: Number((box.west + (col * tileDeg)).toFixed(6)),
        north: Number((box.south + ((row + 1) * tileDeg)).toFixed(6)),
        east: Number((box.west + ((col + 1) * tileDeg)).toFixed(6)),
      });
    }
  }
  return tiles;
}

/**
 * The query parameters for one scan: the box when the camera is high enough to
 * want cells, nothing when it is not.
 *
 * An ABSENT box IS the disc regime, server-side — the same contract
 * `urbanismeGpu.js` uses, and for the same reason: one route, one cache, and a
 * proxy that never has to be told which of two questions it is being asked.
 *
 * @param {?{lat: number, lon: number, altitudeM: number, pinned?: boolean}} point
 * @returns {Record<string, string>}
 */
export function scanCellParams(point) {
  const band = scanBandFor(point);
  if (!band) return {};
  const box = scanCellBox(point.lat, point.lon, band.tileDeg);
  if (!box) return {};
  return {
    south: box.south.toFixed(6),
    west: box.west.toFixed(6),
    north: box.north.toFixed(6),
    east: box.east.toFixed(6),
  };
}

/**
 * Read a box back off a request, and the band it was cut from.
 *
 * VALIDATED, NEVER CLAMPED. Everything here is reachable from a share link, so
 * a span that matches no band is a stranger's URL asking this server to
 * aggregate an arbitrary slab of France. There are two legal spans and a box
 * that is neither is refused, which drops the request back to the disc regime
 * rather than serving a question nobody designed.
 *
 * @param {URLSearchParams} search
 * @returns {?{box: object, band: object}}
 */
export function readScanCellBox(search) {
  const south = Number(search.get('south'));
  const west = Number(search.get('west'));
  const north = Number(search.get('north'));
  const east = Number(search.get('east'));
  if (![south, west, north, east].every(Number.isFinite)) return null;
  if (south >= north || west >= east) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  const spanLat = north - south;
  const spanLon = east - west;
  const tileDeg = TILE_DEGS.find((deg) => Math.abs(spanLat - (deg * 2)) < 1e-6
    && Math.abs(spanLon - (deg * 2)) < 1e-6);
  if (!tileDeg) return null;
  const band = SCAN_BANDS.find((entry) => entry.tileDeg === tileDeg) || null;
  if (!band) return null;
  return { box: { south, west, north, east }, band };
}

/**
 * How close to the screen's ground a tile may lie and still be loaded, in
 * degrees — about a hundred metres. « Ne charge que ce qui est dans la vue, et
 * à la limite vraiment très proche de la vue » (2026-09-22): the margin covers
 * the few metres between the ellipsoid rectangle Cesium reports and the
 * terrain the reader sees, and nothing more.
 */
export const SCAN_VIEW_MARGIN_DEG = 0.001;

/**
 * Which of a box's tiles the screen shows: a mask, one boolean per tile in
 * {@link scanTiles} order, or null when the view is unknown (every tile, as
 * before this existed).
 *
 * A BOX IS FOUR TILES WHATEVER THE SCREEN SHOWS, and from 700 m over a street
 * the screen shows one or two of them. Each tile the layer loads is a request
 * to a register that answers in 0.2 s to 11 s (the DPE's, measured), so the
 * tiles off screen are dropped from the question rather than fetched for a
 * pan that may never come.
 *
 * The view is `viewGate.cameraViewBox` — the camera's rectangle on the
 * ellipsoid, which on a tilted camera runs to the horizon. That is harmless
 * here, and it is why this may use it where the box itself may not: the box is
 * still built from the look-at point and still caps the question at four
 * tiles; the rectangle only ever REMOVES tiles from it, and a tile at the top
 * of a tilted screen is on screen.
 *
 * @param {{south: number, west: number, north: number, east: number}} box
 * @param {number} tileDeg
 * @param {?{south: number, west: number, north: number, east: number}} view
 * @param {number} [marginDeg]
 * @returns {?boolean[]}
 */
export function scanTileMask(box, tileDeg, view, marginDeg = SCAN_VIEW_MARGIN_DEG) {
  if (!box || !view || ![view.south, view.west, view.north, view.east].every(Number.isFinite)) return null;
  const mask = scanTiles(box, tileDeg).map((tile) => tile.south <= view.north + marginDeg
    && tile.north >= view.south - marginDeg
    && tile.west <= view.east + marginDeg
    && tile.east >= view.west - marginDeg);
  // A view that misses the whole box is a camera looking elsewhere than its
  // own centre — a moment mid-flight — and asking for nothing would draw an
  // empty box; the box is asked for whole instead.
  return mask.some(Boolean) ? mask : null;
}

/**
 * The `tiles` query parameter for a mask — `'1010'` — or null when every tile
 * is asked for, so a whole box keeps the query string it always had.
 * @param {?boolean[]} mask @returns {?string}
 */
export function scanTileMaskParam(mask) {
  if (!Array.isArray(mask) || mask.every(Boolean)) return null;
  return mask.map((on) => (on ? '1' : '0')).join('');
}

/**
 * Read the mask back off a request. Anything but a string of `0` and `1` of
 * the box's own tile count, with at least one `1`, is the WHOLE box: a mask can
 * only take tiles away from a question already validated, so a bad one is
 * answered with the question it narrowed, never with a different one.
 * @param {URLSearchParams} search
 * @param {object} box @param {{tileDeg: number}} band
 * @returns {boolean[]}
 */
export function readScanTileMask(search, box, band) {
  const count = scanTiles(box, band.tileDeg).length;
  const raw = String(search?.get?.('tiles') ?? '');
  if (raw.length !== count || !/^[01]+$/.test(raw) || !raw.includes('1')) {
    return Array.from({ length: count }, () => true);
  }
  return [...raw].map((digit) => digit === '1');
}

/**
 * The bounding box of some tiles — what an answer covering only part of its
 * box actually loaded.
 * @param {Array<{south: number, west: number, north: number, east: number}>} tiles
 * @returns {?{south: number, west: number, north: number, east: number}}
 */
export function scanTilesBox(tiles) {
  if (!Array.isArray(tiles) || !tiles.length) return null;
  return {
    south: Math.min(...tiles.map((tile) => tile.south)),
    west: Math.min(...tiles.map((tile) => tile.west)),
    north: Math.max(...tiles.map((tile) => tile.north)),
    east: Math.max(...tiles.map((tile) => tile.east)),
  };
}

/**
 * The ring of tiles around some tiles: every tile touching one of them, edge
 * or corner, that is not one of them — up to twelve around a 2 × 2 view —
 * nearest the reader's point first.
 *
 * WHAT IT IS FOR: the tiles a reader reaches by moving about a kilometre,
 * which the proxy loads in the background once the view is drawn (see the
 * DPE route). The ring is on the SAME grid as the tiles, so a tile loaded
 * ahead is the very tile a later box will ask for, byte for byte.
 *
 * @param {Array<{south: number, west: number, north: number, east: number}>} tiles
 * @param {number} tileDeg
 * @param {?{lat: number, lon: number}} [centre]
 * @returns {Array<{south: number, west: number, north: number, east: number}>}
 */
export function scanTileRing(tiles, tileDeg, centre = null) {
  if (!Array.isArray(tiles) || !tiles.length || !(tileDeg > 0)) return [];
  const round = (value) => Number(value.toFixed(6));
  const keyOf = (tile) => `${tile.south.toFixed(6)},${tile.west.toFixed(6)}`;
  const own = new Set(tiles.map(keyOf));
  const ring = new Map();
  for (const tile of tiles) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const south = round(tile.south + (dy * tileDeg));
        const west = round(tile.west + (dx * tileDeg));
        const next = { south, west, north: round(south + tileDeg), east: round(west + tileDeg) };
        if (next.south < -90 || next.north > 90 || next.west < -180 || next.east > 180) continue;
        const key = keyOf(next);
        if (!own.has(key) && !ring.has(key)) ring.set(key, next);
      }
    }
  }
  const out = [...ring.values()];
  if (centre && Number.isFinite(centre.lat) && Number.isFinite(centre.lon)) {
    const far = (tile) => Math.hypot(((tile.south + tile.north) / 2) - centre.lat,
      (((tile.west + tile.east) / 2) - centre.lon) * Math.cos((centre.lat * Math.PI) / 180));
    out.sort((a, b) => far(a) - far(b));
  }
  return out;
}

/**
 * A stable cache key for a box, at the precision the grid is snapped to.
 * @param {{south: number, west: number, north: number, east: number}} box
 * @returns {string}
 */
export function scanBoxKey(box) {
  return [box.south, box.west, box.north, box.east].map((v) => v.toFixed(4)).join(',');
}

/**
 * Points to ask "which commune is this?" about, to discover every commune a
 * box touches.
 *
 * WHY SAMPLING AND NOT A BOUNDARY QUERY. The commune a DVF edition is filed
 * under is the ARRONDISSEMENT for Paris, Lyon and Marseille — 75113, not 75056
 * — and the only French service that answers with that code is the BAN reverse
 * geocoder, which takes a point. `geo.api.gouv.fr`, which does serve contours,
 * answers 75056 for every Paris point and would send the proxy after an edition
 * that does not exist. So the box is probed rather than intersected.
 *
 * WHAT THAT COSTS IN HONESTY, stated rather than hidden: a commune whose
 * territory inside the box contains no sample point contributes nothing, and
 * its ground is then empty for the same reason a field is — no cell. The caller
 * publishes the sampled list so the gap is readable instead of inferred.
 *
 * Sampled at CELL CENTRES on an odd grid, so the middle of the box — the thing
 * the reader is actually looking at — is always probed.
 *
 * @param {{south: number, west: number, north: number, east: number}} box
 * @param {number} [maxPerAxis]
 * @returns {Array<{lat: number, lon: number}>}
 */
export function boxSamplePoints(box, maxPerAxis = 5) {
  const span = Math.max(box.north - box.south, box.east - box.west);
  // One probe per ~1.1 km, which is about the width of the smallest band's
  // tile, bounded at both ends: three is the fewest that puts a point in the
  // middle and one in each half, and `maxPerAxis` caps what a big box can spend
  // on reverse geocoding.
  const perAxis = Math.min(maxPerAxis, Math.max(3, Math.ceil(span / 0.01)));
  const odd = perAxis % 2 ? perAxis : perAxis + 1;
  const points = [];
  for (let row = 0; row < odd; row += 1) {
    for (let col = 0; col < odd; col += 1) {
      points.push({
        lat: box.south + (((row + 0.5) / odd) * (box.north - box.south)),
        lon: box.west + (((col + 0.5) / odd) * (box.east - box.west)),
      });
    }
  }
  return points;
}
