/**
 * @module medecinsFrance
 *
 * Where doctors practise in France, and where a person will struggle to see one.
 *
 * Two questions, and the layer answers them at two different scales, because
 * they have two different answers. Zoomed out, the honest question is **"is
 * there room here?"** — and the DREES's APL is what answers it. Zoomed in, the
 * question is **"who, where, and what will it cost?"** — and that is the
 * register itself, with names.
 *
 * The reason the national regime paints ACCESSIBILITY and not a doctor count is
 * measured, not aesthetic: **the median French person lives 0.7 km from a
 * general practitioner, and only 0.49 % of the population is further than
 * 10 km.** A choropleth of counts would say "France is covered" and be useless.
 * What is scarce is not proximity but capacity — 18 % of the population lives
 * in a commune the ARS class as under-served — and the APL is the only public
 * indicator that measures it.
 *
 *   national — 96 painted départements, coloured by APL. Entered on the view's
 *              LATITUDE span (≥ 9.5°, metropolitan France being 9.8° tall),
 *              never on the larger of the two spans, which on a 16:10 viewport
 *              is mostly a statement about the window's shape.
 *   mesh     — real practice positions, spatially thinned to 1 100–2 200 dots.
 *   sites    — every practice in the box, with the doctors' names on the card.
 *
 * ── What the shape, the colour and the size mean ────────────────────────────
 * In the two close regimes the SHAPE and the COLOUR both say the FAMILY of
 * medicine practised — six of them, cut by what a person is looking for rather
 * than by the nomenclature's own tree (see `medecinsFrFeed.js`). The mark is a
 * tinted plate with the family's silhouette punched out of it
 * (`medecinFamilyIcons.js`): a stethoscope, a cross, an adult and a child, a
 * head, a scalpel, a trefoil. Colour alone was not enough here, and the reason
 * is arithmetic rather than taste — over central Lyon this layer paints 544
 * marks and over central Paris 5 907, none of them labelled, so a reader had to
 * hold six colour-to-word pairs in their head and find the one they wanted by
 * elimination against a key on the other side of the screen.
 *
 * SIZE is the number of DISTINCT DOCTORS at the address, never the number of
 * register entries: a radiologist is listed at every imaging site they cover,
 * 5.53 entries per name against 1.18 for a GP, and sizing on entries would make
 * radiology look like the second-largest specialty in France.
 *
 * ── Where the marks STAND, which is not the ellipsoid ───────────────────────
 * Every mark is placed on the ground under it — the shared DEM/mesh cell when
 * it is warm, a rendered-surface probe while it is not — and re-placed when a
 * better floor lands. Because these draw with the depth test off (they would
 * otherwise be eaten from below by the buildings they stand next to), a mark
 * left on the ellipsoid is painted anyway and its screen position becomes a
 * function of the CAMERA POSE: it SLIDES across the rooftops on a pan instead
 * of staying on its address.
 *
 * Measured over Place Bellecour on 2026-09-14, camera 900 m at −40°, 193 marks
 * drawn: the ellipsoidal anchor projected **171 px from the ground one at the
 * median and 276 px at the worst**, and a 300 m pan and return moved a seated
 * mark **0.00 px at the median, 0.01 px at the worst**.
 *
 * ── What this layer cannot tell you, and says so ────────────────────────────
 * It is conventioned LIBERAL practice. A hospital's salaried doctors are not
 * in the register, so the map thins out around a CHU rather than lighting up
 * over it. And the register publishes no appointment book: whether a doctor
 * takes new patients, and how long the wait is, are the two questions people
 * most want answered and neither is in any public file.
 */

import { formatNumber, formatPercent } from '../i18n/format.js';
import messages from './medecinsFrance.i18n.js';
import * as Cesium from 'cesium';
import { profileCountBudget } from '../perfProfile.js';
import { governorRequestRender } from '../renderGovernor.js';
import { registerSpriteCollection, restoreSpriteOrder, unregisterSpriteCollection } from './spriteOrder.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import { publishJoin } from './layerJoins.js';
import { cachedGroundFloor, coarseFloorCoord, warmGroundFloor } from './groundFloor.js';
import {
  PROVISIONAL_MAX_CAMERA_M,
  provisionalFloor,
  provisionalFloorRetryDelayMs,
  sampleProvisionalFloors,
} from './provisionalFloor.js';
import { MEDECIN_GLYPH_RASTER_PX, medecinFamilyGlyph } from './medecinFamilyIcons.js';
import { parseDepartements } from './meteoFranceVigilance.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import {
  APL_62,
  APL_ALL,
  APL_DEP_62,
  APL_DEP_65,
  APL_DEP_POPULATION,
  MEDECINS_FR_LAYER_ID,
  MEDECINS_MAX_BOX_DEG,
  MEDECINS_NATIONAL_SPAN_DEG,
  aplStandingLabel,
  medecinsSource,
  ETAB_COMMUNE,
  ETAB_FINESS,
  ETAB_KINDS,
  ETAB_LAT,
  ETAB_LON,
  ETAB_NAMES,
  ETAB_PRACTITIONERS,
  ETAB_PRECISION,
  ETAB_UPDATED,
  MEDECIN_FAMILIES,
  MEDECIN_PRACTICE_FAMILIES,
  medecinFamilyLabel,
  medecinPrecisionLabel,
  MESH_FAMILY,
  MESH_LAT,
  MESH_LON,
  MESH_PRACTITIONERS,
  PRACTITIONER_CIVILITE,
  PRACTITIONER_NAME,
  PRACTITIONER_OPTION,
  PRACTITIONER_SECTEUR,
  PRACTITIONER_SPECIALTY,
  SITE_CP,
  SITE_INSEE,
  SITE_KIND,
  SITE_LAT,
  SITE_LON,
  SITE_PRACTITIONERS,
  SITE_PRECISION,
  SITE_TEL,
  SITE_VILLE,
  SITE_VOIE,
  aplDecile,
  aplStanding,
  medecinFamily,
  medecinsMeshBudget,
  medecinsRegime,
  practitionerTariff,
  selectMedecinsMesh,
  siteSpecialtyList,
  sitePrimaryFamily,
  tariffMix,
} from './medecinsFrFeed.js';
import { pickAt } from './pickAt.js';
import {
  bandPosition,
  fadeBand,
  levelVisible,
  reveal,
  watchZoomFade,
} from './zoomFade.js';
import { fadeMarkLevel, meshSitesAlphas, nationalCutAlphas } from './amenitiesMedecinsAnfrFade.js';

export { MEDECINS_FR_LAYER_ID };

const RENDER_PREFIX = 'medecins-fr:';
const OVERLAY_SOURCE_ID = 'medecins-fr-selected';
const OVERLAY_SOURCE_OPTIONS = Object.freeze({ cohortLimit: 1, collisionCapacity: 1, moving: false });
const LABEL_SOURCE_ID = 'medecins-fr-departements';
const LABEL_COHORT_LIMIT = 14;
const LABEL_COLLISION_CAPACITY = 12;

const DEPARTEMENTS_URL = new URL(
  './local_data/france_departements/departements.geojson',
  import.meta.url,
).href;

/** Six families, six colours — categorical, never a ramp. */
export const FAMILY_COLORS = Object.freeze({
  generaliste: '#4ade80',
  'femme-enfant': '#f472b6',
  'sante-mentale': '#c084fc',
  specialiste: '#38bdf8',
  chirurgie: '#fb923c',
  imagerie: '#facc15',
  // The seventh, added 2026-09-15 with the hospitals. Measured against the six
  // above rather than picked: its nearest neighbour is `femme-enfant` at
  // ΔE 40,2, where the tightest pair already on this palette sits at 27,4.
  //
  // It is also within ΔE 6,2 of « Médecin généraliste » in « Équipements du
  // quotidien », and that is safe by CONSTRUCTION rather than by luck: that
  // family stands down whenever this layer draws positions
  // (`layerJoins.js`, key `medecins/drawn`), and this layer only ever draws a
  // hospital while it is drawing positions. The two marks cannot be on one
  // screen.
  hopital: '#f43f5e',
});

const SELECTED_COLOR = '#ffffff';
const GROUND_LIFT_M = 6;

/** Plate side in the key, where the swatch is masked rather than tinted. */
const LEGEND_GLYPH_PX = 32;

/**
 * How far a cold cell may borrow a neighbour's rendered-surface read, and how
 * many cells one pass may warm over the network.
 *
 * `fillKm` is tighter than the shared default (25 km) because this layer's two
 * close regimes never draw a box wider than 0.6° ≈ 67 km, and a French city's
 * ground moves far less over 10 km than a mountain valley's does. The warm cap
 * is the same figure `fraicheurParis.js` uses: a dense Paris box is thousands of
 * practices in a few hundred distinct 111 m cells, and the cap is on CELLS.
 */
const FLOOR_FILL_KM = 10;
const FLOOR_WARM_LIMIT = 400;

/**
 * Plate size ramp, and the distance ramp it rides.
 *
 * A plate big enough to read a stethoscope out of at street level is a blanket
 * over a whole city, so the mark's own side comes from the practice's size and
 * the CAMERA shrinks it back to roughly the speck this layer drew before it had
 * shapes — the montage `sharedMobilityFrance.js` records for its vehicles.
 *
 * Cesium does NOT interpolate a `NearFarScalar` linearly: `czm_nearFarScalar`
 * works on SQUARED distance and then takes `pow(t, 0.2)`, so the falloff is
 * violently front-loaded. Measured against that curve, these four numbers give
 * 100 % of the plate below 900 m, 84 % at 2 km, 68 % at 10 km, 50 % at 30 km and
 * the floor at 60 km — where the sites regime's widest box sits, and where a
 * solo practice lands back on 6.5 px, which is what it used to be drawn at.
 */
const MARK_MIN_PX = 17;
const MARK_MAX_PX = 30;
const MARK_SCALE = Object.freeze({ near: 900, nearValue: 1.0, far: 60_000, farValue: 0.34 });

