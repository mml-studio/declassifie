import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIEVE_PAGE_PROTOCOLS, SIEVE_PAGE_READERS, readLabelledNotice, sieveActLinks, spelledNumber } from './permitBoardsSievePages.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS, BOARD_READERS } from './permitBoards.js';
import { permitListFor } from './permitListsFeed.js';
import { SIEVE_PAGE_CITIES } from './sievePageCities.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const protocol = SIEVE_PAGE_PROTOCOLS['sieve-acts'];
const run = (x, y, text, size = 11) => ({ x, y, text, size });
const doc = (...pages) => ({ pages: pages.map((runs) => ({ runs })) });
const read = (layout, key, document, board = 'filings') => BOARD_READERS[layout](document, { city: city(key), file: { board } });

test('the sieve communes are in the permit registry, their protocols and layouts known', () => {
  for (const source of SIEVE_PAGE_CITIES) {
    assert.equal(permitListFor(source.insee), city(source.key), source.key);
    assert.ok(BOARD_PROTOCOLS[source.source.protocol], source.key);
    for (const layout of Object.values(source.source.layouts ?? {})) assert.equal(typeof BOARD_READERS[layout], 'function', layout);
    for (const layout of [source.source.layout, source.source.filingLayout].filter(Boolean)) assert.equal(typeof BOARD_READERS[layout], 'function', layout);
  }
  assert.equal(new Set(SIEVE_PAGE_CITIES.map((source) => source.insee)).size, SIEVE_PAGE_CITIES.length, 'one board per commune');
  assert.equal(BOARD_PROTOCOLS['sieve-acts'], protocol);
  assert.equal(BOARD_READERS['word-list-filings'], SIEVE_PAGE_READERS['word-list-filings']);
});

test('a link’s number and day are spelled out the way posted-acts reads them', () => {
  assert.equal(spelledNumber('ARRETE-2026.498-DP-076.057.25.00033.M01-NAME'), 'ARRETE 2026 498 DP 076 057 25 00033 M01 NAME');
  assert.equal(spelledNumber('tampon_AU Arrete Favorable DP 095 257 26 0 0078'), 'tampon AU Arrete Favorable DP 095 257 26 00078');
  assert.equal(spelledNumber('ARR_20261002_DP0222092600171'), 'ARR 2026 10 02 DP0222092600171');
});

test('sieve-acts drops the skipped links and keeps the newest numbers first, receipts on the filings board', () => {
  const html = [
    '<a href="/docs/certificats-urbanisme/recepisses/CU 87 114 2600075.pdf">📄 Télécharger</a>',
    '<a href="/docs/declarations-prealables/decisions/DP 87 114 2600048.pdf">📄 Télécharger</a>',
    '<a href="/docs/declarations-prealables/recepisses/DP 87 114 2600137.pdf">📄 Télécharger</a>',
    '<a href="/docs/declarations-prealables/decisions/DP 87 114 2600125.pdf">📄 Télécharger</a>',
  ].join('');
  const page = 'https://www.mairie-panazol.fr/demarches/';
  const found = protocol.index(city('panazol'), html, { url: page }, { since: '2026-08-01' });
  assert.deepEqual(found.files.map((file) => [file.row.dossier, file.board, file.layout]), [
    ['DP 087114 26 00137', 'filings', 'dematdoc-notice'],
    ['DP 087114 26 00125', 'decisions', 'dematdoc-notice'],
    ['DP 087114 26 00048', 'decisions', 'dematdoc-notice'],
  ]);
  assert.equal(found.files[0].row.board, 'filings');
  const links = sieveActLinks(city('barentin'), '<a href="/download/30660/?tmstv=1">ARRETE-2026.498-DP-076.057.26.00090-PRIVATE-Name</a>');
  assert.equal(links[0].key, '2600090');
  const barentin = protocol.index(city('barentin'), '<a href="/download/30660/?tmstv=1">ARRETE-2026.498-DP-076.057.26.00090-PRIVATE-Name</a>',
    { url: 'https://ville-barentin.fr/decisions' }, { since: '2026-08-01' });
  assert.equal(barentin.files[0].row.dossier, 'DP 076057 26 00090');
  assert.equal(barentin.files[0].url, 'https://ville-barentin.fr/download/30660/?tmstv=1');
  assert.equal(protocol.index(city('barentin'), '<p>maintenance</p>', { url: 'https://ville-barentin.fr/decisions' }, {}), null);
});

