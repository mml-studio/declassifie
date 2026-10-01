/**
 * @module schoolsFrance
 *
 * Every school France has registered, answered at the scale you ask.
 *
 * The source is the MENJ's own **Annuaire de l'éducation**
 * (`fr-en-annuaire-education`, Licence Ouverte 2.0, rebuilt daily), read
 * keylessly through the dev-server proxy. Measured 2026-09-01: 68 939 rows,
 * of which **68 158 are open and carry a coordinate** — the set this layer
 * draws. `schoolsFeed.js` holds the reading of the register and every trap in
 * it; this file is the rendering.
 *
 * ── Three regimes, and what decides between them ────────────────────────────
 * The same ladder the charge-point layer settled on, for the same reason: one
 * answer cannot serve both "which parts of France" and "which building".
 *
 *   national — 96 département PRISMS: the height is the establishment count,
 *              the colour is the count per 1 000 km². Entered on the view's
 *              LATITUDE span (≥ 9.5°, metropolitan France being 9.8° tall),
 *              never on the larger of the two spans, which on a 16:10 viewport
 *              is mostly a statement about the window's shape.
 *   mesh     — real school positions, spatially thinned to 1 100–2 200 dots.
 *              The middle zooms, where a région fills the screen.
 *   sites    — every school in the box, with its card. Gated by the proxy's
 *              own 0.35° ceiling, which bites before the altitude gate does.
 *
 * The mesh and the sites share the screen inside one fade band, 0.35° → 0.21°
 * of view ({@link SCHOOLS_SITE_FADE_BAND}): the mesh is a sample of the same
 * schools at the same coordinates on the same level colours, so the schools
 * it thinned away fade in around the ones it drew. The prisms never share the
 * screen with either — their colour is a density, the dots' a level — and that
 * transition stays a cut that no longer goes blank (`prismMeshSitesFade.js`).
 *
 * ── What the colour means, and what the size means ──────────────────────────
 * In the two POSITION regimes (mesh, sites): colour is the school LEVEL —
 * école, collège, lycée, adapted, non-teaching — and it is a categorical
 * ladder by age, not a ramp. Size is the ROLL, joined from four separate
 * per-level datasets on the UAI.
 *
 * The national regime draws neither of those, because it draws no school: it
 * draws 96 territories, and a territory has no level and no roll. Its two
 * channels are the ones the next section argues for.
 *
 * The two are deliberately different kinds of thing, and the layer never lets
 * the second impersonate the first: **8.3% of teaching establishments have no
 * published roll** (measured — 5 235 of 62 918, mostly SEGPA and SEP sections
 * whose pupils are counted inside their parent school). Those draw at the base
 * size and their card says *effectif non publié*. A zero-sized dot, or a dot
 * silently drawn as if it held no pupils, would turn a gap in the roll files
 * into a claim about a school.
 *
 * ── The national regime is a PRISM, and the old argument was a false choice ─
 * This header used to argue that the national fill was binned on the number of
 * ESTABLISHMENTS rather than on the density, "because the layer draws
 * establishments and shading by anything else would be a different map wearing
 * the same legend". The reasoning was sound and the question was wrong: it
 * compared count-fill against density-fill — one channel, two candidates, one
 * loser — and painting a raw count as a colour fill is the fault the corpus
 * names in capitals (CARTOGRAPHY B1). On a globe there is a second channel
 * and it was empty. The answer is both, on two channels:
 *
 *   HEIGHT  the establishment count, linearly, from a common datum
 *           (`SCHOOLS_PRISM_SCALE`, and `choroplethPrism.js` for the grammar).
 *   COLOUR  the count per 1 000 km² of the polygon actually drawn — a ratio,
 *           which is the one thing a colour fill is allowed to say. It was
 *           already computed by `schoolsDepartements.js` and only ever printed
 *           on a card.
 *   ALPHA   nothing. It used to carry a compositing correction (the DESCENDING
 *           ladder in `choroplethAlpha.js`, which existed because the fill was
 *           blended over unknown imagery). A prism body is composited over the
 *           sky and over other prisms at a CONSTANT alpha, and constant alpha
 *           is what makes the ramp's lightness ordering survive every possible
 *           backdrop by construction: `0.62·c + 0.38·bg` is monotone in `c`
 *           whatever `bg` is. The ladder is deliberately not imported here.
 *
 * ── The measurements the scale is frozen on ─────────────────────────────────
 * Measured 2026-09-03 by running `projectSchoolsDepartements` over that day's
 * national export (68 158 open, geolocated rows) against this repo's own
 * bundled polygons — 65 396 assigned, 99 coastal snaps, 2 762 offshore, 96
 * départements with a count, none at zero:
 *
 *   count    150 (Lozère) → 2 504 (Nord), median 577. Dynamic range 1 : 16.7.
 *   density  29.0 (Lozère) → 14 303 (Paris) per 1 000 km², median 92.4.
 *            Range 1 : 493 — thirty times the count's spread, which is the
 *            arithmetic reason the two cannot share one channel.
 *
 * `domainMax` is frozen at 2 600 establishments (C1: a literal published here,
 * never `countBins()` re-derived from the rows in hand). Nord lands at 96 % of
 * the scale, 115.6 km, 111 px at national altitude; the median is 26.6 km,
 * 25.6 px; Lozère is 6.9 km, 6.7 px. The 4 km A1 floor bites below 87
 * establishments, so today it is armed and inactive — no département is small
 * enough to be flattened onto it, and that is what makes `'linear'` honest
 * here where `irve-fr` (1 : 46) has to declare `'sqrt'`.
 *
 * The 3.7 % of headroom above Nord is not decoration: the register is rebuilt
 * daily, and a domain pinned to the measured maximum would start clipping the
 * one département the whole scale is anchored on the first day a school opens
 * in Lille. Clipped today: 0, and `prismLegend` publishes the count if it ever
 * stops being 0 (A5).
 *
 * ── Why the colour is the density and not one of the other three ratios ─────
 * The payload carries four candidates. Density wins for a reason that is
 * structural rather than editorial: the prism's base is the département's own
 * polygon, so a big rural territory makes a big VOLUME at equal count, and the
 * single question that misreading produces — "is this pile tall because the
 * territory is large?" — is answered by count ÷ area and by nothing else. The
 * colour is the audit of the height, not its decoration.
 *
 * The measured proof that it works: Gironde and Yvelines both hold exactly
 * 1 416 establishments — the same height, to the metre — and land two colour
 * classes apart, 140.5 against 615.6 per 1 000 km². Paris (1 481) and
 * Seine-Maritime (1 362) are near-equal towers, 14 303 against 217.
 *
 * The three rejected:
 *   · pupils per establishment — the roll is unpublished for 8.3 % of teaching
 *     establishments (5 235 of 62 918), and unevenly so, because SEGPA and SEP
 *     sections are counted inside their parent school. The ratio would carry a
 *     coverage artefact in the same channel as the finding.
 *   · share in éducation prioritaire — a policy variable, not the denominator
 *     of the height, and it would put a social judgement in the colour of a map
 *     about where schools ARE.
 *   · private share — same objection, and it answers no question the height
 *     raises.
 *
 * ── What the prism refuses to say ───────────────────────────────────────────
 * It does not neutralise the base area: a reader who reads MASS rather than the
 * top edge still over-reads large rural départements. The prism moves that bias
 * from the fill to the volume rather than removing it, and hands over a second
 * channel to catch it — which the flat fill never did. The legend says so.
 *
 * It says nothing about pupils, nothing about the IPS, and it cannot say
 * anything at all about the 2 762 establishments below.
 *
 * ── What the national regime cannot show ────────────────────────────────────
 * The bundled département polygons are metropolitan: 96 features, no overseas
 * geometry. So 2 762 open, geolocated schools — La Réunion's 855, Guadeloupe's
 * 448, and the rest — cannot be painted, and the national card says so rather
 * than letting the choropleth imply France has 65 396 schools. They are all
 * present in the other two regimes, which draw positions and not polygons.
 *
 * A second absence is worth the same honesty and is stated on the same card:
 * **French Polynesia's 311 establishments and Wallis-et-Futuna's 21 carry no
 * coordinate at all** — every single one — as do 49 in New Caledonia. They are
 * 332 of the register's 399 uncoordinated rows, and they are not on this map
 * anywhere. Only 18 uncoordinated rows are metropolitan.
 *
 * ── What the IPS does NOT change ────────────────────────────────────────────
 * The DEPP's *indice de position sociale* is joined onto this layer on the UAI
 * (`ipsFeed.js`), and it moves NO map channel in any regime. Colour still
 * means level and size still means roll where schools are drawn; at national
 * altitude the height is a count and the colour a density, and the index is
 * neither. That is a decision and not an omission: every channel already
 * carries a meaning, and a second one behind a toggle would make two
 * screenshots of this layer say different things with nothing on screen to
 * tell them apart. The index arrives where it can be qualified — on the card,
 * and in the one line under the toggle — because **40 529 of the 62 857 drawn schools that can
 * carry an index have a published one (64.5%)** and the third that do not
 * must read as "non publié", never as the middle of a ramp.
 *
 * The maillage is deliberately untouched by it. The national pack ships
 * coordinates without names to stay at 1.66 MB against 5.42 MB, and an IPS
 * per tuple would put it back where the names did. So the index rides the
 * click path the NAME already uses: one register lookup for one coordinate,
 * memoised for the session, and the resulting card is the same card the exact
 * regime draws — IPS included.
 */

import * as Cesium from 'cesium';
import { profileCountBudget } from '../perfProfile.js';
import { claimCameraSensitivity, releaseCameraSensitivity } from './cameraSensitivity.js';
import { markViewportRead, releaseCameraSettle, watchCameraSettle } from './cameraSettle.js';
import {
  PRISM_BASE_HEIGHT_M,
  PRISM_BODY_ALPHA,
  PRISM_NO_RATIO_COLOR,
  PRISM_TOP_ALPHA,
  createPrismScale,
  prismLegend,
  prismRatioColor,
  prismRow,
  prismTally,
} from './choroplethPrism.js';
import { governorRequestRender } from '../renderGovernor.js';
import { registerSpriteCollection, restoreSpriteOrder, unregisterSpriteCollection } from './spriteOrder.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import { cachedGroundFloor, warmGroundFloor } from './groundFloor.js';
import { parseDepartements } from './meteoFranceVigilance.js';
import {
  clearOverlaySource,
  hitTestWorldOverlay,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import { pickOverlayLabelId } from './overlayLabelPick.js';
import {
  SCHOOLS_MAX_BOX_DEG,
  SCHOOL_LEVELS,
  schoolDisplayName,
  schoolLevelLabel as levelLabel,
  schoolPrecisionLabel,
  schoolSiteKey,
} from './schoolsFeed.js';
import { ipsCardLines, ipsCoverageClause } from './ipsFeed.js';
import { formatDecimal, formatNumber } from '../i18n/format.js';
import messages from './schoolsFrance.i18n.js';
import {
  meshSchoolId,
  schoolsMeshBudget,
  selectSchoolsMesh,
  MESH_LAT,
  MESH_LEVEL,
  MESH_LON,
  MESH_PUPILS,
} from './schoolsMesh.js';
import { ARRIVAL_MS, fadeBand, watchZoomFade } from './zoomFade.js';
import {
  ARRIVAL_MESH,
  ARRIVAL_NATIONAL,
  ARRIVAL_SITES,
  ROLE_MESH,
  ROLE_SHARED,
  ROLE_SITES,
  createRecordFader,
  dominantPointLevel,
  familyAlphas,
  pointArrivalKey,
  pointRoles,
  retiredPointLevel,
  siteFadeScale,
  wantedPointLevels,
} from './prismMeshSitesFade.js';
import { pickAt } from './pickAt.js';

export const SCHOOLS_FR_LAYER_ID = 'schools-fr';

export const SCHOOLS_FR_OVERLAY_SOURCE_ID = 'schools-fr-selected';
export const SCHOOLS_FR_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});
export const SCHOOLS_FR_LABEL_SOURCE_ID = 'schools-fr-departements';
/** Ambient-label entry-id prefix — the click surface the département NAME provides. */
export const SCHOOLS_FR_DEP_LABEL_PREFIX = 'schools-fr:dep:';
export const SCHOOLS_FR_LABEL_COHORT_LIMIT = 14;
export const SCHOOLS_FR_LABEL_COLLISION_CAPACITY = 12;

const DEPARTEMENTS_URL = new URL(
  './local_data/france_departements/departements.geojson',
  import.meta.url,
).href;

