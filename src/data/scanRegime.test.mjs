// src/data/scanRegime.test.mjs
// The switch between "one mark per sale" and "one mark per patch of ground",
// and the box arithmetic behind it. Everything here is pure, and the one
// property that matters most is the one a reader FEELS rather than sees: two
// camera positions inside the same tile must produce the identical box, or
// panning a street re-asks a question whose answer is already on screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCAN_BANDS,
  SCAN_CELL_MIN_ALTITUDE_M,
  SCAN_SECTION_FADE,
  scanAreaLevelsAt,
  scanCoarsePoint,
  boxSamplePoints,
  readScanCellBox,
  readScanTileMask,
  scanBandFor,
  scanBoxKey,
  scanCellBox,
  scanCellParams,
  scanTileMask,
  scanTileMaskParam,
  scanTileRing,
  scanTiles,
  scanTilesBox,
} from './scanRegime.js';

test('below the switch the scan stays a disc', () => {
  assert.equal(scanBandFor({ altitudeM: SCAN_CELL_MIN_ALTITUDE_M - 1 }), null);
  assert.deepEqual(scanCellParams({ lat: 45.77, lon: 4.85, altitudeM: 120 }), {});
});

test('a pin is always a disc, however high the camera', () => {
  const point = { lat: 45.77, lon: 4.85, altitudeM: 9_000, pinned: true };
  assert.equal(scanBandFor(point), null);
  assert.deepEqual(scanCellParams(point), {});
});

test('the bands are ordered and cover every altitude above the switch', () => {
  assert.equal(scanBandFor({ altitudeM: 1_322 }).id, 'fine');
  assert.equal(scanBandFor({ altitudeM: 1_799 }).id, 'fine');
  assert.equal(scanBandFor({ altitudeM: 1_800 }).id, 'coarse');
  assert.equal(scanBandFor({ altitudeM: 11_000 }).id, 'coarse');
  for (const band of SCAN_BANDS) {
    assert.ok(band.tileDeg > 0 && ['plots', 'sections'].includes(band.dvfUnit));
  }
});

test('the box is two tiles on each axis, whatever the band', () => {
  for (const band of SCAN_BANDS) {
    const box = scanCellBox(45.7753, 4.8497, band.tileDeg);
    assert.ok(Math.abs((box.north - box.south) - (band.tileDeg * 2)) < 1e-9);
    assert.ok(Math.abs((box.east - box.west) - (band.tileDeg * 2)) < 1e-9);
    assert.equal(scanTiles(box, band.tileDeg).length, 4);
  }
});

test('two points in the same tile ask the identical question', () => {
  // 45.7753 and 45.7769 both round to the 45.78 line at 0.01°; the boxes must
  // be byte-identical, because the shell compares the query string.
  const a = scanCellParams({ lat: 45.7753, lon: 4.8497, altitudeM: 1_322 });
  const b = scanCellParams({ lat: 45.7769, lon: 4.8531, altitudeM: 1_100 });
  assert.deepEqual(a, b);
  assert.equal(scanBoxKey(readScanCellBox(new URLSearchParams(a)).box),
    scanBoxKey(readScanCellBox(new URLSearchParams(b)).box));
});

test('the look-at point is never more than half a tile off centre', () => {
  const { tileDeg } = SCAN_BANDS[0];
  for (const offset of [0, 0.0021, 0.0049, 0.0051, 0.0099]) {
    const lat = 45.77 + offset;
    const box = scanCellBox(lat, 4.85, tileDeg);
    const middle = (box.north + box.south) / 2;
    assert.ok(Math.abs(lat - middle) <= (tileDeg / 2) + 1e-9,
      `${lat} sat ${Math.abs(lat - middle)} from the middle`);
  }
});

test('the tiles tile the box exactly, with no gap and no overlap', () => {
  const band = SCAN_BANDS[0];
  const box = scanCellBox(45.7753, 4.8497, band.tileDeg);
  const tiles = scanTiles(box, band.tileDeg);
  const area = (b) => (b.north - b.south) * (b.east - b.west);
  const sum = tiles.reduce((total, tile) => total + area(tile), 0);
  assert.ok(Math.abs(sum - area(box)) < 1e-12);
  for (const tile of tiles) {
    assert.ok(tile.south >= box.south - 1e-9 && tile.north <= box.north + 1e-9);
    assert.ok(tile.west >= box.west - 1e-9 && tile.east <= box.east + 1e-9);
  }
});

