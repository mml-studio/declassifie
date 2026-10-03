import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIGILOR_C_BOARD_READERS, readDombasleAct, readErgueList, readPontDeClaixDecisions, readScannedNotice, readTitleAct } from './permitBoardsDigilorC.js';
import { DIGILOR_TOWNS } from './digilorTowns.js';
import { DIGILOR_TOWNS_C } from './digilorTownsC.js';
import { BOARD_READERS } from './permitBoards.js';
import { PERMIT_LIST_READERS, digilorDocuments, normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const town = (key) => DIGILOR_TOWNS.find((item) => item.key === key);
const run = (text, x, y, size = 8) => ({ text, x, x1: x + text.length * 4, y, size });
const page = (...runs) => ({ pages: [{ runs }] });
const PRIVATE = /PRIVATE|PERSON|Privée/;
const doc = (id, cat, sub, title, day = '2026-09-25') => ({ id, id_cat: cat, id_sscat: sub, nom_affichage: title, aff_deb: day, url_uiid: `./upload/x/${id}.pdf` });
const picked = (key, docs) => digilorDocuments(town(key), docs, '2026-08-01')
  .map((file) => [file.url.replace(/^.*%2F/, ''), file.board, file.layout]).sort();

test('every batch C town is a Digilor town of the permit registry, its layouts known to a reader', () => {
  assert.ok(DIGILOR_TOWNS_C.length > 0);
  for (const { key } of DIGILOR_TOWNS_C) {
    assert.equal(permitListFor(town(key).insee), town(key), key);
    assert.equal(town(key).source.kind, 'digilor');
    assert.match(town(key).page, new RegExp(`/documents/${town(key).source.app}$`));
    for (const shelf of town(key).source.shelves) {
      assert.ok(BOARD_READERS[shelf.layout] ?? PERMIT_LIST_READERS[shelf.layout], `${key} ${shelf.layout}`);
    }
  }
  for (const [layout, reader] of Object.entries(DIGILOR_C_BOARD_READERS)) {
    assert.match(layout, /^digilor-[a-z-]+-[a-z]+$/);
    assert.equal(BOARD_READERS[layout], reader);
  }
});

test('Saint-Estève’s weekly registers are read by `register`, the scans and other notices beside them left out', () => {
  assert.deepEqual(picked('digilor-saint-esteve', [
    doc(1, 104, 8459, 'AFFICHAGE REGISTRE URBANISME SEMAINE 40'), doc(2, 104, 0, 'REGISTRE AFFICHAGE 21 08 2026'),
    doc(3, 104, 165, 'ARRETE PREF INSALUBRITE 2 RUE EXEMPLE'), doc(4, 103, 4771, 'AR2026_071 Arrêté'),
  ]), [['1.pdf', 'filings', 'register']]);
});

test('Dombasle’s shelves give avis and orders by title, whichever shelf they were filed on', () => {
  assert.deepEqual(picked('digilor-dombasle-sur-meurthe', [
    doc(1, 19, 53, 'DP 054 159 26 D 0192 - Avis de dépôt'), doc(2, 19, 51, 'DP 054 159 26 D0177 arrete_signed'),
    doc(3, 19, 51, 'DP 054 159 26 D 0175_AVIS_DEPOT'), doc(4, 19, 52, 'PC 054 159 26 D 0004 - Arrêté de décision'),
    doc(5, 19, 55, 'CU 054 159 26 D0180 arrete_signed'), doc(6, 19, 0, 'AFFICHAGE_RGA'),
    doc(7, 19, 51, 'ClassementsanssuiteDP05415926D0093_signed'),
  ]), [
    ['1.pdf', 'filings', 'digilor-dombasle-act'], ['2.pdf', 'decisions', 'digilor-dombasle-act'],
    ['3.pdf', 'filings', 'digilor-dombasle-act'], ['4.pdf', 'decisions', 'digilor-dombasle-act'],
  ]);
});

const DOMBASLE_ORDER = (verdict) => page(
  run('Réference de l\'AR : 054-215401597-20261001-DP26D0162-AI', 42, 812),
  run('REPUBLIQUE FRANCAISE', 111, 776), run('Dossier n° DP 054 159 26 D 0162', 342, 776),
  run('Département de la Meurthe et Moselle', 86, 744), run('Date de dépôt : 05 août 2026', 317, 744),
  run('Demandeur : Monsieur PRIVATE PERSON', 317, 702), run('Pour : La pose d’une pergola', 317, 685),
  run('Adresse terrain : 24 rue Exemple à', 317, 668), run('DOMBASLE-SUR-MEURTHE 54110', 317, 655),
  run('Référence(s) cadastrale(s) : AK 12 et AK 13', 317, 638),
  run('ARRÊTÉ', 275, 582), run('d’opposition à une déclaration préalable', 192, 569),
  run('Vu la déclaration préalable présentée par Monsieur PRIVATE PERSON, demeurant 1 rue Privée', 71, 487),
  run('Article 1', 280, 124), run(verdict, 72, 101),
  run('Fait à Dombasle-sur-Meurthe, le', 223, 80),
);

test('a Dombasle order gives its number, site, parcels, works and the first article’s verdict, dated by its transmission reference', () => {
  const city = town('digilor-dombasle-sur-meurthe');
  const [row, ...rest] = readDombasleAct(DOMBASLE_ORDER('Il est fait opposition à la déclaration préalable.'), { city, file: { board: 'decisions', published: '2026-10-02' } });
  assert.equal(rest.length, 0);
  assert.deepEqual([row.dossier, row.address, row.postcode, row.parcels, row.purpose, row.filedOn, row.decidedOn, row.postedOn],
    ['DP 054159 26 D0162', '24 rue Exemple', '54110', 'AK 12, AK 13', 'La pose d’une pergola', '2026-08-05', '2026-10-01', '2026-10-02']);
  assert.equal(row.verdict, 'Refus');
  const [granted] = readDombasleAct(DOMBASLE_ORDER('Il n’est pas fait opposition à la déclaration préalable.'), { city, file: { board: 'decisions' } });
  assert.equal(granted.verdict, 'Non-opposition');
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), PRIVATE);
  assert.equal(normalisePermitListRow(city, 'decisions', scrubPermitListRow(row)).address, '24 rue Exemple');
});

