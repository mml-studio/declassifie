/**
 * @module permitProjects
 *
 * ONE PALETTE AND ONE VOCABULARY FOR A BUILDING PROJECT, whichever of the two
 * permit layers drew it.
 *
 * « Urbanisme » lights two layers for its permits: `ads-fr` (Sitadel and the
 * three métropole portals, around the point the camera looks at) and
 * `sitadel-fr` (Sitadel on its cadastral parcels, the whole commune). Until the
 * approved mock of 2026-09-23 they drew the same permits in two palettes that
 * contradicted each other — amber was « accordé » in one and « chantier
 * ouvert » in the other, a finished site was green in one and blue in the
 * other — under two keys of six and seven paragraphs. A reader comparing two
 * marks on one street had no way to know which key applied.
 *
 * Both layers now ask this module what colour a project wears and what it is
 * called, so the key can print ONE block, « Couleurs des projets », and a
 * project's card reads the same whichever layer answered the click.
 *
 * THE COLOURS ARE SITADEL'S, which are the mock's: violet granted, amber work
 * started, blue work finished, grey cancelled, red demolition. They are read
 * off `SITADEL_BANDS` rather than retyped, so the parcel washes and the
 * badges cannot drift apart. Two classes exist only in `ads-fr`: a file still
 * at the counter (teal — only Paris, Bordeaux and Nantes publish one) and a
 * file whose state neither register published (pale slate, never painted on a
 * roof).
 *
 * THE MARK IS A BADGE (the mock's « pastille ») — a rounded square in the
 * class colour with a building drawn in white, or struck through for a
 * demolition. One size for every project: how many dwellings it creates is
 * printed on its tag and its card, not guessed from a height.
 */
import { formatNumber } from '../i18n/format.js';
import { LUCIDE_ICONS } from './lucideIcons.js';
import { sitadelBandColor } from './sitadelFeed.js';
import messages from './permitProjects.i18n.js';

/** Every class, in the order the key prints them — the life of a permit. */
export const PERMIT_PROJECT_CLASS_IDS = Object.freeze([
  'filed', 'granted', 'started', 'completed', 'cancelled', 'demolition', 'unknown',
]);

const PERMIT_PROJECT_CLASSES_SET = new Set(PERMIT_PROJECT_CLASS_IDS);

/**
 * The colour each class wears, on the badge, on the parcel and in the key.
 * @type {Readonly<Record<string, string>>}
 */
export const PERMIT_PROJECT_COLORS = Object.freeze({
  filed: '#3dd6c4',
  granted: sitadelBandColor('autorise'),
  started: sitadelBandColor('commence'),
  completed: sitadelBandColor('termine'),
  cancelled: sitadelBandColor('annule'),
  demolition: sitadelBandColor('demolition'),
  // Paler and bluer than the cancelled grey, which it would otherwise sit
  // 11 ΔE from: « nobody published a decision » is not « the decision was no ».
  unknown: '#c9d4e0',
});

/** A Sitadel band id → the class it is shown as. */
const CLASS_BY_SITADEL_BAND = Object.freeze({
  autorise: 'granted',
  commence: 'started',
  termine: 'completed',
  annule: 'cancelled',
  demolition: 'demolition',
});

/** An `ads-fr` state, as `adsFeed.js` normalises it → the class it is shown as. */
const CLASS_BY_ADS_STATE = Object.freeze({
  instruction: 'filed',
  depose: 'filed',
  accorde: 'granted',
  autorise: 'granted',
  commence: 'started',
  termine: 'completed',
  refuse: 'cancelled',
  annule: 'cancelled',
});

/**
 * The class of a Sitadel permit, from the band the feed gave it.
 * @param {?string} band `autorise`, `commence`, `termine`, `annule`, `demolition`.
 * @returns {string}
 */
export function permitClassOfSitadelBand(band) {
  return CLASS_BY_SITADEL_BAND[String(band ?? '')] ?? 'unknown';
}

/**
 * The class of an `ads-fr` dossier.
 *
 * A permis de démolir is the demolition class WHATEVER its state, as it is on
 * the Sitadel parcels: the register's own progress field says nothing for
 * demolitions (94.3 % of Nantes' and 98.3 % of Paris' stay at « Autorisé »),
 * and a demolition drawn violet beside the same file drawn red would be the
 * contradiction this module exists to end.
 * @param {?{kind?: string, state?: string}} permit
 * @returns {string}
 */
