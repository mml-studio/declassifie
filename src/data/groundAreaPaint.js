/**
 * Cadastral shapes painted on the ground, as primitives — the draw shared by
 * the two layers that paint the cadastre from altitude: property prices
 * (`dvfSales.js`) and energy ratings (`dpeFrance.js`).
 *
 * WRITTEN FOR THE PRICES FIRST (#301) and extracted when the energy ratings
 * needed the same thing (2026-09-22): parcels from 600 m, cadastral sections
 * above 1 800 m, one colour each, a click answered by geometry.
 *
 * PRIMITIVES, NOT ENTITIES. The densest price box holds 1 698 parcels and the
 * densest energy box measured 2 469 (Lyon Presqu'île); as entities that is
 * 3 500 to 5 000 objects — a fill and an outline each — at the ~30 KiB of
 * `Entity` machinery `localGeojson.js` measured per feature. Drawn the way
 * `cadastreParcels.js` draws its 5 000 parcels instead, it is ONE
 * classification `GroundPrimitive` per colour and one
 * `GroundPolylinePrimitive` for every edge. One colour per batch is not a
 * style choice: a batch mixing colours repaints its neighbours along their
 * bounding rectangles (`cadastreParcels.js`, `drawRecords`).
 *
 * A CLICK IS ANSWERED BY GEOMETRY, not by the pick. Ground classification
 * answers `scene.pick` with whichever shadow volume the ray enters first,
 * which at this globe's oblique angles is often not the shape under the
 * pointer; the shapes are in memory, so {@link createGroundAreaPaint}'s
 * `shapeAt` finds the one under the ground point directly.
 *
 * @module data/groundAreaPaint
 */

import * as Cesium from 'cesium';
import { decodeParts } from './dvfFeed.js';
import { pointInPolygons, polygonsBounds } from './ringGeometry.js';
import { governorRequestRender } from '../renderGovernor.js';
import { fadeInstances } from './zoomFade.js';

/** Frames a freshly built draw is re-rendered for, at most, while it tessellates. */
const BUILD_FRAME_CAP = 240;

/**
 * The shape under a ground point, or null. The smallest wins where two
 * overlap — a multipart plot's neighbour, a section drawn over a sliver of
 * another — because the smaller shape is the more specific claim.
 * @param {number} lon @param {number} lat
 * @param {Array<{parts: Array, bounds: ?object}>} shapes
 * @returns {?object}
 */
export function groundShapeAt(lon, lat, shapes) {
  let best = null;
  let bestSpan = Infinity;
  for (const shape of shapes || []) {
    const bounds = shape.bounds;
    // The bbox rejects almost everything for almost nothing — at 2 000 plots
    // it is the difference between a hit test and a stutter.
    if (!bounds || lat < bounds.south || lat > bounds.north
      || lon < bounds.west || lon > bounds.east) continue;
    if (!pointInPolygons(shape.parts, lon, lat)) continue;
    const span = (bounds.north - bounds.south) * (bounds.east - bounds.west);
    if (span < bestSpan) { best = shape; bestSpan = span; }
  }
  return best;
}

/** Positions for one ring, without its repeated closing vertex. */
function ringPositions(ring) {
  const degrees = [];
  const last = ring.length - 1;
  const closed = last > 0 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1];
  for (let i = 0; i < (closed ? last : ring.length); i += 1) {
    const point = ring[i];
    if (Array.isArray(point)) degrees.push(point[0], point[1]);
  }
  return degrees.length >= 6 ? Cesium.Cartesian3.fromDegreesArray(degrees) : null;
}

/**
 * One layer's painter. Each layer holds its own, so the two can be on screen
 * together and each tears down only what it drew.
 *
 * A REDRAW NEVER SHOWS A BLANK FRAME (2026-10-01). The batches are built
 * asynchronously on the worker pool, and the draw used to take the old ones
 * off the globe the moment the new ones were ASKED for: a pan, a zoom across
 * a band, a map-stack switch each left the ground bare for the hundreds of
 * milliseconds tessellation takes — and the shapes then popped back, which
 * read as the map reloading. A draw now builds a PENDING generation, hidden,
 * beside the one on screen; {@link promote} swaps them only once every new
 * batch is ready, in the frame that will draw them. The layer calls it from
 * its per-frame fade (`scanAreaFade.js`), so the new shapes are already at the
 * weight the frame gives them on the first frame they are seen.
 *
 * A WEIGHT IS WRITTEN PER INSTANCE. A `GroundPrimitive` builds its shaders
 * from the appearance's type and cannot take a fade uniform, so the fade
 * writes each instance's colour (`zoomFade.fadeInstances`, quantised, nothing
 * written while the weight has not moved a step). That needs one id per
 * instance — a multipart plot's second part used to share its first's, and
 * Cesium answers an id with the first instance it finds — so the second and
 * later parts and rings carry `#2`, `#3`: the prefix every pick test reads is
 * unchanged.
 *
 * @param {{renderReason: string}} options The render-governor reason the
 *   build pump requests frames under.
 * @returns {{
 *   draw: Function, clear: Function, promote: Function, fade: Function,
 *   setShow: Function, drawn: () => boolean, shown: () => boolean,
 *   generation: () => number, shapeAt: Function, shapes: () => Array<object>,
 *   stats: () => {shapes: number, fills: number, ready: boolean, pending: boolean},
 * }}
 */
