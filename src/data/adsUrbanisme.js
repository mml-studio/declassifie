import * as Cesium from 'cesium';
import { createAddressScanLayer, mapKeyCarriesSelection } from './addressScanLayer.js';
import {
  ADS_DEFAULT_MONTHS, ADS_DEFAULT_RADIUS_M, ADS_MAX_MONTHS,
  adsKindLabel, adsPurposeLabel, adsStateLabel,
} from './adsFeed.js';
import { adsLineageBasisLabel } from './cadastreLineage.js';
import { formatNumber } from '../i18n/format.js';
import messages from './adsUrbanisme.i18n.js';
import { clearBuildingTheme, registerBuildingTheme } from './buildingTheme.js';
import { askJoin, watchJoin } from './layerJoins.js';
import {
  PERMIT_BADGE_PX,
  PERMIT_DRAWN_ON_PARCEL_JOIN,
  PERMIT_PROJECT_CLASS_IDS,
  permitBadgeImage,
  permitClassOfAdsPermit,
  permitProjectCard,
  permitProjectColor,
  permitProjectFoldTitle,
  permitProjectLabel,
  permitProjectLegend,
  permitProjectTag,
} from './permitProjects.js';
import permitProjectsMessages from './permitProjects.i18n.js';
// The third urbanism layer takes the second one's surface rule rather than
// writing a third copy of it; `urbanismeGpu.test.mjs` already pins it.
import { gpuClassificationTypeForScene } from './urbanismeGpu.js';

/**
 * Autorisations d'urbanisme — what is about to be built on this block.
 *
 * The other French registers here describe what stands: the cadastre draws the
 * ground, BD TOPO the roofs, DPE their energy, DVF what they last sold for.
 * This one draws what does NOT stand yet — the permits granted, the cranes
 * open, and, in the three métropoles that publish it, the files still being
 * instructed at the counter this week.
 *
 * WHY COLOUR IS THE STATE AND NOT THE SIZE OF THE PROJECT. A permit's size is
 * already legible from the card, and most dossiers on any given block are a
 * new window or a fence. What a reader cannot get anywhere else is WHERE IN
 * THE PIPELINE each one sits — an application under instruction is a thing
 * that can still be objected to, an open chantier is a thing already making
 * noise, and a completed one is history. Those are different facts about the
 * same street and they get the colour channel.
 *
 * THE COLOURS ARE THE ROW'S, NOT THIS LAYER'S (2026-09-23). « Urbanisme »
 * draws its permits with this layer AND `sitadel-fr`, and the two used to wear
 * two palettes that contradicted each other on the same street. Both now take
 * the class and its colour from `permitProjects.js` — the approved mock's
 * palette, which is Sitadel's — and a dossier is a BADGE there, one size for
 * all, rather than a crane sized by its state.
 *
 * WHY SOME DOTS ARE PALE. `instruction` only ever comes from a métropole
 * portal — the national register contains granted permits only, by
 * construction (`adsFeed.js` quotes the SDES dictionary saying so). So outside
 * Paris, Bordeaux and Nantes there are no pale dots, and that is a property of
 * French open data rather than of the block being looked at. The layer says so
 * in its summary rather than letting the absence read as calm.
 *
 * ── The volumes, and the sentence a permit is allowed to say about them ─────
 *
 * `buildingTheme.js` lets one layer at a time repaint the BD TOPO volumes.
 * This one registers at `precedence` 30 and hands over the same colour it has
 * always used — the state of the dossier — so the ramp on the roofs and the
 * ramp on the cranes are the same ramp. Nothing about the colour choice moves.
 *
 * WHAT MOVES IS THE CLAIM, and it is not the same claim as the marker's. A
 * marker says "a dossier exists at this coordinate". Painting a VOLUME says
 * "this dossier is about THIS building" — and for a new build on bare ground
 * that sentence is false twice over: the permit is about a thing that does not
 * exist yet, and there is no volume under it to paint. So the theme is offered
 * only the dossiers that can be about something standing:
 *
 * • **declared works on an existing building** — `adsFeed.js` writes the SDES
 *   vocabulary verbatim into `purpose` (`NATURE_PROJET_DECLAREE`: `1 =
 *   nouvelle construction`, `2 = travaux sur construction existante`), so the
 *   distinction is READ, not guessed;
 * • **a permis de démolir** (`PD`), which by definition names something that
 *   stands;
 * • **a dossier whose nature is not published**, painted, and counted apart.
 *
 * Withheld, counted, and left as a crane only: a declared `nouvelle
 * construction`, and a **permis d'aménager** (`PA`), which authorises the
 * development of LAND and never a building.
 *
 * MEASURED, AND THE REASON THE THIRD BUCKET IS PAINTED AT ALL: this layer
 * merges FOURTEEN sources — the four `SITADEL_FILES`, the five
 * `LOCAL_ADS_PORTALS`, the communes' Cart@DS and Sirap boards, the acts on
 * publication-actes.fr, the PDF lists cities publish and Montpellier
 * Méditerranée Métropole's open data — and exactly TWO of them ask for a
 * nature column.
 * `NATURE_PROJET_DECLAREE` is in the `columns` of `logements` and `locaux` and
 * in neither `amenager` nor `demolir` (both of which the FAMILY rule above
 * settles anyway). The métropole portals ask for none: `normaliseLocalRow`
 * fills `purpose` from the free-text `objet`/`details_du_projet`, and no portal
 * config declares a nature column; the boards post free text too
 * (`normaliseCartdsRow`). Refusing to
 * paint an unpublished nature would therefore switch the theme off entirely in
 * Paris, Bordeaux and Nantes — which are the only three places in France where
 * `instruction` exists at all. The trade taken is the other one: a point that
 * falls INSIDE a surveyed footprint is already evidence that something stands
 * there, the volume is painted, and the count of dossiers painted on that
 * evidence rather than on a declaration is published beside the count painted
 * on a declaration.
 *
 * WHY THE MARKER DOES NOT SHRINK UNDER A THEME. It was the obvious move and it
 * is an A3 violation: marker SIZE is already spoken for — 20 px for a file
 * still open or a chantier running, 17 px granted, 14 px history — and adding
 * "the volume under me is painted" to that channel would put two informations
 * on one variable. The marker is also the click surface and the card, and it
 * has to read the same when Bâti 3D is off. It is left alone.
 *
 * WHY THE UNPAINTED CITY IS NOT AN ADMISSION OF EMPTINESS. This layer scans a
 * DISC of {@link ADS_DEFAULT_RADIUS_M} m (0.50 km²) around the point the camera
 * is looking at. BD TOPO loads a BOX of up to `BDTOPO_MAX_BOX_DEG` = 0.08°,
 * which at 47°N is 8.90 × 6.04 km = 53.8 km² — 107 times the disc. So at most
 * about 1% of the volumes on screen were ever inside the question that was
 * asked, and the other 99% are washed because nobody looked, not because
 * nothing was filed. That is what the theme's "no data" row says, in those
 * words, rather than leaving a grey city to be read as a calm one (A4).
 *
 * WHERE THE `n peints / N connus` LEDGER LIVES. This layer publishes the OFFER
 * side — how many dossiers were handed over, how many were withheld and why,
 * how many carry no usable state — because those are the numbers only it can
 * know. The PAINT side (`themePainted` / `themeUnpainted` / points that landed
 * on no footprint) is published by the Bâti 3D row, which owns the join and
 * runs it against the volumes actually loaded. Running a second join here to
 * repeat those figures would produce two numbers, computed at two instants,
 * for one fact; one number in one place is the honest arrangement.
 *
 * @module data/adsUrbanisme
 */