test('a Dombasle avis de dépôt is read by its labels, the number’s letter glued back to its counter', () => {
  const rows = readDombasleAct(page(
    run('AVIS DE DÉPÔT D\'UNE DEMANDE', 190, 690), run('N° de dossier :', 85, 604), run('DP 054 159 26 D 0192', 262, 604),
    run('Date de dépôt :', 85, 533), run('30/09/2026', 262, 533), run('Nom du demandeur :', 85, 478), run('Monsieur PRIVATE PERSON', 262, 478),
    run('Adresse du terrain :', 85, 404), run('2 rue Exemple', 262, 404), run('54110 DOMBASLE-SUR-MEURTHE', 262, 385),
  ), { city: town('digilor-dombasle-sur-meurthe'), file: { board: 'filings', title: 'DP 054 159 26 D 0192 - Avis de dépôt', published: '2026-10-01' } });
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.filedOn]), [['filings', 'DP 054159 26 D0192', '2 rue Exemple', '2026-09-30']]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
});

test('a Dombasle order of another commune or with no site gives nothing', () => {
  const city = town('digilor-dombasle-sur-meurthe');
  assert.deepEqual(readDombasleAct(page(run('Dossier n° DP 054 395 26 D 0162', 342, 776), run('Adresse terrain : 24 rue Exemple', 317, 668), run('ARRÊTÉ', 275, 582)),
    { city, file: { board: 'decisions' } }), []);
  assert.deepEqual(readDombasleAct(page(run('Dossier n° DP 054 159 26 D 0162', 342, 776), run('ARRÊTÉ', 275, 582)), { city, file: { board: 'decisions' } }), []);
  assert.deepEqual(readDombasleAct({ pages: [] }, { city, file: { board: 'decisions' } }), []);
});