test('a town whose names swap day and month has the day its words say, its notices read by their labels', () => {
  const html = '<a href="/Statics/AV_2026-01-10_DP-071-105-26-00124_PRIVATE.pdf">AV DP 071 105 26 00124 - PRIVATE N° 2026_01_10 Mise en ligne le jeudi 01 octobre 2026 | pdf</a>'
    + '<a href="/Statics/AR_DP_071_105_24_S0134_M01_-_ADMI.pdf">AR DP 071 105 24 S0134 M01 - ADMI N° 2026_09_30 Mise en ligne le mercredi 30 septembre 2026</a>';
  const found = protocol.index(city('charnay-les-macon'), html, { url: 'https://www.charnay-les-macon.fr/74/actes.htm' }, { since: '2026-08-01' });
  assert.deepEqual(found.files.map((file) => [file.row.dossier, file.board, file.published, file.layout]), [
    ['DP 071105 26 00124', 'filings', '2026-10-01', 'labelled-notice'],
    ['DP 071105 24 S0134 M01', 'decisions', '2026-09-30', 'dematdoc-notice'],
  ]);
  const notice = doc([
    run(234, 548, 'AVIS DE DÉPÔT', 16), run(70, 437, 'Numéro Dossier PC 71105 26 00029'), run(83, 417, 'Date de dépôt 30/09/2026'),
    run(97, 397, 'Demandeur PRIVATE Person'), run(170, 378, '42 Rue Privée'), run(122, 338, 'Terrain 83 Place de Lévigny, 71850 CHARNAY-LES-MACON'),
    run(116, 298, 'Travaux La parcelle comprend deux logements'), run(70, 285, 'terrain. Il s’agira d’une pièce'), run(357, 111, 'Fait à CHARNAY-LES-MACON'),
  ]);
  const [row] = readLabelledNotice(notice, { city: city('charnay-les-macon'), file: { board: 'filings' } });
  assert.deepEqual([row.board, row.dossier, row.address, row.postcode, row.filedOn, row.purpose],
    ['filings', 'PC 071105 26 00029', '83 Place de Lévigny', '71850', '2026-09-30', 'La parcelle comprend deux logements terrain. Il s’agira d’une pièce']);
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|Privée/);
  const tacit = doc([
    run(228, 777, 'Décision tacite', 18), run(128, 682.2, 'Formulée par', 9.8), run(206, 680.2, 'PRIVATE Person'),
    run(61, 604.5, 'Enregistrée sous le numéro', 9.8), run(206, 602.4, 'DP0383372610064'), run(138, 553.5, 'Déposée le', 9.8), run(206, 551.5, '03/07/2026'),
    run(68, 502.6, 'Référence(s) cadastrale(s)', 9.8), run(206, 500.5, 'AR0116'),
    run(66, 454.2, 'Concernant les travaux sis', 9.8), run(206, 452.1, '205 avenue jean jaures'), run(206, 438.7, '38140 RIVES'),
    run(114, 338.9, 'Nature du projet', 9.8), run(206, 336.8, 'Agrandissement balcon'), run(142, 287.9, 'Architecte', 9.8),
  ]);
  const [decided] = readLabelledNotice(tacit, { city: city('rives'), file: { board: 'filings' } });
  assert.deepEqual([decided.board, decided.dossier, decided.address, decided.filedOn, decided.parcels, decided.purpose, decided.verdict],
    ['decisions', 'DP 038337 26 10064', '205 avenue jean jaures', '2026-07-03', 'AR 116', 'Agrandissement balcon', 'Accord tacite']);
});