/** Refresh cadence. Sitadel moves monthly; this is about camera movement. */
const UPDATE_INTERVAL_MS = 600_000;

/**
 * How far back a scan looks, as the four rungs a reader can choose between,
 * shortest first.
 *
 * - **6 mois** is what moved lately: the files still under review, the
 *   decisions whose two-month objection period is open or just closed. The
 *   communes' own boards answer within days; Sitadel runs about six weeks
 *   behind, so its share of this rung is four and a half months, not six.
 * - **1 an** is the last year of a block, one full building season.
 * - **3 ans** is the default and it stays the default. A block's current
 *   pipeline — what is being instructed, what is granted, what has a crane on
 *   it — is a three-year story, and it is the window under which
 *   `ADS_MAX_PERMITS` does not bite in a dense arrondissement.
 * - **13 ans** is the whole of Sitadel — `ADS_MAX_MONTHS`, the register's own
 *   2013 start — for reading a plot's entire paperwork history, FINISHED
 *   houses included: Ustaritz's `06454721B0009` was authorised 2021-07-20 and
 *   read 2026-09, so a 36-month floor of 2023-09-01 hides the permit that
 *   built it. A permit's chantier outlives the window that shows it.
 *
 * A six-year rung sat between the last two until 2026-10-01; the operator
 * traded it for the two short ones, and a link that still carries it opens on
 * the whole register (`layerState.js`).
 *
 * NOT a free number, and `addressScanLayer.js` says why: everything reachable
 * here is reachable from a share link too.
 */
export const ADS_WINDOWS = Object.freeze([
  Object.freeze({ months: '6' }),
  Object.freeze({ months: '12' }),
  Object.freeze({ months: '36' }),
  Object.freeze({ months: String(ADS_MAX_MONTHS) }),
]);

/** The rung a reader who has chosen nothing is on. Unchanged from before. */
export const ADS_WINDOW_DEFAULT = String(ADS_DEFAULT_MONTHS);

/**
 * One chip per window, and what each one warns about. The row no longer draws
 * them; the active one's title is the tooltip of the « Période » menu.
 *
 * THE ACTIVE CHIP CARRIES THE TRUNCATION, because widening the window is the
 * thing that causes it. `ADS_MAX_PERMITS` serves the 400 nearest dossiers, so
 * on a dense block a longer window does not add history — it TRADES the far
 * edge of the circle for it, and the swap is invisible on screen. The scan
 * already reports `found` against `count`; this is where a reader can see it
 * at the moment they are choosing.
 *
 * @param {?string} months The window in force.
 * @param {?object} summary The layer's own `summarize()` output, if any.
 * @returns {Array<object>} Chip descriptors for the manager's row renderer.
 */
export function adsWindowChips(months, summary = null) {
  const m = messages().window;
  const current = String(months ?? ADS_WINDOW_DEFAULT);
  return ADS_WINDOWS.map((window) => {
    const active = window.months === current;
    const months = Number(window.months);
    let title = m.title(months);
    if (active && summary?.truncated) {
      title += m.truncated(summary.permitsFound, summary.permitsInRadius);
    } else if (active && Number.isFinite(summary?.permitsFound)) {
      title += m.counted(summary.permitsFound);
    } else if (window.months === ADS_WINDOW_DEFAULT) {
      title += m.pipeline;
    } else if (months < Number(ADS_WINDOW_DEFAULT)) {
      title += m.latest;
    } else {
      title += m.finished;
    }
    return {
      id: `months:${window.months}`,
      label: m.span(months),
      active,
      state: active ? 'active' : 'idle',
      title,
      params: { months: window.months },
    };
  });
}

/**
 * The period select on the row (« Période »), the same windows as
 * {@link adsWindowChips} in the form the approved mock draws them: one menu
 * under the row's tiles. `fanOut`, because `sitadel-fr` takes the same window
 * and one period for the two permit layers is the only honest reading of one
 * menu.
 *
 * @param {?string} months The window in force.
 * @param {?object} summary The layer's own `summarize()` output, if any.
 * @returns {{param: string, label: string, value: string, fanOut: boolean,
 *   title: string, options: Array<{value: string, label: string}>}}
 */
export function adsPeriodSelect(months, summary = null) {
  const m = messages().period;
  const chips = adsWindowChips(months, summary);
  const active = chips.find((chip) => chip.active) || null;
  return {
    param: 'months',
    label: m.label,
    value: active ? active.params.months : ADS_WINDOW_DEFAULT,
    fanOut: true,
    title: active ? active.title : '',
    options: ADS_WINDOWS.map((window) => ({ value: window.months, label: m.options[window.months] })),
  };
}

/**
 * How much ink one emprise puts on the ground.
 *
 * Lighter than the cadastre's 0.28, and deliberately: the cadastre draws
 * parcels because the parcels ARE the subject, while here the plot is the
 * ground under the news and the badge on top of it is the news. A wash this
 * pale still separates "somebody has filed on this plot" from the block around
 * it at street zoom, without competing with the marker it belongs to.
 */
const EMPRISE_FILL_ALPHA = 0.18;

/** A badge at full size up to 500 m of camera distance, 45 % of it from 8 km. */
const BADGE_SCALE = new Cesium.NearFarScalar(500, 1, 8_000, 0.45);

/** The boundary, which is the part that survives being small. */
const EMPRISE_OUTLINE_ALPHA = 0.85;
const EMPRISE_OUTLINE_WIDTH_PX = 1.4;

/**
 * Which dossier's colour a shared plot wears.
 *
 * A plot is not in a state; the FILES on it are, and 76 of the 252 plots a
 * default Bordeaux scan draws carry more than one — 41 carry two, and one
 * carries nine. So one of them has to speak for the ground, and this is the
 * order it is chosen in.
 *
 * It is NOT the pipeline order, and it must not be read as one. This ranks by
 * what a reader standing on the pavement would want told first: a chantier
 * open right now is the loudest fact about a plot, then a file that can still
 * be objected to, then one granted and waiting, and only then the two kinds of
 * history. A refusal ranks last not because it matters least but because it
 * is the one state that says nothing will happen here.
 */
const EMPRISE_STATE_RANK = Object.freeze({
  commence: 6,
  instruction: 5,
  depose: 4,
  accorde: 3,
  autorise: 3,
  termine: 2,
  refuse: 1,
  annule: 1,
});

/**
 * The class one dossier is shown as, and its colour — see `permitProjects.js`,
 * which the Sitadel parcels ask too.
 *
 * @param {?object} permit Normalised permit from `adsFeed.js`.
 * @returns {{classId: string, color: string}}
 */
export function adsPermitStyle(permit) {
  const classId = permitClassOfAdsPermit(permit);
  return { classId, color: permitProjectColor(classId) };
}

/** `2026-08-31` → `31/08/2026` / `Aug 31, 2026`, per the reader's language. */
function adsDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return match ? messages().date.format(match[1], match[2], match[3]) : null;
}

