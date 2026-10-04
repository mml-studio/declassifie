import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOWN_LIST_READERS, readAytreFilings, readCimDecisions, readDecidedUntilList, readFiledBeforeList, readLabelledCards,
  readLaFlotteFilings, readLionDecisions, readLionFilings, readQuarterTurnDecisions, readQuarterTurnFilings,
} from './permitBoardsTownLists.js';
import { BOARD_PERMIT_SOURCES, BOARD_READERS } from './permitBoards.js';
import { POSTED_LIST_PROTOCOLS, postedActFiles } from './permitBoardsPostedLists.js';
import { PERMIT_LIST_READERS, permitListFor, scrubPermitListRow } from './permitListsFeed.js';

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

test('« Dossiers décidés jusqu’au … »: a site wrapped on two lines stays with its own number, not the next row’s', () => {
  // Saint-Rémy's list of 2 October 2026: the site of E0108 wraps, the next row's site starts 16 points lower.
  const rows = readDecidedUntilList(page(
    run('Numéro de dossier', 28, 391), run('Pétitionnaire', 139, 391), run('Décision', 259, 391), run('Date de', 334, 391),
    run('Nature des travaux', 414, 391), run('Adresse des travaux', 594, 391), run('Surface', 769, 391), run('signature', 334, 378),
    run('DP 71475 26 E0108', 28, 302), run('Monsieur PRIVATE', 139, 302), run('Favorable', 259, 302), run('11/09/2026', 334, 302),
    run('Panneaux photovoltaiques', 414, 302), run('6 Rue Olympe de Gouges, Les', 594, 302), run('m²', 772, 302),
    run('PERSON', 139, 289), run('Hauts de Marobin', 594, 289),
    run('DP 71475 26 E0107', 28, 273), run('Madame PRIVATE', 139, 273), run('Favorable', 259, 273), run('11/09/2026', 334, 273),
    run('Installation d’une clôture agricole,', 414, 273), run('Chemin de la Réserve', 594, 273), run('m²', 772, 273),
  ), { city: city('wp-media-71475'), file: { board: 'decisions', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.verdict, row.decidedOn, row.applicant]), [
    ['DP 071475 26 E0108', '6 Rue Olympe de Gouges, Les Hauts de Marobin', 'Accord', '2026-09-11', null],
    ['DP 071475 26 E0107', 'Chemin de la Réserve', 'Accord', '2026-09-11', null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
});

test('« Dossiers déposés avant le … »: a site printed in glyphs its font maps to nothing is no site, and the dossier stays', () => {
  const rows = readFiledBeforeList(page(
    run('Date de dépôt', 28, 372), run('Numéro de', 120, 372), run('Pétitionnaire', 211, 372),
    run('Adresse du projet', 312, 372), run('Description du projet', 455, 372), run('dossier', 120, 359),
    run('04/08/2026', 28, 283), run('DP 78545 26 B0083', 154, 283), run('PRIVATE PERSON', 282, 283), run('\uFFFD\uFFFD\uFFFD\uFFFD \uFFFD', 374, 283),
    run('Clôture', 502, 283),
    run('05/08/2026', 28, 240), run('DP 78545 26 B0084', 154, 240), run('PRIVATE PERSON', 282, 240), run('12 rue Exemple', 374, 240),
    run('Abri de jardin', 502, 240),
  ), { city: city('saint-cyr-l-ecole'), file: { board: 'filings', published: '2026-09-09' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn]), [
    ['DP 078545 26 B0083', null, '2026-08-04'],
    ['DP 078545 26 B0084', '12 rue Exemple', '2026-08-05'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
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

// --- Lissieu, Caissargues, Les Houches, La Flotte, Lion-sur-Mer (2026-10-04) --

/** A run of a font with no widths (BIRT's): its right edge is its left. */
const bare = (text, x, y) => ({ text, x, x1: x, y, size: 7.5 });
/** A person's name or address planted where the applicant's cells are: never in a row. */
const PLANTED = /DUPONT|Jean|Fictive|NULLEPART|Privée|Fictif|Inventée/;

test('the five towns of 4 October 2026 read their own file names, lists only', () => {
  const wp = POSTED_LIST_PROTOCOLS['wp-media'];
  const read = (key, uploads) => {
    const town = city(key);
    assert.equal(permitListFor(town.insee), town, key);
    assert.equal(town.source.acts, false, key);
    const body = uploads.map(([date, path, title = '']) => ({ date: `${date}T10:00:00`, source_url: new URL(`/wp-content/uploads/${path}`, town.page).href, title: { rendered: title } }));
    const [start] = wp.start(town, { since: '2026-08-01', day: '2026-10-04' });
    return wp.index(town, body, start, { since: '2026-08-01', day: '2026-10-04' }).files
      .map((file) => [file.board, file.layout, file.published, Boolean(file.ocr)]);
  };
  assert.deepEqual(read('wp-media-69117', [
    ['2026-09-18', '2026/09/2026_09_18_Liste-des-decisions.pdf'], ['2026-09-18', '2026/09/2026_09_18_Liste-des-avis-de-depot.pdf'],
    ['2026-09-18', '2026/09/SCAN-5354.pdf'],
  ]), [['decisions', 'birt-decisions', '2026-09-18', false], ['filings', 'birt-filings', '2026-09-18', false]]);
  assert.deepEqual(read('wp-media-30060', [
    ['2026-09-28', '20260924-090945-etat-registre_dossiers_affichage_reglementaire.pdf'], ['2026-09-21', 'registre-17-09-26.pdf'],
    ['2026-09-21', 'registre-du-02-09-26.pdf'], ['2026-09-22', 'LISTE-DES-DELIBERATIONS-DU-CONSEIL-MUNICIPAL-DU-JEUDI-17-SEPTEMBRE-2026.pdf'],
  ]), [['filings', 'register', '2026-09-28', false], ['filings', 'register', '2026-09-17', false], ['filings', 'register', '2026-09-02', false]],
  'the register holds both boards: each row says which');
  assert.deepEqual(read('wp-media-74143', [
    ['2026-10-02', '2026/10/Decisions-autorisations-durbanisme_02.10.2026.pdf'], ['2026-10-02', '2026/10/Avis-de-depot_demandes-durbanisme_02.10.2026.pdf'],
    ['2026-09-28', '2026/09/Liste-deliberations-cs-260910.pdf'], ['2026-09-18', '2026/09/cerfa_13410-13_CUa-et-CUb.pdf'],
  ]), [['decisions', 'town-houches-decisions', '2026-10-02', false], ['filings', 'town-houches-filings', '2026-10-02', false]]);
  assert.deepEqual(read('wp-media-17161', [
    ['2026-09-30', '2026/09/avis-de-depot-25-08-au-25-09.pdf', 'avis de depot 25-08 au 25-09'],
    ['2026-10-02', '2026/10/AM-026-472-SAUR-CHEMIN-DU-MOULIN-BLANC.pdf'],
    ['2026-09-17', '2026/09/AVIS-AUX-NAVIGATEURS-ET-USAGERS-15-ET-16-MAI-2026-FETE-DU-PORT.pdf'],
  ]), [['filings', 'town-laflotte-filings', '2026-09-30', true]], 'a scanned list waits for the OCR');
  assert.deepEqual(read('wp-media-14365', [
    ['2026-10-02', '2026/10/avis-de-depot-02-10-2026.pdf'], ['2026-10-02', '2026/10/AU-02-10-2026.pdf'],
    ['2026-09-07', '2026/09/14365-18.pdf'], ['2026-09-17', '2026/09/AR-delib-9-PLAN.pdf'],
  ]), [['filings', 'town-lion-filings', '2026-10-02', false], ['decisions', 'town-lion-decisions', '2026-10-02', false]]);
});

test('Lissieu’s BIRT filings: two families to a page, a wrapped name far into its column stays out of the site', () => {
  const header = (top) => [
    bare('Date', 130.1, top + 4.5), bare('Réf.', 418, top + 4.5), bare('Superficie', 660.5, top + 4.5), bare('Surface', 710.9, top + 4.5),
    bare('N° de dossier', 31.6, top), bare('Demandeur', 175.5, top), bare('Lieu des travaux', 296.8, top),
    bare('Objet des travaux', 478.6, top), bare('Date dépôt', 761.3, top), bare('d\'affichage', 130.1, top - 4.5),
    bare('cadastrales', 418, top - 4.5), bare('du', 660.5, top - 4.5), bare('terrain', 671.7, top - 4.5), bare('plancher', 710.9, top - 4.5),
  ];
  const rows = BOARD_READERS['birt-filings']({ pages: [{ runs: [
    bare('Liste des avis de dépôt pour la commune de Lissieu', 366.1, 568.6), bare('Déclaration préalable', 32.4, 549.4), ...header(528.8),
    // Lissieu's 18 September 2026, its applicants replaced: a wrapped line's second run starts 65 points into the column.
    bare('Monsieur DUPONT', 175.5, 375.3), bare('JEAN-CHRISTOPHE', 175.5, 366.1), bare('Fictive Inventée', 245, 366.1),
    bare('DP 069 117 26 00076', 31.6, 366.1), bare('11/09/2026', 130.1, 366.1), bare('route de limonest', 296.8, 366.1),
    bare('Implantation d\'un transformateur ENEDIS', 478.6, 366.1), bare('17628', 660.5, 366.1), bare('10 sept. 2026', 761.3, 366.1),
    bare('Jeanne', 175.5, 357.5),
    bare('DP 069 117 26 00077', 31.6, 335.3), bare('11/09/2026', 130.1, 335.3), bare('Monsieur DUPONT Jean', 175.5, 335.3),
    bare('3 Chemin de Marcilly', 296.8, 335.3), bare('B 947, B 977', 418, 335.3), bare('Installation d\'une climatisation', 478.6, 335.3),
    bare('6275', 660.5, 335.3), bare('11 sept. 2026', 761.3, 335.3),
    // The next family, under a header of its own lower on the page.
    bare('Permis de construire', 32.4, 280), ...header(259.3),
    bare('PC 069 117 26 00014', 31.6, 204.2), bare('07/08/2026', 130.1, 204.2), bare('Monsieur DUPONT Jean', 175.5, 204.2),
    bare('Chemin de Charvery', 296.8, 204.2), bare('B 1653', 418, 204.2), bare('Construction d\'une maison individuelle', 478.6, 204.2),
    bare('755', 660.5, 204.2), bare('141,34', 710.9, 204.2), bare('5 août 2026', 761.3, 204.2),
  ] }] }, { city: city('wp-media-69117'), file: { board: 'filings', published: '2026-09-18' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.postedOn, row.floorArea]), [
    ['DP 069117 26 00076', 'route de limonest', '2026-09-10', '2026-09-11', null],
    ['DP 069117 26 00077', '3 Chemin de Marcilly', '2026-09-11', '2026-09-11', null],
    ['PC 069117 26 00014', 'Chemin de Charvery', '2026-08-05', '2026-08-07', '141,34'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), PLANTED);
});

test('BIRT’s packed lines keep their number alone: no cell is where its column is', () => {
  // Lissieu's 4 September 2026: every cell after the first a few points after the one before.
  const rows = BOARD_READERS['birt-filings']({ pages: [{ runs: [
    bare('Déclaration préalable', 32.4, 549.4), bare('Date', 130.1, 533.3), bare('Réf.', 418, 533.3), bare('Superficie', 660.5, 533.3),
    bare('Surface', 710.9, 533.3), bare('N° de dossier', 31.6, 528.8), bare('Demandeur', 175.5, 528.8), bare('Lieu des travaux', 296.8, 528.8),
    bare('Objet des travaux', 478.6, 528.8), bare('Date dépôt', 761.3, 528.8),
    bare('DP 069 117 26 00074', 32, 304), bare('04/09/2026', 57, 304), bare('Monsieur DUPONT Jean', 65, 304), bare('97 Chemin Neuf', 92, 304),
    bare('B 4', 418, 304), bare('Installation de 12 panneaux', 479, 304), bare('2065', 514, 304), bare('3 sept. 2026', 761, 304),
    bare('DP 069 117 26 00073', 32, 280), bare('21/08/2026', 130.1, 280), bare('Madame DUPONT', 175.5, 280),
    bare('14 Chemin du vieux bourg', 296.8, 280), bare('Fictive Inventée', 313, 280), bare('762', 660.5, 280),
  ] }] }, { city: city('wp-media-69117'), file: { board: 'filings' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn]), [
    ['DP 069117 26 00074', null, null],
    ['DP 069117 26 00073', null, null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), PLANTED);
});

test('Caissargues’s register: the site from TERRAIN, never the applicant nor the applicant’s address', () => {
  const rows = PERMIT_LIST_READERS.register({ pages: [{ runs: [
    run('030 060 - Ville de Caissargues', 666, 530.4), run('Registre des dossiers en cours', 28, 510.2),
    run('DOSSIER', 83.5, 451), run('DATES', 200.9, 451), run('DEMANDEUR', 296.3, 451), run('TERRAIN', 431.1, 451),
    run('INFORMATIONS', 582.6, 451), run('LIMITE', 754.1, 451),
    run('DÉCLARATION PRÉALABLE', 52.9, 431.5), run('AMÉNAGEMENT (Initiale)', 58.4, 422.7), run('DP 030060 26 00066', 66.1, 405.2),
    run('Déposé le 13/08/2026', 178.4, 431.5), run('DUPONT Jean', 258, 431.5), run('12 RUE FICTIVE', 258, 422.7),
    run('99999 NULLEPART', 258, 414), run('1 rue des campanules', 385.5, 431.5), run('30132 Caissargues', 385.5, 422.7),
    run('superficie : 457 m²', 385.5, 414), run('Délai 1 mois', 711.5, 431.5), run('Date limite le 28/11/2026', 711.5, 422.7),
    run('DÉCLARATION PRÉALABLE', 52.9, 391.8), run('CONSTRUCTION (Initiale)', 58.4, 383), run('DP 030060 26 00075', 66.1, 365.5),
    run('Déposé le 09/09/2026', 178.4, 391.8), run('LOTUS TECHNOLOGIES', 258, 391.8), run('LOTUS TECHNOLOGIES', 258, 383),
    run('65 RUE DU MOULIN VEDEL', 258, 374.3), run('30900 NÎMES', 258, 365.5), run('26 RUE DES TONNELIERS', 385.5, 391.8),
    run('30132 Caissargues', 385.5, 383), run('Délai 1 mois', 711.5, 391.8), run('Date limite le 22/12/2026', 711.5, 383),
  ] }] });
  const stored = rows.map(scrubPermitListRow);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.filedOn]), [
    ['DP 030060 26 00066', '1 rue des campanules', '30132', '2026-08-13'],
    ['DP 030060 26 00075', '26 RUE DES TONNELIERS', '30132', '2026-09-09'],
  ]);
  assert.doesNotMatch(JSON.stringify(stored), /DUPONT|Jean|FICTIVE|NULLEPART|MOULIN VEDEL/);
});

test('Les Houches’s filings: the site from its own column, never the name nor the applicant’s address beside it', () => {
  const rows = TOWN_LIST_READERS['town-houches-filings'](page(
    run('Mis à jour le 02/10/2026', 19, 567), run('AVIS DE DÉPÔT DÉCLARATIONS PRÉALABLES', 312, 532), run('Commune des Houches', 342, 518),
    run('Surface de', 695, 505), run('Date de dépôt', 25, 495.6), run('Numéro de dossier', 91, 495.6), run('Nom du demandeur', 194.9, 495.6),
    run('Adresse du demandeur', 308.5, 495.6), run('Adresse de l\'opération', 426.8, 495.6), run('Nature des travaux', 574.7, 495.6),
    run('plancher', 697.3, 495.6), run('projetée', 697.7, 486.6),
    // Two applicants, two postal addresses, each two lines, centred on the number.
    run('12 rue Fictive', 283.5, 474), run('DUPONT Jean', 165.4, 469.4), run('99999 NULLEPART', 283.5, 465),
    run('Réfection de toiture, passage de bardeaux à bac acier', 519.7, 460.4), run('28/09/26', 32.5, 456),
    run('DP 074143 2600123', 90.1, 456), run('22 chemin des Arandellys', 401.6, 456), run('0', 708.2, 456), run('gris', 519.7, 451.4),
    run('7 impasse Privée', 283.5, 447), run('DUPONT-MARTIN Jeanne', 165.4, 442.4), run('99999 NULLEPART', 283.5, 438),
    // A three-line address puts its middle line on the number's; a line split in two sets its tail 20 points short of the site.
    run('7 impasse Privée', 283.5, 273), run('Résidence Inventée', 381, 273), run('445 rue de Bellevue', 401.6, 269),
    run('18/09/26', 32.5, 264), run('DP 074143 2600118', 90.1, 264), run('DUPONT Jean', 165.4, 264), run('Bât. Fictif', 283.5, 264),
    run('Création d\'une fenêtre de toit sur chalet 5', 519.7, 264), run('0', 708.2, 264), run('chalet 5', 401.6, 260),
    run('99999 NULLEPART', 283.5, 255),
  ), { city: city('wp-media-74143'), file: { board: 'filings', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.postedOn, row.purpose]), [
    ['DP 074143 26 00123', '22 chemin des Arandellys', '2026-09-28', '2026-10-02', 'Réfection de toiture, passage de bardeaux à bac acier gris'],
    ['DP 074143 26 00118', '445 rue de Bellevue chalet 5', '2026-09-18', '2026-10-02', 'Création d\'une fenêtre de toit sur chalet 5'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), PLANTED);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PLANTED);
});

test('Les Houches’s decisions: verdict and day from the row, a day after the edition is no day', () => {
  const rows = TOWN_LIST_READERS['town-houches-decisions'](page(
    run('DÉCISIONS DÉCLARATIONS PRÉALABLES', 309, 529), run('Surface de', 604.4, 498.6), run('Décision', 31.7, 493.7),
    run('Date de la', 746.9, 493.7), run('Numéro de dossier', 84.9, 489), run('Nom', 197.1, 488.9), run('Adresse', 293.7, 488.9),
    run('Adresse de l\'opération', 369.2, 488.9), run('Nature des travaux', 490.8, 488.9), run('plancher', 607.2, 488.9),
    run('Décision', 682, 489), run('affichée le', 28.7, 483.9), run('décision', 749, 483.9), run('projetée', 607.5, 479.1),
    run('12 rue Fictive', 252.2, 457.7), run('Construction d\'une annexe à usage d\'abri de', 449.8, 457.7),
    run('02/10/2026', 27.4, 453), run('DP 074143 2600120', 84, 453), run('DUPONT Jean', 157.8, 452.9), run('90 chemin du Viaduc', 360.8, 452.9),
    run('15', 617.3, 453), run('NON-OPPOSITION', 666.5, 452.9), run('01/10/2026', 744.2, 453),
    run('99999 NULLEPART', 252.2, 447.9), run('jardin', 449.8, 447.9),
    // Les Houches's own typos: a posting day `02/10/206`, a decision `08/09/2062`.
    run('7 impasse Privée', 252.2, 354.7), run('02/10/206', 29, 345), run('DP 074143 2600048', 84, 345), run('DUPONT Jean', 157.8, 345),
    run('Bât. Fictif', 252.2, 345), run('113 route des Granges', 360.8, 345), run('NON-OPPOSITION', 666.5, 345), run('08/09/2062', 744.2, 345),
    run('99999 NULLEPART', 252.2, 335.3),
  ), { city: city('wp-media-74143'), file: { board: 'decisions', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.verdict, row.decidedOn, row.postedOn]), [
    ['DP 074143 26 00120', '90 chemin du Viaduc', 'Non-opposition', '2026-10-01', '2026-10-02'],
    ['DP 074143 26 00048', '113 route des Granges', 'Non-opposition', null, '2026-10-02'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), PLANTED);
});

test('La Flotte’s scanned list, a word to a run: the day cut off its cell, the name after it never read', () => {
  const rows = readLaFlotteFilings(page(
    run('AVIS', 260, 750), run('DE', 286, 750), run('DÉPÔT', 302, 750),
    run('[Dossier', 49, 651), run('Date', 129, 651), run('de', 144, 651), run('dépôt|Demandeur', 152, 651), run('-', 207, 651),
    run('Identité', 211, 651), run('Parcelles', 276, 651), run('Adresse', 363, 651), run('du', 388, 651), run('terrain', 396, 651),
    run('l\'instruction', 498, 651),
    run('CU', 52, 630), run('017161', 62, 630), run('26', 84, 630), run('00126', 93, 630), run('25/09/2026|DUPONT', 137, 630),
    run('Jean', 190, 630), run('JAL316', 274, 630), run('29', 363, 630), run('Route', 372, 630), run('de', 390, 630),
    run('Saint', 398, 630), run('Martin', 414, 630), run('1mois', 478, 630),
    // A cell too long for its row wraps above it: the row's cells sit on its last line.
    run('SARL', 172, 543), run('DUPONT-FICTIVE', 188, 543), run('&', 246, 543), run('Chemin', 364, 543), run('du', 387, 543), run('Gros', 395, 543),
    run('DP', 52, 534), run('017161', 62, 534), run('26', 84, 534), run('00138', 92, 534), run('17/09/2026|', 137, 534),
    run('JEAN', 172, 534), run('B1289,', 277, 534), run('|Moulin', 364, 534), run('2', 477, 534), run('mois', 482, 534),
    // One number read twice: OCR misread the other.
    run('DP', 52, 525), run('017161', 62, 525), run('26', 84, 525), run('00128', 92, 525), run('17/09/2026', 137, 525), run('6', 364, 525),
    run('Rue', 369, 525), run('du', 381, 525), run('Rivage', 390, 525),
    run('DP', 52, 252), run('017161', 62, 252), run('26', 84, 252), run('00128', 92, 252), run('03/09/2026|Inventée', 137, 252),
    run('14', 364, 252), run('Rue', 372, 252), run('des', 384, 252), run('7', 396, 252), run('Chemins', 400, 252),
    run('AP', 51, 243), run('017161', 61, 243), run('26', 83, 243), run('0006', 91, 243), run('21/09/2026]', 137, 243),
    run('2', 363, 243), run('COURS', 368, 243), run('FELIX', 391, 243), run('FAURE', 408, 243),
  ), { city: city('wp-media-17161'), file: { board: 'filings', published: '2026-09-30' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.postedOn]), [
    ['CU 017161 26 00126', '29 Route de Saint Martin', '2026-09-25', '2026-09-30'],
    ['DP 017161 26 00138', 'Chemin du Gros Moulin', '2026-09-17', '2026-09-30'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), PLANTED);
  // The printed edition: a cell to a run, the day glued to the name.
  const printed = readLaFlotteFilings(page(
    run('Dossier', 53, 530), run('Date de dépôtDemandeur - Identité', 154, 530), run('Parcelles', 363, 530),
    run('Adresse du terrain', 469, 530), run('Délai d\'instruction', 604, 530),
    run('DP 017161 26 00122', 53, 472), run('17/08/2026DUPONT Jean', 161, 472), run('AE299', 363, 472),
    run('6 Chemin de Bellevue', 469, 472), run('2 mois', 604, 472),
  ), { city: city('wp-media-17161'), file: { board: 'filings', published: '2026-08-26' } });
  assert.deepEqual(printed.map((row) => [row.dossier, row.address, row.filedOn]), [['DP 017161 26 00122', '6 Chemin de Bellevue', '2026-08-17']]);
  assert.doesNotMatch(JSON.stringify(printed), PLANTED);
});

test('Lion-sur-Mer’s filings: a row from its number to the next, the site over its parcels, the centred applicant never read', () => {
  const rows = readLionFilings(page(
    run('LISTE DES AVIS DE DEPOT', 357, 570), run('Déclaration Préalable', 366, 553), run('N° de dossier', 47, 538),
    run('Lieu des travaux', 347, 538), run('Objet des travaux', 500, 538), run('Date dépôt', 765, 538), run('Demandeur', 185, 530),
    run('Surface', 651, 530), run('Hauteur', 709, 530), run('Date d\'affichage', 47, 523), run('Références cadastrales', 287, 523),
    run('DP 014 365 26 00053', 16, 508), run('1 rue de Ouistreham', 287, 500), run('DUPONT Jean', 166, 493),
    run('pose de 2 volets roulants', 463, 493), run('m', 722, 493), run('05/06/2026', 762, 493), run('05/06/2026', 16, 485), run('AC 29', 287, 477),
    run('DP 014 365 26 00084', 16, 437), run('22 rue des écoles', 287, 429), run('EXPERT ENERGIE et HABITAT pour', 141, 428),
    run('ITE enduit blanc', 463, 421), run('21/09/2026', 762, 421), run('DUPONT Jeanne', 172, 415), run('25/09/2026', 16, 414), run('AA 224', 287, 406),
    // A works authorisation is no permit, and its cells are its own.
    run('AT 014 365 26 A0001', 16, 392), run('12 bd Paul Doumer', 287, 387), run('SARL AU PALET D\'OR', 168, 379), run('20/02/2026', 16, 373),
    run('AB 205', 287, 366),
  ), { city: city('wp-media-14365'), file: { board: 'filings', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.postedOn, row.purpose]), [
    ['DP 014365 26 00053', '1 rue de Ouistreham', '2026-06-05', '2026-06-05', 'pose de 2 volets roulants'],
    ['DP 014365 26 00084', '22 rue des écoles', '2026-09-21', '2026-09-25', 'ITE enduit blanc'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), PLANTED);
});

test('Lion-sur-Mer’s decisions: two cards to a row, the beneficiary’s value never read', () => {
  const card = (x, value, top, extra = []) => [
    run('Avis de dépôt en date du :', x, top - 13.7), run('Bénéficaire :', x, top - 27.7),
    run('Sur un terrain sis :', x, top - 41.8 - extra.length * 12.5), run('nature des travaux :', x, top - 83.9 - extra.length * 12.5),
    run('Affichage en mairie le :', x, top - 98 - extra.length * 12.5),
    ...extra.map((text, i) => run(text, value, top - 40.2 - i * 12.5)),
  ];
  const rows = readLionDecisions(page(
    run('AUTORISATIONS D\'URBANISME DÉLIVRÉES', 266.9, 568.7),
    run('DP 014 365 26 00065', 16.7, 554.3), run('accord le 07/08/2026', 187.1, 554.6), ...card(16.6, 187.1, 554.3, ['et DUPONT Jeanne']),
    run('24/07/2026', 187.1, 540.6), run('DUPONT Jean', 187.1, 526.6), run('10 rue du Vivier', 187.1, 500),
    run('Remplacement 3 fenetres existantes', 187, 458.2), run('14/08/2026', 187.1, 443.8),
    run('DP 014 365 26 00056', 432.5, 554.3), run('refus le 24/08/2026', 611.4, 554.6), ...card(432.4, 611.4, 554.3),
    run('19/06/2026', 611.4, 540.6), run('DUPONT Paul', 611.4, 526.6), run('5 bis rue de Ouistreham', 611.4, 512.5),
    run('pose climatisation réversible', 611.3, 470.7), run('28/08/2026', 611.4, 456.3),
  ), { city: city('wp-media-14365'), file: { board: 'decisions', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.verdict, row.decidedOn, row.postedOn, row.purpose]), [
    ['DP 014365 26 00065', '10 rue du Vivier', '2026-07-24', 'Accord', '2026-08-07', '2026-08-14', 'Remplacement 3 fenetres existantes'],
    ['DP 014365 26 00056', '5 bis rue de Ouistreham', '2026-06-19', 'Refus', '2026-08-24', '2026-08-28', 'pose climatisation réversible'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), PLANTED);
});
