// src/data/mmmPermitsFeed.test.mjs
// Pins the shape of Montpellier Méditerranée Métropole's « Permis de
// construire de <commune> » files as exported on 2026-10-01: anonymised, one
// row per parcel, no dossier number. The rows below are made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MMM_ARCHIVE_INSTANCE,
  MMM_BOARD,
  MMM_COMMUNES,
  MMM_ROWS,
  dropSitadelTwins,
  foldMmmRows,
  mmmCommuneFor,
  mmmCsvUrl,
  mmmEditionDay,
  mmmKind,
  mmmLagSummary,
  mmmParcel,
  mmmPostedOn,
  parseMmmCsv,
  rankMmmRows,
  scrubMmmRow,
} from './mmmPermitsFeed.js';
import { emptyCartdsArchive, recordCartdsBoards } from './cartdsArchive.js';
import { COMMUNE_CODE_PATTERN } from './communeCode.js';

const HEADER = 'objectid,modele,annee_depot,nom_commune,code_parcelle,shon_global,nature_travaux,details_travaux,nature_signature,nb_logts_crees,codcomm,x,y';
const line = (id, modele, year, parcel, extra = {}) => [
  id, modele, year, 'MONTPELLIER', parcel, extra.shon ?? '-', extra.nature ?? 'Travaux sur construction existante',
  extra.details ?? '-', 'Favorable', extra.logts ?? '-', '340172', '768489.05', '6283221.87',
].join(',');

test('the file reads as rows, its byte-order mark, quotes and blanks understood', () => {
  const rows = parseMmmCsv(`﻿${HEADER}\r\n${line(1, 'Permis de Construire', 2025, '340172   AC0013', { details: '"Extension, garage"' })}\r\n`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].details_travaux, 'Extension, garage');
  assert.equal(rows[0].shon_global, null);
  assert.deepEqual(parseMmmCsv('no,header\n1,2'), []);
});

test('a form is a family, and a parcel is keyed as the cadastre keys it', () => {
  assert.equal(mmmKind('Permis de Construire Maison Individuelle'), 'PC');
  assert.equal(mmmKind('Déclaration Préalable Lotissement'), 'DP');
  assert.equal(mmmKind('Permis d\'Aménager'), 'PA');
  assert.equal(mmmKind('Permis de Démolir'), 'PD');
  assert.equal(mmmKind('Certificat d\'Urbanisme Type B'), 'CU');
  assert.equal(mmmKind('Pré Projet'), null);
  assert.deepEqual(mmmParcel('340172   AC0013'), { idu: '34172000AC0013', provisional: false, label: 'AC13' });
  assert.deepEqual(mmmParcel('340129012AB0001').idu, '34129012AB0001');
  assert.equal(mmmParcel('garbage'), null);
});

test('consecutive rows with the same attributes are one dossier, its parcels each row\'s', () => {
  const commune = mmmCommuneFor('34172');
  const rows = parseMmmCsv([
    HEADER,
    line(100, 'Permis de Construire', 2025, '340172   AC0013', { shon: '120', logts: '2' }),
    line(101, 'Permis de Construire', 2025, '340172   AC0014', { shon: '120', logts: '2' }),
    // Same attributes, but five ids on: another dossier.
    line(106, 'Permis de Construire', 2025, '340172   AC0015', { shon: '120', logts: '2' }),
    line(107, 'Déclaration Préalable', 2025, '340172   AC0016'),
    line(108, 'Pré Projet', 2025, '340172   AC0017'),
  ].join('\n'));
  const permits = foldMmmRows(rows, commune);
  assert.deepEqual(permits.map((permit) => [permit.kind, permit.parcelIdus.map((ref) => ref.idu).join('+'), permit.housing, permit.surfaceCreatedM2]), [
    ['PC', '34172000AC0013+34172000AC0014', 2, 120],
    ['PC', '34172000AC0015', 2, 120],
    ['DP', '34172000AC0016', null, null],
  ]);
  const [first] = permits;
  assert.deepEqual([first.id, first.key, first.state, first.depositYear, first.dossier, first.depositedOn],
    ['mmm:34172:100', 'DAU|MMM34172100', 'accorde', 2025, null, null]);
  assert.deepEqual(first.point, { x: 768489.05, y: 6283221.87 });
});

