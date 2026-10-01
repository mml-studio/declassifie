// src/data/mmmPermitsFeed.test.mjs
// Pins the shape of Montpellier Méditerranée Métropole's « Permis de
// construire de <commune> » files as exported on 2026-10-01: anonymised, one
// row per parcel, no dossier number. The rows below are made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MMM_COMMUNES,
  dropSitadelTwins,
  foldMmmRows,
  mmmCommuneFor,
  mmmCsvUrl,
  mmmKind,
  mmmParcel,
  parseMmmCsv,
} from './mmmPermitsFeed.js';
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
  assert.deepEqual(dropSitadelTwins([pc, dp], [sitadel('PC', 2025)]), { permits: [dp], twins: 1 });
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