// --- Activation / load gating ----------------------------------------------
/**
 * Altitude (m) at and above which the layer never draws individual schools. A
 * school is a street-scale object and the proxy refuses a box wider than 0.35°
 * anyway.
 *
 * It used to be an enter/exit pair (42 / 48 km) deciding the switch to the
 * site regime. That switch is a fade band now ({@link SCHOOLS_SITE_FADE_BAND}),
 * on the span the proxy's ceiling is written in, which a plan view reaches at
 * ~25 km — long before this altitude. So it is a GUARD with no hysteresis to
 * keep: both levels are drawn inside the band, so nothing can flap on it.
 */
const SITE_ALTITUDE_M = 45_000;
/**
 * THE MESH ↔ SITES BAND, in degrees of the view's LARGER span ('deg-max'):
 * 0.35° → 0.21°, the same band as `irve-fr` and for the same reasons.
 *
 * The coarse end is {@link SCHOOLS_MAX_BOX_DEG}, where the site level starts
 * loading today and has to: the proxy refuses a wider box, so every view the
 * band gives sites to is one it will answer, with its own completeness check
 * (`complete`) and the 6 000-dot cap below unchanged. The fine end is 0.6× that
 * (a ratio of 1.67, a little under one zoom level); on a 16:10 viewport the
 * band runs from about 25 km of altitude to about 15 km. Keeping the mesh
 * loaded for as long as it has a weight (down to 0.245°, below) costs a
 * client-side re-pick over the national pack the layer already holds, at the
 * 2 200-dot budget of the finest tier.
 *
 * The shape is a REVEAL: every view in the band used to show every school, so
 * the schools reach full strength 30 % of the way in (0.300°), the mesh is gone
 * by 70 % (0.245°), and the schools own the key from 0.314° down.
 *
 * WHY THIS ONE FADES: a mesh dot is a real school of the same register at its
 * own coordinate, on the same level colours, and the site level holds the
 * same school at the same point (`pickMeshSite` is how a click already joins
 * the two). Inside the band the school both levels draw is drawn ONCE, as the
 * site it is — on the SITE size scale, so no dot on screen is read against the
 * smaller mesh scale beside it — and only the schools the mesh thinned away
 * fade in. See `prismMeshSitesFade.js`.
 */
export const SCHOOLS_SITE_FADE_BAND = fadeBand(0.21, SCHOOLS_MAX_BOX_DEG);
const SCHOOLS_FADE_BANDS_REPORT = Object.freeze({
  'mesh-sites': Object.freeze({ fine: SCHOOLS_SITE_FADE_BAND.fine, coarse: SCHOOLS_SITE_FADE_BAND.coarse, unit: 'deg-max' }),
});
/**
 * View LATITUDE span (degrees) at or above which the choropleth answers.
 * Metropolitan France is 9.8° tall. The exit threshold is lower than the entry
 * one so a camera resting on the boundary does not swap the whole map back and
 * forth on sub-pixel drift.
 *
 * THIS STAYS A HARD CUT, AND KEEPS ITS HYSTERESIS. The prism's height is the
 * same establishment count the dots draw, but its colour is the count per
 * 1 000 km² on the green ramp below, and a dot's colour is the school LEVEL —
 * a rate and a category, two keys, chosen to share no colour because the two
 * regimes never draw at once. What changed is that the cut no longer goes
 * blank while the next level loads (`prismMeshSitesFade.js`).
 */
const NATIONAL_ENTER_SPAN_DEG = 9.5;
const NATIONAL_EXIT_SPAN_DEG = 8;
const SCHOOLS_FADE_CUTS_REPORT = Object.freeze({
  'national-mesh': Object.freeze({ enter: NATIONAL_ENTER_SPAN_DEG, exit: NATIONAL_EXIT_SPAN_DEG, unit: 'deg-lat' }),
});
const CAMERA_DEBOUNCE_MS = 450;
/**
 * Poll cadence (ms). Long on purpose: the register is rebuilt once a day, so
 * anything faster re-asks a question whose answer cannot have changed. The
 * camera, not the clock, drives this layer.
 */
const POLL_INTERVAL_MS = 30 * 60_000;
const REQUEST_TIMEOUT_MS = 45_000;
const NATIONAL_TIMEOUT_MS = 120_000;
/** Hard cap on rendered schools, independent of what the proxy returns. */
const MAX_RENDERED_SITES = 6_000;
/**
 * Half-width (degrees, ~550 m) of the box a MAILLAGE click asks the register
 * about.
 *
 * The national pack ships no names — carrying them would take it from 1.66 MB
 * to 5.42 MB for two fields the maillage never draws (see `schoolsMesh.js`).
 * But a card that says "Établissement" at one altitude and "Collège Jean
 * Moulin" at the next is the pack's wire budget leaking into what a reader is
 * told, so the name is fetched for the ONE dot that was clicked instead. The
 * proxy snaps the box outward onto its 0.02° cache grid anyway, so a second
 * click on a neighbouring school is a cache hit both here and there.
 */
const MESH_LOOKUP_PAD_DEG = 0.005;
/** A mesh lookup is one click's worth of patience, not a viewport's. */
const MESH_LOOKUP_TIMEOUT_MS = 15_000;
const POINT_LIFT_M = 2.5;
const GROUND_WARM_LIMIT = 600;

// --- Presentation -----------------------------------------------------------
/**
 * The level ladder, young to old, then the two that are not a level at all.
 *
 * A categorical scale and not a ramp — a collège is not "more" than an école —
 * so the four teaching bands are four distinguishable hues rather than four
 * steps of one. They run cool-to-warm with age purely so the eye can order
 * them without the legend, which is the one ordinal thing about a school.
 *
 * The family is chosen to collide with nothing else on this globe: not the
 * charge-point power ramp (blue→red), not Mix élec's teal/amber, not
 * Vigilance's green→red. `autre` is deliberately outside the family, in
 * neutral slate — a rectorat is not a school and should not read as one.
 */
const LEVEL_COLORS = Object.freeze({
  ecole: '#38d9a9',
  college: '#4dabf7',
  lycee: '#f783ac',
  adapte: '#ffa94d',
  autre: '#7c8899',
});

/**
 * Density ramp, low to high — a sequential green scale, six classes.
 *
 * Distinct from the level hues above and from every other French layer's ramp:
 * the two schools regimes never draw at the same time, but a reader who zooms
 * out must not carry a category's meaning into a quantity's.
 *
 * Re-spaced for the prism, and the criterion is measurable rather than a taste:
 * the body is drawn at a CONSTANT alpha, so `0.62·c + 0.38·bg` is monotone in
 * `c` for any backdrop — the ordering cannot invert the way the old descending
 * alpha ladder existed to prevent. What remains to be checked is SEPARATION,
 * and it is checked: relative luminances 0.045 · 0.133 · 0.269 · 0.417 · 0.628
 * · 0.845, i.e. composited steps of 0.055 · 0.084 · 0.092 · 0.131 · 0.135 —
 * six ascending classes, none of them closer than 5.5 % of the luminance range
 * (B3, which asks for a measurement and not for the number six).
 */
const DENSITY_COLORS = Object.freeze([
  '#0c4433', '#1a7452', '#28a074', '#48c195', '#82e2bc', '#c6f8df',
]);

/**
 * The frozen bivariate scale of the national regime.
 *
 * Every literal here was measured once and is published in this module's
 * header — C1: nothing in it is re-derived from a poll, from the rows in hand
 * or from the viewport, so a département is the same height and the same
 * colour in every session and in every share link.
 *
 * The colour breaks double: 40 · 80 · 160 · 320 · 640 per 1 000 km². A ×2
 * ladder rather than equal intervals because the density spans 1 : 493 (29 in
 * Lozère, 14 303 in Paris) and six equal classes over that range would put 92
 * of the 96 départements in the first one. Measured populations of these six:
 * 8 · 34 · 30 · 14 · 4 · 6 — every class is inhabited, so the legend never
 * shows a colour a reader can look for and never find.
 */
export const SCHOOLS_PRISM_SCALE = createPrismScale({
  id: SCHOOLS_FR_LAYER_ID,
  domainMax: 2600,
  mode: 'linear',
  // The catalog's own French, read off the DEFINITION rather than resolved:
  // this runs at module load, where there is no locale to read (R5), and the
  // frozen scale must carry the exact bytes it always carried. The LEGEND
  // reads the same three keys in the page's language — see
  // `localizedPrismScale` — so the two can never drift apart.
  heightLabel: messages.definition.prism.heightLabel.fr,
  heightUnit: messages.definition.prism.heightUnit.fr,
  ratioLabel: messages.definition.prism.ratioLabel.fr,
  ratioBreaks: [40, 80, 160, 320, 640],
  ratioColors: DENSITY_COLORS,
});

/**
 * The frozen scale, with its three variable names in the page's language.
 *
 * `createPrismScale` validates and freezes at construction, so the numbers and
 * the colours are decided once; only the words are swapped, and only when a
 * legend is being drawn. `prismLegend` reads properties and never mutates.
 * @returns {object} A read-alike of {@link SCHOOLS_PRISM_SCALE}.
 */
function localizedPrismScale() {
  const m = messages();
  return {
    ...SCHOOLS_PRISM_SCALE,
    heightLabel: m.prism.heightLabel,
    heightUnit: m.prism.heightUnit,
    ratioLabel: m.prism.ratioLabel,
  };
}

const SELECTED_COLOR = '#00ffff';
const OUTLINE_COLOR = Cesium.Color.BLACK.withAlpha(0.35);

const SITE_POINT_MIN_PX = 5;
const SITE_POINT_MAX_PX = 15;
const SELECTED_POINT_PX = 18;
/**
 * Mesh dots are smaller and flatter than exact sites. They stand for a sampled
 * network rather than a counted inventory, and a mesh dot the size of a site
 * dot would invite the eye to read one as the other.
 *
 * Which is why, inside the fade band, a school both levels draw is drawn on
 * the SITE scale the moment the sites are in hand: once it is one of the
 * inventory's dots it is sized like one, and the only mesh-sized dots left on
 * screen are the ones fading out.
 */
const MESH_POINT_MIN_PX = 3.4;
const MESH_POINT_MAX_PX = 9;

/**
 * A gloss under a swatch, and ONLY where the label cannot stand alone.
 *
 * There used to be one per level, each a full sentence, and each carrying a
 * verbatim copy of the maillage disclosure. Measured on the fused Enseignement
 * row over Bayonne on 2026-09-14: 209 words of prose behind 9 swatches.
 * « École », « Collège » and « Lycée » answer the only question a key is
 * asked — what is this colour — with the word itself, and a sentence under them
 * answered one the reader had not asked.
 *
 * `autre` keeps one because its dots are the exception the map cannot state on
 * its own: fourteen marks in a school layer that are not schools. `adapte` is
 * dropped with the rest — the label already names its subject.
 */
function levelBlurb(level) {
  // i18n-ignore-next-line — a band key from `SCHOOL_LEVELS`.
  return level === 'autre' ? messages().legend.autreBlurb : null;
}

/**
 * The maillage's own disclosure, printed ONCE under the classes.
 *
 * It was appended to all five blurbs, which is where a third of that key's
 * prose came from. It qualifies every class equally, so it belongs in the
 * block-level `note` slot and not in any of them.
 *
 * A function and not a constant: a constant is resolved when the module loads,
 * which would freeze the note in whatever language booted first.
 */
function meshLegendNote() {
  return messages().legend.meshNote;
}

const DEFAULT_OVERLAY_HOST = Object.freeze({
  setEntries: setOverlayEntries,
  setVisible: setOverlaySourceVisible,
  clearSource: clearOverlaySource,
  hitTest: hitTestWorldOverlay,
});
let _overlayHost = DEFAULT_OVERLAY_HOST;

// --- Runtime state ----------------------------------------------------------
let _viewer = null;
let _points = null;
let _records = new Map();
let _enabled = false;
let _clickHandler = null;
let _cameraChangedAttached = false;
let _cameraDebounceTimer = null;
let _preRenderRemover = null;
let _selectedId = null;
let _count = 0;
let _lastUpdate = null;
let _loading = false;
let _error = null;
let _status = 'idle';
let _summary = null;
let _regime = 'national';
let _lastBox = null;
let _inFlight = null;
let _requestGeneration = 0;

let _national = null;
let _nationalPromise = null;
let _nationalError = null;
let _nationalPainted = false;
let _depDataSource = null;
let _depEntities = new Map();
let _depMeta = new Map();
let _depShapesPromise = null;

let _mesh = null;
let _meshPromise = null;
let _meshError = null;
let _meshPick = null;
/**
 * Coordinate id → the register's answer for that dot.
 *
 * `'pending'` while a lookup is in flight, a projected site once it lands,
 * `null` when the register has nothing there. Session-scoped and never
 * invalidated: the annuaire is rebuilt daily and a name does not move.
 */