export function permitClassOfAdsPermit(permit) {
  if (String(permit?.kind ?? '') === 'PD') return 'demolition';
  return CLASS_BY_ADS_STATE[String(permit?.state ?? '')] ?? 'unknown';
}

/** @param {string} classId @returns {string} CSS colour. */
export function permitProjectColor(classId) {
  return PERMIT_PROJECT_COLORS[classId] ?? PERMIT_PROJECT_COLORS.unknown;
}

/** @param {string} classId @returns {string} The class name, in the page's language. */
export function permitProjectLabel(classId) {
  const words = messages().classes;
  return words[classId] ?? words.unknown;
}

/** The fold's title, « Couleurs des projets ». */
export function permitProjectFoldTitle() {
  return messages().fold;
}

const _b64 = (text) => (typeof btoa === 'function'
  ? btoa(text)
  : Buffer.from(text, 'utf8').toString('base64'));

/**
 * The key's swatch: the badge's rounded square, masked and tinted with the
 * class colour by `manager.js` (the `glyph` field of a key line) — so the
 * swatch beside « Permis accordé » is the mark the map draws, at key size.
 */
export const PERMIT_BADGE_LEGEND_GLYPH = `data:image/svg+xml;base64,${_b64(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">'
  + '<rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="#000"/></svg>',
)}`;

/**
 * The key lines for the classes present, in the key's order: one plain name
 * per colour, no count and no sentence (the legend rule of 2026-09-21).
 * @param {Iterable<string>} present Class ids the layer drew.
 * @returns {Array<{label: string, color: string, glyph: string, classId: string, rank: number}>}
 */
export function permitProjectLegend(present) {
  const drawn = new Set(present);
  return PERMIT_PROJECT_CLASS_IDS
    .filter((classId) => drawn.has(classId))
    .map((classId) => ({
      classId,
      // The key merges the permit layers' blocks, and puts the classes back
      // in this order by it (`mergeTileMembers` in manager.js).
      rank: PERMIT_PROJECT_CLASS_IDS.indexOf(classId),
      label: permitProjectLabel(classId),
      color: permitProjectColor(classId),
      glyph: PERMIT_BADGE_LEGEND_GLYPH,
    }));
}

/** CSS pixels of a badge on the globe. */
export const PERMIT_BADGE_PX = 30;
/** CSS pixels of the selected badge. */
export const PERMIT_BADGE_SELECTED_PX = 38;

/** Raster side of the badge image: drawn at 2× for a sharp edge. */
const BADGE_RASTER_PX = 64;

const _badges = new Map();

/**
 * The badge image for one class — a data URL, one per class and state, so
 * thousands of billboards share a handful of atlas entries.
 *
 * Built as an SVG string rather than on a canvas, so it exists under
 * `node --test` too and the layers draw the same mark in a test as on screen.
 * The building is Lucide's (`lucideIcons.js`), untouched; the strike of a
 * demolition is a line of this module's own, laid over it.
 *
 * @param {string} classId
 * @param {{selected?: boolean}} [options]
 * @returns {string} `data:image/svg+xml;base64,…`
 */
export function permitBadgeImage(classId, { selected = false } = {}) {
  const id = PERMIT_PROJECT_CLASSES_SET.has(classId) ? classId : 'unknown';
  const key = `${id}:${selected ? 'selected' : 'plain'}`;
  const cached = _badges.get(key);
  if (cached) return cached;
  const color = permitProjectColor(id);
  // The rim holds the badge off a roof of any brightness; the selected one is
  // ringed in ivory, the colour the row's selected marks wear.
  const rim = selected ? '#f6f1e7' : 'rgba(9, 14, 22, 0.78)';
  const rimWidth = selected ? 5 : 3;
  const building = LUCIDE_ICONS.building.join('');
  const strike = id === 'demolition'
    ? '<path d="M4 4 20 20" stroke="rgba(9, 14, 22, 0.85)" stroke-width="4.2"/>'
      + '<path d="M4 4 20 20" stroke="#ffffff" stroke-width="2"/>'
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_RASTER_PX}" height="${BADGE_RASTER_PX}"`
    + ' viewBox="0 0 64 64">'
    + `<rect x="4" y="4" width="56" height="56" rx="14" fill="${color}"`
    + ` stroke="${rim}" stroke-width="${rimWidth}"/>`
    + '<g transform="translate(16 16) scale(1.3333)" fill="none" stroke="#ffffff" stroke-width="2"'
    + ` stroke-linecap="round" stroke-linejoin="round">${building}${strike}</g>`
    + '</svg>';
  const uri = `data:image/svg+xml;base64,${_b64(svg)}`;
  _badges.set(key, uri);
  return uri;
}

