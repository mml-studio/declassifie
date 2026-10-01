/**
 * @module anfrFrance
 *
 * Every mast in France, drawn by WHICH GENERATION ACTUALLY TRANSMITS FROM IT.
 *
 * `anfrFeed.js` holds the reading of the 826 418-row observatoire and every
 * trap in it; `anfrMesh.js` holds the thinning policy for the middle zooms;
 * this file is the drawing.
 *
 * ── NAME COLLISION, NOT DATA COLLISION ──────────────────────────────────────
 * This repo already ships a layer called `radio`. That one is
 * radio-browser.info — internet AUDIO streams, keyed by a station UUID, played
 * through an `HTMLAudioElement`, ids prefixed `radio:`. This one is physical
 * masts keyed by ANFR's `SUP_ID`, ids prefixed `anfr-fr:`. The two share a
 * panel shelf (RÉSEAUX & CAPTEURS) and nothing else: no field, no identifier,
 * no upstream, no pick id. Anyone reading `radio` in this directory expecting
 * antennas is reading the wrong file.
 *
 * ── Two regimes, and why there is no choropleth ─────────────────────────────
 * `schools-fr`, `irve-fr` and `sup-fr` all open on 96 painted départements.
 * This layer deliberately does not, and the reason is a measurement rather
 * than a preference.
 *
 * The bundled outlines are METROPOLITAN: 96 features, no overseas geometry
 * (counted in `local_data/france_departements/departements.geojson`). Measured
 * over the whole register on 2026-09-02, the share of supports whose newest
 * radiating generation is 5G runs **59.7 % → 75.5 % across the metropolitan
 * interquartile range** — a nearly flat map — while the territories a
 * metropolitan choropleth cannot draw are the entire story: Nouvelle-Calédonie
 * **1.0 %** (611 supports), Polynésie française **8.7 %** (644),
 * Guadeloupe 29.8 %, Martinique 28.8 %, against Val-d'Oise's **84.1 %**. A
 * département choropleth here would spend the whole national view painting the
 * 59–76 % band and would silently drop the 3 822 supports where the finding
 * is. So the national view is the maillage: real mast positions, thinned, in
 * every French territory, coloured by the same channel as every other zoom.
 *
 *   maillage — real positions, spatially thinned to 1 100–2 200 dots. Measured
 *              on the real 72 700 tuples: a whole-France box (10.4° of
 *              latitude) holds **68 878** supports and 305 occupied cells, and
 *              the pick costs 15.3 ms — well inside one camera settle.
 *   supports — every support in the box, with its card. Entered at ≤ 0.32° of
 *              view span and capped by the proxy at 0.35°, because the
 *              worst-placed 0.35° box in France (anchored at 48.6725 N,
 *              2.19556 E — Paris and the inner suburbs) holds **6 462**
 *              supports, which the proxy serves as 112 831 bytes gzipped and
 *              which is one BillboardCollection.
 *
 * ── What the fill claims, what the size claims, what the RING claims ────────
 * FILL is the newest generation that RADIATES — `anfrBand(live)`, which reads
 * the in-service and technically-operational systems and never the approved
 * projects. Measured over the 72 700: **5G 50 148 · 4G 18 698 · 3G 127 ·
 * 2G 89 · rien 3 638**.
 *
 * That distribution is why the palette has two anchors and not five steps.
 * Three quarters of a five-step ramp would be spent on 216 masts — 0.30 % of
 * the country. So 5G is the one saturated colour on this layer (amber) and
 * everything older is one low-chroma steel family at three luminances. The map
 * reads "amber where 5G is, quiet where it is not", which is what the data
 * says. Nothing else on this globe uses a low-chroma steel as a categorical
 * dot fill: the greys in `schools-fr`, `irve-fr` and `radio` are all
 * *unknown-value* catch-alls, and this is a measured value.
 *
 * SIZE is the number of distinct operators on the mast, which is the only
 * "how big" this register publishes and is never missing — every row names its
 * operator. Measured: **36 671 supports carry one operator, 16 786 two,
 * 8 230 three, 11 012 four, and exactly one carries five** (SUP_ID 506104,
 * Saint-Barthélemy).
 *
 * THE PALE RING IS THE HONEST HALF, and it means one thing everywhere:
 * *an approved project is on file at this position*. **`Projet approuvé` is
 * 66 508 of the 826 418 rows — 8.05 %**, re-counted from the portal's own
 * `refine.statut` on 2026-09-02, not sampled. Two shapes carry it:
 *
 *   hollow ring   — 3 638 supports (5.00 %) where NOTHING radiates. A file at
 *                   ANFR, not a mast. Never drawn as a generation.
 *   ring on a dot — 3 776 supports that radiate today and whose approved
 *                   project would ADD a generation they do not have. Counted
 *                   with the feed's own rule: an operator re-filing for a band
 *                   already on the air is paperwork, not an upgrade, and
 *                   11 830 of the 15 606 live supports with a project on file
 *                   are exactly that.
 *
 * ── The MAST: the support drawn at its real height, in world metres ─────────
 * The register publishes `sup_nm_haut` and this layer read it, printed it on a
 * card, and drew a flat dot. A 343 m guyed mast and a 12 m rooftop pole were
 * the same mark on a 3D globe.
 *
 * The coverage was measured before anything was drawn (the count is in
 * `anfrFeed.js`, Trap 3): **72 149 of the 72 700 supports publish a usable
 * height — 99.24 %**. Median 30 m, p95 48 m, max 343.3 m. That is dense enough
 * to extrude, so the support is extruded.
 *
 * **IN WORLD UNITS, NOT IN PIXELS, and that is the whole B2 decision.** A
 * support is a physical object with a real height; drawing it at 1 m of shaft
 * per 1 m of mast means the mark shrinks with distance exactly as the mast
 * itself does, which is the branch of B2 that is legitimate — the forbidden one
 * is a thematic size composed with `scaleByDistance`, and there is none here.
 * The dot keeps its own channel unchanged: pixel size is still the operator
 * count, and it is NOT multiplied by anything. Two orthogonal channels, one
 * screen-space and one world-space.
 *
 * The dot is seated on TOP of the shaft, at the height the register gives,
 * because that is where the antennas are. It is lifted in the exact regime at
 * every span, not only where the shaft is drawn, so that crossing the shaft
 * threshold never makes a dot jump: at 0.32° of span a 30 m lift is about one
 * pixel.
 *
 * WHEN. Shafts are drawn only under **0.06° of view span** (about 6.7 km
 * across), with the exit at 0.09°. That is not a taste: at 0.32° — the top of
 * the exact regime — a median 30 m mast is about one screen pixel and a shaft
 * would be noise that changes nothing. The cost of the closest regime is
 * measured on the real positions: the fullest possible 0.06° box in France
 * holds **1 063 supports** (48.83278 N, 2.31639 E, central Paris) and the
 * fullest 0.09° box holds **1 913**, against a ceiling of 2 400 polylines that
 * therefore never bites.
 *
 * WHERE THE HEIGHT IS MISSING, THERE IS NO SHAFT — and that is the A1 half.
 * The 551 supports without one keep their dot on the ground and get no mast at
 * all, because the fallback here is the ABSENCE of the mark and never a
 * default value of it. It costs nothing to be right about, since the 551 are
 * not a random hole: **all 551 are `Intérieur sous-terrain` (506), `Tunnel`
 * (38) or `Intérieur galerie` (7)** — the register omits the height because
 * the equipment is underground and there is no mast to measure. A shaft there
 * would be an invention twice over. The count travels with the row label and
 * the legend.
 *
 * A support that radiates nothing gets a DASHED shaft. Its height is a
 * declared figure on an authorised file, not a measurement of something built,
 * and the dash is the same statement the hollow ring already makes on the dot.
 * A motif rather than a tint, per D3, because it survives the FLIR and NVG
 * passes that would flatten a colour difference.
 *
 * OCCLUSION, declared per F1: the shaft is world geometry and is depth-tested,
 * so a building in front of it hides it — which is information. The dot keeps
 * `disableDepthTestDistance` as it always had, so a mast in a dense city stays
 * clickable. The two marks are not the same sign and do not claim to be.
 *
 * ── The AZIMUTHS: one mast at a time, because that is where they exist ──────
 * A mobile antenna is not omnidirectional and the direction it faces is the
 * field a map of masts most obviously wants. **It is not in the observatoire**
 * — the CSV is 22 columns and none of them is a bearing, re-verified against
 * the live file on 2026-09-03 (the header is quoted in `anfrFeed.js`). It IS
 * in Cartoradio, per antenna, on the same on-demand call this layer already
 * makes for a clicked mast: measured over 40 supports spread through the
 * register, **324 of 328 antennas publish an orientation, 98.8 %**.
 *
 * So the sectors are drawn for the SELECTED support and for nothing else. That
 * is a limit of the transport, not a design flourish: one Cartoradio call per
 * mast is what this layer is allowed to make, and a viewport of sectors would
 * mean thousands. Saying so is the honest form; drawing a default fan on every
 * dot would be the dishonest one.
 *
 * RAYS, NOT WEDGES. ANFR publishes the bearing and publishes neither a
 * beamwidth nor a range, so a wedge would have to invent an aperture and a
 * distance. The ray is drawn at a declared **60 m** — twice the national
 * median mast height, chosen so it reads against the shaft it springs from —
 * and the key says this length is indicative, not a range.
 * `orientation: 0` is drawn as due north, because it was
 * checked and it is one: 26 of 138 measured installations carry a 0, none
 * carries it alone, and 18 of the 26 are the three-sector `0/120/240`.
 *
 * An antenna whose bearing is not filed gets no ray. That is the same case
 * `cctv.js` meets with an unsurveyed camera
 * heading and answers with a dashed cone — the difference is that `cctv.js`
 * has a placeholder bearing to disown, and this layer has none to draw, so the
 * stricter answer is available and is taken.
 *
 * ── The register's status field is about 5G, not about maturity ─────────────
 * Cross-tabulated over all 826 418 rows on 2026-09-02: `Techniquement
 * opérationnel` appears on **5G rows and nothing else** — all 120 891 of them —
 * and **no 5G row in this edition is ever `En service`**. The 2G/3G/4G rows
 * are `En service` (639 019) or `Projet approuvé`. So "technically operational"
 * is not a fact about one operator's rollout at one mast; it is how ANFR files
 * 5G as a whole.
 *
 * The card USED to print it, per mast, as "la 5G est allumée ici mais pas
 * encore déclarée ouverte au public". It no longer does, and the reason is
 * the sentence above: a status that is true of all 120 891 5G rows in the
 * edition is not news about the mast under the cursor, and a caveat that
 * fires on every 5G mast in France reads as a caveat about THAT mast. The
 * distinction is kept in the data — `svc` and `live` are still separate masks
 * and colour still reads `live` — and it is documented here, where a
 * register-wide convention belongs.
 *
 * ── What this map cannot show, by statute ───────────────────────────────────
 * Quoted from the canonical dataset: *"Installations radioélectriques de plus
 * de 5 watts, hormis celles de l'Aviation Civile et des ministères de la
 * Défense et de l'Intérieur."* Blank ground beside a base or an airport is
 * policy, not a gap in the data. And the observatoire is PUBLIC MOBILE only:
 * a support that also carries a microwave link, TNT or PMR is drawn here as a
 * mobile mast, and only its mobile networks are named.
 *
 * ── The card and the key are written for a first-time reader ────────────────
 * Five short lines on the card (what and whose, the networks, where, the
 * waves, the source) and one plain name per colour in the key, since
 * 2026-09-22 — see "Card copy" below for what was left off and the three
 * refusals that were kept.
 */

import { formatDate, formatNumber, formatPercent } from '../i18n/format.js';
import { labelFor } from '../i18n/messages.js';
import { ANFR_NATURE_LABELS } from './anfrFrance.i18n.js';
import messages from './anfrFrance.i18n.js';
import * as Cesium from 'cesium';
import { profileCountBudget } from '../perfProfile.js';
import { claimCameraSensitivity, releaseCameraSensitivity } from './cameraSensitivity.js';
import { markViewportRead, releaseCameraSettle, watchCameraSettle } from './cameraSettle.js';
import { governorRequestRender } from '../renderGovernor.js';
import { registerSpriteCollection, restoreSpriteOrder, unregisterSpriteCollection } from './spriteOrder.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';
import { cachedGroundFloor, warmGroundFloor } from './groundFloor.js';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import { prismHatchGlyph } from './choroplethPrism.js';
import {
  ANFR_BANDS,
  ANFR_EXPOSURE_RADIUS_M,
  ANFR_GENERATIONS,
  anfrBand,
  anfrDecodeMask,
  anfrProjectPoint,
  anfrUnmeasuredBands,
} from './anfrFeed.js';
import {
  MESH_LAT,
  MESH_LON,
  MESH_OPERATORS,
  meshSupportBand,
  meshSupportId,
  anfrMeshBudget,
  selectAnfrMesh,
} from './anfrMesh.js';
import { pickAt } from './pickAt.js';
import { isWorldPick } from './pickRegistry.js';
import { sceneGroundPoint } from './groundPick.js';
import {
  COVERAGE_DRAPE_ALPHA,
  COVERAGE_FORMAT,
  COVERAGE_OPERATORS,
  coverageCardText,
  coverageHatchLut,
  coverageLegend,
  coverageLut,
  coverageMonthLabel,
  coverageSelectionPanel,
  normalizeCoverageMode,
} from './mobileCoverage.js';
import coverageMessages from './mobileCoverage.i18n.js';
import { coverageTileSource, createCoverageImageryProvider, createCoveragePointReader } from './mobileCoverageImagery.js';
import { VIEWSHED_COLOR, computeMastViewshed, createViewshedImageryLayer } from './mastViewshedImagery.js';
import { createAnfrSupportCells } from './anfrSupportCells.js';
import {
  ANFR_HOLLOW_TRIANGLE_LEGEND_GLYPH,
  ANFR_SELECTED_FILL,
  ANFR_SELECTED_SCALE,
  ANFR_TRIANGLE_LEGEND_GLYPH,
  anfrGlyphScale,
  anfrMastGlyph,
  anfrSelectedGlyph,
} from './anfrGlyphs.js';
import { mapKeyCarriesSelection } from './mapKeySelection.js';
import {
  bandPosition,
  fadeBand,
  levelVisible,
  quantizeFade,
  reveal,
  watchZoomFade,
} from './zoomFade.js';
import { fadeMarkLevel, meshSitesAlphas } from './amenitiesMedecinsAnfrFade.js';

/** Layer id — also the share-link registry key and the voice-tool enum value. */
export const ANFR_FR_LAYER_ID = 'anfr-fr';

/** Selected-support card, on its own protected overlay source. */
export const ANFR_FR_OVERLAY_SOURCE_ID = 'anfr-fr-selected';
export const ANFR_FR_OVERLAY_SOURCE_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});

/** Keyless, same-origin. See `anfrFranceProxy` in vite.config.js. */
const MESH_URL = '/api/anfr-fr/mesh';
const SUPPORTS_URL = '/api/anfr-fr/supports';
const DETAIL_URL = '/api/anfr-fr/support';
/** The ARCEP coverage pyramid's meta; the tiles themselves are outside /api. */
const COVERAGE_META_URL = '/api/anfr-fr/coverage';
/** Overlay id of the coverage card, on the same source as the support card. */
const COVERAGE_CARD_ID = 'anfr-fr:coverage';
/**
 * How long a ground card waits for its answer before saying it is reading.
 * The answer is a decoded tile already in memory or one small PNG from the
 * HTTP cache, so it nearly always lands first and no loading card is shown.
 */
const LOADING_CARD_DELAY_MS = 250;

// --- Activation / load gating ----------------------------------------------
/**
 * Widest box the supports route will answer, in degrees.
 *
 * 0.35, the same ceiling `schools-fr` settled on, and it holds here for a
 * measured reason rather than by imitation: sweeping every candidate 0.35° box
 * over the real 72 700 positions, the fullest one holds **6 462** supports
 * (anchored at 48.6725 N, 2.19556 E). At 0.5° it is 7 793 and at 0.25° it is
 * 5 006 — the curve is flat, because Île-de-France's masts are already inside
 * any box that reaches Paris, so widening the ceiling buys density nobody can
 * read and narrowing it costs a regime handover for nothing.
 */
export const ANFR_MAX_BOX_DEG = 0.35;
/**
 * The band, in the view's LARGER span (degrees), across which the maillage
 * hands over to every support: 0.35° → 0.21°.
 *
 * It replaces the 0.32 / 0.35 hysteresis, and its coarse end is the old exit:
 * the box ceiling itself. `/supports` is asked about the camera box UNPADDED
 * ({@link cameraAnfrBox}), so a 0.35° view is a 0.35° box, the largest the
 * proxy answers, and the fullest one in France (6 462 supports, Paris) is
 * still one BillboardCollection under the 8 000-mark cap — nothing about the
 * request changes. The fine end is 0.6 × 0.35 = 0.21°; coarse / fine = 1.67.
 *
 * The weights are `reveal`: the supports are at full strength by
 * 0.35 × 0.6^0.3 = 0.300°, the maillage's own dots are gone by
 * 0.35 × 0.6^0.7 = 0.245°, and the supports own the key from 0.314°. Keeping
 * the maillage down to 0.245° costs the world-locked re-pick the maillage
 * already runs on every settle (1.7 ms over Paris, measured), and nothing on
 * the wire.
 *
 * The maillage is a thinned subset of the same supports — `buildAnfrMesh`
 * writes one tuple per support, at its coordinate — so the two levels are not
 * faded into each other wholesale (see `amenitiesMedecinsAnfrFade.js`). A
 * support whose coordinate the maillage draws is SHARED: drawn at full
 * strength from the moment it lands. Its maillage dot stays under it and
 * fades with the maillage, which is what carries the one thing the two looks
 * disagree on — a support fades with distance (`SUPPORT_FADE`, about 0.8 at
 * the 25-45 km a band view is seen from) and a maillage dot does not — so the
 * mark steps from the dot's 1.0 to the support's 0.8 smoothly, never through
 * a dip. Only the supports the maillage thinned away come in with the band,
 * and only the maillage dots no support answered (the padded edge) go out.
 */
export const ANFR_SUPPORTS_BAND = fadeBand(0.21, ANFR_MAX_BOX_DEG);
const CAMERA_DEBOUNCE_MS = 450;
/**
 * Poll cadence (ms). The observatoire is rebuilt WEEKLY — `extras.frequency`
 * is `weekly` and all 826 418 rows carry one identical `date_maj` — so
 * anything faster re-asks a question whose answer cannot have changed. The
 * camera, not the clock, drives this layer.
 */
const POLL_INTERVAL_MS = 6 * 60 * 60_000;
/** The national mesh is 392 KB gzipped and the proxy may be building it. */
const NATIONAL_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 45_000;
/** A click's worth of patience, not a viewport's. */
const DETAIL_TIMEOUT_MS = 20_000;
/**
 * Half-width (degrees, ~55 m) of the box a MAILLAGE click asks about.
 *
 * The mesh tuple carries a position, an operator count and a band — it does
 * NOT carry the `SUP_ID`, because carrying it costs 392 KB → 611 KB gzipped
 * for a field the maillage never draws. So the id is fetched for the ONE dot
 * that was clicked. The pad is deliberately tiny: ANFR derives its coordinates
 * from integer arc-seconds, so masts sit on a ~31 m lattice and a wider box
 * would sweep in the neighbouring lattice cell.
 */
const MESH_LOOKUP_PAD_DEG = 0.0005;
/**
 * Hard cap on rendered supports, independent of what the proxy returns.
 *
 * 8 000, above the 6 462 of the fullest possible box, so it never bites in
 * production — it exists so a malformed payload cannot ask Cesium for a
 * million primitives.
 */
const MAX_RENDERED_SUPPORTS = 8_000;
const POINT_LIFT_M = 2.5;
const GROUND_WARM_LIMIT = 500;

// --- The shaft sub-regime ---------------------------------------------------
/**
 * View span (max of the two, degrees) under which the supports are drawn as
 * SHAFTS at their real height: a band from 0.09° (none) to 0.06° (all).
 *
 * 0.06° is about 6.7 km across the screen. On a 1 000-pixel-wide viewport that
 * puts the national median mast (30 m) at roughly 4.5 px of shaft, which is the
 * point where a height starts being comparable between two neighbours. At the
 * top of the exact regime (0.32°) the same mast is about one pixel: a shaft
 * there would be a rendering cost that changes nothing a reader can use.
 *
 * The pair used to be an enter / exit hysteresis, so a camera resting on the
 * boundary could not flicker the whole shaft field on and off. It is now the
 * band the shafts fade in across ({@link ANFR_SHAFT_BAND}), which settles the
 * same flicker by having nothing left to switch. The coarse end can sit at
 * the old exit rather than below the old entry because the shafts are not
 * fetched: they are drawn from the supports already on screen, and the cap
 * that bounds them was measured AT 0.09° — the fullest 0.09° box in France
 * holds 1 913 supports, under the 2 400-shaft ceiling.
 */
