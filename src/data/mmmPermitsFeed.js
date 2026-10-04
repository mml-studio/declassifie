/**
 * @module data/mmmPermitsFeed
 *
 * *Permis de construire de <commune>* — the favourable decisions Montpellier
 * Méditerranée Métropole publishes as open data, one CSV per member commune.
 *
 * WHY. Montpellier publishes no list a reader could follow week by week; the
 * métropole exports, every night, every favourable decision of 28 of its 31
 * communes since 2006 — the permits that create no floor area included, which
 * Sitadel never holds. 41 742 rows for Montpellier on 2026-10-01.
 *
 * ── Trap 1: no dossier number ───────────────────────────────────────────────
 * The file is anonymised: no number, no address, no applicant. A dossier is
 * one row per parcel, and the rows of one dossier carry consecutive
 * `objectid`s and identical attributes, which is how they are folded back
 * ({@link foldMmmRows}). The layer keys such a dossier by its first row, a key
 * no other register can share.
 *
 * ── Trap 2: Sitadel holds some of them, under a number this file lacks ──────
 * So a dossier is Sitadel's twin when one of its parcels is among a Sitadel
 * dossier's parcels, the family is the same, and Sitadel's filing year is the
 * file's or the one before — a modification is filed in its own year here and
 * in the original's in Sitadel. Measured on 2025's PCs: 87 of 309 dossiers.
 * A twin is not drawn twice; Sitadel's row stands ({@link dropSitadelTwins}).
 *
 * ── Trap 3: the filing year is the only date ────────────────────────────────
 * No filing day, no decision day, and the scan's window cuts on the year. The
 * file holds favourable decisions only — nothing under review, no refusal.
 * What the file cannot say, the archive does (Trap 5).
 *
 * ── Trap 4: the déclarations préalables have all but stopped ────────────────
 * 1 535 DP rows filed in 2024, 177 in 2025, one in 2026, at Montpellier and
 * at Lattes alike: something upstream stopped exporting them. A quiet block
 * here says nothing about the work done in it.
 *
 * ── Trap 5: the night a row first appears is the only finer date ───────────
 * The export is rewritten every night, so a row that was not in one edition
 * and is in the next was recorded in between: the decision is at the latest
 * that edition's day. Every edition read is folded into an archive, each row
 * with the first and last edition that held it (the store Cart@DS boards use,
 * `.gev-cache/archive/mmm/<insee>.json`), and a dossier whose rows all
 * appeared after the archive began carries that day as `postedOn`; the card
 * says « granted, at the latest on <day> ». The rows the first edition held
 * are the stock and carry nothing ({@link mmmPostedOn}).
 *
 * A row is known by what it says, never by its `objectid`: every row filed
 * since 2024 sits in one interleaved range of ids (85 020 698 to 85 059 638 on
 * 2026-10-01, the years mixed), so the ids were issued in one batch and may be
 * again. The Lambert-93 point and `annee_parcelle` are left out too: both come
 * from the cadastre join, which the métropole re-runs (rows filed in 2010
 * mostly carry 2021). Rows that say the same thing — 1 421 of 41 742 on
 * 2026-10-01, mostly a parcel listed twice in one dossier — are told apart by
 * their rank among their twins ({@link rankMmmRows}).
 *
 * Dependency-free and side-effect-free: parsing and normalisation only. The
 * `/api/ads-fr` proxy imports it, and `scripts/lib/mmmPermits.mjs` reads and
 * archives the files.
 */

import { foldToCommune } from './communeCode.js';
import { cartdsDay } from './cartdsArchive.js';
import { ADS_KINDS, seriesOfKind } from './adsFeed.js';
import { ADS_STATE_WORDS } from './adsFeed.i18n.js';

/** How the files are licensed: share-alike on a derived database, so they are read per scan and never bundled. */
export const MMM_LICENCE = 'ODbL 1.0';

