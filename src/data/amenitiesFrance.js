/**
 * @module amenitiesFrance
 *
 * Où est le plus proche — the things a daily life in France actually touches,
 * drawn from the two registers that publish them and refusing the six things
 * another layer on this globe already draws better.
 *
 * `amenitiesFeed.js` holds the reading of INSEE's Base permanente des
 * équipements and the FINESS register and every trap in both;
 * `amenitiesDepartements.js` holds the national fold; `amenitiesMesh.js` holds
 * the thinning; `amenityFamilyIcons.js` holds the marks. This file is the
 * rendering.
 *
 * ── What is on the map ─────────────────────────────────────────────────────
 * **443 169 marks**, folded from 521 672 register rows, in thirteen families:
 * 186 288 restaurants · 44 800 commerces de bouche · 44 598 boulangeries ·
 * 30 213 médecins généralistes · 22 838 salles de sport · 21 086 banques ·
 * 20 020 lieux culturels · 19 354 commerces alimentaires · 19 216 pharmacies ·
 * 16 832 points de contact La Poste · 10 346 stations-service · 3 953
 * gendarmeries et commissariats · 3 625 bassins de natation.
 *
 * Seven of them arrived on 2026-09-08 to cover Cityscan's own POI taxonomy —
 * see `amenitiesFeed.js` for the codes, the cost and the four types that
 * register simply cannot serve.
 *
 * ── 2026-09-15: the marks became PLATES, and the reason is a measurement ────
 * Until that day this layer drew fourteen families as bare dots of 5 to 12 px,
 * separated by hue alone. Two numbers ended it:
 *
 *   - **four pairs of the palette sat under ΔE 20** and seven under ΔE 21, the
 *     worst being `pharmacie`/`banque` at **15,9**;
 *   - **all fourteen hues sat between L\* 32,8 and L\* 63,9** — a band with no
 *     contrast against a forest, a field or a slate roof, which is most of
 *     France from 30 km up.
 *
 * The load therefore moved off the hue: a punched silhouette on a tinted plate
 * names the family, the plate makes it findable, and the palette was rebuilt to
 * maximise its WORST pair rather than its average one — **min ΔE 39,3**, every
 * L\* at or above 55,7. Both the marks and the numbers are argued where they
 * live, in `amenityFamilyIcons.js` and in {@link AMENITY_COLORS}.
 *
 * ── And the key became the CONTROL ──────────────────────────────────────────
 * Thirteen families over one street is a legible map only if the reader wanted
 * thirteen. Usually they want one. So every row of the key is that family's own
 * switch ({@link AMENITIES_WITHDRAWN_FAMILIES} is the only thing it cannot
 * reach), and the selection goes into the QUESTION rather than being applied to
 * the answer — `familles=` on the proxy, and a filtered budget in the thinner.
 *
 * That ordering is not tidiness. Measured over greater Paris (48.62-48.95 N,
 * 2.16-2.45 E) on 2026-09-15: the box holds 46 422 marks, `/sites` answers
 * 12 000 of them rarest-family-first, and **zero** of the 4 076 boulangeries
 * survive that cap. Asked for as `familles=boulangerie`, all 4 076 arrive. A
 * filter applied after the cap would have answered "there are no bakeries in
 * Paris".
 *
 * ── Two refusals, and they are features of this layer rather than omissions ─
 * The brief's row opens with *écoles*, and this layer draws none. `schools-fr`
 * already draws 68 158 open, geolocated schools from the ministry's own
 * Annuaire keyed on the UAI, and `sup-fr` 6 914 higher-education sites. BPE's
 * enseignement domain is 79 743 rows over the same buildings from a source that
 * **carries no UAI column at all**, so the two could not even be reconciled.
 * Redrawing them would double every school in France from the worse of the two
 * registers.
 *
 * The second is *hôpitaux*, and it is newer: the 2 211 FINESS establishments
 * moved to « Santé & secours » on 2026-09-15, where they sit beside the 64 232
 * practice addresses and the DREES accessibility indicator. A hospital is not
 * an everyday errand. The pack still carries them — `AMENITY_FAMILIES` is the
 * mesh's on-the-wire encoding and cannot lose a member — so the withdrawal is
 * in the drawing, not in the data; see {@link AMENITIES_WITHDRAWN_FAMILIES}.
 *
 * The key carries a row for each refusal, with a count and no swatch, because a
 * reader who does not find schools or hospitals here should be told where they
 * are rather than left to conclude the data is missing.
 *
 * Four more refusals, each with the measurement behind it, are argued in
 * `amenitiesFeed.js`: BPE's 28 819 charge points (`irve-fr` has 39 579, live),
 * its 20 334 pharmacies (FINESS has a stable key and a monthly refresh), its
 * 695 urgences (547 of them within 200 m of a hospital already drawn), and its
 * 99 280 transport rows (96 253 of which are taxi operators' addresses).
 *
 * And one CONDITIONAL withdrawal, `medecin`, measured on 2026-09-15: 74.6 % of
 * the 30 213 BPE dots have a conventioned practice address within 50 m and
 * 91.5 % within 200 m, at a median distance of 10 m where they match. The two
 * registers describe one population, so only one of them draws it — and the
 * 8.5 % the CNAM does not carry is the stated price of that rule rather than an
 * omission. Switch « Santé & secours » off and the family comes back.
 *
 * ── Three regimes, and what decides between them ───────────────────────────
 *   national — 96 painted départements, shaded by the SHARE of the
 *              département's communes that hold at least one everyday
 *              equipment. A count would have been a population map; see
 *              `amenitiesDepartements.js`. Entered on the view's LATITUDE span
 *              (≥ 9.5°, metropolitan France being 9.8° tall).
 *   maillage — real positions, thinned per family so no family can be squeezed
 *              off the map by a bigger one. See `amenitiesMesh.js`.
 *   sites    — every amenity in the box, with its card, from the proxy's
 *              `/sites` route. Gated at 0.35°, and the densest square that
 *              ceiling allows anywhere in France — 48.65 N, 2.20 E, which is
 *              Paris and its inner south-eastern suburbs — holds 53 121 dots,
 *              of which the proxy answers 12 000 and says so.
 *
 * ── What each channel means, and what the size does NOT mean ────────────────
 * SHAPE is the family, and it is what a reader decodes without the key: a fork
 * and knife is a restaurant, a trolley is a supermarket. COLOUR is the family
 * too — the same fact on a second channel, which is what lets a reader find all
 * of one kind at a glance rather than reading thirteen silhouettes. It is a
 * categorical ladder, never a ramp: a pharmacy is not "more" than a post
 * office.
 *
 * SIZE is where this layer differs from every French point layer beside it, and
 * the difference is deliberate. `schools-fr` sizes by roll, `sup-fr` by
 * enrolment, `irve-fr` by charging power. **This point set has no magnitude at
 * all.** A pharmacy is one pharmacy; neither register publishes a capacity, a
 * headcount or a turnover for any of the thirteen families. So size here is a
 * LEGIBILITY rule and is stated as one: the rarer a family is nationally, the
 * larger its plate, so that 3 625 bassins are not lost under 186 288
 * restaurants. It is a property of the palette, not a property of the
 * equipment, and no card ever reads a size back as a quantity.
 *
 * What the card DOES read back is the multiplicity, because that is real:
 * 60 270 GP rows sit on 30 215 coordinates and the biggest single address holds
 * **146 médecins généralistes** (Paris 14e). The mark is the address; the card
 * says how many practitioners are at it.
 *
 * ── The remaining channel is honesty about position ─────────────────────────
 * Both registers publish how well they know where a thing is, and this layer
 * draws that rather than hiding it. A mark whose position is a street number
 * (451 983 of the 521 672 drawn rows) is drawn at full opacity; one the
 * register only places in the street (36 763), or grades no better than "voie
 * probable" (4 933), or declines to grade at all (27 993, among them the 3 626
 * bassins de natation whose census publishes no precision anywhere) is drawn
 * softer, and the card says so in words.
 *
 * It used to be a SAND HALO as well, and that halo went with the dots on
 * 2026-09-15. Every plate now carries the same black ring, because the ring is
 * what makes a mark findable on a photograph — and legibility is not something
 * to spend on a data-quality flag. What the neighbours' rings used to say
 * (`schools-fr` outlines in black, `sup-fr` in white) the silhouette now says
 * better: on a stacked address the SHAPE tells a reader which register drew the
 * mark, and it does so without a key.
 *
 * And where a register admits it drew the position rather than found it — BPE's
 * `QUALITE_GEOLOC = 33`, "position aléatoire dans la commune", and FINESS's
 * 4 646 ADMIN-EXPRESS commune centroids — there is no dot at all. **8 626 rows
 * in the drawn families are refused on those grounds and 12 902 more publish no
 * coordinate**, all of them counted and reported on the national card. The
 * widening of 2026-09-08 found most of them: the dense commercial codes are
 * the worst geocoded in the file, 7 704 restaurants alone. Mayotte's whole
 * everyday BPE equipment is still among them, which is why the island carries
 * FINESS pharmacies and hospitals and nothing else.
 */

import * as Cesium from 'cesium';
import { profileCountBudget } from '../perfProfile.js';
import { claimCameraSensitivity, releaseCameraSensitivity } from './cameraSensitivity.js';
import { markViewportRead, releaseCameraSettle, watchCameraSettle } from './cameraSettle.js';
import { CHOROPLETH_FILL_ALPHA } from './choroplethAlpha.js';
import { governorRequestRender } from '../renderGovernor.js';
import { registerSpriteCollection, restoreSpriteOrder, unregisterSpriteCollection } from './spriteOrder.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import { cachedGroundFloor, warmGroundFloor } from './groundFloor.js';
import { parseDepartements } from './meteoFranceVigilance.js';
import { hasJoin, watchJoin } from './layerJoins.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import {
  AMENITIES_MAX_BOX_DEG,
  AMENITY_FAMILIES,
  amenityFamilyBlurb,
  amenityFamilyLabel as familyLabel,
  amenityFamilyPlural,
  amenityPrecisionLabel,
  amenityPrecisionRank,
} from './amenitiesFeed.js';
import { formatDecimal, formatNumber } from '../i18n/format.js';
import messages from './amenitiesFrance.i18n.js';
import {
  MESH_FAMILY,
  MESH_LAT,
  MESH_LON,
  MESH_PRECISION,
  amenitiesMeshBudget,
  meshAmenityFamily,
  meshAmenityId,
  meshAmenityPrecision,
  selectAmenitiesMesh,
} from './amenitiesMesh.js';
import { amenitiesDepartementBinLabels } from './amenitiesDepartements.js';
import { AMENITY_GLYPH_RASTER_PX, amenityFamilyGlyph } from './amenityFamilyIcons.js';
import { boxKey, validBox } from './viewportBox.js';
import { pickAt } from './pickAt.js';
import { serverFailureMessage } from '../i18n/serverMessages.js';
import {
  bandPosition,
  fadeBand,
  levelVisible,
  quantizeFade,
  reveal,
  watchZoomFade,
} from './zoomFade.js';
import { fadeMarkLevel, meshSitesAlphas, nationalCutAlphas } from './amenitiesMedecinsAnfrFade.js';

export const AMENITIES_FR_LAYER_ID = 'amenities-fr';

export const AMENITIES_FR_OVERLAY_SOURCE_ID = 'amenities-fr-selected';
export const AMENITIES_FR_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});
export const AMENITIES_FR_LABEL_SOURCE_ID = 'amenities-fr-departements';
export const AMENITIES_FR_LABEL_COHORT_LIMIT = 14;
export const AMENITIES_FR_LABEL_COLLISION_CAPACITY = 12;

const DEPARTEMENTS_URL = new URL(
  './local_data/france_departements/departements.geojson',
  import.meta.url,
).href;

// --- Activation / load gating ----------------------------------------------
/**
 * View LATITUDE span (degrees) at or above which the choropleth answers, with
 * the lower exit threshold that stops a camera resting on the boundary from
 * swapping the whole map back and forth on sub-pixel drift. The pair
 * `schools-fr` and `sup-fr` settled on, because it is a fact about France
 * (9.8° tall) and the screen rather than about any register.
 *
 * ── Why this is still a HARD CUT and not a fade ─────────────────────────────
 * The other boundary of this layer fades (see {@link AMENITIES_SITES_BAND});
 * this one may not, because the two sides are not the same statistic. The
 * choropleth paints a SHARE — of a département's communes holding at least
 * one everyday equipment, over the five families the fold counts — on a
 * sand-to-rust ramp; the marks are positions, coloured by family on a
 * categorical palette. A crossfade would draw one through the other for as
 * long as the camera rested between 9.5° and 8°, and a rust département seen
 * through a pharmacy's green plate means nothing.
 *
 * What changed is the blank between them. Zooming in used to hide the
 * départements before the national mesh (the ~10 MB tuple pack, on a first
 * entry) had arrived, and zooming out cleared the marks before the outlines
 * were repainted with new materials, which rebuilds their ground batch. Now
 * the level being left stays drawn until the one replacing it is, and the two
 * trade places in one frame — never blended, never both at rest
 * ({@link amenitiesLevelAlphas}). The materials are kept per bin, so the
 * départements come back with a show write and no rebuild.
 */
