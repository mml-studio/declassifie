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
 * No filing day, no decision day: a card says « granted » and nothing about
 * when, and the scan's window cuts on the year. The file holds favourable
 * decisions only — nothing under review, no refusal.
 *
 * ── Trap 4: the déclarations préalables have all but stopped ────────────────
 * 1 535 DP rows filed in 2024, 177 in 2025, one in 2026, at Montpellier and
 * at Lattes alike: something upstream stopped exporting them. A quiet block
 * here says nothing about the work done in it.
 *
 * Dependency-free and side-effect-free: parsing and normalisation only. The
 * `/api/ads-fr` proxy imports it.
 */

import { foldToCommune } from './communeCode.js';
import { ADS_KINDS, seriesOfKind } from './adsFeed.js';
import { ADS_STATE_WORDS } from './adsFeed.i18n.js';

/** How the files are licensed: share-alike on a derived database, so they are read per scan and never bundled. */
export const MMM_LICENCE = 'ODbL 1.0';

/**
 * The communes that publish the file, by the name their file goes by. 28 of
 * the métropole's 31 on 2026-10-01; Baillargues and Castelnau-le-Lez are
 * instructed outside it, and Villeneuve-lès-Maguelone publishes none.
 */
// i18n-ignore-start — commune names, proper nouns relayed as published
export const MMM_COMMUNES = Object.freeze([
  ['34172', 'Montpellier', 'Montpellier'], ['34027', 'Beaulieu', 'Beaulieu'], ['34058', 'Castries', 'Castries'],
  ['34077', 'Clapiers', 'Clapiers'], ['34087', 'Cournonsec', 'Cournonsec'], ['34088', 'Cournonterral', 'Cournonterral'],
  ['34090', 'Cres', 'Le Crès'], ['34095', 'Fabregues', 'Fabrègues'], ['34116', 'Grabels', 'Grabels'],
  ['34120', 'Jacou', 'Jacou'], ['34123', 'Juvignac', 'Juvignac'], ['34129', 'Lattes', 'Lattes'],
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
 * @param {Array<Record<string, ?string>>} rows From {@link parseMmmCsv}.
 * @param {object} commune One of {@link MMM_COMMUNES}.
 * @returns {Array<object>} The shape every source of the layer is normalised
 *   into, `point` holding the file's Lambert-93 point for a dossier the
 *   cadastre cannot place.
 */
export function foldMmmRows(rows, commune) {
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
      postedOn: null,
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

/**
 * The dossiers Sitadel does not already hold (Trap 2): same family, a parcel
 * in common, and Sitadel's filing year the file's or the one before.
 *
 * @param {Array<object>} permits From {@link foldMmmRows}.
 * @param {Array<object>} sitadel Sitadel's normalised rows for the commune.
 * @returns {{permits: Array<object>, twins: number}}
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
  let twins = 0;
  for (const permit of permits) {
    const twin = permit.parcelIdus.some((ref) => (byParcel.get(ref.idu) ?? []).some((row) => row.kind === permit.kind
      && Number.isInteger(row.depositYear) && row.depositYear <= permit.depositYear && row.depositYear >= permit.depositYear - 1));
    if (twin) twins += 1;
    else kept.push(permit);
  }
  return { permits: kept, twins };
}