test('the Word tables of Noisy-le-Roi and Auchel: a run goes to the header starting nearest it', () => {
  const header = [run(28.3, 390.6, 'Date de dépôt'), run(153.7, 390.6, 'Numéro de dossier'), run(278.8, 390.6, 'Pétitionnaire'),
    run(408.8, 390.6, 'Adresse du projet'), run(573.8, 390.6, 'Description du projet')];
  const rows = read('word-list-filings', 'auchel', doc([
    ...header,
    run(28.3, 352, "AUTORISATION DE CONSTRUIRE, D'AMENAGER OU DE MODIFIER UN ETABLISSEMENT RECEVANT DU PUBLIC (ERP)"),
    run(28.3, 314.8, '07/09/2026'), run(153.7, 314.8, 'DP 62048 26 00129'), run(281.9, 314.8, 'PRIVATE Youssef'), run(278.8, 302.1, 'SARL DIMO'),
    run(408.8, 314.8, '19 rue Florent Evrard'), run(408.8, 302.1, '62260 Auchel'), run(573.8, 314.8, 'installation d’une pompe à chaleur'),
    run(28.3, 280, '18/09/2026'), run(153.7, 280, 'DP 62048 25 00148'), run(153.7, 267.3, 'M01'), run(281.9, 280, 'PRIVATE Olivier'),
    run(408.8, 280, '33 Rue Pierre Curie'), run(573.8, 280, 'Création d’une extension'),
  ]));
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.applicant]), [
    ['DP 062048 26 00129', '19 rue Florent Evrard', '2026-09-07', null],
    ['DP 062048 25 00148 M01', '33 Rue Pierre Curie', '2026-09-18', null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE/);
  const decisions = read('word-list-decisions', 'noisy-le-roi', doc([
    run(55.6, 435.8, 'Numéro de'), run(64.8, 423.1, 'dossier'), run(166.1, 435.8, 'Pétitionnaire'), run(274, 435.8, 'Décision'),
    run(354.5, 435.8, 'Date de'), run(349.7, 423.1, 'signature'), run(455, 435.8, 'Nature des travaux'), run(628.1, 435.8, 'Adresse des travaux'),
    run(778.8, 435.8, 'Surface'),
    run(34, 392.2, 'AP 78455 26 G004'), run(144.4, 392.2, 'Café'), run(264.4, 392.2, 'Favorable'), run(339.4, 392.2, '09/09/2026'),
    run(599.5, 392.2, '61 rue André le Bourblanc'),
    run(34, 349.9, 'DP 78455 26 G0074'), run(144.4, 349.9, 'SNCF GARE ET CONNEXION'), run(264.4, 349.9, 'Favorable'), run(264.4, 337.1, 'avec'),
    run(264.4, 324.6, 'prescriptions'), run(339.4, 349.9, '15/09/2026'), run(419.4, 349.9, 'Rénovation de la charpente'),
    run(599.5, 349.9, 'Place de la Gare'), run(599.5, 337.1, '78590 NOISY-LE-ROI'), run(777.6, 349.9, 'm²'),
  ]), 'decisions');
  assert.deepEqual(decisions.map((row) => [row.dossier, row.address, row.verdict, row.decidedOn, row.applicant]),
    [['DP 078455 26 G0074', 'Place de la Gare', 'Favorable avec prescriptions', '2026-09-15', 'SNCF GARE ET CONNEXION']]);
});

test('Chambray-lès-Tours’s table keeps the site, never the applicant’s own address', () => {
  const rows = read('chambray-filings', 'chambray-les-tours', doc([
    run(38.2, 466.1, 'Date de dépôt', 10), run(119.5, 466.1, 'Numéro du DOSSIER', 10), run(300.5, 466.1, 'Demandeur', 10),
    run(467, 466.1, 'Objet des travaux', 10), run(621.1, 466.1, 'Adresse des travaux', 10), run(753.2, 471.9, 'Surface de', 10), run(758.3, 460.1, 'plancher', 10),
    run(20, 445, 'Déclaration Préalable de Construction (1/1)', 9),
    run(48, 423.9, '02/03/2026', 8.4), run(130.2, 423.9, 'DP 37050 26 00034', 8.4), run(278.3, 434.4, 'Monsieur PRIVATE', 8.4),
    run(292.1, 424.1, '24 Rue Privée', 8.4), run(264.1, 413.6, '37170 CHAMBRAY-LÈS-TOURS', 8.4),
    run(431.8, 423.9, 'Remplacement d’une véranda existante', 8.4), run(632, 423.9, '24 Rue de l’Avenir', 8.4),
    run(48, 392.6, '09/03/2026', 8.4), run(130.2, 392.6, 'DP 37050 26 00039', 8.4), run(316, 403.1, 'SCI R2CB', 8.4),
    run(271.7, 392.7, '12 RUE BLAISE PASCAL', 8.4), run(298.7, 382.3, '37019 TOURS', 8.4),
    run(428.6, 392.6, 'Poste de transformation', 8.4), run(627.9, 392.6, '5 Rue Rolland Pilain', 8.4),
    run(40, 60, 'Edité et affiché le : 29/09/2026', 8), run(780, 60, '1/10', 8),
  ]));
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.filedOn, row.applicant]), [
    ['filings', 'DP 037050 26 00034', '24 Rue de l’Avenir', '2026-03-02', null],
    // The applicant cells of two rows sit as close as a cell's lines: their first line is a person's, none is kept.
    ['filings', 'DP 037050 26 00039', '5 Rue Rolland Pilain', '2026-03-09', null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|Privée|BLAISE/);
});

