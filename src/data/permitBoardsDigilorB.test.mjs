import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIGILOR_TOWNS } from './digilorTowns.js';
import { DIGILOR_TOWNS_B } from './digilorTownsB.js';
import { BOARD_READERS } from './permitBoards.js';
import { PERMIT_LIST_READERS, digilorDocuments, permitListFor, scrubPermitListRow } from './permitListsFeed.js';
import { readConcarneauRegister, readHarnesFiling, readHarnesOrder, readHeninTable, readIllkirchList, readSaintLaurentList, readVerrieresFiling, readVerrieresOrder, readStateFormOrder } from './permitBoardsDigilorB.js';

const town = (key) => DIGILOR_TOWNS.find((item) => item.key === key);
const doc = (app, id, cat, sub, title, day = '2026-09-28') => ({
  id, id_cat: cat, id_sscat: sub, nom_affichage: title, aff_deb: day, url_uiid: `./upload/${app}/${id}.pdf`,
});
const picked = (key, docs, since = '2026-08-01') => digilorDocuments(town(key), docs, since)
  .map((file) => [file.url.replace(/^.*%2F/, ''), file.board, file.layout]).sort();

test('every batch B town is a Digilor town of the permit registry, each shelf read by a known layout', () => {
  assert.ok(DIGILOR_TOWNS_B.length > 0);
  for (const { key } of DIGILOR_TOWNS_B) {
    const city = town(key);
    assert.equal(permitListFor(city.insee), city, key);
    assert.equal(city.source.kind, 'digilor');
    assert.match(city.page, new RegExp(`/documents/${city.source.app}$`));
    assert.ok(Object.isFrozen(city.source.shelves));
    for (const shelf of city.source.shelves) {
      assert.ok(BOARD_READERS[shelf.layout] ?? PERMIT_LIST_READERS[shelf.layout], `${key}: ${shelf.layout}`);
      assert.ok(['filings', 'decisions', 'auto'].includes(shelf.board), `${key}: ${shelf.board}`);
    }
  }
});

test('Montluçon’s sub-category gives its two Cart@DS reports by title, the notices beside them left out', () => {
  assert.deepEqual(picked('digilor-montlucon', [
    doc(216, 1, 2442, 3015, '2026_09_28_dépôts'), doc(216, 2, 2442, 3015, '2026_09_28_décisions'),
    doc(216, 3, 2442, 3015, '2026_08_17_dépôt'), doc(216, 4, 2442, 0, 'ACTIVATION ANTENNE 4G MONTLUCON-NERDRE'),
    doc(216, 5, 2446, 3025, 'Arrêté de circulation'),
  ]), [
    ['1.pdf', 'filings', 'cartds-report-filings'], ['2.pdf', 'decisions', 'cartds-report-decisions'],
    ['3.pdf', 'filings', 'cartds-report-filings'],
  ]);
});

const run = (text, x, y, size = 8) => ({ text, x, x1: x + text.length * 4, y, size });
const page = (...runs) => ({ pages: [{ runs }] });
const PRIVATE = /PRIVATE|PERSON|Privée/;

test('Saint-Laurent-du-Var’s family shelves give the lists of dossiers filed, a tacit-decision certificate left out', () => {
  assert.deepEqual(picked('digilor-saint-laurent-du-var', [
    doc(151, 1, 1672, 1844, 'Permis de construire déposés avant le 01.10.2026'),
    doc(151, 2, 1672, 1845, 'Déclarations préalables déposées avant le 24.09.2026'),
    doc(151, 3, 1672, 1852, 'Permis d\'aménager déposé avant le 01.10.2026'),
    doc(151, 4, 1672, 1845, 'DP00612326C0062 TACITE LE 04.06.2026'),
    doc(151, 5, 1673, 1848, 'Avis d’enquête publique'),
  ]), [
    ['1.pdf', 'filings', 'digilor-saint-laurent-list'], ['2.pdf', 'filings', 'digilor-saint-laurent-list'],
    ['3.pdf', 'filings', 'digilor-saint-laurent-list'],
  ]);
});