/**
 * The date line: which date matters depends on where the dossier is.
 *
 * A file under instruction is about when it was DEPOSITED — that is what the
 * two-month objection window runs from. A granted one is about when it was
 * decided. An open chantier is about when the ground was broken. Printing all
 * four dates on every card would bury the one that is the news.
 *
 * @param {object} permit Normalised permit.
 * @returns {?string}
 */
export function adsDateLine(permit) {
  const m = messages().date;
  if (permit.completedOn) return m.completed(adsDate(permit.completedOn));
  if (permit.startedOn) return m.started(adsDate(permit.startedOn));
  if (permit.state === 'instruction' || permit.state === 'depose') {
    return permit.depositedOn ? m.filed(adsDate(permit.depositedOn)) : null;
  }
  if (permit.decidedOn) return m.decided(adsDate(permit.decidedOn));
  // Granted, the day unknown, but published on a day the decision cannot be
  // later than (Montpellier's export: Trap 5 of `mmmPermitsFeed.js`).
  if (permit.state === 'accorde' && permit.postedOn) return m.decidedBy(adsDate(permit.postedOn));
  return permit.depositedOn ? m.filed(adsDate(permit.depositedOn)) : null;
}

/**
 * How well this dot knows where it is.
 *
 * Said out loud on every dot that was not published with a coordinate, because
 * a permit geocoded to the middle of a street looks exactly as certain as one
 * placed on its own doorway, and the difference can be a whole building.
 *
 * @param {object} permit Normalised permit.
 * @returns {?string}
 */
export function adsPrecisionLine(permit) {
  const m = messages().precision;
  if (permit.precision === 'published') return null;
  if (permit.precision === 'housenumber') return null;
  // The dossier named this parcel and the cadastre still has it. The shape
  // under the marker is the claim, and it needs no caveat.
  if (permit.precision === 'parcelle') return null;
  // AN INFERENCE, AND IT SAYS WHICH ONE. The parcel the dossier named has been
  // divided since, and this lot was picked out of the division — by the BAL's
  // own numbering, by being the only one that has been built on since, or by
  // being the only one there is. Which of the three is the difference between
  // a record and a deduction, so the basis is printed rather than averaged
  // into a single confident sentence.
  if (permit.precision === 'enfant') {
    // The basis comes back through `cadastreLineage.js`, which publishes it in
    // both languages; the payload's own `basisLabel` is the server's French.
    const basis = permit.lineage?.basis
      ? adsLineageBasisLabel(permit.lineage.basis)
      : permit.lineage?.basisLabel;
    return basis ? m.deducedLot(basis) : m.deducedLotPlain;
  }
  // No lot could be told from its siblings: two thirds of divisions, measured.
  // The parent is drawn instead, which is a true statement about the ground.
  if (permit.precision === 'mere') {
    const siblings = permit.lineage?.siblings;
    return siblings > 1 ? m.parentWithSiblings(siblings) : m.parent;
  }
  if (permit.precision === 'street') return m.street;
  if (permit.precision === 'locality') return m.locality;
  return null;
}

/**
 * The state a shared plot is drawn in, and the dossier that lends it.
 *
 * @param {Array<object>} permits The dossiers standing on one emprise.
 * @returns {{classId: string, color: string, state: ?string, permit: ?object}}
 */
export function empriseStyle(permits) {
  let bestRank = -1;
  let best = null;
  for (const permit of permits || []) {
    const rank = EMPRISE_STATE_RANK[String(permit.state ?? '')] ?? 0;
    // Strictly greater, so a tie keeps the first — which is the nearest, since
    // `projectAdsPermits` served them sorted by distance. A plot must not
    // change colour because two dossiers on it were re-ordered.
    if (rank > bestRank) { bestRank = rank; best = permit; }
  }
  return { ...adsPermitStyle(best), state: best?.state ?? null, permit: best };
}

/** `['063KE78', '063KE79']` → `parcelles 063KE78, 063KE79`. */
function parcelTitle(parcels) {
  const m = messages().emprise;
  const list = (parcels || []).filter(Boolean);
  if (!list.length) return m.fallbackTitle;
  const shown = list.slice(0, 3).join(', ');
  const rest = list.length - 3;
  const more = rest > 0 ? ` +${rest}` : '';
  return list.length > 1 ? m.manyParcels(shown, more) : m.oneParcel(`${shown}${more}`);
}

/**
 * Who drew this outline, in the words of the register that produced it.
 *
 * THE DEFECT THIS REPLACES, and it was one sentence: every plot card in France
 * ended with « emprise publiée par Bordeaux Métropole ». That line was written
 * when Bordeaux was the only source of a shape here — its portal ships the
 * parcel outline beside the dossier, and no other register in this layer
 * published anything but a coordinate. Then the cadastral placement landed
 * (`adsFeed.js`, {@link placeOnParcels}) and gave the WHOLE COUNTRY an outline:
 * a Sitadel row names up to three parcels, and the parcels are drawable. The
 * credit was never moved. A permit in Ustaritz, drawn on a parcel the Etalab
 * cadastre published, was crediting a métropole 200 km away.
 *
 * So the line is derived from the dossiers standing on the plot rather than
 * asserted. Two provenances exist and they are different claims:
 *
 * • `published` — the counter itself shipped the geometry. That is a fact
 *   about the DOSSIER: this is the ground the file was opened on.
 * • `parcelle` / `mere` / `enfant` — the cadastre's parcel, joined on the
 *   reference the dossier names. That is a fact about the GROUND, and the
 *   dossier's own caveat (a division since, a lot deduced) stays on the
 *   marker's card where {@link adsPrecisionLine} already prints it.
 *
 * A geometry serving both is possible and is named as both, in that order.
 *
 * @param {Array<object>} permits The dossiers standing on one emprise.
 * @returns {?string}
 */
export function empriseProvenanceLine(permits) {
  const portals = new Set();
  let cadastre = false;
  for (const permit of permits || []) {
    if (permit?.precision === 'published') {
      // `Bordeaux Métropole — Dossiers d'autorisation…` and, on a dossier the
      // two registers merged, `… + Sitadel`. The card wants the authority, so
      // it takes the head of the label rather than a second field that could
      // drift away from it.
      const authority = String(permit.sourceLabel ?? '').split('—')[0].trim();
      if (authority) portals.add(authority);
      continue;
    }
    if (permit?.precision === 'parcelle' || permit?.precision === 'mere'
      || permit?.precision === 'enfant') cadastre = true;
  }
  const m = messages().emprise;
  const lines = [];
  for (const authority of portals) lines.push(m.publishedBy(authority));
  // Named as what it is: this shape was not published with the dossier, it is
  // the plot the dossier names, drawn from the cadastre this globe already
  // carries.
  if (cadastre) lines.push(m.fromCadastre);
  return lines.length ? lines.join(' · ') : null;
}

/**
 * The same provenance on a DOSSIER's card, where the parcel is already named.
 *
 * Shorter than the plot's line, and silent on a cadastral parcel that needs no
 * caveat: the card above it already prints « parcelle 064547AN0081 », and
 * {@link adsPrecisionLine} below it prints the deduction whenever the plot was
 * divided. Repeating "cadastre" between the two would be the third copy of one
 * fact. What it still says out loud is the portal case, because a shape the
 * counter shipped with the file is evidence the cadastre join cannot give.
 *
 * @param {object} permit One normalised permit.
 * @returns {?string}
 */