test('the shelves of Amnéville, Ergué-Gabéric, Le Pont-de-Claix and Champagne give their lists and orders, nothing else', () => {
  assert.deepEqual(picked('digilor-amneville', [
    doc(1, 1688, 2029, 'AVIS DE DEPOT DP PRIVATE'), doc(2, 1688, 2030, 'ARRETE DE PC PRIVATE'), doc(3, 1688, 2031, 'ARRETE DE DP PRIVATE'),
    doc(4, 1686, 2028, 'ARRETE DU MAIRE N°271-2026'),
  ]), [['1.pdf', 'filings', 'digilor-amneville-notice'], ['2.pdf', 'decisions', 'digilor-amneville-notice'], ['3.pdf', 'decisions', 'digilor-amneville-notice']]);
  assert.deepEqual(picked('digilor-ergue-gaberic', [
    doc(1, 764, 0, 'Affichage des AOS 280926_051026'), doc(2, 764, 0, 'ADS 14-09-26'), doc(3, 764, 1128, 'PC 26_49 DECISION'),
    doc(4, 764, 1131, 'DP 26-75 PRIVATE'), doc(5, 764, 0, 'Avis enquête publique'),
  ]), [['1.pdf', 'filings', 'digilor-ergue-list'], ['2.pdf', 'filings', 'digilor-ergue-list'],
    ['3.pdf', 'decisions', 'digilor-amneville-notice'], ['4.pdf', 'decisions', 'digilor-amneville-notice']]);
  assert.deepEqual(picked('digilor-le-pont-de-claix', [
    doc(1, 191, 269, 'Dépôts des dossiers d\'autorisations d\'urbanisme'), doc(2, 191, 269, 'Décisions des Autorisations d\'urbanisme'),
    doc(3, 191, 420, 'Mise à jour n°9 PLUi'),
  ]), [['1.pdf', 'filings', 'arles-filings'], ['2.pdf', 'decisions', 'digilor-pontdeclaix-decisions']]);
  assert.deepEqual(picked('digilor-champagne-au-mont-d-or', [
    doc(1, 1975, 0, 'Depot de dossier'), doc(2, 1975, 2294, ' DP 26-62 (PRIVATE)'), doc(3, 1975, 2293, 'PC 24-03 M03 (SARL EXEMPLE)'),
    doc(4, 1975, 0, 'Réunion publique'),
  ]), [['1.pdf', 'filings', 'cartds-report-filings'], ['2.pdf', 'decisions', 'digilor-amneville-notice'], ['3.pdf', 'decisions', 'digilor-amneville-notice']]);
});