const SAINT_LAURENT_HEADER = (y) => [
  run('Superficie', 617, y + 14), run('Nombre', 1009, y + 14),
  run('Nom et adresse du', 314, y + 7), run('Adresse des travaux', 461, y + 7), run('Surface de', 910, y + 7), run('Nombre de', 1075, y + 7),
  run('Date de dépôt', 35, y), run('Numéro de dossier', 157, y), run('du terrain', 617, y), run('Nature des travaux', 727, y), run('de', 1026, y),
  run('demandeur', 336, y - 7), run('Références cadastrales', 454, y - 7), run('Plancher créée', 897, y - 7), run('niveaux', 1084, y - 7),
  run('en m²', 630, y - 14), run('logement', 1005, y - 14),
];

test('a Saint-Laurent-du-Var list reads each dossier under its own header: street, parcels, works, areas, an organisation only', () => {
  const rows = readSaintLaurentList(page(
    run('Dossiers déposés avant le 1er octobre 2026', 434, 705), run('PERMIS DE CONSTRUIRE', 508, 656),
    ...SAINT_LAURENT_HEADER(554),
    run('30/09/2026', 34, 523), run('PC 006123 26 C0041', 132, 523), run('SAS EXEMPLE PROMOTION', 309, 523),
    run('613 Avenue de la', 443, 523), run('2 195,00', 614, 523), run('- Démolition totale', 692, 523),
    run('6 263,00 m²', 890, 523), run('89', 1003, 523), run('6', 1074, 523),
    run('représentée par', 309, 507), run('Libération', 443, 507), run('- Réalisation de logements', 692, 507),
    run('Monsieur PRIVATE PERSON', 309, 490), run('06700 Saint-Laurent-', 443, 490),
    run('1 rue Privée', 309, 474), run('du-Var', 443, 474),
    run('06200 NICE', 309, 457), run('AW320, AW26,', 443, 457), run('AW33', 443, 441),
    ...SAINT_LAURENT_HEADER(250),
    run('23/09/2026', 34, 220), run('PC 006123 25 C0052', 132, 220), run('Madame PRIVATE PERSON', 309, 220),
    run('20 Avenue Jeanne', 443, 220), run('13', 614, 220), run('Transfert total', 692, 220), run('m²', 894, 220),
    run('T01', 132, 204), run('d\'Arc', 443, 204), run('650,00', 614, 204),
    run('06700 Saint Laurent du', 443, 188), run('Var', 443, 171), run('AS448', 443, 155),
    run('Page 1 sur 11', 1082, 37), run('Document publié le 01/10/2026', 533, 15),
  ), { city: town('digilor-saint-laurent-du-var'), file: { board: 'filings' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.parcels, row.filedOn, row.landArea, row.floorArea, row.housing, row.applicant]), [
    ['PC 006123 26 C0041', '613 Avenue de la Libération', 'AW 320, AW 26, AW 33', '2026-09-30', '2195', '6263', '89', 'SAS EXEMPLE PROMOTION'],
    ['PC 006123 25 C0052 T01', '20 Avenue Jeanne d\'Arc', 'AS 448', '2026-09-23', '13650', null, null, null],
  ]);
  assert.equal(rows[0].purpose, 'Démolition totale ; Réalisation de logements');
  assert.doesNotMatch(JSON.stringify(rows.map((row) => scrubPermitListRow(row))), PRIVATE);
});

test('a Saint-Laurent-du-Var dossier with neither a numbered street nor a parcel gives nothing', () => {
  const rows = readSaintLaurentList(page(...SAINT_LAURENT_HEADER(554),
    run('28/04/2026', 34, 458), run('PC 006123 26 C0018', 132, 458), run('EPIC EXEMPLE', 309, 458),
    run(', Rond point Exemple', 443, 458), run('06700 Saint-Laurent-', 443, 442), run('du-Var', 443, 426),
  ), { city: town('digilor-saint-laurent-du-var'), file: { board: 'filings' } });
  assert.deepEqual(rows, []);
});