export function adsEmpriseLine(permit) {
  if (!Number.isFinite(permit?.empriseId)) return null;
  if (permit.precision !== 'published') return null;
  const m = messages().emprise;
  const authority = String(permit.sourceLabel ?? '').split('—')[0].trim();
  return authority ? m.publishedBy(authority) : m.publishedWithFile;
}

/**
 * The card a plot opens, which is about the LAND and not about one file.
 *
 * The crane on top already says everything about its own dossier. What only
 * the plot can say is how much ground is involved and how many files are
 * stacked on it — the second being invisible on a map where nine markers sit
 * on one coordinate.
 *
 * @param {object} emprise One entry of `payload.emprises`.
 * @param {Array<object>} permits The dossiers on it.
 * @returns {{name: string, description: string}}
 */
export function empriseCard(emprise, permits) {
  const m = messages().emprise;
  const kinds = new Map();
  for (const permit of permits) {
    // The family LETTER, relabelled here: `kindLabel` is what the server baked
    // into the payload, and the server has no language.
    const label = adsKindLabel(permit.kind) ?? permit.kindLabel;
    kinds.set(label, (kinds.get(label) ?? 0) + 1);
  }
  const tally = [...kinds].map(([label, n]) => (n > 1 ? m.tally(n, label) : label)).join(', ');
  const latest = permits
    .map((permit) => permit.depositedOn)
    .filter(Boolean)
    .sort()
    .pop();
  return {
    name: parcelTitle(emprise.parcels),
    description: [
      permits.length > 1 ? m.files(permits.length) : null,
      // Measured off the outline drawn, not copied from the row — see
      // `liftEmprises`, and the parcel where the two differ by 120×.
      Number.isFinite(emprise.areaM2) && emprise.areaM2 > 0
        ? m.area(formatNumber(emprise.areaM2))
        : null,
      tally || null,
      latest ? m.lastFiling(adsDate(latest)) : null,
      // Said out loud because a shape a layer DREW and a shape a counter
      // PUBLISHED are two different claims about the same ground — see
      // {@link empriseProvenanceLine}, which reads it off the dossiers.
      empriseProvenanceLine(permits),
    ].filter(Boolean).join(' · '),
  };
}

/**
 * Whether the row's Sitadel layer already draws this dossier on its parcel —
 * then this layer lays no second badge and no second wash on the same plot.
 *
 * The two permit layers of « Urbanisme » read the same register; drawn by both,
 * a permit stood twice a few metres apart on one plot. What stays here is what
 * the Sitadel parcels cannot show: the files still at the counter in Paris,
 * Bordeaux and Nantes, the non-residential permits and the permis d'aménager
 * (files that layer does not read), and the permits its cadastral join could
 * not place. The roofs are painted either way: that is this layer's own theme.
 * @param {object} permit Normalised permit, with its `series|number` key.
 * @param {?Set<string>} onParcel From `PERMIT_DRAWN_ON_PARCEL_JOIN`.
 * @returns {boolean}
 */
export function adsDrawnElsewhere(permit, onParcel) {
  return Boolean(onParcel && permit?.key && typeof onParcel.has === 'function' && onParcel.has(permit.key));
}

/**
 * Positions for one ring, closed. Same helper the other two polygon layers
 * keep; three points is the least that encloses anything.
 *
 * @param {Array<number[]>} ring
 * @returns {?Array<object>}
 */
function ringPositions(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  return Cesium.Cartesian3.fromDegreesArray(ring.flat());
}

/**
 * Draw the plots, once each, under the cranes.
 *
 * The fill and the outline are separate entities because a ground-clamped
 * `polygon` cannot draw its own stroke in Cesium — `outline: true` is silently
 * ignored once the polygon is classified onto terrain. Both carry the same
 * name and description, so the edge of a plot opens the same card as its
 * middle rather than a card titled with an entity id.
 *
 * @param {object} dataSource
 * @param {object} payload Server payload.
 * @param {number} classificationType Cesium surface to clamp onto.
 * @param {?Set<string>} [onParcel] Dossiers the Sitadel layer draws already.
 * @returns {number} Emprises drawn.
 */
export function drawAdsEmprises(dataSource, payload, classificationType, onParcel = null) {
  const emprises = payload.emprises || [];
  if (!emprises.length) return 0;
  const byEmprise = new Map();
  for (const permit of payload.permits || []) {
    if (!Number.isFinite(permit.empriseId)) continue;
    // Drawn on its parcel by the Sitadel layer already: that plot is washed
    // there, in the same colour — see {@link adsDrawnElsewhere}.
    if (adsDrawnElsewhere(permit, onParcel)) continue;
    const list = byEmprise.get(permit.empriseId);
    if (list) list.push(permit); else byEmprise.set(permit.empriseId, [permit]);
  }
  let drawn = 0;
  for (const emprise of emprises) {
    const permits = byEmprise.get(emprise.id) || [];
    // An emprise whose every dossier fell outside the served cut is ground
    // with nothing standing on it. Not drawn: a wash with no crane reads as a
    // permit the card cannot open.
    if (!permits.length) continue;
    const style = empriseStyle(permits);
    const card = empriseCard(emprise, permits);
    const fill = Cesium.Color.fromCssColorString(style.color).withAlpha(EMPRISE_FILL_ALPHA);
    const stroke = Cesium.Color.fromCssColorString(style.color).withAlpha(EMPRISE_OUTLINE_ALPHA);
    // The card hangs on a point strictly inside the widest part, computed
    // server-side. A polygon entity has no position of its own, and
    // `cardFromEntity` needs one; giving it this one also means the card is
    // seated on terrain by the same pass that seats the markers.
    const anchor = emprise.anchor
      ? Cesium.Cartesian3.fromDegrees(emprise.anchor.lon, emprise.anchor.lat)
      : null;
    // The anchor goes to the first part actually DRAWN, not to part zero: a
    // part whose outer ring did not survive is skipped, and hanging the card
    // on it would leave the plot on screen with nothing to click.
    let anchored = false;
    for (const [index, rings] of emprise.parts.entries()) {
      const outer = ringPositions(rings[0]);
      if (!outer) continue;
      const holes = [];
      for (let h = 1; h < rings.length; h += 1) {
        const hole = ringPositions(rings[h]);
        // A courtyard is not part of the plot's ground. Filled in, the area on
        // the card stops describing the shape beside it.
        if (hole) holes.push(new Cesium.PolygonHierarchy(hole));
      }
      dataSource.entities.add({
        id: `ads-emprise:${emprise.id}:${index}`,
        // One card per plot, not one per fragment of it.
        position: anchored ? undefined : anchor,
        name: card.name,
        description: card.description,
        properties: {
          kind: 'ads-emprise',
          state: style.state,
          dossiers: permits.map((permit) => permit.dossier).filter(Boolean),
        },
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(outer, holes),
          material: fill,
          classificationType,
          outline: false,
        },
      });
      anchored = true;
      for (const [ringIndex, ring] of rings.entries()) {
        const positions = ringPositions(ring);
        if (!positions) continue;
        dataSource.entities.add({
          id: `ads-emprise:${emprise.id}:${index}:${ringIndex}`,
          name: card.name,
          description: card.description,
          polyline: {
            positions: [...positions, positions[0]],
            width: EMPRISE_OUTLINE_WIDTH_PX,
            material: new Cesium.ColorMaterialProperty(stroke),
            clampToGround: true,
            classificationType,
          },
        });
      }
    }
    drawn += 1;
  }
  return drawn;
}

