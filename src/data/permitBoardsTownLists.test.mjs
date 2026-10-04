import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWN_LIST_READERS, readAytreFilings, readCimDecisions, readDecidedUntilList, readFiledBeforeList, readLabelledCards, readQuarterTurnDecisions, readQuarterTurnFilings } from './permitBoardsTownLists.js';
import { BOARD_PERMIT_SOURCES, BOARD_READERS } from './permitBoards.js';
import { POSTED_LIST_PROTOCOLS, postedActFiles } from './permitBoardsPostedLists.js';
import { permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const run = (text, x, y, size = 8) => ({ text, x, x1: x + text.length * 4, y, size });
const page = (...runs) => ({ pages: [{ runs }] });
const PRIVATE = /PRIVATE|PERSON/;

// Raw coordinates of PDF24's /Rotate 90 export, derived from the displayed runs.
const rotated = (document) => ({ pages: document.pages.map((p) => ({ runs: p.runs.map((r) => ({
  ...r, x: 842 - r.y, x1: 842 - r.y, y: r.x,
})) })) });

test('Quimperlé rotates every page before reading multiline rows and excludes other municipalities', () => {
  const source = city('quimperle');
  assert.equal(permitListFor('29233'), source);
  const header = [run('Date de dépôt', 28, 700), run('Numéro de', 120, 700), run('dossier', 120, 688),
    run('Pétitionnaire', 211, 700), run('Adresse du projet', 312, 700), run('Description du projet', 455, 700)];
  const document = { pages: [{ runs: [...header,
    run('23/09/2026', 28, 650), run('DP 29233 26 00222', 120, 650), run('PRIVATE PERSON', 211, 650),
    run('58 Rue Exemple', 312, 650), run('29300 Quimperlé', 312, 638), run('Renovation', 455, 650),
  ] }, { runs: [...header,
    run('Roof', 455, 665),
    run('22/09/2026', 28, 640), run('DP 29233 26 00221', 120, 640), run('PRIVATE PERSON', 211, 640),
    run('6 Rue Autre', 312, 640), run('Facade', 455, 640),
    run('21/09/2026', 28, 600), run('DP 29150 26 00221', 120, 600), run('PRIVATE PERSON', 211, 600),
    run('99 Rue Excluded', 312, 600), run('Excluded', 455, 600),
  ] }] };
  const rows = readQuarterTurnFilings(rotated(document), { city: source, file: { published: '2026-09-24' } });
  assert.deepEqual(rows.map((r) => [r.dossier, r.address, r.filedOn, r.purpose]), [
    ['DP 029233 26 00222', '58 Rue Exemple', '2026-09-23', 'Renovation Roof'],
    ['DP 029233 26 00221', '6 Rue Autre', '2026-09-22', 'Facade'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
  assert.deepEqual(readQuarterTurnFilings(document, { city: source, file: {} }), [], 'changed orientation is withheld');
});

test('Quimperlé decisions preserve refusals, signing dates and their own project sites', () => {
  const document = page(run('Numéro de dossier', 28, 700), run('Pétitionnaire', 139, 700), run('Décision', 259, 700),
    run('Date de', 334, 700), run('signature', 334, 688), run('Nature des travaux', 414, 700),
    run('Adresse des travaux', 594, 700), run('Surface', 769, 700),
    run('DP 29233 26 00201', 28, 640), run('PRIVATE PERSON', 139, 640), run('Refus', 259, 640),
    run('21/09/2026', 334, 640), run('New window', 414, 640), run('8 Rue Exemple', 594, 640), run('29300 Quimperlé', 594, 628));
  const [row] = readQuarterTurnDecisions(rotated(document), { city: city('quimperle'), file: { published: '2026-09-24' } });
  assert.deepEqual([row.dossier, row.address, row.decidedOn, row.postedOn, row.verdict],
    ['DP 029233 26 00201', '8 Rue Exemple', '2026-09-21', '2026-09-24', 'Refus']);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), PRIVATE);
});

test('the town list readers are registered, and the communes that use them read by their protocol', () => {
  for (const layout of Object.keys(TOWN_LIST_READERS)) assert.equal(BOARD_READERS[layout], TOWN_LIST_READERS[layout], layout);
  for (const key of ['wp-media-29150', 'wp-media-28070', 'wp-media-71475']) {
    assert.equal(permitListFor(city(key).insee), city(key), key);
    assert.deepEqual(city(key).source.layouts, { filings: 'town-filed-before', decisions: 'town-decided-until' });
  }
  assert.equal(city('saint-jean-d-angely').source.actLayouts.filings, 'town-filed-before');
});

test('« Dossiers déposés avant le … »: columns are where the rows’ cells start, so a name set right of its header stays out of the site', () => {
  // Moëlan-sur-Mer's list of 23 September 2026: each cell starts 30 to 70 points right of its header.
  const rows = readFiledBeforeList(page(
    run('VILLE DE MOËLAN-SUR-MER', 672, 455), run('Dossiers déposés avant le 23 septembre 2026', 225, 399),
    run('Date de dépôt', 28, 372), run('Numéro de', 120, 372), run('Pétitionnaire', 211, 372),
    run('Adresse du projet', 312, 372), run('Description du projet', 455, 372), run('dossier', 120, 359),
    run('DECLARATION PREALABLE - CONSTRUCTIONS ET TRAVAUX NON SOUMIS A PERMIS DE CONSTRUIRE', 28, 321),
    run('22/09/2026', 28, 283), run('DP 29150 26 00111', 154, 283), run('PRIVATE PERSON', 282, 283), run('8 Route Exemple', 374, 283),
    run('M01', 154, 271), run('29350 Moëlan-sur-Mer', 374, 258),
    run('22/09/2026', 28, 219), run('DP 29150 26 00211', 154, 219), run('Evan', 282, 219), run('54 Kéryoualen', 374, 219),
    run('Installation d’un carport', 502, 219), run('PERSON', 279, 206), run('29350 Moëlan-sur-Mer', 374, 206),
    run('Page 1 sur 10', 739, 38),
  ), { city: city('wp-media-29150'), file: { board: 'filings', published: '2026-09-23' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.filedOn, row.purpose, row.applicant]), [
    ['DP 029150 26 00111 M01', '8 Route Exemple', '29350', '2026-09-22', null, null],
    ['DP 029150 26 00211', '54 Kéryoualen', '29350', '2026-09-22', 'Installation d’un carport', null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
  assert.deepEqual(readFiledBeforeList(page(run('Date de dépôt', 28, 372)), { city: city('wp-media-29150'), file: {} }), [], 'no full row, no columns');
});

test('« Dossiers décidés jusqu’au … »: a site that is only the postcode and town is no site', () => {
  const rows = readDecidedUntilList(page(
    run('Dossiers décidés jusqu’au 23 septembre 2026', 301, 416),
    run('Numéro de dossier', 28, 391), run('Pétitionnaire', 139, 391), run('Décision', 259, 391), run('Date de', 334, 391),
    run('Nature des travaux', 414, 391), run('Adresse des travaux', 594, 391), run('Surface', 769, 391), run('signature', 334, 378),
    run('Déclaration préalable - Constructions et travaux non soumis à permis de construire', 28, 339),
    run('DP 29150 26 00182', 28, 302), run('PRIVATE', 142, 302), run('Octroi', 259, 302), run('16/09/2026', 334, 302),
    run('33 Route Exemple', 594, 302), run('29350 Moëlan-sur-Mer', 594, 290),
    run('DP 29150 26 00157', 28, 250), run('PERSON', 142, 250), run('Accord', 259, 250), run('02/09/2026', 334, 250),
    run('29350 Moëlan-sur-Mer', 594, 250),
  ), { city: city('wp-media-29150'), file: { board: 'decisions', published: '2026-09-23' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.decidedOn]), [
    ['DP 029150 26 00182', '33 Route Exemple', '2026-09-16'],
    ['DP 029150 26 00157', null, '2026-09-02'],
  ]);
});

test('Saint-Jean-d’Angély names its acts by their site: street first, then « au n° »', () => {
  const angely = city('saint-jean-d-angely');
  const html = [
    '<a href="/wp-content/uploads/2026/09/DP173472600138-rue-des-Marechaux-au-n°-4.pdf">x</a>',
    '<a href="/wp-content/uploads/2026/10/Avis-depot-DP-rue-Lachevalle-au-n°-64.pdf">x</a>',
    '<a href="/wp-content/uploads/2026/10/Arrete-DP-chaussee-de-lEperon-au-n°65-Publie-le-01.10.2026.pdf">x</a>',
  ].join('');
  const files = POSTED_LIST_PROTOCOLS['posted-acts'].index(angely, html, { url: angely.page }, { since: '2026-08-01' }).files;
  assert.deepEqual(files.map((file) => [file.board, file.layout, file.row?.dossier ?? null, file.row?.address ?? null]), [
    ['decisions', 'dematdoc-notice', 'DP 017347 26 00138', '4 rue des Marechaux'],
    ['filings', 'town-filed-before', null, null],
    ['decisions', 'dematdoc-notice', null, null],
  ], 'an « Avis depot » is a filing, read as the one-row list it is');
  assert.equal(postedActFiles(angely, '<a href="/x/PC173472600007-au-revoir.pdf">x</a>', angely.page, '2026-08-01')[0].row.address, null);
});

test('Cesson-Sévigné’s monthly export: no applicant column, the site cut at its slash', () => {
  const rows = readCimDecisions(page(
    run('Extraction CIM', 91, 553),
    run('Numéro', 57, 503), run('Date décision', 132, 503), run('Natrue de la Décision', 205, 503), run('DOSSIER.DECISIO', 303, 503),
    run('DOSSIER.DECISIO', 375, 503), run('DOSSIER.DECISIO', 448, 503), run('Nature du projet', 545, 503), run('Adresse Projet', 661, 503),
    run('DOSS_PCR.TRAV_', 747, 503), run('N_NATURE', 315, 489), run('N_NATURE', 387, 489), run('N_NATURE_LONG', 448, 489), run('DESCRIPTION', 754, 489),
    run('PC 035 051 26 00049', 17, 472), run('21/09/2026', 138, 472), run('5', 187, 472), run('5', 301, 472), run('5', 373, 472),
    run('Octroi avec', 446, 472), run('24 rue du Parc 35510', 632, 472), run('Construction d’un', 745, 472),
    run('prescriptions', 446, 462), run('CESSON-SEVIGNE', 632, 462), run('carport', 745, 462),
    run('PC 035 051 24 A0082 M01', 17, 375), run('11/09/2026', 138, 375), run('Octroi', 446, 375), run('1C rue du chêne Germain Lot B / SAS EXEMPLE', 632, 375),
    run('Edité le 01/10/2026', 16, 16), run('Page 1/4', 785, 16),
  ), { city: city('cesson-sevigne'), file: { board: 'decisions', published: '2026-10-01' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.decidedOn, row.purpose]), [
    ['PC 035051 26 00049', '24 rue du Parc', '2026-09-21', 'Construction d’un carport'],
    ['PC 035051 24 A0082 M01', '1C rue du chêne Germain Lot B', '2026-09-11', null],
  ]);
  assert.match(rows[0].verdict, /prescriptions/i);
});

test('Aytré’s spreadsheet: the number rebuilt from four cells, the street cell as the site, the applicant never read', () => {
  const rows = readAytreFilings(page(
    run('URBANISME - AVIS DE DEPOT', 285, 1108), run('Numéro', 112, 1053), run('Dépôt', 56, 1052), run('Demandeur', 211, 1052),
    run('Lieux des Travaux', 333, 1052), run('Nature', 484, 1052),
    run('1-avr.-26', 53, 990), run('DP', 89, 990), run('17028', 104, 990), run('26', 128, 990), run('59', 146, 990),
    run('PRIVATE PERSON', 160, 990), run('10 rue du Champ de Tir', 296, 990), run('Clôture', 422, 990),
    run('Chemin de la Gigas', 296, 960), run('6-mai-26', 53, 959), run('DP', 89, 959), run('17028', 104, 959), run('26', 128, 959),
    run('72', 146, 959), run('PERSON SAS', 160, 959),
    run('20-juil.-26', 52, 835), run('DP', 89, 835), run('17028', 104, 835), run('25', 128, 835), run('177M1PRIVATE Person', 140, 835),
    run('20 rue des Marguerites', 296, 836),
    run('19-juin-26', 51, 700), run('AT', 89, 700), run('17028', 104, 700), run('26', 128, 700), run('5', 147, 700), run('16 rue Exemple', 296, 700),
  ), { city: city('wp-media-17028'), file: { board: 'filings', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.purpose]), [
    ['DP 017028 26 00059', '10 rue du Champ de Tir', '2026-04-01', 'Clôture'],
    ['DP 017028 26 00072', 'Chemin de la Gigas', '2026-05-06', null],
    ['DP 017028 25 00177 M01', '20 rue des Marguerites', '2026-07-20', null],
  ], 'a works authorisation (AT) is no permit');
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
});

test('Margny-lès-Compiègne’s decisions: a row is the cells within a few points of its number, rows eight points apart', () => {
  const rows = TOWN_LIST_READERS['town-margny-decisions'](page(
    run('N° de Dossier', 67, 505), run('Date dépôt', 125, 505), run('Demandeur', 221, 505), run('Lieux des travaux', 332, 505),
    run('Nature des Travaux', 448, 505), run('Décision', 569, 505),
    run('DP 060 382 26 00076', 59, 443), run('Madame PRIVATE PERSON', 202, 443), run('961 avenue Octave Butin', 321, 443),
    run('Mur de clôture', 451, 443), run('FAVORABLE', 565, 443), run('10/08/2026', 125, 441),
    run('DP 060 382 26 00067', 59, 426), run('PRIVATE Person', 217, 426), run('FAVORABLE', 565, 426),
    run('487 rue de Verdun', 328, 425), run('28/07/2026', 125, 424),
    run('DP 060 382 26 00068', 59, 415), run('PERSON Claire', 215, 415), run('46 rue de Verdun', 330, 415),
    run('28/07/2026', 125, 411), run('FAVORABLE AVEC PRESCRIPTIONS', 543, 411),
  ), { city: city('wp-media-60382'), file: { board: 'decisions', published: '2026-09-17' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, Boolean(row.verdict)]), [
    ['DP 060382 26 00076', '961 avenue Octave Butin', '2026-08-10', true],
    ['DP 060382 26 00067', '487 rue de Verdun', '2026-07-28', true],
    ['DP 060382 26 00068', '46 rue de Verdun', '2026-07-28', true],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
});

test('Romagnat’s orders: no header, the street cell as the site, one wrapped on two lines read in the sites’ column', () => {
  const rows = TOWN_LIST_READERS['town-romagnat-decisions'](page(
    run('ARRETES DOSSIERS D’URBANISME', 301, 1095),
    run('PC 0633072600004@', 38, 1062), run('09/03/2026', 140, 1062), run('PRIVATE Person', 229, 1062), run('13 chemin de la Bouteille', 492, 1062),
    run('AZ 73-74-77', 608, 1062), run('01/07/2026', 675, 1062), run('ACCORDE', 756, 1062),
    run('1 impasse des Mésanges', 493, 899), run('DP 0633072600086', 41, 893), run('05/06/2026', 140, 893), run('PERSON Cyril', 229, 893),
    run('AM 377 - 641', 606, 893), run('16/07/2026', 675, 893), run('NON-OPPOSITION', 741, 893), run('Saulzet-le-Chaud', 507, 887),
    run('DP 0633072600100', 41, 870), run('10/07/2026', 140, 870), run('84 boulevard du Chauffour', 489, 870), run('AY 179', 618, 870),
    run('16/07/2026', 675, 870), run('NON-OPPOSITION', 741, 870),
  ), { city: city('wp-media-63307'), file: { board: 'decisions', published: '2026-10-01' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.decidedOn, Boolean(row.verdict)]), [
    ['PC 063307 26 00004', '13 chemin de la Bouteille', '2026-03-09', '2026-07-01', true],
    ['DP 063307 26 00086', '1 impasse des Mésanges Saulzet-le-Chaud', '2026-06-05', '2026-07-16', true],
    ['DP 063307 26 00100', '84 boulevard du Chauffour', '2026-07-10', '2026-07-16', true],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
});

test('La Salvetat-Saint-Gilles’s cards: the values of their labels, a decision when one is said', () => {
  const rows = readLabelledCards(page(
    run('Dossier', 73, 504), run('Demandeur', 190, 504), run('Décision', 774, 504),
    run('Accord,', 780, 480), run('Référence', 19, 475), run(': DP0315262600122', 60, 475), run('PRIVATE', 173, 471), run('le 16/09/2026', 769, 471),
    run('Déposé le', 19, 466), run(': 28/08/2026', 59, 466), run('Adresse', 547, 466), run(': 24 Avenue Léonard de Vinci', 580, 466),
    run('PERSON', 173, 452), run('16/09/2026', 774, 452),
    run('Référence', 19, 338), run(': DP0315262600086', 60, 339), run('Adresse', 547, 338), run(': 2 Impasse Henri Bergson', 580, 339),
    run('Déposé le', 19, 329), run(': 15/06/2026', 59, 329),
  ), { city: city('wp-media-31526'), file: { board: 'decisions', published: '2026-09-18' } });
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.filedOn, row.verdict, row.decidedOn]), [
    ['decisions', 'DP 031526 26 00122', '24 Avenue Léonard de Vinci', '2026-08-28', 'Accord', '2026-09-16'],
    ['filings', 'DP 031526 26 00086', '2 Impasse Henri Bergson', '2026-06-15', null, null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
});
