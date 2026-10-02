import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIST_BOARD_PROTOCOLS, LIST_BOARD_READERS, alesIdemSite, dayWithoutYear, listParcelCell, listVerdict, verdictCell,
} from './permitBoardsLists.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const KEYS = ['garges', 'blanc-mesnil', 'troyes', 'bourges', 'cergy', 'ales'];
/** A run under a cell's clipping rectangle, as Word draws it. */
const cellRun = (text, x, y, clip) => ({ text, x, x1: x + text.length * 4, y, size: 9, clip });
/** A run with no rectangle, as « Print To PDF » draws it. */
const run = (text, x, y) => ({ text, x, x1: x + text.length * 4, y, size: 8, clip: null });
const read = (key, layout, runs) => LIST_BOARD_READERS[layout]({ pages: [{ runs }] }, { city: city(key) });
const stored = (key, row) => normalisePermitListRow(city(key), row.board, scrubPermitListRow(row));

test('the six list cities are in the permit registry, each with its protocol', () => {
  for (const key of KEYS) {
    assert.equal(permitListFor(city(key).insee), city(key));
    assert.equal(city(key).source.kind, 'board');
    assert.equal(typeof LIST_BOARD_PROTOCOLS[key].start, 'function');
    assert.equal(typeof LIST_BOARD_PROTOCOLS[key].index, 'function');
  }
  assert.equal(city('bourges').robots, 'overridden', 'Bourges disallows every robot; read by decision');
});

test('a cell table finds its columns by header words and reads every section under them', () => {
  // Garges's grid: a section title over its own header, a row per dossier.
  const row = (y, cells) => cells.map(([text, x0, x1, dy = 0]) => cellRun(text, x0 + 4, y + dy, { x0, y0: y - 8, x1, y1: y + 12 }));
  const runs = [
    cellRun('Permis de construire (PC)', 300, 470, { x0: 20, y0: 462, x1: 800, y1: 480 }),
    ...row(440, [['Date de signature', 370, 450], ['Numéro de dossier', 20, 135], ['Pétitionnaire', 135, 310],
      ['Décision', 310, 370], ['Nature des travaux', 450, 640], ['Adresse des', 640, 810], ['travaux', 640, 810, -6]]),
    ...row(400, [['PC 95268 26 00008', 20, 135], ['Monsieur PRIVATE PERSON', 135, 310], ['Rejet tacite', 310, 370],
      ['13/08/2026', 370, 450], ['Surélévation d’une maison', 450, 640], ['18 avenue Exemple', 640, 810]]),
    ...row(370, [['PD 95268 26 00006', 20, 135], ['SAS EXEMPLE', 135, 310], ['accord', 310, 370],
      ['04/09/2026', 370, 450], ['Démolition d’une aile', 450, 640], ['6 rue Exemple', 640, 810]]),
  ];
  const rows = read('garges', 'grid-decisions', runs);
  assert.deepEqual(rows.map((item) => [item.dossier, item.address, item.verdict, item.decidedOn]), [
    ['PC 095268 26 00008', '18 avenue Exemple', 'Rejet tacite', '2026-08-13'],
    ['PD 095268 26 00006', '6 rue Exemple', 'Accord', '2026-09-04'],
  ]);
  assert.equal(stored('garges', rows[0]).state, 'refuse', 'a tacit rejection is a refusal');
  assert.equal(stored('garges', rows[1]).applicant, 'SAS EXEMPLE');
  assert.doesNotMatch(JSON.stringify(rows.map((item) => scrubPermitListRow(item))), /PRIVATE|PERSON/);
});