test('Ergué-Gabéric’s weekly list: a row per dossier hanging from its number, the families’ titles and other forms left out', () => {
  const rows = readErgueList(page(
    run('COMMUNE D\'ERGUE-GABERIC', 28, 557), run('Dossiers déposés au 28 septembre 2026', 315, 519),
    run('Date dépôt', 28, 493), run('Numéro de dossier', 101, 493), run('Pétitionnaire', 235, 493),
    run('Adresse du projet', 416, 493), run('Description du projet', 582, 493),
    run('AUTORISATION PREALABLE DE NOUVELLE INSTALLATION', 28, 461),
    run('17/09/2026', 28, 415), run('AP 029051 26 0011', 101, 415), run('81 Avenue Exemple', 416, 415),
    run('DECLARATION PREALABLE', 28, 230),
    run('17/09/2026', 28, 191), run('DP 029051 26 00083', 101, 191), run('Monsieur PRIVATE PERSON', 235, 191),
    run('2 Rue Exemple', 416, 191), run('Aménagement des combles.', 582, 191),
    run('29500 ERGUE-GABERIC', 416, 179), run('Création de fenêtres de toit.', 582, 179),
    run('25/06/2026', 28, 147), run('PC 029051 23 00037', 101, 147), run('PRIVATE PERSON', 238, 147), run('2 Rue Autre', 416, 147),
    run('M01', 101, 134), run('SCI EXEMPLE', 235, 134), run('29500 ERGUE-GABERIC', 416, 134),
    run('Page 1 sur 4', 739, 38),
  ), { city: town('digilor-ergue-gaberic'), file: { board: 'filings', published: '2026-09-28' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.filedOn, row.purpose, row.applicant]), [
    ['DP 029051 26 00083', '2 Rue Exemple', '29500', '2026-09-17', 'Aménagement des combles. Création de fenêtres de toit.', null],
    ['PC 029051 23 00037 M01', '2 Rue Autre', '29500', '2026-06-25', null, 'SCI EXEMPLE'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
});

test('Le Pont-de-Claix’s decisions list: the number centred on its row, the verdict and signing day beside it', () => {
  const rows = readPontDeClaixDecisions(page(
    run('COMMUNE DE LE PONT DE CLAIX', 295, 521), run('Dossiers décidés jusqu’au 30 septembre 2026', 329, 477),
    run('Date de', 349, 450), run('Numéro de dossier', 32, 444), run('Pétitionnaire', 163, 444), run('Décision', 270, 444),
    run('Nature des travaux', 452, 444), run('Adresse des travaux', 620, 444), run('Surface', 768, 444), run('signature', 346, 438),
    run('Déclaration préalable - Constructions et travaux non soumis à permis de construire', 28, 410),
    run('Installation de panneaux', 430, 222),
    run('DP 38317 24 10040', 29, 218, 10), run('Madame PRIVATE PERSON', 140, 212), run('Octroi tacite', 262, 212),
    run('25/09/2026', 341, 212), run('2 Avenue Exemple', 620, 212), run('M01', 67, 205, 10),
    run('photovoltaïques', 440, 202),
  ), { city: town('digilor-le-pont-de-claix'), file: { board: 'decisions', published: '2026-09-30' } });
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].dossier, rows[0].address, rows[0].decidedOn, rows[0].postedOn], ['DP 038317 24 10040 M01', '2 Avenue Exemple', '2026-09-25', '2026-09-30']);
  assert.notEqual(rows[0].verdict, 'Décision signée');
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
});

// OCR words: one run per word, with its right edge.
const words = (text, x, y) => text.split(' ').reduce((out, word) => {
  const at = out.length ? out.at(-1).x1 + 3 : x;
  return [...out, { text: word, x: at, x1: at + word.length * 5, y, size: 10 }];
}, []);

test('a scanned order: the number, the street under a label that holds only the town, the column beside left out, the first article’s verdict', () => {
  const rows = readScannedNotice({ pages: [{ width: 595, height: 842, runs: [
    ...words('COMMUNE D\'ERGUE-GABERIC', 199, 775), ...words('PERMIS DE CONSTRUIRE |', 224, 743),
    ...words('Demande déposée le 29 juillet 2026', 39, 682), ...words('Permis de construire n° PC 029051 26 00049', 287, 676),
    ...words('Bénéficiaire : PRIVATE PERSON', 39, 623),
    ...words('Pour : Nouvelle construction', 39, 580), ...words('Construction d\'une maison individuelle.', 287, 580),
    ...words('Sur un terrain sis à ERGUE GABERIC', 39, 561), ...words('- 4 Rue Exemple', 39, 547),
    ...words('ARRÊTE', 273, 216),
    ...words('Article unique : Le permis de construire est ACCORDÉ pour le projet décrit', 37, 188),
    ...words('Le pétitionnaire est informé que le terrain est exposé au retrait-gonflement des argiles.', 37, 150),
    ...words('Ergué-Gabéric, le 26 septembre 2026', 300, 100),
  ] }] }, { city: town('digilor-ergue-gaberic'), file: { board: 'decisions', title: 'PC 26_49 DECISION', published: '2026-09-28' } });
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].dossier, rows[0].address, rows[0].postcode, rows[0].filedOn, rows[0].decidedOn],
    ['PC 029051 26 00049', '4 Rue Exemple', '29500', '2026-07-29', '2026-09-26']);
  assert.equal(rows[0].verdict, 'Accord');
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
});

