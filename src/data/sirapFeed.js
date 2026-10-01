/**
 * @module data/sirapFeed
 *
 * *Affichage réglementaire* — the permits a commune posts on its public board,
 * read off Sirap's « Portail Usager » (PU), the filing portal of the NEXT'ADS
 * instruction software.
 *
 * WHY A SECOND BOARD READER. `cartdsFeed.js` reads the communes that instruct
 * on Inetum's Cart@DS. A check of the sixty most populous communes not yet
 * covered, on 2026-10-01, found a second family: Antibes and the communes of
 * the Communauté urbaine de Dunkerque post their board through the PU, and the
 * same app answers at Asnières-sur-Seine and across Rennes Métropole. What
 * they post is what a Cart@DS board posts — the filing within days, the
 * decision within days, every family, the fence and the pool included — and
 * Sitadel holds none of it for six weeks, and never the half that creates no
 * floor area.
 *
 * ── The protocol ────────────────────────────────────────────────────────────
 * One open JSON endpoint per commune, no key, no session:
 * `GET <host>/api/v1/communes/<code>/affichage-reglementaire`, where `<code>`
 * is the INSEE code on SIX characters — a zero in front (`059183`). It answers
 * an array of every dossier on the board, filed and decided alike, one object
 * each: `numeroAds`, `type`, `dateDepot`, `demandeur`, `superficie`,
 * `adresse`, `parcelles`, `travauxNature`, `descriptionTravaux`, `decision`,
 * `dateDecision`, `architecte`. `<host>/api/v1/communes` lists the communes a
 * host posts for, thirty per `page` from 0.
 *
 * ── Trap 1: the site may show nothing while the board answers ───────────────
 * Asnières's own site links no board, and its PU page is an Angular app that
 * renders nothing without a browser; the endpoint answered 180 dossiers on
 * 2026-10-01. The board is the display the Code de l'urbanisme makes public
 * (R.423-6 for a filing, R.424-15 for a decision); asking the platform finds
 * what reading the commune's site does not.
 *
 * ── Trap 2: the board forgets ───────────────────────────────────────────────
 * A decided dossier leaves the board when its posting period ends, about two
 * months, exactly like a Cart@DS one. So every row read is kept, through the
 * same archive (`cartdsArchive.js`, {@link SIRAP_ROWS}) and the same daily
 * sweep, and the layer draws the archive.
 *
 * ── Trap 3: the board names private people ──────────────────────────────────
 * `demandeur` is the applicant as written on the form, and `architecte` a
 * person's name more often than a firm's. The applicant goes through the same
 * filter as every other register (`permitApplicant.js`) before the row is
 * even stored, and the architect is never kept: the layer has no use for it.
 *
 * ── Trap 4: a commune absorbed decades ago still has its own board ──────────
 * Dunkerque absorbed Fort-Mardyck and Saint-Pol-sur-Mer in 2010, and the PU
 * still posts each under its old INSEE code (`059248`, `059540`). The BAN
 * answers 59183 for an address in either, so Dunkerque reads three boards
 * ({@link sirapBoardCodes}). Their parcels are in Dunkerque's cadastre under
 * the old commune's number as prefix — `248248AB0396` is `59183248AB0396`,
 * checked against Etalab's edition of 2026-06-01, 74 of 75 found.
 *
 * ── Trap 5: a filed dossier is not a dossier under review ───────────────────
 * Trap 4 of `cartdsFeed.js`, for the same reason: an undecided row is
 * `depose`, never `instruction`.
 *
 * Dependency-free and side-effect-free (no Cesium, no DOM, no fetch): URLs,
 * parsing and normalisation only. The `/api/ads-fr` proxy and
 * `scripts/lib/sirapBoards.mjs` import it; nothing in the browser bundle does.
 */

import { COMMUNE_CODE_PATTERN } from './communeCode.js';
import { organisationApplicant } from './permitApplicant.js';
import { ADS_KINDS, dossierKey, formatDossier, seriesOfKind } from './adsFeed.js';
import { ADS_STATE_WORDS } from './adsFeed.i18n.js';
import { CARTDS_LICENCE, cartdsKind, cartdsVerdictState } from './cartdsFeed.js';

/** Trim a value to a non-empty string, or null. */
function text(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).replace(/\s+/g, ' ').trim();
  return trimmed && trimmed.toLowerCase() !== 'null' && trimmed !== 'None' ? trimmed : null;
}

/** The same state words `adsFeed.js` publishes, in the payload's French. */
function stateFrench(state) {
  return ADS_STATE_WORDS.definition[state].fr;
}

/** How the reuse of a posted decision is licensed: as for a Cart@DS board. */
export const SIRAP_LICENCE = CARTDS_LICENCE;