/**
 * The join `sitadel-fr` publishes: the dossiers it has drawn on their parcels,
 * as `ads-fr` keys them (`series|number`, see `dossierKey` in `adsFeed.js`).
 * `ads-fr` asks it before it lays a badge, so one permit is not drawn twice on
 * one plot by the row's two permit layers. A literal shared through this
 * module, so neither layer imports the other (`layerJoins.js`).
 */
export const PERMIT_DRAWN_ON_PARCEL_JOIN = 'sitadel/drawnDossiers';

// i18n-ignore-start — the register's own shouted street words, matched on
/** Street words and abbreviations Sitadel shouts, as a sentence writes them. */
const STREET_WORDS = Object.freeze({
  RUE: 'rue', AVENUE: 'avenue', AV: 'avenue', ALLEE: 'allée', ALLÉE: 'allée', IMPASSE: 'impasse',
  CHEMIN: 'chemin', BOULEVARD: 'boulevard', BD: 'boulevard', PLACE: 'place', ROUTE: 'route',
  COURS: 'cours', QUAI: 'quai', VOIE: 'voie', SQUARE: 'square', PASSAGE: 'passage',
  LOTISSEMENT: 'lotissement', RESIDENCE: 'résidence', RÉSIDENCE: 'résidence', SENTIER: 'sentier',
  PROMENADE: 'promenade', ESPLANADE: 'esplanade', CITE: 'cité', CITÉ: 'cité', HAMEAU: 'hameau',
  DOMAINE: 'domaine', VILLA: 'villa', RUELLE: 'ruelle', VENELLE: 'venelle', TRAVERSE: 'traverse',
  'LIEU-DIT': 'lieu-dit', QUARTIER: 'quartier',
});
/** Particles that stay lowercase inside a French proper name. */
const PARTICLES = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'EN', 'ET', 'SUR', 'SOUS', 'AUX', 'AU', 'D', 'L']);
// i18n-ignore-end

/**
 * An address as a sentence writes it: `5 RUE ANDRE DIGNAC` → `5 rue Andre
 * Dignac`. Sitadel publishes its streets in capitals, and a card that shouts
 * its address reads as a form. A text already in mixed case is left as filed.
 * The register's missing accents are not guessed back.
 * @param {?string} value
 * @returns {?string}
 */
export function permitAddress(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').replace(/'/g, '’').trim();
  if (!text) return null;
  if (/[a-zàâçéèêëîïôûùüÿñæœ]/.test(text)) return text;
  return text.split(' ').map((word, index) => {
    if (/^\d/.test(word)) return word.toLocaleLowerCase('fr-FR');
    const street = STREET_WORDS[word.toUpperCase()];
    if (street) return index > 0 ? street : street.charAt(0).toLocaleUpperCase('fr-FR') + street.slice(1);
    // The suffix of a house number: `3 BIS` → `3 bis`.
    if (/^(BIS|TER|QUATER)$/i.test(word)) return word.toLocaleLowerCase('fr-FR');
    return word.split('-').map((part, partIndex) => part.split('’').map((piece, inner) => {
      const lower = piece.toLocaleLowerCase('fr-FR');
      const atHead = index === 0 && partIndex === 0 && inner === 0;
      if (!atHead && PARTICLES.has(piece.toUpperCase())) return lower;
      return lower.charAt(0).toLocaleUpperCase('fr-FR') + lower.slice(1);
    }).join('’')).join('-');
  }).join(' ');
}

/**
 * `2024-12-06` → `6 déc. 2024` / `Dec 6, 2024`, or null.
 * @param {?string} iso
 * @returns {?string}
 */
export function permitDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!match) return null;
  return messages().card.date(Number(match[1]), Number(match[2]), Number(match[3]));
}

/**
 * The tag the globe keeps over a selected project while the key carries its
 * card: its dwellings when it creates some, else its class; and whether the
 * marker is approximate.
 * @param {{dwellings?: ?number, classId: string, approximate?: boolean}} project
 * @returns {string}
 */
export function permitProjectTag({ dwellings = null, classId, approximate = false }) {
  const m = messages().card;
  const head = Number.isFinite(dwellings) && dwellings > 0
    ? m.tagDwellings(formatNumber(dwellings), dwellings)
    : permitProjectLabel(classId);
  return approximate ? `${head} · ${m.approximate.tag}` : head;
}