/* ── The building theme ──────────────────────────────────────────────────── */

/** Registry key. Same string as the layer id, so the two are never out of step. */
export const ADS_BUILDING_THEME_ID = 'ads-fr';

/** Shown to the reader wherever the paint has to name its owner (D1). */
export function adsBuildingThemeLabel() {
  return messages().theme.label;
}

/**
 * Lower wins. 30 puts this ahead of a €/m² or DPE theme on the same volumes:
 * what is ABOUT TO HAPPEN to a building outranks what it is worth or how it is
 * heated, because it is the only one of the three that can still change.
 */
export const ADS_BUILDING_THEME_PRECEDENCE = 30;

/**
 * The label on the "no data" row, and the whole reason it is not just
 * "sans dossier".
 *
 * The scan is a 400 m disc; the volumes are a box up to 53.8 km². A volume can
 * be unpainted because no dossier was filed on it, or because it sits outside
 * the circle this layer asked about — and those are different sentences (A4).
 * The row says both, in that order, because the second is the likelier one.
 */
export function adsBuildingThemeUnknownLabel() {
  return messages().theme.unknown(ADS_DEFAULT_RADIUS_M);
}

/** What a permit can be about. */
export const ADS_TARGET_EXISTING = 'existing';
export const ADS_TARGET_NEW = 'new';
export const ADS_TARGET_UNKNOWN = 'unknown';

/**
 * `NATURE_PROJET_DECLAREE`, as `adsFeed.js` spells it into `purpose`.
 *
 * Read rather than re-derived: the feed owns the dictionary and this file owns
 * the drawing, so the two share a vocabulary and not a copy of the mapping.
 * `adsUrbanisme.test.mjs` pins both strings against `normaliseSitadelRow`, so a
 * wording change upstream fails a test here instead of silently reclassifying
 * every permit in France as "nature not published".
 */
// i18n-ignore-start — the payload's own French values, matched on
const NATURE_EXISTING_TEXT = 'travaux sur construction existante';
const NATURE_NEW_TEXT = 'nouvelle construction';
// i18n-ignore-end

/**
 * Is this dossier about a building that stands, or about ground that does not
 * carry one yet?
 *
 * Three answers and never a guess dressed as two. The declared nature wins when
 * there is one; failing that, the FAMILY of the authorisation settles the two
 * cases where the law already answers — a permis de démolir names something
 * standing, a permis d'aménager authorises the development of land and never a
 * building. Everything else is `unknown`, which is most of the three métropole
 * portals, and `unknown` is a value this module carries around rather than
 * rounding to one of its neighbours.
 *
 * @param {object} permit Normalised permit.
 * @returns {'existing'|'new'|'unknown'}
 */
export function adsPermitTarget(permit) {
  const purpose = String(permit?.purpose ?? '').toLowerCase();
  if (purpose.includes(NATURE_EXISTING_TEXT)) return ADS_TARGET_EXISTING;
  if (purpose.includes(NATURE_NEW_TEXT)) return ADS_TARGET_NEW;
  const kind = String(permit?.kind ?? '');
  if (kind === 'PD') return ADS_TARGET_EXISTING;
  if (kind === 'PA') return ADS_TARGET_NEW;
  return ADS_TARGET_UNKNOWN;
}

/**
 * The colour a volume takes for one class — or null, meaning leave it in the
 * "no data" wash.
 *
 * NULL FOR AN UNPUBLISHED STATE, and that is a departure from the marker on
 * purpose. A badge whose state neither register published is drawn in the pale
 * slate of `permitProjects.js`, because a marker has to exist for every
 * dossier. A VOLUME is a value channel, and a pale grey roof would put "nobody
 * published a decision" beside "the decision was no" on a surface the size of
 * a roof. So the volume is not painted, the dossier keeps its badge, and the
 * row counts it.
 *
 * @param {?string} classId From {@link adsPermitStyle}.
 * @returns {?string} CSS colour, or null.
 */
export function adsBuildingThemeColorFor(classId) {
  const id = String(classId ?? '');
  if (!PERMIT_PROJECT_CLASS_IDS.includes(id) || id === 'unknown') return null;
  return permitProjectColor(id);
}

/**
 * N dossiers on one volume → the one class the volume wears.
 *
 * The SAME rule the plot wash already uses, called through the same function:
 * a volume carrying several dossiers is exactly the shared-plot problem
 * `empriseStyle` was written for, and answering it twice with two rankings
 * would let a roof and the ground under it disagree about their own street.
 *
 * @param {Array<object>} permits Dossiers joined to one volume, nearest first.
 * @returns {?string} class id
 */
export function adsBuildingThemeReduce(permits) {
  const style = empriseStyle(permits);
  return style.permit ? style.classId : null;
}

/**
 * The ramp, one row per colour — every class a roof can wear, which is every
 * class but the unpublished state. Deliberately without counts:
 * `resolveBuildingThemePaint` fills them in from the volumes it really
 * painted, which is the number a reader of the Bâti 3D row needs.
 */
export const ADS_BUILDING_THEME_LEGEND = Object.freeze(
  PERMIT_PROJECT_CLASS_IDS
    .filter((classId) => classId !== 'unknown')
    .map((classId) => Object.freeze({
      key: classId,
      color: permitProjectColor(classId),
      // The French, read off the catalog's definition rather than retyped: the
      // palette guards and the registry's conflict check read this table at
      // load time, and a colour has no language.
      label: permitProjectsMessages.definition.classes[classId].fr,
    })),
);

/** The same ramp in the page's language, one row per colour. */
export function adsBuildingThemeLegend() {
  return ADS_BUILDING_THEME_LEGEND.map((entry) => Object.freeze({
    label: permitProjectLabel(entry.key),
    color: entry.color,
  }));
}

/**
 * Split a served payload into what the theme may paint and what it may not.
 *
 * Every dossier leaves this function in exactly one bucket, and the buckets sum
 * to `total` — that is the A5 ledger, and the test asserts the sum rather than
 * the individual numbers, because a bucket that quietly swallows a dossier is
 * precisely the failure this is here to prevent.
 *
 * Order of refusal matters and is stated: a new build is withheld BEFORE the
 * coordinate and the state are looked at, because "this permit is not about a
 * building that stands" is a fact about the dossier and stays true whatever
 * else is missing from it.
 *
 * @param {?object} payload Served ADS payload.
 * @returns {{points: Array<object>, total: number, offered: number,
 *   offeredDeclared: number, offeredInferred: number, newBuild: number,
 *   land: number, unpublishedState: number, unplaced: number}}
 */