test('Illkirch-Graffenstaden’s two sub-categories decide the board, whatever the title’s typing', () => {
  assert.deepEqual(picked('digilor-illkirch-graffenstaden', [
    doc(291, 1, 2755, 3605, '2026-08-17 AFFICHAGE DEPOTSAUTORISATION URBANSIME'),
    doc(291, 2, 2755, 3606, '2026-09-28 AFFICHAGE DECISIONS AUTORISATION URBANISME'),
    doc(291, 3, 2610, 3302, 'Arrêté de circulation'),
  ]), [['1.pdf', 'filings', 'digilor-illkirch-list'], ['2.pdf', 'decisions', 'digilor-illkirch-list']]);
});

test('Illkirch-Graffenstaden’s filings: cells centred on the number’s line, the applicant’s own address never read', () => {
  const rows = readIllkirchList(page(
    run('AFFICHAGE des DEPÔTS au 28/09/2026', 371, 520),
    run('NATURE ET', 519, 470), run('SURFACE', 675, 470),
    run('DATE', 34, 465), run('NOMBRE', 625, 465), run('Date de début', 735, 465), run('Date de fin', 817, 465),
    run('N° Dossier', 98, 459), run('DEMANDEUR(S)', 214, 459), run('ADRESSE DU TERRAIN', 349, 459), run('DESTINATION', 515, 459), run('DE', 690, 459),
    run('DE DEPOT', 23, 453), run('LOGTS', 630, 453), run('d\'affichage', 742, 453), run('d\'affichage', 817, 453),
    run('DES TRAVAUX', 514, 448), run('PLANCHERS', 669, 448),
    run('EXEMPLE TOITURE SARL représenté par', 168, 418), run('5 Route du Neuhof', 334, 412), run('PRIVATE PERSON', 168, 406),
    run('28/09/2026', 24, 401), run('DP 67218 26 V0267', 75, 401), run('67400 ILLKIRCH-', 334, 401), run('la rénovation de toiture', 468, 401),
    run('0', 643, 401), run('m²', 693, 401), run('28/09/2026', 741, 401), run('30/11/2026', 817, 401),
    run('2 Rue Privée', 168, 395), run('GRAFFENSTADEN', 334, 389), run('67270 WILWISHEIM', 168, 384),
    run('PRIVATE PERSON', 168, 342), run('6 Rue Exemple', 334, 342),
    run('27/09/2026', 24, 331), run('DP 67218 26 V0265', 75, 331), run('67400 ILLKIRCH-', 334, 331), run('la pose d’un poêle', 468, 331),
    run('28/09/2026', 741, 331), run('6 Rue Privée', 168, 325), run('GRAFFENSTADEN', 334, 320),
  ), { city: town('digilor-illkirch-graffenstaden'), file: { board: 'filings', published: '2026-09-28' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.postedOn, row.purpose, row.applicant]), [
    ['DP 067218 26 V0267', '5 Route du Neuhof', '2026-09-28', '2026-09-28', 'la rénovation de toiture', 'EXEMPLE TOITURE SARL'],
    ['DP 067218 26 V0265', '6 Rue Exemple', '2026-09-27', '2026-09-28', 'la pose d’un poêle', null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => scrubPermitListRow(row))), PRIVATE);
});

const ILLKIRCH_DECISIONS_HEADER = [
  run('DATE', 166, 511), run('NATURE ET DESTINATION', 571, 511), run('DEBUT', 747, 511), run('FIN', 825, 511),
  run('N° Dossier', 62, 506), run('BENEFICIAIRE', 253, 506), run('ADRESSE DU TERRAIN', 395, 506),
  run('D\'ARRETE', 155, 500), run('DES TRAVAUX', 598, 500), run('D\'AFFICHAGE', 732, 500), run('D\'AFFICHAGE', 802, 500),
];