export const ANFR_MAST_ENTER_SPAN_DEG = 0.06;
export const ANFR_MAST_EXIT_SPAN_DEG = 0.09;
/**
 * The shafts' fade band, 0.09° → 0.06° of the larger span; coarse / fine = 1.5.
 *
 * A shaft is not a level that replaces another — it is the support's height
 * added under a dot that does not move — so it is honest to fade: the same
 * support, one channel more. It comes in with `reveal`'s finer weight, full
 * by 0.09 × (2/3)^0.3 = 0.080°, so every view that used to draw shafts still
 * draws them at full strength.
 */
export const ANFR_SHAFT_BAND = fadeBand(ANFR_MAST_ENTER_SPAN_DEG, ANFR_MAST_EXIT_SPAN_DEG);
/**
 * Hard cap on drawn shafts.
 *
 * 2 400, above the 1 913 of the fullest possible 0.09° box in France (measured
 * by sweeping every candidate box over the real 72 700 positions; the fullest
 * 0.06° box holds 1 063). It exists so a malformed payload cannot ask Cesium
 * for a million polylines, and anything it drops is counted and printed — A5.
 */
const MAX_RENDERED_MASTS = 2_400;
/**
 * Shaft width, in pixels, and it carries NOTHING.
 *
 * The quantity is the shaft's LENGTH, in metres of the world. The width is a
 * legibility constant: a world-space width would vanish at the far end of the
 * same view that the length is meant to be read across.
 */
const MAST_WIDTH_PX = 1.6;
const MAST_ALPHA = 0.7;
/** Dash length (pixels) of a shaft whose mast is authorised and not built. */
const MAST_DASH_LENGTH = 8;

// --- The azimuth rays of the selected support -------------------------------
/**
 * Ray length in metres — a DECLARED CONVENTION, never a range.
 *
 * Twice the national median mast height, so a ray reads against the shaft it
 * springs from at the scale the shafts are drawn at. ANFR publishes no
 * beamwidth and no coverage distance; the card says as much in French beside
 * the bearings, because a reader who takes 60 m for a cell radius has been
 * misled by the map and not by the register.
 */
export const ANFR_SECTOR_RAY_M = 60;
const SECTOR_WIDTH_PX = 2.2;
const SECTOR_ALPHA = 0.9;
/**
 * Cap on rays for one selected mast.
 *
 * 96, well above the busiest measured site (33 distinct bearing/height pairs on
 * support 449714, five operators). Overflow is counted and said, not silently
 * dropped.
 */
const MAX_RENDERED_SECTORS = 96;


// --- Presentation -----------------------------------------------------------
/**
 * The band ladder's fills — ONE saturated hue and one steel family.
 *
 * See the module header for why this is not a five-step ramp. Every hex here
 * is unused elsewhere in `src/data` (checked, not assumed), and the steel
 * family is deliberately low-chroma so it cannot be mistaken for a saturated
 * categorical swatch from `schools-fr`, `irve-fr` or `road-events-fr` when
 * those dots stack on these.
 */
export const ANFR_BAND_COLORS = Object.freeze({
  projet: '#c9d4e2',
  '2g': '#4c6076',
  '3g': '#6f8aa8',
  '4g': '#9fb4cc',
  // Amber since the mock of 2026-09-23 (it was a yellow, #ffcb2b): the
  // triangles glow, and a warm light over Dusk's dimmed ground reads as one.
  '5g': '#ffb238',
});

/**
 * The ring. It means "an approved project is on file here" and nothing else.
 *
 * Pale, so it reads against every fill in the ladder including its own.
 */
const PROJECT_RING_COLOR = '#c9d4e2';
const PROJECT_RING_ALPHA = 0.95;
const PROJECT_RING_WIDTH = 1.8;
/** Fill alpha for a support where NOTHING radiates — a hollow ring. */
const PROJECT_FILL_ALPHA = 0.12;
/** The ordinary outline: near-black, so a pale dot keeps an edge on bright terrain. */
const PLAIN_OUTLINE_COLOR = '#0d1420';
const PLAIN_OUTLINE_ALPHA = 0.6;
const PLAIN_OUTLINE_WIDTH = 1;

const SELECTED_COLOR = '#00ffff';
const POINT_MIN_PX = 4.5;
const POINT_MAX_PX = 11;
/**
 * Operator count at which a dot reaches full size.
 *
 * Five, which is the measured maximum and not a round number — exactly one
 * support in France carries five operators. Linear rather than square-rooted:
 * the channel has five integer values, not a continuous magnitude, and the
 * eye should read "one more operator" as one more step.
 */
const SIZE_CEILING_OPERATORS = 5;



/**
 * One mast's billboard: its triangle, sized by its operators (`anfrGlyphs.js`).
 *
 * A billboard and not a `PointPrimitive` since the mock of 2026-09-23: a
 * point can only be a disc. The id, the position and the depth rule are the
 * dot's, so the pick, the sprite order and the card anchor did not move.
 */
function mastBillboardOptions(id, position, style, extra = {}) {
  const glyph = anfrMastGlyph(style);
  return {
    id,
    position,
    ...(glyph ? { image: glyph.image, imageId: glyph.id } : {}),
    scale: anfrGlyphScale(style.sizePx),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    ...extra,
  };
}

/** Put a mast's own triangle back on its billboard. */
function dressMastSprite(billboard, style) {
  const glyph = anfrMastGlyph(style);
  if (glyph && typeof billboard.setImage === 'function') billboard.setImage(glyph.id, glyph.image);
  billboard.scale = anfrGlyphScale(style.sizePx);
}

/** Dress a mast's billboard as the selection: the amber diamond. */
function dressSelected(billboard) {
  const glyph = anfrSelectedGlyph();
  if (glyph && typeof billboard.setImage === 'function') billboard.setImage(glyph.id, glyph.image);
  billboard.scale = ANFR_SELECTED_SCALE;
}

// ── A REST KEEPS THE MARKS IT CAN, AND DRAWS ONLY THE NEW ONES ──────────────
//
// Every camera rest used to empty the collection (`removeAll()`) and add a
// billboard per mast in view, although a pan keeps most of them — the world
// pick is built so that it does (`anfrMesh.js`), and a supports box shares
// most of its masts with the box before it. Measured on the reference
// ThinkCentre at 4× CPU throttling, antennas alone (2026-09-23): over Paris at
// 5 km, 2 954 billboards destroyed and re-created per rest; over France, 631
// twice per rest.
//
// Now the marks are keyed by their record id, which is the mast's identity in
// both regimes (`anfrSupportId`, `anfrMeshRecordId`). A mast still in view
// keeps its record — and with it any lookup or card in flight — and its
// billboard, untouched unless its seat moved or its style changed. A mast that
// leaves has its billboard removed; a newcomer gets a new one. A rest on the
// same view touches nothing.
//
// ── WHY THE LEAVERS ARE REMOVED, NOT HIDDEN AND POOLED ──────────────────────
// Hiding a billboard and handing it to a newcomer looks cheaper than removing
// one and adding another, and on this collection it is not. A
// `BillboardCollection` re-derives its buffer usage from what was written
// since its last rebuild: a one-off write of `show` or `position` flips those
// attributes to STREAM_DRAW, which is a full vertex rebuild, and the next
// frame with no write flips them back to STATIC_DRAW, which is a second one.
// Measured with a pool, interleaved with the former code on the same machine
// (under a heavy concurrent load): two rebuilds per rest instead of one, 55 ms
// of them over Paris against 46.
// An `add` or `remove` instead marks the collection for ONE rebuild that zeroes
// the write counts, so the rest's writes all ride on it — and the newcomers,
// a few hundred at most on a pan, are cheap to build (≈ 7 µs each at 4×
// throttling, measured).
//
// The same flip is why a rest that only re-seats or re-dresses masts it kept —
// no newcomer, no leaver — asks for that single rebuild itself ({@link
// rebuildMarksOnce}).

/** The supports' fade with distance, one instance: the billboard copies it. */
const SUPPORT_FADE = new Cesium.NearFarScalar(500, 1.0, 400_000, 0.45);

/** Whether two styles draw the same billboard — the glyph and its scale. */
function sameMarkStyle(a, b) {
  return Boolean(a && b)
    && a.band === b.band
    && a.hollow === b.hollow
    && a.ringed === b.ringed
    && a.sizePx === b.sizePx;
}

/**
 * A billboard for a mast that was not drawn.
 * @param {?object} collection The class's collection (`markCollection`).
 * @param {string} id Record id, which is also the pick id.
 * @param {object} position Cartesian3.
 * @param {object} style `anfrSupportStyle` / `anfrMeshStyle`.
 * @param {?object} fade `SUPPORT_FADE` for a support, undefined for a maillage dot.
 * @returns {?object} The billboard, or null with no collection.
 */
function takeMark(collection, id, position, style, fade) {
  if (!collection) return null;
  return collection.add(mastBillboardOptions(id, position, style, fade ? { translucencyByDistance: fade } : {}));
}

/** Remove the billboard of a mast that left the view, or left its class. */
function releaseMark(collection, billboard) {
  if (billboard && collection && !collection.isDestroyed?.()) collection.remove(billboard);
}

/**
 * One vertex rebuild for writes to billboards the rest kept, instead of the
 * two the buffer-usage flip would cost. Through the public API: an `add` and a
 * `remove` are documented to rewrite the vertex buffer, and that rewrite is
 * what zeroes the write counts the flip reads.
 */
function rebuildMarksOnce(collection) {
  if (!collection || collection.isDestroyed?.()) return;
  collection.remove(collection.add({ show: false, position: Cesium.Cartesian3.ZERO }));
}

/**
 * What one rest did to each collection, so the single rebuild above is asked
 * for exactly where marks were rewritten and none came or went.
 */
function markLedger() {
  const touched = new Map();
  const entry = (collection) => {
    let row = touched.get(collection);
    if (!row) {
      row = { written: 0, added: 0, removed: 0 };
      touched.set(collection, row);
    }
    return row;
  };
  return {
    written(collection) { entry(collection).written += 1; },
    added(collection) { entry(collection).added += 1; },
    removed(collection) { entry(collection).removed += 1; },
    settle() {
      for (const [collection, row] of touched) {
        if (collection && row.written && !row.added && !row.removed) rebuildMarksOnce(collection);
      }
    },
  };
}

/**
 * Carry a mast that stays in view over to the new rest: a new seat and a new
 * style are written to its billboard only when they differ. The selected
 * mast's billboard is left as the diamond; `restoreSelectionAfterRebuild`
 * owns it.
 * @returns {boolean} Whether the billboard was written.
 */
function keepMark(collection, record, position, style, fade) {
  const restyled = !sameMarkStyle(record.style, style);
  record.position = position;
  record.style = style;
  if (!record.point) {
    record.point = takeMark(collection, record.id, position, style, fade);
    return false;
  }
  let written = false;
  if (!Cesium.Cartesian3.equals(record.point.position, position)) {
    record.point.position = position;
    written = true;
  }
  if (restyled && record.id !== _selectedId) {
    dressMastSprite(record.point, style);
    written = true;
  }
  return written;
}

const DEFAULT_OVERLAY_HOST = Object.freeze({
  setEntries: setOverlayEntries,
  setVisible: setOverlaySourceVisible,
  clearSource: clearOverlaySource,
});
let _overlayHost = DEFAULT_OVERLAY_HOST;

/**
 * The HTTP seam.
 *
 * One function, so a test can drive every production path — the maillage, the
 * viewport, the mesh-dot lookup and the Cartoradio card — with no network and
 * no WebGL, and so a failure injected here exercises the same degradation the
 * real one would.
 */
const DEFAULT_HTTP = (url, options) => fetch(url, options);
let _http = DEFAULT_HTTP;

// --- Runtime state ----------------------------------------------------------
let _viewer = null;
/**
 * The marks, in three collections by what the band does to them — see
 * `amenitiesMedecinsAnfrFade.js` and {@link ANFR_SUPPORTS_BAND}. `_points`
 * holds the supports the maillage does not draw (they come in), `_sharedPoints`
 * the supports whose coordinate the maillage draws (full strength from the
 * moment they land), `_meshPoints` every maillage dot (they go out). Outside
 * the band only `_points` or `_meshPoints` is in use, and a rest keeps the
 * marks it can within each collection, as it always did.
 */
let _points = null;
let _meshPoints = null;
let _sharedPoints = null;
/** Shafts. Depth-tested world geometry, deliberately NOT a sprite collection. */
let _masts = null;
/** Azimuth rays of the selected support only. */
let _sectors = null;
/** Every drawn mark, by id, whichever level drew it: the pick and selection map. */
let _records = new Map();
/** The maillage's own records, by id. */
let _meshRecords = new Map();
/** The supports' own records, by id. */
let _supportRecords = new Map();
/** The maillage, the supports, the shaft field are on screen (possibly as nothing). */
let _meshDrawn = false;
let _supportsDrawn = false;
/** What the last settle asked for — see {@link planAnfrLevels}. */
let _plan = null;
/** `watchZoomFade` handle while the layer is enabled. */
let _fade = null;
/** Rewrite every mark's alpha on the next frame: a class was rebuilt. */
let _fadeForce = false;
/** The shaft alpha last written onto every shaft's material, or null to force. */
let _shaftAlphaWritten = null;
let _enabled = false;
let _clickHandler = null;
let _cameraChangedAttached = false;
let _cameraDebounceTimer = null;
let _selectedId = null;
let _count = 0;
let _inView = 0;
let _lastUpdate = null;
let _loading = false;
let _error = null;
let _status = 'idle';
let _regime = 'maillage';
/** Whether the camera is close enough for the shafts to say anything. */
let _mastRegime = false;
let _mastsDrawn = 0;
let _mastsUnpublished = 0;
let _mastsClipped = 0;
let _sectorsDrawn = 0;
let _requestGeneration = 0;
/**
 * Whether the masts are drawn at all — the « Antennes » tile of the key, the
 * coverage being the « Couverture 4G » one (`part` in layerFusions.js).
 * Share-linked as `m`. With the masts out and the coverage on, the layer asks
 * the register nothing: no maillage, no supports, no dot over the dead zones.
 */
let _mastsShown = true;

let _mesh = null;
let _meshPromise = null;
let _meshPick = null;
/** The box the maillage dots were last picked for; a settle on the same box redraws nothing. */
let _meshBoxKey = null;

let _pack = null;
let _packBoxKey = null;

/** Coordinate id → the supports the register places there, or null. */
const _meshLookups = new Map();

// --- The ARCEP coverage under the masts -------------------------------------
/** `off`, `gaps` or an operator id — see `mobileCoverage.js`. Share-linked. */
let _coverageMode = 'off';
/**
 * The operator « Par opérateur » opens on: the last one shown this session,
 * Orange before any. Not share-linked — the mode is, and it names the operator.
 */
let _coverageLastOperator = 'orange';
/** idle → loading → ready | missing | failed. `missing`: no pyramid on this server. */
let _coverageStatus = 'idle';
let _coverageError = null;
let _coverageMeta = null;
let _coverageMetaPromise = null;
/** The Cesium ImageryLayer on `viewer.imageryLayers`, and the mode it paints. */
let _coverageImagery = null;
let _coverageImageryMode = null;
/**
 * The same mode draped on Google's mesh: `{ tileset, layer }`, or null while
 * this session has no mesh. Kept apart from `_coverageImagery` because the mesh
 * is bought late — often after the coverage was switched on.
 */
let _coverageDrape = null;
/** `gev:map-stack-changed` listener, attached while the row is on. */
let _mapStackListener = null;
let _coverageRead = null;
/** The ground card: `{ position, text }`, or null. One card at a time with the support's. */
let _coverageCard = null;
/**
 * The ground card the globe and the key are SHOWING. It is `_coverageCard`
 * except between a second click and its answer, when the first card stays on
 * screen (see `openCoverageCard`).
 */
let _coverageCardShown = null;
let _coverageCardGeneration = 0;

// --- The selected mast's line of sight ---------------------------------------
/**
 * `{ recordId, status, radiusM?, horizonM?, capped?, share?, error?, layer? }`
 * for the selected support, or null. `status`: loading | ready | failed |
 * photoreal. The heavy grids are dropped once painted; the layer is the only
 * thing kept.
 */
let _viewshed = null;
let _viewshedGeneration = 0;
/** Seams: the network-and-canvas half, swapped in tests. */
let _viewshedCompute = computeMastViewshed;
let _viewshedLayerFactory = createViewshedImageryLayer;
/** SUP_ID → the Cartoradio card, or null when Cartoradio refused. */
const _details = new Map();

// --- Colour, size and style -------------------------------------------------

/** Hex fill for one band. Anything unrecognised is drawn as the project ring. */
export function anfrBandColor(band) {
  return ANFR_BAND_COLORS[band] || ANFR_BAND_COLORS.projet;
}

/** The band's name, in the page's language. */
export function anfrBandLabelFor(band) {
  const labels = messages().legend.bands;
  return labels[band] || labels.projet;
}

/**
 * Dot size for one support, by how many operators are on it.
 *
 * Clamped at both ends: a support the register somehow places with no operator
 * still gets the base size rather than a zero-pixel dot, because it is a
 * position the register published and a dot the reader can click.
 */
export function anfrPointSize(operators) {
  const count = Number(operators);
  if (!Number.isFinite(count) || count <= 1) return POINT_MIN_PX;
  const span = POINT_MAX_PX - POINT_MIN_PX;
  const scale = Math.min(count, SIZE_CEILING_OPERATORS) - 1;
  return POINT_MIN_PX + (span * scale) / (SIZE_CEILING_OPERATORS - 1);
}

/**
 * Whether an approved project at this support would ADD a generation it does
 * not already radiate.
 *
 * The feed's rule, applied at draw time to one support: an operator re-filing
 * for a band that is already on the air is paperwork, and 11 830 of the 15 606
 * live supports carrying a project are exactly that. Ringing all 15 606 would
 * make the ring mean "somebody filed something", which is not worth a channel.
 */
export function anfrHasPlannedUpgrade(support) {
  const live = Number(support?.live) || 0;
  const plan = Number(support?.plan) || 0;
  return Boolean(plan & ~live);
}

/**
 * Fill, outline and size for one support — the whole visual grammar in one
 * pure function, so the legend, the tests and the primitives cannot drift.
 *
 * @param {object} support Pack row (`live`, `plan`, `operators`).
 * @returns {{band:string, color:string, alpha:number, outlineColor:string,
 *   outlineAlpha:number, outlineWidth:number, sizePx:number, ringed:boolean,
 *   hollow:boolean, operators:number}}
 */
export function anfrSupportStyle(support) {
  const live = Number(support?.live) || 0;
  const band = anfrBand(live);
  const operators = Array.isArray(support?.operators)
    ? support.operators.length
    : Number(support?.operators) || 0;
  const hollow = live === 0;
  const ringed = hollow || anfrHasPlannedUpgrade(support);
  return {
    band,
    color: anfrBandColor(band),
    alpha: hollow ? PROJECT_FILL_ALPHA : 1,
    outlineColor: ringed ? PROJECT_RING_COLOR : PLAIN_OUTLINE_COLOR,
    outlineAlpha: ringed ? PROJECT_RING_ALPHA : PLAIN_OUTLINE_ALPHA,
    outlineWidth: ringed ? PROJECT_RING_WIDTH : PLAIN_OUTLINE_WIDTH,
    sizePx: anfrPointSize(operators),
    ringed,
    hollow,
    operators,
  };
}

/**
 * Style for a MAILLAGE tuple.
 *
 * The tuple carries `[lat, lon, operators, band]` and no plan mask, so the
 * only ring the maillage can draw honestly is the hollow one — a cell whose
 * modal band is `projet`. A dot that radiates AND has an upgrade pending is
 * indistinguishable from one that does not at this zoom, and the row label
 * says so rather than the map implying the ring is exhaustive.
 */