const NATIONAL_ENTER_SPAN_DEG = 9.5;
const NATIONAL_EXIT_SPAN_DEG = 8;
/**
 * The band, in the view's LARGER span (degrees), across which the maillage
 * hands over to every site: 0.30° → 0.18°.
 *
 * It replaces the 0.32 / 0.35 hysteresis, and its coarse end is where the
 * exact marks could ACTUALLY load, which was never 0.32. The `/sites` box is
 * the view padded by 8 % on each side — 1.16 × the view — and the proxy
 * refuses anything over 0.35° (`AMENITIES_MAX_BOX_DEG`, checked with the same
 * `validBox`), so the widest view it answers is 0.35 / 1.16 = 0.302°. At 0.32°
 * the box was 0.371° and the layer quietly fell back to the maillage. At
 * 0.30° it is 0.348°: the request, the proxy's cap (12 000 rows, rarest family
 * first) and the densest square it can bite in (53 121 dots, Paris) are all
 * unchanged. The fine end is 0.6 × 0.30; coarse / fine = 1.67.
 *
 * The weights are `reveal`, because the band can only sit BELOW the old
 * threshold: the sites are at full strength by 0.30 × 0.6^0.3 = 0.258°, the
 * maillage's own marks are gone by 0.30 × 0.6^0.7 = 0.210°, and the sites own
 * the key from 0.270° in (where the two weights cross). Keeping the maillage
 * down to 0.21° costs a re-pick of the national tuples already in memory —
 * what every maillage settle already pays, now skipped when the box has not
 * moved — and nothing on the wire.
 *
 * And the two levels are not faded into each other wholesale. The maillage is
 * a thinned SUBSET of the very records `/sites` answers (one fold, one id,
 * `meshAmenityId` = `foldAmenitySites`'s key), so a mark both levels hold is
 * drawn once and never fades; only what the sites add comes in, and only what
 * the maillage alone held goes out. See `amenitiesMedecinsAnfrFade.js`.
 */
export const AMENITIES_SITES_BAND = fadeBand(0.18, 0.3);
const CAMERA_DEBOUNCE_MS = 450;
/**
 * Poll cadence (ms). Very long on purpose: BPE is published once a year and
 * FINESS once a month. Six hours is already a hundred times faster than the
 * slower of the two changes; the camera, not the clock, drives this layer.
 */
const POLL_INTERVAL_MS = 6 * 60 * 60_000;
const NATIONAL_TIMEOUT_MS = 180_000;
const VIEWPORT_TIMEOUT_MS = 45_000;
/**
 * Hard cap on rendered dots.
 *
 * 12 000, the same number the proxy caps its own answer at. It USED to be
 * above the densest square the 0.35° ceiling allows anywhere in France —
 * 9 139 dots at 48.65 N, 2.20 E — so it never bit. Since the Cityscan
 * catch-up that same square holds **53 121 dots**, so the proxy's cap now
 * fires hard there and this one still does not: the payload arrives already
 * cut to 12 000.
 *
 * What survives is what a reader would keep: the proxy sends the payload
 * sorted rarest-family-first, so a cap drops restaurants — of which that
 * square holds tens of thousands — long before it touches a hospital.
 * **Both numbers are printed under the toggle**, the proxy's `capped` and this
 * layer's own, because a map that drops three quarters of a view without
 * saying so is not a bounded map, it is a quietly incomplete one. The honest
 * answer at that zoom is the maillage regime, and the label says so.
 */
const MAX_RENDERED_SITES = 12_000;
const POINT_LIFT_M = 2.5;
const GROUND_WARM_LIMIT = 600;

// --- Presentation -----------------------------------------------------------

/**
 * Fourteen keys, thirteen drawn — and a palette rebuilt on 2026-09-15 against
 * a measurement rather than a mood.
 *
 * ── WHAT THE OLD ONE WAS, AND WHAT WAS WRONG WITH IT ────────────────────────
 *
 * The first palette was chosen "mid-dark and warm-leaning" to sit under the
 * layers around it. Two numbers say why that could not hold fourteen families
 * on live imagery:
 *
 *   - **Four pairs sat under ΔE 20**, seven under ΔE 21. The worst was
 *     `pharmacie`/`banque` at **15,9**, then `restaurant`/`commerce` 18,0,
 *     `boulangerie`/`sport` 18,8, `courses`/`sport` 19,0. At the 5-8 px those
 *     families were drawn at, that is the same dot in the same colour.
 *   - **Every hue sat between L\* 32,8 and L\* 63,9.** A mid-dark dot has no
 *     contrast against a forest, a field or a slate roof — which is most of
 *     France from 30 km up. The layer had no legibility channel at all.
 *
 * ── WHAT REPLACED IT ────────────────────────────────────────────────────────
 *
 * The silhouette now names the family (`amenityFamilyIcons.js`), so the hue no
 * longer has to carry recognition alone — but it still has to separate thirteen
 * plates in one street, and a plate is 40 units of flat colour where a dot was
 * 5 px. So the palette was rebuilt to maximise the WORST pair rather than to
 * please the average one, searching OKLCH with each family's hue anchored to
 * its mnemonic (±14-18°) and lightness free to move across five steps.
 *
 * Result, measured the same way as the numbers above: **min ΔE 39,3** over the
 * thirteen drawn families — 2,5× the old worst case — with every L\* at or
 * above **55,7** and the tightest pairs now `culture`/`gendarmerie` 39,3 and
 * `restaurant`/`medecin` 39,3.
 *
 * ── ONE FAMILY IS DELIBERATELY QUIET ────────────────────────────────────────
 *
 * `restaurant` is 186 288 of the 445 380 points — 42 % of everything this layer
 * draws — and it is the one family given LOW chroma (#c37b7f, a dusty rose)
 * rather than a saturated hue of its own. At that share a bright colour is not
 * an identity, it is a wash: the mêlée test showed every other family drowning
 * in it. The fork and knife still name it, and it recedes so the twelve rarer
 * families can be found.
 *
 * ── COLLISIONS WITH THE NEIGHBOURS, AND WHY THEY ARE ACCEPTABLE ─────────────
 *
 * Against `medecins-fr`'s six practice hues the closest pairs are
 * `boulangerie`/`imagerie` at ΔE 10,2, `sport`/`femme-enfant` 11,2 and
 * `poste`/`specialiste` 12,9. Those would have been fatal under the old
 * regime and are not under this one: a croissant is not a trefoil, a dumbbell
 * is not an adult-and-child, an envelope is not a doctor's bag. That is the
 * whole point of moving recognition into the shape channel — the hue may
 * repeat across layers as long as the silhouette does not.
 */
export const AMENITY_COLORS = Object.freeze({
  restaurant: '#c37b7f',
  boulangerie: '#ffbd00',
  commerce: '#ffa868',
  medecin: '#f44f5f',
  banque: '#00ad88',
  sport: '#e652a5',
  culture: '#6e85ff',
  courses: '#f05c03',
  pharmacie: '#329923',
  poste: '#6fb9ff',
  carburant: '#cfd263',
  gendarmerie: '#edaeff',
  piscine: '#00eaff',
  // KEPT, AND NEVER DRAWN. `hopital` left this layer for « Santé & secours » on
  // 2026-09-15 (see {@link AMENITIES_WITHDRAWN_FAMILIES}), but the key cannot be
  // deleted: `AMENITY_FAMILIES` is the mesh's on-the-wire encoding and removing
  // a member renumbers every cached tuple in every pack. The entry stays so a
  // stray row can never fall through `amenityFamilyColor` into a null, and the
  // hue is `medecins-fr`'s own so a screenshot taken mid-migration is not
  // lying about which layer owns the subject.
  hopital: '#f43f5e',
});

/**
 * Plate side per family, in CSS pixels, before the camera ramp.
 *
 * Still a LEGIBILITY rule and still not a magnitude — neither register
 * publishes a capacity for any of these families — but the rule is now applied
 * to a plate rather than a dot, so the numbers moved: a 5 px dot was a speck,
 * and a 15 px plate is the floor at which a punched silhouette still reads
 * (measured on the contact sheet in `amenityFamilyIcons.js`).
 *
 * The ladder is unchanged in SHAPE: the rarer a family is nationally, the
 * larger its plate, so 3 625 bassins are not lost under 186 288 restaurants.
 */
export const AMENITY_POINT_PX = Object.freeze({
  restaurant: 15,
  boulangerie: 16,
  commerce: 16,
  medecin: 17,
  banque: 17,
  sport: 17,
  culture: 18,
  courses: 18,
  pharmacie: 18,
  poste: 19,
  carburant: 19,
  gendarmerie: 21,
  piscine: 21,
  // Never drawn here; kept so the table and the palette stay the same shape.
  hopital: 22,
});

/**
 * Fill alpha per precision band.
 *
 * Not decoration: a mark the register places at a street number and one it
 * places somewhere in the street are different claims, and 17 286 of the 95 406
 * are the second kind.
 *
 * It is now the ONLY channel that carries this, where it used to share the job
 * with a sand halo the two best bands got and the two worst did not. The halo
 * went with the dots on 2026-09-15: every plate carries the same black ring,
 * because the ring is what makes a mark findable on a photograph. The spread
 * below is therefore wider than it was, so the difference still survives being
 * read at a glance.
 */
export const AMENITY_PRECISION_ALPHA = Object.freeze({
  numero: 1,
  // WIDENED on 2026-09-15, from 0.88 / 0.60 / 0.50. The halo used to carry half
  // of this distinction and no longer exists, so the alpha has to carry all of
  // it: 0.88 against 1.00 is a difference nobody sees on a 15 px plate over
  // imagery, where 0.80 against 1.00 reads as "this one is softer".
  //
  // The floor stays well clear of invisible. A mark at 0.42 is still a mark —
  // a register that placed a thing in the right street is telling the truth
  // about the street, and erasing it would be a worse answer than drawing it
  // faintly.
  voie: 0.8,
  approchee: 0.55,
  indeterminee: 0.42,
});

/**
 * Choropleth ramp, low to high — a sequential sand-to-rust scale.
 *
 * Distinct from `schools-fr`'s green and `sup-fr`'s violet on purpose: the
 * three national views never draw at once, but an operator who toggles between
 * them must not carry one quantity's colour into another's. And this one is not
 * even the same KIND of quantity — it is a share, where those two are counts.
 */
const DEPARTEMENT_COLORS = Object.freeze([
  '#5c3510', '#8a4a12', '#b26a26', '#d18f45', '#e3b778', '#f0d9b5',
]);
/**
 * Fill alpha per bin — DESCENDING, and shared with the three sibling count
 * choropleths so one edit cannot desynchronise them.
 *
 * It used to ascend, on the reasoning that "density reads as weight as well as
 * hue". That is true over a constant backdrop and false over live imagery: the
 * darkest swatch was also the most transparent, so on a light city the ground
 * washed it out and the composited lightness ran 67.4 · 65.9 · 65.3 · 65.8 ·
 * 69.6 · 78.0 — a U, with class 1 reading lighter than classes 2 to 4. See
 * `choroplethAlpha.js` for the measurements and the search that produced these
 * numbers, and `choroplethAlpha.test.mjs`, which recomputes the compositing
 * over eight backgrounds and fails on any inversion.
 */
const DEPARTEMENT_ALPHA = CHOROPLETH_FILL_ALPHA;
const SELECTED_COLOR = '#00ffff';
/**
 * Fade and shrink, so a wide box does not stack twelve thousand opaque plates
 * into a mat.
 *
 * Shared instances rather than one per mark: a `Billboard` CLONES a
 * `NearFarScalar` on assignment, and the densest box this layer draws is 12 000
 * of them.
 *
 * Cesium does NOT interpolate a `NearFarScalar` linearly — `czm_nearFarScalar`
 * works on SQUARED distance and then takes `pow(t, 0.2)`, so the falloff is
 * violently front-loaded. Against that curve these four numbers give 100 % of
 * the plate below 900 m, 84 % at 2 km, 68 % at 10 km, 50 % at 30 km and the
 * floor at 60 km — where a 15 px restaurant lands back on 5 px, which is
 * exactly the speck this layer used to draw at every distance.
 */
const MARK_SCALE_BY_DISTANCE = new Cesium.NearFarScalar(900, 1.0, 60_000, 0.34);
const MARK_TRANSLUCENCY = new Cesium.NearFarScalar(900, 1.0, 90_000, 0.4);

/** Plate side for the mark a reader has clicked. */
const SELECTED_POINT_PX = 30;

/** Mesh plates are flatter than exact ones: a sample must not read as an inventory. */
const MESH_SIZE_FACTOR = 0.8;

const DEFAULT_OVERLAY_HOST = Object.freeze({
  setEntries: setOverlayEntries,
  setVisible: setOverlaySourceVisible,
  clearSource: clearOverlaySource,
});

// --- Module state -----------------------------------------------------------

let _viewer = null;
/**
 * The marks, in three collections by what the camera's band does to them —
 * see `amenitiesMedecinsAnfrFade.js`. `_points` holds the exact marks the
 * maillage does not (they come in with the sites), `_meshPoints` the maillage
 * marks the exact answer does not hold (they go out with the maillage), and
 * `_sharedPoints` the marks both levels draw, drawn once and never faded.
 * Outside the band only one of the first two is in use.
 */
let _points = null;
let _meshPoints = null;
let _sharedPoints = null;
let _enabled = false;
let _records = new Map();
let _selectedId = null;
let _count = 0;
let _lastUpdate = null;
let _loading = false;
let _error = null;
let _status = 'idle';
let _regime = 'national';
let _summary = null;
let _national = null;
let _nationalError = null;
let _nationalPromise = null;
let _nationalPainted = false;
let _mesh = null;
let _meshError = null;
let _meshPromise = null;
let _meshPick = null;
let _truncated = 0;
let _requestGeneration = 0;
let _inFlight = null;
let _cameraDebounceTimer = null;
let _cameraChangedAttached = false;
let _preRenderRemover = null;
let _clickHandler = null;
let _depDataSource = null;
let _depEntities = new Map();
let _depMeta = new Map();
let _depShapesPromise = null;
/**
 * One material per bin, kept across repaints. Assigning a NEW material object
 * to an entity rebuilds its ground batch, so a repaint that hands every
 * département the object it already has is free — and showing the level again
 * after the marks is a show-attribute write, not a rebuild.
 */