test('Villeneuve-Tolosane’s and L’Huisserie’s registers: a row is a decision once it has a verdict', () => {
  const header = [
    run(27.2, 776.4, 'TYPE', 6.4), run(64, 776.4, 'N° ENREGISTREMENT', 6.4), run(149.9, 780.6, 'DATE', 6.4), run(143.1, 772.2, 'DEMANDE', 6.4),
    run(198.1, 776.4, 'DEMANDEUR', 6.4), run(292.1, 776.4, 'ADRESSE', 6.4), run(372.4, 776.4, 'ARCHITECTE', 6.4), run(449.9, 776.4, 'ADRESSE2', 6.4),
    run(514.1, 776.4, 'SECTION', 6.4), run(566.8, 776.4, 'N°', 6.4), run(600, 780.6, 'SUPERFICIE', 6.4), run(672.5, 776.4, 'PROJET', 6.4),
    run(743.5, 776.4, 'SURFACE TAXABLE', 6.4), run(811.3, 784.7, 'NOMBRE', 6.4), run(852.8, 776.4, 'TAXE AMENAGEMENT', 6.4),
    run(947.1, 776.4, 'DATE AFFICHAGE DEPOT ADS', 6.4), run(1054.8, 776.4, 'DECISION', 6.4), run(1113.1, 776.4, 'Colonne4', 6.4),
  ];
  const line = (y, cells) => cells.map(([x, text]) => run(x, y, text, 6.4));
  const register = read('villeneuve-tolosane-register', 'villeneuve-tolosane', doc([
    ...header,
    ...line(742.9, [[30.4, 'DP'], [69.2, '031 588 26 00001'], [141.9, '07/01/2026'], [190.9, 'PRIVATE Yvann'], [270.5, '14 Rue Privée 31270'],
      [438.9, '13 Rue d’Aquitaine'], [522.3, 'AC'], [565.1, '169'], [610.5, '431'], [640.4, 'Aménagement garage'],
      [970.4, '12/01/2026'], [1052.4, '22/01/2026'], [1102.9, 'NON OPPOSITION']]),
    ...line(717.7, [[30.4, 'DP'], [69.2, '031 588 26 00140'], [141.9, '15/09/2026'], [190.9, 'PRIVATE Anne'], [270.5, '3 Rue Privée 31270'],
      [438.9, '8 rue du Périgord'], [522.3, 'AB'], [565.1, '162'], [640.4, 'Clôture'], [970.4, '20/09/2026']]),
  ]));
  assert.deepEqual(register.map((row) => [row.board, row.dossier, row.address, row.parcels, row.filedOn, row.verdict, row.decidedOn, row.postedOn]), [
    ['decisions', 'DP 031588 26 00001', '13 Rue d’Aquitaine', 'AC 169', '2026-01-07', 'Non-opposition', '2026-01-22', null],
    ['filings', 'DP 031588 26 00140', '8 rue du Périgord', 'AB 162', '2026-09-15', null, null, '2026-09-20'],
  ]);
  assert.doesNotMatch(JSON.stringify(register), /PRIVATE|Privée/);
  const list = read('lhuisserie-list', 'lhuisserie', doc([
    run(74.9, 531.6, 'N° dossier', 6.1), run(156.5, 531.6, 'Demandeur', 6.1), run(242.7, 531.6, 'Adresse des travaux', 6.1),
    run(362.9, 531.6, 'Parcelle(s)', 6.1), run(516.1, 531.6, 'Nature des travaux', 6.1), run(648.3, 531.6, 'Date de dépôt', 6.1), run(721.7, 531.6, 'Décision', 6.1),
    ...[[517.4, 'DP 53 119 2600061', '34 domaine Sainte-Croix', 'AD 0061', '01/06/2026', 'Accord Tacite'],
      [503.3, 'CUB 53 119 2600008', '1 PIERRE BLANCHE', 'A 0070', '12/02/2026', 'Favorable'],
      [489.1, 'DP 53 119 2600102', '43 allée de la Forêt', 'AN 0109', '01/10/2026', null]].flatMap(([y, number, site, parcel, day, verdict]) => [
      run(64.3, y, number, 6.1), run(134.9, y, 'PRIVATE Name', 6.1), run(238.3, y, site, 6.1), run(366.4, y, parcel, 6.1),
      run(514.3, y, 'Travaux', 6.1), run(651.5, y, day, 6.1), ...(verdict ? [run(716.3, y, verdict, 6.1)] : [])]),
  ]));
  assert.deepEqual(list.map((row) => [row.board, row.dossier, row.address, row.parcels, row.filedOn, row.verdict]), [
    ['decisions', 'DP 053119 26 00061', '34 domaine Sainte-Croix', 'AD 61', '2026-06-01', 'Accord tacite'],
    ['filings', 'DP 053119 26 00102', '43 allée de la Forêt', 'AN 109', '2026-10-01', null],
  ]);
});