export function anfrMeshStyle(tuple) {
  const band = meshSupportBand(tuple);
  const hollow = band === 'projet';
  return {
    band,
    color: anfrBandColor(band),
    alpha: hollow ? PROJECT_FILL_ALPHA : 1,
    outlineColor: hollow ? PROJECT_RING_COLOR : PLAIN_OUTLINE_COLOR,
    outlineAlpha: hollow ? PROJECT_RING_ALPHA : PLAIN_OUTLINE_ALPHA,
    outlineWidth: hollow ? PROJECT_RING_WIDTH : PLAIN_OUTLINE_WIDTH,
    sizePx: anfrPointSize(Number(tuple?.[MESH_OPERATORS]) || 0),
    ringed: hollow,
    hollow,
    operators: Number(tuple?.[MESH_OPERATORS]) || 0,
  };
}

// --- The shaft and the rays -------------------------------------------------

/**
 * The height a support's shaft is drawn at, in metres, or null for no shaft.
 *
 * Null is the answer for the 551 supports the register leaves blank, and it is
 * the whole A1 content of this layer's new channel: the fallback is the
 * absence of the mark, never a default length of it. Zero and negatives are
 * refused for the same reason the feed refuses them — the register writes `0`
 * where nobody filled the field in, and a 0 m mast is not a fact.
 *
 * @param {object} support Pack row from the `/supports` route.
 * @returns {?number}
 */
export function anfrMastHeightM(support) {
  const metres = Number(support?.heightM);
  if (!Number.isFinite(metres) || metres <= 0) return null;
  return metres;
}

/**
 * Which levels a settled view loads, and which owns the key, the count and
 * the status line (`dominant`, the layer's regime).
 *
 * Every level whose weight is above zero is loaded — the maillage and the
 * supports both inside {@link ANFR_SUPPORTS_BAND}, the shaft field anywhere
 * its own band gives it weight and the supports are loaded. A level at zero
 * is not. Pure, so the bands can be tested without a viewer.
 *
 * @param {number} spanDeg The view's larger span, in degrees.
 * @param {{supportsBox?: boolean}} [context] Whether `cameraAnfrBox` gave a
 *   box: a view crossing the dateline has none, and the maillage is then the
 *   honest fallback, not an empty map.
 * @returns {{mesh: boolean, supports: boolean, shafts: boolean, dominant: string,
 *   position: number, weights: {mesh: number, supports: number, shafts: number}}}
 */
export function planAnfrLevels(spanDeg, { supportsBox = true } = {}) {
  const span = Number(spanDeg);
  const position = bandPosition(span, ANFR_SUPPORTS_BAND);
  const target = reveal(position);
  const supports = Boolean(supportsBox) && levelVisible(true, target.fine);
  const mesh = !supports || levelVisible(true, target.coarse);
  const shaftWeight = reveal(bandPosition(span, ANFR_SHAFT_BAND)).fine;
  return {
    mesh,
    supports,
    shafts: supports && levelVisible(true, shaftWeight),
    dominant: supports && target.fine > target.coarse ? 'supports' : 'maillage',
    position,
    weights: { mesh: target.coarse, supports: target.fine, shafts: shaftWeight },
  };
}

/**
 * The alpha every class is drawn at, for one frame: the maillage → supports
 * fade on this frame's span, and the shafts' own fade under it.
 *
 * @param {number} span The view's larger span this frame, degrees.
 * @param {object} state
 * @returns {{mesh: number, supports: number, shared: number, shafts: number, position: number}}
 */
export function anfrLevelAlphas(span, {
  meshReady = false, supportsReady = false, shaftsReady = false,
  meshArrival = 1, supportsArrival = 1, shaftsArrival = 1,
} = {}) {
  const position = bandPosition(span, ANFR_SUPPORTS_BAND);
  const band = meshSitesAlphas(position, {
    meshReady, sitesReady: supportsReady, meshArrival, sitesArrival: supportsArrival,
  });
  // A shaft stands on a support: nothing to cover, so it is its band's weight,
  // ramped in when the field is first built, under the supports' own strength.
  const shafts = shaftsReady && supportsReady
    ? reveal(bandPosition(span, ANFR_SHAFT_BAND)).fine * Math.max(0, Math.min(1, shaftsArrival)) * band.shared
    : 0;
  return { mesh: band.mesh, supports: band.sites, shared: band.shared, shafts, position };
}

/**
 * The rays drawable for one Cartoradio card, and what had to be refused.
 *
 * A pair with no mounting height is NOT seated on the support's own height:
 * the mast height and the antenna height are two different published numbers
 * and substituting one for the other would be a measured-looking invention.
 * It is refused and counted instead — `unplaced` — exactly as an antenna with
 * no bearing is refused and counted as `unaimed`.
 *
 * @param {?object} detail The Cartoradio payload held on the record.
 * @returns {{rays:Array<{deg:number, heightM:number, antennas:number}>,
 *   unplaced:number, unaimed:number, bearings:Array<number>, clipped:number}}
 */
export function anfrSectorRays(detail) {
  const pairs = Array.isArray(detail?.antennas?.azimuths) ? detail.antennas.azimuths : [];
  const rays = [];
  let unplaced = 0;
  let clipped = 0;
  for (const pair of pairs) {
    const deg = Number(pair?.deg);
    const heightM = Number(pair?.heightM);
    if (!Number.isFinite(deg)) continue;
    if (!Number.isFinite(heightM) || heightM <= 0) {
      unplaced += 1;
      continue;
    }
    if (rays.length >= MAX_RENDERED_SECTORS) {
      clipped += 1;
      continue;
    }
    rays.push({ deg, heightM, antennas: Number(pair?.antennas) || 1 });
  }
  // The card lists BEARINGS, not pairs: a five-operator mast files the same
  // three sectors a dozen times at a dozen mounting heights, and a card that
  // printed all of them would read as thirty-three directions.
  const bearings = [...new Set(pairs
    .map((pair) => Number(pair?.deg))
    .filter(Number.isFinite))].sort((a, b) => a - b);
  return {
    rays,
    unplaced,
    unaimed: Number(detail?.antennas?.withoutAzimuth) || 0,
    bearings,
    clipped,
  };
}

// --- Identity ---------------------------------------------------------------

/**
 * Render id for one support, from its ANFR `SUP_ID`.
 *
 * The id is the SUP_ID and NOT the coordinate, and that is load-bearing:
 * measured over the real 72 700 supports, **952 of them share a five-decimal
 * coordinate with at least one other** (71 748 distinct positions, 895 of them
 * occupied twice or more, the worst by six masts). ANFR derives positions from
 * integer arc-seconds, so co-sited masts land on exactly the same lattice
 * point. A coordinate-keyed record map would silently drop those 952.
 */
export function anfrSupportId(supId) {
  return `${ANFR_FR_LAYER_ID}:${supId}`;
}

/**
 * Render id for one maillage dot.
 *
 * Coordinate-based, because the tuple carries nothing else — and namespaced
 * apart from the exact ids precisely BECAUSE the two cannot be equated: the
 * same position can hold several supports. A maillage selection is therefore
 * not carried across the handover into the exact regime; the layer clears it
 * rather than guessing which of six co-sited masts the reader meant.
 */
export function anfrMeshRecordId(tuple) {
  return `${ANFR_FR_LAYER_ID}:mesh:${meshSupportId(tuple)}`;
}

/**
 * The supports the register places at one maillage dot's position.
 *
 * Returns every one of them, not the "best" one: co-siting is a fact about the
 * mast and the card names it. Ordered by operator count then by SUP_ID, so the
 * card is stable between two clicks on the same dot.
 *
 * @param {Array<object>} supports Rows from the supports route.
 * @param {number} lat
 * @param {number} lon
 * @returns {Array<object>}
 */
