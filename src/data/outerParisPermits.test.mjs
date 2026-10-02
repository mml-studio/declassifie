import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OUTER_PARIS_PROTOCOLS as protocols, OUTER_PARIS_READERS as readers } from './outerParisPermits.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';
import { boardProtocol } from './permitBoards.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((item) => item.key === key);
const options = { since: '2026-09-01', day: '2026-10-02' };
const run = (text, x, y, x1 = x + text.length * 3) => ({ text, x, x1, y, size: 7 });
const centred = (text, x, y) => run(text, x - text.length * 1.5, y, x + text.length * 1.5);
const read = (key, layout, runs, file = {}) => readers[layout]({ pages: [{ runs }] }, { city: city(key), file });
const stored = (key, row) => normalisePermitListRow(city(key), row.board, scrubPermitListRow(row));
const notice = (lines) => lines.map((line, i) => run(line, 30, 750 - i * 18));

test('eight outer Paris municipalities have one registered, reachable protocol', () => {
  for (const key of ['pontault-combault', 'rambouillet', 'villepreux', 'igny', 'vaureal', 'la-celle-saint-cloud', 'le-mee-sur-seine', 'crosne']) {
    const source = city(key);
    assert.equal(permitListFor(source.insee), source);
    assert.equal(boardProtocol(source), protocols[source.source.protocol]);
    assert.ok(boardProtocol(source).start(source, options).length);
  }
});

test('Pontault repeats the header with shifted columns between DP and PC, without dropping calendar dates', () => {
  const labels = ['Réf.', 'Dépôt', 'Demandeur', 'Nature des travaux', 'Lieux des travaux', 'Surface de plancher', 'Affiché le'];
  const band = (y, shift, values) => [
    ...labels.map((label, i) => centred(label, 70 + 125 * i + shift, y)),
    ...values.map((value, i) => centred(value, 70 + 125 * i + shift, y - 30)),
  ];
  const rows = read('pontault-combault', 'outer-pontault-filings', [
    ...band(700, 0, ['DP773732600247', '22/09/2026', 'PRIVATE PERSON', 'Clôture', '12 Rue Exemple', '0', '28/09/2026']),
    ...band(500, 16, ['PC773732100037M03', '21/09/2026', 'PRIVATE PERSON', 'Extension', '18 Rue Exemple', '24,5', '28/09/2026']),
    run('1 / 2', 700, 20),
  ], { board: 'filings' });
  assert.deepEqual(rows.map(({ dossier, address, filedOn, postedOn, floorArea }) => [dossier, address, filedOn, postedOn, floorArea]), [
    ['DP 077373 26 00247', '12 Rue Exemple', '2026-09-22', '2026-09-28', '0'],
    ['PC 077373 21 00037 M03', '18 Rue Exemple', '2026-09-21', '2026-09-28', '24.5'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), /PRIVATE|PERSON/);
  assert.deepEqual(read('pontault-combault', 'outer-pontault-filings', notice(['DP773732600247', '12 Rue Exemple']), { board: 'filings' }), []);
});

test('Pontault decisions combine the house number and street, keeping the filing and signing days distinct', () => {
  const labels = ['Réf.', 'Dépôt', 'Demandeur', 'Nature travaux', 'N° voirie', 'Adresse des travaux', 'Date décision', 'Surface de plancher', 'Affiché le'];
  const values = ['DP773732600200', '01/08/2026', 'PRIVATE PERSON', 'Clôture', '15', 'Rue Exemple', '24/09/2026', '0', '28/09/2026'];
  const [row] = read('pontault-combault', 'outer-pontault-decisions', [
    ...labels.map((label, i) => centred(label, 60 + 110 * i, 700)),
    ...values.map((value, i) => centred(value, 60 + 110 * i, 670)),
  ], { board: 'decisions' });
  assert.deepEqual([row.address, row.filedOn, row.decidedOn, row.postedOn], ['15 Rue Exemple', '2026-08-01', '2026-09-24', '2026-09-28']);
});

test('Rambouillet separates a wrapped project description, parcels and the applicant from its site', () => {
  const labels = ['REFERENCE DOSSIER', 'DEMANDE', 'DEPOT', 'DECISION', 'DEMANDEUR', 'TERRAIN', 'PARCELLES', 'NATURE DES TRAVAUX', 'SURF.', 'SURF.', 'NB.', 'NIV.'];
  const x = [10, 130, 190, 255, 325, 440, 560, 635, 790, 850, 910, 960];
  const values = ['DP 078517 26 00260', 'DP', '22/09/2026', '', 'PRIVATE PERSON', '12 Rue Exemple', 'AS 438', 'Ravalement de', '0', '600', '0', '0'];
  const [row] = read('rambouillet', 'outer-rambouillet-filings', [
    ...labels.map((label, i) => run(label, x[i], 700)),
    ...values.flatMap((value, i) => value ? [run(value, x[i], 670)] : []),
    run('la façade', 635, 660), run('Page 1', 10, 20),
  ], { board: 'filings' });
  assert.deepEqual([row.address, row.parcels, row.purpose, row.filedOn, row.applicant],
    ['12 Rue Exemple', 'AS 438', 'Ravalement de la façade', '2026-09-22', null]);
});

test('Vauréal keeps cadastral references on their own line and a refusal remains refused', () => {
  const [row] = read('vaureal', 'outer-vaureal-decisions', [
    run('Numéro de', 60, 700), run('dossier', 60, 690), run('Pétitionnaire', 200, 700),
    run('Décision', 350, 700), run('Date de', 440, 700), run('décision', 440, 690),
    run('Nature des travaux', 580, 700), run('Adresse des travaux', 790, 700),
    run('DP 095637 26 00100', 30, 670), run('PRIVATE PERSON', 160, 670), run('Refus', 320, 670),
    run('24/09/2026', 420, 670), run('Clôture', 530, 670), run('12 Rue Exemple', 740, 670), run('DM 166', 740, 658),
  ], { board: 'decisions' });
  assert.deepEqual([row.address, row.parcels, row.decidedOn, row.verdict, row.applicant],
    ['12 Rue Exemple', 'DM 166', '2026-09-24', 'Refus', null]);
  assert.equal(stored('vaureal', row).state, 'refuse');
});

test('individual orders use the project address and operative article, with dotted dates and an explicit signature', () => {
  const [row] = read('igny', 'outer-notice', notice([
    'ARRÊTÉ', 'N° DP 091312 26 10105', 'Demande déposée le 04.07.2026',
    'Demeurant à : 99 Rue Private', 'Sur un terrain sis à : 17 Rue Exemple',
    'Vu un précédent refus du 01/05/2026',
    "ARTICLE 1 : La déclaration citée en référence n'appelle pas d'opposition de ma part.",
    'Conditions techniques '.repeat(40), 'ARTICLE 2 : Dispositions administratives.',
    'IGNY, le 09/09/2026', 'Document publié le 25/09/2026',
  ]), { board: 'decisions', published: '2026-09-01', monthOnly: true });
  assert.deepEqual([row.address, row.filedOn, row.decidedOn, row.postedOn, row.verdict],
    ['17 Rue Exemple', '2026-07-04', '2026-09-09', '2026-09-25', 'Non-opposition']);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /Private|précédent/);
  assert.equal(stored('igny', row).state, 'accorde');
});