let _meshNames = new Map();

// Fade on zoom. The two point levels are held SEPARATELY, because inside the
// mesh ↔ sites band both are drawn; `_records` is what they compose into
// (`rebuildPoints`), and every dot in it carries a `fadeRole`.
/** The mesh as drawn: its pick and the box it was picked over. */
let _meshLevel = null;
/** The site level as drawn: the viewport payload's sites. */
let _siteLevel = null;
/** Which point levels the current `_records` were built from. */
let _drawn = { mesh: false, sites: false };
/** The band scale of the last SETTLED view. */
let _settledScale = Infinity;
/** Incremented on every settle, so a slow pack never draws over a newer view. */
let _viewGeneration = 0;
let _meshLoading = false;
let _siteLoading = false;
/** Whether the département prisms are on screen right now. */
let _depShown = false;
/** The `watchZoomFade` handle while the layer is enabled. */
let _fade = null;
let _retireTimer = null;
let _fadeReportDirty = true;
const _fadeAlphas = {
  national: 0, nationalShown: false, shared: 1, sites: 1, mesh: 1, meshLevel: 0, sitesLevel: 0,
};
let _fadeNow = 0;
const _fadeState = {
  national: false,
  nationalReady: false,
  meshDrawn: false,
  sitesDrawn: false,
  scale: Infinity,
  band: null,
  arrival: (key) => (_fade ? _fade.arrival(key, _fadeNow) : 1),
};

// --- Colour and size --------------------------------------------------------

/** Hex for one level. Anything unrecognised gets the neutral slate. */
export function schoolLevelColor(level) {
  return LEVEL_COLORS[level] || LEVEL_COLORS.autre;
}

/** The level's name in the page's language. */
export function schoolLevelLabel(level) {
  return levelLabel(level);
}

/**
 * Fill colour for one DENSITY, or null when the rate is not published.
 *
 * `null` rather than a grey, so every caller has to make the "unpublished"
 * decision explicitly instead of inheriting a colour that sits inside the
 * ramp's own family (D3).
 * @param {number|null|undefined} per1000Km2 Establishments per 1 000 km².
 * @returns {string|null} CSS colour, or null.
 */
export function schoolsDensityColor(per1000Km2) {
  return prismRatioColor(per1000Km2, SCHOOLS_PRISM_SCALE);
}

/**
 * One département's row of the national rollup, turned into a prism.
 *
 * The A1 case this function exists for: a count of ZERO and a count that was
 * never measured are two different facts and get two different marks. The
 * rollup writes `0` for both — a département absent from the tally falls
 * through `bucket?.schools || 0` — and the one signal that tells them apart is
 * `truncated`: the sweep proves its own completeness against the portal's
 * `total_count`, and a short export served as HTTP 200 is EXACTLY the failure
 * that manufactures zeros. So when the sweep is short, a zero is demoted to
 * "not measured" (no prism, hatched footprint) instead of being drawn as a
 * département where no school exists.
 *
 * @param {object} row A `departements[]` entry from the national rollup.
 * @param {{truncated?: boolean}} [options]
 * @returns {object} From `prismRow` — see `choroplethPrism.js`.
 */
export function schoolsPrismRow(row, { truncated = false } = {}) {
  const count = row?.schools;
  // Deliberately NOT `Number(count)`: `Number(null)` is 0 and `Number(true)`
  // is 1, so coercing here would manufacture a measured zero out of a
  // malformed row — the one thing this contract must not do. `prismHeightM`
  // owns the type rule; all this adds is the demotion above.
  const unproven = truncated && (count === 0 || count === '0');
  return prismRow(
    { code: row?.code, value: unproven ? null : count, ratio: row?.per1000Km2 },
    SCHOOLS_PRISM_SCALE,
  );
}

/** Every row of a rollup, tallied for the legend (classes, absences, clipping). */
export function schoolsPrismTally(national) {
  const truncated = national?.truncated === true;
  const rows = (national?.departements || []).map((row) => ({
    code: row.code,
    value: schoolsPrismRow(row, { truncated }).value,
    ratio: row.per1000Km2,
  }));
  return prismTally(rows, SCHOOLS_PRISM_SCALE);
}

/**
 * Height, in metres, at which a département's ambient LABEL is anchored.
 *
 * The top of its own prism, not the ground: the number in the label and the
 * top edge of the volume are the same datum, and a name pinned to the base
 * would sit 100 km below the thing it names.
 * @param {object} row
 * @param {{truncated?: boolean}} [options]
 * @returns {number} Metres above the ellipsoid.
 */
export function schoolsDepartementLabelHeightM(row, options = {}) {
  const built = schoolsPrismRow(row, options);
  return PRISM_BASE_HEIGHT_M + (built.heightM || 0);
}

/**
 * Dot size for one school, by roll.
 *
 * Square-rooted and capped at 2 000 pupils, so a 1 600-pupil lycée is bigger
 * than a 60-pupil village school without being twenty-seven times the area —
 * the eye reads area, and a linear scale would make the rural half of France
 * invisible. A school with NO published roll draws at the minimum, which is
 * also what a 1-pupil school would draw at; the card is what distinguishes
 * "small" from "not published", because a dot cannot.
 */
export function schoolPointSize(pupils) {
  const count = Number(pupils);
  if (!Number.isFinite(count) || count <= 0) return SITE_POINT_MIN_PX;
  return Math.min(SITE_POINT_MAX_PX, SITE_POINT_MIN_PX + Math.sqrt(Math.min(count, 2000)) * 0.24);
}

/** Pixel size for a mesh dot — smaller than an exact site, and flatter. */
export function schoolsMeshPointSize(pupils) {
  const count = Number(pupils);
  if (!Number.isFinite(count) || count <= 0) return MESH_POINT_MIN_PX;
  return Math.min(MESH_POINT_MAX_PX, MESH_POINT_MIN_PX + Math.sqrt(Math.min(count, 2000)) * 0.13);
}

// --- Camera -----------------------------------------------------------------

/**
 * Camera view box, clamped to the proxy's ceiling. A wider view returns null
 * and the layer falls back to the maillage rather than asking for a box the
 * proxy would refuse.
 */
export function cameraSchoolsBox(viewer) {
  const rectangle = viewer?.camera?.computeViewRectangle?.();
  if (!rectangle) return null;
  const south = Cesium.Math.toDegrees(rectangle.south);
  const north = Cesium.Math.toDegrees(rectangle.north);
  const west = Cesium.Math.toDegrees(rectangle.west);
  const east = Cesium.Math.toDegrees(rectangle.east);
  if (![south, west, north, east].every(Number.isFinite)) return null;
  if (west >= east || south >= north) return null;
  if (north - south > SCHOOLS_MAX_BOX_DEG || east - west > SCHOOLS_MAX_BOX_DEG) return null;
  return { south, west, north, east };
}

/**
 * View box for the mesh regime — the camera rectangle, padded.
 *
 * No ceiling here: the mesh is picked from a set the client already holds, so
 * a wide view costs nothing upstream. The padding means a dot does not pop
 * into existence exactly at the screen edge as you pan.
 */