export function adsBuildingThemePoints(payload) {
  const ledger = {
    points: [],
    total: 0,
    offered: 0,
    offeredDeclared: 0,
    offeredInferred: 0,
    newBuild: 0,
    land: 0,
    unpublishedState: 0,
    unplaced: 0,
  };
  for (const permit of payload?.permits || []) {
    ledger.total += 1;
    const target = adsPermitTarget(permit);
    if (target === ADS_TARGET_NEW) {
      if (String(permit?.kind ?? '') === 'PA') ledger.land += 1;
      else ledger.newBuild += 1;
      continue;
    }
    // Zero by construction in a served payload — `projectAdsPermits` drops a
    // row with no coordinate before it applies the radius, and the rows the BAN
    // could not place arrive separately as `unplacedInCommune`. Kept because
    // the guard is one comparison and a payload shape is not a promise.
    if (!Number.isFinite(permit?.lon) || !Number.isFinite(permit?.lat)) {
      ledger.unplaced += 1;
      continue;
    }
    if (!adsBuildingThemeColorFor(adsPermitStyle(permit).classId)) {
      ledger.unpublishedState += 1;
      continue;
    }
    ledger.points.push(permit);
    ledger.offered += 1;
    if (target === ADS_TARGET_EXISTING) ledger.offeredDeclared += 1;
    else ledger.offeredInferred += 1;
  }
  return ledger;
}

/** The ledger of the last payload handed to the registry, or null. */
let _themeLedger = null;

/**
 * Publish (or re-publish) the theme from the payload that was just drawn.
 *
 * Re-registering the same id is the data-changed signal: the registry keeps the
 * theme's original sequence number and fires its `update` notification, which is
 * the subscription `bdtopoBuildings.js` installs in `init()`. Calling
 * `applyBuildingTheme()` on top of that would run the join twice for one change.
 *
 * @param {?object} payload
 * @returns {object} the ledger.
 */
export function syncAdsBuildingTheme(payload) {
  const ledger = adsBuildingThemePoints(payload);
  _themeLedger = ledger;
  registerBuildingTheme({
    id: ADS_BUILDING_THEME_ID,
    label: adsBuildingThemeLabel(),
    precedence: ADS_BUILDING_THEME_PRECEDENCE,
    points: ledger.points,
    reduce: adsBuildingThemeReduce,
    colorFor: adsBuildingThemeColorFor,
    legend: adsBuildingThemeLegend(),
    unknownLabel: adsBuildingThemeUnknownLabel(),
  });
  return ledger;
}

/** Withdraw the theme — the layer is going off. */
export function clearAdsBuildingTheme() {
  _themeLedger = null;
  return clearBuildingTheme(ADS_BUILDING_THEME_ID);
}

/** The ledger, for the row line and the tests. */
export function adsBuildingThemeLedger() {
  return _themeLedger;
}

/** A count, grouped the way the reader's language groups one. */
function fr(value) {
  return formatNumber(value);
}

/**
 * The one sentence the toggle row adds when the theme is on.
 *
 * The OFFER side of the ledger, in the order a reader needs it: how many
 * dossiers were handed to the volumes, then every reason a dossier was not.
 * The paint side is on the Bâti 3D row — said out loud, because a number that
 * lives on another row is worse than no number when nobody knows where it is.
 *
 * @param {?object} ledger
 * @returns {?string}
 */
export function adsBuildingThemeLine(ledger = _themeLedger) {
  if (!ledger || !ledger.total) return null;
  const m = messages().ledger;
  const held = [];
  if (ledger.newBuild) held.push(m.newBuild(fr(ledger.newBuild)));
  if (ledger.land) held.push(m.land(fr(ledger.land)));
  if (ledger.unpublishedState) held.push(m.noState(fr(ledger.unpublishedState)));
  if (ledger.unplaced) held.push(m.unplaced(fr(ledger.unplaced)));
  const head = m.head(fr(ledger.offered), fr(ledger.total))
    + (ledger.offeredInferred ? m.inferred(fr(ledger.offeredInferred)) : '');
  return m.line(head, held.length ? m.held(held.join(', ')) : '');
}

/**
 * The layer's own colour key: one plain line per class drawn, folded under
 * « Couleurs des projets ».
 *
 * NO COUNT AND NO SENTENCE per class (the legend rule of 2026-09-21): the
 * paragraphs that used to follow each swatch — why a class is empty outside
 * three métropoles, why a roof is not painted — were written for the author
 * of the layer, and a reader skipped all six of them. The same classes, in the
 * same words and colours, come from the Sitadel parcels beside this layer, and
 * the key prints them once (`mergeTileMembers` in manager.js).
 *
 * @param {?object} payload
 * @returns {{chips: Array<object>, legend: Array<object>, legendFold: string, surfaceFill: boolean}}
 */
export function adsRowControls(payload, onParcel = null) {
  const present = new Set((payload?.permits || [])
    .filter((permit) => !adsDrawnElsewhere(permit, onParcel))
    .map((permit) => adsPermitStyle(permit).classId));
  // The plot wash IS a ground-classified area fill, so on the photoreal stack
  // it climbs the façades and the manager's drape notice applies — wherever
  // there is a plot at all. Claimed only when there is a wash to claim it for.
  // The theme these colours also paint is NOT a drape: extruded volumes are
  // real geometry that the mesh occludes instead of receiving
  // (`surfaceFillNotice.js`).
  return {
    chips: [],
    legend: permitProjectLegend(present),
    legendFold: permitProjectFoldTitle(),
    surfaceFill: (payload?.emprises?.length || 0) > 0,
  };
}

/** Precisions whose marker is not on the dossier's own ground. */
const APPROXIMATE_PRECISIONS = new Set(['street', 'locality', 'mere']);

/**
 * « Sitadel — SDES » → « Sitadel · SDES »; a portal's dataset title → its
 * authority, and « + Sitadel » kept when the two registers merged the file.
 * @param {?string} label
 * @returns {string}
 */
function adsSourceShort(label) {
  const heads = String(label ?? '').split('+')
    .map((part) => part.split('—')[0].trim())
    .filter(Boolean);
  if (!heads.length) return 'Sitadel · SDES'; // i18n-ignore-line — publisher names
  return heads.map((head) => (head === 'Sitadel' ? 'Sitadel · SDES' : head)).join(' · '); // i18n-ignore-line — publisher names
}

/**
 * The card of one dossier, as the map key prints it — see
 * `permitProjectCard`, which the Sitadel parcels fill the same way.
 * @param {object} permit
 * @param {{others?: number}} [extra]
 * @returns {object}
 */
export function adsPermitPanel(permit, { others = 0 } = {}) {
  const { classId } = adsPermitStyle(permit);
  const card = messages().card;
  const emprise = messages().emprise;
  return permitProjectCard({
    key: `ads:${permit.id}`,
    type: adsKindLabel(permit.kind) ?? permit.kindLabel ?? permitProjectLabel(classId),
    classId,
    dwellings: Number.isFinite(permit.housing) ? permit.housing : null,
    surfaceM2: Number.isFinite(permit.surfaceCreatedM2) ? permit.surfaceCreatedM2 : null,
    nature: adsPurposeLabel(permit.purpose),
    address: permit.address || null,
    commune: permit.commune || null,
    dates: {
      filed: permit.depositedOn,
      granted: ['refuse', 'annule'].includes(permit.state) ? null : permit.decidedOn,
      decided: ['refuse', 'annule'].includes(permit.state) ? permit.decidedOn : null,
      grantedBy: permit.state === 'accorde' ? permit.postedOn : null,
      started: permit.startedOn,
      completed: permit.completedOn,
    },
    approximate: APPROXIMATE_PRECISIONS.has(String(permit.precision ?? '')),
    details: [
      adsStateLabel(permit),
      adsPrecisionLine(permit),
      permit.parcels?.length ? card.parcel(permit.parcels.join(', ')) : null,
      adsEmpriseLine(permit),
      others > 0 ? emprise.files(others + 1) : null,
      permit.applicant,
      permit.dossier,
    ].filter(Boolean),
    source: adsSourceShort(permit.sourceLabel),
  });
}