let _depMaterials = new Map();
/** Codes the rollup paints; the rest are drawn as absence. */
let _depPaintedCodes = new Set();
/** Whether the départements are shown, as the swap last decided. */
let _depShown = false;
/**
 * The national level has answered for this view: painted, or failed. A level
 * that cannot come must not keep the marks on a national view waiting for it.
 */
let _nationalReady = false;
/** The maillage on screen — `{ pick, box }` — or null. */
let _meshLevel = null;
/** The exact answer on screen — `{ payload, key }` — or null. */
let _sitesLevel = null;
/**
 * The marks have answered for the view the camera settled on, possibly with
 * nothing (an empty box, a failed request). Until then the départements hold.
 */
let _pointsAnswered = false;
/** What the last settle asked for — see {@link planAmenitiesLevels}. */
let _plan = null;
/** `watchZoomFade` handle while the layer is enabled. */
let _fade = null;
/** Rewrite every mark's alpha on the next frame: a class was rebuilt or a mark restyled. */
let _fadeForce = false;
/** The scale last written onto the shared marks. */
let _sharedScaleWritten = null;
let _overlayHost = DEFAULT_OVERLAY_HOST;

// --- Pure presentation helpers ---------------------------------------------

/** Hue for one family. Never a fallback colour for an unknown one — null. */
export function amenityFamilyColor(family) {
  return AMENITY_COLORS[family] || null;
}

/** The family's heading, in the page's language. */
export function amenityFamilyLabel(family) {
  return familyLabel(family) || '';
}

/**
 * Pixel size for one dot.
 *
 * `mesh` shrinks it by a fifth, because a maillage dot stands for a sampled
 * neighbourhood and a dot the size of an exact one would invite the eye to read
 * the sample as the inventory.
 */
export function amenityPointSize(family, { mesh = false } = {}) {
  const base = AMENITY_POINT_PX[family];
  if (typeof base !== 'number') return 6;
  return mesh ? Number((base * MESH_SIZE_FACTOR).toFixed(2)) : base;
}

/**
 * Fill alpha for one precision band.
 *
 * Guarded with `typeof`, not coerced: an absent band must not become the best
 * one by way of a default, and `AMENITY_PRECISION_ALPHA[undefined]` is
 * `undefined`, which Cesium would take as opaque.
 */
export function amenityPrecisionAlpha(precision) {
  const alpha = AMENITY_PRECISION_ALPHA[precision];
  return typeof alpha === 'number' ? alpha : AMENITY_PRECISION_ALPHA.indeterminee;
}

/**
 * Whether the register vouches for this position, or merely offers it.
 *
 * It used to decide whether a dot earned a sand halo. The halo went with the
 * dots on 2026-09-15 — every plate carries the same black ring now, because the
 * ring is what makes a mark findable on a photograph and legibility is not
 * something to spend on a data quality flag. The DISTINCTION survives, in the
 * two places it belongs: the plate's alpha (`AMENITY_PRECISION_ALPHA`) and the
 * warning this returns for the card.
 */
export function amenityPositionVouched(precision) {
  return amenityPrecisionRank(precision) >= 2;
}

/**
 * Ramp colour for one choropleth bin.
 *
 * A guard that coerced would be a bug: `Number(null)` is 0, which would paint a
 * département with no communes in the fold as the bottom of the scale instead
 * of leaving it unpainted.
 */
export function amenitiesDepartementColor(bin) {
  if (typeof bin !== 'number' || !Number.isInteger(bin)) return null;
  if (bin < 0 || bin >= DEPARTEMENT_COLORS.length) return null;
  return DEPARTEMENT_COLORS[bin];
}

/** Fill alpha for one choropleth bin. */
export function amenitiesDepartementAlpha(bin) {
  if (typeof bin !== 'number' || !Number.isInteger(bin)) return DEPARTEMENT_ALPHA[0];
  if (bin < 0 || bin >= DEPARTEMENT_ALPHA.length) return DEPARTEMENT_ALPHA[0];
  return DEPARTEMENT_ALPHA[bin];
}

/** The camera rectangle's two spans, in degrees. */
export function amenitiesViewSpanDeg(viewer) {
  const rectangle = viewer?.camera?.computeViewRectangle?.();
  if (!rectangle) return { lat: Infinity, max: Infinity };
  const lat = Cesium.Math.toDegrees(rectangle.north - rectangle.south);
  const lon = Cesium.Math.toDegrees(rectangle.east - rectangle.west);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { lat: Infinity, max: Infinity };
  return { lat, max: Math.max(lat, lon) };
}

/** The camera rectangle as a padded box, or null past the limb. */
export function cameraAmenitiesBox(viewer, padFraction = 0.12) {
  const rectangle = viewer?.camera?.computeViewRectangle?.();
  if (!rectangle) return null;
  const south = Cesium.Math.toDegrees(rectangle.south);
  const north = Cesium.Math.toDegrees(rectangle.north);
  const west = Cesium.Math.toDegrees(rectangle.west);
  const east = Cesium.Math.toDegrees(rectangle.east);
  if (![south, west, north, east].every(Number.isFinite)) return null;
  if (west >= east || south >= north) return null;
  const padLat = (north - south) * padFraction;
  const padLon = (east - west) * padFraction;
  return {
    south: Math.max(-90, south - padLat),
    north: Math.min(90, north + padLat),
    west: Math.max(-180, west - padLon),
    east: Math.min(180, east + padLon),
  };
}

/**
 * A box the `/sites` route will answer, or null when it is over the ceiling.
 *
 * The ceiling is checked with the SAME `validBox` the proxy uses, so the client
 * never spends a round trip discovering a 400 the shared helper could have told
 * it about — and so the two can never drift apart on what "0.35°" means at the
 * dateline or at a degenerate rectangle.
 */
export function amenitiesSitesBox(viewer) {
  const box = cameraAmenitiesBox(viewer, 0.08);
  if (!box) return null;
  return validBox(box, AMENITIES_MAX_BOX_DEG);
}

/**
 * Which levels a settled view loads, and which of them owns the key.
 *
 * National is decided on the latitude span with its hysteresis, as before,
 * and excludes the marks (a hard cut, see {@link NATIONAL_ENTER_SPAN_DEG}).
 * Below it, every level whose weight in {@link AMENITIES_SITES_BAND} is above
 * zero is loaded — both inside the band — and a level whose weight is zero is
 * not. The sites also need a box the proxy will answer; without one (a view
 * crossing the dateline) the maillage is the honest fallback, not a blank.
 *
 * The level with the larger weight owns the key, the status line and the
 * count: `dominant`, which is the regime the rest of this file reads.
 *
 * @param {{lat: number, max: number}} span `amenitiesViewSpanDeg()`.
 * @param {{regime?: string, sitesBox?: boolean}} [context] The regime in force, and
 *   whether `amenitiesSitesBox` gave a box for this view.
 * @returns {{national: boolean, mesh: boolean, sites: boolean, dominant: string,
 *   position: number, weights: {mesh: number, sites: number}}}
 */
export function planAmenitiesLevels(span, { regime = 'national', sitesBox = true } = {}) {
  const lat = Number(span?.lat);
  const national = regime === 'national'
    ? !(lat < NATIONAL_EXIT_SPAN_DEG)
    : !(lat < NATIONAL_ENTER_SPAN_DEG);
  if (national) {
    return {
      national: true, mesh: false, sites: false, dominant: 'national', position: 0, weights: { mesh: 0, sites: 0 },
    };
  }
  const position = bandPosition(Number(span?.max), AMENITIES_SITES_BAND);
  const target = reveal(position);
  const sites = Boolean(sitesBox) && levelVisible(true, target.fine);
  const mesh = !sites || levelVisible(true, target.coarse);
  return {
    national: false,
    mesh,
    sites,
    dominant: sites && target.fine > target.coarse ? 'sites' : 'maillage',
    position,
    weights: { mesh: target.coarse, sites: target.fine },
  };
}

/**
 * Plan the settled view and make its dominant level the regime.
 * @returns {string} The regime.
 */
function updateRegime(viewer) {
  const span = amenitiesViewSpanDeg(viewer);
  _plan = planAmenitiesLevels(span, { regime: _regime, sitesBox: Boolean(amenitiesSitesBox(viewer)) });
  _regime = _plan.dominant;
  return _regime;
}

/**
 * The alpha every level is drawn at, for one frame.
 *
 * Two rules compose. Between the national level and the marks, the hard cut
 * of {@link nationalCutAlphas}: the settled regime is the target, the level
 * being left holds until the one replacing it has answered, and nothing is
 * ever between 0 and 1. Between the maillage and the sites, the fade of
 * {@link meshSitesAlphas}, on the camera's own span this frame — the marks
 * both levels hold stay at full strength, the rest follow their level.
 *
 * Shared marks also GROW across the band, from the maillage's plate (0.8 of
 * the exact one — "a sample must not read as an inventory") to the exact
 * plate, in step with the sites coming in: they are the sample becoming the
 * inventory, and a 20 % jump in two thousand plates at the moment the sites
 * land would be the reload this replaces.
 *
 * @param {number} span The view's larger span this frame, degrees.
 * @param {object} state
 * @returns {{national: number, points: number, mesh: number, sites: number,
 *   shared: number, sharedScale: number, position: number}}
 */
export function amenitiesLevelAlphas(span, {
  regime = 'national', nationalReady = false, pointsReady = false,
  meshReady = false, sitesReady = false, meshArrival = 1, sitesArrival = 1,
} = {}) {
  const cut = nationalCutAlphas({ national: regime === 'national', nationalReady, pointsReady });
  const position = bandPosition(span, AMENITIES_SITES_BAND);
  const band = meshSitesAlphas(position, { meshReady, sitesReady, meshArrival, sitesArrival });
  return {
    national: cut.national,
    points: cut.points,
    mesh: band.mesh * cut.points,
    sites: band.sites * cut.points,
    shared: band.shared * cut.points,
    sharedScale: MESH_SIZE_FACTOR + (1 - MESH_SIZE_FACTOR) * quantizeFade(band.sites),
    position,
  };
}

function sitePosition(site) {
  const floor = cachedGroundFloor(site.lat, site.lon);
  const height = (Number.isFinite(floor) ? floor : 0) + POINT_LIFT_M;
  return Cesium.Cartesian3.fromDegrees(site.lon, site.lat, height);
}

/** Thousands grouped the page's way, matching the rest of the packs. */
function fr(value) {
  return formatNumber(value);
}

/** A share, with the page's decimal mark. Shares are rounded to one decimal. */
function pct(value) {
  return formatDecimal(value, 1);
}

// --- Cards ------------------------------------------------------------------

/**
 * Card copy for one selected dot.
 *
 * Every line is a published value or a stated absence of one. Three of them
 * exist only because a reader would otherwise draw a wrong conclusion from the
 * dot alone: the multiplicity (an address with 146 GPs is one dot), the
 * precision (a dot in the right street is not a dot at the right number), and
 * the register (a pharmacy comes from FINESS and the supermarket next to it
 * from the BPE, and they were geocoded by different people).
 */
export function buildAmenitySelectionLabel(record) {
  const site = record?.site || {};
  const family = site.family;
  const names = Array.isArray(site.names) ? site.names : [];
  const count = Number(site.count) || 0;
  const m = messages().card;
  const title = names[0] || amenityFamilyLabel(family) || m.fallbackTitle;
  const details = [];

  const kinds = Array.isArray(site.kinds) ? site.kinds.filter(Boolean) : [];
  details.push(kinds.length ? kinds.join(' · ') : amenityFamilyLabel(family));

  if (record?.mesh) {
    // A maillage dot carries the family and the precision and nothing else —
    // saying so is what stops the empty half of the card reading as an absence
    // in the register.
    details.push(m.meshDot);
  } else if (count > 1) {
    details.push(m.atThisAddress(fr(count), amenityFamilyPlural(family) || m.fallbackPlural));
    for (const name of names.slice(1)) details.push(`· ${name}`);
    if (site.moreNames > 0) details.push(m.andMore(fr(site.moreNames)));
    if (site.unnamed > 0) details.push(m.unnamed(fr(site.unnamed)));
  } else if (!names.length) {
    details.push(m.noName);
  }

  if (site.commune) details.push(site.commune);

  const precision = site.precision;
  if (precision) {
    const label = amenityPrecisionLabel(precision);
    details.push(amenityPositionVouched(precision) ? m.position(label) : m.positionWarned(label));
  }
  if (site.distance) details.push(m.distance(site.distance));
  if (typeof site.score === 'number') {
    details.push(m.geocoding(site.geocoder || 'ATLASANTE', fr(site.score)));
  }
  if (site.crs) details.push(m.reprojected(site.crs));
  if (site.uai) details.push(m.uai(site.uai));
  if (Array.isArray(site.finess) && site.finess.length) {
    details.push(m.finess(site.finess.join(', ')));
  }

  details.push(site.register === 'finess' ? m.registerFiness : m.registerBpe);
  return [title, ...details].join('\n');
}