test('a scanned avis de dépôt: the rule read as `|` and the town after the street taken off', () => {
  const [filing] = readScannedNotice({ pages: [{ runs: [
    ...words('AVIS DE DEPOT D’UNE DEMANDE', 232, 694),
    ...words('Numéro du dossier : DP 57 019 2600122', 71, 598), ...words('Date de dépôt : 14/09/2026', 71, 576),
    ...words('Demandeur : PRIVATE PERSON', 70, 536), ...words('Adresse des travaux : | 15 rue Exemple à Amnéville', 70, 516),
  ] }] }, { city: town('digilor-amneville'), file: { board: 'filings', published: '2026-09-15' } });
  assert.deepEqual([filing.dossier, filing.address, filing.postcode, filing.filedOn], ['DP 057019 26 00122', '15 rue Exemple', '57360', '2026-09-14']);
  assert.deepEqual(readScannedNotice({ pages: [{ runs: [...words('Numéro du dossier : DP 57 019 2600122', 71, 598), ...words('Le Maire', 70, 500)] }] },
    { city: town('digilor-amneville'), file: { board: 'filings' } }), []);
});

test('text notices whose labels `extended-notice` does not know: the value beside its label, the land’s area and the town cut off', () => {
  const verdun = readScannedNotice(page(
    run('CERTIFICAT D’AFFICHAGE', 134, 362), run('Date de dépôt :', 36, 294), run('28/09/2026', 213, 294),
    run('Numéro d’enregistrement :', 36, 280), run('DP 082 190 26 00088', 213, 280),
    run('Demandeur :', 36, 252), run('M. PRIVATE PERSON Réf cadastrale : AN 0165', 178, 252),
    run('Adresse du projet :', 36, 237), run('777 Avenue Exemple Superficie : 491 m²', 178, 237), run('82600 Verdun-sur-Garonne', 177, 223),
  ), { city: town('digilor-verdun-sur-garonne'), file: { board: 'filings', published: '2026-10-02' } });
  assert.deepEqual(verdun.map((row) => [row.dossier, row.address, row.postcode, row.parcels, row.filedOn]),
    [['DP 082190 26 00088', '777 Avenue Exemple', '82600', 'AN 165', '2026-09-28']]);
  const locmine = readScannedNotice(page(
    run('Numéro Dossier DP 56117 26 00076', 36, 280), run('Date de dépôt', 36, 257), run('31 AOUT 2026', 142, 257),
    run('Demandeur(s)', 36, 211), run('Madame PRIVATE PERSON', 142, 211), run('Terrain', 36, 164), run('7 RUE EXEMPLE', 142, 164),
    run('56500 LOCMINE', 142, 141), run('Travaux', 36, 100), run('Transformation d’un garage en chambre.', 142, 100),
  ), { city: town('digilor-locmine'), file: { board: 'filings', published: '2026-08-31' } });
  assert.deepEqual(locmine.map((row) => [row.dossier, row.address, row.filedOn, row.purpose]),
    [['DP 056117 26 00076', '7 RUE EXEMPLE', '2026-08-31', 'Transformation d’un garage en chambre.']]);
  const didier = readScannedNotice(page(
    run('Dossier n° DP 069 194 26 00132 déposé le 30/09/2026', 60, 693), run('Projet :', 60, 646), run('pose de panneaux', 142, 646),
    run('Adresse :', 60, 599), run('12 Rocade Exemple à Saint-Didier-au-Mont-d\'Or', 142, 599),
    run('Demandeur :', 60, 536), run('PRIVATE PERSON', 142, 536), run('14 RUE PRIVEE', 142, 504),
  ), { city: town('digilor-saint-didier-au-mont-d-or'), file: { board: 'filings' } });
  assert.deepEqual(didier.map((row) => [row.dossier, row.address, row.filedOn]), [['DP 069194 26 00132', '12 Rocade Exemple', '2026-09-30']]);
  assert.doesNotMatch(JSON.stringify([...verdun, ...locmine, ...didier].map(scrubPermitListRow)), /PRIVATE|PRIVEE/);
});