/** The card the shell has open, resolved to its dossier. */
let _selection = null;
/** The payload the last render drew, so a selection resolves against it. */
let _drawnPayload = null;
/** The data source the last render drew into — for the selected badge. */
let _drawnSource = null;
/** Stops following the Sitadel parcels' drawn dossiers. */
let _stopSitadelWatch = null;
let _redrawQueued = false;

/**
 * The dossier behind a card: a badge's own, or — for a plot — the dossier
 * that lends the plot its colour, with the count of the others on it.
 * @param {?object} card
 * @param {?object} payload
 * @returns {?{permit: object, others: number}}
 */
export function adsResolveSelection(card, payload) {
  const id = String(card?.id ?? '');
  const permits = payload?.permits || [];
  if (id.startsWith('ads:')) {
    const permit = permits.find((entry) => `ads:${entry.id}` === id) || null;
    return permit ? { permit, others: 0 } : null;
  }
  const plot = /^ads-emprise:(\d+)/.exec(id);
  if (plot) {
    const on = permits.filter((entry) => String(entry.empriseId) === plot[1]);
    const lead = empriseStyle(on).permit;
    return lead ? { permit: lead, others: on.length - 1 } : null;
  }
  return null;
}

/**
 * The shell's selection hook: resolve the card, and keep the selected badge in
 * its own colours — the shell tints a selected marker, which on a badge that
 * already wears its class would turn violet into a colour of no class.
 * @param {?object} card
 */
function onAdsSelectionChange(card) {
  _selection = card ? adsResolveSelection(card, _drawnPayload) : null;
  if (!card || !_drawnSource) return;
  const entity = _drawnSource.entities?.getById?.(card.id);
  if (entity?.billboard) entity.billboard.color = Cesium.Color.WHITE;
}

/**
 * What the globe keeps over the selected dossier while the key carries its
 * card: « 40 logements », and « Repère approximatif » when it is.
 * @returns {string|boolean}
 */
function adsCompactCard() {
  if (!_selection || !mapKeyCarriesSelection()) return false;
  const { permit } = _selection;
  return permitProjectTag({
    dwellings: Number.isFinite(permit.housing) ? permit.housing : null,
    classId: adsPermitStyle(permit).classId,
    approximate: APPROXIMATE_PRECISIONS.has(String(permit.precision ?? '')),
  });
}

const adsScanLayer = createAddressScanLayer({
  id: ADS_BUILDING_THEME_ID,
  // i18n-ignore-start — registry fields, not copy: see src/data/layerTaxonomy.i18n.js.
  name: 'Autorisations d’urbanisme',
  icon: '⌂',
  source: 'Sitadel — SDES + portails ADS + affichage communal',
  // i18n-ignore-end
  endpoint: '/api/ads-fr',
  updateInterval: UPDATE_INTERVAL_MS,
  runtimeParams: {
    months: { values: ADS_WINDOWS.map((window) => window.months), defaultValue: ADS_WINDOW_DEFAULT },
  },
  params: (point, viewer, runtime) => ({
    radius: String(ADS_DEFAULT_RADIUS_M),
    months: runtime.months ?? ADS_WINDOW_DEFAULT,
  }),

  // The layer's own colour key. This layer spends COLOUR on the class of the
  // dossier, and the same colour on whole roofs, so D1 makes the key
  // compulsory rather than optional.
  // The period builds from the runtime alone, so it exists before the first
  // scan; the colour key is built from the payload that was actually drawn and
  // is simply absent while nothing is. The open card rides with the key.
  rowControls: (runtime, summary, payload) => ({
    ...(payload ? adsRowControls(payload, askJoin(PERMIT_DRAWN_ON_PARCEL_JOIN)) : {}),
    chips: [],
    select: adsPeriodSelect(runtime.months, summary),
    legendSelection: payload && _selection ? adsPermitPanel(_selection.permit, _selection) : null,
  }),
  onSelectionChange: onAdsSelectionChange,
  compactCard: adsCompactCard,

  render({ payload, dataSource, viewer }) {
    // The volumes first, because the registry notifies the BD TOPO layer
    // synchronously and a repaint costs nothing while this data source is still
    // empty. Re-registering with the new points IS the data-changed signal.
    const card = messages().card;
    _drawnPayload = payload;
    _drawnSource = dataSource;
    syncAdsBuildingTheme(payload);
    // The ground next, the news on top of it. Emprises are counted separately
    // from the returned total: the number this callback reports is what the
    // manager shows as the layer's count, and that has always been dossiers.
    const onParcel = askJoin(PERMIT_DRAWN_ON_PARCEL_JOIN);
    drawAdsEmprises(dataSource, payload, gpuClassificationTypeForScene(viewer?.scene), onParcel);
    let drawn = 0;
    for (const permit of payload.permits || []) {
      if (!Number.isFinite(permit.lon) || !Number.isFinite(permit.lat)) continue;
      if (adsDrawnElsewhere(permit, onParcel)) continue;
      const style = adsPermitStyle(permit);
      dataSource.entities.add({
        id: `ads:${permit.id}`,
        position: Cesium.Cartesian3.fromDegrees(permit.lon, permit.lat),
        billboard: {
          // A BADGE, the approved mock's « pastille » (2026-09-23): a rounded
          // square in the class colour with a building on it, the same mark
          // the Sitadel parcels draw — see `permitProjects.js`. The colour is
          // IN the image, so the billboard is not tinted.
          image: permitBadgeImage(style.classId),
          width: PERMIT_BADGE_PX,
          height: PERMIT_BADGE_PX,
          // Smaller from afar: a 400 m disc of badges seen from 8 km would
          // otherwise be one blot.
          scaleByDistance: BADGE_SCALE,
          // POSITIVE_INFINITY, not a distance: these are annotations ON the
          // world, not objects in it, and a finite value lets the terrain eat
          // the bottom half of every glyph at city zoom.
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          kind: 'ads-permit',
          state: permit.state,
          classId: style.classId,
          family: permit.kind,
          housing: permit.housing,
          sources: permit.sources,
        },
        name: permit.address || permit.commune || permit.dossier,
        description: [
          // The three server-composed fields are relabelled from their KEYS:
          // `/api/ads-fr` runs in Node and bakes French into the payload.
          adsKindLabel(permit.kind) ?? permit.kindLabel,
          adsStateLabel(permit),
          adsDateLine(permit),
          Number.isFinite(permit.housing) && permit.housing > 0
            ? card.dwellings(permit.housing)
            : null,
          Number.isFinite(permit.surfaceCreatedM2) && permit.surfaceCreatedM2 > 0
            ? card.surfaceCreated(formatNumber(permit.surfaceCreatedM2))
            : null,
          adsPurposeLabel(permit.purpose),
          permit.parcels?.length ? card.parcel(permit.parcels.join(', ')) : null,
          // WHICH shape is under this marker, not merely that there is one: a
          // portal's own outline and a cadastral parcel joined on a reference
          // are two different claims, and the card that said « emprise
          // publiée » for both credited Bordeaux for every parcel this layer
          // draws from the Etalab cadastre. See {@link adsEmpriseLine}.
          adsEmpriseLine(permit),
          permit.applicant,
          adsPrecisionLine(permit),
          card.distance(permit.distanceM),
          permit.dossier,
        ].filter(Boolean).join(' · '),
      });
      drawn += 1;
    }
    return drawn;
  },

  summarize(payload) {
    const summary = payload.summary || {};
    return {
      commune: payload.commune?.name ?? null,
      communeCode: payload.commune?.code ?? null,
      since: payload.since ?? null,
      permitsFound: summary.count ?? 0,
      // The gap between these two is the honesty of the radius.
      permitsInRadius: summary.found ?? 0,
      truncated: summary.truncated ?? false,
      // The one thing the national register cannot say — and therefore the one
      // number that tells a reader whether this commune has a live portal.
      underInstruction: summary.underInstruction ?? 0,
      housing: summary.housing ?? 0,
      byKind: summary.byKind ?? null,
      byState: summary.byState ?? null,
      // Dossiers the two registers agreed were the same file.
      merged: payload.merged ?? 0,
      // Rows collapsed because one operation is listed in both permis-de-
      // construire files. Commune-wide, like the geocoding shortfall below.
      folded: payload.folded ?? 0,
      // Certificats d'urbanisme in the circle, deliberately not drawn — an
      // information note is not permission to build. Only Bordeaux publishes
      // them, so this is 0 everywhere else. NULL is a third answer: Bordeaux
      // is now asked to leave them out of the rows it sends and to count them
      // instead, and a count that did not come back is not a count of zero.
      certificates: summary.certificates ?? 0,
      certificatesCounted: Number.isFinite(summary.certificates),
      // Plots outlined on the ground, and dossiers standing on one. The gap
      // between `permitsFound` and `withEmprise` is the dossiers placed by the
      // geocoder: a portal that ships no shape (Paris, Nantes) and a Sitadel
      // row whose parcel reference the cadastre could not resolve.
      emprises: summary.empriseCount ?? 0,
      withEmprise: summary.withEmprise ?? 0,
      // Rows the BAN could not place better than their commune, across the
      // WHOLE commune: an unplaced row has no position, so it cannot be
      // attributed to this circle or to any other.
      unplacedInCommune: payload.unplacedInCommune ?? 0,
      // How much of the commune's register stands on published ground rather
      // than on a geocoded address. `divided` is the rows whose parcel has been
      // split since they were filed — 37% of Ustaritz's — and `resolved` is how
      // many of those the dated cadastre could still account for. The gap
      // between the two is the archive floor of 2017 and the per-scan budget,
      // both of which are limits of the method and are reported as such.
      onParcel: payload.cadastre?.placed ?? 0,
      dividedInCommune: payload.cadastre?.divided ?? 0,
      lineageResolved: payload.cadastre?.resolved ?? 0,
      lineageOnChild: payload.cadastre?.onChild ?? 0,
      lineageOnParent: payload.cadastre?.onParent ?? 0,
      lineageTruncated: payload.cadastre?.truncated ?? false,
      portals: (payload.portals || []).filter((portal) => portal.ok).map((portal) => portal.key),
    };
  },
});