/**
 * The PU hosts read, and the communes each one posts for.
 *
 * FROM A MEASUREMENT, as `CARTDS_INSTANCES` is. Every commune each host lists
 * was read on 2026-10-01 and every one had dossiers on its board: 56 communes,
 * 3 787 rows — Rennes Métropole 40 communes and 2 475 rows (798 in Rennes),
 * the Communauté urbaine de Dunkerque 14 communes and 799 rows over sixteen
 * boards, Antibes 333, Asnières-sur-Seine 180.
 *
 * `associated` names, for a commune, the boards it reads beyond its own: the
 * communes it absorbed, which the PU still posts apart (Trap 4).
 */
export const SIRAP_INSTANCES = Object.freeze([
  Object.freeze({
    key: 'rennesmetropole',
    base: 'https://demarchesurbanisme-rennesmetropole.pu.sirap.com',
    label: 'Rennes Métropole — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    communes: Object.freeze([
      '35001', '35022', '35024', '35032', '35039', '35055', '35058', '35059',
      '35065', '35066', '35076', '35079', '35080', '35081', '35088', '35120',
      '35131', '35139', '35144', '35180', '35189', '35196', '35204', '35206',
      '35208', '35210', '35216', '35238', '35240', '35245', '35250', '35266',
      '35275', '35281', '35315', '35334', '35351', '35352', '35353', '35363',
    ]),
  }),
  Object.freeze({
    key: 'cud',
    base: 'https://urbanisme-cud.pu.sirap.com',
    label: 'Communauté urbaine de Dunkerque — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    communes: Object.freeze([
      '59016', '59094', '59107', '59131', '59159', '59183', '59260', '59272',
      '59340', '59359', '59532', '59576', '59588', '59668',
    ]),
    // Fort-Mardyck and Saint-Pol-sur-Mer, communes associées since 2010.
    associated: Object.freeze({ 59183: Object.freeze(['59248', '59540']) }),
  }),
  Object.freeze({
    key: 'antibes',
    base: 'https://urbanisme.antibes-juanlespins.com',
    label: 'Ville d’Antibes Juan-les-Pins — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    communes: Object.freeze(['06004']),
  }),
  Object.freeze({
    key: 'asnieres',
    base: 'https://urbanisme-mairieasnieres.pu.sirap.com',
    label: 'Asnières-sur-Seine — affichage réglementaire', // i18n-ignore-line — the publisher and its page title
    communes: Object.freeze(['92004']),
  }),
]);

/**
 * The instance posting for this commune, or null.
 * @param {?string} communeCode
 * @returns {?object}
 */
export function sirapInstanceFor(communeCode) {
  const code = String(communeCode ?? '').trim().toUpperCase();
  if (!code) return null;
  return SIRAP_INSTANCES.find((instance) => instance.communes.includes(code)) ?? null;
}

/**
 * Every board a commune reads, as INSEE codes: its own, then the communes it
 * absorbed (Trap 4).
 * @param {object} instance One of {@link SIRAP_INSTANCES}.
 * @param {string} insee
 * @returns {Array<string>}
 */
export function sirapBoardCodes(instance, insee) {
  const code = String(insee).toUpperCase();
  return [code, ...(instance.associated?.[code] ?? [])];
}

/**
 * The board of one commune. The INSEE code goes on six characters, a zero in
 * front: the five-character code answers HTTP 400.
 * @param {object} instance
 * @param {string} board An INSEE code from {@link sirapBoardCodes}.
 * @returns {string}
 */
export function sirapBoardUrl(instance, board) {
  return `${instance.base}/api/v1/communes/0${String(board).toUpperCase()}/affichage-reglementaire`;
}

/** @param {object} instance @returns {string} */
export function sirapRobotsUrl(instance) {
  return `${new URL(instance.base).origin}/robots.txt`;
}

/**
 * `2026-06-17T00:00:00.000Z` → `2026-06-17`, or null.
 *
 * The day as published: every one of the 6 016 dates read on 2026-10-01 was
 * at midnight UTC, so the date part IS the day, and converting it to Paris
 * time would only risk moving it.
 *
 * @param {?string} value
 * @returns {?string}
 */
export function sirapDate(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : null;
}

/**
 * The site, as written: `14 Avenue Gaspard Malo 59386 Dunkerque`.
 *
 * The LAST five-digit group is the postcode, so a house number of five digits
 * is not mistaken for one. A postcode here is often a CEDEX or a neighbouring
 * office's (59386, 59140 and 59240 all read Dunkerque); the geocoder is given
 * the commune's code beside it, which is the hint it trusts.
 *
 * @param {?string} value
 * @returns {{address: ?string, postcode: ?string, locality: ?string}}
 */