/** Card copy for one selected département. */
export function buildAmenitiesDepartementLabel(row) {
  if (!row) return '';
  const m = messages().departement;
  const details = [];
  details.push(row.communes > 0
    ? m.coverage(pct(row.share), fr(row.covered), fr(row.communes))
    : m.noCommune);
  details.push(m.drawn(fr(row.amenities)));
  const mix = AMENITY_FAMILIES
    .filter((family) => (row.families?.[family] || 0) > 0)
    .map((family) => m.familyCount(fr(row.families[family]), amenityFamilyPlural(family)));
  for (const line of mix) details.push(`· ${line}`);
  // The ratio's own blind spot, stated where the ratio is read.
  details.push(m.blindSpot);
  return [row.name, ...details].join('\n');
}

function selectedOverlayEntry(id, position, copy, accent = SELECTED_COLOR) {
  const [title, ...details] = copy.split('\n');
  return {
    id: String(id),
    position,
    variant: 'selected',
    selected: true,
    protected: true,
    paintLane: 'selected',
    collisionGroup: 'ambient-card',
    priority: Number.MAX_SAFE_INTEGER,
    title,
    details,
    accent,
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

/** Protected selected-dot entry for the shared overlay host. */
export function createAmenitySelectedOverlayEntry(record) {
  const position = record?.position;
  if (!record?.id || !position) return null;
  // THE FAMILY'S OWN COLOUR, not the selection cyan. The plate on the globe now
  // goes WHITE when it is picked — Cesium multiplies a billboard's colour, so
  // any other value would tint the artwork and lose the family — which leaves
  // the card as the only surface that can still say which of the thirteen the
  // reader just clicked. See `selectSite`.
  return selectedOverlayEntry(
    record.id,
    position,
    buildAmenitySelectionLabel(record),
    amenityFamilyColor(record.site?.family) || SELECTED_COLOR,
  );
}

/** Ambient label for one département at national altitude. */
export function createAmenitiesDepartementOverlayEntry(row, position) {
  return {
    id: `amenities-fr:dep:${row.code}`,
    position,
    variant: 'label',
    title: `${row.name} · ${pct(row.share)} %`,
    accent: amenitiesDepartementColor(row.bin) || DEPARTEMENT_COLORS[0],
    // Lowest coverage first: the départements worth labelling on this map are
    // the ones where the answer to "where is the nearest one" is "far".
    priority: 100 - (Number(row.share) || 0),
    collisionGroup: 'ambient-label',
    paintLane: 'ambient-label',
    interactive: false,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
  };
}

/** Keep the least-equipped départements, with stable identity as tie-break. */
export function selectAmenitiesLabelCohort(entries, limit = AMENITIES_FR_LABEL_COHORT_LIMIT) {
  const cap = Math.max(0, Math.min(AMENITIES_FR_LABEL_COHORT_LIMIT, Math.floor(Number(limit) || 0)));
  if (!Array.isArray(entries) || cap === 0) return [];
  return entries.slice()
    .sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)))
    .slice(0, cap);
}

/**
 * Thirteen colours and thirteen glyphs, parsed and built once.
 *
 * A `Billboard` CLONES its colour on assignment and Cesium keys its texture
 * atlas on the image STRING, so thirteen data URIs are thirteen atlas entries
 * however many marks share them — but re-deriving either per mark is twelve
 * thousand throwaway parses on a dense Paris box.
 */
const _familyGlyphCache = new Map();
function familyGlyph(family) {
  let glyph = _familyGlyphCache.get(family);
  if (!glyph) {
    glyph = amenityFamilyGlyph(family, { px: AMENITY_GLYPH_RASTER_PX });
    _familyGlyphCache.set(family, glyph);
  }
  return glyph;
}

// --- Selection --------------------------------------------------------------

function restoreRecordStyle(record) {
  if (!record?.point) return;
  record.point.color = Cesium.Color.fromCssColorString(record.baseColor)
    .withAlpha(record.baseAlpha);
  record.point.width = record.baseSize;
  record.point.height = record.baseSize;
  // The fade multiplies whatever colour a mark carries; a restyled mark gets
  // its level's weight back on the next frame instead of waiting for a step.
  _fadeForce = true;
}

function highlightSelectedDepartement() {
  if (!_selectedId?.startsWith?.('dep:')) return;
  const highlight = new Cesium.ColorMaterialProperty(
    Cesium.Color.fromCssColorString(SELECTED_COLOR).withAlpha(0.42),
  );
  for (const entity of _depEntities.get(_selectedId.slice(4)) || []) {
    if (entity.polygon) entity.polygon.material = highlight;
  }
}

function dropDepartementSelection() {
  if (_selectedId?.startsWith?.('dep:')) {
    _selectedId = null;
    _overlayHost.clearSource(AMENITIES_FR_OVERLAY_SOURCE_ID);
  }
}

function clearSelection() {
  if (_selectedId?.startsWith?.('dep:')) {
    repaintDepartements();
  } else if (_selectedId) {
    restoreRecordStyle(_records.get(_selectedId));
  }
  _selectedId = null;
  _overlayHost.clearSource(AMENITIES_FR_OVERLAY_SOURCE_ID);
  governorRequestRender('amenities-fr-clear');
}

function selectSite(id) {
  const record = _records.get(id);
  if (!record) return;
  clearSelection();
  _selectedId = id;
  if (record.point) {
    // WHITE, and no longer cyan. The mark is a tinted plate with a silhouette
    // punched through it, and Cesium MULTIPLIES `billboard.color` — so painting
    // the selection cyan would tint the plate cyan and lose the family the
    // reader just clicked. White is the multiplicative identity: the plate goes
    // to its brightest, the silhouette and the ring stay black, and the card's
    // accent carries the family colour instead.
    record.point.color = Cesium.Color.WHITE;
    record.point.width = SELECTED_POINT_PX;
    record.point.height = SELECTED_POINT_PX;
    _fadeForce = true;
  }
  const entry = createAmenitySelectedOverlayEntry(record);
  if (entry) {
    _overlayHost.setEntries(AMENITIES_FR_OVERLAY_SOURCE_ID, [entry], AMENITIES_FR_OVERLAY_SOURCE_OPTIONS);
  }
  governorRequestRender('amenities-fr-select');
}

function selectDepartement(code) {
  const row = (_national?.departements || []).find((entry) => entry.code === code);
  if (!row) return;
  clearSelection();
  _selectedId = `dep:${code}`;
  highlightSelectedDepartement();
  const anchor = _depMeta.get(code)?.anchor;
  if (anchor) {
    const entry = selectedOverlayEntry(
      _selectedId,
      Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1]),
      buildAmenitiesDepartementLabel(row),
    );
    _overlayHost.setEntries(AMENITIES_FR_OVERLAY_SOURCE_ID, [entry], AMENITIES_FR_OVERLAY_SOURCE_OPTIONS);
  }
  governorRequestRender('amenities-fr-select-dep');
}

function onKeyDown(event) {
  if (event.key === 'Escape' && _selectedId) clearSelection();
}

function pickedDepartementCode(picked) {
  const entity = picked?.id;
  if (!entity?.polygon) return null;
  const code = String(entity.properties?.code?.getValue?.() ?? '').trim();
  return code || null;
}

function installClickHandler(viewer) {
  if (_clickHandler) return;
  _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  _clickHandler.setInputAction((movement) => {
    const picked = pickAt(viewer.scene, movement.position);
    const id = picked?.id;
    if (typeof id === 'string' && _records.has(id)) {
      selectSite(id);
      return;
    }
    if (_regime === 'national') {
      const code = pickedDepartementCode(picked);
      if (code && _depEntities.has(code)) {
        selectDepartement(code);
        return;
      }
    }
    if (_selectedId) clearSelection();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  document.addEventListener('keydown', onKeyDown);
}

/** Keep the selected card pinned to its dot as the camera moves. */
function onPreRender() {
  if (!_enabled || !_selectedId || _selectedId.startsWith('dep:')) return;
  const record = _records.get(_selectedId);
  if (!record) return;
  const entry = createAmenitySelectedOverlayEntry(record);
  if (entry) {
    _overlayHost.setEntries(AMENITIES_FR_OVERLAY_SOURCE_ID, [entry], AMENITIES_FR_OVERLAY_SOURCE_OPTIONS);
  }
}

// --- National regime --------------------------------------------------------

async function ensureDepartementShapes() {
  if (_depShapesPromise) return _depShapesPromise;
  _depShapesPromise = (async () => {
    const geojson = await (await fetch(DEPARTEMENTS_URL)).json();
    _depMeta = parseDepartements(geojson);
    const source = await Cesium.GeoJsonDataSource.load(geojson, {
      clampToGround: true,
      fill: Cesium.Color.TRANSPARENT,
      stroke: Cesium.Color.TRANSPARENT,
      strokeWidth: 0,
    });
    source.name = messages().choroplethName;
    source.show = _enabled;
    for (const entity of source.entities.values) {
      const code = String(entity.properties?.code?.getValue?.() ?? '').trim();
      if (!entity.polygon || !code) {
        entity.show = false;
        continue;
      }
      entity.polygon.outline = false;
      entity.polygon.classificationType = Cesium.ClassificationType.BOTH;
      entity.polygon.material = new Cesium.ColorMaterialProperty(Cesium.Color.TRANSPARENT);
      entity.show = false;
      const parts = _depEntities.get(code);
      if (parts) parts.push(entity);
      else _depEntities.set(code, [entity]);
    }
    if (_viewer) await _viewer.dataSources.add(source);
    _depDataSource = source;
    return source;
  })().catch((error) => {
    // A failed shape load must be retryable, not a permanently poisoned promise
    // that leaves the national view silently empty for the session.
    _depShapesPromise = null;
    throw error;
  });
  return _depShapesPromise;
}

/**
 * Give every département its bin's fill.
 *
 * Paints, and does not decide visibility: whether the level is on screen is
 * the swap's call ({@link amenitiesLevelAlphas}), made per frame, so the
 * départements can stay painted under the marks and come back with a show
 * write rather than a ground-batch rebuild.
 */
function repaintDepartements() {
  if (!_national) return;
  const painted = new Set();
  for (const row of _national.departements || []) {
    const color = amenitiesDepartementColor(row.bin);
    if (!color) continue;
    let material = _depMaterials.get(row.bin);
    if (!material) {
      material = new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString(color).withAlpha(amenitiesDepartementAlpha(row.bin)),
      );
      _depMaterials.set(row.bin, material);
    }
    const parts = _depEntities.get(row.code);
    if (!parts) continue;
    painted.add(row.code);
    for (const entity of parts) {
      if (!entity.polygon) continue;
      // The same object again is no change at all; a new one is a rebuild.
      if (entity.polygon.material !== material) entity.polygon.material = material;
    }
  }
  // A département the rollup does not cover is drawn as absence rather than as
  // the bottom of the scale: it stays hidden whatever the swap decides.
  _depPaintedCodes = painted;
  applyDepartementShow();
  highlightSelectedDepartement();
  _viewer?.scene?.requestRender?.();
}

/** Write `_depShown` onto the entities — at a transition, never per frame. */
function applyDepartementShow() {
  for (const [code, parts] of _depEntities) {
    const show = _depShown && _depPaintedCodes.has(code);
    for (const entity of parts) {
      if (entity.show !== show) entity.show = show;
    }
  }
}

/** Show or hide the national level, with its labels. */
function setDepartementsShown(show) {
  if (show === _depShown) return;
  _depShown = show;
  applyDepartementShow();
  if (show) publishDepartementOverlay();
  else _overlayHost.clearSource(AMENITIES_FR_LABEL_SOURCE_ID);
}

function publishDepartementOverlay() {
  if (!_enabled || _regime !== 'national') {
    _overlayHost.clearSource(AMENITIES_FR_LABEL_SOURCE_ID);
    return;
  }
  const entries = [];
  for (const row of _national?.departements || []) {
    if (!(row.communes > 0)) continue;
    const anchor = _depMeta.get(row.code)?.anchor;
    if (!anchor) continue;
    entries.push(createAmenitiesDepartementOverlayEntry(
      row,
      Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1]),
    ));
  }
  _overlayHost.setEntries(AMENITIES_FR_LABEL_SOURCE_ID, selectAmenitiesLabelCohort(entries), {
    cohortLimit: AMENITIES_FR_LABEL_COHORT_LIMIT,
    collisionCapacity: AMENITIES_FR_LABEL_COLLISION_CAPACITY,
    moving: false,
  });
}

async function ensureNational() {
  if (_national) return _national;
  if (_nationalPromise) return _nationalPromise;
  _nationalPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NATIONAL_TIMEOUT_MS);
    try {
      const response = await fetch('/api/amenities-fr/departements', { signal: controller.signal });
      if (!response.ok) throw new Error(await serverFailureMessage(response));
      const payload = await response.json();
      if (!Array.isArray(payload?.departements)) throw new Error('malformed national rollup');
      _national = payload;
      _nationalError = null;
      return payload;
    } finally {
      clearTimeout(timer);
      _nationalPromise = null;
    }
  })().catch((error) => {
    if (error?.name !== 'AbortError') {
      console.warn('[Data:Amenities-FR] national rollup failed:', error?.message || error);
      _nationalError = error?.message || 'national rollup unavailable';
    }
    return null;
  });
  return _nationalPromise;
}

function hideDepartements() {
  _depShown = false;
  applyDepartementShow();
  _overlayHost.clearSource(AMENITIES_FR_LABEL_SOURCE_ID);
}