export function pickAnfrSupportsAt(supports, lat, lon) {
  const key = `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
  return (Array.isArray(supports) ? supports : [])
    .filter((row) => Number.isFinite(row?.lat) && Number.isFinite(row?.lon)
      && `${row.lat.toFixed(5)},${row.lon.toFixed(5)}` === key)
    .sort((a, b) => (b.operators?.length || 0) - (a.operators?.length || 0)
      || Number(a.id) - Number(b.id));
}

// --- Camera -----------------------------------------------------------------

/**
 * Camera view box, clamped to the proxy's ceiling. A wider view returns null
 * and the layer falls back to the maillage rather than asking for a box the
 * proxy would refuse.
 */
export function cameraAnfrBox(viewer) {
  const rectangle = viewer?.camera?.computeViewRectangle?.();
  if (!rectangle) return null;
  const south = Cesium.Math.toDegrees(rectangle.south);
  const north = Cesium.Math.toDegrees(rectangle.north);
  const west = Cesium.Math.toDegrees(rectangle.west);
  const east = Cesium.Math.toDegrees(rectangle.east);
  if (![south, west, north, east].every(Number.isFinite)) return null;
  if (west >= east || south >= north) return null;
  if (north - south > ANFR_MAX_BOX_DEG || east - west > ANFR_MAX_BOX_DEG) return null;
  return { south, west, north, east };
}

/**
 * View box for the maillage — the camera rectangle, padded.
 *
 * No ceiling: the pick runs over tuples the client already holds, so a wide
 * view costs nothing upstream. The padding means a dot does not pop into
 * existence exactly at the screen edge as the camera pans.
 */
export function cameraAnfrMeshBox(viewer, padFraction = 0.12) {
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
 * A view rectangle's two spans, in degrees. Infinite when the camera is past
 * the limb and Cesium can give no rectangle at all.
 */
export function anfrViewSpanDeg(viewer) {
  const rectangle = viewer?.camera?.computeViewRectangle?.();
  if (!rectangle) return { lat: Infinity, max: Infinity };
  const lat = Cesium.Math.toDegrees(rectangle.north - rectangle.south);
  const lon = Cesium.Math.toDegrees(rectangle.east - rectangle.west);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { lat: Infinity, max: Infinity };
  return { lat, max: Math.max(lat, lon) };
}

/**
 * Plan the settled view: the levels it loads, and the dominant one as the
 * regime. The shaft field is nested inside the supports: the maillage has no
 * support heights in its tuple and could only guess at them.
 * @returns {object} The plan.
 */
function updateRegime(viewer) {
  const span = anfrViewSpanDeg(viewer);
  _plan = planAnfrLevels(span.max, { supportsBox: Boolean(cameraAnfrBox(viewer)) });
  _regime = _plan.dominant;
  _mastRegime = _plan.shafts;
  return _plan;
}

/**
 * A support's two anchors, seated on the shared coarse ground floor: the foot
 * of the shaft and the top of it.
 *
 * Only the exact regime uses them. The maillage lifts its dots by
 * `POINT_LIFT_M` off the ellipsoid instead: at those altitudes a metre of
 * vertical error is invisible and 2 200 terrain lookups per pan would not be.
 *
 * The dot goes on TOP — at the published support height — at every span of the
 * exact regime and not only where the shaft is drawn, so crossing the shaft
 * threshold never moves a dot. Where no height is published the top IS the
 * foot, which is the same statement the missing shaft makes.
 */
function supportAnchors(lat, lon, heightM) {
  const floor = cachedGroundFloor(lat, lon);
  const base = (Number.isFinite(floor) ? floor : 0) + POINT_LIFT_M;
  const lift = Number.isFinite(heightM) && heightM > 0 ? heightM : 0;
  return {
    ground: Cesium.Cartesian3.fromDegrees(lon, lat, base),
    top: Cesium.Cartesian3.fromDegrees(lon, lat, base + lift),
  };
}

/** Thousands grouped the page's way, matching the rest of the packs. */
function fr(value) {
  return formatNumber(value);
}

/** `2026-08-27` → `27 août 2026` / `August 27, 2026`. */
export function anfrEditionLabel(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  return formatDate(new Date(`${iso}T12:00:00Z`), {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// --- Shaft and ray primitives ------------------------------------------------

// ── ONE `Material` PER POLYLINE, AND NEVER A SHARED ONE ──────────────────────
//
// This file used to memoize five materials and hand the same instance to every
// shaft that wanted that appearance, on the stated ground that a
// `PolylineCollection` buckets by material INSTANCE. Both halves of that were
// wrong, and the first half was a latent crash.
//
// `Polyline._destroy()` calls `this._material.destroy()` unconditionally, and
// Cesium's `destroyObject` replaces every method with a thrower rather than
// making the object inert. So the FIRST shaft destroys the shared material and
// the SECOND throws `DeveloperError: This object was destroyed`. Reproduced on
// this Cesium build for `destroy()` and for `removeAll()`, solid and dashed
// alike: two polylines, one material, one throw. Both are live paths here —
// `disable()` calls `removeAll()`, `destroy()` calls `primitives.remove()`,
// which destroys — so the layer threw on teardown with two shafts up.
//
// And the bucketing claim is false. `sortPolylinesIntoBuckets` keys on
// `material.type` (`polylineBuckets[material.type]`), and the draw pass then
// splits commands on `createMaterialId(polyline._material)`, which is
// `type + JSON(uniform values)`. Both are VALUE keys: two `Color` materials
// carrying the same colour batch into ONE command however many instances they
// are. What costs a draw call is a change of appearance between two
// CONSECUTIVE polylines — a question of ORDER, which `reconcileMasts` answers
// with one collection per appearance, not of allocation.
//
// Measured price of the fix: 3.5 KiB per material, so 8.2 MiB at the 2 400
// shaft cap — against a throw on every teardown.
//
// A shaft keeps ONE material for life: it lives in the collection of its
// appearance (see `reconcileMasts`), so it is never restyled and never swaps
// instances — an orphaned instance is one Cesium will never destroy, and a
// re-shared one is the bug above coming back. The slot below only names the
// instance a ray owns.
const MAST_SOLID_SLOT = '__gevSolidMaterial';

/**
 * Build the material ONE shaft wears. The shaft owns it from then on.
 *
 * A support that radiates nothing is an authorised file, not a built mast: its
 * height is declared and not observed, and the dash says so with the same
 * motif the hollow ring already uses on the dot. D3 — a pattern survives the
 * sensor passes that flatten a tint.
 * @param {object} style Band style of the support this shaft carries.
 * @returns {object} A fresh `Cesium.Material`, owned by one polyline.
 */
function createMastMaterial(style) {
  const color = Cesium.Color.fromCssColorString(style.color).withAlpha(MAST_ALPHA);
  return style.hollow
    ? Cesium.Material.fromType('PolylineDash', { color, dashLength: MAST_DASH_LENGTH })
    : Cesium.Material.fromType('Color', { color });
}

/**
 * The appearance a shaft is drawn in: `createMaterialId`'s key in this file's
 * vocabulary, the material type plus the colour. Five of them at most.
 * @param {object} style Band style of a support.
 * @returns {string}
 */
function mastAppearanceKey(style) {
  return `${style?.hollow ? 'dash' : 'solid'}|${style?.color || ''}`;
}

/**
 * Appearance → `{ collection, spare }`: one `PolylineCollection` per look,
 * inside `_masts`, and its hidden shafts waiting for a newcomer of that look.
 */
let _mastBands = new Map();
/** Record id → `{ line, key }`: the shaft each drawn support stands on. */
let _mastLines = new Map();
/** Fewest spare shafts a band keeps after a rest; a quarter of its drawn ones when that is more. */
const SPARE_MASTS_FLOOR = 64;

function mastBand(key) {
  let band = _mastBands.get(key);
  if (!band) {
    band = { collection: new Cesium.PolylineCollection(), spare: [], drawn: 0 };
    _masts.add(band.collection);
    _mastBands.set(key, band);
  }
  return band;
}

/** Empty the shaft field and forget which shaft was whose. */
function clearMastField() {
  _masts?.removeAll();
  _mastBands = new Map();
  _mastLines = new Map();
}

/**
 * Draw the shaft field for the records already drawn.
 *
 * Everything it refuses is counted: `_mastsUnpublished` are the supports the
 * register gives no height for, `_mastsClipped` is the cap biting. Both reach
 * the row label and the legend (A1, A5). WHICH shafts are drawn is decided in
 * record order and the cap bites there, so a redraw never swaps one support
 * for another.
 *
 * A SHAFT IS KEYED BY ITS SUPPORT, like the dot on top of it (see "A rest
 * keeps the marks it can" above). A support still drawn keeps its shaft,
 * rewritten only if its seat moved. Unlike the dots, a shaft that leaves is
 * hidden and kept, and a newcomer takes a hidden shaft of its own look before
 * a new one is added: a `PolylineCollection` writes `show` through its batch
 * table without a rebuild, and keeps a position buffer it has streamed for 100
 * quiet frames before turning it static again, so the pool costs it none of
 * the double rebuild it costs a `BillboardCollection`. Measured before this:
 * over Paris at 2.5 km (≈ 345 shafts), 20 ms of main thread per rest at 4× CPU
 * throttling, every shaft's positions and colour rewritten, twice; with it,
 * 5 ms, interleaved on the same machine.
 *
 * ONE COLLECTION PER APPEARANCE is what lets a slot be reused by identity
 * without losing the batching. Cesium breaks a draw command whenever two
 * neighbouring polylines of a bucket disagree on appearance, so one shared
 * collection had to be written in band order on every rest — in register order
 * the five appearances interleave and the fullest box costs up to 1 913
 * commands. A collection holds one look, so it is one command whatever order
 * its shafts come and go in, and the field is at most five.
 */
function reconcileMasts() {
  _mastsDrawn = 0;
  _mastsUnpublished = 0;
  _mastsClipped = 0;
  // The shafts stand on the supports, whichever level owns the key: inside
  // the band the supports may be drawn under a maillage that still leads.
  const draw = _enabled && _supportsDrawn && _mastRegime;
  const drawn = [];
  if (draw) {
    for (const record of _supportRecords.values()) {
      const heightM = anfrMastHeightM(record.support);
      if (heightM === null) {
        _mastsUnpublished += 1;
        continue;
      }
      if (drawn.length >= MAX_RENDERED_MASTS) {
        _mastsClipped += 1;
        continue;
      }
      // The tally is kept whether or not there is a collection to draw into,
      // so the row label and the legend say the same thing in a headless test
      // as they do on screen.
      drawn.push(record);
    }
  }
  _mastsDrawn = drawn.length;
  if (!_masts) return;
  const next = new Map();
  const newcomers = [];
  // 1. The supports still drawn keep their shaft, in the same look.
  for (const record of drawn) {
    const key = mastAppearanceKey(record.style);
    const held = _mastLines.get(record.id);
    if (!held || held.key !== key) {
      newcomers.push(record);
      continue;
    }
    _mastLines.delete(record.id);
    const foot = record.groundPosition || record.position;
    const [heldFoot, heldTop] = held.line.positions;
    if (!Cesium.Cartesian3.equals(heldFoot, foot) || !Cesium.Cartesian3.equals(heldTop, record.position)) {
      held.line.positions = [foot, record.position];
    }
    next.set(record.id, held);
  }
  // 2. The rest are put away, hidden, in their own band.
  for (const held of _mastLines.values()) {
    held.line.show = false;
    mastBand(held.key).spare.push(held.line);
  }
  // 3. The newcomers take a spare of their look, or a new shaft.
  for (const record of newcomers) {
    const key = mastAppearanceKey(record.style);
    const band = mastBand(key);
    const positions = [record.groundPosition || record.position, record.position];
    let line = band.spare.pop();
    if (line) {
      line.positions = positions;
      line.show = true;
    } else {
      // Handed in at the add rather than assigned after it: `add()` without a
      // `material` builds a default white one that the next line would orphan,
      // and an orphan is an instance Cesium will never destroy.
      line = band.collection.add({
        positions, width: MAST_WIDTH_PX, material: createMastMaterial(record.style), show: true,
      });
    }
    next.set(record.id, { line, key });
  }
  _mastLines = next;
  // 4. Each band keeps what a pan's churn needs and gives the rest back.
  for (const band of _mastBands.values()) band.drawn = 0;
  for (const held of next.values()) _mastBands.get(held.key).drawn += 1;
  for (const band of _mastBands.values()) {
    const keep = Math.max(SPARE_MASTS_FLOOR, Math.ceil(band.drawn / 4));
    while (band.spare.length > keep) band.collection.remove(band.spare.pop());
  }
  _masts.show = draw && drawn.length > 0;
  // New and recycled shafts carry whatever alpha they were built or left at:
  // the next frame writes the field's weight onto every one of them.
  _shaftAlphaWritten = null;
}

/**
 * Fade the whole shaft field by one weight.
 *
 * Every shaft owns its material (see the note above `MAST_SOLID_SLOT`), so the
 * weight is written into each one's colour uniform: one number per shaft, read
 * at draw time, and no vertex buffer touched — a `PolylineCollection` keeps a
 * material's uniforms out of its buffers. The field's five looks stay five
 * draw commands, since every shaft of a look carries the same alpha at any
 * moment. At zero the field is hidden as a collection.
 */
function fadeShafts(weight, force = false) {
  if (!_masts) return;
  const w = quantizeFade(weight);
  const visible = levelVisible(_enabled, w) && _mastsDrawn > 0;
  if (_masts.show !== visible) _masts.show = visible;
  if (!visible) return;
  const alpha = MAST_ALPHA * w;
  if (!force && alpha === _shaftAlphaWritten) return;
  _shaftAlphaWritten = alpha;
  for (const band of _mastBands.values()) {
    const lines = band.collection;
    for (let i = 0; i < lines.length; i += 1) {
      const color = lines.get(i)?.material?.uniforms?.color;
      if (color && color.alpha !== alpha) color.alpha = alpha;
    }
  }
}

/** Hide every ray and forget what they said. */
function clearSectors() {
  _sectorsDrawn = 0;
  if (!_sectors) return;
  for (let i = 0; i < _sectors.length; i += 1) _sectors.get(i).show = false;
  _sectors.show = false;
}

/**
 * Draw the published bearings of ONE support, at the mounting heights
 * Cartoradio publishes for them.
 *
 * Cyan, the selection colour, because that is what these rays are: a detail of
 * the object the reader clicked, not a channel of the layer. Nothing else on
 * this map is cyan while a selection is live, so there is no reading in which
 * a ray belongs to a mast other than the selected one.
 */
function drawSectors(record) {
  clearSectors();
  if (!_sectors || !_mastRegime || _regime !== 'supports') return;
  const support = record?.support;
  if (!Number.isFinite(support?.lat) || !Number.isFinite(support?.lon)) return;
  const { rays } = anfrSectorRays(record.detail);
  if (!rays.length) return;

  const floor = cachedGroundFloor(support.lat, support.lon);
  const base = (Number.isFinite(floor) ? floor : 0) + POINT_LIFT_M;
  let index = 0;
  for (const ray of rays) {
    const far = anfrProjectPoint(support.lat, support.lon, ray.deg, ANFR_SECTOR_RAY_M);
    if (!far) continue;
    const altitude = base + ray.heightM;
    const positions = [
      Cesium.Cartesian3.fromDegrees(support.lon, support.lat, altitude),
      Cesium.Cartesian3.fromDegrees(far.lon, far.lat, altitude),
    ];
    let line = _sectors.get(index);
    if (!line) {
      // Its own instance, handed in at the add — see the note above the
      // material helpers: one cyan shared by 33 rays is 32 throws at teardown,
      // and 33 instances of the same cyan are still one draw command.
      const material = Cesium.Material.fromType('Color', {
        color: Cesium.Color.fromCssColorString(SELECTED_COLOR).withAlpha(SECTOR_ALPHA),
      });
      line = _sectors.add({
        positions, width: SECTOR_WIDTH_PX, material, show: true,
      });
      line[MAST_SOLID_SLOT] = material;
    } else {
      line.positions = positions;
      line.width = SECTOR_WIDTH_PX;
      line.show = true;
    }
    index += 1;
  }
  for (let i = index; i < _sectors.length; i += 1) _sectors.get(i).show = false;
  _sectors.show = index > 0;
  _sectorsDrawn = index;
}

// --- Card copy --------------------------------------------------------------

// ── WRITTEN FOR SOMEONE WHO HAS NEVER HEARD OF THE ANFR ─────────────────────
//
// The card answers five questions, one short line each, in the order people
// ask them: what is it and whose, what does it carry, where is it, and what
// are the waves like around it. Everything else the two registers publish —
// the frequencies, the antenna count and heights, the owner, the register
// number — stays in the data and off the card; the bearings are still drawn
// as rays, and Cartoradio is one search away for anyone who needs 3,5 GHz or
// a SUP_ID.
//
// Three refusals survive the simplification, because they are the difference
// between plain and wrong: the card never says a level is safe (a multiple of
// the legal limit is a measurement, "safe" would be a verdict), never says an
// antenna covers an address (that is the ARCEP map's job), and never lets a
// measurement taken before the current equipment pass for one of it.

/** `FREE MOBILE` → `Free Mobile`, and `SFR` stays `SFR`. */
export function anfrOperatorName(name) {
  const text = String(name || '').trim();
  if (!text) return '';
  return text
    .split(/\s+/)
    .map((word) => (word.length <= 3
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLocaleLowerCase('fr-FR')))
    .join(' ');
}

/**
 * The brand, not the corporate name — `Free`, not `FREE MOBILE`.
 *
 * Only on the grouped line, where four names have to share one line's width
 * with four rungs. The trailing word is dropped only when something is left
 * standing, so an operator actually called `Telco OI` keeps both halves.
 */
export function anfrOperatorShort(name) {
  const full = anfrOperatorName(name);
  const short = full.replace(/\s+(Mobile|Telecom|Télécom|France)$/i, '');
  return short || full;
}

/**
 * The register's shouted abbreviations, spelled out.
 *
 * ANFR files addresses and owners in the capitals and truncations of a
 * paper form — `30 R PETRICOT RES HORIZON`, `Ets public , Minist, Synd mixt` —
 * and a card that reproduces them is shouting a code at the reader. Only exact
 * whole-token matches are expanded, so a street genuinely called `Res` is
 * untouched and an abbreviation this table has never seen degrades to itself
 * rather than to a guess.
 */
// i18n-ignore-start — the register's own abbreviations and the French
// particles that stay lower-case inside a proper name. This expands a FRENCH
// address into French words; an English reader still reads the street as the
// register filed it.
const ANFR_ABBREVIATIONS = Object.freeze({
  R: 'rue', AV: 'avenue', BD: 'boulevard', BVD: 'boulevard', CHE: 'chemin',
  RTE: 'route', PL: 'place', ALL: 'allée', IMP: 'impasse', LD: 'lieu-dit',
  RES: 'résidence', CRS: 'cours', SQ: 'square', QUA: 'quartier', ZA: 'ZA',
  ETS: 'Établissement', MINIST: 'Ministère', SYND: 'Syndicat',
  MIXT: 'mixte', COLLECT: 'collectivité', TERRIT: 'territoriale',
  SCI: 'SCI', SA: 'SA', SARL: 'SARL', EPIC: 'EPIC',
});
/** Particles that stay lowercase inside a French proper name. */
const ANFR_PARTICLES = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'LÈS', 'EN', 'ET', 'SUR', 'SOUS', 'AUX', 'AU', 'D', 'L']);
// i18n-ignore-end

/**
 * One shouted word of a name, cased part by part: `SAINT-SEVER` →
 * `Saint-Sever`, `D’ASCQ` → `d’Ascq`. A particle stays lowercase except at
 * the head of the whole text — `La Rochelle`, not `la Rochelle`: the commune
 * is the title of the antenna's card in the key.
 * @param {string} word
 * @param {boolean} head Whether this is the first word of the text.
 * @returns {string}
 */
function anfrCaseWord(word, head) {
  return word.split('-').map((part, index) => part.split('’').map((piece, inner) => {
    const lower = piece.toLocaleLowerCase('fr-FR');
    const atHead = head && index === 0 && inner === 0;
    if (!atHead && ANFR_PARTICLES.has(piece.toUpperCase())) return lower;
    return lower.charAt(0).toLocaleUpperCase('fr-FR') + lower.slice(1);
  }).join('’')).join('-');
}

/** `30 R PETRICOT RES HORIZON` → `30 rue Petricot résidence Horizon`. */
export function anfrPlainText(value) {
  const text = String(value || '')
    .replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/'/g, '’').trim();
  if (!text) return '';
  // Already mixed case upstream: expand the abbreviations and leave the casing
  // exactly as filed rather than re-casing a name somebody typed correctly.
  const mixed = /[a-zàâçéèêëîïôûùüÿñæœ]/.test(text);
  return text
    .split(' ')
    .map((word, index) => {
      const bare = word.replace(/[^A-Za-zÀ-ÿ-]/g, '');
      const expanded = ANFR_ABBREVIATIONS[bare.toUpperCase()];
      if (expanded) return word.replace(bare, expanded);
      if (mixed) return word;
      // `6E` is the sixth arrondissement, not an initial. Ordinals keep their
      // digits and lose the shout.
      if (/^\d/.test(word)) return word.replace(/(\d)(E|ER|EME|ÈME)\b/gi, (_, digit, suffix) => digit + suffix.toLocaleLowerCase('fr-FR'));
      return anfrCaseWord(word, index === 0);
    })
    .join(' ');
}

/** The commune of a Cartoradio site — `Paris 6e`, not `PARIS 6E ARRONDISSEMENT` — or `''`. */
export function anfrPlainCommune(site) {
  return anfrPlainText(site?.commune).replace(/\s+Arrondissement$/i, '');
}

/** The four national brands first, in the order readers know them, then the rest. */
// i18n-ignore-next-line — brand names, the same in both languages.
const ANFR_BRAND_ORDER = Object.freeze(['Orange', 'SFR', 'Bouygues', 'Free']);

/** The operators of a support as a reader names them: `Orange, SFR, Bouygues, Free`. */
export function anfrCardOperators(support) {
  const names = Array.isArray(support?.operators) ? support.operators : [];
  const rank = (name) => {
    const index = ANFR_BRAND_ORDER.indexOf(name);
    return index < 0 ? ANFR_BRAND_ORDER.length : index;
  };
  return [...new Set(names.map(anfrOperatorShort).filter(Boolean))]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'fr'));
}

/** The card's title: the newest generation on the air and the operator count. */
export function anfrCardTitle(top, operators) {
  const m = messages().card;
  if (!operators) return m.titleNoOperator;
  return top ? m.title(top, fr(operators), operators) : m.titleProject(fr(operators), operators);
}

/**
 * What the antenna carries, in one line: the generations on the air, and the
 * ones an approved project would ADD. An operator re-filing for a band already
 * on the air is paperwork and takes no word — 11 830 of the 15 606 live
 * supports with a project on file are exactly that.
 */
export function anfrNetworksLine(support) {
  const m = messages().networks;
  const liveMask = Number(support?.live) || 0;
  const live = anfrDecodeMask(liveMask, ANFR_GENERATIONS).reverse();
  const planned = anfrDecodeMask((Number(support?.plan) || 0) & ~liveMask, ANFR_GENERATIONS).reverse();
  if (!live.length) return planned.length ? m.plannedOnly(planned.join(', ')) : m.nothing;
  return planned.length
    ? m.liveAndPlanned(live.join(', '), planned.join(', '), planned.length)
    : m.live(live.join(', '));
}

/**
 * What the antenna stands on, and how high, in the reader's words.
 *
 * The register's 38 natures fold into the handful a reader can picture — a
 * pylon, a mast, a roof — and the rest keep their own name (a lighthouse is a
 * lighthouse). The height is the one the register publishes, rounded to the
 * metre; none is printed where none is published.
 */
export function anfrPlacementLine(nature, heightM) {
  const m = messages().placement;
  const lower = String(nature || '').trim().toLocaleLowerCase('fr-FR');
  const height = Number.isFinite(heightM) && heightM > 0 ? fr(Math.round(heightM)) : '';
  if (/tunnel|intérieur|souterrain|sous-terrain|galerie/.test(lower)) return m.underground;
  if (/pylône|pylone/.test(lower)) return m.pylon(height);
  if (/^mât|^mat\b|^fût|^fut\b/.test(lower)) return m.mast(height);
  if (/^tour/.test(lower)) return m.tower(height);
  if (/immeuble|bâtiment|batiment|local technique|dalle|toit/.test(lower)) return m.roof(height);
  if (/château d'eau|chateau d'eau|réservoir/.test(lower)) return m.waterTower(height);
  if (/religieux|église|eglise|clocher/.test(lower)) return m.religious(height);
  if (!lower) return height ? m.other(m.unknown, height) : m.unknown;
  const named = labelFor(ANFR_NATURE_LABELS, lower);
  return m.other(named.charAt(0).toUpperCase() + named.slice(1), height);
}

/** Every distinct band the mast radiates, in MHz — the join key for a report. */
export function anfrMastBandsMhz(detail) {
  const rows = Array.isArray(detail?.antennas?.byOperator) ? detail.antennas.byOperator : [];
  const mhz = new Set();
  for (const row of rows) {
    for (const entry of row.generations || []) {
      for (const value of entry.mhz || []) mhz.add(value);
    }
  }
  return [...mhz].sort((a, b) => a - b);
}

/**
 * The waves around the antenna, in ONE line, or null.
 *
 * A CEM report measures a PLACE on request and is never attached to a mast, so
 * the line says how far from the mast it was taken and when. The level is a
 * multiple of the strictest limit the report publishes — "32 fois sous la
 * limite légale" is a thing a worried reader can hold, volts per metre are
 * not — and it is never called safe. A report older than the equipment beside
 * it, or blind to some of its bands, says so in the same line.
 *
 * @param {?object} detail Cartoradio payload.
 * @returns {?string}
 */
export function anfrExposureLine(detail) {
  const exposure = detail?.exposure;
  if (!exposure) return null;
  const m = messages().exposure;
  if (exposure.within === 0) return m.none(fr(exposure.radiusM ?? ANFR_EXPOSURE_RADIUS_M));
  const report = exposure.report;
  if (!report) return exposure.nearest ? m.unreadable(fr(exposure.nearest.metres)) : null;

  const metres = fr(exposure.nearest?.metres ?? 0);
  const year = String(report.measuredOn || '').slice(0, 4) || '?';
  const before = report.predatesEquipment || anfrUnmeasuredBands(report, anfrMastBandsMhz(detail)).length > 0;
  const measured = before ? m.measuredBefore(metres, year) : m.measured(metres, year);
  if (report.conforming === false) return m.aboveLimit(measured);
  const limit = Number(report.lowestLimitVoltsPerM);
  const global = Number(report.globalVoltsPerM);
  if (Number.isFinite(global) && global > 0) {
    return Number.isFinite(limit) && limit > 0
      ? m.belowLimit(measured, fr(Math.max(1, Math.round(limit / global))))
      : m.volts(measured, formatNumber(global, { minimumFractionDigits: 2 }));
  }
  // A global of zero is the protocol's floor: too weak to register, not zero.
  if (Number.isFinite(global)) return m.tooWeak(measured);
  return m.noValue(measured);
}

/**
 * Card copy for one selected support.
 *
 * @param {object} record Render record.
 * @param {object} [payload] The document the record came from.
 * @returns {string} Newline-separated card copy.
 */
export function buildAnfrSelectionLabel(record, payload = null) {
  const support = record?.support || {};
  const detail = record?.detail || null;
  const m = messages().card;
  const operators = anfrCardOperators(support);
  const top = anfrDecodeMask(support.live, ANFR_GENERATIONS).reverse()[0] || null;
  const lines = [];
  if (operators.length) lines.push(operators.join(', '));
  lines.push(anfrNetworksLine(support));
  const placement = anfrPlacementLine(support.nature, support.heightM);
  const commune = anfrPlainCommune(detail?.site);
  lines.push(commune ? m.where(placement, commune) : placement);
  if (record?.detailPending) {
    lines.push(m.loading);
  } else {
    const waves = anfrExposureLine(detail);
    if (waves) lines.push(waves);
  }
  lines.push(m.source(anfrEditionLabel(payload?.edition) || '—'));
  return [anfrCardTitle(top, operators.length), ...lines].join('\n');
}

/** `2025-07-18` → `18/07/2025`. */
export function anfrFrenchDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

/**
 * Card copy for one maillage dot, before its lookup lands.
 *
 * The tuple carries the newest generation and the operator count, so the
 * title is already true; the lookup brings the rest, and turns this card into
 * the support's own.
 */
export function buildAnfrMeshLabel(record) {
  const tuple = record?.tuple || [];
  const band = meshSupportBand(tuple);
  const operators = Number(tuple[MESH_OPERATORS]) || 0;
  const m = messages().card;
  const lines = [];
  if (record?.lookupPending) lines.push(m.loading);
  else if (record?.lookupError || record?.lookupEmpty) lines.push(m.zoomIn);
  return [anfrCardTitle(band === 'projet' ? null : band.toUpperCase(), operators), ...lines].join('\n');
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
    // The selected mast is the amber diamond (`anfrGlyphs.js`), and its tag
    // wears the same amber.
    accent: ANFR_SELECTED_FILL,
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

/** Protected selected-support entry for the shared overlay host. */
export function createAnfrSelectedOverlayEntry(record, payload = null, viewshed = null) {
  const position = record?.position;
  if (!record?.id || !position) return null;
  const copy = record.mesh && !record.support
    ? buildAnfrMeshLabel(record, payload)
    : buildAnfrSelectionLabel(record, payload);
  const line = viewshed?.recordId === record.id ? anfrViewshedLine(viewshed) : '';
  if (!line) return selectedOverlayEntry(record.id, position, copy);
  // Above the source line, which closes a support's card.
  const lines = copy.split('\n');
  lines.splice(record.support ? lines.length - 1 : lines.length, 0, line);
  return selectedOverlayEntry(record.id, position, lines.join('\n'));
}

/** Whole kilometres, the way the card prints them: `28 km`. */
function viewshedKm(metres) {
  return `${formatNumber(Math.round(metres / 1000))} km`;
}

/**
 * The card's line-of-sight sentence for one state, or '' when there is none.
 * Exported for the tests; the state object is the one `ensureViewshed` keeps.
 */
export function anfrViewshedLine(viewshed) {
  const m = messages().viewshed;
  switch (viewshed?.status) {
    case 'loading': return m.loading;
    case 'photoreal': return m.photoreal;
    case 'failed': return m.failed;
    case 'ready': return m.ready(formatPercent(Math.round(viewshed.share * 100)), viewshedKm(viewshed.radiusM));
    default: return '';
  }
}

/**
 * What each operator runs on the mast, newest generation first — the key's
 * folded « Voir les équipements ». Null until Cartoradio has answered, and
 * null when it filed no operator: a button that opens onto nothing is not
 * printed.
 * @param {?object} detail Cartoradio payload.
 * @returns {?object} The `list` slot of the key's card.
 */
function anfrEquipmentList(detail) {
  const rows = Array.isArray(detail?.antennas?.byOperator) ? detail.antennas.byOperator : [];
  const m = messages().panel;
  const rank = (name) => {
    const index = ANFR_BRAND_ORDER.indexOf(name);
    return index < 0 ? ANFR_BRAND_ORDER.length : index;
  };
  const items = rows
    .map((row) => ({
      name: anfrOperatorShort(row?.name),
      generations: (row?.generations || []).map((entry) => entry?.generation).filter(Boolean),
      antennas: Number(row?.antennas) || 0,
    }))
    .filter((row) => row.name && row.generations.length)
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'fr'))
    .map((row) => ({
      text: m.operatorLine(row.name, row.generations.join(', '), fr(row.antennas), row.antennas),
    }));
  if (!items.length) return null;
  const antennas = Number(detail.antennas.antennas) || 0;
  return { summary: m.equipment(fr(antennas), antennas), items };
}

/**
 * The selected antenna as the map key prints it (`legendSelection`), after the
 * approved mock of 2026-09-22: the place as the name, what it stands on and
 * whose it is, one plate per network on the air, the waves, the line of sight
 * as the figure, the register's edition, and what each operator runs folded
 * under one button.
 *
 * The place is Cartoradio's commune, so it arrives with the second answer; the
 * card is titled like the globe's until then, and keeps its key throughout so
 * the key does not scroll to it twice. A maillage dot whose support is not
 * known yet prints the globe card's own lines.
 *
 * The plates are RINGED in the colours the dots are drawn in — the 2G slate is
 * too dark to carry black text — so the card still reads against the classes
 * above it.
 *
 * @param {?object} record Render record.
 * @param {?object} [payload] The document the record came from.
 * @param {?object} [viewshed] The state `ensureViewshed` keeps.
 * @returns {?object}
 */
export function anfrSelectionPanel(record, payload = null, viewshed = null) {
  if (!record?.id) return null;
  const m = messages();
  const key = String(record.id);
  const source = m.card.source(anfrEditionLabel(payload?.edition) || '—');
  if (record.mesh && !record.support) {
    const [title, ...lines] = buildAnfrMeshLabel(record).split('\n');
    return { key, title, lines, footnote: source };
  }
  const support = record.support || {};
  const detail = record.detail || null;
  const operators = anfrCardOperators(support);
  const liveMask = Number(support.live) || 0;
  const live = anfrDecodeMask(liveMask, ANFR_GENERATIONS);
  const planned = anfrDecodeMask((Number(support.plan) || 0) & ~liveMask, ANFR_GENERATIONS);
  const commune = anfrPlainCommune(detail?.site);
  const lines = [];
  if (!operators.length) lines.push(m.card.titleNoOperator);
  if (!live.length) lines.push(anfrNetworksLine(support));
  if (record.detailPending || record.lookupPending) {
    lines.push(m.card.loading);
  } else {
    const waves = anfrExposureLine(detail);
    if (waves) lines.push(waves);
  }
  const mine = viewshed?.recordId === record.id ? viewshed : null;
  let metric = null;
  if (mine?.status === 'ready') {
    metric = {
      heading: m.viewshed.panel.heading,
      color: VIEWSHED_COLOR,
      value: m.viewshed.panel.value(formatPercent(Math.round(mine.share * 100)), viewshedKm(mine.radiusM)),
      caption: m.viewshed.panel.caption,
    };
  } else {
    const line = anfrViewshedLine(mine);
    if (line) lines.push(line);
  }
  return {
    key,
    title: commune || anfrCardTitle(live.at(-1) || null, operators.length),
    meta: [anfrPlacementLine(support.nature, support.heightM), operators.join(' · ')],
    chips: live.length
      ? {
        caption: m.panel.networks,
        items: live.map((generation) => ({ label: generation, color: anfrBandColor(generation.toLowerCase()) })),
        text: planned.length ? m.panel.planned(planned.join(', '), planned.length) : null,
        outline: true,
      }
      : null,
    lines,
    metric,
    footnote: source,
    list: anfrEquipmentList(detail),
  };
}

// --- Selection --------------------------------------------------------------

// ── THE CARD IS IN THE MAP KEY, THE GLOBE KEEPS A TAG ───────────────────────
//
// Since lot 2 of the digital-infrastructure mock (2026-09-22), a selected
// antenna and a read coverage spot print their card in the key's block
// (`anfrSelectionPanel`, `coverageSelectionPanel`), as the DVF sale and the
// DPE site already did. The globe keeps the title alone over the object, so
// map and card still point at each other — and the whole card again wherever
// the key cannot carry it: on a phone, or with the key folded away.

/** How long one answer to "does the key carry the card?" is trusted, in ms. */
const KEY_CARRIES_TTL_MS = 250;
let _keyCarries = false;
let _keyCarriesAt = -Infinity;
/** Whether the card on the globe was last published as a tag alone. */
let _publishedTagOnly = false;
/** Watches the key being folded or hidden while something is selected. */
let _keyObserver = null;

/**
 * `mapKeyCarriesSelection`, asked at most every {@link KEY_CARRIES_TTL_MS}.
 * The tag is republished on every frame while something is selected, and the
 * question reads the key's layout boxes; a reader folding the key still gets
 * the whole card back within a quarter of a second.
 */
function keyCarriesSelection() {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - _keyCarriesAt > KEY_CARRIES_TTL_MS) {
    _keyCarries = mapKeyCarriesSelection();
    _keyCarriesAt = now;
  }
  return _keyCarries;
}

/**
 * Ask the shell to repaint the key now. This layer's own repaint is its six-
 * hour poll away, and a card that waits for another layer's tick to appear is
 * a click that seems to do nothing. The literal is `LAYER_DRAW_CHANGED_EVENT`
 * of `addressScanLayer.js`, as in `rteGeneration.js`.
 */
function announceSelectionChanged() {
  if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('gev:layer-draw-changed', {
    detail: { layerId: ANFR_FR_LAYER_ID, selection: true },
  }));
}

/**
 * Put the whole card back on the globe when the key is folded or hidden, and
 * take it off again when the key comes back — while something is selected.
 *
 * Nothing republishes the card per frame (#339), so without this a reader who
 * folds the key after a click keeps a tag and loses the card. TWO nodes are
 * watched, because the key is hidden from two places: its own `class` and
 * `hidden` when it is folded, and the BODY's class when the clean view takes
 * the whole interface away (`body.ui-clean-view`). A change is acted on only
 * when it flips the answer the card was published with, so the key's repaint
 * — which writes neither — cannot feed the watch.
 */
function watchKeyVisibility() {
  if (_keyObserver || typeof MutationObserver !== 'function' || typeof document === 'undefined') return;
  const key = document.getElementById?.('map-legend');
  if (!key) return;
  _keyObserver = new MutationObserver(() => {
    _keyCarriesAt = -Infinity;
    if (keyCarriesSelection() === _publishedTagOnly) return;
    if (_selectedId) {
      const entry = selectedSupportEntry(_records.get(_selectedId));
      if (entry) _overlayHost.setEntries(ANFR_FR_OVERLAY_SOURCE_ID, [entry], ANFR_FR_OVERLAY_SOURCE_OPTIONS);
    } else {
      publishCoverageCard();
    }
    governorRequestRender('anfr-fr-card');
  });
  _keyObserver.observe(key, { attributes: true, attributeFilter: ['class', 'hidden'] });
  if (document.body) _keyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

function unwatchKeyVisibility() {
  _keyObserver?.disconnect();
  _keyObserver = null;
}

/** The selected support on the globe: its whole card, or its title as a tag. */
function selectedSupportEntry(record) {
  _publishedTagOnly = keyCarriesSelection();
  if (!_publishedTagOnly) return createAnfrSelectedOverlayEntry(record, activePayload(), _viewshed);
  const panel = anfrSelectionPanel(record, activePayload(), _viewshed);
  if (!panel || !record?.position) return null;
  return selectedOverlayEntry(record.id, record.position, panel.title);
}

function restoreRecordStyle(record) {
  if (!record?.point) return;
  dressMastSprite(record.point, record.style);
}

function clearSelection() {
  // The coverage card shares the support card's overlay source, so clearing
  // either is clearing the one card on screen.
  const hadCoverageCard = Boolean(_coverageCard);
  _coverageCard = null;
  _coverageCardShown = null;
  _coverageCardGeneration += 1;
  unwatchKeyVisibility();
  if (!_selectedId) {
    if (hadCoverageCard) {
      _overlayHost.clearSource(ANFR_FR_OVERLAY_SOURCE_ID);
      governorRequestRender('anfr-fr-coverage-card');
      announceSelectionChanged();
    }
    return;
  }
  restoreRecordStyle(_records.get(_selectedId));
  _selectedId = null;
  clearSectors();
  removeViewshed();
  _overlayHost.clearSource(ANFR_FR_OVERLAY_SOURCE_ID);
  governorRequestRender('anfr-fr-deselect');
  announceSelectionChanged();
}

/** Redraw the selected card in place, if `id` is still what is selected. */
function repaintSelectedCard(id) {
  if (_selectedId !== id) return;
  const record = _records.get(id);
  // The Cartoradio card is what carries the bearings, so the arrival that
  // repaints the text is also the arrival that can finally draw the rays.
  if (record) drawSectors(record);
  // A maillage dot only learns WHICH support it is when its lookup lands —
  // and with it the height the line of sight starts from.
  if (record) ensureViewshed(record);
  const entry = selectedSupportEntry(record);
  if (entry) {
    _overlayHost.setEntries(ANFR_FR_OVERLAY_SOURCE_ID, [entry], ANFR_FR_OVERLAY_SOURCE_OPTIONS);
  }
  governorRequestRender('anfr-fr-card');
  announceSelectionChanged();
}

/**
 * The selected record, taken out of a collection about to be rebuilt.
 *
 * A rebuild on camera settle used to clear the selection outright: every pan,
 * even a few pixels, closed the card the reader had just opened — the ground
 * card included, which is anchored to the ground and owes nothing to the
 * dots. The ground card is now left alone, and the selected support is
 * carried over when the new view still draws it ({@link restoreSelectionAfterRebuild}).
 */
function takeSelectionForRebuild() {
  return _selectedId ? _records.get(_selectedId) || null : null;
}

/** Re-light the carried support on its new dot, or let it go if it left the view. */
function restoreSelectionAfterRebuild(previous) {
  if (!previous) return;
  const record = _records.get(previous.id);
  if (!record) {
    clearSelection();
    return;
  }
  if (record.point) dressSelected(record.point);
  repaintSelectedCard(record.id);
}

function selectSupport(id) {
  const record = _records.get(id);
  if (!record) return;
  if ((_selectedId && _selectedId !== id) || _coverageCard) clearSelection();
  _selectedId = id;
  // A new click asks the key afresh rather than trusting a quarter-second-old answer.
  _keyCarriesAt = -Infinity;
  watchKeyVisibility();
  if (record.point) dressSelected(record.point);
  // A maillage dot knows its band and its operator count but not its identity.
  // Ask the register for it, and paint the card twice rather than making the
  // reader zoom in to find out what they clicked on.
  if (record.mesh && !record.support && !record.lookupPending) {
    void resolveMeshSupport(record);
  } else if (record.support && !record.detail && !record.detailPending) {
    void resolveDetail(record);
  }
  // `repaintSelectedCard` draws the rays: whatever bearings this session
  // already holds go up now, and the ones the Cartoradio call is about to
  // bring go up when it lands and repaints.
  repaintSelectedCard(id);
}

function onKeyDown(event) {
  if (event.key === 'Escape' && (_selectedId || _coverageCard)) clearSelection();
}

function installClickHandler(viewer) {
  if (_clickHandler) return;
  _clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  _clickHandler.setInputAction((movement) => {
    const picked = pickAt(viewer.scene, movement.position);
    const id = picked?.id;
    if (typeof id === 'string' && _records.has(id)) {
      selectSupport(id);
      return;
    }
    // With the coverage on, the ground itself answers: "who reaches HERE".
    // Only a click nobody can select counts — a click on another layer's
    // object is that layer's (see `pickRegistry.isWorldPick`).
    if (isWorldPick(picked) && openCoverageCard(viewer, movement.position)) return;
    if (_selectedId || _coverageCard) clearSelection();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  if (typeof document !== 'undefined') document.addEventListener('keydown', onKeyDown);
}

// --- HTTP -------------------------------------------------------------------

async function fetchJson(url, { timeoutMs = REQUEST_TIMEOUT_MS, validate } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await _http(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (validate && !validate(payload)) throw new Error('malformed payload');
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

// --- Maillage regime --------------------------------------------------------

async function ensureMesh() {
  if (_mesh) return _mesh;
  if (_meshPromise) return _meshPromise;
  _meshPromise = fetchJson(MESH_URL, {
    timeoutMs: NATIONAL_TIMEOUT_MS,
    validate: (payload) => Array.isArray(payload?.mesh),
  })
    .then((payload) => {
      _mesh = payload;
      return payload;
    })
    .catch((error) => {
      if (error?.name !== 'AbortError') {
        console.warn('[Data:ANFR FR] national mesh failed:', error?.message || error);
      }
      return null;
    })
    .finally(() => { _meshPromise = null; });
  return _meshPromise;
}

/**
 * Draw a thinned selection of real mast positions for the current view.
 *
 * Re-picked on every camera settle rather than cached: measured over the real
 * 72 700 tuples, the pick costs 15.3 ms for a whole-France box and 1.7 ms for
 * Paris, against a round trip that would cost a few hundred.
 *
 * Only the maillage's own records and collection are touched: inside the band
 * the supports are drawn beside it and keep theirs.
 */
function reconcileMesh(box) {
  // A settle on the view already drawn — a click, a nudge under the rounding —
  // redraws nothing.
  const boxKey = boxKeyOf(box);
  if (boxKey === _meshBoxKey && _meshDrawn) return;
  const pick = selectAnfrMesh(_mesh?.mesh, {
    box,
    // § 3.5: the profile decides how DENSE the mesh is, never what it covers.
    // `lite` spends its cut on the second dot in a crowded cell — the budget
    // stays above the grid's 600 cells at 60 %, so no occupied cell empties.
    budget: profileCountBudget(anfrMeshBudget(box.north - box.south)),
  });
  _meshPick = pick;
  _meshBoxKey = boxKey;
  const selected = takeSelectionForRebuild();
  // Keyed by id: a dot still picked keeps its record and its billboard (see
  // "A rest keeps the marks it can" above), and only the newcomers are drawn.
  const previous = _meshRecords;
  const next = new Map();
  const arrivals = [];
  const ledger = markLedger();

  for (const tuple of pick.picked) {
    if (next.size >= MAX_RENDERED_SUPPORTS) break;
    const lat = Number(tuple[MESH_LAT]);
    const lon = Number(tuple[MESH_LON]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const id = anfrMeshRecordId(tuple);
    if (next.has(id)) continue;
    const style = anfrMeshStyle(tuple);
    const kept = previous.get(id);
    if (kept) {
      // The selected dot is one of these, and keeps any lookup still in
      // flight, which writes into this object when it lands.
      previous.delete(id);
      const moved = Number(kept.tuple?.[MESH_LAT]) !== lat || Number(kept.tuple?.[MESH_LON]) !== lon;
      kept.tuple = tuple;
      if (keepMark(_meshPoints, kept, moved ? Cesium.Cartesian3.fromDegrees(lon, lat, POINT_LIFT_M) : kept.position, style, undefined)) {
        ledger.written(_meshPoints);
      }
      next.set(id, kept);
      continue;
    }
    // No ground warm-up at these altitudes: a metre of vertical error is
    // invisible and 2 200 terrain lookups per pan would not be.
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, POINT_LIFT_M);
    // A dot this session has already identified keeps its identity across pans
    // and zooms — the lookup is memoized, so re-entering a city redraws the
    // cards it earned rather than re-asking for them.
    const known = _meshLookups.get(id);
    const support = Array.isArray(known) && known.length ? known[0] : null;
    next.set(id, {
      id,
      mesh: true,
      cls: 'mesh',
      tuple,
      support,
      coSited: Array.isArray(known) ? Math.max(0, known.length - 1) : 0,
      lookupEmpty: known === null,
      lookupPending: false,
      lookupError: null,
      detail: support ? _details.get(support.id) || null : null,
      detailPending: false,
      detailError: null,
      // Drawn below, once the leavers are gone.
      point: null,
      position,
      style,
    });
    arrivals.push(id);
  }
  for (const record of previous.values()) {
    releaseMark(_meshPoints, record.point);
    ledger.removed(_meshPoints);
  }
  for (const id of arrivals) {
    const record = next.get(id);
    record.point = takeMark(_meshPoints, id, record.position, record.style, undefined);
    ledger.added(_meshPoints);
  }
  ledger.settle();
  _meshRecords = next;
  _meshDrawn = true;
  syncRecords();
  // A support's class is whether the maillage draws its coordinate, and the
  // maillage has just changed.
  classifySupports();
  restoreSelectionAfterRebuild(selected);
  _fadeForce = true;
  governorRequestRender('anfr-fr-mesh');
}

/**
 * Ask the register which support is under one maillage dot.
 *
 * Deliberately NOT abortable on camera movement: the reader asked for this
 * mast, and a pan while the answer is in flight should not silently cancel it.
 */
async function resolveMeshSupport(record) {
  const id = record?.id;
  if (!id || !record.tuple) return;
  const cached = _meshLookups.get(id);
  if (cached !== undefined) {
    applyLookup(record, cached);
    return;
  }
  record.lookupPending = true;
  record.lookupError = null;
  repaintSelectedCard(id);

  const lat = Number(record.tuple[MESH_LAT]);
  const lon = Number(record.tuple[MESH_LON]);
  const params = new URLSearchParams({
    south: (lat - MESH_LOOKUP_PAD_DEG).toFixed(5),
    west: (lon - MESH_LOOKUP_PAD_DEG).toFixed(5),
    north: (lat + MESH_LOOKUP_PAD_DEG).toFixed(5),
    east: (lon + MESH_LOOKUP_PAD_DEG).toFixed(5),
  });
  try {
    const payload = await fetchJson(`${SUPPORTS_URL}?${params}`, {
      timeoutMs: DETAIL_TIMEOUT_MS,
      validate: (body) => Array.isArray(body?.supports),
    });
    const here = pickAnfrSupportsAt(payload.supports, lat, lon);
    // A lookup that found nothing is CACHED as nothing: the same answer paid
    // for again on every click is not worth a round trip.
    _meshLookups.set(id, here.length ? here : null);
    applyLookup(record, here.length ? here : null);
  } catch (error) {
    // Not cached — a timeout is not the register's answer, and the next click
    // should be allowed to ask again.
    if (error?.name !== 'AbortError') {
      console.warn('[Data:ANFR FR] mesh support lookup failed:', error?.message || error);
    }
    record.lookupError = error?.message || messages().errors.timedOut;
  } finally {
    record.lookupPending = false;
    repaintSelectedCard(id);
  }
}

function applyLookup(record, here) {
  if (Array.isArray(here) && here.length) {
    record.support = here[0];
    record.coSited = here.length - 1;
    record.lookupEmpty = false;
    record.detail = _details.get(here[0].id) || null;
    if (!record.detail) void resolveDetail(record);
  } else {
    record.lookupEmpty = true;
  }
}

// --- Supports regime --------------------------------------------------------

function boxKeyOf(box) {
  return [box.south, box.west, box.north, box.east].map((v) => v.toFixed(4)).join(',');
}

/** The coordinate a support and a maillage dot are matched on (`meshSupportId`'s). */
function supportCoordinate(support) {
  return `${Number(support?.lat).toFixed(5)},${Number(support?.lon).toFixed(5)}`;
}

/** The coordinates the maillage draws a dot at. */
function meshCoordinates() {
  const coordinates = new Set();
  for (const record of _meshRecords.values()) coordinates.add(meshSupportId(record.tuple));
  return coordinates;
}

/** The collection one class of marks lives in. */
function markCollection(cls) {
  if (cls === 'mesh') return _meshPoints;
  if (cls === 'shared') return _sharedPoints;
  return _points;
}

/** Every drawn mark by id, for the pick, the selection and the cards. */
function syncRecords() {
  _records = new Map([..._meshRecords, ..._supportRecords]);
}

/** The count and the in-view figure belong to the level that owns the key. */
function syncCounts() {
  if (_regime === 'supports') {
    _count = _supportRecords.size;
    _inView = Number(_pack?.inBox) || _count;
  } else {
    _count = _meshRecords.size;
    _inView = _meshPick?.inBox ?? _count;
  }
}

/** The records of the level that owns the key, the count and the legend. */
function dominantRecords() {
  return _regime === 'supports' ? _supportRecords : _meshRecords;
}

/**
 * Put each support in the class the maillage now gives it: SHARED when the
 * maillage draws a dot at its coordinate, its own class when it does not.
 *
 * Only while the maillage is drawn — the classes only differ in what the band
 * does to them, and with one level on screen both are at full strength. A
 * support that changes class moves collection: removed from one, added to the
 * other, one rebuild each, which a pan inside the band rarely asks for since
 * the world-locked pick keeps its dots.
 */
function classifySupports() {
  if (!_meshDrawn || !_supportRecords.size) return;
  const coordinates = meshCoordinates();
  const ledger = markLedger();
  for (const record of _supportRecords.values()) {
    const cls = coordinates.has(supportCoordinate(record.support)) ? 'shared' : 'supports';
    if (cls === record.cls) continue;
    const from = markCollection(record.cls);
    const to = markCollection(cls);
    releaseMark(from, record.point);
    ledger.removed(from);
    record.point = takeMark(to, record.id, record.position, record.style, SUPPORT_FADE);
    ledger.added(to);
    record.cls = cls;
    if (record.id === _selectedId && record.point) dressSelected(record.point);
  }
  ledger.settle();
  _fadeForce = true;
}

function reconcileSupports(payload) {
  const selected = takeSelectionForRebuild();
  // Keyed by id, as the maillage is: a support the new box shares with the
  // last one keeps its record and its billboard, re-seated on the ground
  // floor as it is now known; only the newcomers are drawn.
  const previous = _supportRecords;
  const next = new Map();
  const arrivals = [];
  const ledger = markLedger();
  const warm = [];
  const coordinates = _meshDrawn ? meshCoordinates() : null;
  for (const support of payload?.supports || []) {
    if (!Number.isFinite(support?.lat) || !Number.isFinite(support?.lon)) continue;
    if (next.size >= MAX_RENDERED_SUPPORTS) break;
    const id = anfrSupportId(support.id);
    if (next.has(id)) continue;
    const style = anfrSupportStyle(support);
    const heightM = anfrMastHeightM(support);
    const { ground, top } = supportAnchors(support.lat, support.lon, heightM);
    warm.push({ lat: support.lat, lon: support.lon });
    const kept = previous.get(id);
    if (kept) {
      // The selected support is one of these, and keeps its card in flight.
      previous.delete(id);
      Object.assign(kept, { support, groundPosition: ground, mastHeightM: heightM });
      const collection = markCollection(kept.cls);
      if (keepMark(collection, kept, top, style, SUPPORT_FADE)) ledger.written(collection);
      next.set(id, kept);
      continue;
    }
    next.set(id, {
      id,
      mesh: false,
      cls: coordinates?.has(supportCoordinate(support)) ? 'shared' : 'supports',
      support,
      coSited: 0,
      detail: _details.get(support.id) || null,
      detailPending: false,
      detailError: null,
      // Drawn below, once the leavers are gone.
      point: null,
      position: top,
      groundPosition: ground,
      mastHeightM: heightM,
      style,
    });
    arrivals.push(id);
  }
  for (const record of previous.values()) {
    const collection = markCollection(record.cls);
    releaseMark(collection, record.point);
    ledger.removed(collection);
  }
  for (const id of arrivals) {
    const record = next.get(id);
    const collection = markCollection(record.cls);
    record.point = takeMark(collection, id, record.position, record.style, SUPPORT_FADE);
    ledger.added(collection);
  }
  ledger.settle();
  _supportRecords = next;
  _supportsDrawn = true;
  syncRecords();
  classifySupports();
  warmGroundFloor(warm.slice(0, GROUND_WARM_LIMIT));
  restoreSelectionAfterRebuild(selected);
  _fadeForce = true;
  governorRequestRender('anfr-fr-supports');
}

/** The maillage has faded out under the supports, and the settled view no longer wants it. */
function dropMeshLevel() {
  if (!_meshDrawn) return;
  if (_selectedId && _meshRecords.has(_selectedId)) clearSelection();
  _meshPoints?.removeAll();
  _meshRecords = new Map();
  _meshDrawn = false;
  _meshPick = null;
  _meshBoxKey = null;
  syncRecords();
  syncCounts();
  governorRequestRender('anfr-fr-drop');
}

/** The supports have faded out under the maillage, and the settled view no longer wants them. */
function dropSupportsLevel() {
  if (!_supportsDrawn) return;
  if (_selectedId && _supportRecords.has(_selectedId)) clearSelection();
  _points?.removeAll();
  _sharedPoints?.removeAll();
  _supportRecords = new Map();
  _supportsDrawn = false;
  _pack = null;
  _packBoxKey = null;
  _mastRegime = false;
  reconcileMasts();
  syncRecords();
  syncCounts();
  governorRequestRender('anfr-fr-drop');
}

/** One `/supports` answer for a block of cells — see `anfrSupportCells.js`. */
function fetchSupportsBlock(box) {
  return fetchJson(`${SUPPORTS_URL}?${new URLSearchParams(box)}`, {
    validate: (body) => Array.isArray(body?.supports),
  });
}

/**
 * The city view's supports, kept by grid cell: a camera stop asks only about
 * ground this session has not drawn yet, where it used to ask about its exact
 * box each time the camera moved 11 m. A cell is asked for again after the
 * poll's six hours — when the browser's copy of the answer has expired too.
 */
const _supportCells = createAnfrSupportCells({
  fetchBlock: fetchSupportsBlock,
  maxBoxDeg: ANFR_MAX_BOX_DEG,
  maxAgeMs: POLL_INTERVAL_MS,
});

/**
 * The Cartoradio card for one support, on demand and once per session.
 *
 * ONE call per clicked mast, never a per-frame or per-viewport loop. The
 * Cartoradio REST API is the undocumented backend of ANFR's own map: the DATA
 * it serves is the same Licence Ouverte data, but nothing grants the right to
 * hammer the endpoint, so the proxy caches it and this asks for it once.
 */
async function resolveDetail(record) {
  const supId = record?.support?.id;
  if (!Number.isFinite(Number(supId))) return;
  const cached = _details.get(supId);
  if (cached !== undefined) {
    record.detail = cached;
    return;
  }
  record.detailPending = true;
  record.detailError = null;
  repaintSelectedCard(record.id);
  try {
    const payload = await fetchJson(`${DETAIL_URL}/${supId}`, {
      timeoutMs: DETAIL_TIMEOUT_MS,
      validate: (body) => Number.isFinite(Number(body?.supId)),
    });
    _details.set(supId, payload);
    record.detail = payload;
  } catch (error) {
    if (error?.name !== 'AbortError') {
      console.warn('[Data:ANFR FR] Cartoradio detail failed:', error?.message || error);
    }
    record.detailError = error?.message || messages().errors.timedOut;
  } finally {
    record.detailPending = false;
    repaintSelectedCard(record.id);
  }
}

// --- Viewport ---------------------------------------------------------------

/** Whichever payload is answering right now — the two carry the same provenance. */
function activePayload() {
  return _regime === 'supports' ? (_pack || _mesh) : (_mesh || _pack);
}

/** The national totals, from whichever payload has arrived. */
function nationalSummary() {
  if (_mesh) {
    return {
      count: _mesh.count,
      live: _mesh.live,
      projectOnly: _mesh.projectOnly,
      plannedUpgrades: _mesh.plannedUpgrades,
      bands: _mesh.bands,
      generations: _mesh.generations,
    };
  }
  return _pack?.national || null;
}

async function loadViewport({ force = false } = {}) {
  if (!_enabled || !_viewer) return;
  // Whatever this call concludes — records, a zoom-in verdict or a failure —
  // it concludes it about the view the camera is showing right now. See
  // `cameraSettle.js`: an arrival on any other view has to be read afresh.
  markViewportRead(_viewer, ANFR_FR_LAYER_ID);
  if (!_mastsShown) return;
  const plan = updateRegime(_viewer);
  // `planAnfrLevels` already fell back to the maillage for a view with no
  // supports box — an oblique horizon shot, a view across the dateline.
  const meshBox = plan.mesh ? cameraAnfrMeshBox(_viewer) : null;
  const supportsBox = plan.supports ? cameraAnfrBox(_viewer) : null;
  if (!meshBox && !supportsBox) {
    _status = 'empty';
    _loading = false;
    return;
  }
  const supportsKey = supportsBox ? boxKeyOf(supportsBox) : null;
  const reuseSupports = Boolean(supportsKey) && !force && _supportsDrawn && Boolean(_pack) && _packBoxKey === supportsKey;
  _error = null;
  _loading = Boolean((meshBox && !_mesh) || (supportsBox && !reuseSupports));
  const generation = ++_requestGeneration;
  // Both levels are awaited before either is drawn, so a view in the band
  // never shows half of its hand-over.
  const [, supportsAnswer] = await Promise.all([
    meshBox ? ensureMesh() : null,
    supportsBox && !reuseSupports
      ? _supportCells.load(supportsBox).then((payload) => ({ payload }), (error) => ({ error }))
      : null,
  ]);
  if (generation !== _requestGeneration || !_enabled) return;
  _loading = false;

  const hadMesh = _meshDrawn;
  const hadSupports = _supportsDrawn;
  const hadShafts = _mastsDrawn > 0;
  if (meshBox) {
    if (_mesh) {
      reconcileMesh(meshBox);
      _lastUpdate = Number(_mesh.fetchedAt) || Date.now();
    } else {
      // The upstream's own words go to the console; the row gets a sentence a
      // reader can act on. `HTTP 503` and `malformed payload` are diagnostics,
      // not user copy, and this is a French UI.
      _error = messages().errors.meshUnavailable;
    }
  }
  if (supportsBox && !reuseSupports) {
    if (supportsAnswer?.payload) {
      _pack = supportsAnswer.payload;
      _packBoxKey = supportsKey;
      reconcileSupports(supportsAnswer.payload);
      _lastUpdate = Number(supportsAnswer.payload.fetchedAt) || Date.now();
    } else {
      const error = supportsAnswer?.error;
      if (error?.name !== 'AbortError') {
        console.warn('[Data:ANFR FR] supports unavailable:', error?.message || error);
      }
      // Keep whatever is drawn: an older box is still a true map of the masts in
      // it, and blanking the screen would say France has no antennas.
      _error = _supportRecords.size
        ? messages().errors.refreshUnavailable
        : messages().errors.registerUnavailable;
    }
  }
  // `reuseSupports` short-circuits the supports, so a zoom that only crosses
  // the shaft band would otherwise leave the field as it was. Reconciling
  // here is idempotent and costs one walk of the records the layer holds.
  reconcileMasts();
  // A level landing over its partner ramps in, and its partner steps down in
  // the same proportion; a redraw of the same level swaps in one frame. A
  // shaft field built where there was none ramps in on its own.
  if (_supportsDrawn && !hadSupports && hadMesh) _fade?.arrive('supports');
  if (_meshDrawn && !hadMesh && hadSupports) _fade?.arrive('mesh');
  if (_mastsDrawn > 0 && !hadShafts) _fade?.arrive('shafts');
  syncCounts();
  if (_error) _status = _count > 0 ? 'ready' : 'error';
  else _status = _count > 0 ? 'ready' : 'empty';
  _fade?.frame();
}

// --- The hand-overs, per frame ------------------------------------------------

/** A level's arrival ramp, 1 when none runs or the layer has no handle. */
function arrivalOf(key, nowMs) {
  return _fade ? _fade.arrival(key, nowMs) : 1;
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
  const alphas = anfrLevelAlphas(span, {
    meshReady: _meshDrawn,
    supportsReady: _supportsDrawn,
    shaftsReady: _mastsDrawn > 0,
    meshArrival: arrivalOf('mesh', nowMs),
    supportsArrival: arrivalOf('supports', nowMs),
    shaftsArrival: arrivalOf('shafts', nowMs),
  });
  const force = _fadeForce;
  _fadeForce = false;
  const enabled = _enabled && _mastsShown;
  fadeMarkLevel(_meshPoints, alphas.mesh, { enabled, force });
  fadeMarkLevel(_points, alphas.supports, { enabled, force });
  fadeMarkLevel(_sharedPoints, alphas.shared, { enabled, force });
  fadeShafts(alphas.shafts, force);
  if (_plan) {
    if (_meshDrawn && !_plan.mesh && !levelVisible(true, alphas.mesh)) dropMeshLevel();
    if (_supportsDrawn && !_plan.supports && !levelVisible(true, alphas.supports)) dropSupportsLevel();
  }
  _fade?.report({
    levels: {
      mesh: alphas.mesh,
      supports: alphas.supports,
      shared: alphas.shared,
      shafts: alphas.shafts,
    },
    // i18n-ignore-next-line — level keys, read by the harness.
    dominant: _regime === 'maillage' ? 'mesh' : 'supports',
    bands: {
      'mesh-supports': { fine: ANFR_SUPPORTS_BAND.fine, coarse: ANFR_SUPPORTS_BAND.coarse, unit: 'deg-max' },
      'supports-shafts': { fine: ANFR_SHAFT_BAND.fine, coarse: ANFR_SHAFT_BAND.coarse, unit: 'deg-max' },
    },
    marks: {
      mesh: _meshPoints?.length ?? 0,
      supports: _points?.length ?? 0,
      shared: _sharedPoints?.length ?? 0,
      shafts: _mastsDrawn,
    },
    pending: _loading,
  });
}

/**
 * Put the masts away and keep the coverage: every dot, shaft and ray goes, the
 * selected mast's card with them, and whatever the register was about to
 * answer is dropped when it lands. A read coverage spot stays open — it is
 * about the ground, which is still painted.
 */
function dropMasts() {
  _requestGeneration += 1;
  if (_selectedId) clearSelection();
  _points?.removeAll();
  _meshPoints?.removeAll();
  _sharedPoints?.removeAll();
  clearMastField();
  _sectors?.removeAll();
  clearLevelRecords();
  _packBoxKey = null;
  _count = 0;
  _inView = 0;
  _mastsDrawn = 0;
  _mastsUnpublished = 0;
  _mastsClipped = 0;
  _sectorsDrawn = 0;
  _regime = 'maillage';
  _mastRegime = false;
  _loading = false;
  _error = null;
  // Nothing to wait for and nothing that failed: the layer draws what it was
  // asked to draw.
  _status = 'ready';
  governorRequestRender('anfr-fr-masts');
}

/** Forget every drawn record of both levels. */
function clearLevelRecords() {
  _records = new Map();
  _meshRecords = new Map();
  _supportRecords = new Map();
  _meshDrawn = false;
  _supportsDrawn = false;
  _meshBoxKey = null;
}

/**
 * Whether the masts are drawn once the layer comes on. A layer switched on to
 * draw nothing — a hand-written link, a session stored mid-way — shows its
 * masts, as the row's own toggle does.
 * @param {boolean} mastsShown The `masts` param.
 * @param {string} coverageMode The `coverage` param.
 * @returns {boolean}
 */
export function anfrMastsShownOnEnable(mastsShown, coverageMode) {
  return mastsShown || coverageMode === 'off';
}

/** Normalise a `masts` param: a boolean, or the share link's `'1'`/`'0'`. */
function normalizeMastsParam(value) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  return null;
}

function onCameraChanged() {
  clearTimeout(_cameraDebounceTimer);
  _cameraDebounceTimer = setTimeout(() => { void loadViewport(); }, CAMERA_DEBOUNCE_MS);
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

// --- Detection --------------------------------------------------------------

function collectDetectableObjects(options = {}) {
  if (!_enabled || !_records.size) return [];
  const records = [];
  // The level that owns the key: inside the band the other one is fading.
  for (const record of dominantRecords().values()) {
    // A support where nothing radiates is not offered to DETECT. The callout
    // names a generation, and "5G" over a mast that has never transmitted is
    // exactly the claim this layer exists to refuse.
    if (record.style?.hollow) continue;
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
    const band = record.style?.band || 'projet';
    const operators = record.style?.operators || 0;
    result.push({
      position: record.position,
      sourceId: record.id,
      id: operators > 1
        ? messages().detectable.withOperators(band.toUpperCase(), operators)
        : band.toUpperCase(),
      type: 'Antenna mast',
      skipLabel: record.id === _selectedId,
    });
    if (result.length >= maxCount) break;
  }
  return result;
}

// --- Row label --------------------------------------------------------------

/** One line under the layer's toggle: what this view actually contains. */
export function buildAnfrLoadingLabel({
  regime = _regime,
  status = _status,
  loading = _loading,
  count = _count,
  inView = _inView,
  national = nationalSummary(),
  pick = _meshPick,
  records = dominantRecords(),
  mastRegime = _mastRegime,
  masts = _mastsDrawn,
  mastsUnpublished = _mastsUnpublished,
  mastsClipped = _mastsClipped,
} = {}) {
  const m = messages().status;
  if (loading) return m.loading;
  if (status === 'error') return '';
  const parts = [];
  if (regime === 'maillage') {
    // A camera over the Pacific is not a broken layer and not an empty
    // register: `layerFeedState()` renders `empty` as a green ON chip, and the
    // sentence is what tells a reader which of the two they are looking at.
    if (!count) return national?.count ? m.empty : '';
    parts.push(pick?.thinned
      ? m.thinned(fr(count), fr(inView))
      : m.supports(fr(count)));
    if (national?.count) parts.push(m.inFrance(fr(national.count)));
    // The maillage cannot draw the upgrade ring — the tuple has no plan mask —
    // so it says how many rings it is NOT showing rather than letting the
    // absence read as absence.
    if (national?.plannedUpgrades > 0) {
      parts.push(m.plannedZoomOnly(fr(national.plannedUpgrades)));
    }
    return parts.join(' · ');
  }
  if (!count) return m.empty;
  parts.push(m.supports(fr(count)));
  if (inView > count) parts.push(m.notDrawn(fr(inView - count)));
  let hollow = 0;
  let ringed = 0;
  for (const record of records.values()) {
    if (record.style?.hollow) hollow += 1;
    else if (record.style?.ringed) ringed += 1;
  }
  if (hollow > 0) parts.push(m.approvedOnly(fr(hollow), hollow));
  if (ringed > 0) parts.push(m.extensions(fr(ringed), ringed));
  // The shafts are the layer's only world-space channel, and a reader who sees
  // none has to be able to tell "too far to draw them" from "no height
  // published" from "the cap bit". A4 has three empties and these are three of
  // them, so they get three different sentences.
  if (!mastRegime) {
    parts.push(m.shaftsWhenClose);
  } else {
    if (masts > 0) parts.push(m.shafts(fr(masts)));
    if (mastsUnpublished > 0) parts.push(m.noHeight(fr(mastsUnpublished), mastsUnpublished));
    if (mastsClipped > 0) parts.push(m.clipped(fr(mastsClipped)));
  }
  return parts.join(' · ');
}

/**
 * WHAT THE MAST CHANNEL STILL OWES THE READER — which is the ABSENCES, and
 * nothing else.
 *
 * This used to print five rows: a `Fût` explainer, three numbered height marks
 * (p05, median, p95 of the register, drawn as graphite bars), and the two
 * absence rows below. Four of them are gone, under the house rule that
 * `#map-legend` carries the COLOUR channel and not the FORM channel (PR #138,
 * which deleted `sizeFootprintGlyph` for the same reason and cut the two mark
 * rows off `local-airports`).
 *
 * The three height marks were a SIZE ladder in one flat graphite. Their scale
 * is 1:1 — one drawn metre is one metre of support — so what they positioned a
 * reader inside was the national distribution, which is a statistician's
 * question and not a map reader's: somebody looking at a street compares the
 * two masts in front of them to each other and to the buildings, and the globe
 * answers that unaided. The distribution stays measured and quoted in this
 * module's header, where the next person to touch the channel will look.
 *
 * The `Fût` row said a shaft is a shaft. A shaft under a dot decodes right
 * without a key.
 *
 * What is left is the pair no shape can state, because they are marks that are
 * NOT THERE: a mast drawn with no shaft reads as a short mast, and a ceiling
 * that withholds a shaft reads as a missing measurement. Both are decoded
 * WRONG unaided, which is the one case the rule keeps a form row for. The
 * selected support's azimuths join them when there are any, for the same
 * reason — a 60 m ray is a drawing convention and reads as a coverage claim.
 *
 * The rows only appear where the channel does. Publishing a mast key beside a
 * maillage that draws no shafts would be a legend for a mark that is not on
 * the screen.
 *
 * @param {object} [state] Injected for tests.
 * @returns {Array<object>}
 */