test('Troyes joins a number wrapped over two lines and keeps the site without its town', () => {
  const clip = (x0, x1) => ({ x0, y0: 630, x1, y1: 690 });
  const head = (x0, x1) => ({ x0, y0: 690, x1, y1: 745 });
  const runs = [
    cellRun('DOSSIER', 36, 714, head(21, 95)), cellRun('DEPOT', 111, 714, head(95, 160)),
    cellRun('ADRESSE OPERATION', 187, 714, head(160, 320)), cellRun('PARCELLE(S)', 326, 714, head(320, 395)),
    cellRun('SUPERFICIE', 399, 735, head(395, 455)), cellRun('DEMANDEURS', 475, 714, head(455, 563)),
    cellRun('NATURE DES', 574, 721, head(563, 647)), cellRun('TRAVAUX', 581, 708, head(563, 647)),
    cellRun('DESCRIPTION DU PROJET', 844, 714, head(647, 1169)),
    cellRun('DP 010 387', 25, 667, clip(21, 95)), cellRun('26 00472', 25, 653, clip(21, 95)),
    cellRun('25/09/2026', 99, 660, clip(95, 160)),
    cellRun('34 bis rue Exemple,', 164, 667, clip(160, 320)), cellRun('10000 Troyes', 164, 653, clip(160, 320)),
    cellRun('CR 818,', 339, 667, clip(320, 395)), cellRun('CR 819', 341, 653, clip(320, 395)),
    cellRun('3000', 416, 660, clip(395, 455)), cellRun('PRIVATE PERSON', 463, 660, clip(455, 563)),
    cellRun('Changement de fenêtres', 651, 667, clip(647, 1169)),
  ];
  const [row] = read('troyes', 'troyes', runs);
  assert.deepEqual([row.dossier, row.address, row.postcode, row.parcels, row.landArea, row.filedOn],
    ['DP 010387 26 00472', '34 bis rue Exemple', '10000', 'CR 818, CR 819', '3000', '2026-09-25']);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE/);
});

test('Le Blanc-Mesnil gives each line to the nearest number of its section, never a header or title', () => {
  const runs = [
    run('Déclaration Préalable (DP) affichage au 24/07/2026', 278, 1156),
    run('N° Dossier', 52, 1140), run('Déposé le', 122, 1140), run('Demandeur', 186, 1140),
    run('Adresse Terrain', 274, 1140), run('Parcelles et surface', 362, 1140), run('Projet', 522, 1140),
    run('Décision', 642, 1140), run('Date de', 692, 1140), run('décision', 692, 1135),
    run('GROUPE EXEMPLE(M. PRIVATE', 163, 1127), run('@DP 093 007 26 00142', 38, 1124), run('30/06/2026', 120, 1124),
    run('41 avenue Exemple', 262, 1124), run('AV 363 - 206 m²', 367, 1124), run('Panneaux photovoltaïques', 475, 1124),
    run('Favoble avec prescription', 630, 1124), run('23/07/2026', 688, 1124), run('PERSON)', 186, 1119),
    run('Permis de Construire (PC) affichage au 31/07/2026', 280, 1090),
    run('N° Dossier', 52, 1075), run('Déposé le', 122, 1075), run('Demandeur', 186, 1075),
    run('PC 093007 26 00010', 40, 1060), run('02/03/2026', 120, 1060), run('M. PRIVATE PERSON', 175, 1060),
    run('8 rue Exemple', 278, 1060), run('AW0085 - 124 m²', 366, 1060), run('Extension', 486, 1060),
    run('Rejet tacite', 639, 1060), run('29/07/2026', 688, 1060),
  ];
  const rows = read('blanc-mesnil', 'blanc-mesnil-decisions', runs);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.parcels, row.landArea, row.postedOn]), [
    ['DP 093007 26 00142', '41 avenue Exemple', 'AV 363', '206', '2026-07-24'],
    ['PC 093007 26 00010', '8 rue Exemple', 'AW 85', '124', '2026-07-31'],
  ]);
  assert.equal(rows[0].applicant, 'GROUPE EXEMPLE', 'the person in brackets is cut off');
  assert.equal(stored('blanc-mesnil', rows[0]).state, 'accorde', 'the city\'s own « Favoble » typo is a grant');
  assert.equal(stored('blanc-mesnil', rows[1]).state, 'refuse');
  assert.doesNotMatch(JSON.stringify(rows.map((row) => scrubPermitListRow(row))), /PRIVATE|PERSON|Dossier|Déposé/);
});