test('a span matching no band is refused rather than clamped', () => {
  // Everything here is reachable from a share link, so an arbitrary slab of
  // France must drop back to the disc regime instead of being served.
  const hostile = new URLSearchParams({
    south: '42.000000', west: '0.000000', north: '51.000000', east: '8.000000',
  });
  assert.equal(readScanCellBox(hostile), null);
  const nearlyRight = new URLSearchParams({
    south: '45.760000', west: '4.840000', north: '45.783000', east: '4.860000',
  });
  assert.equal(readScanCellBox(nearlyRight), null);
});

test('an inverted or out-of-globe box is refused', () => {
  assert.equal(readScanCellBox(new URLSearchParams({
    south: '45.780000', west: '4.840000', north: '45.760000', east: '4.860000',
  })), null);
  assert.equal(readScanCellBox(new URLSearchParams({
    south: '89.990000', west: '4.840000', north: '90.010000', east: '4.860000',
  })), null);
});

test('a legal box round-trips to its band', () => {
  const params = scanCellParams({ lat: 45.7753, lon: 4.8497, altitudeM: 1_322 });
  const read = readScanCellBox(new URLSearchParams(params));
  assert.equal(read.band.id, 'fine');
  assert.equal(read.box.south.toFixed(6), params.south);
});

test('the probe grid is odd, so the middle of the box is always sampled', () => {
  for (const band of SCAN_BANDS) {
    const box = scanCellBox(45.7753, 4.8497, band.tileDeg);
    const points = boxSamplePoints(box);
    const side = Math.sqrt(points.length);
    assert.equal(side % 1, 0);
    assert.equal(side % 2, 1, 'the grid must be odd');
    const middle = points[(points.length - 1) / 2];
    assert.ok(Math.abs(middle.lat - ((box.north + box.south) / 2)) < 1e-9);
    assert.ok(Math.abs(middle.lon - ((box.east + box.west) / 2)) < 1e-9);
    for (const point of points) {
      assert.ok(point.lat > box.south && point.lat < box.north);
      assert.ok(point.lon > box.west && point.lon < box.east);
    }
  }
});

test('a bigger box is probed more densely, up to the cap', () => {
  const fine = boxSamplePoints(scanCellBox(45.77, 4.85, 0.01));
  const coarse = boxSamplePoints(scanCellBox(45.77, 4.85, 0.04));
  assert.equal(fine.length, 9);
  assert.ok(coarse.length > fine.length);
  assert.ok(coarse.length <= 25, 'the cap bounds what one box spends on the BAN');
});

// ── only the tiles on screen (2026-09-22) ──────────────────────────────────
test('a box keeps only the tiles the view touches, in scanTiles order', () => {
  const box = { south: 45.75, west: 4.82, north: 45.77, east: 4.84 };
  // A view over the north-east quarter only, well clear of the margin.
  const view = { south: 45.763, west: 4.833, north: 45.769, east: 4.839 };
  assert.deepEqual(scanTileMask(box, 0.01, view), [false, false, false, true]);
  assert.equal(scanTileMaskParam(scanTileMask(box, 0.01, view)), '0001');
  // Within ~100 m of the line, the neighbour comes too — and no further.
  const nearLine = { ...view, west: 4.8305 };
  assert.deepEqual(scanTileMask(box, 0.01, nearLine), [false, false, true, true]);
});

test('a view that covers the box, or is unknown, asks for the whole box', () => {
  const box = { south: 45.75, west: 4.82, north: 45.77, east: 4.84 };
  const wide = { south: 45.7, west: 4.7, north: 45.9, east: 4.9 };
  assert.equal(scanTileMaskParam(scanTileMask(box, 0.01, wide)), null);
  assert.equal(scanTileMask(box, 0.01, null), null);
  // A camera looking elsewhere mid-flight: nothing to narrow to, whole box.
  assert.equal(scanTileMask(box, 0.01, { south: 10, west: 10, north: 11, east: 11 }), null);
});

test('a mask read off a request can only narrow the box, never widen it', () => {
  const box = { south: 45.75, west: 4.82, north: 45.77, east: 4.84 };
  const band = { tileDeg: 0.01 };
  const read = (tiles) => readScanTileMask(new URLSearchParams(tiles === null ? {} : { tiles }), box, band);
  assert.deepEqual(read('1010'), [true, false, true, false]);
  for (const bad of [null, '', '0000', '10', '10101', '1x10']) {
    assert.deepEqual(read(bad), [true, true, true, true], String(bad));
  }
});