export function anfrMastLegend({
  mastRegime = _mastRegime,
  regime = _regime,
  mastsUnpublished = _mastsUnpublished,
  mastsClipped = _mastsClipped,
  sectors = _sectorsDrawn,
} = {}) {
  if (regime !== 'supports' || !mastRegime) return [];
  const legendWords = messages().legend;
  const rows = [];
  if (mastsUnpublished > 0) {
    rows.push({ label: legendWords.noMast, color: null, count: mastsUnpublished, glyph: prismHatchGlyph() });
  }
  if (mastsClipped > 0) {
    rows.push({ label: legendWords.clipped, color: null, count: mastsClipped });
  }
  if (sectors > 0) {
    rows.push({
      label: legendWords.azimuths.label,
      color: SELECTED_COLOR,
      count: sectors,
      blurb: legendWords.azimuths.blurb,
    });
  }
  return rows;
}

// --- The selected mast's line of sight ---------------------------------------
//
// ANFR publishes neither a power nor a beamwidth, so this layer draws no range
// of its own — the rays are 60 m and say they are a convention. What it CAN
// draw honestly is geometry: from the top of the mast, at its registered
// height, which ground is in view, out to the radio horizon that height
// implies. `mastViewshed.js` holds the geometry and its caveats.

function removeViewshed() {
  _viewshedGeneration += 1;
  if (_viewshed?.layer) _viewer?.imageryLayers?.remove?.(_viewshed.layer, true);
  _viewshed = null;
}