test('a scanned certificate of non-opposition says its verdict in its heading; pages out of order never make a withdrawal', () => {
  const city = town('digilor-saint-didier-au-mont-d-or');
  const [certificate] = readScannedNotice({ pages: [{ runs: [
    ...words('Réf. : DP 069 194 26 00120', 31, 535), ...words('CERTIFICAT DE NON-OPPOSITION', 154, 465),
    ...words('Suite à la déclaration préalable n° DP 069 194 26 00120, déposée le 31/08/2026', 31, 406),
    ...words('Situé À Route Exemple à Saint-Didier-au-Mont-d\'Or,', 31, 365),
  ] }] }, { city, file: { board: 'decisions' } });
  assert.deepEqual([certificate.dossier, certificate.address, certificate.filedOn, certificate.verdict],
    ['DP 069194 26 00120', 'Route Exemple', '2026-08-31', 'Non-opposition']);
  const [order] = readScannedNotice({ pages: [
    { runs: [...words('dossier n° PC 082 190 26 00003', 298, 778), ...words('date de dépôt : 30/04/2026', 274, 760),
      ...words('Adresse Terrain : 2 Rue Exemple 82600', 277, 577), ...words('ARRÊTÉ', 274, 536),
      ...words('accordant un permis de construire', 116, 524), ...words('Vu la demande de permis de construire', 64, 471), ...words('Article 1', 276, 88)] },
    { runs: [...words('- dans le délai de trois mois après la date du permis, l\'autorité compétente peut le retirer', 57, 768)] },
  ] }, { city: town('digilor-verdun-sur-garonne'), file: { board: 'decisions' } });
  assert.deepEqual([order.dossier, order.address, order.verdict], ['PC 082190 26 00003', '2 Rue Exemple', 'Accord']);
});

test('Annœullin’s and Avranches’s titles give the number however spaced and the street, never the applicant', () => {
  const read = (key, board, title) => readTitleAct({ pages: [] }, { city: town(key), file: { board, title, published: '2026-09-28' } })
    .map((row) => [row.board, row.dossier, row.address, row.verdict]);
  assert.deepEqual(read('digilor-annoeullin', 'decisions', 'arrêté DP 059 011 26 0 0069 PRIVATE 710 RUE EXEMPLE'),
    [['decisions', 'DP 059011 26 00069', '710 RUE EXEMPLE', 'Décision signée']]);
  assert.deepEqual(read('digilor-annoeullin', 'filings', 'Récépissé DP0590112600077 PRIVATE PERSON 08bis impasse EXEMPLE'),
    [['filings', 'DP 059011 26 00077', '08bis impasse EXEMPLE', null]]);
  assert.deepEqual(read('digilor-annoeullin', 'decisions', 'arrêté refus PC05901123B0004M04 SNC EXEMPLE RUE EXEMPLE'),
    [['decisions', 'PC 059011 23 B0004 M04', 'RUE EXEMPLE', 'Refus']]);
  assert.deepEqual(read('digilor-avranches', 'decisions', 'Arrêté DP 500252600135 PRIVATE PERSON- 7 résidence Exemple- Aménagement grenier 26.09.121'),
    [['decisions', 'DP 050025 26 00135', '7 résidence Exemple', 'Décision signée']]);
  assert.deepEqual(read('digilor-avranches', 'filings', 'Avis de dépot DP050025260152 PRIVATE 26 Rue Division Leclerc Division foncière de la parcelle'),
    [['filings', 'DP 050025 26 00152', '26 Rue Division Leclerc', null]]);
  assert.deepEqual(read('digilor-avranches', 'decisions', 'arrêté 26.10.02 DP 050 025 26 0140 ENEDIS 3 Bis Place Exemple'),
    [['decisions', 'DP 050025 26 00140', '3 Bis Place Exemple', 'Décision signée']]);
  assert.deepEqual(read('digilor-avranches', 'decisions', 'Arrêté d\'autorisation provisoire de poursuite d\'exploitation Bibliothèque'), []);
  assert.deepEqual(read('digilor-annoeullin', 'filings', 'récépissé de dépôt\nPRIVATE PERSON\n30 rue Exemple'), []);
  assert.deepEqual(read('digilor-annoeullin', 'filings', 'recepissé DP 0590402600076 PRIVATE 17 rue Exemple'), []);
});