test('Bourges reads the site and the parcel, never the applicant\'s own address', () => {
  const runs = [
    run('Déclaration préalable', 30, 552),
    run('D. Dépôt', 140, 494), run('Adresse du terrain', 401, 494), run('SHON', 554, 494), run('Superf.', 594, 494),
    run('Nature de', 631, 504), run('D. Décision', 674, 494), run('Surface', 509, 499), run('Demandeur', 253, 485),
    run('N° de dossier', 55, 476), run('Complété', 139, 466), run('Objets des travaux', 400, 466),
    run('Références cadastrales et PLU', 183, 448), run('Notifié', 144, 448),
    run('21/09/2026', 137, 431), run('Monsieur PRIVATE PERSON', 183, 431), run('1 Rue Exemple', 368, 431), run('397', 613, 431),
    run('9 rue du Demandeur', 183, 416), run('DP 018 033 26 00568', 30, 407), run('CONSTRUCTION D\'UN ABRI DE', 368, 404),
    run('18000 BOURGES', 183, 400), run('JARDIN', 368, 394), run('30/09/2026', 137, 394),
    run('33 CD 279 (PLU : Zone d\'habitat pavillonnaire)', 183, 383),
  ];
  const [row] = read('bourges', 'bourges-filings', runs);
  assert.deepEqual([row.dossier, row.address, row.purpose, row.parcels, row.filedOn],
    ['DP 018033 26 00568', '1 Rue Exemple', 'CONSTRUCTION D\'UN ABRI DE JARDIN', 'CD 279', '2026-09-21']);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE|PERSON|Demandeur/);
  const decided = read('bourges', 'bourges-decisions', [
    run('Déclaration préalable', 27, 286),
    run('Objet des travaux', 249, 267), run('N° de dossier', 25, 263), run('Demandeur', 137, 263),
    run('Date de la décision', 381, 263), run('Date affichage décision', 486, 263), run('Retiré le', 625, 263),
    run('Nature de la décision', 714, 263), run('Lieux des travaux', 249, 259),
    run('PORTE ENTREE -', 255, 245), run('INTERPHONES', 255, 237), run('SDC EXEMPLE', 137, 237),
    run('DP 018 033 26 00287', 25, 231), run('21/09/2026', 397, 231), run('Rejet implicite', 729, 231),
    run('- 12 Rue Exemple', 249, 228),
  ]);
  assert.deepEqual(decided.map((item) => [item.address, item.purpose, item.verdict, stored('bourges', item).state]),
    [['12 Rue Exemple', 'PORTE ENTREE - INTERPHONES', 'Rejet implicite', 'refuse']]);
});

test('Alès reads the applicant\'s address only when the site column says IDEM', () => {
  const header = [run('Dossier N°', 31, 382), run('Dépôt le', 107, 382), run('Décision le', 165, 382),
    run('Nom et adresse du demandeur', 253, 382), run('Nature du Projet', 656, 382), run('Adresse du projet', 454, 382)];
  const rows = read('ales', 'ales-decisions', [
    ...header,
    run('PRIVATE PERSON', 267, 341), run('IDEM', 481, 334), run('DP 26 00194', 24, 327), run('09/06/26', 105, 327),
    run('01/10/26', 169, 327), run('180 Chemin Exemple', 270, 327), run('Division en vue de construire', 625, 327),
    run('(CZ 566 ; 567)', 461, 320), run('30100 ALES', 293, 314),
    run('OTHER PERSON', 282, 228), run('39 Chemin des Pins', 449, 222), run('DP 26 00264', 24, 215),
    run('04/09/26', 105, 215), run('01/10/26', 169, 215), run('13 Route Privée', 281, 215), run('Parking', 601, 215),
    run('(BH 294)', 474, 208), run('30110 LAMELOUZE', 272, 201),
  ]);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.parcels, row.filedOn, row.verdict]), [
    ['DP 030007 26 00194', '180 Chemin Exemple', '30100', 'CZ 566, CZ 567', '2026-06-09', 'Accord'],
    ['DP 030007 26 00264', '39 Chemin des Pins', '30100', 'BH 294', '2026-09-04', 'Accord'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => scrubPermitListRow(row))), /PRIVATE|PERSON|Route Privée|LAMELOUZE/);
  assert.equal(alesIdemSite(['SCI EXEMPLE', 'représentée par PRIVATE PERSON', '747 Chemin Exemple', '30100 ALES', 'extra']),
    '747 Chemin Exemple, 30100 ALES');
  assert.equal(alesIdemSite(['PRIVATE PERSON']), null);
});