/**
 * Fade, so a wide box does not stack six thousand opaque plates into a mat.
 * Shared by every mark rather than built per mark: a `Billboard` CLONES a
 * `NearFarScalar` on assignment, and a dense Paris box is 5 907 of them.
 */
const MARK_SCALE_BY_DISTANCE = new Cesium.NearFarScalar(
  MARK_SCALE.near, MARK_SCALE.nearValue, MARK_SCALE.far, MARK_SCALE.farValue,
);
const MARK_TRANSLUCENCY = new Cesium.NearFarScalar(900, 1.0, 90_000, 0.4);

/**
 * The APL ladder, anchored on the two thresholds the ARS actually use.
 *
 * 2.5 and 4 are policy — under-served and well-served — and they are the two
 * cuts that mean something outside this file. The other two exist so a map of
 * 96 départements is not three flat blocks: below 2.0 is the tail the DREES's
 * own first decile sits in (1.32 nationally), and 3.26 is the national mean,
 * so a département either clears the country or it does not.
 */
export const APL_BINS = Object.freeze([
  Object.freeze({ max: 2.0, color: '#7f1d1d' }),
  Object.freeze({ max: 2.5, color: '#dc2626' }),
  Object.freeze({ max: 3.26, color: '#f59e0b' }),
  Object.freeze({ max: 4.0, color: '#84cc16' }),
  Object.freeze({ max: Infinity, color: '#22c55e' }),
]);

/**
 * The rung's words, in the page's language. Separate from the bin because the
 * thresholds are policy and the words are not: `APL_BINS` is read at load,
 * and a catalog never is.
 * @param {number} index
 * @returns {string}
 */
export function aplBinLabel(index) {
  return messages().aplBins[index] ?? '';
}

export function aplBin(value) {
  if (!Number.isFinite(value)) return null;
  for (let index = 0; index < APL_BINS.length; index += 1) {
    if (value <= APL_BINS[index].max) return index;
  }
  return APL_BINS.length - 1;
}

const fr = (value) => (Number.isFinite(value) ? formatNumber(value) : '—');
const pct = (value) => formatPercent(Number((value * 100).toFixed(0)));

/**
 * Plate side from the number of DOCTORS at the address. Square-root, so a
 * fifteen-doctor practice reads as bigger than a solo one without swallowing
 * the street it sits on.
 *
 * The floor is 17 rather than the 5 the bare dots used, because this is the
 * side a punched silhouette has to survive inside: a plate stays a plate at
 * 10 px, but the hole in it stops being a shape well before that. The ceiling
 * is what the distance ramp multiplies, not what is drawn — see
 * {@link MARK_SCALE}.
 */
export function medecinMarkPixelSize(practitioners) {
  const count = Math.max(1, Number(practitioners) || 1);
  return Math.min(MARK_MAX_PX, MARK_MIN_PX + Math.sqrt(count) * 2.0);
}

/**
 * One line saying what a place costs, from its practitioners.
 * Returns null when the site publishes no names — a health centre — because
 * "no tariff information" and "free" are not the same sentence.
 */
export function tariffLine(practitioners) {
  if (!practitioners?.length) return null;
  const mix = tariffMix(practitioners);
  const total = mix.fixe + mix.plafonne + mix.libre + mix.autre;
  if (!total) return null;
  const m = messages().tariff;
  if (mix.fixe === total) return m.allFixed;
  const parts = [];
  if (mix.fixe) parts.push(m.fixed(mix.fixe));
  if (mix.plafonne) parts.push(m.capped(mix.plafonne));
  if (mix.libre) parts.push(m.free(mix.libre));
  if (mix.autre) parts.push(m.other(mix.autre));
  return parts.join(' · ');
}

/**
 * The card for one practice.
 *
 * Ordered by what a person came to find out: where it is, who is there, what
 * it costs, and only then how well the neighbourhood is served. The precision
 * caveat is last and only appears when the position is not the exact door —
 * a card that always disclaims teaches its reader to stop reading.
 *
 * Exported for test: this is where the layer's honesty actually lives.
 */
/**
 * The card of one hospital.
 *
 * A different card from a practice's and not a variant of it, because the two
 * answer different questions. A practice card answers "who consults here, at
 * what price"; FINESS publishes no practitioner, no tariff and no timetable.
 * What it publishes is WHAT THE PLACE IS — the category, and how many legal
 * entities share the roof — so that is what this says.
 *
 * `praticiensSurPlace` is the one number that crosses the two registers, and
 * the card is careful about what it claims: the build counted liberal practice
 * addresses within 50 m of this coordinate, which is not the hospital's staff.
 * A salaried hospital doctor is not in the CNAM's liberal register at all. So
 * the line says « libéraux à cette adresse » and never « médecins de
 * l'hôpital ».
 *
 * @param {Array} etab One `etablissements[]` tuple.
 * @param {object} [context] `{ precision }` from the national payload.
 * @returns {string} Title on the first line, details on the rest.
 */
export function buildHospitalCard(etab, context = {}) {
  const names = String(etab[ETAB_NAMES] || '').split('+').filter(Boolean);
  const kinds = String(etab[ETAB_KINDS] || '').split('+').filter(Boolean);
  const finess = String(etab[ETAB_FINESS] || '').split('+').filter(Boolean);
  const m = messages().hospital;
  const title = names[0] || kinds[0] || m.fallbackTitle;
  const details = [];

  if (etab[ETAB_COMMUNE]) details.push(String(etab[ETAB_COMMUNE]));
  // The category FIRST, because it is the fact a reader came for: a CHU and a
  // « centre hospitalier, ex hôpital local » are not the same errand.
  for (const kind of kinds.slice(0, 3)) details.push(`· ${kind}`);
  if (kinds.length > 3) details.push(m.moreKinds(kinds.length - 3));

  // A campus folded onto one coordinate. Said plainly, because the plate the
  // reader clicked stands for more than one registered establishment.
  if (names.length > 1) {
    details.push(m.entities(fr(names.length), names.slice(1, 4).join(', '), names.length > 4 ? '…' : ''));
  }

  const liberals = Number(etab[ETAB_PRACTITIONERS]) || 0;
  if (liberals > 0) {
    details.push(m.liberals(fr(liberals), liberals));
    details.push(m.liberalsCaveat);
  }

  if (finess.length) details.push(m.finess(finess.slice(0, 2).join(', '), finess.length > 2 ? `, +${finess.length - 2}` : ''));

  const precision = context.precision?.[etab[ETAB_PRECISION]];
  if (precision && precision !== 'numero') {
    // i18n-ignore-next-line — `commune` is BAN's own precision key, not a word
    details.push(precision === 'commune'
      ? m.communeCentre
      : m.position(medecinPrecisionLabel(precision)));
  }
  if (etab[ETAB_UPDATED]) details.push(m.updated(etab[ETAB_UPDATED]));

  return [title, ...details].join('\n');
}

export function buildSiteCard(site, practitioners, context = {}) {
  const { specialites = {}, apl = null } = context;
  const m = messages().practice;
  const title = site[SITE_VILLE] ? `${site[SITE_VOIE] || site[SITE_VILLE]}` : m.fallbackTitle;
  const details = [];

  const place = [site[SITE_CP], site[SITE_VILLE]].filter(Boolean).join(' ');
  if (place) details.push(place);
  if (site[SITE_TEL]) details.push(`☎ ${site[SITE_TEL]}`);
  if (site[SITE_KIND]?.includes('centre-de-sante')) details.push(m.healthCentre);

  const doctors = site[SITE_PRACTITIONERS] || 0;
  const specialties = siteSpecialtyList(site, specialites);
  if (doctors > 0) {
    details.push(m.doctors(fr(doctors), doctors));
  } else if (specialties.length) {
    // A health centre publishes specialties but no names. Say what is known.
    details.push(m.unnamed);
  }

  for (const entry of specialties.slice(0, 6)) {
    details.push(m.specialty(entry.label, entry.count > 1 ? ` (${entry.count})` : ''));
  }
  if (specialties.length > 6) details.push(m.moreSpecialties(specialties.length - 6));

  const tariff = tariffLine(practitioners);
  if (tariff) details.push(tariff);

  for (const entry of (practitioners ?? []).slice(0, 8)) {
    const label = specialites[entry[PRACTITIONER_SPECIALTY]] ?? entry[PRACTITIONER_SPECIALTY];
    const civilite = entry[PRACTITIONER_CIVILITE] === 'F' ? m.civilityF : m.civilityM;
    const cost = practitionerTariff(entry[PRACTITIONER_SECTEUR], entry[PRACTITIONER_OPTION]);
    details.push(m.practitioner(civilite, entry[PRACTITIONER_NAME], label, cost));
  }
  if ((practitioners?.length ?? 0) > 8) {
    details.push(m.morePractitioners(practitioners.length - 8));
  }
  // Where the names would be, when the server has none to give. Only where
  // the register names somebody: a health centre never publishes names, and
  // its card already says so.
  if (doctors > 0 && context.names === 'unavailable') details.push(m.namesUnavailable);
  else if (doctors > 0 && context.names === 'stale') details.push(m.namesStale);

  const commune = apl?.communes?.[site[SITE_INSEE]];
  if (commune) {
    const value = commune[APL_ALL];
    const decile = aplDecile(value, apl.bornes);
    const standing = aplStanding(value, apl.seuils);
    if (Number.isFinite(value)) {
      const tenth = decile ? m.decile(decile) : null;
      details.push(m.access(aplStandingLabel(standing) || '—', tenth ? ` · ${tenth}` : ''));
    }
    const at62 = commune[APL_62];
    if (Number.isFinite(value) && Number.isFinite(at62) && value > 0) {
      details.push(m.retirements(pct(at62 / value - 1)));
    }
  }

  const precision = context.precision?.[site[SITE_PRECISION]];
  if (precision && precision !== 'numero') {
    // i18n-ignore-next-line — `commune` is BAN's own precision key, not a word
    details.push(precision === 'commune' ? m.communeCentre : m.streetOnly(precision));
  }
  const registre = site[11];
  if (registre) details.push(m.published(registre));

  return [title, ...details].join('\n');
}