export function cameraSchoolsMeshBox(viewer, padFraction = 0.12) {
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

function cameraAltitudeM(viewer) {
  const carto = viewer?.camera?.positionCartographic;
  return Number.isFinite(carto?.height) ? carto.height : Infinity;
}

/**
 * A view rectangle's two spans, in degrees. Infinite when the camera is past
 * the limb and Cesium can give no rectangle at all.
 */
export function schoolsViewSpanDeg(viewer) {
  const rectangle = viewer?.camera?.computeViewRectangle?.();
  if (!rectangle) return { lat: Infinity, max: Infinity };
  const lat = Cesium.Math.toDegrees(rectangle.north - rectangle.south);
  const lon = Cesium.Math.toDegrees(rectangle.east - rectangle.west);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { lat: Infinity, max: Infinity };
  return { lat, max: Math.max(lat, lon) };
}

/**
 * The camera's scale for the mesh ↔ sites band: the larger span, or Infinity
 * at and above {@link SITE_ALTITUDE_M}.
 */
export function schoolsSiteFadeScale(spanMaxDeg, altitudeM) {
  return siteFadeScale(spanMaxDeg, altitudeM, SITE_ALTITUDE_M);
}

/**
 * Which regime the camera is in — the level that owns the key, the card and
 * the row line. The national cut keeps its hysteresis; below it both point
 * levels can be on screen inside {@link SCHOOLS_SITE_FADE_BAND}, and the
 * regime is the one the settled view gives the larger alpha.
 */
function updateRegime(viewer) {
  const span = schoolsViewSpanDeg(viewer);

  if (_regime === 'national') {
    if (span.lat >= NATIONAL_EXIT_SPAN_DEG) return _regime;
  } else if (span.lat >= NATIONAL_ENTER_SPAN_DEG) {
    _regime = 'national';
    return _regime;
  }

  _settledScale = schoolsSiteFadeScale(span.max, cameraAltitudeM(viewer));
  _regime = dominantPointLevel({
    meshDrawn: _drawn.mesh,
    sitesDrawn: _drawn.sites,
    scale: _settledScale,
    band: SCHOOLS_SITE_FADE_BAND,
  });
  return _regime;
}

function sitePosition(site) {
  const floor = cachedGroundFloor(site.lat, site.lon);
  const height = (Number.isFinite(floor) ? floor : 0) + POINT_LIFT_M;
  return Cesium.Cartesian3.fromDegrees(site.lon, site.lat, height);
}

/** A grouped integer: `12 400` in French, `12,400` in English. */
function fr(value) {
  return formatNumber(Number(value));
}

/** One decimal: `436,3` in French, `436.3` in English. */
function frDecimal(value) {
  return formatDecimal(Number(value), 1, { minimumFractionDigits: 1 });
}

// --- Cards ------------------------------------------------------------------

/**
 * Card copy for one selected school. Every line is a published value or a
 * stated absence of one; nothing here is inferred.
 */
export function buildSchoolSelectionLabel(record) {
  const m = messages();
  const site = record?.site || {};
  const details = [];
  const title = site.name ? schoolDisplayName(site) : (site.commune || m.site.untitled);

  // `libelle_nature` is the register's own wording for what the establishment
  // IS ("Ecole de niveau élémentaire"), and it stays as published on either
  // card — it is a value, and the band label is the fallback when it is empty.
  const kind = [site.nature || schoolLevelLabel(site.level)];
  if (site.sector === 'public') kind.push(m.site.sectorPublic);
  else if (site.sector === 'prive') kind.push(m.site.sectorPrivate);
  details.push(kind.join(' · '));

  // The roll is the one number a reader will treat as the headline, so its
  // absence has to be as loud as its presence. "effectif non publié" is not
  // the same claim as "0 élève", and 8.3% of teaching establishments are in
  // the first category.
  details.push(Number.isFinite(site.enrolled) && site.enrolled > 0
    ? m.site.enrolled(fr(site.enrolled))
    : m.site.noRoll);

  // The IPS sits directly under the roll because it is the second number a
  // reader will treat as a headline, and its absence has to be as loud as the
  // roll's. `ipsCardLines` returns NOTHING for an establishment the index does
  // not cover — a rectorat, a CIO — and one explicit line for each of the four
  // ways it can be missing. The rentrée it names is its OWN: the écoles file
  // is a year behind the roll's, and printing one year for both would be a
  // claim neither source makes.
  details.push(...ipsCardLines(site.ips));

  if (site.ep) details.push(m.site.priorityEducation(site.ep));

  const services = [];
  if (site.services?.restauration) services.push(m.site.services.restauration);
  if (site.services?.hebergement) services.push(m.site.services.hebergement);
  if (site.services?.ulis) services.push(m.site.services.ulis);
  if (site.services?.segpa) services.push(m.site.services.segpa);
  if (site.services?.apprentissage) services.push(m.site.services.apprentissage);
  if (services.length) details.push(services.join(' · '));

  const where = [site.address, site.postal || site.commune].filter(Boolean).join(', ');
  if (where) details.push(where);

  // A coordinate geocoded only to the commune is not where the school is, and
  // the card is the only place that can say so.
  // i18n-ignore-start — the geocoding-ladder KEYS, stored on every site.
  if (site.precision === 'commune') {
    details.push(m.site.precisionWarning(schoolPrecisionLabel('commune')));
  } else if (site.precision === 'inconnue') {
    details.push(m.site.precision(schoolPrecisionLabel('inconnue')));
  }
  // i18n-ignore-end

  // Two dots at one address is the register's unit showing through, not a
  // duplicate. Naming the parent is what makes it legible.
  if (site.sharing > 0) {
    details.push(site.sharing === 1
      ? m.site.sharingOne
      : m.site.sharingMany(fr(site.sharing)));
  }
  if (site.motherUai) details.push(m.site.motherUai(site.motherUai));
  if (site.uai) details.push(m.site.uai(site.uai));

  return [title, ...details].join('\n');
}

/**
 * Card copy for a school picked in the MAILLAGE.
 *
 * A mesh record carries four numbers and no name, because the national pack
 * ships no names. It used to stop there and title the card "Établissement",
 * which made the ONE thing a reader wants — which school is this — a property
 * of how far they had zoomed. So a click now asks the register for that single
 * coordinate (`resolveMeshSite`), and this function reports whichever of the
 * three states the answer is in:
 *
 *   resolved  → the full card, identical to the one the exact regime draws;
 *   pending   → the tuple's own facts, and that the name is being fetched;
 *   refused   → the tuple's own facts, and that the lookup failed.
 *
 * The middle and last states are still honest cards, not placeholders: the
 * level and the roll come from the pack and are true whether or not the name
 * ever arrives.
 */
export function buildSchoolsMeshLabel(record) {
  if (record?.resolved) return buildSchoolSelectionLabel({ site: record.resolved });

  const m = messages();
  const site = record?.site || {};
  const details = [schoolLevelLabel(site.level)];
  details.push(Number.isFinite(site.enrolled) && site.enrolled > 0
    ? m.site.enrolled(fr(site.enrolled))
    : m.site.noRoll);
  details.push(record?.resolving ? m.mesh.resolving : m.mesh.unresolved);
  return [m.mesh.title, ...details].join('\n');
}

/**
 * Card copy for one département at national altitude.
 *
 * The first two lines are the prism's own two channels, in the order the eye
 * reads them: the count is the height, the density is the colour. Each can be
 * missing on its own and each says so on its own — the two absences are
 * independent (A1), and neither is ever printed as a zero.
 */
export function buildSchoolsDepartementLabel(row, options = {}) {
  const m = messages();
  const built = schoolsPrismRow(row, options);
  const details = [];

  if (!built.hasValue) {
    // The height channel refused. The footprint is drawn flat and hatched, and
    // this line says why, rather than letting a reader take a missing prism
    // for a département where no school exists.
    details.push(m.departement.notSurveyed);
  } else if (built.measuredZero) {
    details.push(m.departement.measuredZero);
  } else {
    details.push(m.departement.count(fr(row.schools)));
  }
  if (built.clipped) {
    details.push(m.departement.clipped(fr(SCHOOLS_PRISM_SCALE.domainMax)));
  }
  // The decimal separator comes from the page's locale, like the IPS lines two
  // functions up: a card that writes "436.3" in the middle of a French
  // sentence is reading as English.
  details.push(Number.isFinite(row.per1000Km2)
    ? m.departement.density(frDecimal(row.per1000Km2))
    : m.departement.noDensity);

  if (row.pupils > 0) details.push(m.departement.pupils(fr(row.pupils)));
  const mix = [];
  if (row.public > 0) mix.push(m.departement.publicShare(fr(row.public)));
  if (row.prive > 0) mix.push(m.departement.privateShare(fr(row.prive)));
  if (mix.length) details.push(mix.join(' · '));
  if (row.ep > 0) details.push(m.departement.priorityEducation(fr(row.ep)));
  return [row.name, ...details].join('\n');
}

function selectedOverlayEntry(id, position, copy) {
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

/** Protected selected-school entry for the shared overlay host. */
export function createSchoolSelectedOverlayEntry(record) {
  const position = record?.position;
  if (!record?.id || !position) return null;
  const copy = record.mesh
    ? buildSchoolsMeshLabel(record)
    : buildSchoolSelectionLabel(record);
  return selectedOverlayEntry(record.id, position, copy);
}

/**
 * Ambient label for one département at national altitude.
 *
 * The title carries the HEIGHT's datum (the count) and the accent carries the
 * COLOUR's (the density class), so the label repeats the prism rather than
 * adding a third variable. A département whose count is not measured says so
 * in words instead of showing a number nobody produced.
 */
export function createSchoolsDepartementOverlayEntry(row, position, options = {}) {
  const m = messages();
  const built = schoolsPrismRow(row, options);
  return {
    id: `${SCHOOLS_FR_DEP_LABEL_PREFIX}${row.code}`,
    position,
    variant: 'label',
    title: built.hasValue
      ? m.departement.label(row.name, fr(row.schools))
      : m.departement.labelNotSurveyed(row.name),
    accent: schoolsDensityColor(row.per1000Km2) || PRISM_NO_RATIO_COLOR,
    priority: built.hasValue ? Number(row.schools) || 0 : 0,
    collisionGroup: 'ambient-label',
    paintLane: 'ambient-label',
    // The département's name is a click surface, not a caption — see
    // `overlayLabelPick.js` for the mechanism and the pick-ordering rule.
    interactive: true,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
  };
}

/** Keep the largest départements, with stable identity as tie-break. */
export function selectSchoolsLabelCohort(entries, limit = SCHOOLS_FR_LABEL_COHORT_LIMIT) {
  const cap = Math.max(0, Math.min(SCHOOLS_FR_LABEL_COHORT_LIMIT, Math.floor(Number(limit) || 0)));
  if (!Array.isArray(entries) || cap === 0) return [];
  return entries.slice()
    .sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)))
    .slice(0, cap);
}

// --- Selection --------------------------------------------------------------

/** A record's fade weight — 1 for a record no fade has touched. */
function fadeWeightOf(record) {
  return record?.fadeWeight ?? 1;
}

function restoreRecordStyle(record) {
  if (!record?.point) return;
  record.point.color = Cesium.Color.fromCssColorString(record.baseColor).withAlpha(fadeWeightOf(record));
  record.point.pixelSize = record.baseSize;
}

/**
 * Whether a record belongs to the level that owns the key and the row. A dot
 * both levels draw belongs to whichever owns them; a record built before roles
 * existed (the test seeds) belongs to the regime, as every record used to.
 */
function inDominantLevel(record) {
  const role = record?.fadeRole;
  if (!role || role === ROLE_SHARED) return true;
  return _regime === 'mesh' ? role === ROLE_MESH : role === ROLE_SITES;
}

const SELECTED_INK = Cesium.Color.fromCssColorString(SELECTED_COLOR);
/** Scratch for the per-frame writer: a point copies the colour it is given. */
const _dotFadeScratch = new Cesium.Color();

/**
 * Write one record's fade weight onto its dot: the fill and the outline at
 * their own alpha times the weight, and `show` off at zero — a dot faded out
 * is hidden, not drawn transparent, because it would still answer a pick.
 * Called only for records whose weight moved a step.
 */
function writeDotFade(record, weight) {
  const point = record.point;
  if (!point) return;
  const selected = record.id === _selectedId;
  if (!record.inkValue) record.inkValue = Cesium.Color.fromCssColorString(record.baseColor);
  Cesium.Color.clone(selected ? SELECTED_INK : record.inkValue, _dotFadeScratch);
  _dotFadeScratch.alpha = weight;
  point.color = _dotFadeScratch;
  Cesium.Color.clone(OUTLINE_COLOR, _dotFadeScratch);
  _dotFadeScratch.alpha = OUTLINE_COLOR.alpha * weight;
  point.outlineColor = _dotFadeScratch;
  point.show = weight > 0;
}

const _dotFader = createRecordFader(writeDotFade);

/**
 * Re-style the selected département's prism, keeping its geometry.
 *
 * Selection recolours the BODY and the silhouette and never touches the
 * height: the cyan says "this is the one you clicked", and if it also changed
 * the height it would be answering a question the reader did not ask. A
 * département drawn as a hatched footprint still highlights — its bands and
 * its outline turn cyan, the grammar is untouched — because a reader must be
 * able to click an absence and read why it is absent.
 */
function highlightSelectedDepartement() {
  if (!_selectedId?.startsWith('dep:')) return;
  const code = _selectedId.slice(4);
  const row = (_national?.departements || []).find((entry) => entry.code === code);
  if (!row) return;
  const built = schoolsPrismRow(row, { truncated: _national?.truncated === true });
  for (const entity of _depEntities.get(code) || []) applyPrismStyle(entity, built, true);
}

function dropDepartementSelection() {
  if (_selectedId?.startsWith?.('dep:')) {
    _selectedId = null;
    _overlayHost.clearSource(SCHOOLS_FR_OVERLAY_SOURCE_ID);
    // The prisms now stay on screen as the cover until the dots are drawn, so
    // a cyan prism would outlive its card by that long: put its class back.
    if (_depShown) repaintDepartements();
  }
}

function clearSelection() {
  // The id is dropped BEFORE the repaint, and that ordering is the fix to a
  // real defect: `repaintDepartements` ends by calling
  // `highlightSelectedDepartement`, so repainting while `_selectedId` was
  // still set re-applied the highlight to the very entity being deselected —
  // which then stayed cyan until some later repaint. It was already wrong
  // under the flat fill and it is louder under a prism, where the highlight is
  // a 100 km volume rather than a tint on a polygon.
  const departement = _selectedId?.startsWith?.('dep:') === true;
  const record = departement || !_selectedId ? null : _records.get(_selectedId);
  _selectedId = null;
  // Not while the prisms are off screen: the repaint SHOWS what it paints, and
  // only the national side of the cut decides that (`applyNationalVisibility`).
  if (departement && (_depShown || !_enabled)) repaintDepartements();
  else if (record) restoreRecordStyle(record);
  _overlayHost.clearSource(SCHOOLS_FR_OVERLAY_SOURCE_ID);
  governorRequestRender('schools-fr-deselect');
}

/**
 * Choose which of the register's rows IS the dot that was clicked.
 *
 * A mesh id is a coordinate, and a coordinate is not a UAI: SEGPA and SEP
 * sections sit at the exact address of the collège or lycée that contains them
 * (2 212 of them nationally — `schoolsFeed.js`, Trap 1), so a lookup can come
 * back with two or three establishments on the same 5-decimal point.
 *
 * The tuple's own level breaks the tie, because that is the one thing the mesh
 * dot already claimed to be and the reader has been looking at. Failing that,
 * the largest roll — the parent establishment rather than the section inside
 * it. Nothing here invents a preference the pack did not already express.
 *
 * @param {Array<object>} sites Register rows for the lookup box.
 * @param {string} id The clicked dot's coordinate id.
 * @param {?string} level The level the mesh tuple carried.
 * @returns {{site: ?object, sharing: number}} `sharing` counts the OTHER UAIs
 *   at the same coordinate, so the card can say why two dots sit on one roof.
 */
export function pickMeshSite(sites, id, level) {
  const here = (Array.isArray(sites) ? sites : []).filter(
    (site) => Number.isFinite(site?.lat) && Number.isFinite(site?.lon)
      && schoolSiteKey(site.lat, site.lon) === id,
  );
  if (!here.length) return { site: null, sharing: 0 };
  const sameLevel = here.filter((site) => site.level === level);
  const pool = sameLevel.length ? sameLevel : here;
  const best = pool.slice().sort(
    (a, b) => (Number(b.enrolled) || 0) - (Number(a.enrolled) || 0)
      || String(a.uai || a.id).localeCompare(String(b.uai || b.id)),
  )[0];
  return { site: best, sharing: here.length - 1 };
}

/**
 * Ask the register for the establishment under one mesh dot.
 *
 * One request per clicked dot, memoized for the session — the annuaire is
 * rebuilt daily and a school's name does not move between two clicks. The
 * request is deliberately NOT abortable on camera movement: the reader asked
 * for this name, and a pan while it is in flight should not silently cancel
 * the answer to their question.
 * @param {object} record The mesh record that was selected.
 */