test('a month directory supplies no exact posting date and an unread verdict supplies no grant', () => {
  const [row] = read('crosne', 'outer-notice', notice([
    'ARRÊTÉ', 'N° DP 091191 26 10061', 'Demande déposée le 22/09/2026',
    'Sur un terrain sis à : 5 Rue Exemple', 'ARTICLE 1 : Le texte est illisible.',
  ]), { board: 'decisions', published: '2026-09-01', monthOnly: true });
  assert.equal(row.postedOn, null);
  assert.equal(row.decidedOn, null);
  assert.equal(row.verdict, 'Décision signée');
  assert.notEqual(stored('crosne', row).state, 'accorde');
  assert.deepEqual(read('crosne', 'outer-notice', notice([
    'ARRÊTÉ', 'N° DP 091191 26 10061', 'Demeurant à : 99 Rue Private',
  ]), { board: 'decisions' }), []);
});

test('index numbers preserve amendments, exclude conflicting documents and reject future OCR dates', () => {
  const document = notice(['ARRÊTÉ', 'N° DP 091312 24 10151', 'Demande déposée le 04/09/2026',
    'Sur un terrain sis à : 5 Rue Exemple', 'ARTICLE 1 : Les travaux sont autorisés.', 'IGNY, le 29/09/2029']);
  const file = { board: 'decisions', dossier: 'DP 091312 24 10151 M01', published: '2026-09-21', asOf: '2026-10-02' };
  const [row] = read('igny', 'outer-notice', document, file);
  assert.equal(row.dossier, file.dossier);
  assert.equal(row.decidedOn, null);
  assert.deepEqual(read('igny', 'outer-notice', document, { ...file, dossier: 'DP 091312 26 10105' }), []);
  const [padded] = read('villepreux', 'outer-notice', notice(['ARRÊTÉ', 'N° DP 078674 26 E0118',
    'Sur un terrain sis à : 5 Rue Exemple', 'ARTICLE 1 : Les travaux sont autorisés.']),
  { board: 'decisions', dossier: 'DP 078674 26 E118' });
  assert.equal(padded.dossier, 'DP 078674 26 E0118');
});