test('the box of the tiles loaded is what the answer describes', () => {
  const box = { south: 45.75, west: 4.82, north: 45.77, east: 4.84 };
  const tiles = scanTiles(box, 0.01).filter((tile, index) => [false, true, false, true][index]);
  assert.deepEqual(scanTilesBox(tiles), { south: 45.75, west: 4.83, north: 45.77, east: 4.84 });
  assert.equal(scanTilesBox([]), null);
});

test('the ring around a 2 × 2 view is its twelve neighbours, nearest first', () => {
  const box = { south: 45.75, west: 4.82, north: 45.77, east: 4.84 };
  const tiles = scanTiles(box, 0.01);
  const ring = scanTileRing(tiles, 0.01, { lat: 45.7605, lon: 4.8395 });
  assert.equal(ring.length, 12);
  // None of the view's own tiles, and every one on the same grid.
  for (const tile of ring) {
    assert.ok(!tiles.some((own) => own.south === tile.south && own.west === tile.west));
    assert.equal(Number((tile.north - tile.south).toFixed(6)), 0.01);
  }
  // The reader stands near the east edge: the first tile is east of the box.
  assert.equal(ring[0].west, 4.84);
  // A single tile has eight neighbours; nothing, nothing.
  assert.equal(scanTileRing(tiles.slice(0, 1), 0.01).length, 8);
  assert.deepEqual(scanTileRing([], 0.01), []);
});

// --- Fade on zoom: plots and sections ----------------------------------------
//
// The 1 800 m switch became a band: the plots and the sections are both drawn
// between 1 080 m and 1 800 m and fade into each other (`scanAreaFade.js`).
// The 600 m switch to the disc stays a cut.

test('the plots-sections band ends where the plots start loading, and starts at 0.6 of it', () => {
  assert.equal(SCAN_SECTION_FADE.coarse, SCAN_BANDS[0].maxAltitudeM, 'the plots are asked for exactly where they were');
  assert.equal(SCAN_SECTION_FADE.fine, 1_080);
  const ratio = SCAN_SECTION_FADE.coarse / SCAN_SECTION_FADE.fine;
  assert.ok(ratio >= 1.5 && ratio <= 2, `coarse/fine ${ratio}`);
  assert.ok(SCAN_SECTION_FADE.fine > SCAN_CELL_MIN_ALTITUDE_M, 'the band never reaches the disc');
});

test('a settled view in the band draws both levels, and outside it only its own', () => {
  assert.deepEqual(scanAreaLevelsAt({ altitudeM: 400 }), { fine: false, coarse: false }, 'the disc');
  assert.deepEqual(scanAreaLevelsAt({ altitudeM: 900 }), { fine: true, coarse: false });
  assert.deepEqual(scanAreaLevelsAt({ altitudeM: 1_080 }), { fine: true, coarse: false }, 'nothing of the sections at the fine end');
  assert.deepEqual(scanAreaLevelsAt({ altitudeM: 1_400 }), { fine: true, coarse: true });
  assert.deepEqual(scanAreaLevelsAt({ altitudeM: 1_800 }), { fine: false, coarse: true });
  assert.deepEqual(scanAreaLevelsAt({ altitudeM: 9_000 }), { fine: false, coarse: true });
  assert.deepEqual(scanAreaLevelsAt({ altitudeM: 1_400, pinned: true }), { fine: false, coarse: false }, 'a pin is a disc');
  assert.deepEqual(scanAreaLevelsAt(null), { fine: false, coarse: false });
});

test('the sections kept down to the fine end ask the very question they answer at 1 800 m', () => {
  const point = { lat: 45.7753, lon: 4.8497, altitudeM: 1_100 };
  const lifted = scanCoarsePoint(point);
  assert.equal(lifted.altitudeM, SCAN_SECTION_FADE.coarse);
  assert.equal(lifted.lat, point.lat);
  // The same 0.08° box, snapped to the same 0.04° grid, as from 1 800 m or 5 km.
  const atBandFloor = scanCellParams(lifted);
  assert.deepEqual(atBandFloor, scanCellParams({ ...point, altitudeM: 1_800 }));
  assert.deepEqual(atBandFloor, scanCellParams({ ...point, altitudeM: 5_000 }));
  assert.ok(Math.abs(Number(atBandFloor.north) - Number(atBandFloor.south) - 0.08) < 1e-9);
  // While the shell's own question at 1 100 m is still the plots' box.
  assert.ok(Math.abs(Number(scanCellParams(point).north) - Number(scanCellParams(point).south) - 0.02) < 1e-9);
  // A higher camera is not lowered.
  assert.equal(scanCoarsePoint({ ...point, altitudeM: 7_000 }).altitudeM, 7_000);
});
