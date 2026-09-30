/**
 * @file Live transit glyphs under the post-FX styles — the pure lookup that
 * maps the active StyleManager preset to a glyph colour and a size bump.
 *
 * Why: transit vehicles are in-scene billboards, so they pass THROUGH the
 * post-FX shaders. NVG and FLIR reduce the scene to luminance, and the kind
 * palette (`VEHICLE_KIND_COLORS`) lands between luma 0.66 (coach) and 0.79
 * (bus): every vehicle turns the same mid grey, and the selected vehicle's
 * cyan (0.70) is no brighter than the rest. Nothing is lost by dropping the
 * hue there, because the glyph's SHAPE already says bus, tram, metro or
 * ferry. CRT keeps hue but its pixelation shreds a 22 px glyph.
 *
 * Profiles, the same split as `trafficPresetStyle.js`:
 *  - `mono` (surveillance/NVG, thermal/FLIR): every glyph and its heading
 *    wedge draw white. The glyph texture carries its own dark stroke, which
 *    Cesium's colour multiply keeps black, so each vehicle is a white-hot
 *    shape in a dark halo — local contrast every luma mapping preserves.
 *    The selected vehicle is told apart by its larger box, as it already is.
 *  - `crt` (retro): the kind colours pushed to saturated primaries that
 *    survive posterization, a 4 px size boost, and white for the selected
 *    vehicle (its usual cyan is the tram's colour there).
 *  - `normal` (normal, anime, snow, dusk, noir, unknown): the shipped palette,
 *    untouched. Noir darkens the basemap only (`styles/nightAtlas.js`).
 *
 * Cesium-free so it is unit-testable; `transitFrance.js` turns the CSS into
 * a Cesium colour when it restyles.
 *
 * @module data/transitPresetStyle
 */

/** @const {Object<string,'mono'|'crt'>} Style name → non-normal profile. */
const PROFILE_BY_STYLE = Object.freeze({
  surveillance: 'mono',
  thermal: 'mono',
  retro: 'crt',
});

/** Colour of every transit glyph under a mono profile. */
export const TRANSIT_MONO_CSS = '#ffffff';

/**
 * Saturated kind colours for CRT: each hue family of the shipped palette
 * pushed to a primary its 10-level posterization cannot merge with a
 * neighbour's.
 * @const {Object<string,string>}
 */
const CRT_KIND_CSS = Object.freeze({
  bus: '#ffd400',
  coach: '#ff6a00',
  trolleybus: '#ffe600',
  tram: '#00d5ff',
  metro: '#2f6bff',
  rail: '#c040ff',
  monorail: '#9d5cff',
  ferry: '#00ffa8',
  'cable-tram': '#66c2ff',
  aerial: '#66c2ff',
  funicular: '#66c2ff',
  taxi: '#fff200',
  air: '#ffffff',
  other: '#e0e0e0',
});

/** Pixels a profile adds to the glyph and pointer boxes. */
const SIZE_DELTA = Object.freeze({ normal: 0, mono: 0, crt: 4 });

/**
 * Classifies a StyleManager preset name.
 * @param {string|null|undefined} styleName - Active style (e.g. 'thermal').
 * @returns {'normal'|'mono'|'crt'} Profile; anything unknown → 'normal'.
 */
export function transitStyleProfile(styleName) {
  return PROFILE_BY_STYLE[styleName] || 'normal';
}

/**
 * The glyph colour for one vehicle under the active style.
 * @param {string|null|undefined} styleName - Active style.
 * @param {{ kind?: string|null }} vehicle - Wire record.
 * @param {{ selected?: boolean, baseCss: string, selectedCss: string }} options
 *   `baseCss` is the vehicle's shipped colour, `selectedCss` the shipped
 *   selection colour — the normal profile returns them unchanged.
 * @returns {string} CSS colour.
 */
export function transitGlyphCss(styleName, vehicle, { selected = false, baseCss, selectedCss }) {
  const profile = transitStyleProfile(styleName);
  if (profile === 'mono') return TRANSIT_MONO_CSS;
  if (profile === 'crt') {
    if (selected) return TRANSIT_MONO_CSS;
    return (vehicle?.kind && CRT_KIND_CSS[vehicle.kind]) || baseCss;
  }
  return selected ? selectedCss : baseCss;
}

/**
 * Pixels the active style adds to a glyph or pointer box.
 * @param {string|null|undefined} styleName - Active style.
 * @returns {number}
 */
export function transitGlyphSizeDelta(styleName) {
  return SIZE_DELTA[transitStyleProfile(styleName)];
}