test('Le Mée reads its split address label without reusing the applicant field', () => {
  const [row] = read('le-mee-sur-seine', 'outer-notice', [
    ...notice(['AVIS DE DEPOT', 'N° DP 077285 26 00069', 'Date de dépôt : 30/09/2026', 'Demandeur PRIVATE PERSON']),
    run('Adresse', 30, 650), run('du', 70, 650), run('terrain', 30, 638),
    run('629', 170, 650), run('Avenue', 190, 650), run('Exemple', 230, 650),
  ], { board: 'filings', monthOnly: true, published: '2026-09-01' });
  assert.deepEqual([row.address, row.filedOn, row.postedOn, row.applicant], ['629 Avenue Exemple', '2026-09-30', null, null]);
});

test('WordPress weekly documents paginate and fail closed if an announced list is missing', () => {
  const p = protocols['outer-pontault']; const c = city('pontault-combault');
  const [request] = p.start(c, options);
  assert.equal(new URL(request.url).searchParams.get('after'), '2026-09-01T00:00:00');
  const doc = { date: '2026-09-28T08:00:00', title: { rendered: 'A.U DÉPOSÉES' }, content: { rendered: '<a href="/list.pdf">PDF</a>' } };
  const answer = p.index(c, [doc, { ...doc, date: '2026-10-03' }, { ...doc, date: '2025-09-28' }], request, options);
  assert.deepEqual(answer.files.map(({ board, published }) => [board, published]), [['filings', '2026-09-28']]);
  assert.equal(new URL(p.index(c, Array(100).fill(doc), request, options).next[0].url).searchParams.get('page'), '2');
  assert.equal(p.index(c, [{ ...doc, content: { rendered: '' } }], request, options), null);
  assert.equal(p.index(c, { message: 'Login required' }, request, options), null);
});

test('Digilor restricts the tenant, category, dates and permit family, without preserving raw titles', () => {
  const p = protocols['outer-digilor']; const c = city('igny'); const [request] = p.start(c, options);
  const doc = { id_cat: 138, aff_deb: '2026-09-21', nom_affichage: 'DP 26 10105.20260916 PRIVATE PERSON', url_uiid: './upload/22/1789975605_opaque.pdf' };
  const answer = p.index(c, [doc, { ...doc, id_cat: 139 }, { ...doc, aff_deb: '2026-10-03' },
    { ...doc, url_uiid: './upload/319/other.pdf' }, { ...doc, url_uiid: './upload/22/../private.pdf' },
    { ...doc, nom_affichage: 'AT 26 10006' }, { ...doc, nom_affichage: 'DP du 21.09 au 27.09' },
  ], request, options);
  assert.equal(answer.files.length, 1);
  assert.equal(answer.files[0].board, 'decisions');
  assert.equal(answer.files[0].ocr, true);
  assert.doesNotMatch(JSON.stringify(answer), /PRIVATE|PERSON/);
  assert.deepEqual(p.index(c, [], request, options), { files: [] });
  assert.equal(p.index(c, {}, request, options), null);
});

test('public notice pages require a municipal permit PDF and cannot treat traffic orders or a login page as permits', () => {
  const p = protocols['outer-notices']; const c = city('crosne'); const [request] = p.start(c, options);
  const answer = p.index(c, '<a href="/wp-content/uploads/2026/09/avis-de-depot-DP-26-10061.pdf">Avis de dépôt DP 26 10061</a>'
    + '<a href="/traffic.pdf">Arrêté de circulation</a>'
    + '<a href="https://example.org/DP-26-10062.pdf">DP 26 10062</a>'
    + '<a href="/broken%.pdf">Other file</a>', request, options);
  assert.equal(answer.files.length, 1);
  assert.equal(answer.files[0].board, 'filings');
  assert.equal(answer.files[0].monthOnly, true);
  assert.equal(p.index(c, '<html><p>Login required</p></html>', request, options), null);
  assert.equal(protocols['outer-vaureal'].index(city('vaureal'), '<html>Other page</html>', { board: 'filings', url: city('vaureal').page }, options), null);
});