test('Illkirch-Graffenstaden’s decisions read the day over the verdict; a dossier sent back undecided is left out', () => {
  const rows = readIllkirchList(page(...ILLKIRCH_DECISIONS_HEADER,
    run('Madame PRIVATE PERSON', 210, 487), run('29/07/2026', 155, 476), run('38 A Avenue Exemple', 362, 470),
    run('DP 67218 23 V0125', 23, 464), run('retrait de', 161, 464), run('1 rue Privée', 210, 464), run('la pose d’un store', 531, 464),
    run('03/08/2026', 739, 464), run('05/10/2026', 810, 464),
    run('67400 ILLKIRCH-GRAFFENSTADEN', 362, 459), run('l\'arrêté', 164, 453),
    run('29/07/2026', 155, 353), run('182 route de Exemple', 362, 353), run('SCI EXEMPLE', 210, 353),
    run('DP 67218 26 V0207', 23, 348), run('le ravalement de façade', 531, 348), run('03/08/2026', 739, 348),
    run('favorable', 160, 342), run('67400 ILLKIRCH-GRAFFENSTADEN', 362, 342),
    run('29/07/2026', 155, 257), run('19 rue Exemple', 362, 251),
    run('DP 67218 26 V0162', 23, 246), run('retour dossier', 151, 246), run('une piscine', 531, 246),
    run('67400 ILLKIRCH-GRAFFENSTADEN', 362, 240), run('sans décision', 150, 235),
  ), { city: town('digilor-illkirch-graffenstaden'), file: { board: 'decisions', published: '2026-09-28' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.verdict, row.decidedOn, row.postedOn, row.applicant]), [
    ['DP 067218 23 V0125', '38 A Avenue Exemple', 'Retrait', '2026-07-29', '2026-08-03', null],
    ['DP 067218 26 V0207', '182 route de Exemple', 'Accord', '2026-07-29', '2026-08-03', 'SCI EXEMPLE'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => scrubPermitListRow(row))), PRIVATE);
});

test('Concarneau’s two sub-categories give its registers, the inquiries and antenna notices beside them left out', () => {
  assert.deepEqual(picked('digilor-concarneau', [
    doc(208, 1, 4464, 7088, '2026-10-02-AFF-Autorisations Urba-déposées'),
    doc(208, 2, 4464, 7089, '2026-10-02-AFF-Autorisations Urba-décidées'),
    doc(208, 3, 4464, 7092, 'URBA_PA290392600002_BelleEtoile_MaD_ARRT_VD'),
    doc(208, 4, 4464, 7093, 'URBA_InstallationAntenneRelais_2026.07.20'),
  ]), [['1.pdf', 'filings', 'digilor-concarneau-register'], ['2.pdf', 'decisions', 'digilor-concarneau-register']]);
});

