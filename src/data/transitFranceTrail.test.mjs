// src/data/transitFranceTrail.test.mjs — the trail behind a selected bus:
// the server's fifteen minutes merged with the fixes this page sees, drawn so
// it never runs ahead of the glyph.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeTrailFixes } from './transitFrance.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = fs.readFileSync(path.join(HERE, 'transitFrance.js'), 'utf8');
const CONFIG = fs.readFileSync(path.join(HERE, '..', '..', 'vite.config.js'), 'utf8');
const NOW = 1_780_000_000_000;

test('served and live fixes merge oldest first, one per timestamp, inside fifteen minutes', () => {
  const merged = mergeTrailFixes([
    { t: NOW - 60_000, lat: 44.84, lon: -0.57 },
    { t: NOW - 20 * 60_000, lat: 44.80, lon: -0.57 },
    { t: NOW - 120_000, lat: 44.83, lon: -0.57 },
    { t: NOW - 60_000, lat: 44.845, lon: -0.57 },
    { t: NOW, lat: 44.85, lon: -0.57 },
    { t: Number.NaN, lat: 44.8, lon: -0.57 },
    { t: NOW - 1000, lat: Number.NaN, lon: -0.57 },
  ], NOW);
  assert.deepEqual(merged.map((fix) => fix.t), [NOW - 120_000, NOW - 60_000, NOW]);
  assert.equal(merged[1].lat, 44.845, 'the later copy of a timestamp wins: live beats served');
});

test('the trail keeps at most 128 fixes, the newest', () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ t: NOW - (200 - i) * 1000, lat: 44.8, lon: -0.57 }));
  const merged = mergeTrailFixes(many, NOW);
  assert.equal(merged.length, 128);
  assert.equal(merged[127].t, NOW - 1000);
});

test('the trail starts on selection, grows on each poll of the selected vehicle and stops with the selection', () => {
  assert.match(SOURCE, /publishSelectionCard\(record\);\n  startTrail\(record\);/);
  assert.match(SOURCE, /if \(id === _selectedId\) extendTrail\(record, nowMs\);/);
  assert.match(SOURCE, /function clearSelection\(\) \{\n  stopTrail\(\);/);
});

test('the body stops at the fix before the newest, and the head runs from there to the glyph', () => {
  assert.match(SOURCE, /for \(const fix of _trailFixes\.slice\(0, -1\)\)/);
  assert.match(SOURCE, /return \[_trailBodyEnd, Cesium\.Cartesian3\.clone\(record\.renderPosition\)\];/);
  assert.match(SOURCE, /id: `gev-trail:transit-fr-head`/, 'the head claims the trail pick namespace');
});

test('a late server answer for a vehicle no longer selected is dropped', () => {
  assert.match(SOURCE, /if \(generation !== _trailGeneration \|\| _trailFor !== record\.id\) return;/);
});

test('the proxy records every decoded vehicle and serves one trail without asking an operator', () => {
  assert.match(CONFIG, /_panTrails\.record\(vehicle\.id, vehicle\.lat, vehicle\.lon, atSec\);/);
  const trailRoute = CONFIG.slice(CONFIG.indexOf("if (route === '/trail') {"), CONFIG.indexOf("if (route !== '/vehicles') {"));
  assert.ok(trailRoute.length > 0, 'the /trail route exists before the /vehicles fallback');
  assert.doesNotMatch(trailRoute, /fetch\(|panFeedVehicles|refreshPanViewport/);
  assert.match(trailRoute, /id\.length > 200/);
});