export function parseSirapAddress(value) {
  const raw = text(value);
  if (!raw) return { address: null, postcode: null, locality: null };
  const match = /^(.*)\s\b(\d{5})\b\s*(.*)$/.exec(` ${raw}`);
  if (!match) return { address: raw, postcode: null, locality: null };
  return { address: text(match[1]), postcode: match[2], locality: text(match[3]) };
}

/**
 * The parcels as the cadastre keys them: `<INSEE><prefix><section><number>`.
 *
 * The PU writes twelve characters, `183000BD0008`: the commune's three digits,
 * the prefix, the section, the number — the cadastre's own key without the
 * département. Five spellings stray from it, all seen on 2026-10-01:
 *
 * - the leading zeros eaten (`4000DW0249` at Antibes, `16000AE0080`) — padded;
 * - a space before the section (`004000 BS0348`) — dropped;
 * - a single-letter section written `0L` (`0040000L0005`) — the cadastre's
 *   own spelling, kept;
 * - an absorbed commune's number in front with no prefix (`248000AC0328`) —
 *   that number becomes the prefix (Trap 4);
 * - `None`, a section or number of zeros (`238000000484`, `004000A00000`) or a
 *   number with a letter (`238000DP356p`) — no parcel, and the address places
 *   the dossier instead.
 *
 * @param {?string} cell The `parcelles` field, comma-separated.
 * @param {string} insee The commune whose cadastre holds them.
 * @returns {Array<{idu: string, provisional: boolean, label: string}>}
 */
export function sirapParcelIdus(cell, insee) {
  const commune = String(insee ?? '').trim().toUpperCase();
  if (!COMMUNE_CODE_PATTERN.test(commune)) return [];
  const own = commune.slice(-3);
  const out = [];
  for (const piece of String(cell ?? '').split(',')) {
    let flat = piece.replace(/\s+/g, '').toUpperCase();
    if (/^\d{4,5}[A-Z0-9]{2}\d{4}$/.test(flat)) flat = flat.padStart(12, '0');
    const match = /^(\d{3})(\d{3})([A-Z0-9]{2})(\d{4})$/.exec(flat);
    if (!match) continue;
    const [, written, given, section, numero] = match;
    if (/^0+$/.test(section) || /^0+$/.test(numero)) continue;
    const prefix = given !== '000' || written === own ? given : written;
    const idu = `${commune}${prefix}${section}${numero}`;
    if (out.some((ref) => ref.idu === idu)) continue;
    const name = `${section.replace(/^0/, '')} ${Number.parseInt(numero, 10)}`;
    out.push({ idu, provisional: false, label: prefix === '000' ? name : `${prefix} ${name}` });
  }
  return out;
}

/**
 * What a posted verdict means, on the shared ladder.
 *
 * The PU's words, counted over the 1 491 decisions on the boards of
 * 2026-10-01, are those of whichever instruction service the commune uses:
 * `Favorable (PLATAU)` and `Défavorable (PLATAU)` at Dunkerque, `Accord`,
 * `Accord avec prescriptions`, `Refus`, `Rejet tacite`, `Accord tacite` at
 * Antibes and Asnières, `FAVORABLE ET PRESCRIPTIONS`, `NON OPPOSITION`,
 * `DEFAVORABLE`, `SANS SUITE`, `RETRAIT par le pétitionnaire`, `CADUC` at
 * Rennes. Cart@DS's reader (`cartdsVerdictState`) already reads every one of
 * them but two: a bare `Tacite` (152 rows, 151 at Rennes), which with no
 * `rejet` in front is the tacit grant the code gives a dossier left
 * unanswered, and `SANS OBJET` (3 rows, Rennes), a request that turned out to
 * need no authorisation — closed, like `SANS SUITE`. `INFORMATION` is a
 * certificat's answer, on a row the layer counts and never draws.
 *
 * @param {?string} verdict
 * @returns {?string} `accorde`, `refuse`, `annule`, or null.
 */
export function sirapVerdictState(verdict) {
  const state = cartdsVerdictState(verdict);
  if (state) return state;
  const value = String(verdict ?? '').trim().toLowerCase();
  // i18n-ignore-start — the software's own verdicts, matched on
  if (value === 'tacite') return 'accorde';
  if (value === 'sans objet') return 'annule';
  // i18n-ignore-end
  return null;
}

/**
 * The fields of a board row that are kept, in a fixed order — the archive's
 * `cells` (see {@link scrubSirapRow}).
 */
export const SIRAP_ROW_FIELDS = Object.freeze([
  'numeroAds', 'type', 'dateDepot', 'demandeur', 'superficie', 'adresse',
  'parcelles', 'travauxNature', 'descriptionTravaux', 'decision', 'dateDecision',
]);