/**
 * The communes that publish the file, by the name their file goes by. 28 of
 * the métropole's 31 on 2026-10-01; Baillargues and Castelnau-le-Lez are
 * instructed outside it, and Villeneuve-lès-Maguelone publishes none. Lattes
 * (`Lattes_MMM_PermisConst.csv`) is read from the orders it posts itself
 * instead, each with its number, site and day (`digilor-lattes`): 27 here.
 */
// i18n-ignore-start — commune names, proper nouns relayed as published
export const MMM_COMMUNES = Object.freeze([
  ['34172', 'Montpellier', 'Montpellier'], ['34027', 'Beaulieu', 'Beaulieu'], ['34058', 'Castries', 'Castries'],
  ['34077', 'Clapiers', 'Clapiers'], ['34087', 'Cournonsec', 'Cournonsec'], ['34088', 'Cournonterral', 'Cournonterral'],
  ['34090', 'Cres', 'Le Crès'], ['34095', 'Fabregues', 'Fabrègues'], ['34116', 'Grabels', 'Grabels'],
  ['34120', 'Jacou', 'Jacou'], ['34123', 'Juvignac', 'Juvignac'],
  ['34134', 'Laverune', 'Lavérune'], ['34164', 'Montaud', 'Montaud'], ['34169', 'Montferrier', 'Montferrier-sur-Lez'],
  ['34179', 'Murviel', 'Murviel-lès-Montpellier'], ['34198', 'Perols', 'Pérols'], ['34202', 'Pignan', 'Pignan'],
  ['34217', 'Prades', 'Prades-le-Lez'], ['34227', 'Restinclieres', 'Restinclières'], ['34244', 'Saint_bres', 'Saint-Brès'],
  ['34249', 'Saint_drezery', 'Saint-Drézéry'], ['34256', 'Saint_genies', 'Saint-Geniès-des-Mourgues'],
  ['34259', 'Saint_georges', 'Saint-Georges-d’Orques'], ['34270', 'Saint_jean', 'Saint-Jean-de-Védas'],
  ['34295', 'Saussan', 'Saussan'], ['34307', 'Sussargues', 'Sussargues'], ['34327', 'Vendargues', 'Vendargues'],
].map(([insee, file, name]) => Object.freeze({ insee, file, name })));
// i18n-ignore-end

/** @param {?string} communeCode @returns {?object} */
export function mmmCommuneFor(communeCode) {
  const code = foldToCommune(communeCode);
  return MMM_COMMUNES.find((commune) => commune.insee === code) ?? null;
}

/** @param {object} commune @returns {string} */
export function mmmCsvUrl(commune) {
  return `https://data.montpellier3m.fr/sites/default/files/ressources/${commune.file}_MMM_PermisConst.csv`;
}

/** The label a card's source line prints. */
export function mmmLabel(commune) {
  return `Montpellier Méditerranée Métropole — Permis de construire de ${commune.name}`; // i18n-ignore-line — the publisher and its dataset
}

/**
 * A comma-separated file with a header, quotes and a byte-order mark, as rows
 * keyed by the header. `-` and ` -` are the file's blanks and read as null.
 * @param {string} csv
 * @returns {Array<Record<string, ?string>>}
 */
