// src/data/transitPresetStyle.test.mjs — live transit glyphs under NVG, FLIR
// and CRT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TRANSIT_MONO_CSS,
  transitGlyphCss,
  transitGlyphSizeDelta,
  transitStyleProfile,
} from './transitPresetStyle.js';
import { VEHICLE_KIND_COLORS } from './transitVehicleKind.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELECTED = '#00ffff';

/** Rec. 601 luma of a #rrggbb colour, 0-1 — what NVG and FLIR keep. */
function luma(css) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(css.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

test('NVG and FLIR are mono, CRT is crt, everything else keeps the shipped look', () => {
  assert.equal(transitStyleProfile('surveillance'), 'mono');
  assert.equal(transitStyleProfile('thermal'), 'mono');
  assert.equal(transitStyleProfile('retro'), 'crt');
  for (const style of ['normal', 'noir', 'anime', 'dusk', 'snow', undefined, null, 'unknown']) {
    assert.equal(transitStyleProfile(style), 'normal', String(style));
  }
});

test('the shipped palette is a flat mid grey under luminance, which is why mono exists', () => {
  const lumas = Object.entries(VEHICLE_KIND_COLORS)
    .filter(([kind]) => kind !== 'air')
    .map(([, css]) => luma(css));
  assert.ok(Math.max(...lumas) < 0.9, `brightest kind ${Math.max(...lumas).toFixed(2)}`);
  assert.ok(luma(SELECTED) < 0.75, 'the selection cyan is no brighter than a bus');
});

test('under mono every glyph, selected or not, is white', () => {
  for (const style of ['surveillance', 'thermal']) {
    for (const kind of Object.keys(VEHICLE_KIND_COLORS)) {
      const base = VEHICLE_KIND_COLORS[kind];
      assert.equal(transitGlyphCss(style, { kind }, { baseCss: base, selectedCss: SELECTED }), TRANSIT_MONO_CSS);
      assert.equal(transitGlyphCss(style, { kind }, { selected: true, baseCss: base, selectedCss: SELECTED }), TRANSIT_MONO_CSS);
    }
  }
  assert.ok(luma(TRANSIT_MONO_CSS) > 0.999);
  assert.equal(transitGlyphSizeDelta('surveillance'), 0, 'the selected vehicle keeps its larger box as its mark');
});

test('under CRT kinds stay apart in saturated colours, the selection turns white, glyphs grow', () => {
  const bus = transitGlyphCss('retro', { kind: 'bus' }, { baseCss: '#ffc93c', selectedCss: SELECTED });
  const tram = transitGlyphCss('retro', { kind: 'tram' }, { baseCss: '#7ee0ff', selectedCss: SELECTED });
  assert.notEqual(bus, tram);
  assert.notEqual(bus, '#ffc93c');
  assert.equal(transitGlyphCss('retro', { kind: 'tram' }, { selected: true, baseCss: '#7ee0ff', selectedCss: SELECTED }), '#ffffff');
  assert.equal(transitGlyphCss('retro', { kind: null }, { baseCss: '#8ab4f8', selectedCss: SELECTED }), '#8ab4f8',
    'an unresolved kind keeps its service-class colour');
  assert.equal(transitGlyphSizeDelta('retro'), 4);
});

test('the normal profile returns the shipped colours untouched', () => {
  assert.equal(transitGlyphCss('normal', { kind: 'bus' }, { baseCss: '#ffc93c', selectedCss: SELECTED }), '#ffc93c');
  assert.equal(transitGlyphCss('noir', { kind: 'bus' }, { selected: true, baseCss: '#ffc93c', selectedCss: SELECTED }), SELECTED);
  assert.equal(transitGlyphSizeDelta('normal'), 0);
});

test('the layer paints every glyph through one styled helper and follows gev:style-change', () => {
  const source = fs.readFileSync(path.join(HERE, 'transitFrance.js'), 'utf8');
  assert.match(source, /window\.addEventListener\('gev:style-change', \(event\) => setStylePreset\(event\?\.detail\?\.style\)\)/);
  assert.match(source, /dataset\?\.gevStyle/);
  const paints = source.match(/\.color = /g) || [];
  assert.equal(paints.length, 2, 'only applyGlyphStyle assigns a glyph or pointer colour');
  assert.doesNotMatch(source, /fromCssColorString\(SELECTED_COLOR\)/, 'selection goes through the style lookup');
});