test('a dossier Sitadel already holds on the same parcel is dropped, not drawn twice', () => {
  const commune = mmmCommuneFor('34172');
  const [pc, dp] = foldMmmRows(parseMmmCsv([
    HEADER,
    line(1, 'Permis de Construire', 2025, '340172   AC0013'),
    line(9, 'Déclaration Préalable', 2025, '340172   AC0013'),
  ].join('\n')), commune);
  const sitadel = (kind, year) => ({ kind, depositYear: year, parcelIdus: [{ idu: '34172000AC0013' }] });
  assert.deepEqual(dropSitadelTwins([pc, dp], [sitadel('PC', 2025)]), { permits: [dp], twins: 1, lags: [] });
  // A modification is filed in its own year here, in the original's in Sitadel.
  assert.equal(dropSitadelTwins([pc], [sitadel('PC', 2024)]).twins, 1);
  assert.equal(dropSitadelTwins([pc], [sitadel('PC', 2023)]).twins, 0);
  assert.equal(dropSitadelTwins([pc], [{ ...sitadel('PC', 2025), parcelIdus: [{ idu: '34172000AC0099' }] }]).twins, 0);
});

test('the registry names 28 communes and their files', () => {
  assert.equal(MMM_COMMUNES.length, 28);
  for (const commune of MMM_COMMUNES) assert.match(commune.insee, COMMUNE_CODE_PATTERN);
  assert.equal(mmmCsvUrl(mmmCommuneFor('34129')), 'https://data.montpellier3m.fr/sites/default/files/ressources/Lattes_MMM_PermisConst.csv');
  assert.equal(mmmCommuneFor('75056'), null);
});

/* ── Trap 5: the archive dates what the file cannot ─────────────────────────── */

const HEADER_FULL = `${HEADER},annee_parcelle`;
/** One row of an edition: the id and the point are the export's, the rest is what the row says. */
const row5 = (id, modele, year, parcel, extra = {}) => `${line(id, modele, year, parcel, extra)},${extra.parcelYear ?? '2026'}`
  .replace('768489.05', extra.x ?? '768489.05');
const edition = (lines) => rankMmmRows(parseMmmCsv([HEADER_FULL, ...lines].join('\n')));
/** The archive after these editions, in order, as the store would have written it. */
function archiveOf(...editions) {
  let archive = emptyCartdsArchive(MMM_ARCHIVE_INSTANCE, '34172');
  for (const [day, rows] of editions) archive = recordCartdsBoards(archive, { [MMM_BOARD]: rows }, day, MMM_ROWS).archive;
  return archive;
}

test('a row is known by what it says: not its id, its point or its parcel\'s year', () => {
  const [a] = edition([row5(100, 'Permis de Construire', 2025, '340172   AC0013')]);
  const [b] = edition([row5(85000001, 'Permis de Construire', 2025, '340172   AC0013', { x: '768490.00', parcelYear: '2027' })]);
  assert.deepEqual(scrubMmmRow(a), scrubMmmRow(b));
  assert.equal(scrubMmmRow(edition([row5(1, 'Pré Projet', 2025, '340172   AC0013')])[0]), null);
  // Two rows that say the same thing are the first and the second of their kind.
  const twins = edition([
    row5(7, 'Permis de Construire', 2025, '340172   AC0013'),
    row5(5, 'Permis de Construire', 2025, '340172   AC0013'),
  ]);
  assert.deepEqual(twins.map((row) => [row.objectid, row.rank]), [['5', 0], ['7', 1]]);
  assert.notDeepEqual(scrubMmmRow(twins[0]), scrubMmmRow(twins[1]));
});

test('an edition is dated by the day it was written, in France', () => {
  assert.equal(mmmEditionDay('Thu, 01 Oct 2026 05:00:21 GMT'), '2026-10-01');
  assert.equal(mmmEditionDay('Wed, 30 Sep 2026 22:30:00 GMT'), '2026-10-01');
  assert.equal(mmmEditionDay(null), null);
  assert.equal(mmmEditionDay('yesterday'), null);
});