async function resolveMeshSite(record) {
  const id = record?.id;
  if (!id || !record.mesh) return;

  const cached = _meshNames.get(id);
  if (cached === 'pending') return;
  if (cached !== undefined) {
    record.resolved = cached;
    record.resolving = false;
    return;
  }

  _meshNames.set(id, 'pending');
  record.resolving = true;
  repaintSelectedCard(id);

  const { lat, lon } = record.site || {};
  const params = new URLSearchParams({
    south: (lat - MESH_LOOKUP_PAD_DEG).toFixed(5),
    west: (lon - MESH_LOOKUP_PAD_DEG).toFixed(5),
    north: (lat + MESH_LOOKUP_PAD_DEG).toFixed(5),
    east: (lon + MESH_LOOKUP_PAD_DEG).toFixed(5),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MESH_LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/schools-fr/sites?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const { site, sharing } = pickMeshSite(payload?.sites, id, record.site?.level);
    // A lookup that found nothing is CACHED as nothing. The alternative is a
    // fresh round trip on every click of a dot the register cannot name — the
    // same answer, paid for again each time.
    const resolved = site ? { ...site, sharing } : null;
    _meshNames.set(id, resolved);
    record.resolved = resolved;
  } catch (error) {
    // Not cached: a timeout or an offline moment is not the register's answer,
    // and the next click should be allowed to ask again.
    _meshNames.delete(id);
    if (error?.name !== 'AbortError') {
      console.warn('[Data:Schools-FR] mesh name lookup failed:', error?.message || error);
    }
  } finally {
    clearTimeout(timer);
    record.resolving = false;
    repaintSelectedCard(id);
  }
}

/** Redraw the selected card in place, if `id` is still what is selected. */
function repaintSelectedCard(id) {
  if (_selectedId !== id) return;
  const entry = createSchoolSelectedOverlayEntry(_records.get(id));
  if (entry) {
    _overlayHost.setEntries(
      SCHOOLS_FR_OVERLAY_SOURCE_ID,
      [entry],
      SCHOOLS_FR_OVERLAY_SOURCE_OPTIONS,
    );
  }
  governorRequestRender('schools-fr-name');
}

function selectSite(id) {
  const record = _records.get(id);
  if (!record) return;
  if (_selectedId && _selectedId !== id) clearSelection();
  _selectedId = id;
  if (record.point) {
    record.point.color = Cesium.Color.fromCssColorString(SELECTED_COLOR).withAlpha(fadeWeightOf(record));
    record.point.pixelSize = SELECTED_POINT_PX;
  }
  // A maillage dot knows its level and its roll but not its name — ask the
  // register for it, and paint the card twice rather than making the reader
  // zoom in to find out what they clicked on.
  if (record.mesh && !record.resolved) void resolveMeshSite(record);
  const entry = createSchoolSelectedOverlayEntry(record);
  if (entry) {
    _overlayHost.setEntries(
      SCHOOLS_FR_OVERLAY_SOURCE_ID,
      [entry],
      SCHOOLS_FR_OVERLAY_SOURCE_OPTIONS,
    );
  }
  governorRequestRender('schools-fr-select');
}

function selectDepartement(code) {
  const row = (_national?.departements || []).find((entry) => entry.code === code);
  // Any département the rollup mentions is selectable, including one with
  // nothing measured in it: the card is the only surface that can say WHY it
  // is drawn hatched, and refusing the click would leave the reader with an
  // unexplained hole (A1/A4). It used to require `schools > 0`.
  if (!row) return;
  if (_selectedId && _selectedId !== `dep:${code}`) clearSelection();
  _selectedId = `dep:${code}`;
  highlightSelectedDepartement();
  const anchor = _depMeta.get(code)?.anchor;
  const options = { truncated: _national?.truncated === true };
  if (anchor) {
    const entry = selectedOverlayEntry(
      `schools-fr:dep-card:${code}`,
      Cesium.Cartesian3.fromDegrees(
        anchor[0],
        anchor[1],
        schoolsDepartementLabelHeightM(row, options),
      ),
      buildSchoolsDepartementLabel(row, options),
    );
    _overlayHost.setEntries(
      SCHOOLS_FR_OVERLAY_SOURCE_ID,
      [entry],
      SCHOOLS_FR_OVERLAY_SOURCE_OPTIONS,
    );
  }
  governorRequestRender('schools-fr-select-dep');
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
      // The label plane the depth buffer knows nothing about, resolved after
      // the polygon pick. At national altitude the name floats clear of the
      // shape it belongs to, so it is often the only thing under the cursor.
      const labelled = pickOverlayLabelId(movement.position, {
        sourceId: SCHOOLS_FR_LABEL_SOURCE_ID,
        prefix: SCHOOLS_FR_DEP_LABEL_PREFIX,
        has: (depCode) => _depEntities.has(depCode),
        hitTest: _overlayHost.hitTest,
      });
      if (labelled) {
        selectDepartement(labelled);
        return;
      }
    }
    if (_selectedId) clearSelection();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  document.addEventListener('keydown', onKeyDown);
}

/**
 * The per-frame half of fade on zoom: role weights, written onto the dots.
 *
 * Runs on `zoomFade.js`'s one shared `preRender` read of the camera; nothing
 * is fetched or built here, and a frame in which no role weight moved a step
 * costs three comparisons. The prisms are toggled at the ends of the cut's
 * hand-over, never faded (`applyNationalVisibility`).
 */
function onZoomFadeFrame(scale, nowMs) {
  if (!_enabled) return;
  _fadeNow = nowMs;
  _fadeState.national = _regime === 'national';
  _fadeState.nationalReady = _nationalPainted;
  _fadeState.meshDrawn = _drawn.mesh;
  _fadeState.sitesDrawn = _drawn.sites;
  _fadeState.scale = schoolsSiteFadeScale(Math.max(scale.latSpan, scale.lonSpan), scale.heightM);
  _fadeState.band = SCHOOLS_SITE_FADE_BAND;
  familyAlphas(_fadeState, _fadeAlphas);
  const dots = _dotFader.apply(_records, _fadeAlphas);
  const national = applyNationalVisibility(_fadeAlphas.nationalShown);
  if (dots.changed || national || _fadeReportDirty) reportFade();
}

/** Publish the drawn state for the browser harness — on change only. */
function reportFade() {
  _fadeReportDirty = false;
  _fade?.report({
    levels: { national: _depShown ? 1 : 0, mesh: _fadeAlphas.meshLevel, sites: _fadeAlphas.sitesLevel },
    marks: { shared: _fadeAlphas.shared, sites: _fadeAlphas.sites, mesh: _fadeAlphas.mesh },
    dominant: _regime,
    bands: SCHOOLS_FADE_BANDS_REPORT,
    cuts: SCHOOLS_FADE_CUTS_REPORT,
  });
}

/** Keep the selected card pinned to its dot as the camera moves. */
function onPreRender() {
  if (!_enabled || !_selectedId || _selectedId.startsWith('dep:')) return;
  const record = _records.get(_selectedId);
  if (!record) return;
  const entry = createSchoolSelectedOverlayEntry(record);
  if (entry) {
    _overlayHost.setEntries(
      SCHOOLS_FR_OVERLAY_SOURCE_ID,
      [entry],
      SCHOOLS_FR_OVERLAY_SOURCE_OPTIONS,
    );
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
    source.name = messages().departementSourceName;
    source.show = _enabled;
    for (const entity of source.entities.values) {
      const code = String(entity.properties?.code?.getValue?.() ?? '').trim();
      if (!entity.polygon || !code) {
        entity.show = false;
        continue;
      }
      entity.polygon.outline = false;
      // `classificationType` is NOT set here any more — it used to be
      // `ClassificationType.BOTH` for every polygon, and it is now decided per
      // STATE in `applyPrismStyle`: cleared on a prism, re-armed on a flat
      // footprint. An extruded polygon classifies nothing —
      // `GroundGeometryUpdater._isOnTerrain` returns false as soon as
      // `extrudedHeight` is defined (bundled Cesium,
      // `index.js:148334-148336`) — so on a prism the property would be read
      // into `_classificationTypeProperty` and then IGNORED, silently and
      // without a warning. Three things follow from that, all of them wanted:
      // the thematic fill stops climbing façades (F4), the batched
      // GroundPrimitive bounding-rectangle colour bug stops applying, and
      // `outline` becomes legal — Cesium force-disables outlines only on
      // terrain (`index.js:61110-61113`) — which is what makes the silhouette
      // and the top edge the reading depends on drawable at all.
      //
      // `applyPrismStyle` owns the height too: a prism starts on the
      // ELLIPSOID so that two tops are comparable — a Savoie base clamped
      // 2 km up would put its top 2 km higher at equal count — while the two
      // flat states go back on the ground, where they can still be seen.
      entity.polygon.perPositionHeight = false;
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
    // A failed shape load must be retryable, not a permanently poisoned
    // promise that leaves the national view silently empty for the session.
    _depShapesPromise = null;
    throw error;
  });
  return _depShapesPromise;
}

/**
 * How a FLAT footprint is draped.
 *
 * `BOTH`, i.e. terrain and 3D tiles, and it is only ever set on the two states
 * with no height — see {@link applyPrismStyle}. A prism must never carry it:
 * an extruded polygon classifies nothing and the property would be read and
 * then ignored, silently.
 */
const FLAT_CLASSIFICATION = Cesium.ClassificationType.BOTH;

/** One reusable body material per colour class — 6 at most, plus the motif. */
const _bodyMaterials = new Map();
function bodyMaterial(color) {
  let material = _bodyMaterials.get(color);
  if (!material) {
    material = new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString(color).withAlpha(PRISM_BODY_ALPHA),
    );
    _bodyMaterials.set(color, material);
  }
  return material;
}
/** The near-opaque silhouette of a class — the top edge is the reading tool. */
const _outlineColors = new Map();
function outlineColor(color) {
  let value = _outlineColors.get(color);
  if (!value) {
    value = Cesium.Color.fromCssColorString(color).withAlpha(PRISM_TOP_ALPHA);
    _outlineColors.set(color, value);
  }
  return value;
}
/**
 * Alpha of a flat footprint.
 *
 * Higher than a prism body — there is no volume to see through and the mark
 * has to read as a floor — but not opaque: it is draped on the imagery, which
 * a reader is still entitled to see. Shared value with the sibling prism
 * layers.
 */
const FLAT_FOOTPRINT_ALPHA = 0.55;

/** A flat footprint's fill: solid, and only ever a MEASURED zero. */
function flatMaterial(color) {
  const key = `flat:${color}`;
  let material = _bodyMaterials.get(key);
  if (!material) {
    material = new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString(color).withAlpha(FLAT_FOOTPRINT_ALPHA),
    );
    _bodyMaterials.set(key, material);
  }
  return material;
}

/**
 * The MOTIF a refused channel is drawn with — bands, not a tint.
 *
 * D3: on a photorealistic globe there is no neutral colour, and a pattern is
 * the one encoding that survives the NVG and FLIR passes intact. Cesium's only
 * built-in periodic entity material is `StripeMaterialProperty`, so the map
 * gets bands where the legend swatch gets the shared diagonal hatch
 * (`PRISM_NO_RATIO_GLYPH`); both read as "motif = non publié", and writing a
 * custom shader for a case that occurs zero times in the current data would be
 * effort spent on the wrong end of the map.
 *
 * The even band is fully transparent on purpose: the imagery shows through, so
 * a hatched footprint can never be mistaken for the SOLID one that means
 * "measured zero" — which is the exact confusion A1 exists to prevent, and
 * which `choroplethPrism.js` spells out as a rule for all four prism layers.
 */
function motifMaterial(color) {
  const key = `motif:${color}`;
  let material = _bodyMaterials.get(key);
  if (!material) {
    material = new Cesium.StripeMaterialProperty({
      evenColor: Cesium.Color.TRANSPARENT,
      oddColor: Cesium.Color.fromCssColorString(color).withAlpha(PRISM_BODY_ALPHA),
      repeat: 18,
      orientation: Cesium.StripeOrientation.HORIZONTAL,
    });
    _bodyMaterials.set(key, material);
  }
  return material;
}

/**
 * Give one polygon entity the four-state prism style of `choroplethPrism.js`.
 *
 * The states are the module's contract and they must not converge:
 *
 *   count ✓ rate ✓  extruded prism, translucent body in the class colour,
 *                   near-opaque silhouette.
 *   count ✓ rate ✗  same prism, body BANDED: the height is read, the colour is
 *                   explicitly refused.
 *   count = 0       FLAT footprint, clamped to the ground, SOLID fill. Zero is
 *                   a measurement and must not look like a missing one.
 *   count ✗         FLAT footprint, clamped, BANDED — no prism at all, and
 *                   banded even when the rate IS published, because the
 *                   alternative (a solid flat fill in the rate's colour) is
 *                   pixel-for-pixel the "measured zero" mark. The published
 *                   rate then lives on the card, which is the price of keeping
 *                   those two apart.
 *
 * The body carries no alpha ENCODING: it is a constant (`PRISM_BODY_ALPHA`),
 * and the outline a second constant. Two scalars, deliberately, because alpha
 * used to carry the compositing correction and now carries nothing (A3).
 *
 * Selection changes the HUE and never the grammar: a selected refusal is still
 * banded, in cyan, so clicking a département cannot make it look measured.
 *
 * @param {object} entity A département polygon entity.
 * @param {object} built From {@link schoolsPrismRow}.
 * @param {boolean} [selected] Whether this is the clicked département.
 */