/**
 * Load and paint the national level for a settled national view.
 *
 * The marks are NOT cleared here, as they used to be before the outlines had
 * even been fetched: they stay on screen until the départements are painted,
 * and the frame callback swaps the two then ({@link amenitiesLevelAlphas}).
 */
async function loadNational({ force = false } = {}) {
  _error = null;
  // A sites request still in flight is for a view the camera has left.
  _inFlight?.abort?.();
  if (force) {
    // The old paint stays on screen until the new rollup repaints it, so the
    // level stays "ready" through a forced refresh.
    _national = null;
    _nationalPainted = false;
  }
  _loading = !_national;
  const generation = ++_requestGeneration;
  try {
    await ensureDepartementShapes();
  } catch (error) {
    console.warn('[Data:Amenities-FR] département polygons failed:', error?.message || error);
    _error = messages().departementShapesUnavailable;
    _status = 'error';
    _loading = false;
    nationalAnswered();
    return;
  }
  await ensureNational();
  if (generation !== _requestGeneration || !_enabled || _regime !== 'national') return;
  _loading = false;
  if (!_national) {
    _error = _nationalError || 'national rollup unavailable';
    _status = 'error';
    nationalAnswered();
    return;
  }
  _count = _national.painted || 0;
  _lastUpdate = Number(_national.fetchedAt) || Date.now();
  _status = _count > 0 ? 'ready' : 'empty';
  if (!_nationalPainted) {
    _nationalPainted = true;
    repaintDepartements();
  }
  // Already shown (a refresh on a national view): the labels follow the new rollup.
  if (_depShown) publishDepartementOverlay();
  nationalAnswered();
  governorRequestRender('amenities-fr-national');
}

/** The national level has answered: let the swap run now rather than on the next camera move. */
function nationalAnswered() {
  _nationalReady = true;
  _fade?.frame();
}

// --- Maillage regime --------------------------------------------------------

async function ensureMesh() {
  if (_mesh) return _mesh;
  if (_meshPromise) return _meshPromise;
  _meshPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NATIONAL_TIMEOUT_MS);
    try {
      const response = await fetch('/api/amenities-fr/mesh', { signal: controller.signal });
      if (!response.ok) throw new Error(await serverFailureMessage(response));
      const payload = await response.json();
      if (!Array.isArray(payload?.rows)) throw new Error('malformed mesh');
      _mesh = payload;
      _meshError = null;
      return payload;
    } finally {
      clearTimeout(timer);
      _meshPromise = null;
    }
  })().catch((error) => {
    if (error?.name !== 'AbortError') {
      console.warn('[Data:Amenities-FR] national mesh failed:', error?.message || error);
      _meshError = error?.message || 'national mesh unavailable';
    }
    return null;
  });
  return _meshPromise;
}

/**
 * Pick a thinned, family-balanced selection of real positions for one box.
 *
 * Re-picked on every camera settle that moved the box rather than cached: the
 * pick is a function of the box, and re-running seven passes over 95 406
 * tuples costs a few milliseconds against a round trip that would cost a few
 * hundred.
 */
function pickMesh(box) {
  return selectAmenitiesMesh(_mesh?.rows, {
    box,
    // § 3.5 — see `profileCountBudget`. The per-family floor is a share of the
    // budget, so a thinner budget keeps the same protection against erasure.
    budget: profileCountBudget(amenitiesMeshBudget(box.north - box.south)),
    // Passed to the THINNER and not applied after it: the allocator splits the
    // budget across the families it is given, so filtering here is what hands
    // the whole budget to the families the reader asked for. Filtering the
    // result instead would draw one family at a thirteenth of the density the
    // view can afford.
    families: drawnFamilies(),
  });
}

/** The maillage marks one pick draws, as plain entries — no billboard yet. */
function meshEntries(pick) {
  const entries = [];
  const seen = new Set();
  for (const row of pick?.picked || []) {
    if (entries.length >= MAX_RENDERED_SITES) break;
    const lat = row[MESH_LAT];
    const lon = row[MESH_LON];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const family = meshAmenityFamily(row);
    if (familyDeferred(family)) continue;
    const color = amenityFamilyColor(family);
    if (!color) continue;
    const id = meshAmenityId(row);
    if (seen.has(id)) continue;
    seen.add(id);
    const precision = meshAmenityPrecision(row);
    entries.push({
      id,
      family,
      lat,
      lon,
      precision,
      color,
      alpha: amenityPrecisionAlpha(precision),
      size: amenityPointSize(family, { mesh: true }),
    });
  }
  return entries;
}

// --- Sites regime -----------------------------------------------------------

/**
 * The one family this layer stands down from, and only while somebody better
 * is drawing it.
 *
 * `amenities-fr` draws BPE D265 — 61 263 "médecin généraliste" rows — and
 * `medecins-fr` draws the conventioned register, 64 232 addresses. The same
 * cabinet, twice. This layer already applies the rule that settles it: **one
 * register per family**, which is why it refuses the BPE's entire education
 * domain to `schools-fr` and `sup-fr`, and says so in its own legend.
 *
 * THE WITHDRAWAL IS CONDITIONAL, WHICH IS WHY NOTHING IS REMOVED TO PAY FOR
 * IT. The cross-referencing audit (#128) recorded this as blocked on
 * `AMENITY_FAMILIES` being a CACHE KEY — the mesh stores a family by its INDEX
 * in that array, so deleting one silently renames every row of every cached
 * pack and forces a national rebuild. That is all true, and it is only the
 * price of deleting the family. Not drawing it while another layer does costs
 * nothing: the array is untouched, the packs are untouched, and a reader who
 * never opens the Médecins row keeps every doctor this layer ever drew.
 */
/** Plate side in the key, where the swatch is masked rather than tinted. */
const LEGEND_GLYPH_PX = 32;

/**
 * One chip above the key: « Tout ».
 *
 * THIRTEEN CHIPS WOULD HAVE BEEN THE OBVIOUS DESIGN AND IT IS THE WRONG ONE.
 * The row is 300 px wide; thirteen buttons wrap to five lines of a panel that
 * already carries 33 rows, and they would say exactly what the key below them
 * says, twice. The key is the control — each family's own row toggles it — so
 * what is left for a chip is the one thing a key of individual switches is bad
 * at: undoing all of them at once.
 *
 * It is hidden while nothing is filtered, rather than shown disabled: a strip
 * that is empty until it is useful costs no pixel, and this panel's own rule
 * (2026-09-14) is that a dim button nobody can press is a button nobody reads.
 */
function amenityFilterChips() {
  const chips = [];
  if (_families) {
    chips.push({
      id: 'amenities-families-all',
      label: messages().chips.all,
      active: false,
      state: 'idle',
      title: messages().chips.allTitle(AMENITY_DRAWN_FAMILIES.length),
      params: { familles: '' },
    });
  }
  return chips;
}

/**
 * The families this layer no longer draws, and why each one left.
 *
 * ── `hopital` — WITHDRAWN, 2026-09-15, PERMANENTLY ─────────────────────────
 *
 * 2 211 FINESS establishments, moved to « Santé & secours » (`medecins-fr`),
 * which reads them from the same register and draws them with Maki's plain
 * cross beside the 64 232 practice addresses and the DREES accessibility
 * indicator. A hospital is not an everyday errand: a reader who wants one is
 * asking a health question, and every other answer to that question already
 * lives on the other row.
 *
 * NOTHING IS DELETED TO PAY FOR IT, and that is not timidity. `AMENITY_FAMILIES`
 * is the mesh's on-the-wire encoding — a tuple carries its family as an INDEX
 * into that array — so removing a member silently renumbers every row of every
 * cached pack and every share link that ever named one. The family keeps its
 * slot, its colour and its size; it simply is not drawn, exactly the mechanism
 * `AMENITIES_DEFERRED_FAMILY` already uses for `medecin`. The difference is
 * that this withdrawal is unconditional: there is no state in which this layer
 * draws a hospital again.
 *
 * ── `medecin` — DEFERRED, and only while somebody better is drawing it ──────
 *
 * See {@link AMENITIES_DEFERRED_FAMILY} below. Measured on 2026-09-15 against
 * the shipped registers: 74.6 % of the 30 213 BPE dots have a conventioned
 * practice address within 50 m and 91.5 % within 200 m, at a median distance of
 * 10 m where they match. So the two registers really are describing one
 * population, and the 8.5 % the CNAM does not carry is the price of drawing one
 * register per family rather than a blend of two — stated here so it is a
 * decision on the record rather than an omission.
 */
export const AMENITIES_WITHDRAWN_FAMILIES = Object.freeze(['hopital']);

const AMENITIES_DEFERRED_FAMILY = 'medecin';

/**
 * THE FAMILY FILTER — which of the thirteen are drawn right now.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 *
 * Thirteen families over one street is a legible map only if the reader wanted
 * all thirteen. Most of the time they want one: where is the nearest pharmacy,
 * which of these villages still has a bakery. The plates made the families
 * distinguishable; this makes them ASKABLE, and the asking surface is the key
 * itself — every row of the legend is the toggle for its own family, so the
 * mark a reader points at is the control they press.
 *
 * ── WHY THE FILTER IS NOT PURELY A DRAW-TIME MASK ───────────────────────────
 *
 * Because it would be a lie in a city, and the numbers say so. The `/sites`
 * route caps its answer at {@link MAX_RENDERED_SITES} rows and orders them
 * RAREST FAMILY FIRST, so the cap eats the common families: over inner Paris
 * the box holds 53 121 dots and the proxy answers 12 000. Ask that route for
 * "boulangeries only" as a post-filter and you get the boulangeries that
 * survived a cap computed over 53 121 restaurants — which is a sample of a
 * sample, presented as an answer.
 *
 * So the selection goes to the SERVER as `familles=`, and the cap applies to
 * what was asked for. Same reasoning in the maillage regime, one layer down:
 * `selectAmenitiesMesh` allocates a per-family budget so no family can be
 * squeezed off the map, and a filtered pick hands the whole budget to the
 * families that are on. Both are the same rule — a filter must change what is
 * COUNTED, not just what is painted.
 *
 * ── THE EMPTY SELECTION IS "ALL", NOT "NONE" ────────────────────────────────
 *
 * Turning off the last family restores every family instead of blanking the
 * map. A layer that is on and draws nothing is indistinguishable from a broken
 * one, and the reader's way of saying "nothing" is the row's own toggle.
 */
const AMENITY_DRAWN_FAMILIES = Object.freeze(
  AMENITY_FAMILIES.filter((family) => !AMENITIES_WITHDRAWN_FAMILIES.includes(family)),
);

/** Selected families, or null for "all of them" — the default. */
let _families = null;

/** Is this family currently asked for? */
function familySelected(family) {
  return !_families || _families.has(family);
}

/**
 * Normalise a `familles=` parameter into a Set, or null for "all".
 *
 * A closed enum: anything that is not a drawn family is dropped rather than
 * carried, because this value arrives from a share link and an unknown key
 * would otherwise become a filter that matches nothing. A selection that ends
 * up empty — or that names every family there is — is `null`, so the two ways
 * of saying "no filter" cannot drift apart in the share link.
 */
export function parseAmenityFamilies(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const names = (Array.isArray(raw) ? raw : String(raw).split(','))
    .map((name) => String(name).trim())
    .filter((name) => AMENITY_DRAWN_FAMILIES.includes(name));
  if (!names.length || names.length === AMENITY_DRAWN_FAMILIES.length) return null;
  return new Set(names);
}

/** The selection as the share link and the proxy spell it, or '' for "all". */
export function serialiseAmenityFamilies(families) {
  if (!families) return '';
  return AMENITY_DRAWN_FAMILIES.filter((family) => families.has(family)).join(',');
}

/** True while `medecins-fr` is drawing practice POSITIONS. */
let _medecinsDrawing = false;
/** Told when the key changes under the panel's feet — see `setRowControlsListener`. */
let _rowControlsListener = null;
/** Take-down for the watcher. Null while this layer is off. */
let _unwatchMedecins = null;

/**
 * The families a draw pass should consider, for the callers that need the LIST
 * rather than a yes/no — the mesh thinner and the proxy query.
 *
 * `null` means "every family this layer draws", which is what both of those
 * treat as "no filter" and is the state the layer boots in.
 */
function drawnFamilies() {
  const selected = AMENITY_DRAWN_FAMILIES.filter((family) => (
    familySelected(family)
    && !(_medecinsDrawing && family === AMENITIES_DEFERRED_FAMILY)
  ));
  return selected.length === AMENITY_DRAWN_FAMILIES.length ? null : selected;
}

/**
 * Should this family be left to the layer that publishes a better register?
 *
 * Two different answers folded into one question, deliberately: every caller
 * wants "do I draw this", and none of them wants to know whether the reason is
 * permanent. The legend is where the distinction is spelled out, because that
 * is the only place it changes what a reader should do.
 */
function familyDeferred(family) {
  if (AMENITIES_WITHDRAWN_FAMILIES.includes(family)) return true;
  if (!familySelected(family)) return true;
  return _medecinsDrawing && family === AMENITIES_DEFERRED_FAMILY;
}

