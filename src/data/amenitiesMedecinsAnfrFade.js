/**
 * @module amenitiesMedecinsAnfrFade
 *
 * Fade on zoom for the three point registers that thin a national set of
 * positions into a mesh and then draw every site: `amenities-fr`,
 * `medecins-fr` and `anfr-fr`. The arithmetic and the adapters are
 * `zoomFade.js`'s; this file holds the one rule those three layers share and
 * the shared layer module does not know about.
 *
 * ── THE MESH IS A SUBSET OF THE SITES, SO A CROSSFADE WOULD DOUBLE IT ───────
 * In all three layers the maillage is not an aggregate: it is a thinned
 * selection of the very positions the site level draws — the same folded
 * record (`amenitiesFeed.js`), the same pack line (`/api/medecins-fr/mesh`
 * maps `pack.sites` one to one), the same mast (`buildAnfrMesh` writes one
 * tuple per support). A symmetric crossfade between the two levels would
 * therefore draw every mesh mark TWICE at the same place, one copy fading out
 * while the other fades in — a double ring while both are up, and a dip in
 * the middle where neither is at full strength (two marks at 0.7 composite to
 * 0.91, not 1).
 *
 * So a mark is drawn once, in one of three classes:
 *   shared — in the mesh AND in the site answer. Drawn once, by the site
 *            level's mark, at full strength whenever either level is on
 *            screen: it never fades, because nothing about it changes but the
 *            card behind it.
 *   sites  — only in the site answer: the detail the mesh thinned away. It
 *            comes in with the finer level.
 *   mesh   — only in the mesh: the edge of a padded box, or a mark the site
 *            route's own cap dropped. It goes out with the coarser level.
 *
 * The weights are `reveal`, not the symmetric crossfade: in all three layers
 * the band can only sit on the fine side of the old threshold, because the
 * site route refuses a box wider than its ceiling, and a view that used to
 * show every site should still show them.
 */
import { coverAlphas, fadeCollection, levelVisible, reveal } from './zoomFade.js';

/**
 * The three classes' alphas at one position in the mesh → sites band.
 *
 * @param {number} position `bandPosition()` of the camera, 0 (mesh) .. 1 (sites).
 * @param {{meshReady?: boolean, sitesReady?: boolean, meshArrival?: number, sitesArrival?: number}} state
 *   `*Ready`: that level's marks are on screen. `*Arrival`: its arrival ramp, 1 when none runs.
 * @returns {{mesh: number, sites: number, shared: number}}
 */
export function meshSitesAlphas(position, state = {}) {
  const alphas = coverAlphas(reveal(position), {
    fineReady: Boolean(state.sitesReady),
    coarseReady: Boolean(state.meshReady),
    fineArrival: state.sitesArrival ?? 1,
    coarseArrival: state.meshArrival ?? 1,
  });
  // A shared mark belongs to whichever level is on screen, so it is at full
  // strength as long as either is — never the sum of two ramps, which dips
  // below 1 when both run at once.
  const shared = state.sitesReady || state.meshReady ? 1 : 0;
  return { mesh: alphas.coarse, sites: alphas.fine, shared };
}

/**
 * A HARD CUT between a national level and the points, without a blank frame.
 *
 * Used where the national level is a different statistic from the marks (a
 * share of communes, an accessibility index) and may not be faded into them:
 * the target is 0 or 1, the outgoing level holds until the incoming one is
 * drawn, and no arrival ramp is passed, so the two trade places in one frame
 * and are never blended.
 *
 * @param {{national: boolean, nationalReady?: boolean, pointsReady?: boolean}} state
 *   `national`: the settled view asks for the national level.
 * @returns {{national: number, points: number}} Each 0 or 1.
 */
export function nationalCutAlphas({ national, nationalReady = false, pointsReady = false } = {}) {
  const target = national ? { fine: 0, coarse: 1 } : { fine: 1, coarse: 0 };
  const alphas = coverAlphas(target, { fineReady: pointsReady, coarseReady: nationalReady });
  return { national: alphas.coarse, points: alphas.fine };
}

/**
 * Show and fade one class of marks held in its own collection.
 *
 * A class at zero is HIDDEN through the collection's own `show`, which costs
 * nothing: no billboard is written, so the collection's buffers are not
 * rebuilt, and a hidden collection neither draws nor answers picks. Above zero
 * the shared adapter writes each mark's alpha — only when the weight moved a
 * step, or with `force` after the class was rebuilt or a mark restyled.
 *
 * A class coming back from hidden is always written in full: it may have been
 * rebuilt while out of sight (the force of that frame was spent on a hidden
 * collection), and the adapter would otherwise skip it for coming back at the
 * weight it left at. Marks already at the right alpha cost a comparison, not
 * a write.
 *
 * @param {?object} collection A `BillboardCollection` (or anything `fadeCollection` takes).
 * @param {number} weight
 * @param {{enabled?: boolean, force?: boolean}} [options]
 * @returns {boolean} Whether anything was written.
 */
export function fadeMarkLevel(collection, weight, { enabled = true, force = false } = {}) {
  if (!collection) return false;
  const visible = levelVisible(enabled, weight);
  const wasShown = Boolean(collection.show);
  let written = false;
  if (wasShown !== visible) {
    collection.show = visible;
    written = true;
  }
  if (visible && fadeCollection(collection, weight, { force: force || !wasShown })) written = true;
  return written;
}