export function createGroundAreaPaint({ renderReason }) {
  let viewer = null;
  /** The generation on screen. */
  let current = emptyGeneration();
  /** A generation still building, hidden, behind the one on screen. */
  let pending = null;
  let pumpStop = null;
  /** Whether the layer wants this paint drawn at all — see `setShow`. */
  let wanted = true;
  /** Bumped on every swap, so a layer can tell a new drawing arrived. */
  let swaps = 0;

  function emptyGeneration() {
    return { fills: [], outline: null, instances: new Map(), shapes: [] };
  }

  function primitivesOf(generation) {
    return generation.outline ? [...generation.fills, generation.outline] : generation.fills;
  }

  function removeGeneration(generation) {
    const primitives = viewer?.scene?.primitives;
    if (!generation || !primitives) return;
    for (const primitive of primitivesOf(generation)) primitives.remove(primitive);
  }

  /** Take the draw off the globe, the one building behind it too. Idempotent. */
  function clear() {
    pumpStop?.();
    pumpStop = null;
    removeGeneration(current);
    removeGeneration(pending);
    current = emptyGeneration();
    pending = null;
  }

  function generationReady(generation) {
    return primitivesOf(generation).every((primitive) => primitive.ready);
  }

  /**
   * Keep rendering while the batches tessellate on the worker pool, then stop.
   *
   * The globe renders on demand, and nothing else asks for the frames in which
   * an asynchronous `GroundPrimitive` becomes ready — without this a box of
   * plots can land and stay invisible until the reader next moves. Bounded, so
   * a primitive that never readies cannot hold the render loop open: at the
   * cap the pending draw is swapped in as it is.
   */
  function pumpUntilReady(scene) {
    pumpStop?.();
    pumpStop = null;
    if (!scene?.postRender) return;
    let framesLeft = BUILD_FRAME_CAP;
    const stop = scene.postRender.addEventListener(() => {
      framesLeft -= 1;
      if (!pending || framesLeft <= 0) {
        stop();
        if (pumpStop === stop) pumpStop = null;
        if (pending) {
          // Never readied: swapped in as it is rather than left hidden for good.
          pending.gaveUp = true;
          promote();
          governorRequestRender(renderReason);
        }
        return;
      }
      // Ready or not, one more frame: the swap happens in the next one.
      governorRequestRender(renderReason);
    });
    pumpStop = stop;
    governorRequestRender(renderReason);
  }

  /**
   * Swap the pending draw in, once every batch of it is ready: the old one
   * leaves the globe in the same frame the new one is first drawn.
   * @returns {boolean} Whether a swap happened.
   */
  function promote() {
    if (!pending) return false;
    if (!pending.gaveUp && !generationReady(pending)) return false;
    removeGeneration(current);
    current = pending;
    pending = null;
    for (const primitive of primitivesOf(current)) primitive.show = wanted;
    swaps += 1;
    return true;
  }

  /**
   * Paint shapes: one fill primitive per colour, one outline primitive.
   *
   * @param {object} targetViewer
   * @param {Iterable<{id: string, kind: string, record: object,
   *   parts: Array, css: string, level?: string}>} items `parts` ENCODED
   *   (`dvfFeed.encodeRing`), decoded once here for the draw and the click test
   *   both; `id` is the pick id every instance of the shape carries.
   * @param {{style: {fill: number, outline: number, widthPx: number},
   *   classificationType: number}} options
   * @returns {number} Shapes drawn.
   */
  function draw(targetViewer, items, { style, classificationType }) {
    if (!targetViewer?.scene?.primitives) {
      clear();
      return 0;
    }
    viewer = targetViewer;
    // A newer draw supersedes one still building: only the newest is swapped in.
    removeGeneration(pending);
    pending = null;
    const next = emptyGeneration();
    const fillsByColor = new Map();
    const outlines = [];
    const outlineEntries = [];
    for (const item of items || []) {
      const parts = decodeParts(item?.parts);
      if (!parts.length) continue;
      const fill = Cesium.Color.fromCssColorString(item.css).withAlpha(style.fill);
      const stroke = Cesium.Color.fromCssColorString(item.css).withAlpha(style.outline);
      let batch = fillsByColor.get(item.css);
      if (!batch) { batch = { instances: [], entries: [] }; fillsByColor.set(item.css, batch); }
      let fillCount = 0;
      let ringCount = 0;
      for (const rings of parts) {
        const outer = ringPositions(rings[0] || []);
        if (!outer) continue;
        const holes = [];
        for (let h = 1; h < rings.length; h += 1) {
          const hole = ringPositions(rings[h]);
          // A courtyard is not part of the plot, and a hole in a section is
          // another commune's enclave: filled in, the wash claims ground the
          // numbers are not about.
          if (hole) holes.push(new Cesium.PolygonHierarchy(hole));
        }
        fillCount += 1;
        const fillId = fillCount === 1 ? item.id : `${item.id}#${fillCount}`;
        batch.instances.push(new Cesium.GeometryInstance({
          id: fillId,
          geometry: new Cesium.PolygonGeometry({
            polygonHierarchy: new Cesium.PolygonHierarchy(outer, holes),
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
          }),
          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(fill) },
        }));
        batch.entries.push([fillId, fill]);
        for (const ring of rings) {
          const positions = ringPositions(ring || []);
          if (!positions) continue;
          ringCount += 1;
          const ringId = ringCount === 1 ? item.id : `${item.id}#${ringCount}`;
          outlines.push(new Cesium.GeometryInstance({
            id: ringId,
            geometry: new Cesium.GroundPolylineGeometry({
              positions: [...positions, positions[0]],
              width: style.widthPx,
            }),
            attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(stroke) },
          }));
          outlineEntries.push([ringId, stroke]);
        }
      }
      next.shapes.push({
        kind: item.kind, record: item.record, parts, bounds: polygonsBounds(parts), css: item.css,
        level: item.level ?? null,
      });
    }
    const primitives = viewer.scene.primitives;
    for (const { instances, entries } of fillsByColor.values()) {
      if (!instances.length) continue;
      const primitive = new Cesium.GroundPrimitive({
        geometryInstances: instances,
        appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
        classificationType,
        asynchronous: true,
        // Hidden until the swap: building does not wait for `show`.
        show: false,
      });
      next.fills.push(primitive);
      next.instances.set(primitive, entries);
      primitives.add(primitive);
    }
    if (outlines.length) {
      // One batch, colours per instance: safe for polylines, which cull by
      // distance to the line and not by bounding rectangle.
      next.outline = new Cesium.GroundPolylinePrimitive({
        geometryInstances: outlines,
        appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
        classificationType,
        asynchronous: true,
        show: false,
      });
      next.instances.set(next.outline, outlineEntries);
      primitives.add(next.outline);
    }
    if (!next.fills.length && !next.outline) {
      // Nothing to build: an empty answer replaces the draw at once.
      removeGeneration(current);
      current = next;
      swaps += 1;
      governorRequestRender(renderReason);
      return 0;
    }
    pending = next;
    pumpUntilReady(viewer.scene);
    return next.shapes.length;
  }

  /**
   * Write one weight into every instance on screen — see the module header.
   * @param {number} weight
   * @param {{force?: boolean}} [options]
   * @returns {boolean} Whether anything was written.
   */
  function fade(weight, options = {}) {
    let wrote = false;
    for (const [primitive, entries] of current.instances) {
      if (fadeInstances(primitive, entries, weight, options)) wrote = true;
    }
    return wrote;
  }

  /**
   * Draw this paint or not. A level at weight zero is hidden rather than drawn
   * transparent: it would still cost its draw calls and answer picks.
   * @param {boolean} on
   */
  function setShow(on) {
    wanted = Boolean(on);
    for (const primitive of primitivesOf(current)) primitive.show = wanted;
  }

  /** The newest draw's shapes — the one the layer's answer describes. */
  const latest = () => (pending || current);

  return {
    draw,
    clear,
    promote,
    fade,
    setShow,
    /** Whether a drawing is on screen (built and swapped in). */
    drawn: () => current.fills.length > 0 || current.outline !== null,
    /** Whether the drawing on screen is shown. */
    shown: () => wanted && (current.fills.length > 0 || current.outline !== null),
    /** How many drawings have been swapped in. */
    generation: () => swaps,
    /** The drawn shape under a ground point, or null. */
    shapeAt: (lon, lat) => groundShapeAt(lon, lat, latest().shapes),
    shapes: () => latest().shapes,
    /** What is on the globe, for the harnesses — see each layer's `getAreaDraw()`. */
    stats: () => ({
      shapes: latest().shapes.length,
      fills: latest().fills.length,
      ready: !pending && generationReady(current),
      pending: Boolean(pending),
    }),
  };
}