/** The exact marks one `/sites` answer draws, as plain entries, and how many it did not. */
function siteEntries(payload) {
  const sites = Array.isArray(payload?.sites) ? payload.sites : [];
  const entries = [];
  const seen = new Set();
  for (const site of sites) {
    if (entries.length >= MAX_RENDERED_SITES) break;
    const id = site?.id;
    if (!id || seen.has(id)) continue;
    if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon)) continue;
    if (familyDeferred(site.family)) continue;
    const color = amenityFamilyColor(site.family);
    if (!color) continue;
    seen.add(id);
    entries.push({
      id,
      site,
      color,
      alpha: amenityPrecisionAlpha(site.precision),
      size: amenityPointSize(site.family),
    });
  }
  // Everything the payload carried and this layer did not draw — the render cap
  // if it ever bit, plus any row whose family the palette does not know. The
  // label below does not name a cause it cannot prove; it names the count,
  // which is the difference between a bounded map and a quietly incomplete one.
  // A DEFERRED family is not truncation: those rows are on the map, drawn by
  // the layer that publishes the better register, and counting them here would
  // report a cropped view that is not cropped.
  const deferred = _medecinsDrawing
    ? sites.filter((site) => familyDeferred(site?.family)).length
    : 0;
  return { entries, truncated: Math.max(0, sites.length - deferred - entries.length) };
}

/** One plate. Every mark of every class is drawn by this, so the classes cannot drift. */
function addMark(collection, id, position, family, color, alpha, size) {
  if (!collection) return null;
  return collection.add({
    id,
    position,
    image: familyGlyph(family),
    width: size,
    height: size,
    color: Cesium.Color.fromCssColorString(color).withAlpha(alpha),
    scaleByDistance: MARK_SCALE_BY_DISTANCE,
    translucencyByDistance: MARK_TRANSLUCENCY,
    // The plate stands on the pavement and every building beside it is
    // taller. With the depth test ON, a mark anchored at street level is
    // eaten from below by the ground that is NEARER the camera at those
    // screen pixels — the « parasol » that made these read as marks half
    // sunk into the roofs. `Infinity` is this repository's value everywhere,
    // and it is safe without a horizon curtain because every row drawn came
    // out of the CURRENT view rectangle.
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });
}

/**
 * Draw the marks of the levels on screen, each once, in its class.
 *
 * The exact answer is drawn first, so a position both levels hold is drawn as
 * the EXACT mark — the one with the names and the multiplicity on its card —
 * into the shared collection, and the maillage then draws only what the exact
 * answer does not hold. Ids are shared by construction (`meshAmenityId` is
 * `foldAmenitySites`'s key), so the intersection is exact, not a proximity
 * guess.
 *
 * Billboards are built synchronously, so a redraw of the same levels — a pan —
 * replaces the old marks in the frame it runs in: no gap to cover.
 *
 * @param {?{pick: object, box: object}} meshLevel
 * @param {?{payload: object, key: ?string}} sitesLevel
 */
function drawPoints(meshLevel, sitesLevel) {
  clearSelection();
  _points?.removeAll();
  _meshPoints?.removeAll();
  _sharedPoints?.removeAll();
  _records.clear();
  _meshLevel = meshLevel || null;
  _sitesLevel = sitesLevel || null;
  _meshPick = _meshLevel?.pick || null;

  const mesh = _meshLevel ? meshEntries(_meshLevel.pick) : [];
  const meshIds = new Set(mesh.map((entry) => entry.id));
  const { entries: sites, truncated } = _sitesLevel
    ? siteEntries(_sitesLevel.payload)
    : { entries: [], truncated: 0 };
  _truncated = truncated;

  const warm = [];
  for (const entry of sites) {
    const shared = meshIds.has(entry.id);
    const position = sitePosition(entry.site);
    const point = addMark(
      shared ? _sharedPoints : _points,
      entry.id, position, entry.site.family, entry.color, entry.alpha, entry.size,
    );
    _records.set(entry.id, {
      id: entry.id,
      site: entry.site,
      point,
      position,
      baseColor: entry.color,
      baseAlpha: entry.alpha,
      baseSize: entry.size,
      cls: shared ? 'shared' : 'sites',
      inSites: true,
      inMesh: shared,
    });
    warm.push(entry.site);
  }
  for (const entry of mesh) {
    // Already drawn above, once, as the exact mark.
    if (_records.has(entry.id)) continue;
    // No ground warm-up here: at these altitudes a metre of vertical error is
    // invisible, and 2 200 terrain lookups per pan would not be.
    const position = Cesium.Cartesian3.fromDegrees(entry.lon, entry.lat, POINT_LIFT_M);
    const point = addMark(_meshPoints, entry.id, position, entry.family, entry.color, entry.alpha, entry.size);
    _records.set(entry.id, {
      id: entry.id,
      mesh: true,
      site: {
        id: entry.id,
        family: entry.family,
        lat: entry.lat,
        lon: entry.lon,
        precision: entry.precision,
        count: 0,
        names: [],
        kinds: [],
        commune: '',
        register: null,
      },
      point,
      position,
      baseColor: entry.color,
      baseAlpha: entry.alpha,
      baseSize: entry.size,
      cls: 'mesh',
      inSites: false,
      inMesh: true,
    });
  }
  if (warm.length) warmGroundFloor(warm.slice(0, GROUND_WARM_LIMIT));
  _count = dominantCount();
  // Every mark is new: its level's weight is written on the next frame.
  _fadeForce = true;
  governorRequestRender('amenities-fr-marks');
}

/**
 * Whether a record is part of one level's drawing. A record drawn before the
 * classes existed belongs to whichever level is asked about.
 */
function recordInLevel(record, level) {
  return level === 'mesh' ? record?.inMesh !== false : record?.inSites !== false;
}

/** How many marks the dominant level draws: what the count and the key report. */
function dominantCount() {
  const level = _regime === 'maillage' ? 'mesh' : 'sites';
  let count = 0;
  for (const record of _records.values()) {
    if (recordInLevel(record, level)) count += 1;
  }
  return count;
}

/** Remove one class of marks; the shared marks lose that level's membership. */
function dropClass(cls, collection) {
  if (_selectedId && _records.get(_selectedId)?.cls === cls) clearSelection();
  collection?.removeAll();
  for (const [id, record] of _records) {
    if (record.cls === cls) _records.delete(id);
    else if (record.cls === 'shared') {
      if (cls === 'mesh') record.inMesh = false;
      else record.inSites = false;
    }
  }
  _count = dominantCount();
  governorRequestRender('amenities-fr-drop');
}

/** The maillage has faded out under the sites, and the settled view no longer wants it. */
function dropMeshLevel() {
  if (!_meshLevel) return;
  _meshLevel = null;
  _meshPick = null;
  dropClass('mesh', _meshPoints);
}

/** The sites have faded out under the maillage, and the settled view no longer wants them. */
function dropSitesLevel() {
  if (!_sitesLevel) return;
  _sitesLevel = null;
  _summary = null;
  _truncated = 0;
  dropClass('sites', _points);
}

/** Every mark goes: the départements have taken over, or the layer is off. */
function dropPointLevels() {
  if (_selectedId && !_selectedId.startsWith('dep:')) clearSelection();
  _points?.removeAll();
  _meshPoints?.removeAll();
  _sharedPoints?.removeAll();
  _records.clear();
  _meshLevel = null;
  _sitesLevel = null;
  _meshPick = null;
  _summary = null;
  _truncated = 0;
  _pointsAnswered = false;
}

/** Test seams' names for the two single-level drawings. */
function reconcile(payload) {
  drawPoints(null, { payload, key: null });
}

function reconcileMesh(box) {
  drawPoints({ pick: pickMesh(box), box }, null);
}

/**
 * Ask `/sites` about one box.
 *
 * @returns {Promise<?{payload: object, key: string}|{error: string}>} The level,
 *   an error, or null when the request was aborted — superseded by a newer view
 *   or timed out, which the caller's generation check tells apart.
 */