test('verdicts, parcels and yearless days are read as the cities write them', () => {
  assert.equal(listVerdict('Favorable avec réserve'), 'Favorable avec réserve');
  assert.equal(listVerdict('accord'), 'Accord');
  assert.equal(listVerdict('défavorable'), 'Refus');
  assert.equal(listVerdict('Annulation'), 'Retrait');
  assert.equal(listVerdict('Sursis à statuer'), 'Sursis à statuer');
  assert.equal(listVerdict(''), null);
  assert.equal(verdictCell(['Renonciatio', 'n tacite']), 'Renonciation tacite');
  assert.equal(verdictCell(['Accord avec', 'prescriptions']), 'Accord avec prescriptions');
  assert.equal(listParcelCell('(DA 69 ; 70)'), 'DA 69, DA 70');
  assert.equal(listParcelCell('33 DX 443, 33 DX 555 (PLU : Secteur)'), 'DX 443, DX 555');
  assert.equal(listParcelCell('BH 562 - 216 m²'), 'BH 562');
  assert.equal(listParcelCell('rien'), null);
  assert.equal(dayWithoutYear('25', '09', '2026-10-02'), '2026-09-25');
  assert.equal(dayWithoutYear('28', '12', '2027-01-03'), '2026-12-28', 'a December list read in January');
});

test('Garges and Le Blanc-Mesnil read both tables or none', () => {
  const garges = LIST_BOARD_PROTOCOLS.garges;
  const page = `<a href="//www.villedegarges.fr/sites/default/files/tableau_affichage_depot_01.10.2026.pdf">Dépôts</a>
    <a href="/sites/default/files/tableau_affichage_decision_01.10.2026.pdf">Décisions</a>`;
  const found = garges.index(city('garges'), page, { url: city('garges').page }, { day: '2026-10-02' });
  assert.deepEqual(found.files.map((file) => [file.board, file.layout, file.published, file.url]), [
    ['filings', 'grid-filings', '2026-10-01', 'https://www.villedegarges.fr/sites/default/files/tableau_affichage_depot_01.10.2026.pdf'],
    ['decisions', 'grid-decisions', '2026-10-01', 'https://www.villedegarges.fr/sites/default/files/tableau_affichage_decision_01.10.2026.pdf'],
  ]);
  assert.equal(garges.index(city('garges'), page.split('\n')[0], { url: city('garges').page }, { day: '2026-10-02' }), null);
  const bm = LIST_BOARD_PROTOCOLS['blanc-mesnil'].index(city('blanc-mesnil'),
    '<a href="/sites/default/files/dds_-_tableau_affichage_-_depot_-_25-09.pdf">x</a><a href="/sites/default/files/dds_-_tableau_affichage_-_decision_-_25-09.pdf">y</a>',
    { url: city('blanc-mesnil').page }, { day: '2026-10-02' });
  assert.deepEqual(bm.files.map((file) => file.published), ['2026-09-25', '2026-09-25']);
});

test('Troyes reads every weekly list but the signs\' lists', () => {
  const html = ['37-DOSSIERS_ADS_AU_26_SEPT_2026.pdf', '37-DOSSIERS_ADS_ENSEIGNES_AU_26_SEPT_2026.pdf',
    'DOSSIERS-DAUTORISATIONS-DU-DROIT-DES-SOLS-DEPOSES-AU-8-AOUT-2026.pdf', 'ANALYSE_EAU.pdf']
    .map((name) => `<a href="https://www.ville-troyes.fr/wp-content/uploads/2026/09/${name}">${name}</a>`).join('');
  const { files } = LIST_BOARD_PROTOCOLS.troyes.index(city('troyes'), html, { url: city('troyes').page }, {});
  assert.deepEqual(files.map((file) => file.published), ['2026-09-26', '2026-08-08']);
  assert.equal(LIST_BOARD_PROTOCOLS.troyes.index(city('troyes'), '<p>vide</p>', { url: city('troyes').page }, {}), null);
});