/**
 * The layer module.
 *
 * The scan shell is wrapped rather than returned directly, for the one thing it
 * has no hook for: a theme that must be published while the layer is on and
 * withdrawn the moment it is off. `render()` republishes the points on every
 * scan; these three methods own the on/off edge, and they are the reason no
 * other module has to know this layer exists.
 *
 * A DORMANT SCAN NEEDS NO FOURTH HOOK, and the arithmetic says why. The shell
 * stops scanning above 12 000 m and does not call `render()`, so the theme
 * keeps the points of the last block it saw. It cannot paint anything with
 * them: `bdtopo-buildings` refuses a viewport wider than 0.08°, which a 60° FOV
 * camera reaches at 8 900 / (2 · tan 30°) = 7 707 m — a kilometre and a half
 * BELOW the scan ceiling. There is no altitude at which this layer is asleep
 * and there are volumes on screen to mis-paint.
 */
const adsUrbanismeLayer = {
  ...adsScanLayer,

  enable(viewer) {
    adsScanLayer.enable(viewer);
    // The Sitadel parcels announce each new draw; the badges they cover are
    // taken off here, from the answer already in hand. Coalesced: a republish
    // is a take-down and a put-back, two announcements for one change.
    _stopSitadelWatch?.();
    _stopSitadelWatch = watchJoin(PERMIT_DRAWN_ON_PARCEL_JOIN, () => {
      if (_redrawQueued) return;
      _redrawQueued = true;
      queueMicrotask(() => {
        _redrawQueued = false;
        adsScanLayer.redraw('sitadel-parcels');
      });
    });
    // Registered empty rather than not at all: the row's key, the "no data"
    // wash and the count of unpainted volumes have to appear the moment the
    // layer is switched on, not one scan later. The first `render()` replaces
    // the points and keeps the sequence number.
    syncAdsBuildingTheme(null);
  },

  disable() {
    _stopSitadelWatch?.();
    _stopSitadelWatch = null;
    // The paint goes first. Whatever the shell does or fails to do while
    // tearing down its own listeners, the city must not be left wearing the
    // colours of a layer that is off.
    clearAdsBuildingTheme();
    adsScanLayer.disable();
  },

  destroy(viewer) {
    _stopSitadelWatch?.();
    _stopSitadelWatch = null;
    clearAdsBuildingTheme();
    adsScanLayer.destroy(viewer);
  },

  getStats() {
    const stats = adsScanLayer.getStats();
    const ledger = _themeLedger;
    if (!ledger) return stats;
    const line = adsBuildingThemeLine(ledger);
    return {
      ...stats,
      theme: ADS_BUILDING_THEME_ID,
      themeLabel: adsBuildingThemeLabel(),
      // The OFFER ledger. Every dossier of the served payload is in exactly one
      // of these, and they sum to `themeTotal` — see `adsBuildingThemePoints`.
      themeTotal: ledger.total,
      themeOffered: ledger.offered,
      themeOfferedDeclared: ledger.offeredDeclared,
      themeOfferedInferred: ledger.offeredInferred,
      themeHeldNewBuild: ledger.newBuild,
      themeHeldLand: ledger.land,
      themeHeldNoState: ledger.unpublishedState,
      themeHeldUnplaced: ledger.unplaced,
      // The disc the question was asked over, against which the unpainted city
      // has to be read (A4).
      themeScanRadiusM: ADS_DEFAULT_RADIUS_M,
      // The ledger in words, for the analyst surfaces. NOT on the row's meta
      // line any more: since 2026-09-23 this layer's row is « Urbanisme », read
      // by anybody, and « 8 des 17 dossiers peignent le bâti 3D · retenus : 9
      // en construction neuve » under it answered a question nobody on that
      // row had asked. The Bâti 3D row still counts what it painted.
      ...(line ? { themeLine: line } : {}),
    };
  },
};

export default adsUrbanismeLayer;
