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
  assert.equal(BOARD_READERS['chambray-filings'], SIEVE_PAGE_READERS['chambray-filings']);
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

test('the Word tables of Noisy-le-Roi and Auchel are read by the town-list readers of their template', () => {
  const header = [run(28.3, 390.6, 'Date de dépôt'), run(153.7, 390.6, 'Numéro de dossier'), run(278.8, 390.6, 'Pétitionnaire'),
    run(408.8, 390.6, 'Adresse du projet'), run(573.8, 390.6, 'Description du projet')];
  const rows = read('town-filed-before', 'auchel', doc([
    ...header,
    run(28.3, 352, "AUTORISATION DE CONSTRUIRE, D'AMENAGER OU DE MODIFIER UN ETABLISSEMENT RECEVANT DU PUBLIC (ERP)"),
    run(28.3, 314.8, '07/09/2026'), run(153.7, 314.8, 'DP 62048 26 00129'), run(281.9, 314.8, 'PRIVATE Youssef'), run(278.8, 302.1, 'SARL DIMO'),
    run(408.8, 314.8, '19 rue Florent Evrard'), run(408.8, 302.1, '62260 Auchel'), run(573.8, 314.8, 'installation d’une pompe à chaleur'),
    run(28.3, 280, '18/09/2026'), run(153.7, 280, 'DP 62048 25 00148'), run(153.7, 267.3, 'M01'), run(281.9, 280, 'PRIVATE Olivier'),
    run(408.8, 280, '33 Rue Pierre Curie'), run(573.8, 280, 'Création d’une extension'),
  ]));
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.applicant]), [
    ['DP 062048 26 00129', '19 rue Florent Evrard', '2026-09-07', 'SARL DIMO'],
    ['DP 062048 25 00148 M01', '33 Rue Pierre Curie', '2026-09-18', null],
  ], 'the company under the person is kept, the person never');
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE/);
  const decisions = read('town-decided-until', 'noisy-le-roi', doc([
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

test('Garchizy’s misprinted numbers: `DPC` is a declaration, a lettered counter of three digits takes its fourth', () => {
  assert.equal(spelledNumber('DPC_058_121_26_N0010_PRIVATE NAME_arrete'), 'DP 058 121 26 N0010 PRIVATE NAME arrete');
  assert.equal(spelledNumber('DP 05812126 N007 : REFUSÉ'), 'DP 05812126 N0007 : REFUSÉ');
  assert.equal(spelledNumber('DP 058121 26 N0011'), 'DP 058121 26 N0011', 'four digits stay');
  const base = 'http://www.garchizy.fr/images/filemanager/source/URBANISME/AUTORISATION URBA/';
  const html = [
    `<p><a href="${base}DPC_058_121_26_N0010_PRIVATE NAME_arrete.pdf" target="_blank">DP-058-12126-N0010 :</a></p>`,
    `<p><a href="${base}DP 05812126 N007-REFUSE.pdf" target="_blank">DP 05812126 N007 : REFUS&Eacute;</a></p>`,
    `<p><a href="${base}DPC_058_121_26_N0022_PRIVATE_arrete.pdf" target="_blank">DP-05812126-N0022 : ACCORD&Eacute;</a></p>`,
    `<p><a href="${base}DP-05812125N0053-ACCORDE.pdf" target="_blank">DP 058121 25 N0053 : ACCORD&Eacute;</a></p>`,
    `<p><a href="${base}PC_058_121_24_N0008_arrete_annexes.pdf" target="_blank">&nbsp;PC 058121&nbsp;24&nbsp;N008 : ACCORD&Eacute;</a></p>`,
  ].join('');
  const found = protocol.index(city('garchizy'), html, { url: city('garchizy').page }, { since: '2026-08-04' });
  assert.deepEqual(found.files.map((file) => [file.row.dossier, file.board, file.layout]), [
    ['DP 058121 26 N0022', 'decisions', 'dematdoc-notice'],
    ['DP 058121 26 N0010', 'decisions', 'dematdoc-notice'],
    ['DP 058121 26 N0007', 'decisions', 'dematdoc-notice'],
    ['DP 058121 25 N0053', 'decisions', 'dematdoc-notice'],
  ], 'newest number first; an undated act of 2024 is left');
  assert.equal(found.files[1].url, `${base.replace(/ /g, '%20')}DPC_058_121_26_N0010_PRIVATE%20NAME_arrete.pdf`);
  assert.doesNotMatch(JSON.stringify(found.files.map((file) => file.row)), /PRIVATE/);
});

// Runs as Pomponne's Excel export prints them: each cell's run clipped to its row's box.
const cell = (x, x1, y, text, clip) => ({ x, x1, y, text, size: 11.04, ...(clip ? { clip: { x0: 18.96, y0: clip[0], x1: 1150.2, y1: clip[1] } } : {}) });

test('Pomponne’s weekly tables: a row is its number’s box, a day without its year takes the right one', () => {
  const decisions = read('pomponne-decisions', 'pomponne', doc([
    cell(25.2, 68.1, 652.3, 'Date de'), cell(758, 817.8, 652.3, 'Surface du'), cell(1092.6, 1145.3, 652.3, 'Affichage'),
    cell(94.6, 178.2, 645.2, 'Numéro dossier'), cell(243.7, 304.1, 645.2, 'Demandeur'), cell(360.4, 482, 645.2, 'Adresse du demandeur'),
    cell(510.1, 617, 645.2, 'Adresse des travaux'), cell(634, 740.1, 645.2, 'Référence Cadastre'), cell(846, 944.7, 645.2, 'Nature des travaux'),
    cell(999.1, 1044.9, 645.2, 'Décision'), cell(30.1, 60, 638.1, 'dépôt'), cell(769.3, 803.5, 638.1, 'terrain'), cell(1113, 1122.3, 638.1, 'le'),
    cell(967.8, 1079.2, 623.9, 'NON-OPPOSITION le', [607.7, 634.3]), cell(28.9, 62.4, 617, '11-juin'),
    cell(82.9, 191.2, 617, 'DP 077 372 26 00021', [607.7, 634.3]), cell(205.5, 343.7, 617, 'Monsieur DUPONT Jean', [607.7, 634.3]),
    cell(356.7, 487.7, 617, '12 rue Fictive', [607.7, 634.3]), cell(498.9, 629.9, 617, '37 avenue de l\'Impératrice', [607.7, 634.3]),
    cell(670.8, 701, 617, 'BB 68', [607.7, 634.3]), cell(774.2, 798.7, 617, '2135', [607.7, 634.3]), cell(852.1, 938.7, 617, 'Abattage d\'arbres', [607.7, 634.3]),
    cell(1102.9, 1132.2, 617, '31-juil', [607.7, 634.3]), cell(994.5, 1049.6, 610.2, '27/07/2026', [607.7, 634.3]),
    // A certificate: no permit's number, its cells nobody else's.
    cell(214.6, 336, 534.2, 'SAS DUPONT', [511.2, 551.5]), cell(351.9, 493.7, 534.2, '12 rue Fictive', [511.2, 551.5]),
    cell(968.6, 1078.4, 534.2, 'NON-REALISABLE le', [511.2, 551.5]), cell(28.9, 61.9, 527.4, '18-juin'),
    cell(79.9, 193, 527.4, 'CuB 077 372 26 00025', [511.2, 551.5]), cell(512.6, 614.6, 527.4, '1 allée des Bégonias', [511.2, 551.5]),
    cell(848.1, 942.7, 527.4, 'Construction neuve', [511.2, 551.5]), cell(994.5, 1049.6, 520.5, '30/07/2026', [511.2, 551.5]),
    cell(857, 937, 389.5, 'Construction de', [318.3, 400]), cell(213.5, 337.1, 362.1, 'S.C.I.E.R représentée par', [318.3, 400]),
    cell(349.1, 496.3, 362.1, '2 quai Fictif / C102 Hall', [318.3, 400]), cell(27.1, 63.8, 355.3, '31-déc.'),
    cell(82.9, 189.9, 355.3, 'PC 077 372 25 00019', [318.3, 400]), cell(503, 624, 355.3, '2 rue du Général Leclerc', [318.3, 400]),
    cell(670.8, 700.7, 355.3, 'BK 78', [318.3, 400]), cell(968.5, 1075.3, 355.3, 'REFUS le 02/09/2026', [318.3, 400]),
    cell(1099.2, 1135.8, 355.3, '04-sept', [318.3, 400]), cell(221.8, 325.9, 348.4, 'Monsieur Jean DUPONT', [318.3, 400]),
    cell(367.4, 475.3, 348.4, 'A 77400 POMPONNE', [318.3, 400]), cell(868.6, 922.3, 321.1, 'automobile', [318.3, 400]),
    cell(82.9, 192.9, 208.6, 'DP 077 372 23 00009', [163, 248.4]), cell(977.6, 1069.4, 208.6, 'REJET TACITE le', [163, 248.4]),
    cell(28.7, 62.3, 201.7, '13-mai'), cell(204.3, 343.3, 201.7, 'Monsieur DUPONT Jean', [163, 248.4]),
    cell(359.7, 482.8, 201.7, '12 rue Fictive', [163, 248.4]), cell(501.9, 625, 201.7, '65bis route de Villevaudé', [163, 248.4]),
    cell(1099.2, 1135.8, 201.7, '25-sept', [163, 248.4]), cell(837.8, 955.7, 196, 'l\'implantation de la piscine', [163, 248.4]),
    cell(126, 147.2, 194.9, 'M01', [163, 248.4]), cell(994.5, 1049.6, 194.9, '24/09/2026', [163, 248.4]),
  ]), 'decisions');
  assert.deepEqual(decisions.map((row) => [row.dossier, row.address, row.parcels, row.landArea, row.filedOn, row.verdict, row.decidedOn, row.postedOn]), [
    ['DP 077372 26 00021', '37 avenue de l\'Impératrice', 'BB 68', '2135', '2026-06-11', 'Non-opposition', '2026-07-27', '2026-07-31'],
    ['PC 077372 25 00019', '2 rue du Général Leclerc', 'BK 78', null, '2025-12-31', 'Refus', '2026-09-02', '2026-09-04'],
    ['DP 077372 23 00009 M01', '65bis route de Villevaudé', null, null, '2026-05-13', 'REJET TACITE', '2026-09-24', '2026-09-25'],
  ]);
  const filings = read('pomponne-filings', 'pomponne', doc([
    cell(64.9, 107.8, 699.5, 'Date de'), cell(704.1, 760.2, 699.5, 'Référence'), cell(792.9, 852.7, 699.5, 'Surface du'),
    cell(997.9, 1050.6, 699.5, 'Affichage'), cell(141.5, 225.1, 692.4, 'Numéro dossier'), cell(290.7, 351, 692.4, 'Demandeur'),
    cell(407.3, 528.9, 692.4, 'Adresse du demandeur'), cell(559.4, 666.3, 692.4, 'Adresse des travaux'), cell(877.8, 976.6, 692.4, 'Nature des travaux'),
    cell(69.8, 99.8, 685.3, 'dépôt'), cell(707.2, 757.2, 685.3, 'Cadastre'), cell(804.2, 838.5, 685.3, 'terrain'), cell(1018.3, 1027.6, 685.3, 'le'),
    cell(129.9, 241.2, 664.2, 'PC 077 372 21 00012', [641.1, 681.5]), cell(253.7, 392.6, 664.2, 'Monsieur Jean DUPONT', [641.1, 681.5]),
    cell(872.2, 985.2, 664.2, 'Ajout d\'une terrasse et', [641.1, 681.5]), cell(71.4, 99.3, 657.3, '4-mai'),
    cell(404.6, 533.5, 657.3, '12 rue Fictive', [641.1, 681.5]), cell(549.3, 678.2, 657.3, '19 rue du Général Leclerc', [641.1, 681.5]),
    cell(712.4, 749.4, 657.3, 'BH 307', [641.1, 681.5]), cell(1006.1, 1039.7, 657.3, '07-mai', [641.1, 681.5]),
    cell(172.9, 194.4, 650.5, 'M04', [641.1, 681.5]), cell(250.6, 392.4, 650.5, 'et Madame DUPONT', [641.1, 681.5]), cell(896, 958.6, 650.5, 'd\'une clôture', [641.1, 681.5]),
    cell(257.4, 387, 629.7, 'SAS RJA représentée par', [613.5, 640.2]), cell(403, 536.5, 629.7, '12 rue Fictive', [613.5, 640.2]),
    cell(881.5, 976.1, 629.7, 'Pose de panneaux', [613.5, 640.2]), cell(68.3, 101.9, 622.9, '13-mai'),
    cell(129.9, 236.8, 622.9, 'DP 077 372 26 00016', [613.5, 640.2]), cell(576.8, 649.3, 622.9, '1 avenue Allou', [613.5, 640.2]),
    cell(715.8, 745.7, 622.9, 'BA 19', [613.5, 640.2]), cell(812.2, 830.6, 622.9, '153', [613.5, 640.2]), cell(1006.1, 1039.7, 622.9, '15-mai', [613.5, 640.2]),
    cell(258, 383.6, 616.1, 'Madame DUPONT Jean', [613.5, 640.2]), cell(407.6, 529, 616.1, '99999 VILLE FICTIVE', [613.5, 640.2]), cell(908.5, 946.3, 616.1, 'solaires', [613.5, 640.2]),
  ]));
  assert.deepEqual(filings.map((row) => [row.board, row.dossier, row.address, row.postcode, row.filedOn, row.postedOn, row.purpose]), [
    // A modification's filing is of the year of the newest day the table names.
    ['filings', 'PC 077372 21 00012 M04', '19 rue du Général Leclerc', '77400', '2026-05-04', '2026-05-07', 'Ajout d\'une terrasse et d\'une clôture'],
    ['filings', 'DP 077372 26 00016', '1 avenue Allou', '77400', '2026-05-13', '2026-05-15', 'Pose de panneaux solaires'],
  ]);
  for (const row of [...decisions, ...filings]) {
    assert.equal(row.applicant, null);
    assert.doesNotMatch(JSON.stringify(row), /DUPONT|Fictiv|FICTIVE|99999|S\.C\.I\.E\.R|RJA|POMPONNE|Bégonias/, row.dossier);
  }
  const page = '<a class="wpfd_downloadlink" href="https://pomponne.fr/download/150/avis/10534/tableau-daffichage-des-decisions-semaine-38.pdf" title="Tableau d&#039;affichage des décisions - semaine 38"><span>Tableau</span></a>'
    + '<a class="downloadlink wpfd_downloadlink" href="https://pomponne.fr/download/150/avis/10534/tableau-daffichage-des-decisions-semaine-38.pdf">Télécharger</a>'
    + '<a class="wpfd_downloadlink" href="https://pomponne.fr/download/150/avis/10535/tableau-daffichage-des-depo%cc%82ts-semaine-38.pdf">Télécharger</a>';
  const { files } = BOARD_PROTOCOLS['posted-lists'].index(city('pomponne'), page, { url: city('pomponne').page }, {});
  assert.deepEqual(files.map((file) => [file.board, file.layout, file.rolling]), [['decisions', 'pomponne-decisions', true], ['filings', 'pomponne-filings', true]]);
});

test('Neuville-de-Poitou’s register: a row hangs from its filing day, the applicant’s cell never read', () => {
  const head = (y, last) => [run(83.5, y, 'DOSSIER', 7.4), run(200.9, y, 'DATES', 7.4), run(296.3, y, 'DEMANDEUR', 7.4), run(431.1, y, 'TERRAIN', 7.4),
    run(582.6, y, 'INFORMATIONS', 7.4), run(last === 'LIMITE' ? 754.1 : 748.4, y, last, 7.4)];
  const rows = read('neuville-de-poitou-register', 'neuville-de-poitou', doc([
    run(28.3, 510, 'Registre des dossiers en cours', 14), run(372, 481, 'Édition du 04/09/2026', 9), ...head(451.4, 'LIMITE'),
    run(52.9, 333.3, 'DÉCLARATION PRÉALABLE', 7.4), run(178.4, 333.3, 'Déposé le 05/06/2026', 7.4), run(258, 333.3, 'M. DUPONT Jean', 7.4),
    run(385.5, 333.3, '42 RUE DE SAINT MAUR', 7.4), run(513.1, 333.3, 'Nature des travaux : Construction(s) nouvelle(s)/Construction', 7.4),
    run(711.5, 333.3, 'Délai 1 mois', 7.4), run(57.6, 324.6, 'CONSTRUCTION (Initiale)', 7.4), run(258, 324.6, '12 rue Fictive', 7.4),
    run(385.5, 324.6, '86170 NEUVILLE-DE-POITOU', 7.4), run(513.1, 324.6, 'annexe(s)/habitation', 7.4), run(711.5, 324.6, 'Date limite le 04/10/2026', 7.4),
    run(258, 315.8, '99999 VILLE FICTIVE', 7.4), run(385.5, 315.8, 'superficie : 1634 m²', 7.4), run(65.6, 307.1, 'DP 086177 26 N0062', 7.4),
    run(513.1, 290, 'Surface de plancher totale à construire : 18.5 m²', 7.4), run(387.4, 26.2, 'Page 3/7', 7.4),
  ], [
    run(28.3, 522, 'Registre des décisions', 14), ...head(453.7, 'DÉCISION'),
    run(52.9, 196.8, 'DÉCLARATION PRÉALABLE', 7.4), run(178.4, 196.8, 'Déposé le 30/04/2026', 7.4), run(258, 196.8, 'DUPONT Jean Marie-', 7.4),
    run(385.5, 196.8, '9 Avenue de Saumur', 7.4), run(711.5, 196.8, 'Favorable avec Reserves le', 7.4), run(57.6, 188.1, 'CONSTRUCTION (Initiale)', 7.4),
    run(175.4, 188.1, 'Complété le 09/06/2026', 7.4), run(258, 188.1, 'Fictive', 7.4), run(385.5, 188.1, '86170 Neuville-de-Poitou', 7.4),
    run(711.5, 188.1, '07/07/2026', 7.4), run(258, 179.3, '12 rue Fictive', 7.4), run(385.5, 179.3, 'superficie : 820 m²', 7.4),
    run(65.6, 170.6, 'DP 086177 26 N0056', 7.4), run(258, 170.6, '99999 VILLE FICTIVE', 7.4),
    // Works on a public building: no permit, its cells nobody else's.
    run(35.6, 117.4, 'AUTORISATION DE TRAVAUX sur ERP', 7.4), run(178.4, 117.4, 'Déposé le 18/03/2026', 7.4), run(258, 117.4, 'DUPONT SARL', 7.4),
    run(385.5, 117.4, '2 bis ALL JEAN MONNET', 7.4), run(711.5, 117.4, 'Favorable avec Reserves le', 7.4), run(86.8, 108.7, '(Initiale)', 7.4),
    run(711.5, 108.7, '10/07/2026', 7.4), run(65.9, 91.2, 'AT 086177 26 N0003', 7.4),
  ]));
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.postcode, row.landArea, row.filedOn, row.verdict, row.decidedOn, row.floorArea, row.purpose]), [
    ['filings', 'DP 086177 26 N0062', '42 RUE DE SAINT MAUR', '86170', '1634', '2026-06-05', null, null, '18.5', 'Construction(s) nouvelle(s)/Construction annexe(s)/habitation'],
    ['decisions', 'DP 086177 26 N0056', '9 Avenue de Saumur', '86170', '820', '2026-04-30', 'Favorable avec Reserves', '2026-07-07', null, null],
  ]);
  for (const row of rows) {
    assert.equal(row.applicant, null);
    assert.doesNotMatch(JSON.stringify(row), /DUPONT|Fictiv|FICTIVE|99999|MONNET|Page/, row.dossier);
  }
});