export function parseMmmCsv(csv) {
  const source = String(csv ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift()?.map((name) => name.trim());
  if (!header?.includes('objectid')) return [];
  return rows.filter((cells) => cells.length >= header.length).map((cells) => Object.fromEntries(header.map((name, k) => {
    const value = cells[k].trim();
    return [name, value === '' || value === '-' ? null : value];
  })));
}

/** The form a row was filed on, as a family, or null for one the layer does not draw. */
export function mmmKind(modele) {
  const value = String(modele ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // i18n-ignore-start — the file's own form names, matched on
  if (value.startsWith('permis de construire')) return 'PC';
  if (value.startsWith('declaration prealable')) return 'DP';
  if (value.startsWith('permis d\'amenager') || value.startsWith('permis d’amenager')) return 'PA';
  if (value.startsWith('permis de demolir')) return 'PD';
  if (value.startsWith('certificat d')) return 'CU';
  // i18n-ignore-end
  return null;
}

/**
 * `340172   AC0013` — the DGFiP's commune code (département, a zero, the
 * commune), three characters of prefix, the section, the number — as the
 * cadastre keys it: `34172000AC0013`.
 * @param {?string} code
 * @returns {?{idu: string, provisional: boolean, label: string}}
 */
export function mmmParcel(code) {
  const match = /^(\d{2})0(\d{3})(.{3})([A-Z0-9]{2})(\d{4})$/.exec(String(code ?? '').toUpperCase());
  if (!match) return null;
  const [, dept, commune, prefix, section, numero] = match;
  const pre = /^\d{3}$/.test(prefix) ? prefix : '000';
  return { idu: `${dept}${commune}${pre}${section}${numero}`, provisional: false, label: `${section.replace(/^0/, '')}${Number(numero)}` };
}

/**
 * What a row says, in the order the archive stores it (Trap 5): every column
 * but the id, the commune (one per file), the point and the parcel's year.
 */
const MMM_IDENTITY = Object.freeze([
  'modele', 'annee_depot', 'code_parcelle', 'shon_global', 'utilisation', 'type_hebergement',
  'collect_1p', 'collect_2p', 'collect_3p', 'collect_4p', 'collect_5p', 'collect_6p', 'coll_nb_ch',
  'indiv_1_piece', 'indiv_2_pieces', 'indiv_3_pieces', 'indiv_4_pieces', 'indiv_5_pieces', 'indiv_6_pieces',
  'indiv_nb_total_logts', 'nb_chambre_accueil', 'nb_pieces_creees', 'nb_logts_crees',
  'nature_travaux', 'details_travaux', 'nature_signature', 'destination',
]);

/** The one board a file has, as the archive store names a register's boards. */
export const MMM_BOARD = 'decisions';

/** What the archive store checks a stored file against: one register for every commune. */
export const MMM_ARCHIVE_INSTANCE = Object.freeze({ key: 'mmm' });

/**
 * Each row with its rank among the rows that say the same thing, in `objectid`
 * order (Trap 5): the second of two identical rows is `rank: 1`, so a new row
 * identical to one already kept is still new.
 * @param {Array<Record<string, ?string>>} rows From {@link parseMmmCsv}.
 * @returns {Array<Record<string, ?string|number>>}
 */
export function rankMmmRows(rows) {
  const seen = new Map();
  return [...rows].filter((row) => Number.isFinite(Number(row.objectid)))
    .sort((a, b) => Number(a.objectid) - Number(b.objectid))
    .map((row) => {
      const said = JSON.stringify(MMM_IDENTITY.map((name) => row[name] ?? null));
      const rank = seen.get(said) ?? 0;
      seen.set(said, rank + 1);
      return { ...row, rank };
    });
}

/**
 * One row as the archive stores it, or null for a form the layer does not
 * draw: what it says, then its rank among its twins.
 * @param {Record<string, ?string|number>} row From {@link rankMmmRows}.
 * @returns {?Array<?string>}
 */
export function scrubMmmRow(row) {
  if (!row || !mmmKind(row.modele)) return null;
  return [...MMM_IDENTITY.map((name) => row[name] ?? null), String(row.rank ?? 0)];
}

/** How the archive store reads and keeps a file's rows (`createCartdsArchiveStore`'s `kind`). */
export const MMM_ROWS = Object.freeze({
  board: (board) => board === MMM_BOARD,
  scrub: scrubMmmRow,
});

/**
 * The French day an edition was written, from its `Last-Modified`, or null.
 * The export lands at 05:00 UTC; the day is the one the métropole was living.
 * @param {?string} lastModified An HTTP date.
 * @returns {?string} `YYYY-MM-DD`.
 */
export function mmmEditionDay(lastModified) {
  const at = Date.parse(String(lastModified ?? ''));
  return Number.isFinite(at) ? cartdsDay(new Date(at)) : null;
}

/**
 * One year of rows is about 5.5 % of the stock (2 309 rows filed in 2024 of
 * Montpellier's 41 742), so an edition that adds more than 2 % of the rows
 * already kept — four months of work in one night — did not record that many
 * decisions: the export was rebuilt or reworded, and its new rows say nothing
 * about when. The floor keeps a small commune's one large lotissement dated.
 */
export const MMM_REBASE_SHARE = 0.02;
export const MMM_REBASE_FLOOR = 100;

/**
 * The day each archived row first appeared, for the rows that date anything
 * (Trap 5): not the first edition's — the stock — and not an edition that
 * added more than {@link MMM_REBASE_SHARE} of the rows already kept.
 *
 * @param {object} archive A commune's archive (`cartdsArchive.js`).
 * @returns {{postedOn: (row: object) => ?string, rebased: Array<string>}}
 *   `postedOn` takes a row from {@link rankMmmRows}; `rebased` lists the
 *   editions whose rows are undated, the first one included.
 */
export function mmmPostedOn(archive) {
  const stored = archive?.rows ?? [];
  const added = new Map();
  for (const row of stored) added.set(row.first, (added.get(row.first) ?? 0) + 1);
  const rebased = [];
  let kept = 0;
  for (const day of [...added.keys()].sort()) {
    const count = added.get(day);
    if (!kept || day <= archive.firstDay || count > Math.max(MMM_REBASE_FLOOR, kept * MMM_REBASE_SHARE)) rebased.push(day);
    kept += count;
  }
  const undated = new Set(rebased);
  const days = new Map();
  for (const row of stored) if (!undated.has(row.first)) days.set(JSON.stringify(row.cells), row.first);
  return {
    postedOn: (row) => {
      const cells = scrubMmmRow(row);
      return cells ? days.get(JSON.stringify(cells)) ?? null : null;
    },
    rebased,
  };
}

/** The attributes the rows of one dossier share. */
const SAME = Object.freeze([
  'modele', 'annee_depot', 'shon_global', 'nature_travaux', 'details_travaux', 'nature_signature', 'nb_logts_crees',
]);

/** A number cell, or null. */
function value(cell) {
  const parsed = Number(String(cell ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The file's rows as dossiers (Trap 1): consecutive `objectid`s — at most
 * three apart — with the same attributes are one dossier, its parcels each
 * row's. Rows of a form the layer does not draw (`Pré Projet`) are left out.
 *
 * A dossier is dated (`postedOn`, Trap 5) only when every one of its rows is,
 * and with the earliest of their days.
 *
 * @param {Array<Record<string, ?string>>} rows From {@link parseMmmCsv} or
 *   {@link rankMmmRows}.
 * @param {object} commune One of {@link MMM_COMMUNES}.
 * @param {{postedOn?: (row: object) => ?string}} [archive] From {@link mmmPostedOn}.
 * @returns {Array<object>} The shape every source of the layer is normalised
 *   into, `point` holding the file's Lambert-93 point for a dossier the
 *   cadastre cannot place.
 */
export function foldMmmRows(rows, commune, { postedOn = () => null } = {}) {
  const sorted = [...rows].filter((row) => Number.isFinite(Number(row.objectid)))
    .sort((a, b) => Number(a.objectid) - Number(b.objectid));
  const groups = [];
  for (const row of sorted) {
    const last = groups.at(-1);
    const previous = last?.rows.at(-1);
    if (previous && Number(row.objectid) - Number(previous.objectid) <= 3
      && SAME.every((field) => row[field] === previous[field])) last.rows.push(row);
    else groups.push({ rows: [row] });
  }
  const label = mmmLabel(commune);
  const out = [];
  for (const { rows: members } of groups) {
    const [first] = members;
    const kind = mmmKind(first.modele);
    const year = Number(first.annee_depot);
    if (!kind || !Number.isInteger(year)) continue;
    const series = seriesOfKind(kind);
    const parcelIdus = [];
    for (const member of members) {
      const parcel = mmmParcel(member.code_parcelle);
      if (parcel && !parcelIdus.some((known) => known.idu === parcel.idu)) parcelIdus.push(parcel);
    }
    const x = Number(first.x);
    const y = Number(first.y);
    const days = members.map((member) => postedOn(member));
    out.push({
      id: `mmm:${commune.insee}:${first.objectid}`,
      dossier: null,
      series,
      key: `${series}|MMM${commune.insee}${first.objectid}`,
      kind,
      kindLabel: ADS_KINDS[kind] ?? kind,
      // Trap 3: favourable decisions only.
      state: 'accorde',
      stateLabel: ADS_STATE_WORDS.definition.accorde.fr,
      depositedOn: null,
      decidedOn: null,
      postedOn: days.every(Boolean) ? days.sort()[0] : null,
      startedOn: null,
      completedOn: null,
      depositYear: year,
      applicant: null,
      purpose: first.details_travaux ?? first.nature_travaux ?? ADS_KINDS[kind] ?? kind,
      address: null,
      postcode: null,
      commune: commune.name,
      communeCode: commune.insee,
      cadastreCommune: commune.insee,
      parcels: parcelIdus.map((ref) => ref.label),
      parcelIdus,
      landAreaM2: null,
      housing: value(first.nb_logts_crees),
      surfaceCreatedM2: value(first.shon_global),
      lon: null,
      lat: null,
      precision: null,
      geocodeScore: null,
      parts: null,
      point: Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null,
      source: 'mmm-open-data',
      sourceLabel: label,
    });
  }
  return out;
}

/** Whole days from `from` to `to`, two `YYYY-MM-DD`. */
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The dossiers Sitadel does not already hold (Trap 2): same family, a parcel
 * in common, and Sitadel's filing year the file's or the one before.
 *
 * A twin is also the one measure of Trap 5's date: Sitadel knows the day the
 * permit was granted, the archive the day the export first held it. `lags`
 * holds, per dated twin, the days from the first to the second — the nearest
 * Sitadel decision when several share the parcel.
 *
 * @param {Array<object>} permits From {@link foldMmmRows}.
 * @param {Array<object>} sitadel Sitadel's normalised rows for the commune.
 * @returns {{permits: Array<object>, twins: number, lags: Array<number>}}
 */
export function dropSitadelTwins(permits, sitadel) {
  const byParcel = new Map();
  for (const row of sitadel) {
    for (const ref of row.parcelIdus ?? []) {
      if (!byParcel.has(ref.idu)) byParcel.set(ref.idu, []);
      byParcel.get(ref.idu).push(row);
    }
  }
  const kept = [];
  const lags = [];
  let twins = 0;
  for (const permit of permits) {
    const matches = permit.parcelIdus.flatMap((ref) => (byParcel.get(ref.idu) ?? []).filter((row) => row.kind === permit.kind
      && Number.isInteger(row.depositYear) && row.depositYear <= permit.depositYear && row.depositYear >= permit.depositYear - 1));
    if (!matches.length) { kept.push(permit); continue; }
    twins += 1;
    const gaps = permit.postedOn
      ? matches.filter((row) => /^\d{4}-\d{2}-\d{2}/.test(row.decidedOn ?? '')).map((row) => daysBetween(row.decidedOn.slice(0, 10), permit.postedOn))
      : [];
    if (gaps.length) lags.push(gaps.sort((a, b) => Math.abs(a) - Math.abs(b))[0]);
  }
  return { permits: kept, twins, lags };
}

/**
 * Trap 5's date, measured: how many dated twins, the median and the largest
 * number of days from Sitadel's decision to the export, or null before any.
 * @param {Array<number>} lags From {@link dropSitadelTwins}.
 * @returns {?{dossiers: number, medianDays: number, maxDays: number}}
 */
export function mmmLagSummary(lags) {
  if (!lags?.length) return null;
  const sorted = [...lags].sort((a, b) => a - b);
  return { dossiers: sorted.length, medianDays: sorted[Math.floor((sorted.length - 1) / 2)], maxDays: sorted.at(-1) };
}