test('a Concarneau register reads labelled cells centred on their row, the rows above a page’s first header kept', () => {
  const city = town('digilor-concarneau');
  const rows = readConcarneauRegister({ pages: [
    { runs: [
      run('REGISTRE DES AUTORISATIONS D\'URBANISME DECIDEES', 125, 748), run('Liste des DP : Déclaration Préalable de Construction de Concarneau', 71, 655),
      run('Dossier', 72, 628), run('Terrain', 185, 628), run('Description', 298, 628), run('Décision', 412, 628),
      run('Terrain : BB0148 BB0149', 185, 592), run('Projet : Réalisation d\'un carport', 298, 590), run('Signée le : 25/09/2026', 412, 592),
      run('DP 29039 26 00220', 72, 584), run('sis 6 Hameau de Exemple', 185, 584), run('Notifié le : 03/10/2026', 412, 584),
      run('Dépôt le 23/04/2026', 72, 576), run('Surface : 2713m²', 185, 576), run('Nature de la décision : Accord avec', 412, 576),
      run('par PRIVATE PERSON', 72, 568), run('Propriétaire : Monsieur PRIVATE PERSON', 185, 568), run('prescription', 412, 568),
    ] },
    { runs: [
      run('Terrain : BS0001', 185, 770), run('Projet : Reprise du mur', 298, 762),
      run('DP 29039 26 00384', 72, 762), run('sis 12 Quai Exemple', 185, 762), run('Signée le : 29/09/2026', 412, 762),
      run('Dépôt le 06/08/2026', 72, 754), run('Surface : 0m²', 185, 754), run('Nature de la décision : Favorable', 412, 754),
      run('par VILLE DE CONCARNEAU', 72, 746),
      run('Liste des PC : Permis de Construire de Concarneau', 71, 606),
      run('Dossier', 72, 579), run('Terrain', 185, 579), run('Description', 298, 579), run('Décision', 412, 579),
      run('PC 29039 26 00056', 72, 544),
      run('Terrain : BN0299', 185, 540), run('Projet : Création de 24 logements', 298, 540), run('Signée le : 25/09/2026', 412, 540),
      run('Dépôt le 31/03/2026', 72, 536),
      run('sis 3 Rue Exemple', 185, 532), run('Nb logements créés : 24', 298, 532), run('Nature de la décision : Défavorable', 412, 532),
      run('par SNC EXEMPLE', 72, 528),
    ] },
  ] }, { city, file: { board: 'decisions', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.parcels, row.filedOn, row.decidedOn, row.verdict, row.applicant]), [
    ['DP 029039 26 00220', '6 Hameau de Exemple', 'BB 148, BB 149', '2026-04-23', '2026-09-25', 'Accord avec prescription', null],
    ['DP 029039 26 00384', '12 Quai Exemple', 'BS 1', '2026-08-06', '2026-09-29', 'Accord', 'VILLE DE CONCARNEAU'],
    ['PC 029039 26 00056', '3 Rue Exemple', 'BN 299', '2026-03-31', '2026-09-25', 'Refus', 'SNC EXEMPLE'],
  ]);
  assert.deepEqual(rows.map((row) => [row.purpose, row.landArea, row.housing]), [
    ['Réalisation d\'un carport', '2713', null], ['Reprise du mur', '0', null], ['Création de 24 logements', null, '24'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => scrubPermitListRow(row))), PRIVATE);
});

test('Yutz’s family shelves give the printed avis to extended-notice and the scanned orders to the OCR reader', () => {
  const city = town('digilor-yutz');
  assert.equal(city.source.ocr, true);
  assert.deepEqual(picked('digilor-yutz', [
    doc(402, 1, 3801, 5897, 'DP 57 757 2600234'), doc(402, 2, 3801, 5824, 'PC 57 757 2600023'),
    doc(402, 3, 3801, 5900, 'DP 57 757 2600212 PRIVATE PERSON'), doc(402, 4, 3801, 5899, 'PC 57 757 2600014 REFUS PRIVATE PERSON'),
    doc(402, 5, 3801, 5938, 'CU 57 757 2600161'), doc(402, 6, 3801, 6166, 'ES 057 757 26 E0012'),
  ]), [
    ['1.pdf', 'filings', 'extended-notice'], ['2.pdf', 'filings', 'extended-notice'],
    ['3.pdf', 'decisions', 'digilor-yutz-order'], ['4.pdf', 'decisions', 'digilor-yutz-order'],
  ]);
});

test('a Yutz order read by OCR: the form’s rules dropped, the verdict read off its only article, no applicant', () => {
  const ocrPage = (...lines) => ({ pages: [{ width: 595, height: 842, runs: lines.flatMap(([y, words]) => {
    let x = 40;
    return words.split(' ').map((text) => { const item = run(text, x, y, 10); x = item.x1 + 4; return item; });
  }) }] });
  const city = town('digilor-yutz');
  const order = (operative) => readStateFormOrder(ocrPage(
    [766, 'COMMUNE DE DECLARATION PREALABLE'], [708, 'Demande déposée le 03/09/2026 N° DP 57 757 26 00212 |'],
    [683, 'Par :| PRIVATE PERSON'], [651, 'Demeurant à : | 1 rue Privée'], [617, 'Pour : | Installation d\'une pompe à chaleur'],
    [598, 'Sur un terrain sis à : | 144 rue Exemple'], [587, '57970 YUTZ'], [420, 'ARRETE'], [397, operative],
  ), { city, file: { board: 'decisions', title: 'DP 57 757 2600212 PRIVATE PERSON', published: '2026-09-24' } });
  const [row] = order('Article 1 : Les travaux sont autorisés pour le projet décrit dans la demande susvisée.');
  assert.deepEqual([row.dossier, row.address, row.filedOn, row.postedOn, row.verdict], ['DP 057757 26 00212', '144 rue Exemple', '2026-09-03', '2026-09-24', 'Accord']);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), PRIVATE);
  assert.equal(order('Article 1 : La présente décision est notifiée.')[0].verdict, 'Décision signée');
});