function applyPrismStyle(entity, built, selected = false) {
  const polygon = entity?.polygon;
  if (!polygon) return;
  const refused = !built.hasValue || !built.hasRatio;
  const color = selected
    ? SELECTED_COLOR
    : (refused ? PRISM_NO_RATIO_COLOR : built.color);

  polygon.perPositionHeight = false;
  polygon.fill = true;

  if (built.extruded) {
    // A volume, on the ellipsoid, classifying nothing.
    polygon.height = PRISM_BASE_HEIGHT_M;
    polygon.extrudedHeight = PRISM_BASE_HEIGHT_M + built.heightM;
    polygon.classificationType = undefined;
    polygon.outline = true;
    polygon.outlineWidth = 1;
    polygon.outlineColor = outlineColor(color);
    polygon.material = refused ? motifMaterial(color) : bodyMaterial(color);
  } else {
    // The two FLAT states go back ON THE GROUND, and that is the whole reason
    // `classificationType` is cleared rather than deleted from this module: a
    // footprint pinned to the ellipsoid would be buried under 2 km of Alpine
    // terrain, and an absence mark nobody can see is not an absence mark. The
    // price is the outline — Cesium force-disables it on a clamped polygon
    // (`index.js:61110-61113`) — so the two are told apart by their MATERIAL,
    // solid for a measured zero and banded for a département nobody measured.
    polygon.height = undefined;
    polygon.extrudedHeight = undefined;
    polygon.classificationType = FLAT_CLASSIFICATION;
    polygon.outline = false;
    polygon.material = refused ? motifMaterial(color) : flatMaterial(color);
  }
  entity.show = true;
}

/**
 * Rebuild the 96 prisms from the national rollup.
 *
 * Every département the rollup mentions is DRAWN, including the ones with
 * nothing to show: a hatched footprint is the mark for "not measured", and
 * hiding the entity would leave a hole a reader cannot tell from imagery
 * (A4 — an empty area on a globe has three possible causes and this removes
 * one of them). Only a code the rollup never mentions is hidden.
 */
function repaintDepartements() {
  if (!_national) return;
  const truncated = _national.truncated === true;
  const painted = new Set();
  for (const row of _national.departements || []) {
    const parts = _depEntities.get(row.code);
    if (!parts) continue;
    const built = schoolsPrismRow(row, { truncated });
    painted.add(row.code);
    for (const entity of parts) applyPrismStyle(entity, built, false);
  }
  for (const [code, parts] of _depEntities) {
    if (painted.has(code)) continue;
    for (const entity of parts) entity.show = false;
  }
  highlightSelectedDepartement();
  _viewer?.scene?.requestRender?.();
}

function publishDepartementOverlay() {
  if (!_enabled || _regime !== 'national') {
    _overlayHost.clearSource(SCHOOLS_FR_LABEL_SOURCE_ID);
    return;
  }
  const entries = [];
  const options = { truncated: _national?.truncated === true };
  for (const row of _national?.departements || []) {
    const anchor = _depMeta.get(row.code)?.anchor;
    if (!anchor) continue;
    // Anchored at the TOP of its own prism, not on the ground: the count in
    // the label and the top edge of the volume are the same datum, and a name
    // pinned to the base would sit up to 120 km under the thing it names.
    entries.push(createSchoolsDepartementOverlayEntry(
      row,
      Cesium.Cartesian3.fromDegrees(
        anchor[0],
        anchor[1],
        schoolsDepartementLabelHeightM(row, options),
      ),
      options,
    ));
  }
  _overlayHost.setEntries(SCHOOLS_FR_LABEL_SOURCE_ID, selectSchoolsLabelCohort(entries), {
    cohortLimit: SCHOOLS_FR_LABEL_COHORT_LIMIT,
    collisionCapacity: SCHOOLS_FR_LABEL_COLLISION_CAPACITY,
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
      const response = await fetch('/api/schools-fr/departements', { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
      console.warn('[Data:Schools-FR] national rollup failed:', error?.message || error);
      _nationalError = error?.message || 'national rollup unavailable';
    }
    return null;
  });
  return _nationalPromise;
}

function hideDepartements() {
  for (const parts of _depEntities.values()) {
    for (const entity of parts) entity.show = false;
  }
  _overlayHost.clearSource(SCHOOLS_FR_LABEL_SOURCE_ID);
  _depShown = false;
}

/**
 * Put the prisms on screen or take them off — the national side of the cut.
 *
 * TOGGLED, NEVER FADED, as in `irve-fr` and for the same reason: four kinds of
 * prism material plus a silhouette colour, of which only one could follow a
 * weight, re-read on every entity every frame. The cut's 260 ms hand-over is
 * carried by the dots; the entities are written at its two ends only.
 *
 * @param {boolean} show
 * @returns {boolean} Whether anything changed.
 */
function applyNationalVisibility(show) {
  if (show === _depShown) return false;
  if (show) {
    repaintDepartements();
    _depShown = true;
    publishDepartementOverlay();
  } else {
    hideDepartements();
    if (_regime !== 'national') _nationalPainted = false;
  }
  governorRequestRender('schools-fr-national-cut');
  return true;
}

/**
 * Enter (or refresh) the national regime.
 *
 * The dots are no longer cleared on the way in: they stay whole until the
 * prisms are painted, step down over one arrival ramp, and are dropped when it
 * ends — a first zoom out used to show an empty globe for as long as the
 * polygons and the rollup took. A forced refresh leaves the painted prisms up
 * until the new rollup repaints them, for the same reason.
 */
async function loadNational({ force = false } = {}) {
  _error = null;
  if (force) _national = null;
  _loading = !_national;
  const generation = _viewGeneration;
  try {
    await ensureDepartementShapes();
  } catch (error) {
    console.warn('[Data:Schools-FR] département polygons failed:', error?.message || error);
    _error = messages().departementShapesError;
    _status = 'error';
    _loading = false;
    return;
  }
  await ensureNational();
  if (generation !== _viewGeneration || !_enabled || _regime !== 'national') return;
  _loading = false;
  if (!_national) {
    _error = _nationalError || 'national rollup unavailable';
    _status = 'error';
    return;
  }
  _count = _national.painted || 0;
  _lastUpdate = Number(_national.fetchedAt) || Date.now();
  _status = _count > 0 ? 'ready' : 'empty';
  if (_nationalPainted && !force) {
    retirePoints();
    return;
  }
  _nationalPainted = true;
  repaintDepartements();
  _depShown = true;
  publishDepartementOverlay();
  if (_drawn.mesh || _drawn.sites) {
    _fade?.arrive(ARRIVAL_NATIONAL);
    scheduleRetire();
  }
  _fadeReportDirty = true;
  governorRequestRender('schools-fr-national');
}

// --- Mesh level -------------------------------------------------------------

async function ensureMesh() {
  if (_mesh) return _mesh;
  if (_meshPromise) return _meshPromise;
  _meshPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NATIONAL_TIMEOUT_MS);
    try {
      const response = await fetch('/api/schools-fr/mesh', { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload?.sites)) throw new Error('malformed mesh');
      _mesh = payload;
      _meshError = null;
      return payload;
    } finally {
      clearTimeout(timer);
      _meshPromise = null;
    }
  })().catch((error) => {
    if (error?.name !== 'AbortError') {
      console.warn('[Data:Schools-FR] national mesh failed:', error?.message || error);
      _meshError = error?.message || 'national mesh unavailable';
    }
    return null;
  });
  return _meshPromise;
}

/**
 * Pick the mesh for one view and hold it as the drawn mesh level.
 *
 * Re-picked on every camera settle rather than cached: the pick is a function
 * of the box, and re-running it over 68 158 tuples costs a few milliseconds
 * against a round trip that would cost a few hundred. Drawing is
 * {@link rebuildPoints}'s job, because inside the fade band the mesh is drawn
 * together with the sites.
 */
function pickMeshLevel(box) {
  const pick = selectSchoolsMesh(_mesh?.sites, {
    box,
    // § 3.5 — see `profileCountBudget`. Coverage first, density second.
    budget: profileCountBudget(schoolsMeshBudget(box.north - box.south)),
  });
  _meshPick = pick;
  _meshLevel = { pick, box };
}

/**
 * Pick and draw the mesh once the national pack is in hand — the slow path,
 * for the first settle of a session; later settles pick synchronously in
 * {@link loadViewport}.
 */
async function loadMeshLevel(box, viewGeneration) {
  _meshLoading = true;
  syncLoading();
  await ensureMesh();
  _meshLoading = false;
  syncLoading();
  if (viewGeneration !== _viewGeneration || !_enabled || _regime === 'national') return;
  if (!_mesh) {
    _error = _meshError || 'national mesh unavailable';
    _status = 'error';
    return;
  }
  _error = null;
  pickMeshLevel(box);
  _lastUpdate = Number(_mesh.fetchedAt) || Date.now();
  rebuildPoints();
}

// --- The two point levels, composed -----------------------------------------

/**
 * Compose the dots from the point levels that are drawn, and draw them.
 *
 * Outside the fade band one level is drawn and this is what each reconcile
 * path always did. Inside it both are, and each dot takes the role
 * `prismMeshSitesFade.js` argues for:
 *
 *   - the school a mesh dot stands on is drawn ONCE, as the site it is, and
 *     held whole through the band. The join is the one a mesh click already
 *     makes (`pickMeshSite`): the coordinate, then the level the dot claimed,
 *     then the largest roll — a coordinate is not a UAI, and a SEGPA sits at
 *     its collège's address;
 *   - a school the mesh thinned away fades in at the site level's alpha;
 *   - a mesh dot the site query did not return (the padding outside the view,
 *     or a capped answer) fades out at the mesh's alpha, as the mesh dot it is.
 *
 * A shared dot wears the SITE card in both halves of the band, and that is not
 * the site level overruling the mesh: a mesh card whose name lookup has come
 * back IS that card (`buildSchoolsMeshLabel`), and here the answer is already
 * in hand.
 */
