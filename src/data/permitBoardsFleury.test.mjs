import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fleuryDay, readFleuryFilings } from './permitBoardsFleury.js';
import { BOARD_READERS } from './permitBoards.js';
import { permitListFor, normalisePermitListRow, scrubPermitListRow } from './permitListsFeed.js';
import { postedListFiles, POSTED_LIST_PROTOCOLS } from './permitBoardsPostedLists.js';
import { LOCAL_ADS_PORTALS } from './adsFeed.js';
import { permitClassOfAdsPermit, permitProjectCard } from './permitProjects.js';
import { withLocale } from '../i18n/testing.js';

const city = permitListFor('45147');
const context = { city, file: { published: '2026-10-02' } };
const header = ['Numéro dossier - entier', 'Date de dépôt', 'Adresse - Terrain', 'Nom de la commune', 'Liste des demandeurs', 'Description du projet'];
const cells = ['DP 045 147 26 00164', '46297', '8 rue du Projet 45400', 'FLEURY LES AUBRAIS', 'PRIVATE PERSON 99 rue Private', 'Modification de façade'];
const workbook = (rows = [cells]) => ({ sheet: 'Liste affichage dépôt', rows: [header, ...rows] });
const run = (text, x, y) => ({ text, x, x1: x + text.length * 1.5, y, size: 4 });
const pdfHeader = [...header, 'Date de la décision', 'Décision prise'].map((text, i) => run(text, [63, 116, 161, 281, 325, 583, 693, 739][i], 536));
const pdfRow = (values, y) => values.map((text, i) => run(text, [63, 116, 161, 281, 325, 583, 693, 739][i], y));

test('Fleury keeps the latest XLSX filings and PDF decisions with their full edition day', () => {
  const files = postedListFiles(city, '<a href="/uploads/2026/09/Liste-affichage-depot-25_09_2026.xlsx">Télécharger</a>'
    + '<a href="/uploads/2026/10/Liste-affichage-depot-02_10_2026-11_36_22.xlsx">Télécharger</a>'
    + '<a href="/uploads/2026/10/liste-affichage-02-10-2026.pdf">Télécharger</a>', city.page);
  assert.deepEqual(files.map(({ board, published, format, sheet }) => ({ board, published, format, sheet })), [
    { board: 'filings', published: '2026-10-02', format: 'xlsx', sheet: 'Liste affichage dépôt' },
    { board: 'decisions', published: '2026-10-02', format: undefined, sheet: undefined },
  ]);
  assert.equal(city.underReview, undefined);
  assert.equal(BOARD_READERS['fleury-filings'], readFleuryFilings);
});

test('a verified sheet keeps project cells and converts Windows serials without applicant details', () => {
  const [row] = readFleuryFilings(workbook(), context);
  assert.deepEqual([row.dossier, row.address, row.filedOn, row.purpose, row.applicant],
    ['DP 045147 26 00164', '8 rue du Projet', '2026-10-02', 'Modification de façade', null]);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE|Private|99 rue/);
  const permit = normalisePermitListRow(city, 'filings', row, { current: true });
  assert.equal(permit.state, 'depose');
  const card = () => permitProjectCard({ key: permit.id, type: permit.kind, classId: permitClassOfAdsPermit(permit) });
  assert.equal(card().badge.label, 'Demande déposée');
  assert.equal(withLocale('en', () => card().badge.label), 'Application filed');
});

test('changed sheets, shifted headers, foreign identities and incomplete numbers are withheld', () => {
  assert.deepEqual(readFleuryFilings({ ...workbook(), sheet: 'Another tab' }, context), []);
  assert.deepEqual(readFleuryFilings({ ...workbook(), rows: [[...header].reverse(), cells] }, context), []);
  assert.deepEqual(readFleuryFilings(workbook([
    ['DP 045 234 26 00164', ...cells.slice(1)],
    ['DP 045 147 26 164', ...cells.slice(1)],
    [...cells.slice(0, 3), 'ANOTHER TOWN', ...cells.slice(4)],
    cells.slice(0, 5),
  ]), context), []);
});

test('a conflicting project postcode stays unplaced, and future or invalid dates stay absent', () => {
  const [row] = readFleuryFilings(workbook([[cells[0], '48000', '8 rue du Projet 45430', ...cells.slice(3)]]), context);
  assert.equal(row.address, null);
  assert.equal(row.parcels, null);
  assert.equal(row.filedOn, null);
  assert.equal(fleuryDay('02/10/2026', '2026-10-02'), '2026-10-02');
  for (const value of ['0', '46296.5', '31/02/2026', 'not a date']) assert.equal(fleuryDay(value), null);
});

test('decision columns keep each dossier separate and exclude the adjacent applicant column', () => {
  const values = [cells[0], '18/09/2026', cells[2], cells[3], cells[4], cells[5], '01/10/2026', 'Défavorable'];
  const rows = BOARD_READERS['fleury-decisions']({ pages: [{ runs: [...pdfHeader,
    ...pdfRow(values, 520),
    ...pdfRow(['AT 045 147 26 00001', ...values.slice(1)], 505),
    ...pdfRow(['DP 045 234 26 00002', ...values.slice(1)], 490),
    ...pdfRow(['PC 045 147 26 00023', ...values.slice(1, 6), '03/10/2026', 'Favorable'], 475),
  ] }] }, context);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => [r.dossier, r.decidedOn]), [['DP 045147 26 00164', '2026-10-01'], ['PC 045147 26 00023', null]]);
  assert.equal(normalisePermitListRow(city, 'decisions', rows[0]).state, 'refuse');
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|Private|AT 045|045234/);
});

test('Guipavas uses only the newest register pair, without claiming current instruction or reading unrelated acts', () => {
  const source = permitListFor('29075');
  const protocol = POSTED_LIST_PROTOCOLS['wp-media'];
  const request = protocol.start(source, { since: '2026-08-04' })[0];
  const media = (name, date) => ({ source_url: `https://guipavas.bzh/app/uploads/1/2026/10/${name}.pdf`, date: `${date}T15:00:00`, title: { rendered: '' } });
  const result = protocol.index(source, [media('20261002_Liste-des-avis-de-depot', '2026-10-02'),
    media('20260925_Liste-des-avis-de-depot', '2026-09-25'), media('20261002_Liste-des-decisions', '2026-10-02'),
    media('DP0290752600001-arrete', '2026-10-02')], request, { day: '2026-10-04' });
  assert.deepEqual(result.files.map(({ board, published, ocr }) => [board, published, ocr]),
    [['filings', '2026-10-02', undefined], ['decisions', '2026-10-02', undefined]]);
  assert.equal(source.underReview, undefined);
  assert.ok(!LOCAL_ADS_PORTALS.find((portal) => portal.key === 'brest').communes.includes('29075'));
});