/** Where the applicant sits in the stored cells. */
const APPLICANT_CELL = SIRAP_ROW_FIELDS.indexOf('demandeur');

/**
 * One board row as it may be stored, or null for a row that may not be.
 *
 * TRAP 3 before anything is written: the applicant filtered, the architect
 * and the platform's own ids left behind. A row that is not a building
 * authorisation — the PU also posts `CH`, a change of use of a dwelling — is
 * not kept at all.
 *
 * @param {object} row One object of the board's array.
 * @returns {?Array<?string>}
 */
export function scrubSirapRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row) || !cartdsKind(row.numeroAds)) return null;
  const cells = SIRAP_ROW_FIELDS.map((field) => {
    const value = row[field];
    return value === null || value === undefined ? null : String(value);
  });
  cells[APPLICANT_CELL] = organisationApplicant(cells[APPLICANT_CELL]);
  return cells;
}

/** A stored row back into the object the normaliser reads. */
function rowOfCells(cells) {
  return Object.fromEntries(SIRAP_ROW_FIELDS.map((field, i) => [field, cells[i] ?? null]));
}

/**
 * What the archive needs to keep a PU board: which boards a row may come from
 * — an INSEE code (Trap 4: Dunkerque keeps three) — and how a row is scrubbed.
 * Handed to `createCartdsArchiveStore`.
 */
export const SIRAP_ROWS = Object.freeze({
  board: (board) => COMMUNE_CODE_PATTERN.test(String(board ?? '')),
  scrub: scrubSirapRow,
});

/** `0` is the field's blank: a ravalement on a 0 m² plot is a row with none. */
function area(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * One board row → the shape every source of the layer is normalised into.
 *
 * Takes the row as the endpoint answers it, or as the archive stores it (an
 * array of {@link SIRAP_ROW_FIELDS}); both go through {@link scrubSirapRow}
 * first, so a person's name cannot get through either way.
 *
 * @param {object} instance One of {@link SIRAP_INSTANCES}.
 * @param {string} insee The commune drawn — Dunkerque for its absorbed boards.
 * @param {object|Array<?string>} input
 * @returns {?object} Null for a row that is not a building authorisation.
 */
export function normaliseSirapRow(instance, insee, input) {
  const cells = Array.isArray(input) ? input : scrubSirapRow(input);
  if (!cells) return null;
  const row = rowOfCells(cells);
  const number = text(row.numeroAds)?.toUpperCase().replace(/\s+/g, '');
  const kind = cartdsKind(number);
  if (!kind) return null;
  const series = seriesOfKind(kind);
  const commune = String(insee).toUpperCase();
  const place = parseSirapAddress(row.adresse);
  const parcelIdus = sirapParcelIdus(row.parcelles, commune);
  const verdict = text(row.decision)?.replace(/\s*\(PLATAU\)\s*$/i, '') ?? null;
  const state = sirapVerdictState(verdict);
  const decidedOn = verdict ? sirapDate(row.dateDecision) : null;
  const kindLabel = ADS_KINDS[kind] ?? kind;
  // Rennes fills the description with the dossier's type (`CUa`) when there
  // is none; the nature of the works is the better blank.
  const description = text(row.descriptionTravaux);
  const purpose = description && description.toUpperCase() !== String(row.type ?? '').toUpperCase()
    ? description
    : text(row.travauxNature);
  return {
    id: `sirap:${instance.key}:${number}`,
    dossier: formatDossier(kind, number.slice(2)),
    series,
    key: `${series}|${dossierKey(number)}`,
    kind,
    kindLabel,
    // TRAP 5: no decision posted says FILED, and nothing about a review. A
    // verdict off the ladder keeps its own words, as on a Cart@DS board.
    state: state ?? 'depose',
    stateLabel: state ? stateFrench(state) : (verdict ?? stateFrench('depose')),
    depositedOn: sirapDate(row.dateDepot),
    decidedOn,
    postedOn: null,
    startedOn: null,
    completedOn: null,
    depositYear: null,
    applicant: organisationApplicant(row.demandeur),
    purpose: purpose ?? kindLabel,
    address: place.address,
    postcode: place.postcode,
    commune: null,
    communeCode: commune,
    cadastreCommune: commune,
    parcels: parcelIdus.map((ref) => ref.label),
    parcelIdus,
    landAreaM2: area(row.superficie),
    housing: null,
    surfaceCreatedM2: null,
    lon: null,
    lat: null,
    precision: null,
    geocodeScore: null,
    parts: null,
    source: 'sirap',
    sourceLabel: instance.label,
  };
}