/** Start the selected support's line of sight, once, when it can have one. */
function ensureViewshed(record) {
  // No imagery collection, nothing to lay the result on: a viewer double in a
  // test, or a viewer being torn down. Never fetch a DEM for nobody.
  if (!_enabled || !record || record.id !== _selectedId || !_viewer?.imageryLayers?.add) return;
  if (_viewshed?.recordId === record.id) return;
  const support = record.support;
  const antennaM = support ? anfrMastHeightM(support) : null;
  // No support yet (a maillage dot still being looked up) or no mast to stand
  // on (the 551 underground supports): nothing to compute, and nothing said.
  if (!support || !Number.isFinite(antennaM) || antennaM <= 0) return;
  removeViewshed();
  const generation = _viewshedGeneration;
  if (_viewer?.scene?.globe && _viewer.scene.globe.show === false) {
    _viewshed = { recordId: record.id, status: 'photoreal' };
    return;
  }
  _viewshed = { recordId: record.id, status: 'loading' };
  _viewshedCompute({ lon: support.lon, lat: support.lat, antennaM })
    .then((result) => {
      if (generation !== _viewshedGeneration || _selectedId !== record.id) return;
      const layer = _viewshedLayerFactory(result);
      _viewer?.imageryLayers?.add?.(layer);
      _viewshed = {
        recordId: record.id,
        status: 'ready',
        radiusM: result.radiusM,
        horizonM: result.horizonM,
        capped: result.capped,
        share: result.area.share,
        layer,
      };
      repaintSelectedCard(record.id);
    })
    .catch((error) => {
      if (generation !== _viewshedGeneration || _selectedId !== record.id) return;
      _viewshed = { recordId: record.id, status: 'failed', error: error?.message || String(error) };
      repaintSelectedCard(record.id);
    });
}