function rebuildPoints() {
  if (!_points) return;
  clearSelection();
  _points.removeAll();
  _records.clear();

  const before = _drawn;
  const pick = _meshLevel?.pick || null;
  const sites = Array.isArray(_siteLevel?.sites) ? _siteLevel.sites : [];
  _drawn = { mesh: Boolean(pick), sites: Boolean(_siteLevel) };
  if (_regime !== 'national') {
    _regime = dominantPointLevel({
      meshDrawn: _drawn.mesh,
      sitesDrawn: _drawn.sites,
      scale: _settledScale,
      band: SCHOOLS_SITE_FADE_BAND,
    });
    syncLoading();
  }

  // The sites by coordinate, so each mesh dot can find the school it stands on.
  const siteIds = [];
  const sitesAt = new Map();
  for (const site of sites) {
    if (!site?.id || !Number.isFinite(site.lat) || !Number.isFinite(site.lon)) continue;
    siteIds.push(site.id);
    const key = schoolSiteKey(site.lat, site.lon);
    const here = sitesAt.get(key);
    if (here) here.push(site);
    else sitesAt.set(key, [site]);
  }
  /** Mesh coordinate id → its tuple, first one wins (one dot per coordinate, as before). */
  const meshById = new Map();
  /** Mesh coordinate id → the id of the site record that draws it, when there is one. */
  const drawnAs = new Map();
  for (const tuple of pick?.picked || []) {
    if (!Number.isFinite(tuple[MESH_LAT]) || !Number.isFinite(tuple[MESH_LON])) continue;
    const id = meshSchoolId(tuple);
    if (meshById.has(id)) continue;
    meshById.set(id, tuple);
    // i18n-ignore-next-line — a band key from the pack, not a word.
    const level = SCHOOL_LEVELS[tuple[MESH_LEVEL]] || 'autre';
    const match = _drawn.sites ? pickMeshSite(sitesAt.get(id), id, level).site : null;
    drawnAs.set(id, match ? match.id : id);
  }
  const roles = pointRoles(drawnAs.values(), siteIds, { meshDrawn: _drawn.mesh, sitesDrawn: _drawn.sites });

  const warm = [];
  for (const site of sites) {
    if (_records.size >= MAX_RENDERED_SITES) break;
    const id = site?.id;
    if (!id || _records.has(id) || !roles.has(id)) continue;
    const position = sitePosition(site);
    const color = schoolLevelColor(site.level);
    const size = schoolPointSize(site.enrolled);
    const point = _points.add({
      id,
      position,
      color: Cesium.Color.fromCssColorString(color),
      pixelSize: size,
      outlineColor: OUTLINE_COLOR,
      outlineWidth: 1,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      translucencyByDistance: new Cesium.NearFarScalar(500, 1.0, 60_000, 0.35),
    });
    _records.set(id, {
      id, site, point, position, baseColor: color, baseSize: size, fadeRole: roles.get(id),
    });
    warm.push(site);
  }
  for (const [id, tuple] of meshById) {
    if (_records.size >= MAX_RENDERED_SITES) break;
    if (drawnAs.get(id) !== id || _records.has(id)) continue;
    const lat = tuple[MESH_LAT];
    const lon = tuple[MESH_LON];
    // i18n-ignore-next-line — a band key from the pack, not a word.
    const level = SCHOOL_LEVELS[tuple[MESH_LEVEL]] || 'autre';
    const color = schoolLevelColor(level);
    const pupils = Number(tuple[MESH_PUPILS]) || 0;
    const size = schoolsMeshPointSize(pupils);
    // No ground warm-up here: at these altitudes a metre of vertical error is
    // invisible, and 2 200 terrain lookups per pan would not be.
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, POINT_LIFT_M);
    const point = _points.add({
      id,
      position,
      color: Cesium.Color.fromCssColorString(color),
      pixelSize: size,
      outlineColor: OUTLINE_COLOR,
      outlineWidth: 1,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    // A dot this session has already named keeps its name across pans and
    // zooms — the lookup is memoized, so re-entering a city redraws the cards
    // it earned rather than re-asking for them.
    const known = _meshNames.get(id);
    _records.set(id, {
      id,
      // A mesh record carries only what the national pack knows: no name, no
      // UAI. The flag is what lets the card say so instead of implying the
      // rest is absent — and what sends a click to the register for the rest.
      mesh: true,
      resolved: known && known !== 'pending' ? known : null,
      resolving: known === 'pending',
      site: { id, lat, lon, level, enrolled: pupils > 0 ? pupils : null },
      point,
      position,
      baseColor: color,
      baseSize: size,
      fadeRole: ROLE_MESH,
    });
  }

  _count = dominantRecordCount();
  warmGroundFloor(warm.slice(0, GROUND_WARM_LIMIT));
  _dotFader.invalidate();
  _fadeReportDirty = true;
  const arrival = pointArrivalKey(before, _drawn);
  if (arrival && _fade) {
    _fade.arrive(arrival);
    scheduleRetire();
  }
  if (!_error) _status = _count > 0 ? 'ready' : 'empty';
  governorRequestRender('schools-fr-points');
}

/** Dots in the level that owns the view — what the row and the stats count. */
function dominantRecordCount() {
  let count = 0;
  for (const record of _records.values()) if (inDominantLevel(record)) count += 1;
  return count;
}

/** Forget both point levels and every dot — the national regime, or disable. */
function clearSites() {
  if (_selectedId && !_selectedId.startsWith('dep:')) clearSelection();
  if (_points) _points.removeAll();
  _records.clear();
  _count = _regime === 'national' ? (_national?.painted || 0) : 0;
  _summary = null;
  _meshPick = null;
  _meshLevel = null;
  _siteLevel = null;
  _drawn = { mesh: false, sites: false };
  _fadeReportDirty = true;
}

/**
 * Let go of a level the view no longer wants, once the level replacing it is
 * drawn and has finished arriving — see `retiredPointLevel`.
 * @returns {boolean} Whether a level was dropped; the caller rebuilds.
 */
function retireLevel() {
  const level = retiredPointLevel({
    scale: _settledScale,
    band: SCHOOLS_SITE_FADE_BAND,
    meshDrawn: _drawn.mesh,
    sitesDrawn: _drawn.sites,
    meshArrival: _fade ? _fade.arrival(ARRIVAL_MESH) : 1,
    sitesArrival: _fade ? _fade.arrival(ARRIVAL_SITES) : 1,
  });
  if (level === 'sites') {
    _siteLevel = null;
    _summary = null;
    cancelSiteLevel();
    return true;
  }
  if (level === 'mesh') {
    _meshLevel = null;
    _meshPick = null;
    return true;
  }
  return false;
}

/** Drop whatever the settled view has finished replacing. */
function retirePoints() {
  if (!_enabled) return;
  if (_regime === 'national') {
    const arriving = _fade ? _fade.arrival(ARRIVAL_NATIONAL) < 1 : false;
    if (_nationalPainted && !arriving && (_drawn.mesh || _drawn.sites)) {
      clearSites();
      governorRequestRender('schools-fr-retire');
    }
    return;
  }
  if (!retireLevel()) return;
  // A rebuild the reader did not ask for keeps what they selected.
  const selected = _selectedId && !_selectedId.startsWith('dep:') ? _selectedId : null;
  rebuildPoints();
  if (selected && _records.has(selected)) selectSite(selected);
}

/** Run {@link retirePoints} once the arrival just started has finished. */
function scheduleRetire() {
  clearTimeout(_retireTimer);
  _retireTimer = setTimeout(() => {
    _retireTimer = null;
    retirePoints();
  }, ARRIVAL_MS + 60);
}

/** Abandon the site query in flight, if any. */
function cancelSiteLevel() {
  if (!_inFlight && !_siteLoading) return;
  _requestGeneration += 1;
  _inFlight?.abort?.();
  _inFlight = null;
  _lastBox = null;
  _siteLoading = false;
  syncLoading();
}

/** The row's "loading" belongs to the level that owns the row. */
function syncLoading() {
  if (_regime === 'national') return;
  _loading = _regime === 'sites' ? _siteLoading : _meshLoading;
}

/**
 * Fetch the schools in one box and hold them as the drawn site level. The old
 * drawing stays until the answer replaces it, so a pan is a swap, never a gap.
 */
async function loadSiteLevel(box, { force = false } = {}) {
  const key = [box.south, box.west, box.north, box.east].map((v) => v.toFixed(3)).join(',');
  if (!force && key === _lastBox && _inFlight) return;
  _lastBox = key;

  const generation = ++_requestGeneration;
  _inFlight?.abort?.();
  const controller = new AbortController();
  _inFlight = controller;
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  _siteLoading = true;
  syncLoading();

  try {
    const params = new URLSearchParams({
      south: box.south.toFixed(5),
      west: box.west.toFixed(5),
      north: box.north.toFixed(5),
      east: box.east.toFixed(5),
    });
    const response = await fetch(`/api/schools-fr/sites?${params}`, { signal: controller.signal });
    if (generation !== _requestGeneration) return;
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body?.error) detail = String(body.error);
      } catch { /* keep the status-code detail */ }
      throw new Error(detail);
    }
    const payload = await response.json();
    if (generation !== _requestGeneration || !_enabled || _regime === 'national') return;

    const { sites, ...summary } = payload;
    _siteLevel = { sites: Array.isArray(sites) ? sites : [], box };
    _summary = summary;
    _lastUpdate = Number(payload.fetchedAt) || Date.now();
    _error = null;
    rebuildPoints();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    if (generation !== _requestGeneration) return;
    console.warn('[Data:Schools-FR] viewport failed:', error?.message || error);
    _error = error?.message || 'viewport unavailable';
    _status = 'error';
  } finally {
    clearTimeout(timer);
    if (generation === _requestGeneration) {
      _siteLoading = false;
      _inFlight = null;
      syncLoading();
    }
  }
}

/**
 * Read the settled view: decide the regime, load every level whose weight is
 * above zero, and let go of the levels that are fully replaced. Loading stays
 * here, on the settle; the frame callback only fades what this has drawn.
 */
async function loadViewport({ force = false } = {}) {
  if (!_enabled || !_viewer) return;
  // Whatever this call concludes — records, a zoom-in verdict or a failure —
  // it concludes it about the view the camera is showing right now. See
  // `cameraSettle.js`: an arrival on any other view has to be read afresh.
  markViewportRead(_viewer, SCHOOLS_FR_LAYER_ID);
  const viewGeneration = ++_viewGeneration;
  _fadeReportDirty = true;

  const regime = updateRegime(_viewer);
  if (regime === 'national') {
    // The dots stay as the cover until the prisms are painted; only the
    // question in flight is abandoned.
    cancelSiteLevel();
    await loadNational({ force });
    return;
  }

  dropDepartementSelection();
  const wanted = wantedPointLevels(_settledScale, SCHOOLS_SITE_FADE_BAND);
  const siteBox = wanted.sites ? cameraSchoolsBox(_viewer) : null;
  // Inside the altitude gate but looking at more than the proxy will answer —
  // an oblique horizon shot. The mesh is the honest fallback, not an empty map.
  const meshBox = wanted.mesh || !siteBox ? cameraSchoolsMeshBox(_viewer) : null;
  if (!siteBox) cancelSiteLevel();

  let rebuild = retireLevel();
  const jobs = [];
  if (meshBox && _mesh) {
    pickMeshLevel(meshBox);
    _lastUpdate = Number(_mesh.fetchedAt) || Date.now();
    rebuild = true;
  } else if (meshBox) {
    jobs.push(loadMeshLevel(meshBox, viewGeneration));
  }
  if (rebuild) rebuildPoints();
  if (siteBox) jobs.push(loadSiteLevel(siteBox, { force }));
  syncLoading();
  await Promise.all(jobs);
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

function collectDetectableObjects(options = {}) {
  if (!_enabled || !_points?.show || !_records.size) return [];
  const records = [];
  for (const record of _records.values()) {
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
      id: schoolCalloutText(record),
      type: 'School',
      skipLabel: record.id === _selectedId,
    });
    if (result.length >= maxCount) break;
  }
  return result;
}

/**
 * The one line a DETECT callout gets for a school.
 *
 * The name first, because that is what identifies the thing on screen — a
 * reader scanning a district wants "Collège Jean Moulin", not "412 élèves",
 * which names nothing and repeats a number the dot's size already carries.
 * Where no name is known (an un-clicked maillage dot) the level is the honest
 * fallback: it is what the pack actually shipped.
 * @param {object} record
 * @returns {string}
 */
export function schoolCalloutText(record) {
  const site = record?.resolved || record?.site || {};
  if (site.name) return schoolDisplayName(site);
  const pupils = Number(site.enrolled) || 0;
  return pupils > 0
    ? messages().callout.levelAndPupils(schoolLevelLabel(site.level), fr(pupils))
    : schoolLevelLabel(site.level);
}

/**
 * The national legend: the height ruler, then the colour ladder, then what is
 * off the map.
 *
 * D1 in full — where a colour and a height carry values, the key has to be
 * readable WITH the map, and a height without numbered ticks means nothing at
 * all. The two-part body comes from `prismLegend`, which is shared with the
 * three sibling prism layers so the grammar cannot drift between them.
 *
 * One entry is added here because it belongs to this layer alone: the
 * establishments that are on the register and cannot be on this map. 2 762 of
 * them (measured) fall outside every bundled polygon — La Réunion's 855,
 * Guadeloupe's 448, Martinique's 403 — and 99 metropolitan ones were pulled up
 * to 2 km onto the nearest département by the coastal snap. Both facts belong
 * next to the key that is being read, not in a status line the reader has to
 * find. A choropleth that omits them quietly is a map claiming France has
 * 65 396 schools.
 *
 * @param {object} national The national rollup.
 * @returns {Array<object>} Legend entries, in reading order.
 */
export function buildSchoolsNationalLegend(national) {
  const m = messages();
  const entries = prismLegend(localizedPrismScale(), schoolsPrismTally(national));
  const offshore = Number(national?.unassigned) || 0;
  if (offshore > 0) {
    const snapped = Number(national?.snapped) || 0;
    entries.push({
      label: m.legend.offshore,
      color: null,
      count: offshore,
      blurb: m.legend.offshoreBlurb(
        snapped > 0 ? m.legend.offshoreSnapped(fr(snapped)) : '',
      ),
    });
  }
  return entries;
}