test('Verrières-le-Buisson’s family shelves give the avis to the filing reader and the orders to the order reader', () => {
  assert.equal(town('digilor-verrieres-le-buisson').source.ocr, true);
  assert.deepEqual(picked('digilor-verrieres-le-buisson', [
    doc(193, 1, 1771, 1979, 'AVIS DE DEPOT DP2610151'), doc(193, 2, 1771, 1977, 'AVIS DE DEPOT PC 2610036'),
    doc(193, 3, 1771, 1980, 'ARRETE DP2610132'), doc(193, 4, 1771, 1978, 'RETRAIT PC2410033'),
    doc(193, 5, 1771, 1981, 'AVIS DE DEPOT CUB 2610144'), doc(193, 6, 1771, 1988, 'ARRETE AT2610005'),
  ]), [
    ['1.pdf', 'filings', 'digilor-verrieres-filing'], ['2.pdf', 'filings', 'digilor-verrieres-filing'],
    ['3.pdf', 'decisions', 'digilor-verrieres-order'], ['4.pdf', 'decisions', 'digilor-verrieres-order'],
  ]);
});

test('a Verrières-le-Buisson avis reads its labelled values, the applicant’s own address never; a scanned one falls back on its title', () => {
  const city = town('digilor-verrieres-le-buisson');
  const avis = (number, ...more) => readVerrieresFiling(page(
    run('AVIS DE DÉPÔT', 242, 682), run('Numéro Dossier', 57, 571), run(number, 163, 571),
    run('Date de dépôt', 57, 551), run('25/09/2026', 163, 551),
    run('Demandeur', 57, 531), run('Monsieur PRIVATE PERSON', 160, 531), run('1 rue Privée', 160, 511), run('91370 Verrières-le-Buisson', 160, 491),
    run('Terrain', 57, 472), run('11 rue Exemple, 91370 VERRIÈRES-LE-BUISSON', 160, 472),
    run('Superficie', 57, 452), run('241,00 m²', 160, 452),
    run('Travaux', 57, 432), run('Changement fenêtres et porte', 160, 432), ...more,
    run('Fait à VERRIÈRES-LE-', 383, 341), run('BUISSON', 383, 327), run('Le 28 septembre 2026', 383, 311),
  ), { city, file: { board: 'filings', title: 'AVIS DE DEPOT DP2610151', published: '2026-09-28' } });
  assert.deepEqual(avis('DP 91645 26 10151').map((row) => [row.dossier, row.address, row.filedOn, row.landArea, row.purpose, row.applicant]), [
    ['DP 091645 26 10151', '11 rue Exemple', '2026-09-25', '241', 'Changement fenêtres et porte', null],
  ]);
  assert.equal(avis('DP 91645 26 10\'t 51')[0].dossier, 'DP 091645 26 10151');
  assert.doesNotMatch(JSON.stringify(avis('DP 91645 26 10151').map((row) => scrubPermitListRow(row))), PRIVATE);
});