/** The card for one département, in the national regime. */
export function buildDepartementCard(code, name, row, aplRow, stats) {
  const m = messages().departement;
  const details = [];
  if (aplRow) {
    const value = aplRow[APL_DEP_65];
    // `toFixed`, not the formatter: this figure has always printed with a
    // decimal POINT in French too, and French output does not move.
    details.push(m.apl(value?.toFixed?.(2) ?? '—'));
    const standing = aplStanding(value, stats?.seuils);
    if (standing) details.push(aplStandingLabel(standing));
    const at62 = aplRow[APL_DEP_62];
    const all = aplRow[0];
    if (Number.isFinite(at62) && Number.isFinite(all) && all > 0) {
      details.push(m.retirements(pct(at62 / all - 1)));
    }
    if (aplRow[APL_DEP_POPULATION]) details.push(m.population(fr(aplRow[APL_DEP_POPULATION])));
  }
  if (row) {
    details.push(m.counts(fr(row[0]), fr(row[1])));
  }
  return [name || code, ...details].join('\n');
}

// --- Fade on zoom -------------------------------------------------------------

/**
 * The band, in the view's LARGER span (degrees), across which the mesh hands
 * over to every practice: 0.6° → 0.36°.
 *
 * It replaces the 0.6° line, and its coarse end IS that line, because the
 * finer level cannot be asked for above it: `/sites` takes the camera box
 * unpadded and answers 413 to anything wider than `MEDECINS_MAX_BOX_DEG`
 * (0.6°) on EITHER axis — which is why the old switch, decided on latitude,
 * fell back to the mesh whenever the longitude was wider. Measured on the
 * larger span, the band starts exactly where the request becomes legal, so
 * the box, the 6 000-site cap and the ten-minute cache are all unchanged. The
 * fine end is 0.6 × 0.6 = 0.36°; coarse / fine = 1.67.
 *
 * The weights are `reveal`, because the band can only sit below the old line:
 * the practices are at full strength by 0.6 × 0.6^0.3 = 0.515°, the mesh's own
 * marks are gone by 0.6 × 0.6^0.7 = 0.420°, and the practices own the key from
 * 0.539°. Keeping the mesh down to 0.42° costs a re-pick of the 64 232 tuples
 * the layer already holds, and nothing on the wire.
 *
 * The mesh is a thinned subset of the same practices — `/api/medecins-fr/mesh`
 * writes one tuple per `pack.sites` line, in pack order, and `/sites` answers
 * with those line numbers — so a practice both levels draw is drawn ONCE, at
 * full strength, and only what the practices add fades in (see
 * `amenitiesMedecinsAnfrFade.js`).
 *
 * ── Why the national map is still a HARD CUT ────────────────────────────────
 * The départements carry the DREES's APL — or, under the « Densité » chip,
 * doctors per 100 000 inhabitants — on a five-step ramp, and the marks are
 * practices coloured by family. Different datasets and a different indicator:
 * a crossfade would draw a red « under-served » département through the green
 * plates of its GPs. So the 9.5° line stays a line, and what changed is the
 * blank across it: the level being left now stays on screen until the one
 * replacing it is drawn, and the two trade places in one frame.
 */
export const MEDECINS_SITES_BAND = fadeBand(0.36, MEDECINS_MAX_BOX_DEG);

/**
 * Which levels a settled view loads, and which owns the key, the count and the
 * share link (`dominant`, the layer's regime).
 *
 * @param {{lat: number, max: number}} span The view's latitude span and larger span.
 * @returns {{national: boolean, mesh: boolean, sites: boolean, dominant: string,
 *   position: number, weights: {mesh: number, sites: number}}}
 */
export function planMedecinsLevels(span) {
  if (medecinsRegime(Number(span?.lat)) === 'national') {
    return {
      national: true, mesh: false, sites: false, dominant: 'national', position: 0, weights: { mesh: 0, sites: 0 },
    };
  }
  const position = bandPosition(Number(span?.max), MEDECINS_SITES_BAND);
  const target = reveal(position);
  const sites = levelVisible(true, target.fine);
  const mesh = !sites || levelVisible(true, target.coarse);
  return {
    national: false,
    mesh,
    sites,
    dominant: sites && target.fine > target.coarse ? 'sites' : 'mesh',
    position,
    weights: { mesh: target.coarse, sites: target.fine },
  };
}

/**
 * The alpha every level is drawn at, for one frame: the hard national cut on
 * the settled regime, and the mesh → practices fade on this frame's span.
 *
 * @param {number} span The view's larger span this frame, degrees.
 * @param {object} state
 * @returns {{national: number, points: number, mesh: number, sites: number,
 *   shared: number, position: number}}
 */
export function medecinsLevelAlphas(span, {
  regime = 'national', nationalReady = false, pointsReady = false,
  meshReady = false, sitesReady = false, meshArrival = 1, sitesArrival = 1,
} = {}) {
  const cut = nationalCutAlphas({ national: regime === 'national', nationalReady, pointsReady });
  const position = bandPosition(span, MEDECINS_SITES_BAND);
  const band = meshSitesAlphas(position, { meshReady, sitesReady, meshArrival, sitesArrival });
  return {
    national: cut.national,
    points: cut.points,
    mesh: band.mesh * cut.points,
    sites: band.sites * cut.points,
    shared: band.shared * cut.points,
    position,
  };
}

/** Metres between two WGS-84 points, flat-earth and fine over one viewport. */
function metresApart(aLat, aLon, bLat, bLon) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon) * Math.cos(rad((aLat + bLat) / 2));
  return Math.hypot(dLat, dLon) * 6371000;
}

function overlayEntry(id, position, copy, accent = SELECTED_COLOR) {
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

/** Keep the most populated départements labelled, stably. */
export function selectLabelCohort(entries, limit = LABEL_COHORT_LIMIT) {
  const cap = Math.max(0, Math.min(LABEL_COHORT_LIMIT, Math.floor(Number(limit) || 0)));
  if (!Array.isArray(entries) || cap === 0) return [];
  return entries.slice()
    .sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)))
    .slice(0, cap);
}

/**
 * A stable key for "the same view, for this layer's purposes".
 *
 * `moveEnd` and `changed` both fire on one gesture, and Cesium's rectangle
 * differs between them in the twelfth decimal — `48.777034637322785` against
 * `48.77703463732277`, which is 3 nanometres and was enough to send the same
 * 800 kB box twice. Quantising to 1e-4° (≈ 11 m) collapses them into one
 * without ever merging two views a reader could tell apart: the site regime
 * only ever draws boxes 0.6° wide or less, so 11 m is four thousandths of the
 * narrowest one.
 *
 * The regime is part of the key, so crossing a regime boundary always re-asks
 * even when the rectangle barely moved.
 */
export function boxKey(box, regime) {
  const q = (value) => Math.round(value * 1e4);
  return `${regime}:${q(box.south)}:${q(box.west)}:${q(box.north)}:${q(box.east)}`;
}

/**
 * One practice address, in the words a spoken answer uses.
 *
 * The register counts ENTRIES, not people, and the module header says so at
 * length. That distinction has to survive into the voice payload or the model
 * will happily turn "eight entries" into "eight doctors": `practitioners` is
 * therefore named for what it counts and `countsEntries` states the caveat in
 * the payload itself rather than in a comment nobody downstream reads.
 *
 * Names are deliberately NOT here. They arrive on a second fetch the click
 * triggers, and they are personal data about identified individuals: a layer
 * readout that shipped them would put a list of named doctors into a model
 * prompt on every glance. The card on screen shows them to the human who
 * clicked; the brain gets the shape of the place, not the roster.
 *
 * @param {object|null} record An `_records` entry.
 * @param {object} [context] `{ specialites }` label table, when loaded.
 * @returns {object|null}
 */
export function medecinsSiteReadout(record, { specialites = {} } = {}) {
  if (!record) return null;
  const site = record.site || null;
  const num = (value) => (Number.isFinite(value) ? value : null);
  const specialties = site
    ? siteSpecialtyList(site, specialites).slice(0, 6).map((entry) => ({
      label: entry.label,
      entries: entry.count,
    }))
    : null;
  return {
    id: record.key,
    kind: 'medical-practice',
    // A mesh dot is a thinned national point: it knows a count and a family,
    // never an address. Same honesty as the charge-point layer.
    // i18n-ignore-next-line — join payload keys, read by the LLM context, not drawn
    detail: site ? 'full' : 'count-only',
    address: site ? (site[SITE_VOIE] || null) : null,
    postcode: site ? (site[SITE_CP] || null) : null,
    commune: site ? (site[SITE_VILLE] || null) : null,
    phone: site ? (site[SITE_TEL] || null) : null,
    healthCentre: site ? Boolean(site[SITE_KIND]?.includes('centre-de-sante')) : null,
    lat: num(record.lat),
    lon: num(record.lon),
    practitioners: num(record.practitioners),
    countsEntries: 'practitioners counts REGISTER ENTRIES at this address, not distinct people',
    family: medecinFamilyLabel(record.family) || record.family || null,
    specialties,
    source: medecinsSource(),
  };
}