// --- The ARCEP coverage under the masts -------------------------------------
//
// What the masts cannot say — where their signal actually reaches — comes from
// the operators' own simulations, published by the ARCEP and folded into a
// tile pyramid by `scripts/build-mobile-coverage.mjs`. See `mobileCoverage.js`
// for the encoding and the source, `mobileCoverageImagery.js` for the drawing.
//
// OFF BY DEFAULT, and one of five chips on the row turns it on: « Zones
// blanches » counts the operators, the four others show one operator's levels.
// The meta is asked for once when the layer is switched on — 7 KB — so the
// chips only appear on a server that actually has the pyramid.

function coverageMetaValid(meta) {
  return meta?.format === COVERAGE_FORMAT
    && typeof meta.edition === 'string'
    && Boolean(meta.tiles) && typeof meta.tiles === 'object'
    && Number.isInteger(meta.minZoom) && Number.isInteger(meta.maxZoom)
    && Array.isArray(meta.stats?.histogramKm2);
}

async function ensureCoverageMeta() {
  if (_coverageMeta) return _coverageMeta;
  if (_coverageMetaPromise) return _coverageMetaPromise;
  _coverageStatus = 'loading';
  _coverageError = null;
  _coverageMetaPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await _http(COVERAGE_META_URL, { signal: controller.signal });
      // A 404 is not a failure: this server was never given a pyramid.
      if (response.status === 404) {
        _coverageStatus = 'missing';
        return null;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const meta = await response.json();
      if (!coverageMetaValid(meta)) throw new Error('malformed payload');
      _coverageMeta = meta;
      _coverageRead = createCoveragePointReader(meta);
      _coverageStatus = 'ready';
      return meta;
    } catch (error) {
      _coverageStatus = 'failed';
      _coverageError = error?.message || String(error);
      return null;
    } finally {
      clearTimeout(timer);
      _coverageMetaPromise = null;
    }
  })();
  return _coverageMetaPromise;
}

/** Google's mesh, if this session has bought it — shown or not. */
function photorealTileset() {
  const primitives = _viewer?.scene?.primitives;
  if (!primitives || typeof primitives.get !== 'function') return null;
  for (let i = 0; i < primitives.length; i++) {
    const primitive = primitives.get(i);
    if (primitive instanceof Cesium.Cesium3DTileset && !primitive.isDestroyed?.()) return primitive;
  }
  return null;
}

function removeCoverageDrape() {
  const drape = _coverageDrape;
  _coverageDrape = null;
  if (drape && !drape.tileset.isDestroyed?.()) drape.tileset.imageryLayers?.remove?.(drape.layer, true);
}

function removeCoverageImagery() {
  cancelCoverageSwap();
  if (_coverageImagery) _viewer?.imageryLayers?.remove?.(_coverageImagery, true);
  _coverageImagery = null;
  _coverageImageryMode = null;
  removeCoverageDrape();
}

function coverageLayer(mode, { drape = false, alpha = 1 } = {}) {
  const lut = drape ? coverageLut(mode, COVERAGE_DRAPE_ALPHA) : coverageLut(mode);
  // The no-coverage rung is hatched on both surfaces — see `COVERAGE_HATCH`.
  const hatchLut = drape ? coverageHatchLut(mode, COVERAGE_DRAPE_ALPHA) : coverageHatchLut(mode);
  const layer = new Cesium.ImageryLayer(createCoverageImageryProvider(_coverageMeta, lut, { drape, hatchLut }));
  layer.alpha = alpha;
  return layer;
}

/**
 * Drape `mode` on the mesh too, once there is a mesh.
 *
 * Both layers stay in place whichever stack is shown: a surface that is not on
 * screen is not traversed and asks for no tile, so switching between Satellite
 * and Google 3D repaints from memory instead of rebuilding.
 *
 * A mode change on the mesh is a plain replacement, NOT the globe's swap
 * below. Every change to a tileset's imagery layers rebuilds the draw commands
 * of every loaded tile, and a second layer at alpha 0 is a shader variant of
 * its own: measured on the Mont-Blanc, the swap froze the first chip press on
 * Google 3D for 528 ms, where the replacement costs no long task at all.
 */
function syncCoverageDrape(mode = _coverageImageryMode) {
  const tileset = mode ? photorealTileset() : null;
  if (_coverageDrape?.tileset === tileset && _coverageDrape?.mode === mode) return;
  removeCoverageDrape();
  if (!tileset?.imageryLayers?.add) return;
  const layer = coverageLayer(mode, { drape: true });
  tileset.imageryLayers.add(layer);
  _coverageDrape = { tileset, layer, mode };
}

// --- The mode swap, on the globe ---------------------------------------------
//
// A chip press used to remove the painted layer and add the next one: for the
// two or three frames the new tiles took, the map had no colour at all —
// measured at ~36 ms of bare ground on every press, a flash the reader took
// for a reload. The next mode now loads UNDER the current one at alpha 0 —
// the globe loads a layer it does not draw, and skips it in its shaders — and
// the two trade places in one frame once the new one has caught up, or after
// {@link COVERAGE_SWAP_MAX_MS} whatever happens. The mesh does not swap: see
// `syncCoverageDrape`.

const COVERAGE_SWAP_MAX_MS = 1500;
/** Consecutive rendered frames the incoming layer must be settled for. */
const COVERAGE_SWAP_CALM_FRAMES = 2;
/** `{ mode, globe, since, calm, remover }` while a swap is running. */
let _coverageSwap = null;

function cancelCoverageSwap() {
  const swap = _coverageSwap;
  _coverageSwap = null;
  if (!swap) return;
  swap.remover?.();
  _viewer?.imageryLayers?.remove?.(swap.globe, true);
}

/** Whether the incoming layer has everything the view asked of it. */
function coverageSwapSettled(swap) {
  const globe = _viewer?.scene?.globe;
  // A hidden globe (Google 3D) shows nothing to keep up: trade at once.
  if (globe?.show === false) return true;
  if (swap.globe.imageryProvider?.coveragePending?.() > 0) return false;
  return globe?.tilesLoaded !== false;
}

function completeCoverageSwap() {
  const swap = _coverageSwap;
  if (!swap) return;
  _coverageSwap = null;
  swap.remover?.();
  if (_coverageImagery) _viewer?.imageryLayers?.remove?.(_coverageImagery, true);
  swap.globe.alpha = 1;
  _coverageImagery = swap.globe;
  _coverageImageryMode = swap.mode;
  if (_viewshed?.layer) _viewer?.imageryLayers?.raiseToTop?.(_viewshed.layer);
  governorRequestRender('anfr-fr-coverage');
}

function onCoverageSwapFrame() {
  const swap = _coverageSwap;
  if (!swap) return;
  swap.calm = coverageSwapSettled(swap) ? swap.calm + 1 : 0;
  if (swap.calm >= COVERAGE_SWAP_CALM_FRAMES || Date.now() - swap.since > COVERAGE_SWAP_MAX_MS) {
    completeCoverageSwap();
    return;
  }
  // The incoming tiles need frames to be requested and uploaded, and the
  // globe renders on demand: keep asking until the swap is done.
  governorRequestRender('anfr-fr-coverage-swap');
}

function startCoverageSwap(mode) {
  cancelCoverageSwap();
  const globe = coverageLayer(mode, { alpha: 0 });
  _viewer.imageryLayers.add(globe);
  const remover = _viewer.scene?.postRender?.addEventListener?.(onCoverageSwapFrame) || null;
  _coverageSwap = { mode, globe, since: Date.now(), calm: 0, remover };
  governorRequestRender('anfr-fr-coverage-swap');
}

/** Put on the globe and on the mesh the imagery the current mode asks for, or none. */
function syncCoverageImagery() {
  const wanted = _enabled && _coverageMode !== 'off' && _coverageStatus === 'ready' ? _coverageMode : null;
  if (!wanted || !_viewer?.imageryLayers) {
    if (_coverageImagery || _coverageSwap) removeCoverageImagery();
  } else if (_coverageSwap) {
    // A press during a swap: aim the swap at the latest mode, or drop it if
    // the reader came back to the mode on screen.
    if (_coverageSwap.mode !== wanted) {
      if (wanted === _coverageImageryMode) cancelCoverageSwap();
      else startCoverageSwap(wanted);
    }
  } else if (_coverageImageryMode !== wanted) {
    if (_coverageImagery) {
      startCoverageSwap(wanted);
    } else {
      // Nothing on screen yet: nothing to keep up while the tiles arrive.
      _coverageImagery = coverageLayer(wanted);
      _viewer.imageryLayers.add(_coverageImagery);
      _coverageImageryMode = wanted;
      // The selected mast's line of sight stays ABOVE the coverage: it is the
      // one mark on the ground that belongs to the selection.
      if (_viewshed?.layer) _viewer.imageryLayers.raiseToTop?.(_viewshed.layer);
    }
  }
  syncCoverageDrape(wanted && _viewer?.imageryLayers ? wanted : null);
  governorRequestRender('anfr-fr-coverage');
}

/** The mesh is bought on the first switch to Google 3D, long after `enable`. */
function onMapStackChanged(event) {
  if (event?.detail?.status === 'switching') return;
  syncCoverageImagery();
}

async function applyCoverage() {
  // With the meta in hand the swap is synchronous: a chip press repaints in
  // the same frame instead of one microtask later.
  if (_enabled && _coverageMode !== 'off' && !_coverageMeta) await ensureCoverageMeta();
  syncCoverageImagery();
  // A card read in the previous mode is still true — the code under a point
  // does not depend on the mode — but a card with the coverage OFF is not.
  if (_coverageMode === 'off' && _coverageCard) clearSelection();
}

function publishCoverageCard() {
  // The card with an answer: a card is only shown once there is something to
  // say, and the previous one stays until then (see `openCoverageCard`).
  const card = _coverageCardShown;
  if (!card?.text) return;
  // The tag alone while the key prints the table — see the section above
  // `keyCarriesSelection`.
  _publishedTagOnly = keyCarriesSelection();
  const copy = _publishedTagOnly ? coverageMessages().panel.tag : card.text;
  _overlayHost.setEntries(
    ANFR_FR_OVERLAY_SOURCE_ID,
    [selectedOverlayEntry(COVERAGE_CARD_ID, card.position, copy)],
    ANFR_FR_OVERLAY_SOURCE_OPTIONS,
  );
}

/**
 * Open the "who reaches here" card at a clicked ground point.
 *
 * Answers only with the coverage on and its meta in hand; otherwise returns
 * false and the click falls through to a dismissal, as before.
 *
 * THE CARD APPEARS WITH ITS ANSWER. It used to appear at once as « Réseau 4G
 * ici / Chargement… » and be rewritten 20–200 ms later: a two-line card, then
 * a six-line one standing somewhere else, which the reader saw as the card
 * vanishing and coming back. The answer is usually there well inside
 * {@link LOADING_CARD_DELAY_MS}, so the loading card is kept for the slow
 * read only. For the same reason a card already open stays on screen until
 * the next one's answer replaces it, instead of being cleared first.
 * @returns {boolean} Whether the click was taken.
 */
function openCoverageCard(viewer, windowPosition) {
  if (!_enabled || _coverageMode === 'off' || _coverageStatus !== 'ready' || !_coverageRead) return false;
  const point = sceneGroundPoint(viewer, windowPosition);
  if (!point) return false;
  if (_selectedId) clearSelection();
  _coverageCardGeneration += 1;
  _keyCarriesAt = -Infinity;
  watchKeyVisibility();
  const generation = _coverageCardGeneration;
  const m = coverageMessages();
  // The picked surface's own height: on Google 3D the globe is hidden and
  // `getHeight` answers nothing, which would sink the card to sea level —
  // 2 km under the Mont-Blanc dead zones it is opened on.
  let height = point.height;
  if (!Number.isFinite(height)) {
    try {
      height = viewer?.scene?.globe?.getHeight?.(Cesium.Cartographic.fromDegrees(point.lon, point.lat));
    } catch { /* no terrain resident here */ }
  }
  if (!Number.isFinite(height)) height = 0;
  const card = {
    lon: point.lon,
    lat: point.lat,
    height,
    position: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, height + POINT_LIFT_M),
    text: null,
    // What the key's card is built from (`coverageSelectionPanel`).
    reading: null,
    failed: false,
  };
  _coverageCard = card;
  const show = (text, reading = null, failed = false) => {
    if (generation !== _coverageCardGeneration || _coverageCard !== card) return;
    card.text = text;
    card.reading = reading;
    card.failed = failed;
    // The key follows the globe: the previous card stays in both until this
    // one has something to say.
    _coverageCardShown = card;
    publishCoverageCard();
    governorRequestRender('anfr-fr-coverage-card');
    announceSelectionChanged();
  };
  let answered = false;
  const slow = setTimeout(() => {
    if (!answered) show(`${m.card.readingTitle}\n${m.card.reading}`);
  }, LOADING_CARD_DELAY_MS);
  _coverageRead(point.lon, point.lat)
    .then((reading) => ({ text: coverageCardText(_coverageMeta, reading), reading: reading || { inside: false } }))
    .catch(() => ({ text: `${m.card.readingTitle}\n${m.card.failed}`, reading: null, failed: true }))
    .then(({ text, reading, failed }) => {
      answered = true;
      clearTimeout(slow);
      show(text, reading, failed);
    });
  return true;
}

/**
 * The coverage as its OWN block of the map key: « Couverture 4G », its mode
 * control, its classes and whose estimate they are.
 *
 * It used to be five chips on the row — « Zones blanches » and one per
 * operator — and five more lines at the foot of the antenna colours. The
 * approved mock of 2026-09-22 keys it apart: two segments, « Sans 4G » and
 * « Par opérateur », and the four operators on a second strip once the second
 * is lit.
 *
 * Since lot 3 of that mock the coverage is switched by its own tile, « Couverture
 * 4G », so the block is there while the coverage is and the segments only
 * choose what it paints: neither a lit mode nor the lit operator is pressable,
 * since pressing it would change nothing. A mode a share link asked for keeps
 * its block on a server without the map, unlit, with the reason on it, rather
 * than vanishing with no word.
 * @returns {?object} A `legendBlocks` entry, or null.
 */
function coverageKeyBlock() {
  if (_coverageMode === 'off') return null;
  const m = coverageMessages().block;
  const on = _coverageMode !== 'off';
  const loading = on && _coverageStatus === 'loading';
  const failed = on && (_coverageStatus === 'failed' || _coverageStatus === 'missing');
  const failure = _coverageStatus === 'missing' ? m.missing : m.failed;
  const operatorMode = COVERAGE_OPERATORS.some((op) => op.id === _coverageMode);
  const modeSegment = (key, label, active, title, value) => {
    let segmentTitle = title;
    if (active && loading) segmentTitle = m.loading;
    else if (active && failed) segmentTitle = failure;
    return {
      key,
      label,
      active: active && !failed,
      busy: active && loading,
      title: segmentTitle,
      // A lit segment sends its own mode again: nothing changes, but it stays
      // a control, so the keyboard focus a press left on it is not dropped
      // when the key repaints — and a mode that failed to load is retried.
      toggle: { param: 'coverage', value: active ? _coverageMode : value },
    };
  };
  const block = {
    key: 'coverage',
    title: m.title,
    legend: coverageLegendEntries(),
    legendSegmentsLabel: m.segmentsLabel,
    legendSegments: [
      modeSegment('gaps', m.gaps, _coverageMode === 'gaps', m.gapsTitle, 'gaps'),
      modeSegment('operator', m.byOperator, operatorMode, m.byOperatorTitle, _coverageLastOperator),
    ],
    legendSubSegments: operatorMode
      ? COVERAGE_OPERATORS.map((op) => {
        const active = op.id === _coverageMode;
        return {
          key: op.id,
          label: op.short,
          active: active && !failed,
          title: m.operatorTitle(op.name),
          toggle: active ? null : { param: 'coverage', value: op.id },
        };
      })
      : [],
  };
  // E1: the coverage runs on the ARCEP's quarterly clock, not on the
  // observatoire's weekly one, and says so under its own classes.
  if (failed) block.note = failure;
  else if (block.legend.length) {
    const legend = coverageMessages().legend;
    block.note = `${legend.source(coverageMonthLabel(_coverageMeta?.quarterEnd))} ${legend.note}`;
  }
  return block;
}

/** The coverage block of the key, or nothing while the coverage is off. */
function coverageLegendEntries() {
  if (_coverageMode === 'off' || _coverageStatus !== 'ready') return [];
  return coverageLegend(_coverageMeta, _coverageMode);
}

// --- Layer ------------------------------------------------------------------