test('a dossier that appears after the first edition is granted at the latest on that edition\'s day', () => {
  const commune = mmmCommuneFor('34172');
  // The stock: two hundred dossiers the first edition already held.
  const stock = Array.from({ length: 200 }, (_, i) => row5(1000 + 10 * i, 'Permis de Construire', 2024, `340172   AB${String(i).padStart(4, '0')}`));
  const first = edition(stock);
  // The next night, every id renumbered, and one new dossier on two parcels.
  const second = edition([
    ...stock.map((text, i) => text.replace(/^\d+/, String(85000000 + 10 * i))),
    row5(86000000, 'Permis de Construire', 2026, '340172   AC0001', { shon: '90' }),
    row5(86000001, 'Permis de Construire', 2026, '340172   AC0002', { shon: '90' }),
  ]);
  const archive = archiveOf(['2026-10-01', first], ['2026-10-02', second]);
  const { postedOn, rebased } = mmmPostedOn(archive);
  assert.deepEqual(rebased, ['2026-10-01']);
  const dossiers = foldMmmRows(second, commune, { postedOn });
  assert.equal(dossiers.length, 201);
  const dated = dossiers.filter((permit) => permit.postedOn);
  assert.deepEqual(dated.map((permit) => [permit.parcels.join('+'), permit.postedOn, permit.decidedOn]),
    [['AC1+AC2', '2026-10-02', null]]);
  // Read again the same day, the same edition dates nothing more.
  const again = archiveOf(['2026-10-01', first], ['2026-10-02', second], ['2026-10-02', second]);
  assert.equal(foldMmmRows(second, commune, mmmPostedOn(again)).filter((permit) => permit.postedOn).length, 1);
});

test('a dossier half of whose rows the stock held is not dated, and neither is a rebuilt export', () => {
  const commune = mmmCommuneFor('34172');
  const stock = Array.from({ length: 200 }, (_, i) => row5(1000 + 10 * i, 'Déclaration Préalable', 2024, `340172   AB${String(i).padStart(4, '0')}`));
  // A parcel added to an old dossier: one row old, one new — the fold cannot tell when it was granted.
  const grown = edition([
    ...stock,
    row5(1001, 'Déclaration Préalable', 2024, '340172   AZ0001'),
  ]);
  const archive = archiveOf(['2026-10-01', edition(stock)], ['2026-10-02', grown]);
  const dossiers = foldMmmRows(grown, commune, mmmPostedOn(archive));
  assert.equal(dossiers.find((permit) => permit.parcels.includes('AZ1')).postedOn, null);
  // An edition that rewrites every row (here, a reworded nature) dates none of them.
  const reworded = edition(stock.map((text) => text.replace('Travaux sur construction existante', 'Travaux sur existant')));
  const rebuilt = archiveOf(['2026-10-01', edition(stock)], ['2026-10-02', reworded]);
  const answer = mmmPostedOn(rebuilt);
  assert.deepEqual(answer.rebased, ['2026-10-01', '2026-10-02']);
  assert.equal(foldMmmRows(reworded, commune, answer).filter((permit) => permit.postedOn).length, 0);
});

test('a dated twin measures how late the export is against Sitadel\'s decision', () => {
  const commune = mmmCommuneFor('34172');
  const [pc] = foldMmmRows(parseMmmCsv([HEADER, line(1, 'Permis de Construire', 2026, '340172   AC0013')].join('\n')), commune);
  const dated = { ...pc, postedOn: '2026-10-02' };
  const sitadel = (decidedOn) => ({ kind: 'PC', depositYear: 2026, decidedOn, parcelIdus: [{ idu: '34172000AC0013' }] });
  assert.deepEqual(dropSitadelTwins([dated], [sitadel('2026-09-28'), sitadel('2026-06-01')]).lags, [4]);
  assert.deepEqual(dropSitadelTwins([pc], [sitadel('2026-09-28')]).lags, []);
  assert.deepEqual(dropSitadelTwins([dated], [sitadel(null)]).lags, []);
  assert.deepEqual(mmmLagSummary([4, 1, 9]), { dossiers: 3, medianDays: 4, maxDays: 9 });
  assert.equal(mmmLagSummary([]), null);
});