test('the shelves of Saint-Didier, Verdun, Locminé, Annœullin and Avranches', () => {
  assert.deepEqual(picked('digilor-saint-didier-au-mont-d-or', [
    doc(1, 989, 1404, 'DP_26_132_PRIVATE_Avis_De_Dépôt'), doc(2, 989, 1403, 'AvisDeDepot-PC 26-36 PRIVATE'),
    doc(3, 989, 1403, 'PC 26-18 SCI EXEMPLE decision'), doc(4, 989, 1403, 'PC 16-72 M3 PRIVATE decicion'),
    doc(5, 989, 1405, 'PA 22-03 PRIVATE prorogation 2'), doc(6, 989, 1406, 'SAFER_RS 69 26 0134 01'),
  ]), [['1.pdf', 'filings', 'digilor-amneville-notice'], ['2.pdf', 'filings', 'digilor-amneville-notice'],
    ['3.pdf', 'decisions', 'digilor-amneville-notice'], ['4.pdf', 'decisions', 'digilor-amneville-notice']]);
  assert.deepEqual(picked('digilor-verdun-sur-garonne', [
    doc(1, 1731, 2116, 'DP0821902600088 Certificat d\'affichage'), doc(2, 1731, 2117, 'Arrêté PC0821902600003'),
    doc(3, 1731, 0, 'ap_20260715_sdpe82_gestion-restriction-eau'),
  ]), [['1.pdf', 'filings', 'digilor-amneville-notice'], ['2.pdf', 'decisions', 'digilor-amneville-notice']]);
  assert.deepEqual(picked('digilor-locmine', [
    doc(1, 704, 983, 'DP2026-076 AVIS DEPOT'), doc(2, 704, 1040, 'DP2026-063_ACCORD'), doc(3, 704, 8471, 'PMV2026-001'),
  ]), [['1.pdf', 'filings', 'digilor-amneville-notice'], ['2.pdf', 'decisions', 'digilor-amneville-notice']]);
  assert.deepEqual(picked('digilor-annoeullin', [
    doc(1, 4988, 8179, 'recepissé DP 0590112600076 PRIVATE 17 rue Exemple'), doc(2, 4988, 8178, 'arrêté refus PC 0590112600009 SCI EXEMPLE 165 rue Exemple'),
    doc(3, 4988, 8180, 'cu 0590112600118 EXEMPLE 34 RUE EXEMPLE'), doc(4, 4988, 8178, 'PC 059 011 26 0 0010 SCCV EXEMPLE rue Exemple'),
  ]), [['1.pdf', 'filings', 'digilor-annoeullin-title'], ['2.pdf', 'decisions', 'digilor-annoeullin-title']]);
  assert.deepEqual(picked('digilor-avranches', [
    doc(1, 773, 0, 'Avis de dépot DP050025260154 PRIVATE 5 Rue Exemple'), doc(2, 773, 0, 'Arrêté PC 500252600036. PRIVATE- 2 La Croix Exemple'),
    doc(3, 773, 0, 'Autorisation de poursuite d\'exploitation EXEMPLE'), doc(4, 772, 0, 'Arrêté de circulation'),
  ]), [['1.pdf', 'filings', 'digilor-annoeullin-title'], ['2.pdf', 'decisions', 'digilor-annoeullin-title']]);
});