test('a Verrières-le-Buisson order: the title’s number, the right column’s site and parcels, the verdict of its article or title', () => {
  const city = town('digilor-verrieres-le-buisson');
  const header = [
    run('No', 127, 617), run('DP', 142, 617), run('9t6452610132', 159, 617),
    run('POUR:', 61, 562), run('Madame', 102, 562), run('PRIVATE', 146, 562), run('PERSON', 186, 562),
    run('ADRESSE', 299, 562), run('DES', 352, 562), run('TRAVAUX', 376, 562), run(':', 434, 562),
    run('l8bis', 441, 562), run('rue', 470, 562), run('Exemple', 490, 562),
    run('9', 299, 549), run('I37', 306, 549), run('O', 321, 549), run('VERRIÈRE', 329, 549),
    run('ADRESSE', 61, 537), run(':', 115, 537), run('1', 121, 537), run('rue', 135, 537), run('Privée', 153, 537),
    run('PARCELLE(S)', 299, 524), run('CADASTRÉE(S)', 375, 524), run(':', 459, 524), run('AP333', 465, 524),
  ];
  const order = (title, operative) => readVerrieresOrder(page(...header, run(operative, 62, 149)),
    { city, file: { board: 'decisions', title, published: '2026-09-30' } });
  assert.deepEqual(order('ARRETE DP2610132', 'ARTICLE I .\'La présente déclaration préalable fait l\'objet d\'une décision de NON-OPPOSITION')
    .map((row) => [row.dossier, row.address, row.parcels, row.verdict, row.applicant]),
  [['DP 091645 26 10132', '18bis rue Exemple', 'AP 333', 'Non-opposition', null]]);
  assert.equal(order('RETRAIT DP2610132', 'ARTICLE 1 : l\'arrêté est retiré')[0].verdict, 'Retrait');
  assert.equal(order('ARRETE DP1910053M02', 'ARTICLE 1 : …')[0].dossier, 'DP 091645 19 10053 M02');
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(order('ARRETE DP2610132', '')[0])), PRIVATE);
  // A rejection letter names the applicant's address, never the site.
  assert.deepEqual(readVerrieresOrder(page(run('DOSSIER : 916452610084', 62, 538), run('131 rue Privée', 309, 654),
    run('vois dans l\'obligation de rejeter votre dossier.', 62, 394)), { city, file: { board: 'decisions', title: 'REJET DP2610084' } }), []);
});

test('Harnes’s two sub-categories give the avis and the orders, the road orders beside them left out', () => {
  assert.deepEqual(picked('digilor-harnes', [
    doc(202, 1, 1683, 5279, '22 rue André Desprez'), doc(202, 2, 1683, 2078, '73 avenue des Saules'),
    doc(202, 3, 1683, 1919, 'Interdiction temporaire de circulation'), doc(202, 4, 1683, 0, 'Approbation SCOT - LLHC'),
  ]), [['1.pdf', 'filings', 'digilor-harnes-filing'], ['2.pdf', 'decisions', 'digilor-harnes-order']]);
});

test('a Harnes avis reads each label’s value and the works centred on theirs, never the applicant', () => {
  const rows = readHarnesFiling(page(
    run('AVIS DE DÉPÔT', 190, 594), run('PC 062413 26 00053', 26, 536),
    run('Déposé le', 26, 511), run('01/10/2026', 253, 511),
    run('Par', 26, 485), run('PRIVATE PERSON', 253, 485),
    run('Le projet consiste en :_- La réhabilitation', 253, 460), run('Pour un projet de', 26, 446), run('d\'une maison existante', 253, 446),
    run('Sis à l’adresse', 26, 313), run('22 rue Exemple 62440 Harnes', 253, 313),
    run('Parcelle cadastrale', 26, 287), run('AB 0229', 253, 287),
    run('Superficie du terrain', 26, 262), run('1262.00 m²', 253, 262),
    run('Surface de plancher créée', 26, 236), run('431.00 m²', 253, 236),
    run('Nombre de logements', 26, 185), run('1', 253, 185), run('Affiché le', 26, 160), run('01/10/2026', 253, 160),
  ), { city: town('digilor-harnes'), file: { board: 'filings', title: '22 rue Exemple', published: '2026-10-01' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.parcels, row.filedOn, row.landArea, row.floorArea, row.housing, row.applicant]), [
    ['PC 062413 26 00053', '22 rue Exemple', 'AB 229', '2026-10-01', '1262', '431', '1', null],
  ]);
  assert.equal(rows[0].purpose, 'Le projet consiste en : La réhabilitation d\'une maison existante');
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(rows[0])), PRIVATE);
});