test('Bourges walks its portal back from the last page until the window is passed', () => {
  const bourges = LIST_BOARD_PROTOCOLS.bourges;
  const row = (theme, subject, day, id) => `<tr><td>Arrêté</td><td>${theme}</td><td>${subject}</td><td>${day}</td><td>${day}</td><td>30/11/2026</td><td><a href="/tmp_diffusion_document/download/${id}">Télécharger</a></td></tr>`;
  const page = (n, rows) => `<div class="pager_head">370 résultats trouvés - Affichage page ${n} / 8</div><table>${rows.join('')}</table>`;
  const first = bourges.index(city('bourges'), page(1, [row('Finances', 'Budget', '15/04/2024', 1)]), { url: city('bourges').page }, { since: '2026-08-01' });
  assert.deepEqual(first.next.map((request) => request.url), ['https://portail.ville-bourges.fr/tmp_diffusion_document/index/p=8']);
  const last = bourges.index(city('bourges'), page(8, [
    row('Urbanisme', 'AUTORISATION DU DROIT DES SOLS - liste des dépôts', '30/09/2026', 55135),
    row('Urbanisme', 'AUTORISATION DU DROIT DES SOLS - liste des décisions', '30/09/2026', 55138),
    row('Urbanisme', 'Arrêté de voirie', '30/09/2026', 55139),
  ]), { url: 'https://portail.ville-bourges.fr/tmp_diffusion_document/index/p=8' }, { since: '2026-08-01' });
  assert.deepEqual(last.files.map((file) => [file.board, file.layout, file.url.split('/').pop()]),
    [['filings', 'bourges-filings', '55135'], ['decisions', 'bourges-decisions', '55138']]);
  assert.match(last.next[0].url, /p=7$/);
  const older = bourges.index(city('bourges'), page(6, [row('Finances', 'Budget', '30/07/2026', 2)]),
    { url: 'x' }, { since: '2026-08-01' });
  assert.deepEqual(older.next, [], 'a page older than the window ends the walk');
  assert.equal(bourges.index(city('bourges'), '<p>maintenance</p>', { url: 'x' }, { since: '2026-08-01' }), null);
});

test('Cergy and Alès list their files from JSON, unrelated posts left out', () => {
  const item = (name, file) => ({ name, file: { name: file } });
  const cergy = LIST_BOARD_PROTOCOLS.cergy.index(city('cergy'), { data: { items: [
    item('Affichage dépôt du 24-09-2026', 'b2a2.pdf'), item('Affichage décision du 24-09-2026', 'c3d4.pdf'),
    item('ARRETE N°2026-18951 CREATION ZAD', 'e5f6.pdf'),
  ] } });
  assert.deepEqual(cergy.files.map((file) => [file.board, file.layout, file.published, file.url]), [
    ['filings', 'grid-filings', '2026-09-24', 'https://api.a2display.fr/file?filename=b2a2.pdf'],
    ['decisions', 'grid-decisions', '2026-09-24', 'https://api.a2display.fr/file?filename=c3d4.pdf'],
  ]);
  assert.equal(LIST_BOARD_PROTOCOLS.cergy.index(city('cergy'), { error: 'x' }), null);
  const ales = LIST_BOARD_PROTOCOLS.ales.index(city('ales'), [
    { date: '2026-10-02T08:36:08', categories: [13], content: { rendered: '<a href="https://parutions-mairie-ales.fr/wp-content/uploads/2026/10/semaine-40-2026-accordees.pdf">PDF</a>' } },
    { date: '2026-09-25T15:43:01', categories: [2], content: { rendered: '<a href="https://parutions-mairie-ales.fr/wp-content/uploads/2026/09/00672.pdf">PDF</a>' } },
  ], { url: 'https://parutions-mairie-ales.fr/wp-json/wp/v2/posts' });
  assert.deepEqual(ales.files.map((file) => [file.board, file.layout, file.published]), [['decisions', 'ales-decisions', '2026-10-02']]);
});