test('the shelves of Urrugne, Vieux-Condé, Feurs, Châteaulin, Canohès and Boé', () => {
  const notice = 'digilor-amneville-notice';
  assert.deepEqual(picked('digilor-urrugne', [
    doc(1, 1778, 2994, 'avis de dépôt DP SAS EXEMPLE'), doc(2, 1778, 1999, 'arrêté PC PRIVATE'), doc(3, 1778, 2994, 'arrêté opposition DP PRIVATE'),
    doc(4, 1778, 2996, 'Avis enquête publique - PPRI'), doc(5, 1778, 2997, 'Appel à Candidature Dossier'),
  ]), [['1.pdf', 'filings', notice], ['2.pdf', 'decisions', notice], ['3.pdf', 'decisions', notice]]);
  assert.deepEqual(picked('digilor-vieux-conde', [
    doc(1, 1914, 8508, 'Construction d\'une piscine - 129 rue Exemple'), doc(2, 1914, 8509, 'Pose d\'un carport - 12 rue Exemple'),
    doc(3, 1917, 0, 'Arrêté de voirie'),
  ]), [['1.pdf', 'filings', notice], ['2.pdf', 'decisions', notice]]);
  assert.deepEqual(picked('digilor-feurs', [
    doc(1, 1009, 1421, 'SCI EXEMPLE'), doc(2, 1009, 1420, 'PRIVATE'), doc(3, 1009, 8031, 'SARL EXEMPLE'), doc(4, 1009, 1651, 'Réunions publiques PLUi'),
  ]), [['1.pdf', 'decisions', notice], ['2.pdf', 'decisions', notice]]);
  assert.deepEqual(picked('digilor-chateaulin', [
    doc(1, 97, 143, 'rue Exemple'), doc(2, 97, 122, 'Grand rue'), doc(3, 97, 469, 'route Exemple'), doc(4, 97, 2130, 'rocade Exemple'),
  ]), [['1.pdf', 'filings', notice], ['2.pdf', 'decisions', notice]]);
  assert.deepEqual(picked('digilor-canohes', [
    doc(1, 2028, 2406, 'DP 660382600090'), doc(2, 2028, 2405, 'PC 660382600012'), doc(3, 2028, 9795, 'AFFICHAGE OBLIGATOIRE - REUNIONS PUBLIQUE'),
  ]), [['1.pdf', 'decisions', notice], ['2.pdf', 'decisions', notice]]);
  assert.deepEqual(picked('digilor-boe', [
    doc(1, 1722, 1964, 'PRIVATE DP 0470312600108'), doc(2, 1722, 1965, 'PRIVATE DP 0470312600096'), doc(3, 1722, 1936, 'PRIVATE PC 0470312600008'),
    doc(4, 1722, 1966, 'EXEMPLE CUb 0470312600113'),
  ]), [['1.pdf', 'filings', notice], ['2.pdf', 'decisions', notice], ['3.pdf', 'decisions', notice]]);
});

test('a scanned order whose site label runs over two lines beside another column', () => {
  const [row] = readScannedNotice({ pages: [{ runs: [
    ...words('ARRETE ACCORDANT UNE DECLARATION PREALABLE', 284, 752),
    ...words('Dossier déposé complet le 08 Septembre 2026', 75, 559), ...words('N° DP 66038 26 00090', 373, 559),
    ...words('Par: PRIVATE PERSON', 112, 533), ...words('Demeurant 2 Impasse Privée', 79, 507),
    ...words('Sur un', 102, 385), ...words('Destination :', 339, 385),
    ...words('terrain sis à 2 Impasse Exemple', 74, 371), ...words('Dispositif ENR', 339, 371),
    ...words('Article 1 : La présente déclaration préalable est ACCORDÉE.', 70, 120),
  ] }] }, { city: town('digilor-canohes'), file: { board: 'decisions', title: 'DP 660382600090' } });
  assert.deepEqual([row.dossier, row.address, row.filedOn, row.verdict], ['DP 066038 26 00090', '2 Impasse Exemple', '2026-09-08', 'Accord']);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE|Privée/);
});