const anfrFranceLayer = {
  id: ANFR_FR_LAYER_ID,
  // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
  name: 'Antennes mobiles (ANFR)',
  // NOT the ≋ the RÉSEAUX & CAPTEURS group uses, and pointedly not anything the
  // `radio` row could be confused with: that layer is audio streams and this
  // one is the masts. 📡 is the transmitting dish, unused elsewhere on the globe.
  icon: '📡',
  source: 'Observatoire des réseaux mobiles — ANFR · couverture 4G — ARCEP',
  // i18n-ignore-end
  updateInterval: POLL_INTERVAL_MS,

  init(viewer) {
    _viewer = viewer;
    _points = new Cesium.BillboardCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT });
    _points.show = false;
    viewer.scene.primitives.add(_points);
    // NOT registered with the sprite order, and the reason is the same one
    // `irve-fr` gives for its beams: that registry arbitrates near-plane
    // clamped sprites, and a shaft is depth-bearing geometry that has to sort
    // against the world — against the terrain and the buildings — rather than
    // against other sprites. See the occlusion note in the module header.
    //
    // A collection OF collections, one per appearance (see `reconcileMasts`).
    _masts = new Cesium.PrimitiveCollection();
    _masts.show = false;
    viewer.scene.primitives.add(_masts);
    _mastBands = new Map();
    _mastLines = new Map();
    _sectors = new Cesium.PolylineCollection();
    _sectors.show = false;
    viewer.scene.primitives.add(_sectors);
    // The two other classes of marks (see `_points`): the maillage's dots and
    // the supports the maillage also draws.
    _meshPoints = new Cesium.BillboardCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT });
    _meshPoints.show = false;
    viewer.scene.primitives.add(_meshPoints);
    _sharedPoints = new Cesium.BillboardCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT });
    _sharedPoints.show = false;
    viewer.scene.primitives.add(_sharedPoints);
    // Bottom to top: the maillage's dots, the supports, then the supports the
    // maillage also draws — so a shared triangle sits on the dot fading under it.
    registerSpriteCollection(ANFR_FR_LAYER_ID, _meshPoints);
    registerSpriteCollection(ANFR_FR_LAYER_ID, _points);
    registerSpriteCollection(ANFR_FR_LAYER_ID, _sharedPoints);

    _enabled = false;
    clearLevelRecords();
    _plan = null;
    _selectedId = null;
    _count = 0;
    _inView = 0;
    _lastUpdate = null;
    _loading = false;
    _error = null;
    _status = 'idle';
    _regime = 'maillage';
    _mastRegime = false;
    _mastsDrawn = 0;
    _mastsUnpublished = 0;
    _mastsClipped = 0;
    _sectorsDrawn = 0;
    _meshPick = null;

    _overlayHost.setVisible(ANFR_FR_OVERLAY_SOURCE_ID, false);
    restoreSpriteOrder(viewer);
    console.log('[Data:ANFR FR] Initialized');
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    _mastsShown = anfrMastsShownOnEnable(_mastsShown, _coverageMode);
    // Which class of marks is shown, and at what weight, is the frame
    // callback's call ({@link onFadeFrame}).
    _fade = watchZoomFade(viewer, ANFR_FR_LAYER_ID, onFadeFrame);
    // The shafts and rays stay hidden until a reconcile decides they belong on
    // screen — the camera may well be over the Atlantic when the row is ticked.
    _overlayHost.setVisible(ANFR_FR_OVERLAY_SOURCE_ID, true);
    installClickHandler(viewer);
    registerPickOwner(ANFR_FR_LAYER_ID, (pickedId) => _records.has(pickedId));
    if (!_cameraChangedAttached) {
      viewer.camera.changed.addEventListener(onCameraChanged);
      claimCameraSensitivity(viewer, ANFR_FR_LAYER_ID);
      // Arrival, as opposed to motion — see `onCameraSettled`.
      watchCameraSettle(viewer, ANFR_FR_LAYER_ID, onCameraSettled);
      _cameraChangedAttached = true;
    }
    // No per-frame hook for the selected card: the overlay host projects every
    // entry's world position itself on each frame. Republishing it from
    // `preRender` asked the host for another frame each time, which kept the
    // globe rendering at ~50 frames a second for as long as a card was open.
    restoreSpriteOrder(viewer);
    // DataLayerManager calls update() immediately after enable(), which owns
    // the first fetch. Avoid racing it with a second request here.
    // The coverage meta is a separate, small question — does this server have
    // the pyramid at all? — and its answer is what makes the chips appear.
    void ensureCoverageMeta().then(() => applyCoverage());
    if (!_mapStackListener && typeof window !== 'undefined') {
      _mapStackListener = onMapStackChanged;
      window.addEventListener('gev:map-stack-changed', _mapStackListener);
    }
  },

  disable(viewer) {
    _enabled = false;
    _fade?.release();
    _fade = null;
    _requestGeneration += 1;
    _regime = 'maillage';
    _plan = null;
    _mastRegime = false;
    clearTimeout(_cameraDebounceTimer);
    _cameraDebounceTimer = null;
    clearSelection();
    // The imagery goes; the MODE stays, so switching the row back on paints
    // the same coverage the reader left.
    removeCoverageImagery();
    if (_mapStackListener && typeof window !== 'undefined') {
      window.removeEventListener('gev:map-stack-changed', _mapStackListener);
      _mapStackListener = null;
    }
    _points?.removeAll();
    _meshPoints?.removeAll();
    _sharedPoints?.removeAll();
    clearMastField();
    _sectors?.removeAll();
    clearLevelRecords();
    _pack = null;
    _packBoxKey = null;
    _count = 0;
    _inView = 0;
    _mastsDrawn = 0;
    _mastsUnpublished = 0;
    _mastsClipped = 0;
    _sectorsDrawn = 0;
    _overlayHost.setVisible(ANFR_FR_OVERLAY_SOURCE_ID, false);
    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
    if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeyDown);
    unregisterPickOwner(ANFR_FR_LAYER_ID);
    if (_cameraChangedAttached && viewer) {
      viewer.camera.changed.removeEventListener(onCameraChanged);
      releaseCameraSensitivity(viewer, ANFR_FR_LAYER_ID);
      releaseCameraSettle(viewer, ANFR_FR_LAYER_ID);
      _cameraChangedAttached = false;
    }
    for (const marks of [_points, _meshPoints, _sharedPoints]) {
      if (marks) marks.show = false;
    }
    if (_masts) _masts.show = false;
    if (_sectors) _sectors.show = false;
    _loading = false;
    _status = 'idle';
  },

  async update() {
    if (!_enabled) return true;
    await loadViewport({ force: true });
    return true;
  },

  getDetectableObjects(options = {}) {
    return collectDetectableObjects(options);
  },

  getStats() {
    const national = nationalSummary();
    const stats = {
      count: _count,
      lastUpdate: _lastUpdate,
      loading: _loading,
      status: _status === 'ready' ? 'ok' : _status,
      regime: _regime,
      supportsInView: _inView,
      // The world-space channel, and everything it had to refuse.
      mastRegime: _mastRegime,
      masts: _mastsDrawn,
      mastsUnpublished: _mastsUnpublished,
      mastsClipped: _mastsClipped,
      sectors: _sectorsDrawn,
      // Whether the masts are drawn at all (the « Antennes » tile).
      mastsShown: _mastsShown,
      // The layer's own honesty numbers, surfaced rather than buried.
      supportsNational: national?.count ?? null,
      projectOnly: national?.projectOnly ?? null,
      plannedUpgrades: national?.plannedUpgrades ?? null,
      edition: activePayload()?.edition ?? null,
      coverage: {
        mode: _coverageMode,
        status: _coverageStatus,
        edition: _coverageMeta?.edition ?? null,
        drawn: Boolean(_coverageImagery),
        // On Google's mesh as well — see `syncCoverageDrape`.
        draped: Boolean(_coverageDrape),
        // 'worker' or 'inline': where the tiles are decoded (mobileCoverageTiles.js).
        decoder: _coverageImagery ? coverageTileSource().backend : null,
        // The open ground card, for the QA harness and the voice layer: what
        // the reader is reading, and where.
        card: _coverageCard
          ? { lon: _coverageCard.lon, lat: _coverageCard.lat, height: _coverageCard.height, text: _coverageCard.text }
          : null,
      },
      viewshed: _viewshed
        ? {
          id: _viewshed.recordId,
          status: _viewshed.status,
          radiusM: _viewshed.radiusM ?? null,
          share: _viewshed.share ?? null,
          drawn: Boolean(_viewshed.layer),
        }
        : null,
    };
    if (activePayload()?.stale) stats.stale = true;
    const label = buildAnfrLoadingLabel();
    if (label) stats.loadingLabel = label;
    if (_error) stats.error = _error;
    return stats;
  },

  /** Register provenance for the attribution popover and analyst surfaces. */
  getViewportSummary() {
    const payload = activePayload();
    if (!payload) return null;
    const { mesh, supports, ...summary } = payload;
    return {
      ...summary,
      regime: _regime,
      mastRegime: _mastRegime,
      masts: _mastsDrawn,
      mastsUnpublished: _mastsUnpublished,
      drawn: _count,
      inView: _inView,
      thinned: Boolean(_regime === 'maillage' && _meshPick?.thinned),
    };
  },

  /**
   * Colour legend for the control-panel row — whichever scale is on screen.
   *
   * Counted over the RECORDS, which is what is actually drawn, and ordered
   * newest-generation-first because that is the order the map is read in. The
   * `projet` row is kept even at zero: "a hollow ring means nothing transmits
   * here" is the entry a reader has to be given.
   *
   * ONE SENTENCE PER ROW. The bands carry the colour channel and say what the
   * colour means; `anfrMastLegend` adds only the marks that are ABSENT. Typical
   * on-screen key over a French city: 5G, 4G, `projet`, and a `Sans mât` row
   * when there is one — four lines where this used to print nine.
   */
  getRowControls() {
    // No chip: the row is a tile in the key (`tiles` in layerFusions.js), and
    // the coverage switches are segments of its own block there.
    const legend = [];
    if (_records.size) {
      const tally = new Map();
      // The level that owns the key is the one it counts: inside the band the
      // other is fading, and a mast drawn by both would be counted twice.
      for (const record of dominantRecords().values()) {
        const band = record.style?.band;
        if (band) tally.set(band, (tally.get(band) || 0) + 1);
      }
      legend.push(...[...ANFR_BANDS].reverse()
        .filter((band) => tally.get(band) > 0 || band === 'projet')
        .map((band) => ({
          label: anfrBandLabelFor(band),
          color: anfrBandColor(band),
          count: tally.get(band) || 0,
          // The swatch is the map's own triangle in the band's colour, hollow
          // where nothing radiates: the silhouette rides in the colour row
          // (`glyph`, masked by manager.js), it is not a second list.
          glyph: band === 'projet' ? ANFR_HOLLOW_TRIANGLE_LEGEND_GLYPH : ANFR_TRIANGLE_LEGEND_GLYPH,
        })));
      legend.push(...anfrMastLegend());
    }
    if (_viewshed?.status === 'ready') {
      const m = messages().viewshed.legend;
      legend.push({ label: m.label, color: VIEWSHED_COLOR, blurb: m.blurb });
    }
    const controls = { chips: [], legend };
    // The selected antenna's card, under the classes it is read against —
    // see the section above `keyCarriesSelection`.
    const selected = _selectedId ? _records.get(_selectedId) : null;
    if (selected) controls.legendSelection = anfrSelectionPanel(selected, activePayload(), _viewshed);
    const coverage = coverageKeyBlock();
    if (coverage) {
      if (_coverageCardShown) coverage.legendSelection = coverageSelectionPanel(_coverageCardShown);
      controls.legendBlocks = [coverage];
    }
    return controls;
  },

  /**
   * Why the key's tile for one part of this layer cannot draw here, or null —
   * the coverage on a server without the map, or whose map failed to load.
   * Read by the manager for the « Couverture 4G » tile.
   * @param {string} part `masts` or `coverage`.
   * @returns {?string}
   */
  tilePartNotice(part) {
    if (part !== 'coverage') return null;
    if (_coverageStatus === 'missing') return coverageMessages().block.missing;
    if (_coverageStatus === 'failed') return coverageMessages().block.failed;
    return null;
  },

  /**
   * The key's close on either card: the same dismissal as Escape, or as a
   * click on empty ground.
   * @returns {boolean} Whether there was a card to close.
   */
  clearSelectedCard() {
    if (!_selectedId && !_coverageCard) return false;
    clearSelection();
    return true;
  },

  /**
   * `{ coverage, masts }` — which coverage the ground is painted with, and
   * whether the masts are drawn over it.
   *
   * Serialized in the share link, because it is not a preference but what the
   * map says: the same masts over a painted Orange gap and over the dead zones
   * are two different arguments, and the dead zones with no mast on them are a
   * third. Accepted before the module is enabled (a link restores params
   * first) and applied on `enable`. A `masts` that is not a boolean is refused.
   * @returns {boolean}
   */
  setParams(params = {}) {
    // The same mode again retries a map that failed to load, and does nothing else.
    if (params.coverage !== undefined && normalizeCoverageMode(params.coverage) === _coverageMode
        && _coverageMode !== 'off' && _coverageStatus === 'failed') {
      void applyCoverage();
    }
    if (params.masts !== undefined) {
      const masts = normalizeMastsParam(params.masts);
      if (masts === null) return false;
      if (masts !== _mastsShown) {
        _mastsShown = masts;
        if (!_enabled) {
          // Applied on `enable`.
        } else if (masts) {
          void loadViewport({ force: true });
        } else {
          dropMasts();
        }
      }
    }
    if (params.coverage === undefined) return true;
    const next = normalizeCoverageMode(params.coverage);
    if (next === _coverageMode) return true;
    _coverageMode = next;
    if (COVERAGE_OPERATORS.some((op) => op.id === next)) _coverageLastOperator = next;
    void applyCoverage();
    governorRequestRender('anfr-fr-coverage-mode');
    return true;
  },

  getParams() {
    return { coverage: _coverageMode, masts: _mastsShown };
  },

  destroy(viewer) {
    if (_enabled) this.disable(viewer);
    else {
      clearSelection();
      _overlayHost.setVisible(ANFR_FR_OVERLAY_SOURCE_ID, false);
      if (_clickHandler) {
        _clickHandler.destroy();
        _clickHandler = null;
      }
      if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeyDown);
      unregisterPickOwner(ANFR_FR_LAYER_ID);
    }
    for (const marks of [_points, _meshPoints, _sharedPoints]) {
      if (!marks) continue;
      unregisterSpriteCollection(ANFR_FR_LAYER_ID, marks);
      viewer?.scene?.primitives?.remove?.(marks);
    }
    _points = null;
    _meshPoints = null;
    _sharedPoints = null;
    if (_masts) {
      viewer?.scene?.primitives?.remove?.(_masts);
      _masts = null;
    }
    if (_sectors) {
      viewer?.scene?.primitives?.remove?.(_sectors);
      _sectors = null;
    }
    removeCoverageImagery();
    removeViewshed();
    // Nothing to clear for the materials any more: each one belongs to the
    // polyline that wears it, so `primitives.remove` above destroys them with
    // their collection — exactly once each — and a second `init()` on a new
    // viewer starts from an empty pool rather than from objects built against
    // the old context.
    clearLevelRecords();
    _mesh = null;
    _pack = null;
    _packBoxKey = null;
    _supportCells.clear();
    _meshLookups.clear();
    _details.clear();
    _viewer = null;
  },
};

// --- Test seams -------------------------------------------------------------

/**
 * Seed rendered records so selection, card, legend, DETECT and stats paths run
 * against the production code with no WebGL and no network.
 *
 * `supports` and `mesh` are the two payload shapes the proxy serves; passing
 * either builds the records exactly as `reconcileSupports` / `reconcileMesh`
 * would, minus the primitives.
 */
export function _setAnfrStateForTest({
  viewer, overlayHost, http, mesh = null, pack = null, meshPick = null,
  regime = pack ? 'supports' : 'maillage', enabled = true, details = null, lookups = null,
  mastRegime = false, mastsShown = true,
} = {}) {
  _viewer = viewer || null;
  _mastsShown = mastsShown;
  _overlayHost = overlayHost || DEFAULT_OVERLAY_HOST;
  _http = http || DEFAULT_HTTP;
  _supportCells.clear();
  _mesh = mesh;
  _pack = pack;
  _packBoxKey = pack ? 'test' : null;
  _meshPick = meshPick;
  _regime = regime;
  _mastRegime = Boolean(mastRegime) && regime === 'supports';
  _mastsDrawn = 0;
  _mastsUnpublished = 0;
  _mastsClipped = 0;
  _sectorsDrawn = 0;
  _enabled = enabled;
  _selectedId = null;
  _loading = false;
  _error = null;
  _status = 'ready';
  clearLevelRecords();
  _plan = null;
  _meshLookups.clear();
  _details.clear();
  for (const [key, value] of details || []) _details.set(key, value);
  for (const [key, value] of lookups || []) _meshLookups.set(key, value);

  if (regime === 'supports') {
    _supportsDrawn = true;
    for (const support of pack?.supports || []) {
      const id = anfrSupportId(support.id);
      const heightM = anfrMastHeightM(support);
      _supportRecords.set(id, {
        id,
        mesh: false,
        cls: 'supports',
        support,
        coSited: 0,
        detail: _details.get(support.id) || null,
        detailPending: false,
        detailError: null,
        point: null,
        position: Cesium.Cartesian3.fromDegrees(
          support.lon, support.lat, POINT_LIFT_M + (heightM || 0),
        ),
        groundPosition: Cesium.Cartesian3.fromDegrees(support.lon, support.lat, POINT_LIFT_M),
        mastHeightM: heightM,
        style: anfrSupportStyle(support),
      });
    }
  } else {
    _meshDrawn = Boolean(meshPick || mesh);
    for (const tuple of meshPick?.picked || mesh?.mesh || []) {
      const id = anfrMeshRecordId(tuple);
      const known = _meshLookups.get(id);
      const support = Array.isArray(known) && known.length ? known[0] : null;
      _meshRecords.set(id, {
        id,
        mesh: true,
        cls: 'mesh',
        tuple,
        support,
        coSited: Array.isArray(known) ? Math.max(0, known.length - 1) : 0,
        lookupEmpty: known === null,
        lookupPending: false,
        lookupError: null,
        detail: support ? _details.get(support.id) || null : null,
        detailPending: false,
        detailError: null,
        point: null,
        position: Cesium.Cartesian3.fromDegrees(tuple[MESH_LON], tuple[MESH_LAT], POINT_LIFT_M),
        style: anfrMeshStyle(tuple),
      });
    }
  }
  syncRecords();
  _count = _records.size;
  _inView = meshPick?.inBox ?? Number(pack?.inBox) ?? _count;
  // Counts the shafts the same production walk would, so the row label and the
  // legend a test reads are the ones the drawn map would publish.
  reconcileMasts();
}

/** Exercise the production selection path in focused runtime tests. */
export function _selectAnfrForTest(id) {
  selectSupport(id);
}

/**
 * Drive the real viewport load — regime choice, fetch, reconcile, degradation.
 *
 * The seam takes the whole path rather than one leg of it, because the bugs
 * this layer can have are handovers: a regime that asks for a box the proxy
 * refuses, a failed refresh that blanks a drawn map, a mesh payload adopted in
 * the exact regime. None of those is visible from a unit-tested leg.
 */
export async function _loadAnfrViewportForTest(viewer, options = {}) {
  _viewer = viewer || _viewer;
  _enabled = true;
  await loadViewport(options);
  return { regime: _regime, count: _count, inView: _inView, status: _status, error: _error };
}

/**
 * One production frame of the hand-overs, against a camera of this larger
 * span: what the frame callback writes and drops, without a render loop.
 */
export function _anfrFadeFrameForTest(span, nowMs = 0) {
  onFadeFrame({ latSpan: span, lonSpan: span }, nowMs);
  return { meshDrawn: _meshDrawn, supportsDrawn: _supportsDrawn, shaftsShown: Boolean(_masts?.show) };
}

/** The city view's cells, as if the six-hour poll had come round: the next load asks again. */
export function _expireAnfrSupportCellsForTest() {
  _supportCells.expire();
}

/** Exercise the production clear path and restore the production seams. */
export function _clearAnfrSelectionForTest() {
  clearSelection();
  _overlayHost = DEFAULT_OVERLAY_HOST;
  _http = DEFAULT_HTTP;
  _supportCells.clear();
  _mesh = null;
  _pack = null;
  _packBoxKey = null;
  _meshPick = null;
  clearLevelRecords();
  _plan = null;
  _meshLookups.clear();
  _details.clear();
  _regime = 'maillage';
  _mastRegime = false;
  _enabled = false;
  _count = 0;
  _inView = 0;
  clearSectors();
  reconcileMasts();
  _status = 'idle';
}

/** @returns {?string} */
export function _anfrSelectedIdForTest() {
  return _selectedId;
}

/** The live record for one id, for tests that assert on the resolved card. */
export function _anfrRecordForTest(id) {
  return _records.get(id) || null;
}

/** Row-control legend, for tests that do not construct a viewer. */
export function _anfrRowControlsForTest() {
  return anfrFranceLayer.getRowControls();
}

/** Stats, for tests that do not construct a viewer. */
export function _anfrStatsForTest() {
  return anfrFranceLayer.getStats();
}

/** The shaft/ray tallies the drawing produced, for tests. */
export function _anfrMastTallyForTest() {
  return {
    mastRegime: _mastRegime,
    masts: _mastsDrawn,
    unpublished: _mastsUnpublished,
    clipped: _mastsClipped,
    sectors: _sectorsDrawn,
  };
}

/** Detection candidates, for tests that do not construct a viewer. */
export function _anfrDetectablesForTest(options = {}) {
  return collectDetectableObjects(options);
}

export default anfrFranceLayer;

/**
 * Put the coverage in a known state for a test: a mode, a meta (or none), and
 * the HTTP seam the point reader will use. Resets the card and the imagery.
 */
export function _setAnfrCoverageForTest({
  viewer = _viewer, mode = 'off', meta = null, status = meta ? 'ready' : 'idle', http = _http, enabled = _enabled,
  read = null, overlayHost = _overlayHost,
} = {}) {
  removeCoverageImagery();
  _viewer = viewer;
  _http = http;
  _overlayHost = overlayHost;
  _enabled = enabled;
  _coverageMode = normalizeCoverageMode(mode);
  _coverageLastOperator = COVERAGE_OPERATORS.some((op) => op.id === _coverageMode) ? _coverageMode : 'orange';
  _coverageMeta = meta;
  _coverageStatus = status;
  _coverageError = null;
  _coverageMetaPromise = null;
  _coverageCard = null;
  _coverageCardShown = null;
  _coverageCardGeneration += 1;
  _coverageRead = read || (meta ? createCoveragePointReader(meta) : null);
  syncCoverageImagery();
}

/** Drive the `gev:map-stack-changed` listener the row attaches in `enable`. */
export function _anfrMapStackChangedForTest(detail) {
  onMapStackChanged({ detail });
}

/** Drive the production ground-click path of the coverage card. */
export function _openAnfrCoverageCardForTest(viewer, windowPosition) {
  return openCoverageCard(viewer, windowPosition);
}

/** The coverage card as published, or null. */
export function _anfrCoverageCardForTest() {
  return _coverageCard ? { ..._coverageCard } : null;
}

/** Swap the network-and-canvas half of the line of sight, for tests. */
export function _setAnfrViewshedForTest({ compute = computeMastViewshed, layerFactory = createViewshedImageryLayer } = {}) {
  removeViewshed();
  _viewshedCompute = compute;
  _viewshedLayerFactory = layerFactory;
}

/** The line-of-sight state as kept, without the layer. */
export function _anfrViewshedForTest() {
  if (!_viewshed) return null;
  const { layer, ...rest } = _viewshed;
  return { ...rest, drawn: Boolean(layer) };
}