test('a Harnes order whose labels print no value takes its number off the page and its site off the title', () => {
  const rows = readHarnesOrder(page(
    run('DECISION DE NON OPPOSITION A UNE', 262, 765), run('DECLARATION PREALABLE', 306, 749),
    run('Demande déposée le 17/09/2026', 29, 669), run('DP 062413 26 00121', 420, 663),
    run('Par :', 30, 625), run('Demeurant :', 30, 609), run('Sis à :', 30, 531),
    run('ARTICLE UNIQUE :', 28, 285), run('n’est pas fait opposition', 37, 258),
  ), { city: town('digilor-harnes'), file: { board: 'decisions', title: '68 bis rue Exemple ', published: '2026-10-01' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.verdict]),
    [['DP 062413 26 00121', '68 bis rue Exemple', '2026-09-17', 'Non-opposition']]);
});

test('Hénin-Beaumont’s shelf gives the weekly table as filings and the numbered orders as decisions, the alignment orders left out', () => {
  assert.equal(town('digilor-henin-beaumont').source.ocr, true);
  assert.deepEqual(picked('digilor-henin-beaumont', [
    doc(337, 1, 2929, 3961, 'TABLEAU AFFICHAGE DU 02 10 26 AU 09 10 2026'), doc(337, 2, 2929, 3961, 'ARRETE DP 26 317'),
    doc(337, 3, 2929, 3961, 'DP 2026-335'), doc(337, 4, 2929, 3961, 'AM_DP_2026_286'), doc(337, 5, 2929, 3961, 'PC 2025-12M1'),
    doc(337, 6, 2929, 3961, 'ARRETE ALIGNEMENT RUE EMILIENNE MOREAU'), doc(337, 7, 2929, 3962, 'DECLARATION DE DESTRUCTION PAR PIEGEAGE'),
  ]), [
    ['1.pdf', 'filings', 'digilor-henin-beaumont-table'], ['2.pdf', 'decisions', 'digilor-henin-beaumont-order'],
    ['3.pdf', 'decisions', 'digilor-henin-beaumont-order'], ['4.pdf', 'decisions', 'digilor-henin-beaumont-order'],
    ['5.pdf', 'decisions', 'digilor-henin-beaumont-order'],
  ]);
});

test('Hénin-Beaumont’s table: the day glued to the street split, a description climbing to the row before, ERP works and people left out', () => {
  const rows = readHeninTable(page(
    run('Dossier', 101, 776), run('demandeur', 283, 776), run('Date dépôt', 440, 776), run('adresse', 599, 776), run('Description du projet', 869, 776),
    run('AT 62427 26 00021', 53, 761), run('SARL EXEMPLE', 191, 761), run('09/07/2026122 RUE EXEMPLE', 443, 761), run('AMENAGEMENT INTERIEUR', 738, 761),
    run('DP 62427 26 00267', 53, 746), run('PRIVATE PERSON', 191, 746), run('20/07/202698 Rue Exemple', 443, 746), run('REMPLACEMENT D\'UNE FENETRE', 738, 746),
    run('REGULARISATION', 738, 731), run('TOITURE', 738, 716),
    run('DP 62427 26 00268', 53, 701), run('PRIVATE PERSON', 189, 701), run('17/07/2026', 443, 701), run('70 RUE DE L\'EXEMPLE', 520, 701), run('FACADE', 738, 701),
  ), { city: town('digilor-henin-beaumont'), file: { board: 'filings', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.purpose, row.applicant]), [
    ['DP 062427 26 00267', '98 Rue Exemple', '2026-07-20', 'REMPLACEMENT D\'UNE FENETRE', null],
    ['DP 062427 26 00268', '70 RUE DE L\'EXEMPLE', '2026-07-17', 'REGULARISATION TOITURE FACADE', null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => scrubPermitListRow(row))), PRIVATE);
});