/**
 * The card of one project, as the map key prints it (`legendSelection`).
 *
 * The mock's order: what kind of permit, what it allows, where, where it is
 * in its life (a badge in the class colour), what it builds, the two figures
 * a neighbour asks about, the three dates as a timeline, a warning when the
 * marker is approximate, and the rest of the file folded under « Voir les
 * détails du permis ».
 *
 * @param {object} project
 * @param {string} project.key Stable id of the card.
 * @param {string} project.type « Permis de construire », « Déclaration préalable »…
 * @param {string} project.classId See {@link PERMIT_PROJECT_CLASS_IDS}.
 * @param {?number} [project.dwellings] Dwellings created.
 * @param {?number} [project.surfaceM2] Floor area declared.
 * @param {?number} [project.demolishedDwellings] Dwellings the project removes.
 * @param {?string} [project.nature] « Nouvelle construction »…
 * @param {?string} [project.address]
 * @param {?string} [project.commune]
 * @param {{filed?: ?string, granted?: ?string, decided?: ?string, started?: ?string, completed?: ?string}} [project.dates]
 *   ISO dates.
 * @param {boolean} [project.approximate] The marker is not on the project's own ground.
 * @param {string[]} [project.details] What the fold holds, one line each.
 * @param {?string} [project.source] « Sitadel · SDES ».
 * @returns {object}
 */
export function permitProjectCard({
  key, type, classId, dwellings = null, surfaceM2 = null, demolishedDwellings = null,
  nature = null, address = null, commune = null, dates = {}, approximate = false,
  details = [], source = null,
}) {
  const m = messages().card;
  address = permitAddress(address);
  const hasDwellings = Number.isFinite(dwellings) && dwellings > 0;
  const title = hasDwellings
    ? m.dwellings(formatNumber(dwellings), dwellings)
    : (address || commune || type);
  const meta = [hasDwellings ? address : null, title === commune ? null : commune].filter(Boolean);
  const rows = [];
  if (Number.isFinite(surfaceM2) && surfaceM2 > 0) {
    rows.push({ label: m.surface, value: m.squareMeters(formatNumber(Math.round(surfaceM2))) });
  }
  if (Number.isFinite(demolishedDwellings) && demolishedDwellings > 0) {
    rows.push({
      label: m.demolished,
      value: m.demolishedDwellings(formatNumber(demolishedDwellings), demolishedDwellings),
    });
  }
  const color = permitProjectColor(classId);
  // The timeline: the moments the register can publish, in order. A permit
  // still at the counter opens on its filing; a refusal or withdrawal on its
  // decision, and a granted permit on its grant.
  // A cancelled or refused file has no work to come, so the two work steps
  // are not drawn at all rather than drawn « non renseignée »; nor are they
  // for a demolition (below).
  const steps = [];
  const step = (label, iso) => {
    const value = permitDate(iso);
    steps.push({ label, value: value || m.steps.missing, done: Boolean(value), color: value ? color : null });
  };
  if (classId === 'filed') step(m.steps.filed, dates.filed);
  else if (dates.decided) step(m.steps.decided, dates.decided);
  else if (!dates.granted && permitDate(dates.grantedBy)) {
    // A register that publishes no decision day but the day it made the
    // decision public: the grant is at the latest that day, and says so.
    steps.push({ label: m.steps.granted, value: m.steps.grantedBy(permitDate(dates.grantedBy)), done: true, color });
  } else step(m.steps.granted, dates.granted);
  // A demolition's file publishes no work dates (its progress field says
  // nothing for 94–98 % of them), so « non renseignée » would be every answer.
  if (classId !== 'cancelled' && classId !== 'filed' && classId !== 'demolition') {
    step(m.steps.started, dates.started);
    step(m.steps.completed, dates.completed);
  }
  return {
    key,
    kicker: type,
    title,
    meta,
    badge: { label: permitProjectLabel(classId), color },
    // The register's own words, capitalised as a line of their own.
    lines: nature ? [nature.charAt(0).toLocaleUpperCase() + nature.slice(1)] : [],
    rows: rows.length ? { items: rows } : null,
    steps: { items: steps },
    notice: approximate ? { title: m.approximate.title, text: m.approximate.text } : null,
    list: details.length ? { summary: m.details, items: details.map((text) => ({ text })) } : null,
    source: source ? m.source(source) : null,
  };
}