export function createMedecinsLayer({
  overlayHost = { setEntries: setOverlayEntries, clearSource: clearOverlaySource, setVisible: setOverlaySourceVisible },
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  let _viewer = null;
  /**
   * The marks, in three collections by what the band does to them (see
   * `amenitiesMedecinsAnfrFade.js`): `_marks` the practices the mesh does not
   * hold (they come in), `_meshMarks` the mesh dots the practices answer does
   * not hold (they go out), `_sharedMarks` the practices both levels draw,
   * drawn once and never faded. Outside the band only one of the first two
   * is in use.
   */
  let _marks = null;
  let _meshMarks = null;
  let _sharedMarks = null;
  let _clickHandler = null;
  let _enabled = false;
  let _loading = false;
  let _lastError = null;
  let _lastUpdate = null;

  let _national = null;
  let _mesh = null;
  let _meshPromise = null;
  let _depShapesPromise = null;
  let _depDataSource = null;
  let _depMeta = new Map();
  const _depEntities = new Map();

  let _regime = 'national';
  /** Take-down for the "these cabinets are on the map" join. */
  let _unpublishDrawing = null;
  let _sites = [];
  let _sitesTruncated = false;
  let _sitesBox = null;
  let _records = new Map();
  let _selectedId = null;
  let _cameraRemovers = [];
  let _rowControlsListener = null;
  let _paint = 'apl';
  let _nationalPromise = null;
  let _sitesAbort = null;
  let _lastServedKey = null;
  let _floorRetryTimer = null;
  let _floorRetries = 0;
  /**
   * `packId:siteIndex` → {praticiens, names}, fetched on the click that needs
   * them. Keyed by pack too: an index is a line number of ONE server pack.
   */
  const _practitionerCache = new Map();
  /** The server pack the last `/sites` answer came from. */
  let _packId = null;
  const practitionerKey = (record) => `${record.packId ?? ''}:${record.index}`;

  /** The mesh on screen — `{ rows, box, key }` — or null. */
  let _meshLevel = null;
  /** The practices on screen — `{ rows, payload, box, key }` — or null. */
  let _sitesLevel = null;
  /**
   * The marks have answered for the view the camera settled on, possibly with
   * nothing. Until then the départements hold the screen.
   */
  let _pointsAnswered = false;
  /** The départements are painted for the current chip: the national level is drawn. */
  let _nationalReady = false;
  /** What the last settle asked for — see {@link planMedecinsLevels}. */
  let _plan = null;
  /** One refresh at a time decides; an older one that lands late draws nothing. */
  let _refreshToken = 0;
  /**
   * One material per colour, kept across repaints: assigning a NEW material
   * rebuilds a département's ground batch, and the national view used to do
   * that for all 96 on every camera event.
   */
  const _depMaterials = new Map();
  /** Codes the current chip paints; the rest are drawn as absence. */
  let _depPaintedCodes = new Set();
  /** Whether the départements are shown, as the swap last decided. */
  let _depShown = false;
  /** `watchZoomFade` handle while the layer is enabled. */
  let _fade = null;
  /** Rewrite every mark's alpha on the next frame: a class was rebuilt. */
  let _fadeForce = false;
  /** Mesh tuple → its line in the server pack, which is the `/sites` index. */
  let _meshLines = new WeakMap();

  const renderId = (key) => `${RENDER_PREFIX}${key}`;

  /**
   * The ground one practice stands on: the shared DEM/mesh cell when it is
   * warm, the PROVISIONAL rendered-surface read when it is not, and null when
   * neither has an answer yet.
   *
   * WHY THE SECOND SOURCE EXISTS. `cachedGroundFloor` answers over the NETWORK,
   * and until it does this file used the ellipsoid. Measured over Place
   * Bellecour, the drawn surface sits at 220-309 m of ellipsoidal height — 168 m
   * of Lyon plus 50 m of geoid — so the ellipsoid is the better part of a
   * QUARTER KILOMETRE under the street these marks describe. Every mark here
   * draws with `disableDepthTestDistance: Infinity`, so a buried one is painted
   * anyway and its screen position becomes a function of the CAMERA POSE: pan
   * the map and the practices slide across the rooftops, then jump when the DEM
   * lands. That is the reported "les points ne sont pas bien positionnés",
   * and it is the same defect `sharedMobilityFrance.js` measured on its fleet.
   *
   * @returns {?number} Ellipsoidal floor in metres, or null.
   */
  function recordFloor(lat, lon) {
    const floor = cachedGroundFloor(lat, lon);
    if (Number.isFinite(floor)) return floor;
    const provisional = provisionalFloor(lat, lon);
    return Number.isFinite(provisional) ? provisional : null;
  }

  function markerPosition(lat, lon) {
    return Cesium.Cartesian3.fromDegrees(lon, lat, (recordFloor(lat, lon) ?? 0) + GROUND_LIFT_M);
  }

  /**
   * Whether placing marks on the ground is worth any work at all right now.
   *
   * The ceiling is the shared one, and it is borrowed rather than picked:
   * `sampleProvisionalFloors` already refuses to probe above 25 km because "a
   * ground-height error is worth well under a pixel" there. The same arithmetic
   * settles the DEM warm this file does alongside it — measured over Lyon, a
   * 220 m floor is 5.5 px at 30 km and 2.7 px at 60 km, against a wide mesh box
   * whose plates are 10 px across, and paying for it means up to ten `/api/
   * terrain/heights` round trips per view for a correction nobody can see.
   *
   * Above the ceiling the marks therefore keep the anchor this layer has always
   * given them. That is not a regression the shapes introduced: the ellipsoid
   * was the ONLY anchor at every altitude before, including the street-level one
   * where the same error measured 171 px at the median and is what was reported.
   */
  function floorWorkIsWorthIt() {
    const camera = _viewer?.scene?.camera?.positionCartographic?.height;
    return Number.isFinite(camera) && camera <= PROVISIONAL_MAX_CAMERA_M;
  }

  /** Every drawn practice's coordinate, for the two floor sources. */
  function floorPoints() {
    const points = [];
    for (const record of _records.values()) points.push({ lat: record.lat, lon: record.lon });
    return points;
  }

  /** True while any drawn practice is still standing on no measured floor. */
  function hasColdFloor() {
    for (const record of _records.values()) {
      if (recordFloor(record.lat, record.lon) == null) return true;
    }
    return false;
  }

  /**
   * Ground the cold cells against the surface actually being DRAWN, then warm
   * the DEM behind it.
   *
   * Synchronous, no network of ours, ≤40 probes and nothing at all above 25 km
   * of camera. The DEM warm is fire-and-forget and NOTHING repositions what it
   * resolves, which is the other half of why the retry loop below exists.
   * @returns {number} Cells a later pass could still do better on.
   */
  function sampleFloors() {
    if (!floorWorkIsWorthIt()) return 0;
    const points = floorPoints();
    if (!points.length) return 0;
    const { pending } = sampleProvisionalFloors(_viewer?.scene, points, { fillKm: FLOOR_FILL_KM });
    // Deduped to CELLS and capped on cells, and a cell that is already warm does
    // not spend a slot: that is what lets a second pass reach the cells the
    // first one's cap cut off, instead of re-offering the same 400 for ever.
    const cells = new Map();
    for (const at of points) {
      if (cachedGroundFloor(at.lat, at.lon) != null) continue;
      const cell = coarseFloorCoord(at.lat, at.lon);
      const key = `${cell.lat},${cell.lon}`;
      if (cells.has(key)) continue;
      cells.set(key, cell);
      if (cells.size >= FLOOR_WARM_LIMIT) break;
    }
    if (cells.size) warmGroundFloor([...cells.values()]);
    return pending;
  }

  /**
   * Re-place every drawn mark on the best floor now known for its cell.
   *
   * A `Billboard` position is written ONCE, at `add()`, so a floor that lands
   * after the repaint changes nothing until something walks the set — which is
   * what this is. Cheap: no network, no allocation beyond the new Cartesians.
   * @returns {number} How many marks actually moved.
   */
  function reanchor() {
    let moved = 0;
    for (const record of _records.values()) {
      const mark = record.mark;
      if (!mark || mark.isDestroyed?.() || !mark.position) continue;
      const next = markerPosition(record.lat, record.lon);
      // 5 cm: below this the move is not a pixel anywhere, and rewriting the
      // primitive would only cost the collection a dirty flag.
      if (Cesium.Cartesian3.equalsEpsilon(mark.position, next, 0, 0.05)) continue;
      mark.position = next;
      record.position = next;
      moved += 1;
    }
    // The open card carries a COPY of its practice's anchor, so it has to
    // follow the mark up rather than stay where the buried one used to be.
    if (moved && _selectedId && !_selectedId.startsWith('dep:')) {
      const record = _records.get(_selectedId);
      if (record) {
        const cached = _practitionerCache.get(practitionerKey(record));
        paintSiteCard(_selectedId, record, cached?.praticiens ?? null, cached?.names ?? null);
      }
    }
    return moved;
  }

  /** One deferred floor pass: sample again, re-place, decide whether to return. */
  function refreshFloors() {
    if (!_enabled || !_viewer || !_records.size) return;
    const pending = sampleFloors();
    if (reanchor()) governorRequestRender('medecins-fr-reanchor');
    if (pending || (floorWorkIsWorthIt() && hasColdFloor())) scheduleFloorRetry();
  }

  /**
   * Come back for the practices the surface could not place yet.
   *
   * A probe misses while the tiles under a mark have not streamed — the
   * ordinary state for the second or two after arriving somewhere — and a
   * parked camera produces no repaint, so nothing would ask again. Bounded on
   * purpose: five DOUBLING wake-ups (~37 s in total, `provisionalFloor.js`),
   * refilled only when the situation is new, so ground with no photoreal
   * coverage cannot undo the render governor's idle parking. A fixed-interval
   * loop was measured expiring before a cold stream finished, which leaves the
   * defect whole.
   */
  function scheduleFloorRetry() {
    if (_floorRetryTimer != null) return;
    const delay = provisionalFloorRetryDelayMs(_floorRetries);
    if (delay == null) return; // budget spent — wait for the camera to move
    _floorRetries += 1;
    _floorRetryTimer = setTimeout(() => {
      _floorRetryTimer = null;
      refreshFloors();
    }, delay);
  }

  /** Drops a pending pass and refills its budget: a new view gets a new one. */
  function resetFloorRetries() {
    if (_floorRetryTimer != null) {
      clearTimeout(_floorRetryTimer);
      _floorRetryTimer = null;
    }
    _floorRetries = 0;
  }

  /** Sample, re-place and book a return pass after a repaint. */
  function groundDrawnMarks() {
    const pending = sampleFloors();
    reanchor();
    if (pending || (floorWorkIsWorthIt() && hasColdFloor())) scheduleFloorRetry();
  }

  function cameraBox() {
    const rectangle = _viewer?.camera?.computeViewRectangle?.();
    if (!rectangle) return null;
    const deg = Cesium.Math.toDegrees;
    return {
      south: deg(rectangle.south),
      west: deg(rectangle.west),
      north: deg(rectangle.north),
      east: deg(rectangle.east),
    };
  }

  async function fetchJson(url, signal) {
    const response = await fetchImpl(url, signal ? { signal } : undefined);
    if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
    return response.json();
  }

  async function ensureNational() {
    if (_national) return _national;
    // Guarded, because `moveEnd` and `changed` both fire on the same gesture
    // and two un-guarded refreshes fetched this route twice on every boot.
    if (_nationalPromise) return _nationalPromise;
    _nationalPromise = fetchJson('/api/medecins-fr/national')
      .then((payload) => { _national = payload; return payload; })
      .catch((error) => { _nationalPromise = null; throw error; });
    return _nationalPromise;
  }

  async function ensureMesh() {
    if (_mesh) return _mesh;
    if (_meshPromise) return _meshPromise;
    _meshPromise = fetchJson('/api/medecins-fr/mesh')
      .then((payload) => {
        _mesh = payload;
        // One pass over 64 232 tuples, once a session: the tuple at line `i`
        // is the practice `/sites` calls `index: i`, and that is the join.
        _meshLines = new WeakMap();
        (payload?.sites ?? []).forEach((row, line) => _meshLines.set(row, line));
        return payload;
      })
      .catch((error) => { _meshPromise = null; throw error; });
    return _meshPromise;
  }

  async function ensureDepartementShapes() {
    if (_depShapesPromise) return _depShapesPromise;
    _depShapesPromise = (async () => {
      const geojson = await (await fetchImpl(DEPARTEMENTS_URL)).json();
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
        if (!entity.polygon || !code) { entity.show = false; continue; }
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
      // Retryable, never a permanently poisoned promise that leaves the
      // national view silently empty for the rest of the session.
      _depShapesPromise = null;
      throw error;
    });
    return _depShapesPromise;
  }

  /** The value a département is painted on, under the current chip. */
  function departementValue(code) {
    if (_paint === 'medecins') {
      const row = _national?.departements?.[code];
      const population = _national?.apl?.departements?.[code]?.[APL_DEP_POPULATION];
      if (!row || !population) return null;
      // Per 100 000 inhabitants — a raw count paints Paris and nothing else.
      return (row[0] / population) * 100_000;
    }
    return _national?.apl?.departements?.[code]?.[APL_DEP_65] ?? null;
  }

  function departementColor(code) {
    const value = departementValue(code);
    if (!Number.isFinite(value)) return null;
    if (_paint === 'medecins') {
      // Density has no policy thresholds, so it gets a plain five-step ramp
      // around the national figure rather than borrowed APL cuts.
      const steps = [90, 120, 150, 190];
      const index = steps.findIndex((step) => value <= step);
      return APL_BINS[index < 0 ? APL_BINS.length - 1 : index].color;
    }
    return APL_BINS[aplBin(value)]?.color ?? null;
  }

  /**
   * Give every département the fill of the current chip.
   *
   * Paints, and does not decide visibility: whether the level is on screen is
   * the swap's call ({@link medecinsLevelAlphas}), made per frame. Materials
   * are kept per colour, so a repaint that changes nothing rebuilds nothing.
   */
  function repaintDepartements() {
    if (!_national) return;
    const painted = new Set();
    for (const code of _depEntities.keys()) {
      const color = departementColor(code);
      if (!color) continue;
      let material = _depMaterials.get(color);
      if (!material) {
        material = new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString(color).withAlpha(0.55));
        _depMaterials.set(color, material);
      }
      painted.add(code);
      for (const entity of _depEntities.get(code)) {
        if (!entity.polygon) continue;
        // The same object again is no change at all; a new one is a rebuild.
        if (entity.polygon.material !== material) entity.polygon.material = material;
      }
    }
    // A département the rollup does not cover is drawn as absence, not as the
    // bottom of the scale. Overseas départements have no APL row at all.
    _depPaintedCodes = painted;
    applyDepartementShow();
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
    if (show) publishDepartementLabels();
    else overlayHost.clearSource(LABEL_SOURCE_ID);
  }

  function publishDepartementLabels() {
    if (!_enabled || _regime !== 'national' || !_national) {
      overlayHost.clearSource(LABEL_SOURCE_ID);
      return;
    }
    const entries = [];
    for (const [code, meta] of _depMeta) {
      const anchor = meta?.anchor;
      const value = departementValue(code);
      if (!anchor || !Number.isFinite(value)) continue;
      const population = _national.apl?.departements?.[code]?.[APL_DEP_POPULATION] ?? 0;
      entries.push({
        id: `medecins-fr:dep:${code}`,
        position: Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1]),
        variant: 'label',
        title: `${meta.name ?? code} · ${_paint === 'apl' ? value.toFixed(2) : Math.round(value)}`,
        accent: departementColor(code) ?? '#38bdf8',
        priority: population,
        collisionGroup: 'ambient-label',
        paintLane: 'ambient-label',
        interactive: false,
        edgeFade: 'keyhole',
        horizonCull: true,
        terrainOcclusion: false,
        gapPx: 15,
        verticalOnly: true,
        placement: 'above',
      });
    }
    overlayHost.setEntries(LABEL_SOURCE_ID, selectLabelCohort(entries), {
      cohortLimit: LABEL_COHORT_LIMIT,
      collisionCapacity: LABEL_COLLISION_CAPACITY,
    });
  }

  function clearSelection() {
    _selectedId = null;
    overlayHost.clearSource(OVERLAY_SOURCE_ID);
    governorRequestRender('medecins-fr-clear');
  }

  function paintSiteCard(id, record, praticiens, names = null) {
    const copy = buildSiteCard(record.site, praticiens, {
      specialites: _national?.specialites,
      precision: _national?.precision,
      apl: _national?.apl,
      names,
    });
    overlayHost.setEntries(
      OVERLAY_SOURCE_ID,
      [overlayEntry(`${id}:card`, record.position, copy, FAMILY_COLORS[record.family] ?? SELECTED_COLOR)],
      OVERLAY_SOURCE_OPTIONS,
    );
    governorRequestRender('medecins-fr-select');
  }

  /**
   * The names at one address, or why there are none.
   *
   * 409 is the server saying its pack was rebuilt since these dots were drawn:
   * their indices are line numbers of the OLD pack, and asking again with them
   * would put this week's names on last week's addresses.
   */
  async function fetchPractitioners(record) {
    const params = new URLSearchParams({ index: String(record.index), pack: record.packId ?? '' });
    const response = await fetchImpl(`/api/medecins-fr/praticiens?${params}`);
    if (response.status === 409) {
      const body = await response.json().catch(() => ({}));
      return { stale: true, packId: body?.packId ?? null };
    }
    if (!response.ok) throw new Error(`/api/medecins-fr/praticiens → HTTP ${response.status}`);
    return response.json();
  }

  /**
   * Open a card, and fetch the doctors' names for it.
   *
   * The names are NOT in the `/sites` payload on purpose — over central Paris
   * they were 40 % of 1 451 kio, shipped to draw 5 907 dots of which a reader
   * opens one. So the card paints immediately from what the dot already knows,
   * and fills in the names when they land. Cached per address, because a
   * reader who closes a card and reopens it should not pay twice.
   *
   * A server without names (a clone that never ran the build) answers
   * `names: false`, and the card says so instead of listing nobody.
   */
  function selectSite(id) {
    const record = _records.get(id);
    if (!record) return;
    // A mesh dot is one of a SAMPLE drawn to show where practices are, and
    // carries no address of its own (`site: null`): there is no card for it,
    // and building one threw on `site[SITE_VILLE]`. Inside the mesh → sites
    // band only the dots the sites did not replace are still mesh records.
    if (!record.site && !record.etab) {
      if (_selectedId) clearSelection();
      return;
    }
    _selectedId = id;
    // A hospital has no `/praticiens` index to fetch and no names to fill in:
    // FINESS publishes establishments, not people. Its card is complete the
    // moment it is painted.
    if (record.etab) {
      overlayHost.setEntries(
        OVERLAY_SOURCE_ID,
        [overlayEntry(
          `${id}:card`,
          record.position,
          buildHospitalCard(record.etab, { precision: _national?.precision }),
          FAMILY_COLORS.hopital ?? SELECTED_COLOR,
        )],
        OVERLAY_SOURCE_OPTIONS,
      );
      governorRequestRender('medecins-fr-select');
      return;
    }
    const key = practitionerKey(record);
    const cached = _practitionerCache.get(key);
    paintSiteCard(id, record, cached?.praticiens ?? null, cached?.names ?? null);
    if (cached || record.index === undefined) return;
    fetchPractitioners(record)
      .then((payload) => {
        if (payload.stale) {
          // Re-read the sites under the new pack, and say why this card has
          // no names rather than leave it looking complete.
          _packId = payload.packId ?? _packId;
          if (_selectedId === id) paintSiteCard(id, record, null, 'stale');
          refresh({ force: true });
          return;
        }
        const entry = {
          praticiens: payload.praticiens ?? [],
          names: payload.names === false ? 'unavailable' : null,
        };
        _practitionerCache.set(key, entry);
        // Only if the reader is still looking at this card.
        if (_selectedId === id) paintSiteCard(id, record, entry.praticiens, entry.names);
      })
      .catch(() => { /* the card is already useful without the names */ });
  }

  function selectDepartement(code) {
    const anchor = _depMeta.get(code)?.anchor;
    if (!anchor) return;
    _selectedId = `dep:${code}`;
    const copy = buildDepartementCard(
      code,
      _depMeta.get(code)?.name,
      _national?.departements?.[code],
      _national?.apl?.departements?.[code],
      { seuils: _national?.apl?.seuils },
    );
    overlayHost.setEntries(
      OVERLAY_SOURCE_ID,
      [overlayEntry(`medecins-fr:dep-card:${code}`, Cesium.Cartesian3.fromDegrees(anchor[0], anchor[1]), copy)],
      OVERLAY_SOURCE_OPTIONS,
    );
    governorRequestRender('medecins-fr-select-dep');
  }

  /**
   * Six colours and six glyphs, parsed and built once.
   *
   * A `Billboard` CLONES its colour on assignment and Cesium keys its texture
   * atlas on the image STRING, so six data URIs are six atlas entries however
   * many marks share them — but re-deriving either per mark is six thousand
   * throwaway parses on a dense Paris box.
   */
  const _familyColor = new Map();
  const _familyGlyph = new Map();
  function familyColor(family) {
    const key = FAMILY_COLORS[family] ? family : 'specialiste';
    let color = _familyColor.get(key);
    if (!color) {
      color = Cesium.Color.fromCssColorString(FAMILY_COLORS[key]);
      _familyColor.set(key, color);
    }
    return color;
  }
  function familyGlyph(family) {
    const key = FAMILY_COLORS[family] ? family : 'specialiste';
    let glyph = _familyGlyph.get(key);
    if (!glyph) {
      glyph = medecinFamilyGlyph(key, { px: MEDECIN_GLYPH_RASTER_PX });
      _familyGlyph.set(key, glyph);
    }
    return glyph;
  }

  /**
   * Plate side for a hospital, in CSS pixels.
   *
   * FIXED, where a practice's side comes from its practitioner count — and the
   * difference is a statement rather than an oversight. A practice's size means
   * "how many doctors"; FINESS publishes no bed count, no staff and no
   * catchment, so a hospital has no magnitude to draw. What it has is a claim
   * on the reader's attention that a single consulting room does not, so it
   * takes the top of the practice ramp and stays there.
   */
  const HOSPITAL_MARK_PX = MARK_MAX_PX;

  /**
   * How close a practice has to be to a hospital to be drawn as part of it.
   *
   * The same 50 m the build used, and the reason it is repeated here rather
   * than imported is that these are two different jobs: the build COUNTS the
   * practitioners at the address, this HIDES the plate that would stack on top
   * of the hospital's. 1 113 of the 2 211 hospitals have at least one, at a
   * median distance of 0 m — they are the same coordinate — so without this the
   * move would have added 1 113 hospitals and buried 1 113 practices.
   */
  const HOSPITAL_ABSORB_M = 50;
  const HOSPITAL_ABSORB_DEG = HOSPITAL_ABSORB_M / 111_320;

  /** Hospitals inside the current view, as `drawMarks` rows. */
  function hospitalRows(box) {
    const table = _national?.etablissements;
    if (!Array.isArray(table) || !table.length) return [];
    const rows = [];
    for (let index = 0; index < table.length; index += 1) {
      const etab = table[index];
      const lat = etab[ETAB_LAT];
      const lon = etab[ETAB_LON];
      if (lat < box.south || lat > box.north || lon < box.west || lon > box.east) continue;
      rows.push({
        key: `etab:${index}`,
        lat,
        lon,
        // Read by `medecinMarkPixelSize` nowhere — `addMark` branches on the
        // family and gives a hospital its fixed side.
        practitioners: Number(etab[ETAB_PRACTITIONERS]) || 0,
        family: 'hopital',
        site: null,
        etab,
      });
    }
    return rows;
  }

  /**
   * Drop the practice plates a hospital plate would sit on top of.
   *
   * Cheap on purpose: the hospitals in view are at most a few dozen, so this is
   * a linear scan per practice against a small array rather than a second
   * spatial index. A degree box first, the metric distance only for the
   * handful that survive it.
   */
  function absorbedByHospital(rows, hospitals) {
    if (!hospitals.length) return rows;
    return rows.filter((row) => !hospitals.some((etab) => (
      Math.abs(etab.lat - row.lat) <= HOSPITAL_ABSORB_DEG
      && Math.abs(etab.lon - row.lon) <= HOSPITAL_ABSORB_DEG / Math.max(0.2, Math.cos(row.lat * Math.PI / 180))
      && metresApart(etab.lat, etab.lon, row.lat, row.lon) <= HOSPITAL_ABSORB_M
    )));
  }

  /** One plate, for every class: the classes cannot drift apart in look. */
  function addMark(collection, row, membership) {
    const id = renderId(row.key);
    const position = markerPosition(row.lat, row.lon);
    // A hospital has no magnitude to draw; a practice does. See
    // `HOSPITAL_MARK_PX` for why that is a statement and not a default.
    const side = row.family === 'hopital'
      ? HOSPITAL_MARK_PX
      : medecinMarkPixelSize(row.practitioners);
    const mark = collection?.add({
      id,
      position,
      image: familyGlyph(row.family),
      width: side,
      height: side,
      color: familyColor(row.family),
      scaleByDistance: MARK_SCALE_BY_DISTANCE,
      translucencyByDistance: MARK_TRANSLUCENCY,
      // The mark stands on the pavement, and every building it stands next to
      // is taller than it. With the depth test ON, a plate anchored at street
      // level is eaten from below by the ground that is NEARER the camera at
      // those screen pixels — the « parasol » that made these read as dots
      // half-sunk into the roofs. `Infinity` is this repository's value
      // everywhere, and it is safe here without a horizon curtain because
      // every row drawn came out of the CURRENT view rectangle: neither
      // level can hand back a practice on the far side of the planet.
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    }) ?? null;
    _records.set(id, { ...row, position, mark, ...membership });
  }

  /**
   * Draw the marks of the levels on screen, each once, in its class.
   *
   * The practices are drawn first, so a place both levels hold is drawn as the
   * PRACTICE — the mark with a card and names behind it — into the shared
   * collection, and the mesh then draws only what the practices answer does
   * not hold. The join is the pack line: a mesh tuple's line is the `index`
   * `/sites` sends, as long as both came from the same pack — after a weekly
   * rebuild mid-session they do not, and the two levels are then drawn as
   * strangers rather than matched by a guess. Hospitals are keyed by their own
   * line and are in both levels' rows, so they are always shared.
   *
   * Billboards are built synchronously, so a redraw of the same levels — a
   * pan — replaces the old marks in the frame it runs in: no gap to cover.
   */
  function drawMarks(meshLevel, sitesLevel) {
    for (const collection of [_marks, _meshMarks, _sharedMarks]) collection?.removeAll();
    _records = new Map();
    resetFloorRetries();
    _meshLevel = meshLevel || null;
    _sitesLevel = sitesLevel || null;
    const joinable = Boolean(_sitesLevel && _mesh?.packId && _sitesLevel.packId === _mesh.packId);
    const meshRows = (_meshLevel?.rows ?? []).map((row) => (
      row.etab ? row : { ...row, key: `${joinable ? 'site' : 'mesh'}:${row.line}` }
    ));
    const meshKeys = new Set(meshRows.map((row) => row.key));
    for (const row of _sitesLevel?.rows ?? []) {
      const shared = meshKeys.has(row.key);
      addMark(shared ? _sharedMarks : _marks, row, {
        cls: shared ? 'shared' : 'sites', inSites: true, inMesh: shared,
      });
    }
    for (const row of meshRows) {
      // Drawn above, once, as the practice.
      if (_records.has(renderId(row.key))) continue;
      addMark(_meshMarks, row, { cls: 'mesh', inSites: false, inMesh: true });
    }
    // Every mark is new: its level's weight is written on the next frame.
    _fadeForce = true;
    restoreSpriteOrder();
    groundDrawnMarks();
    _viewer?.scene?.requestRender?.();
  }

  /** Whether a record is part of one level's drawing. */
  function recordInLevel(record, level) {
    return level === 'mesh' ? record?.inMesh !== false : record?.inSites !== false;
  }

  /** The records of the level that owns the count, the key and the analyst rows. */
  function dominantRecords() {
    // The départements own the national view, even while the marks hold the
    // screen for the frame or two it takes to paint them.
    if (_regime === 'national') return [];
    const level = _regime === 'sites' ? 'sites' : 'mesh';
    const out = [];
    for (const record of _records.values()) {
      if (recordInLevel(record, level)) out.push(record);
    }
    return out;
  }

  /** Remove one class of marks; the shared ones lose that level's membership. */
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
    _rowControlsListener?.();
    governorRequestRender('medecins-fr-drop');
  }

  /** Every mark goes: the départements have taken over, or the layer is off. */
  function dropPointLevels() {
    if (_selectedId && !_selectedId.startsWith('dep:')) clearSelection();
    for (const collection of [_marks, _meshMarks, _sharedMarks]) collection?.removeAll();
    _records = new Map();
    resetFloorRetries();
    _meshLevel = null;
    _sitesLevel = null;
    _pointsAnswered = false;
  }

  /** The mesh rows one view draws: the thinned practices, then the hospitals. */
  function meshLevelFor(box, key) {
    // § 3.5 — see `profileCountBudget`. Coverage first, density second.
    const budget = profileCountBudget(medecinsMeshBudget(box.north - box.south));
    const { picked } = selectMedecinsMesh(_mesh.sites, { box, budget });
    // OUTSIDE THE BUDGET, DELIBERATELY. The thinner exists so 64 232 practices
    // do not become a mat, and a hospital is exactly the mark that must survive
    // the camera pulling back: there are at most a few dozen in any box this
    // regime draws, and they are what a reader is looking for at that height.
    const hospitals = hospitalRows(box);
    const practices = absorbedByHospital(picked.map((row, index) => {
      // A tuple the index does not know (it always should) keeps a key of its
      // own that no practice can share.
      const line = _meshLines.get(row) ?? `${index}:${row[MESH_LAT]}:${row[MESH_LON]}`;
      return {
        // Rekeyed by `drawMarks` against the practices on screen.
        key: `mesh:${line}`,
        line,
        lat: row[MESH_LAT],
        lon: row[MESH_LON],
        practitioners: row[MESH_PRACTITIONERS],
        family: MEDECIN_PRACTICE_FAMILIES[row[MESH_FAMILY]] ?? 'specialiste',
        site: null,
        praticiens: null,
      };
    }), hospitals);
    // Hospitals LAST so they are added last and sit on top of what they absorb
    // the neighbours of — `spriteOrder.js` orders collections, not marks.
    return { rows: [...practices, ...hospitals], box, key };
  }

  /**
   * Ask `/sites` about one box.
   * @returns {Promise<?object>} The level, or null when a newer view cancelled it.
   */
  async function fetchSitesLevel(box, key) {
    // A superseded request is cancelled rather than left to arrive and be
    // discarded: a drag across Paris otherwise leaves several 800 kB responses
    // downloading and parsing for viewports nobody is looking at any more.
    _sitesAbort?.abort();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    _sitesAbort = controller;
    const params = new URLSearchParams({
      south: String(box.south), west: String(box.west), north: String(box.north), east: String(box.east),
    });
    // Ignored by the server, and there for the browser's cache: `/sites` is
    // cached for ten minutes, and after a rebuild the same box must not come
    // back with the old pack's indices.
    if (_packId) params.set('pack', _packId);
    let payload;
    try {
      payload = await fetchJson(`/api/medecins-fr/sites?${params}`, controller?.signal);
    } catch (error) {
      if (error?.name === 'AbortError') return null;
      throw error;
    }
    const hospitals = hospitalRows(box);
    const practices = absorbedByHospital(payload.sites.map((entry) => ({
      key: `site:${entry.index}`,
      index: entry.index,
      packId: payload.packId ?? null,
      lat: entry.site[SITE_LAT],
      lon: entry.site[SITE_LON],
      practitioners: entry.site[SITE_PRACTITIONERS],
      family: sitePrimaryFamily(entry.site),
      site: entry.site,
    })), hospitals);
    return { rows: [...practices, ...hospitals], payload, packId: payload.packId ?? null, box, key };
  }

  /**
   * Load every level of marks the settled view wants, and draw them together.
   *
   * Both are awaited before anything is drawn, so a view in the band never
   * shows half of its hand-over and a pan swaps the whole drawing in one
   * frame. A level that failed keeps what it had on screen; a level the view
   * no longer wants stays until the frame callback has faded it out under its
   * partner ({@link onFadeFrame}).
   */
  async function loadPoints(plan, box, token, force) {
    const meshKey = plan.mesh ? boxKey(box, 'mesh') : null;
    const sitesKey = plan.sites ? boxKey(box, 'sites') : null;
    const reuseMesh = Boolean(meshKey) && !force && _meshLevel?.key === meshKey;
    const reuseSites = Boolean(sitesKey) && !force && _sitesLevel?.key === sitesKey;
    if (!sitesKey) _sitesAbort?.abort();
    const failure = (error) => ({ error });
    const [meshAnswer, sitesAnswer] = await Promise.all([
      meshKey && !reuseMesh ? ensureMesh().catch(failure) : null,
      sitesKey && !reuseSites ? fetchSitesLevel(box, sitesKey).catch(failure) : null,
    ]);
    if (token !== _refreshToken || !_enabled) return;

    const previousMesh = _meshLevel;
    const previousSites = _sitesLevel;
    let nextMesh = previousMesh;
    let nextSites = previousSites;
    const errors = [];
    if (meshKey && !reuseMesh) {
      if (meshAnswer?.error || !_mesh) errors.push(meshAnswer?.error);
      else nextMesh = meshLevelFor(box, meshKey);
    }
    if (sitesKey && !reuseSites) {
      if (sitesAnswer?.error) errors.push(sitesAnswer.error);
      // Cancelled by a newer view, which the token check above already caught.
      else if (sitesAnswer) nextSites = sitesAnswer;
    }
    if (nextSites && nextSites !== previousSites) {
      _packId = nextSites.packId ?? _packId;
      _sites = nextSites.payload.sites;
      _sitesTruncated = Boolean(nextSites.payload.truncated);
      _sitesBox = nextSites.box;
    }
    if (nextMesh !== previousMesh || nextSites !== previousSites) drawMarks(nextMesh, nextSites);
    // A level arriving over its partner ramps in, and its partner steps down
    // in the same proportion. A redraw of the same level, or the first marks
    // over the départements (a hard cut), swaps in one frame.
    if (nextSites && !previousSites && previousMesh) _fade?.arrive('sites');
    if (nextMesh && !previousMesh && previousSites) _fade?.arrive('mesh');
    _pointsAnswered = true;
    if (errors.length) throw errors[0] ?? new Error('medecins-fr: a level failed to load');
  }

  /** The one place the three levels are chosen between. */
  async function refresh({ force = false } = {}) {
    if (!_enabled || !_viewer) return;
    const box = cameraBox();
    if (!box) return;
    const latSpan = box.north - box.south;
    const plan = planMedecinsLevels({ lat: latSpan, max: Math.max(latSpan, box.east - box.west) });
    // The levels drawn are part of the key, so a settle that changes them
    // always re-asks even when the rectangle barely moved.
    const key = boxKey(box, `${plan.dominant}:${plan.mesh ? 'm' : ''}${plan.sites ? 's' : ''}`);
    if (!force && key === _lastServedKey && !_lastError) return;
    _lastServedKey = key;
    _regime = plan.dominant;
    _plan = plan;
    const token = ++_refreshToken;
    _loading = true;
    _lastError = null;
    try {
      await ensureNational();
      if (token !== _refreshToken) return;
      if (plan.national) {
        await ensureDepartementShapes();
        if (token !== _refreshToken) return;
        repaintDepartements();
        // Painted: the swap can hand the screen over. The marks are NOT
        // cleared here; they stay until the départements are shown, and the
        // frame callback drops them then.
        _nationalReady = true;
        if (_depShown) publishDepartementLabels();
      } else {
        await loadPoints(plan, box, token, force);
      }
      _lastUpdate = Date.now();
      publishDrawingJoin();
    } catch (error) {
      _lastError = error?.message || String(error);
      // A failed view must be retryable: keeping its key would make every
      // later camera event skip the retry as "already served".
      _lastServedKey = null;
    } finally {
      if (token === _refreshToken) _loading = false;
      _rowControlsListener?.();
      _fade?.frame();
      governorRequestRender('medecins-fr-refresh');
    }
  }

  // --- The hand-overs, per frame ---------------------------------------------

  /** A level's arrival ramp, 1 when none runs or the layer has no handle. */
  function arrivalOf(levelKey, nowMs) {
    return _fade ? _fade.arrival(levelKey, nowMs) : 1;
  }

  /**
   * Per frame: weight arithmetic and adapter writes, nothing else.
   *
   * Nothing here fetches or builds. A level is DROPPED — its marks removed —
   * only once it has faded out AND the settled view no longer asks for it.
   */
  function onFadeFrame(scale, nowMs) {
    if (!_enabled) return;
    const span = Math.max(scale?.latSpan, scale?.lonSpan);
    const alphas = medecinsLevelAlphas(span, {
      regime: _regime,
      nationalReady: _nationalReady,
      pointsReady: _pointsAnswered,
      meshReady: Boolean(_meshLevel),
      sitesReady: Boolean(_sitesLevel),
      meshArrival: arrivalOf('mesh', nowMs),
      sitesArrival: arrivalOf('sites', nowMs),
    });
    const force = _fadeForce;
    _fadeForce = false;
    setDepartementsShown(levelVisible(_enabled, alphas.national));
    fadeMarkLevel(_marks, alphas.sites, { enabled: _enabled, force });
    fadeMarkLevel(_meshMarks, alphas.mesh, { enabled: _enabled, force });
    fadeMarkLevel(_sharedMarks, alphas.shared, { enabled: _enabled, force });
    if (_regime === 'national') {
      if (_pointsAnswered && !levelVisible(true, alphas.points)) dropPointLevels();
    } else if (_plan) {
      if (_meshLevel && !_plan.mesh && !levelVisible(true, alphas.mesh)) {
        _meshLevel = null;
        dropClass('mesh', _meshMarks);
      }
      if (_sitesLevel && !_plan.sites && !levelVisible(true, alphas.sites)) {
        _sitesLevel = null;
        dropClass('sites', _marks);
      }
    }
    _fade?.report({
      levels: {
        national: alphas.national,
        mesh: alphas.mesh,
        sites: alphas.sites,
        shared: alphas.shared,
      },
      dominant: _regime,
      bands: {
        'mesh-sites': { fine: MEDECINS_SITES_BAND.fine, coarse: MEDECINS_SITES_BAND.coarse, unit: 'deg-max' },
      },
      hardCuts: {
        'national-points': { enter: MEDECINS_NATIONAL_SPAN_DEG, exit: MEDECINS_NATIONAL_SPAN_DEG, unit: 'deg-lat' },
      },
      marks: {
        mesh: _meshMarks?.length ?? 0,
        sites: _marks?.length ?? 0,
        shared: _sharedMarks?.length ?? 0,
      },
      pending: _loading,
    });
  }

  function installClickHandler(viewer) {
    if (_clickHandler) return;
    _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    _clickHandler.setInputAction((movement) => {
      const picked = pickAt(viewer.scene, movement.position);
      const id = picked?.id;
      if (typeof id === 'string' && _records.has(id)) { selectSite(id); return; }
      if (_regime === 'national') {
        const code = String(picked?.id?.properties?.code?.getValue?.() ?? '').trim();
        if (code && _depEntities.has(code)) { selectDepartement(code); return; }
      }
      if (_selectedId) clearSelection();
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function removeClickHandler() {
    _clickHandler?.destroy?.();
    _clickHandler = null;
  }

  /**
   * Say when THESE CABINETS ARE ON THE MAP, so `amenities-fr` can stand down.
   *
   * ── The duplicate, and why it is only sometimes one ─────────────────────
   *
   * `amenities-fr` draws BPE D265 — 61 263 "médecin généraliste" rows — and
   * this layer draws the conventioned register, 64 232 addresses. The same
   * cabinet, twice, from two registers. `amenities-fr` already applies the
   * rule that settles it ("un seul registre par famille", which is why it
   * refuses the BPE's whole education domain), and the cross-referencing
   * audit (#128) recorded that it owes the same withdrawal here.
   *
   * NOTHING IS REMOVED TO PAY FOR IT. The withdrawal is conditional and it is
   * published rather than compiled in: the offer exists only while this layer
   * is DRAWING POSITIONS, so a reader who never opens the Médecins row keeps
   * every doctor `amenities-fr` ever drew, and a reader who opens it sees each
   * cabinet once instead of twice.
   *
   * AND ONLY WHEN POSITIONS ARE DRAWN, which is the point of the regime test.
   * At national altitude this layer paints an APL choropleth and draws no
   * practice at all; suppressing the other layer's family there would take the
   * doctors off the map entirely rather than deduplicate them.
   */
  function publishDrawingJoin() {
    const drawing = _enabled && _regime !== 'national';
    if (!drawing) {
      _unpublishDrawing?.();
      _unpublishDrawing = null;
      return;
    }
    if (_unpublishDrawing) return; // already offered; re-publishing would churn watchers
    _unpublishDrawing = publishJoin('medecins/drawn', () => ({ regime: _regime, sites: _records.size }));
  }

  const layer = {
    id: MEDECINS_FR_LAYER_ID,
    // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
    name: 'Médecins (FR)',
    icon: '✚',
    source: 'CNAM + DREES',
    // i18n-ignore-end
    // The pack is a shipped file. A finite interval exists only so a first
    // load that failed heals itself.
    updateInterval: 1_800_000,

    init(viewer) {
      _viewer = viewer;
      // Bottom to top: the mesh's own dots, the practices, then the marks both
      // levels hold — so a shared plate is never under a fading one.
      const collection = () => {
        const marks = new Cesium.BillboardCollection({ scene: viewer.scene, blendOption: Cesium.BlendOption.TRANSLUCENT });
        viewer.scene.primitives.add(marks);
        marks.show = false;
        registerSpriteCollection(MEDECINS_FR_LAYER_ID, marks);
        return marks;
      };
      _meshMarks = collection();
      _marks = collection();
      _sharedMarks = collection();
      registerPickOwner(MEDECINS_FR_LAYER_ID, (pickedId) => (
        typeof pickedId === 'string' && pickedId.startsWith(RENDER_PREFIX)
      ));
      overlayHost.setVisible(OVERLAY_SOURCE_ID, false);
      overlayHost.setVisible(LABEL_SOURCE_ID, false);
      console.log('[Data:Médecins FR] Initialized');
    },

    async enable(viewer) {
      _enabled = true;
      publishDrawingJoin();
      if (viewer) installClickHandler(viewer);
      // Which collection and which département is shown is the swap's call,
      // made per frame ({@link onFadeFrame}).
      const fadeViewer = viewer || _viewer;
      if (fadeViewer) _fade = watchZoomFade(fadeViewer, MEDECINS_FR_LAYER_ID, onFadeFrame);
      if (_depDataSource) _depDataSource.show = true;
      overlayHost.setVisible(OVERLAY_SOURCE_ID, true);
      overlayHost.setVisible(LABEL_SOURCE_ID, true);
      // Both camera events, for the reason the hydro layer documents: `moveEnd`
      // misses programmatic placement (which is exactly what a share link is),
      // and `changed` misses the end of a gesture.
      const follow = () => { if (_enabled) refresh(); };
      if (!_cameraRemovers.length) {
        for (const event of [_viewer?.camera?.moveEnd, _viewer?.camera?.changed]) {
          if (event?.addEventListener) _cameraRemovers.push(event.addEventListener(follow));
        }
      }
      await refresh({ force: true });
    },

    disable() {
      _enabled = false;
      _fade?.release();
      _fade = null;
      _refreshToken += 1;
      publishDrawingJoin();
      dropPointLevels();
      for (const marks of [_marks, _meshMarks, _sharedMarks]) {
        if (marks) marks.show = false;
      }
      if (_depDataSource) _depDataSource.show = false;
      _depShown = false;
      applyDepartementShow();
      _regime = 'national';
      _plan = null;
      overlayHost.clearSource(OVERLAY_SOURCE_ID);
      overlayHost.clearSource(LABEL_SOURCE_ID);
      overlayHost.setVisible(OVERLAY_SOURCE_ID, false);
      overlayHost.setVisible(LABEL_SOURCE_ID, false);
      removeClickHandler();
      for (const remove of _cameraRemovers) remove();
      _cameraRemovers = [];
      // A pending floor pass outlives the layer otherwise, and fires against an
      // empty record set on a viewer the reader has already moved on from.
      resetFloorRetries();
      _records = new Map();
      _selectedId = null;
      _sites = [];
      _lastServedKey = null;
      _sitesAbort?.abort();
      _sitesAbort = null;
    },

    async update() {
      if (!_enabled) return;
      await refresh({ force: true });
    },

    destroy(viewer) {
      this.disable();
      unregisterSpriteCollection(MEDECINS_FR_LAYER_ID);
      unregisterPickOwner(MEDECINS_FR_LAYER_ID);
      for (const marks of [_marks, _meshMarks, _sharedMarks]) {
        if (marks) viewer?.scene?.primitives?.remove?.(marks);
      }
      _marks = null;
      _meshMarks = null;
      _sharedMarks = null;
      if (_depDataSource) { viewer?.dataSources?.remove?.(_depDataSource, true); _depDataSource = null; }
      _depEntities.clear();
      _depMaterials.clear();
      _depPaintedCodes = new Set();
      _nationalReady = false;
      _depShapesPromise = null;
      _depMeta = new Map();
      _viewer = null;
      _national = null;
      _mesh = null;
      _meshPromise = null;
      _lastUpdate = null;
      _lastError = null;
    },

    setParams(params = {}) {
      if (params.paint === undefined) return false;
      const paint = params.paint === 'medecins' ? 'medecins' : 'apl';
      if (paint === _paint) return false;
      _paint = paint;
      // Repainted whichever level is on screen, so the départements that cover
      // a zoom-out already carry the chip the reader picked meanwhile.
      repaintDepartements();
      if (_depShown) publishDepartementLabels();
      if (_selectedId?.startsWith('dep:')) selectDepartement(_selectedId.slice(4));
      _rowControlsListener?.();
      governorRequestRender('medecins-fr-paint');
      return true;
    },

    getParams() { return { paint: _paint }; },

    setRowControlsListener(listener) {
      _rowControlsListener = typeof listener === 'function' ? listener : null;
    },

    getRowControls() {
      const chips = [
        {
          id: 'medecins-paint-apl',
          label: messages().chips.access,
          active: _paint === 'apl',
          state: _paint === 'apl' ? 'active' : 'idle',
          title: messages().chips.accessTitle,
          params: { paint: 'apl' },
        },
        {
          id: 'medecins-paint-count',
          label: messages().chips.density,
          active: _paint === 'medecins',
          state: _paint === 'medecins' ? 'active' : 'idle',
          title: messages().chips.densityTitle,
          params: { paint: 'medecins' },
        },
      ];
      const legend = _regime === 'national'
        ? APL_BINS.map((bin, index) => ({
          color: bin.color,
          label: _paint === 'apl' ? aplBinLabel(index) : messages().level(index + 1),
        }))
        : MEDECIN_FAMILIES.map((family) => ({
          color: FAMILY_COLORS[family],
          label: medecinFamilyLabel(family),
          // Two channels on ONE row, not a second list by shape: the hue names
          // the family and the swatch IS the mark drawn on the globe, at key
          // size. `manager.js` masks this raster and paints it with the row's
          // own colour — which is why the ring is dropped (`key: true`): a mask
          // reads ALPHA, and an opaque ring would flatten all six rows into the
          // same plain dot.
          glyph: medecinFamilyGlyph(family, { px: LEGEND_GLYPH_PX, key: true }),
        }));
      return { chips, legend };
    },

    /** The practice the operator clicked, ready to be spoken. */
    getSelectedInfo() {
      if (!_enabled || !_selectedId || _selectedId.startsWith('dep:')) return null;
      return medecinsSiteReadout(_records.get(_selectedId) || null, {
        specialites: _national?.specialites,
      });
    },

    /**
     * Loaded practices as plain records for the analyst engine.
     * Empty in the département regime, where what is drawn is 96 polygons.
     * @param {number} [maxCount=2000]
     * @returns {Array<object>}
     */
    getAnalystRecords(maxCount = 2000) {
      if (!_enabled || _regime === 'national') return [];
      const limit = Number.isFinite(maxCount) ? Math.max(1, Math.floor(maxCount)) : 2000;
      const out = [];
      // Inside the band both levels are drawn; the one that owns the key is
      // the one the analyst reads.
      for (const record of dominantRecords()) {
        if (out.length >= limit) break;
        const readout = medecinsSiteReadout(record, { specialites: _national?.specialites });
        if (readout && Number.isFinite(readout.lat) && Number.isFinite(readout.lon)) out.push(readout);
      }
      return out;
    },

    getStats() {
      const stats = _national?.stats ?? null;
      return {
        count: dominantRecords().length,
        lastUpdate: _lastUpdate,
        loading: _loading,
        error: _lastError,
        stale: false,
        regime: _regime,
        truncated: _sitesTruncated,
        // The register's own figures, whatever the viewport shows. `medecins`
        // is the distinct-name count and `entrees` the row count; they are
        // different questions and both are published so neither impersonates
        // the other.
        adresses: stats?.adressesLocalisees ?? null,
        medecins: stats?.medecinsNommes ?? null,
        entrees: stats?.lignesMedecin ?? null,
        nonLocalisees: _national?.nonLocalisees ?? null,
        aplMillesime: _national?.apl?.millesime ?? null,
        aplNational: _national?.apl?.national ?? null,
        edition: _national?.source?.ps?.modified ?? null,
        generated: _national?.generated ?? null,
      };
    },
  };

  return layer;
}

const medecinsFranceLayer = createMedecinsLayer();

export default medecinsFranceLayer;