async function fetchSitesLevel(box, key) {
  _inFlight?.abort?.();
  const controller = new AbortController();
  _inFlight = controller;
  const timer = setTimeout(() => controller.abort(), VIEWPORT_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      south: String(box.south), west: String(box.west),
      north: String(box.north), east: String(box.east),
    });
    // BEFORE THE CAP, NOT AFTER IT. See the note on `_families`: `/sites`
    // answers at most 12 000 rows out of a box that can hold 53 121, so a
    // post-filter would return the survivors of a cap computed over families
    // the reader switched off.
    const asked = serialiseAmenityFamilies(_families);
    if (asked) params.set('familles', asked);
    const response = await fetch(`/api/amenities-fr/sites?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(await serverFailureMessage(response));
    const payload = await response.json();
    return { payload, key };
  } catch (error) {
    if (error?.name === 'AbortError') return null;
    console.warn('[Data:Amenities-FR] viewport failed:', error?.message || error);
    return { error: error?.message || 'viewport unavailable' };
  } finally {
    clearTimeout(timer);
    if (_inFlight === controller) _inFlight = null;
  }
}

/**
 * Load every level of marks the settled view wants, and draw them together.
 *
 * Both requests are awaited before anything is drawn, so a view in the band
 * never shows half of its hand-over, and a pan replaces the whole drawing in
 * one frame. A level the view wants and could not get keeps what it had on
 * screen — an older box is still a true map of the amenities in it — and a
 * level the view no longer wants stays until the frame callback has faded it
 * out under its partner ({@link onFadeFrame}).
 */
async function loadPoints(plan, { force = false } = {}) {
  dropDepartementSelection();
  _error = null;
  const generation = ++_requestGeneration;
  const meshBox = plan.mesh ? cameraAmenitiesBox(_viewer) : null;
  const sitesBox = plan.sites ? amenitiesSitesBox(_viewer) : null;
  const sitesKey = sitesBox ? boxKey(sitesBox) : null;
  const reuseSites = Boolean(sitesKey) && !force && _sitesLevel?.key === sitesKey;
  const reuseMesh = Boolean(meshBox) && !force && Boolean(_meshLevel)
    && boxKey(_meshLevel.box) === boxKey(meshBox);
  if (!sitesBox) _inFlight?.abort?.();
  _loading = Boolean((meshBox && !_mesh) || (sitesBox && !reuseSites));
  const [, fetched] = await Promise.all([
    meshBox && !reuseMesh ? ensureMesh() : null,
    sitesBox && !reuseSites ? fetchSitesLevel(sitesBox, sitesKey) : null,
  ]);
  if (generation !== _requestGeneration || !_enabled || _regime === 'national') return;
  _loading = false;

  const previousMesh = _meshLevel;
  const previousSites = _sitesLevel;
  let nextMesh = previousMesh;
  if (meshBox && !reuseMesh) {
    if (_mesh) nextMesh = { pick: pickMesh(meshBox), box: meshBox };
    else _error = _meshError || 'national mesh unavailable';
  }
  let nextSites = previousSites;
  if (sitesBox && !reuseSites) {
    if (fetched?.payload) nextSites = fetched;
    else _error = fetched?.error || _error || 'viewport unavailable';
  }

  if (nextMesh !== previousMesh || nextSites !== previousSites) drawPoints(nextMesh, nextSites);
  else _count = dominantCount();
  if (nextSites && nextSites !== previousSites) {
    const { sites, ...summary } = nextSites.payload;
    _summary = summary;
    _lastUpdate = Number(nextSites.payload.fetchedAt) || Date.now();
  } else if (nextMesh && nextMesh !== previousMesh) {
    _lastUpdate = Number(_mesh?.fetchedAt) || Date.now();
  }
  // A level arriving over its partner ramps in, and its partner steps down in
  // the same proportion. A redraw of the same level, or the first marks over
  // the départements (a hard cut), swaps in one frame.
  if (nextSites && !previousSites && previousMesh) _fade?.arrive('sites');
  if (nextMesh && !previousMesh && previousSites) _fade?.arrive('mesh');
  _pointsAnswered = true;
  _status = _error ? 'error' : (_count > 0 ? 'ready' : 'empty');
  _fade?.frame();
}

/**
 * Read the viewport, in whichever regime the camera is in.
 *
 * The listener is fired at the END, and that is a fix rather than housekeeping:
 * the key prints a per-family count tallied from `_records`, and `setParams`
 * fires the listener when the reader presses a row — BEFORE the answer to the
 * new question has arrived. Without this second call the panel repaints once
 * with the old records and then waits for its own ~1 Hz poll, which showed
 * « Boulangerie 0 » beside 233 bakeries on screen. Measured over Paris,
 * 2026-09-15.
 */
async function loadViewport({ force = false } = {}) {
  if (!_enabled || !_viewer) return;
  try {
    await loadViewportInner({ force });
  } finally {
    _rowControlsListener?.();
  }
}

async function loadViewportInner({ force = false } = {}) {
  if (!_enabled || !_viewer) return;
  // Whatever this call concludes — records, a zoom-in verdict or a failure —
  // it concludes it about the view the camera is showing right now. See
  // `cameraSettle.js`: an arrival on any other view has to be read afresh.
  markViewportRead(_viewer, AMENITIES_FR_LAYER_ID);
  updateRegime(_viewer);
  if (_plan.national) {
    await loadNational({ force });
    return;
  }
  await loadPoints(_plan, { force });
}

// --- The hand-overs, per frame ------------------------------------------------

/** A level's arrival ramp, 1 when none runs or the layer has no handle. */
function arrivalOf(key, nowMs) {
  return _fade ? _fade.arrival(key, nowMs) : 1;
}

/** Scale the shared marks from the maillage's plate to the exact one. */
function scaleSharedMarks(scale, force) {
  const collection = _sharedPoints;
  if (!collection || typeof collection.get !== 'function') return;
  if (!force && scale === _sharedScaleWritten) return;
  _sharedScaleWritten = scale;
  for (let i = 0; i < collection.length; i += 1) {
    const point = collection.get(i);
    // The selected plate is already drawn at its own size.
    const next = point.id === _selectedId ? 1 : scale;
    if (point.scale !== next) point.scale = next;
  }
}

/** Write one frame's alphas: transitions as show writes, fades through the shared adapter. */
function applyLevelAlphas(alphas) {
  const force = _fadeForce;
  _fadeForce = false;
  setDepartementsShown(levelVisible(_enabled, alphas.national));
  fadeMarkLevel(_points, alphas.sites, { enabled: _enabled, force });
  fadeMarkLevel(_meshPoints, alphas.mesh, { enabled: _enabled, force });
  fadeMarkLevel(_sharedPoints, alphas.shared, { enabled: _enabled, force });
  scaleSharedMarks(alphas.sharedScale, force);
}

/**
 * Per frame: weight arithmetic and adapter writes, nothing else.
 *
 * Nothing here fetches or builds. A level is DROPPED here — its marks removed
 * — only once it has faded out AND the settled view no longer asks for it; a
 * level the camera merely passed over on its way somewhere stays until the
 * next settle decides.
 */
function onFadeFrame(scale, nowMs) {
  if (!_enabled) return;
  const span = Math.max(scale?.latSpan, scale?.lonSpan);
  const alphas = amenitiesLevelAlphas(span, {
    regime: _regime,
    nationalReady: _nationalReady,
    pointsReady: _pointsAnswered,
    meshReady: Boolean(_meshLevel),
    sitesReady: Boolean(_sitesLevel),
    meshArrival: arrivalOf('mesh', nowMs),
    sitesArrival: arrivalOf('sites', nowMs),
  });
  applyLevelAlphas(alphas);
  if (_regime === 'national') {
    if (_pointsAnswered && !levelVisible(true, alphas.points)) dropPointLevels();
  } else if (_plan) {
    if (_meshLevel && !_plan.mesh && !levelVisible(true, alphas.mesh)) dropMeshLevel();
    if (_sitesLevel && !_plan.sites && !levelVisible(true, alphas.sites)) dropSitesLevel();
  }
  _fade?.report({
    levels: {
      national: alphas.national,
      mesh: alphas.mesh,
      sites: alphas.sites,
      shared: alphas.shared,
    },
    // i18n-ignore-next-line — level keys, read by the harness.
    dominant: _regime === 'maillage' ? 'mesh' : _regime,
    bands: {
      'mesh-sites': { fine: AMENITIES_SITES_BAND.fine, coarse: AMENITIES_SITES_BAND.coarse, unit: 'deg-max' },
    },
    hardCuts: {
      'national-points': { enter: NATIONAL_ENTER_SPAN_DEG, exit: NATIONAL_EXIT_SPAN_DEG, unit: 'deg-lat' },
    },
    marks: {
      mesh: _meshPoints?.length ?? 0,
      sites: _points?.length ?? 0,
      shared: _sharedPoints?.length ?? 0,
    },
    sharedScale: alphas.sharedScale,
    pending: _loading,
  });
}

function onCameraChanged() {
  clearTimeout(_cameraDebounceTimer);
  _cameraDebounceTimer = setTimeout(() => {
    void loadViewport();
  }, CAMERA_DEBOUNCE_MS);
}

/**
 * The camera has come to REST — read the view it stopped on. `camera.changed`
 * goes quiet before an eased flight lands, so the load a flight triggers
 * describes a camera still in the air; `cameraSettle.js` carries the
 * measurement and the "have we already read this view" short-circuit.
 *
 * It SUPERSEDES the pending debounce rather than racing it: on a hand pan
 * `moveEnd` arrives while that timer is still armed, and letting both run
 * would ask the same question twice.
 */
function onCameraSettled() {
  if (!_enabled) return;
  clearTimeout(_cameraDebounceTimer);
  _cameraDebounceTimer = null;
  void loadViewport();
}

/** The collection a record's mark lives in, by its class. */
function markCollection(record) {
  if (record?.cls === 'mesh') return _meshPoints;
  if (record?.cls === 'shared') return _sharedPoints;
  return _points;
}

function collectDetectableObjects(options = {}) {
  if (!_enabled || !_records.size) return [];
  const records = [];
  for (const record of _records.values()) {
    // A class faded out is hidden as a whole collection: nothing in it is on screen.
    if (!markCollection(record)?.show) continue;
    if (!record.point?.show && record.id !== _selectedId) continue;
    records.push(record);
  }
  if (!records.length) return [];
  const maxCount = Number.isFinite(options.maxCount)
    ? Math.max(1, Math.floor(options.maxCount))
    : records.length;
  const seed = Number.isFinite(options.seed) ? Math.floor(options.seed) : 0;
  const stride = Math.max(1, Math.ceil(records.length / maxCount));
  const start = ((seed % stride) + stride) % stride;
  const result = [];
  for (let i = start; i < records.length; i += stride) {
    const record = records[i];
    result.push({
      position: record.position,
      sourceId: record.id,
      id: amenityCalloutText(record),
      type: 'Amenity',
      skipLabel: record.id === _selectedId,
    });
    if (result.length >= maxCount) break;
  }
  return result;
}

/**
 * The one line a DETECT callout gets.
 *
 * The name first where there is one, because that is what identifies the thing
 * on screen. A maillage dot has none — the national document carries no names,
 * by design and for 1.5 MB of good reason — so the family label is the honest
 * fallback: it is what the pack actually shipped.
 * @param {object} record
 * @returns {string}
 */
export function amenityCalloutText(record) {
  const site = record?.site || {};
  const label = amenityFamilyLabel(site.family);
  const names = Array.isArray(site.names) ? site.names : [];
  if (!names.length) return label;
  const count = Number(site.count) || 1;
  return count > 1 ? `${names[0]} · +${fr(count - 1)}` : names[0];
}

/** One line under the layer's toggle: what this view actually contains. */
export function buildAmenitiesLoadingLabel({
  regime = _regime,
  status = _status,
  loading = _loading,
  count = _count,
  summary = _summary,
  national = _national,
  meshPick = _meshPick,
  truncated = _truncated,
} = {}) {
  const m = messages().status;
  if (regime === 'maillage') {
    if (loading) return m.loadingMesh;
    if (status === 'error') return '';
    if (!meshPick) return '';
    if (!meshPick.inBox) return m.empty;
    // Naming both numbers is the whole contract of this regime: a thinned map
    // that does not say it is thinned claims France has 1 100 amenities.
    return meshPick.thinned
      ? m.sampled(fr(meshPick.picked.length), fr(meshPick.inBox), meshPick.picked.length)
      : m.inView(fr(meshPick.picked.length));
  }
  if (regime === 'national') {
    if (loading) return m.loadingNational;
    if (status === 'error') return '';
    if (!national) return '';
    const parts = [
      m.nationalShare(pct(national.nationalShare), fr(national.communesPlaced)),
      m.nationalSpread(fr(national.assigned), fr(national.painted)),
    ];
    // The choropleth's own blind spot, stated where the choropleth is read.
    if (national.unassigned > 0) {
      parts.push(m.unpainted(fr(national.unassigned)));
    }
    return parts.join(' · ');
  }
  if (loading) return m.loadingLocal;
  if (status === 'error') return '';
  if (!count) return m.empty;
  const parts = [m.count(fr(count))];
  if (summary?.rows > 0 && summary.rows !== count) {
    parts.push(m.registerRows(fr(summary.rows)));
  }
  if (truncated > 0) parts.push(m.notDrawn(fr(truncated)));
  // The PROXY's cap, which is a different number from the render cap above and
  // now the one that actually bites. Before the Cityscan catch-up the densest
  // square France allows held 9 139 dots and neither cap ever fired; it now
  // holds 53 121, of which the proxy sends 12 000. A map that dropped 41 121
  // équipements without saying so would be exactly the "quietly incomplete"
  // failure the comment above refuses.
  if (summary?.capped > 0) {
    parts.push(m.overCap(fr(summary.capped)));
  }
  return parts.join(' · ');
}

// --- Layer ------------------------------------------------------------------

const amenitiesFranceLayer = {
  id: AMENITIES_FR_LAYER_ID,
  // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
  name: 'Équipements du quotidien (FR)',
  icon: '🏪',
  source: 'BPE 2025 — Insee · FINESS — ARS/ANS',
  // i18n-ignore-end
  updateInterval: POLL_INTERVAL_MS,

  init(viewer) {
    _viewer = viewer;
    // Bottom to top: the maillage's own marks, the exact ones, then the marks
    // both levels hold — so a shared plate is never under a fading one.
    const collection = () => {
      const marks = new Cesium.BillboardCollection({
        scene: viewer.scene,
        blendOption: Cesium.BlendOption.TRANSLUCENT,
      });
      marks.show = false;
      viewer.scene.primitives.add(marks);
      registerSpriteCollection(AMENITIES_FR_LAYER_ID, marks);
      return marks;
    };
    _meshPoints = collection();
    _points = collection();
    _sharedPoints = collection();

    _enabled = false;
    _records = new Map();
    _selectedId = null;
    _count = 0;
    _lastUpdate = null;
    _loading = false;
    _error = null;
    _status = 'idle';
    _summary = null;
    _regime = 'national';
    _nationalPainted = false;
    _meshPick = null;
    _truncated = 0;
    _meshLevel = null;
    _sitesLevel = null;
    _pointsAnswered = false;
    _plan = null;

    _overlayHost.setVisible(AMENITIES_FR_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(AMENITIES_FR_LABEL_SOURCE_ID, false);
    restoreSpriteOrder(viewer);
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    // Which collection and which département is shown is the swap's call,
    // made per frame ({@link onFadeFrame}).
    _fade = watchZoomFade(viewer, AMENITIES_FR_LAYER_ID, onFadeFrame);
    if (_depDataSource) _depDataSource.show = true;
    _overlayHost.setVisible(AMENITIES_FR_OVERLAY_SOURCE_ID, true);
    _overlayHost.setVisible(AMENITIES_FR_LABEL_SOURCE_ID, true);
    installClickHandler(viewer);
    registerPickOwner(AMENITIES_FR_LAYER_ID, (pickedId) => _records.has(pickedId));

    if (!_cameraChangedAttached) {
      viewer.camera.changed.addEventListener(onCameraChanged);
      claimCameraSensitivity(viewer, AMENITIES_FR_LAYER_ID);
      // Arrival, as opposed to motion — see `onCameraSettled`.
      watchCameraSettle(viewer, AMENITIES_FR_LAYER_ID, onCameraSettled);
      _cameraChangedAttached = true;
    }
    if (!_preRenderRemover) {
      _preRenderRemover = viewer.scene.preRender.addEventListener(onPreRender);
    }
    // Stand down from the médecin family while `medecins-fr` draws it, and
    // come back the moment it stops — waiting out this layer's own poll would
    // leave the duplicate on screen for a quarter of an hour.
    _medecinsDrawing = hasJoin('medecins/drawn');
    _unwatchMedecins?.();
    _unwatchMedecins = watchJoin('medecins/drawn', (present) => {
      if (present === _medecinsDrawing) return;
      _medecinsDrawing = present;
      if (_enabled) void loadViewport({ force: true });
    });
    void loadViewport({ force: true });
    restoreSpriteOrder(viewer);
  },

  disable(viewer) {
    _enabled = false;
    _fade?.release();
    _fade = null;
    _requestGeneration += 1;
    _regime = 'national';
    _plan = null;
    _nationalPainted = false;
    clearTimeout(_cameraDebounceTimer);
    _cameraDebounceTimer = null;
    _inFlight?.abort?.();
    _inFlight = null;

    clearSelection();
    dropPointLevels();
    _count = 0;
    hideDepartements();
    if (_depDataSource) _depDataSource.show = false;
    _overlayHost.setVisible(AMENITIES_FR_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(AMENITIES_FR_LABEL_SOURCE_ID, false);

    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
    document.removeEventListener('keydown', onKeyDown);
    unregisterPickOwner(AMENITIES_FR_LAYER_ID);
    _unwatchMedecins?.();
    _unwatchMedecins = null;

    if (_cameraChangedAttached) {
      viewer.camera.changed.removeEventListener(onCameraChanged);
      releaseCameraSensitivity(viewer, AMENITIES_FR_LAYER_ID);
      releaseCameraSettle(viewer, AMENITIES_FR_LAYER_ID);
      _cameraChangedAttached = false;
    }
    if (_preRenderRemover) {
      _preRenderRemover();
      _preRenderRemover = null;
    }

    for (const marks of [_points, _meshPoints, _sharedPoints]) {
      if (marks) marks.show = false;
    }
    _loading = false;
    _status = 'idle';
  },

  async update() {
    if (!_enabled) return;
    await loadViewport({ force: true });
  },

  getDetectableObjects(options = {}) {
    return collectDetectableObjects(options);
  },

  getStats() {
    const stats = {
      count: _count,
      lastUpdate: _lastUpdate,
      loading: _loading,
      status: _status === 'ready' ? 'ok' : _status,
    };
    const label = buildAmenitiesLoadingLabel();
    if (label) stats.loadingLabel = label;
    if (_regime === 'national' ? _national?.stale : _summary?.stale) stats.stale = true;
    if (_error) stats.error = _error;
    return stats;
  },

  /** Viewport provenance for the attribution popover and analyst surfaces. */
  getViewportSummary() {
    return _summary ? { ..._summary } : null;
  },

  /** What the maillage actually drew, against what was in view, per family. */
  getMeshSummary() {
    if (!_meshPick) return null;
    return {
      shown: _meshPick.picked.length,
      inBox: _meshPick.inBox,
      budget: _meshPick.budget,
      cells: _meshPick.cells,
      thinned: _meshPick.thinned,
      perFamily: _meshPick.perFamily,
      nationalRows: _mesh?.rowCount ?? null,
    };
  },

  /** National rollup, for the analyst and for tests. */
  getNationalSummary() {
    if (!_national) return null;
    const { departements, ...rest } = _national;
    return { ...rest, regime: _regime };
  },

  /**
   * The family filter, as parameters — which is what makes it shareable.
   *
   * TWO KEYS, AND THEY ARE NOT INTERCHANGEABLE:
   *
   *   `familles`  — ASSIGNMENT. A comma-separated list, or `''` for "all". This
   *                 is the one the share link carries and the « Tout » chip
   *                 sends.
   *   `basculer`  — TOGGLE. One family name, flipped against the current set.
   *                 This is what a key row sends, because a row is a switch and
   *                 a switch does not know what it is switching to.
   *
   * THEY WERE ONE KEY FOR ABOUT AN HOUR AND THAT WAS A BUG. Overloading
   * `familles` on "does it contain a comma" reads `boulangerie` as a toggle —
   * which is right when a reader presses the row, and catastrophic when a share
   * link restores a selection of exactly one family: the link says « draw only
   * bakeries », the layer starts from "all on", flips that one, and reopens
   * showing the twelve families the sender had turned off. A parameter that
   * means different things depending on how many items it happens to hold is
   * not a parameter, it is a guess.
   */
  setParams(params = {}) {
    const assigning = params.familles !== undefined;
    const toggling = params.basculer !== undefined;
    if (!assigning && !toggling) return false;
    let next;
    if (assigning) {
      next = parseAmenityFamilies(String(params.familles ?? ''));
    } else {
      const family = String(params.basculer ?? '');
      if (!AMENITY_DRAWN_FAMILIES.includes(family)) return false;
      // Starting from "all on" means the first press turns that family OFF,
      // which is what a reader expects from a key where everything is lit.
      const current = new Set(_families || AMENITY_DRAWN_FAMILIES);
      if (current.has(family)) current.delete(family); else current.add(family);
      next = parseAmenityFamilies([...current]);
    }
    if (serialiseAmenityFamilies(next) === serialiseAmenityFamilies(_families)) return false;
    _families = next;
    // A REQUEST, not a repaint. Both close regimes take the selection into the
    // question they ask — the proxy's `familles=` and the thinner's budget — so
    // re-drawing what is already in memory would show a filtered subset of an
    // unfiltered sample. See the note on `_families`.
    if (_enabled) void loadViewport({ force: true });
    _rowControlsListener?.();
    governorRequestRender('amenities-fr-families');
    return true;
  },

  getParams() { return { familles: serialiseAmenityFamilies(_families) }; },

  /** Whether a fan-out from a fused row is about something this layer takes. */
  acceptsParams(params = {}) {
    return params?.familles !== undefined || params?.basculer !== undefined;
  },

  setRowControlsListener(listener) {
    _rowControlsListener = typeof listener === 'function' ? listener : null;
  },

  /**
   * The key for the control-panel row — whichever scale is actually on screen,
   * never both, plus the rows that have no swatch because they have no marks.
   */
  getRowControls() {
    if (_regime === 'national') {
      if (!_national) return { chips: [], legend: [] };
      const shares = (_national.departements || [])
        .filter((row) => row.bin >= 0)
        .map((row) => row.share);
      const floor = shares.length ? Math.min(...shares) : 0;
      const labels = amenitiesDepartementBinLabels(_national.thresholds, floor);
      const counts = new Array(labels.length).fill(0);
      for (const row of _national.departements || []) {
        if (row.bin >= 0 && row.bin < counts.length) counts[row.bin] += 1;
      }
      const legend = labels.map((label, bin) => ({
        label,
        color: amenitiesDepartementColor(bin),
        count: counts[bin],
        blurb: bin === 0 ? messages().nationalLegend.lowest : messages().nationalLegend.other,
      })).filter((row) => row.count > 0);
      // No filter chips at national altitude: the choropleth paints a SHARE
      // computed over five families in the pack, not the marks a filter selects.
      // Offering a control that cannot change what is on screen is worse than
      // offering none.
      return { chips: [], legend };
    }

    const meshRegime = _regime === 'maillage';
    // The key counts the DOMINANT level's marks: inside the band both levels
    // are drawn, and the one with the larger weight owns the key.
    const tally = new Map();
    for (const record of _records.values()) {
      if (!recordInLevel(record, meshRegime ? 'mesh' : 'sites')) continue;
      const family = record.site?.family;
      if (family) tally.set(family, (tally.get(family) || 0) + 1);
    }
    const inView = new Map(
      (_meshPick?.perFamily || []).map((row) => [row.family, row.inBox]),
    );
    // EVERY DRAWN FAMILY GETS A ROW, not just the ones with marks on screen —
    // because each row is now the family's own switch, and a switch that
    // vanishes when you use it cannot be used twice. A family that is on but
    // absent from this view says so with a count of zero; one the reader turned
    // off says so with `off`, and keeps its glyph so the thing they press is
    // still the mark they are looking for.
    const legendWords = messages().legend;
    const legend = AMENITY_DRAWN_FAMILIES
      .filter((family) => !(_medecinsDrawing && family === AMENITIES_DEFERRED_FAMILY))
      .map((family) => {
        const drawn = tally.get(family) || 0;
        const off = !familySelected(family);
        return {
          label: amenityFamilyLabel(family),
          color: amenityFamilyColor(family),
          // The swatch IS the map mark, at key size and minus its ring: the
          // panel masks this raster and paints it with the row's own colour, so
          // an opaque ring would flatten thirteen silhouettes into one disc.
          glyph: amenityFamilyGlyph(family, { px: LEGEND_GLYPH_PX, key: true }),
          count: drawn,
          off,
          // What makes the row a control rather than a caption. `manager.js`
          // turns this into a click that calls `setLayerParams`, so the key and
          // the filter are one surface and cannot disagree.
          toggle: { param: 'basculer', value: family },
          blurb: off
            ? legendWords.off
            : (meshRegime && inView.has(family)
              // Naming the sample per family is the point: the mix on screen is
              // NOT the mix in view, because the thinning deliberately floors
              // the rare families. See `amenitiesMesh.js`.
              ? legendWords.sampled(amenityFamilyBlurb(family), fr(drawn), fr(inView.get(family)), drawn)
              : amenityFamilyBlurb(family)),
        };
      });
    // The conditional withdrawal, given a row for the same reason as the
    // refusal below it: a reader who came looking for doctors is told where
    // they are rather than left to conclude they are missing.
    if (_medecinsDrawing) {
      legend.push({
        label: legendWords.doctorsElsewhere.label,
        color: null,
        count: 0,
        blurb: legendWords.doctorsElsewhere.blurb,
      });
    }
    // The two refusals, each given a row of its own so a reader who came
    // looking for one of them is told where it is instead of concluding the
    // data is missing. Neither takes a swatch: an empty slot is how this panel
    // says « counted, and not mapped here ».
    legend.push({
      label: legendWords.hospitalsElsewhere.label,
      color: null,
      count: 0,
      blurb: legendWords.hospitalsElsewhere.blurb,
    });
    legend.push({
      label: legendWords.schoolsElsewhere.label,
      color: null,
      count: 0,
      blurb: legendWords.schoolsElsewhere.blurb,
    });
    return { chips: amenityFilterChips(), legend };
  },

  destroy(viewer) {
    if (_enabled) this.disable(viewer);
    else {
      clearSelection();
      _overlayHost.setVisible(AMENITIES_FR_OVERLAY_SOURCE_ID, false);
      _overlayHost.setVisible(AMENITIES_FR_LABEL_SOURCE_ID, false);
      if (_clickHandler) {
        _clickHandler.destroy();
        _clickHandler = null;
      }
      document.removeEventListener('keydown', onKeyDown);
      unregisterPickOwner(AMENITIES_FR_LAYER_ID);
    }
    if (_preRenderRemover) {
      _preRenderRemover();
      _preRenderRemover = null;
    }
    if (_depDataSource) {
      viewer.dataSources?.remove?.(_depDataSource, true);
      _depDataSource = null;
    }
    _depEntities = new Map();
    _depMeta = new Map();
    _depShapesPromise = null;
    _depMaterials = new Map();
    _depPaintedCodes = new Set();
    _depShown = false;
    _nationalReady = false;
    _nationalPainted = false;
    for (const marks of [_points, _meshPoints, _sharedPoints]) {
      if (!marks) continue;
      unregisterSpriteCollection(AMENITIES_FR_LAYER_ID, marks);
      viewer.scene?.primitives?.remove?.(marks);
    }
    _points = null;
    _meshPoints = null;
    _sharedPoints = null;
    _viewer = null;
    _national = null;
    _mesh = null;
  },
};

// --- Test seams -------------------------------------------------------------

/**
 * Drive the production paths with no WebGL viewer.
 *
 * Everything the layer draws goes through `_records`, `_national` and `_mesh`,
 * so a test that sets those three exercises the real card builders, the real
 * legend and the real stats rather than re-implementations of them.
 */
export function _setAmenitiesStateForTest({
  regime, records, national, mesh, meshPick, count, status, loading, error,
  summary, selectedId, enabled, viewer, points, overlayHost, depEntities, depMeta,
  truncated, lastUpdate, medecinsDrawing,
  meshPoints, sharedPoints, meshLevel, sitesLevel, plan, nationalReady, pointsAnswered,
  depShown, depPaintedCodes,
} = {}) {
  if (meshPoints !== undefined) _meshPoints = meshPoints;
  if (sharedPoints !== undefined) _sharedPoints = sharedPoints;
  if (meshLevel !== undefined) _meshLevel = meshLevel;
  if (sitesLevel !== undefined) _sitesLevel = sitesLevel;
  if (plan !== undefined) _plan = plan;
  if (nationalReady !== undefined) _nationalReady = nationalReady;
  if (pointsAnswered !== undefined) _pointsAnswered = pointsAnswered;
  if (depShown !== undefined) _depShown = depShown;
  if (depPaintedCodes !== undefined) _depPaintedCodes = new Set(depPaintedCodes);
  if (medecinsDrawing !== undefined) _medecinsDrawing = Boolean(medecinsDrawing);
  if (regime !== undefined) _regime = regime;
  if (records !== undefined) _records = records instanceof Map ? records : new Map(records);
  if (national !== undefined) _national = national;
  if (mesh !== undefined) _mesh = mesh;
  if (meshPick !== undefined) _meshPick = meshPick;
  if (count !== undefined) _count = count;
  if (status !== undefined) _status = status;
  if (loading !== undefined) _loading = loading;
  if (error !== undefined) _error = error;
  if (summary !== undefined) _summary = summary;
  if (selectedId !== undefined) _selectedId = selectedId;
  if (enabled !== undefined) _enabled = enabled;
  if (viewer !== undefined) _viewer = viewer;
  if (points !== undefined) _points = points;
  if (overlayHost !== undefined) _overlayHost = overlayHost || DEFAULT_OVERLAY_HOST;
  if (depEntities !== undefined) _depEntities = depEntities;
  if (depMeta !== undefined) _depMeta = depMeta;
  if (truncated !== undefined) _truncated = truncated;
  if (lastUpdate !== undefined) _lastUpdate = lastUpdate;
}

export function _selectAmenityForTest(id) { selectSite(id); }
export function _selectAmenitiesDepartementForTest(code) { selectDepartement(code); }
export function _clearAmenitiesSelectionForTest() { clearSelection(); }
export function _amenitiesSelectedIdForTest() { return _selectedId; }
export function _amenitiesRowControlsForTest() { return amenitiesFranceLayer.getRowControls(); }
export function _amenitiesStatsForTest() { return amenitiesFranceLayer.getStats(); }
export function _amenitiesDetectablesForTest(options) { return collectDetectableObjects(options); }
export function _amenitiesReconcileForTest(payload) { reconcile(payload); }
export function _amenitiesReconcileMeshForTest(box) { reconcileMesh(box); }
/** Draw both levels at once, as a settle inside the band does. */
export function _amenitiesDrawLevelsForTest({ meshBox = null, payload = null, key = null } = {}) {
  drawPoints(meshBox ? { pick: pickMesh(meshBox), box: meshBox } : null, payload ? { payload, key } : null);
}
/** One production frame of the hand-overs, against a camera of this span. */
export function _amenitiesFadeFrameForTest(span, nowMs = 0) {
  onFadeFrame({ latSpan: span, lonSpan: span }, nowMs);
  return {
    meshLevel: _meshLevel,
    sitesLevel: _sitesLevel,
    pointsAnswered: _pointsAnswered,
    depShown: _depShown,
    records: _records,
  };
}
export function _amenitiesUpdateRegimeForTest(viewer) { return updateRegime(viewer); }
export function _amenitiesTruncatedForTest() { return _truncated; }
/** Test seam: run the half of enable/disable that follows `medecins-fr`. */
export function _amenitiesWatchMedecinsForTest(follow = true) {
  _unwatchMedecins?.();
  _unwatchMedecins = null;
  if (!follow) return;
  _medecinsDrawing = hasJoin('medecins/drawn');
  _unwatchMedecins = watchJoin('medecins/drawn', (present) => {
    if (present === _medecinsDrawing) return;
    _medecinsDrawing = present;
    if (_enabled) void loadViewport({ force: true });
  });
}
export function _amenitiesDeferredFamilyForTest() {
  return _medecinsDrawing ? AMENITIES_DEFERRED_FAMILY : null;
}

export default amenitiesFranceLayer;