/** One line under the layer's toggle: what this view actually contains. */
export function buildSchoolsLoadingLabel({
  regime = _regime,
  status = _status,
  loading = _loading,
  count = _count,
  summary = _summary,
  national = _national,
  meshPick = _meshPick,
} = {}) {
  const m = messages();
  if (regime === 'mesh') {
    if (loading) return m.status.loadingMesh;
    if (status === 'error') return '';
    if (!meshPick) return '';
    if (!meshPick.inBox) return m.status.empty;
    // Naming both numbers is the whole contract of this regime: a thinned map
    // that does not say it is thinned claims France has 1 100 schools.
    return meshPick.thinned
      ? m.status.meshThinned(fr(meshPick.picked.length), fr(meshPick.inBox))
      : m.status.meshWhole(fr(meshPick.picked.length));
  }
  if (regime === 'national') {
    if (loading) return m.status.loadingNational;
    if (status === 'error') return '';
    if (!national) return '';
    const parts = [m.status.nationalCount(fr(national.assigned), fr(national.painted))];
    // The prism's own blind spot, stated where the prism is read.
    if (national.unassigned > 0) {
      parts.push(m.status.nationalOffshore(fr(national.unassigned)));
    }
    // A short export served as HTTP 200 is the one upstream failure that looks
    // exactly like a smaller country. It is also what turns every zero in the
    // rollup into an unproven number, which is why `schoolsPrismRow` demotes
    // those zeros to "not measured" — the line and the mark say the same thing.
    if (national.truncated) parts.push(m.status.truncated);
    // The national IPS coverage, and this is the only place it can honestly
    // be given: neither prism channel carries the index — the height is a
    // count and the colour is a density — so it has to be reported as a rate
    // rather than implied by a colour nobody painted.
    const nationalIps = ipsCoverageClause(national.ips);
    if (nationalIps) parts.push(nationalIps);
    return parts.join(' · ');
  }
  if (loading) return m.status.loadingViewport;
  if (status === 'error') return '';
  if (!count) return m.status.empty;
  const parts = [m.status.siteCount(fr(count))];
  if (summary?.pupils > 0) parts.push(m.status.sitePupils(fr(summary.pupils)));
  // The box's own coverage, over the schools in THIS view — so a reader who
  // clicks three dots and finds two without an index can see it was expected.
  const boxIps = ipsCoverageClause(summary?.ips);
  if (boxIps) parts.push(boxIps);
  if (summary && summary.complete === false) parts.push(m.status.capped);
  return parts.join(' · ');
}

// --- Layer ------------------------------------------------------------------

const schoolsFranceLayer = {
  id: SCHOOLS_FR_LAYER_ID,
  // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
  name: 'Établissements scolaires (FR)',
  icon: '🎓',
  source: 'Annuaire de l’éducation — MENJ',
  // i18n-ignore-end
  updateInterval: POLL_INTERVAL_MS,

  init(viewer) {
    _viewer = viewer;
    _points = new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT });
    _points.show = false;
    viewer.scene.primitives.add(_points);
    registerSpriteCollection(SCHOOLS_FR_LAYER_ID, _points);

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
    _depShown = false;
    _meshPick = null;
    _meshLevel = null;
    _siteLevel = null;
    _drawn = { mesh: false, sites: false };
    _settledScale = Infinity;
    _meshNames = new Map();
    _lastBox = null;

    _overlayHost.setVisible(SCHOOLS_FR_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(SCHOOLS_FR_LABEL_SOURCE_ID, false);
    restoreSpriteOrder(viewer);
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    _points.show = true;
    if (_depDataSource) _depDataSource.show = true;
    _overlayHost.setVisible(SCHOOLS_FR_OVERLAY_SOURCE_ID, true);
    _overlayHost.setVisible(SCHOOLS_FR_LABEL_SOURCE_ID, true);
    installClickHandler(viewer);
    registerPickOwner(SCHOOLS_FR_LAYER_ID, (pickedId) => _records.has(pickedId));

    if (!_cameraChangedAttached) {
      viewer.camera.changed.addEventListener(onCameraChanged);
      claimCameraSensitivity(viewer, SCHOOLS_FR_LAYER_ID);
      // Arrival, as opposed to motion — see `onCameraSettled`.
      watchCameraSettle(viewer, SCHOOLS_FR_LAYER_ID, onCameraSettled);
      _cameraChangedAttached = true;
    }
    if (!_preRenderRemover) {
      _preRenderRemover = viewer.scene.preRender.addEventListener(onPreRender);
    }
    // Fade on zoom: one shared per-frame read of the camera, held only while
    // the layer is on. See `onZoomFadeFrame`.
    _fade = watchZoomFade(viewer, SCHOOLS_FR_LAYER_ID, onZoomFadeFrame);
    _dotFader.invalidate();
    _fadeReportDirty = true;
    void loadViewport({ force: true });
    restoreSpriteOrder(viewer);
  },

  disable(viewer) {
    _enabled = false;
    _requestGeneration += 1;
    _viewGeneration += 1;
    _regime = 'national';
    _nationalPainted = false;
    _meshPick = null;
    clearTimeout(_cameraDebounceTimer);
    _cameraDebounceTimer = null;
    clearTimeout(_retireTimer);
    _retireTimer = null;
    _inFlight?.abort?.();
    _inFlight = null;
    _siteLoading = false;
    _meshLoading = false;
    _fade?.release();
    _fade = null;

    clearSelection();
    clearSites();
    hideDepartements();
    if (_depDataSource) _depDataSource.show = false;
    _overlayHost.setVisible(SCHOOLS_FR_OVERLAY_SOURCE_ID, false);
    _overlayHost.setVisible(SCHOOLS_FR_LABEL_SOURCE_ID, false);

    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
    document.removeEventListener('keydown', onKeyDown);
    unregisterPickOwner(SCHOOLS_FR_LAYER_ID);

    if (_cameraChangedAttached) {
      viewer.camera.changed.removeEventListener(onCameraChanged);
      releaseCameraSensitivity(viewer, SCHOOLS_FR_LAYER_ID);
      releaseCameraSettle(viewer, SCHOOLS_FR_LAYER_ID);
      _cameraChangedAttached = false;
    }
    if (_preRenderRemover) {
      _preRenderRemover();
      _preRenderRemover = null;
    }

    _points.show = false;
    _loading = false;
    _status = 'idle';
    _lastBox = null;
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
    const label = buildSchoolsLoadingLabel();
    if (label) stats.loadingLabel = label;
    if (_regime === 'national' ? _national?.stale : _summary?.stale) stats.stale = true;
    if (_error) stats.error = _error;
    return stats;
  },

  /** Viewport provenance for the attribution popover and analyst surfaces. */
  getViewportSummary() {
    return _summary ? { ..._summary } : null;
  },

  /** What the maillage actually drew, against what was in view. */
  getMeshSummary() {
    if (!_meshPick) return null;
    return {
      shown: _meshPick.picked.length,
      inBox: _meshPick.inBox,
      budget: _meshPick.budget,
      cells: _meshPick.cells,
      thinned: _meshPick.thinned,
      nationalSites: _mesh?.siteCount ?? null,
    };
  },

  /** National rollup, for the analyst and for tests. */
  getNationalSummary() {
    if (!_national) return null;
    const { departements, ...rest } = _national;
    return { ...rest, regime: _regime };
  },

  /**
   * Colour legend for the control-panel row — whichever scale is actually on
   * screen, never both.
   */
  getRowControls() {
    if (_regime === 'national') {
      if (!_national) return { chips: [], legend: [] };
      return { chips: [], legend: buildSchoolsNationalLegend(_national) };
    }
    const tally = new Map();
    for (const record of _records.values()) {
      // Inside the fade band the key is the dominant level's: a mesh key
      // counts the sample, a site key the inventory, and the other level's
      // dots belong to neither.
      if (!inDominantLevel(record)) continue;
      const level = record.site?.level;
      if (level) tally.set(level, (tally.get(level) || 0) + 1);
    }
    const legend = SCHOOL_LEVELS
      .filter((level) => tally.get(level) > 0)
      .map((level) => {
        const entry = {
          label: schoolLevelLabel(level),
          color: schoolLevelColor(level),
          count: tally.get(level),
        };
        const blurb = levelBlurb(level);
        if (blurb) entry.blurb = blurb;
        return entry;
      });
    // Naming the sample is the point: this mix is what the thinning drew, close
    // to the real one but not it. See `schoolsMesh.js`. The IPS half is here
    // and not in the status line because the maillage ships no index at all —
    // it is fetched per click, with the name, and a reader has to be told that
    // before they conclude the index is missing. One line, under the classes,
    // because it is true of all of them.
    if (_regime === 'mesh') return { chips: [], legend, note: meshLegendNote() };
    return { chips: [], legend };
  },

  destroy(viewer) {
    if (_enabled) this.disable(viewer);
    else {
      clearSelection();
      _overlayHost.setVisible(SCHOOLS_FR_OVERLAY_SOURCE_ID, false);
      _overlayHost.setVisible(SCHOOLS_FR_LABEL_SOURCE_ID, false);
      if (_clickHandler) {
        _clickHandler.destroy();
        _clickHandler = null;
      }
      document.removeEventListener('keydown', onKeyDown);
      unregisterPickOwner(SCHOOLS_FR_LAYER_ID);
    }
    if (_preRenderRemover) {
      _preRenderRemover();
      _preRenderRemover = null;
    }
    if (_depDataSource) {
      viewer.dataSources?.remove?.(_depDataSource, true);
      _depDataSource = null;
    }
    _depEntities.clear();
    _depMeta = new Map();
    _depShapesPromise = null;
    if (_points) {
      unregisterSpriteCollection(SCHOOLS_FR_LAYER_ID, _points);
      viewer.scene.primitives.remove(_points);
      _points = null;
    }
    _records.clear();
    _meshNames = new Map();
    _viewer = null;
  },
};

/** Seed rendered records so selection/card/legend paths run without WebGL. */
export function _setSchoolsStateForTest({
  viewer, records, overlayHost, summary, status, count, regime, national, depEntities, depMeta,
  mesh, meshPick,
} = {}) {
  _mesh = mesh || null;
  _meshPick = meshPick || null;
  _viewer = viewer || null;
  _records = new Map((records || []).map((record) => [record.id, record]));
  _selectedId = null;
  _overlayHost = overlayHost || DEFAULT_OVERLAY_HOST;
  _summary = summary || null;
  _status = status || 'ready';
  _count = Number.isFinite(count) ? count : _records.size;
  _loading = false;
  _regime = regime || 'sites';
  _national = national || null;
  _depEntities = new Map(depEntities || []);
  _depMeta = new Map(depMeta || []);
  _enabled = true;
  // A seeded national regime is one whose prisms are on screen.
  _depShown = _regime === 'national';
  _meshLevel = null;
  _siteLevel = null;
  _drawn = { mesh: false, sites: false };
  _settledScale = Infinity;
}

/**
 * Compose the two point levels through the production rebuild, on a real
 * point collection and without a scene — the band's no-doubling contract.
 * @returns {Map<string, object>} The records, as built.
 */
export function _composeSchoolsPointsForTest({ points, meshPick = null, sites = null, scale }) {
  _points = points;
  _meshLevel = meshPick ? { pick: meshPick, box: null } : null;
  _meshPick = meshPick;
  _siteLevel = sites ? { sites, box: null } : null;
  _settledScale = scale;
  _regime = 'mesh';
  rebuildPoints();
  return _records;
}

/** Move the settled regime without touching what is drawn. */
export function _setSchoolsRegimeForTest(regime) {
  _regime = regime;
}

/** Run one fade frame at a given view, as `zoomFade.js` would. */
export function _schoolsFadeFrameForTest(scale) {
  onZoomFadeFrame(scale, 0);
  return { ..._fadeAlphas };
}

/** Exercise the production selection path in focused runtime tests. */
export function _selectSchoolForTest(id) {
  selectSite(id);
}

/** Exercise the production département selection path. */
export function _selectSchoolsDepartementForTest(code) {
  selectDepartement(code);
}

/** Exercise the production clear path and restore the production host seam. */
export function _clearSchoolsSelectionForTest() {
  clearSelection();
  _overlayHost = DEFAULT_OVERLAY_HOST;
  _national = null;
  _nationalPainted = false;
  _mesh = null;
  _meshPick = null;
  _depEntities = new Map();
  _depMeta = new Map();
  _regime = 'sites';
  _enabled = false;
  _depShown = false;
  _meshLevel = null;
  _siteLevel = null;
  _drawn = { mesh: false, sites: false };
  _settledScale = Infinity;
  _points = null;
}

/** Row-control legend, for tests that do not construct a viewer. */
export function _schoolsRowControlsForTest() {
  return schoolsFranceLayer.getRowControls();
}

/** Ambient département label cohort, for tests that do not construct a viewer. */
export function _schoolsDepartementOverlayForTest() {
  const entries = [];
  const options = { truncated: _national?.truncated === true };
  for (const row of _national?.departements || []) {
    const anchor = _depMeta.get(row.code)?.anchor;
    if (!anchor) continue;
    entries.push(createSchoolsDepartementOverlayEntry(
      row,
      { anchor, heightM: schoolsDepartementLabelHeightM(row, options) },
      options,
    ));
  }
  return selectSchoolsLabelCohort(entries);
}

export default schoolsFranceLayer;
