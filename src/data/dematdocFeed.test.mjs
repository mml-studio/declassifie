import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMATDOC_PERMIT_SOURCES, dematdocDocuments, dematdocLazyRequest, dematdocOldest, dematdocParcels,
  dematdocShelfRequest, dematdocTitleRow, readDematdocNotice,
} from './dematdocFeed.js';
import { normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const city = (insee) => DEMATDOC_PERMIT_SOURCES.find((source) => source.insee === insee);
const MONTELIMAR = city('26198');
const BEAUZELLE = city('31056');
/** A page of positioned runs: [x, y, text], top of the page first. */
const page = (...runs) => ({ pages: [{ runs: runs.map(([x, y, text]) => ({ x, y, x1: x + text.length * 4.5, text })) }] });
const doc = (id, name, values = {}, extra = {}) => ({
  id, name, createdAt: '2026-09-28T09:00:00+02:00', path: `/repository/2026/09/P${id}.pdf`, bifferPath: null,
  values: Object.fromEntries(Object.entries(values).map(([key, displayValue]) => [key, { displayValue }])), ...extra,
});

test('every DematDOC tenant is its own commune’s permit list, read despite the platform’s robots.txt', () => {
  assert.equal(DEMATDOC_PERMIT_SOURCES.length, 56);
  assert.equal(new Set(DEMATDOC_PERMIT_SOURCES.map((source) => source.insee)).size, 56);
  for (const source of DEMATDOC_PERMIT_SOURCES) {
    assert.equal(permitListFor(source.insee), source);
    assert.equal(source.robots, 'overridden');
    assert.match(source.source.base, /^https:\/\/[a-z0-9-]+\.dematdoc\.eu$/);
    assert.ok(source.source.doctypes.length > 0);
  }
});

test('a shelf is asked newest first, then by the ids it leaves', () => {
  const first = dematdocShelfRequest(MONTELIMAR, 14);
  assert.equal(first.url, 'https://montelimar.dematdoc.eu/api/public/get-documents/14');
  assert.deepEqual(JSON.parse(first.body), { filters: { params: { archive: false }, indexfields: [], document: [] }, filtersURL: '14' });
  assert.deepEqual(dematdocLazyRequest(MONTELIMAR, [3, 2]), { url: 'https://montelimar.dematdoc.eu/api/public/get-documents-lazy', body: '[3,2]' });
  assert.equal(dematdocOldest([doc(1, 'a'), { ...doc(2, 'b'), createdAt: '2026-07-30T10:00:00+02:00' }]), '2026-07-30');
});

test('a shelf keeps the commune’s urbanism acts and drops road orders, registers and old postings', () => {
  const files = dematdocDocuments(MONTELIMAR, [
    doc(1, 'Urbanisme DP261982600511 du 2026-09-28', { OBJET: 'Arrêté', CI_DATE_DEBUT_AFFICHAGE_PUBLIC: '2026-09-28', DATEACTE: '2026-09-27' }),
    doc(2, 'Avis de Dépôt - Déclaration Préalable DP0261982600512 du 2026-09-28', { OBJET: 'PRIVATE PERSON' }, { bifferPath: '/repository/2026/09/B2.pdf' }),
    doc(3, 'Permis de construire A2026-1468 du 2026-09-30', { OBJET: 'Refus construction bâtiment' }),
    doc(4, 'Arrêté municipal 2026-3-147 du 2026-09-29', { OBJET: 'Réglementation de la circulation rue Exemple' }),
    doc(5, 'Permis de construire - démolir - aménager du 2026-09-28', { OBJET: 'Déclarations Préalables déposées au 28/09/2026' }),
    doc(6, 'Urbanisme DP261982600400 du 2026-06-02', { CI_DATE_DEBUT_AFFICHAGE_PUBLIC: '2026-06-02' }),
    doc(7, 'Urbanisme DP261982600513 du 2026-09-28', {}, { path: 'https://elsewhere.example/a.pdf' }),
  ], '2026-08-01');
  assert.deepEqual(files.map((file) => [file.url.replace(MONTELIMAR.source.base, ''), file.board]), [
    ['/repository/2026/09/P1.pdf', 'decisions'],
    ['/repository/2026/09/B2.pdf', 'filings'],
    ['/repository/2026/09/P3.pdf', 'decisions'],
  ]);
  assert.equal(files[0].published, '2026-09-28');
  assert.equal(files[0].decidedOn, '2026-09-27');
});

test('a decision gives its site, parcels and verdict, never its applicant nor the works printed beside the site', () => {
  const document = page(
    [200, 780, 'OPPOSITION À DÉCLARATION PRÉALABLE'],
    [200, 768, 'PRONONCÉE PAR LE MAIRE AU NOM DE LA COMMUNE'],
    [310, 740, 'Déposée le : 17/09/2026'],
    [310, 728, 'n° DP 26198 26 00511'],
    [60, 700, 'Présentée par : Monsieur PRIVATE PERSON'],
    [60, 688, 'Demeurant : 9 rue Privée'],
    [60, 660, 'Sur un terrain sis : 26 Allée Exemple,'], [330, 660, 'surélévation du garage'],
    [60, 648, 'Parcelles : ZI313'],
    [60, 600, 'Vu l’article 1 de la loi du 7 janvier 1983, autorisé par le code'],
    [250, 560, 'ARRÊTE'],
    [60, 540, 'Article 1 : Il est fait opposition à la déclaration préalable susvisée.'],
    [300, 400, 'Fait à Montélimar, le 28/09/2026'],
  );
  const [row] = readDematdocNotice(document, { city: MONTELIMAR, file: { board: 'filings', published: '2026-09-28', title: '' } });
  assert.equal(row.board, 'decisions');
  assert.equal(row.dossier, 'DP 026198 26 00511');
  assert.equal(row.address, '26 Allée Exemple');
  assert.equal(row.parcels, 'ZI 313');
  assert.equal(row.verdict, 'Refus');
  assert.equal(row.filedOn, '2026-09-17');
  assert.equal(row.decidedOn, '2026-09-28');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|Privée|surélévation/);
  assert.equal(normalisePermitListRow(MONTELIMAR, 'decisions', scrubPermitListRow(row)).state, 'refuse');
});

test('the operative article’s first sentence gives the verdict, before the withdrawal a later one names', () => {
  const document = page(
    [250, 760, 'ARRETE'],
    [200, 748, 'De non opposition à une déclaration préalable'],
    [310, 740, 'Déposée le : 17/09/2026'],
    [310, 728, 'n° DP 26198 26 00512'],
    [60, 660, 'Sur un terrain sis : 26 Allée Exemple,'],
    [250, 560, 'ARRETE'],
    [60, 540, 'Article 1'],
    [60, 528, 'Il n’est pas fait opposition à la déclaration préalable. Elle peut faire l’objet d’un retrait dans les trois mois.'],
    [300, 400, 'Fait à Montélimar, le 28/09/2026'],
  );
  const [row] = readDematdocNotice(document, { city: MONTELIMAR, file: { board: 'decisions', title: '' } });
  assert.equal(row.verdict, 'Non-opposition');
});

test('a receipt reads the site under its label, in the label’s column, as a filing', () => {
  const document = page(
    [40, 790, 'MAIRIE DE BEAUZELLE'], [330, 790, 'Récépissé de dépôt'],
    [330, 770, 'Dossier : DP 031 056 26 00072'],
    [40, 740, 'Déposé le'], [200, 740, '30/09/2026'],
    [40, 720, 'Par'], [200, 720, 'Monsieur PRIVATE PERSON'],
    [40, 700, 'Sis à l\'adresse suivante'],
    [200, 688, '13 Rue Exemple'],
    [200, 676, '31700 BEAUZELLE'],
  );
  const [row] = readDematdocNotice(document, { city: BEAUZELLE, file: { board: 'decisions', title: '' } });
  assert.equal(row.board, 'filings');
  assert.equal(row.address, '13 Rue Exemple');
  assert.equal(row.postcode, '31700');
  assert.equal(row.verdict, undefined);
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE/);
});

test('an order heading wins over a posting date of the filing printed above it', () => {
  const agneaux = city('50002');
  const document = page(
    [40, 790, 'dossier n° PC 050 002 26 00012'],
    [40, 770, 'date d\'affichage en mairie de l\'avis de dépôt : 30 juin 2026'],
    [40, 750, 'adresse terrain : 3 Rue Exemple'],
    [40, 738, '50180 AGNEAUX'],
    [250, 700, 'ARRÊTÉ'],
    [40, 600, 'Article 1'],
    [40, 588, 'Le permis de construire est ACCORDÉ'],
  );
  const [row] = readDematdocNotice(document, { city: agneaux, file: { board: 'filings', title: '' } });
  assert.equal(row.board, 'decisions');
  assert.equal(row.verdict, 'Accord');
  assert.equal(row.address, '3 Rue Exemple');
});

test('a site keeps the « à » of its street and loses the commune printed after it', () => {
  const lancon = city('13051');
  const besse = city('83018');
  const read = (source, site) => readDematdocNotice(page(
    [40, 790, 'DÉCISION de non-opposition'], [40, 770, `N° DP ${source.insee} 26 00137`],
    [40, 750, `Sur un terrain sis à : ${site}`],
  ), { city: source, file: { board: 'decisions', title: '' } })[0]?.address;
  assert.equal(read(lancon, '132 Impasse du Moulin à Vent à'), '132 Impasse du Moulin à Vent');
  assert.equal(read(besse, '1152 Chemin de Poulmas à BESSE-SUR-ISSOLE (83890)'), '1152 Chemin de Poulmas');
  assert.equal(read(besse, 'Travaux sur construction existante'), undefined, 'a site names a number or a way');
});

test('Cart@DS prints the commune’s three digits before a section; they are not a cadastral prefix', () => {
  assert.equal(dematdocParcels('28 AH 776', city('34028')), 'AH 776');
  assert.equal(dematdocParcels('150 CA 221, 150 CA 228', city('34150')), 'CA 221, CA 228');
  assert.equal(dematdocParcels('ZE-0142', city('64138')), 'ZE 142');
  assert.equal(dematdocParcels('000A0247, 000A0248 - 1670 M²', city('30019')), 'A 247, A 248');
});

test('a scan waits for OCR with its number and a street from its title, never a name from it', () => {
  const chabeuil = city('26064');
  const row = dematdocTitleRow(chabeuil, { board: 'filings', published: '2026-10-01',
    title: 'Déclaration préalable DP0260642600136 du 2026-10-01 — DP0260642600136 - 5ter Chemin Exemple' });
  assert.equal(row.dossier, 'DP 026064 26 00136');
  assert.equal(row.address, '5ter Chemin Exemple');
  assert.equal(dematdocTitleRow(city('01047'), { board: 'filings',
    title: 'Urba - Avis de Dépôt Demande DP 00104726A0038 du 2026-09-24 — PRIVATE Person' }), null);
});

test('an order that recalls when its filing was posted is a decision, signed on the line its commune opens', () => {
  const garchizy = { key: 'garchizy', insee: '58121', postcode: '58600', label: 'Ville de Garchizy', source: { kind: 'board' } };
  // As OCR reads Garchizy's scanned orders: « 1er » as « ler », no « Fait à ».
  const document = page(
    [40, 822, '2026-034-URBA'], [200, 801, 'DECLARATION PREALABLE'], [40, 786, 'MAIRIE DE GARCHIZY DELIVREE PAR LE MAIRE'],
    [40, 744, 'Demande déposée le : 27/04/2026'], [40, 732, 'Avis de dépôt affiché en mairie le : 27/04/2026'], [400, 732, 'DP 058121 26 N0022'],
    [40, 702, 'Par :| PRIVATE COMPANY'], [40, 681, 'Demeurant :| 1 rue Privée 58600 GARCHIZY'],
    [40, 636, 'Pour :| construction d\'un mur de séparation'], [40, 615, 'Sur un terrain sis :| 409 Avenue de la République - Cadastré: AK 385'],
    [40, 585, 'LE MAIRE,'], [40, 573, 'Vu la demande de Déclaration Préalable susvisée ;'],
    [40, 447, 'Article ler : Il n’est pas fait opposition au projet décrit dans la demande sous réserve du respect des'],
    [40, 378, 'Article 2 : Le Maire de GARCHIZY est chargé de l’exécution du présent arrêté.'], [40, 315, 'GARCHIZY, le 12 mai 2026'],
  );
  const [row] = readDematdocNotice(document, { city: garchizy, file: { board: 'decisions', title: '' } });
  assert.deepEqual([row.board, row.dossier, row.address, row.parcels, row.filedOn, row.verdict, row.decidedOn, row.purpose],
    ['decisions', 'DP 058121 26 N0022', '409 Avenue de la République', 'AK 385', '2026-04-27', 'Non-opposition', '2026-05-12', 'construction d\'un mur de séparation']);
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|Privée/);
  // Étupes's notices: « Date du dépôt ».
  const notice = readDematdocNotice(page(
    [40, 762, 'AVIS DE DEPOT : Déclaration préalable'], [40, 723, 'Dossier numéro : DP 058121 26 N0023'], [40, 696, 'Date du dépôt : 30/09/2026'],
    [40, 672, 'Demandeur : MME PRIVATE Person'], [40, 621, 'Adresse du terrain : 7 rue du château'], [40, 456, 'AVIS AFFICHÉ LE : 01 octobre 2026'],
  ), { city: garchizy, file: { board: 'decisions', title: '' } });
  assert.deepEqual([notice[0].board, notice[0].address, notice[0].filedOn], ['filings', '7 rue du château', '2026-09-30'], 'an avis de dépôt is still a filing');
  assert.doesNotMatch(JSON.stringify(notice), /PRIVATE/);
});

// Word-level runs, as the sweep's OCR gives them: [x, x1, y, text].
const words = (...runs) => ({ pages: [{ width: 595, runs: runs.map(([x, x1, y, text]) => ({ x, x1, y, text })) }] });

test('a table that prints « Demandeur » at its right edge never lends its cell to the works or the site', () => {
  const briey = { insee: '54099', postcode: '54150' };
  const document = words(
    [77, 134, 735, 'DÉCISION'], [138, 224, 735, 'D’OPPOSITION'], [228, 244, 735, 'DE'], [248, 335, 735, 'DÉCLARATION'], [338, 411, 735, 'PRÉALABLE'],
    [73, 103, 617, 'Dossier'], [106, 107, 617, ':'], [111, 122, 617, 'DP'], [126, 154, 617, '054099'], [158, 167, 617, '26'], [171, 195, 617, '00127'],
    [329, 375, 617, 'Demandeur'], [378, 379, 617, ':'],
    [73, 103, 601, 'Déposé'], [107, 113, 601, 'le'], [117, 118, 601, ':'], [121, 165, 601, '29/08/2026'], [328, 359, 601, 'PRIVATE'], [363, 395, 601, 'PERSON'],
    [72, 148, 586, 'Nature'], [101, 113, 586, 'des'], [117, 146, 586, 'travaux'], [151, 152, 586, ':'], [156, 226, 586, 'CHANGEMENTS'],
    [229, 247, 586, 'DES'], [250, 284, 586, 'VITRES,'], [288, 299, 586, 'DE'], [303, 314, 586, 'LA'],
    [328, 337, 586, '|32'], [341, 369, 586, 'ALLEE'], [373, 391, 586, 'DES'], [394, 452, 586, 'PRIVEES'],
    [72, 153, 549, 'Adresse'], [106, 119, 549, 'des'], [123, 152, 549, 'travaux'], [157, 158, 549, ':'], [162, 166, 549, '5'], [170, 187, 549, 'RUE'],
    [191, 202, 549, 'DE'], [206, 230, 549, 'METZ'], [233, 235, 549, '-'], [239, 266, 549, 'BRIEY'], [269, 292, 549, '54150'],
    [329, 352, 549, '57650'], [356, 393, 549, 'EXEMPLE'],
  );
  const [row] = readDematdocNotice(document, { city: briey, file: { board: 'decisions', title: '' } });
  assert.equal(row.purpose, 'CHANGEMENTS DES VITRES, DE LA');
  assert.equal(row.address, '5 RUE DE METZ - BRIEY');
  assert.equal(row.board, 'decisions');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|PRIVEES|57650|EXEMPLE/);
  // The border OCR reads as « | » ends a value even when it touches the works.
  const touching = words(...document.pages[0].runs.filter((r) => r.y !== 586).map((r) => [r.x, r.x1, r.y, r.text]),
    [128, 326, 586, 'Nature des travaux : POSE DE PANNEAUX'], [333, 336, 586, '|!'], [340, 387, 586, 'QUARTIER'], [391, 402, 586, 'PRIVE']);
  assert.equal(readDematdocNotice(touching, { city: briey, file: { board: 'decisions', title: '' } })[0].purpose, 'POSE DE PANNEAUX');
});

test('« demandeur » inside a label (« Adresse du demandeur : ») bounds no column: the works keep their words', () => {
  const marseillan = { insee: '34150', postcode: '34340' };
  const document = words(
    [292, 400, 810, 'DOSSIER : N° PC 034 150 24 V0036'], [292, 380, 795, 'Déposé le : 20/07/2026'],
    [292, 420, 781, 'Demandeur : EXEMPLE SAS'],
    [291, 326, 752, 'Adresse'], [330, 340, 752, 'du'], [344, 395, 752, 'demandeur'], [400, 402, 752, ':'], [406, 470, 752, '1 RUE EXEMPLE'],
    [291, 326, 723, 'Nature'], [330, 348, 723, 'des'], [352, 390, 723, 'travaux'], [394, 396, 723, ':'], [404, 466, 723, 'Modification'],
    [470, 494, 723, 'd’un'], [498, 533, 723, 'permis'], [537, 548, 723, 'de'],
    [290, 306, 680, 'Sur'], [310, 320, 680, 'un'], [324, 354, 680, 'terrain'], [358, 370, 680, 'sis'], [373, 380, 680, 'à'], [383, 386, 680, ':'],
    [390, 395, 680, '1'], [399, 433, 680, 'Avenue'], [437, 449, 680, 'de'], [453, 461, 680, 'la'], [465, 500, 680, 'Lagune'],
    [100, 200, 600, 'ARRÊTÉ ACCORDANT UN PERMIS DE CONSTRUIRE MODIFICATIF'],
  );
  const [row] = readDematdocNotice(document, { city: marseillan, file: { board: 'decisions', title: '' } });
  assert.equal(row.purpose, 'Modification d’un permis de');
  assert.equal(row.address, '1 Avenue de la Lagune');
  assert.doesNotMatch(JSON.stringify(row), /EXEMPLE/);
});

test('a bare « DÉCLARATION PRÉALABLE » over « DÉLIVRÉE PAR LE MAIRE » is a decision, though its notice says « Avis de dépôt affiché le »', () => {
  const hagondange = { insee: '57283', postcode: '57300' };
  const document = page(
    [200, 790, 'COMMUNE DE HAGONDANGE'], [200, 770, 'DÉCLARATION PRÉALABLE'], [200, 758, 'DÉLIVRÉE PAR LE MAIRE AU NOM DE LA COMMUNE'],
    [200, 730, 'DP 057 283 2600095'], [60, 710, 'Avis de dépôt affiché le 13/07/2026'], [60, 698, 'Arrêté affiché le 05/08/2026'],
    [60, 680, 'Par: PRIVATE PERSON'], [60, 668, 'Demeurant à : 43 rue Privée'],
    [60, 640, 'Sur un terrain sis : 44 rue du Maréchal Foch'], [60, 628, '57300 HAGONDANGE'], [60, 616, 'Parcelle(s) : 13 0248'],
    [60, 600, 'Vu la Déclaration Préalable susvisée déposée le 07.07.2026,'],
  );
  const [row] = readDematdocNotice(document, { city: hagondange, file: { board: 'filings', title: '' } });
  assert.equal(row.board, 'decisions');
  assert.equal(row.dossier, 'DP 057283 26 00095');
  assert.equal(row.address, '44 rue du Maréchal Foch');
  assert.equal(row.applicant, null);
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|Privée/);
});

test('« Sur un terrain : » alone labels a site (Aumetz’s declarations)', () => {
  const aumetz = { insee: '57041', postcode: '57710' };
  const [row] = readDematdocNotice(page(
    [30, 800, 'PRESCRIPTIONS À DÉCLARATION PRÉALABLE'], [30, 788, 'PRONONCEES PAR LE MAIRE AU NOM DE LA COMMUNE'], [60, 740, 'Déposé 09/09/2026 DP 057 041 26 00025'],
    [60, 700, 'Par: Madame PRIVATE'], [60, 570, 'Sur un terrain : 19 rue d’Ottange à AUMETZ'],
  ), { city: aumetz, file: { board: 'decisions', title: '' } });
  assert.equal(row.address, '19 rue d’Ottange à AUMETZ');
  assert.equal(row.postcode, '57710');
});

test('an amendment suffix typed in the link wins over one OCR garbles, never over a clear one', () => {
  const rurange = { insee: '57602', postcode: '57310' };
  const document = page([60, 780, 'ARRÊTÉ de non-opposition à une déclaration préalable'], [60, 760, 'Dossier n° DP05760226N0030T4'],
    [60, 740, 'Adresse du terrain : 25 rue des Écoles'], [60, 720, 'ARTICLE UNIQUE : il n’est pas fait opposition à la déclaration préalable']);
  const read = (dossier, text = null) => readDematdocNotice(text ?? document, { city: rurange, file: { board: 'decisions', title: '', row: { dossier } } })[0].dossier;
  assert.equal(read('DP 057602 26 N0030 M01'), 'DP 057602 26 N0030 M01');
  assert.equal(read('DP 057602 26 N0031 M01'), 'DP 057602 26 N0030 T4', 'another counter is another dossier');
  const clear = page([60, 780, 'ARRÊTÉ de non-opposition à une déclaration préalable'], [60, 760, 'Dossier n° DP05760226N0030M02'],
    [60, 740, 'Adresse du terrain : 25 rue des Écoles']);
  assert.equal(read('DP 057602 26 N0030 M01', clear), 'DP 057602 26 N0030 M02');
});

test('« retrait-gonflement des argiles » in an order’s note is no withdrawal', () => {
  const hagondange = { insee: '57283', postcode: '57300' };
  const [row] = readDematdocNotice(page(
    [60, 780, 'ARRÊTÉ de non-opposition à une déclaration préalable'], [60, 760, 'Dossier n° DP 057 283 26 00095'],
    [60, 740, 'Adresse du terrain : 44 rue du Maréchal Foch'], [60, 700, 'ARRÊTE'],
    [60, 680, 'ARTICLE UNIQUE : il n’est pas fait opposition à la déclaration préalable'], [60, 668, 'Nota :'],
    [60, 656, 'Le terrain est situé en zone d’aléa fort vis-à-vis du risque naturel de retrait-gonflement des argiles.'],
  ), { city: hagondange, file: { board: 'decisions', title: '' } });
  assert.equal(row.verdict, 'Non-opposition');
});

test('the day of an order whose signature is a stamp is the one its télétransmission ID carries (Douvrin)', () => {
  const douvrin = { insee: '62276', postcode: '62138' };
  let stampDay = '20260928';
  const read = (...extra) => readDematdocNotice(page(
    [30, 800, `ID : 062-216202762-${stampDay}-PC2026_00020-AU`], [60, 780, 'OCTROI DE PERMIS DE CONSTRUIRE'],
    [60, 760, 'N° PC 062 276 26 00020'], [60, 740, 'déposée le 24/07/2026'], [60, 720, 'sur un terrain sis LOT 69 RUE DES MARTYRS'],
    [60, 700, 'ARTICLE 1'], [60, 688, 'Le permis de construire est accordé sous réserve de respecter les prescriptions.'],
    [60, 660, 'Fait à DOUVRIN, le'], ...extra,
  ), { city: douvrin, file: { board: 'decisions', title: '' } })[0];
  assert.equal(read().decidedOn, '2026-09-28');
  assert.equal(read([60, 650, 'Fait à DOUVRIN, le 29/09/2026']).decidedOn, '2026-09-29', 'a day the order prints is preferred to the stamp');
  assert.equal(readDematdocNotice(page([60, 780, 'DÉCISION DE NON-OPPOSITION'], [60, 760, 'N° DP 062 276 26 00020'], [60, 740, 'Dossier déposé le 22/12/2025'],
    [60, 720, 'Sur un terrain sis 4 rue des Marais'], [60, 700, 'ARTICLE UNIQUE : il n’est pas fait opposition'], [60, 680, 'Fait à DOUVRIN, le 29/12/2028']),
  { city: douvrin, file: { board: 'decisions', title: '', signedBy: '2025-12-29' } })[0].decidedOn, null, 'an order is not signed after the day its board posted it');
  stampDay = '20260101';
  assert.equal(read().decidedOn, null, 'a day before the filing is no decision and is dropped');
});

test('a postcode and a commune alone are no site, and « et » between two parcel numbers is no section (Clouange)', () => {
  const clouange = { insee: '57143', postcode: '57185' };
  assert.equal(dematdocParcels('Section 03 Parcelles 0016, 0168 et 0169', clouange), null);
  assert.equal(dematdocParcels('193 et 195', clouange), null);
  assert.equal(dematdocParcels('AB 12, ET 169', clouange), 'AB 12, ET 169', 'a section « ET » after a comma stays one');
  const order = (site) => readDematdocNotice(page(
    [30, 800, 'PERMIS DE CONSTRUIRE MODIFICATIF'], [300, 780, 'N° PC 057 143 24P0004 M01'], [30, 760, 'Demande déposée le 30/06/2026'],
    [30, 730, 'Sur un terrain sis à :'], [140, 730, site], [30, 700, 'Article 1 : Le présent Permis de Construire fait l’objet d’une décision favorable.'],
  ), { city: clouange, file: { board: 'decisions', title: '' } });
  assert.deepEqual(order('57185 CLOUANGE'), [], 'no street, no row');
  const stamped = (...lines) => readDematdocNotice(page(
    [30, 800, 'DÉCLARATION PRÉALABLE'], [300, 780, 'N° DP 057 143 2600034'], [30, 760, 'Demande déposée le 10/09/2026'], [30, 740, 'Sur un terrain sis à : 11 Rue du Ruisseau'],
    [30, 700, 'Article 1 : La présente déclaration préalable fait l’objet d’une décision de non opposition.'], ...lines,
  ), { city: clouange, file: { board: 'decisions', title: '' } })[0].decidedOn;
  assert.equal(stamped([413, 190, '2 9 SEP. 2026'], [325, 170, 'CLOUANGE, le']), '2026-09-29', 'a stamp alone on its line, digits spaced by the OCR');
  assert.equal(stamped([325, 170, 'CLOUANGE, le 15 SEP, 2026']), '2026-09-15', 'a comma after the month');
  assert.equal(stamped([413, 190, '2 9 SEP, 20%'], [325, 170, 'CLOUANGE, le']), null, 'a year the OCR cannot read is no date');
  assert.equal(order('11 Rue du Ruisseau 57185 Clouange')[0].address, '11 Rue du Ruisseau');
});

test('a commune alone over a street: the street under it is the site, a sentence under it is not (Pomacle)', () => {
  const pomacle = { insee: '51439', postcode: '51110' };
  const notice = (under) => readDematdocNotice(page(
    [199, 725, 'PERMIS DE CONSTRUIRE'], [45, 686, 'Référence :'], [198, 686, 'Dossier n°: PC 051 439 26 00014'],
    [45, 659, 'Date de dépôt :'], [198, 659, '23 septembre 2026'], [45, 604, 'Bénéficiaire :'], [201, 604, 'EXEMPLE SAS'],
    [45, 578, 'Adresse des travaux :'], [201, 578, '51110 POMACLE'], [204, 564, under],
    [45, 525, 'Nature des travaux :'], [201, 525, 'Construction d’un carport'],
  ), { city: pomacle, file: { board: 'filings', title: '' } });
  assert.equal(notice('Route de Bazancourt')[0].address, 'Route de Bazancourt');
  assert.equal(notice('3 Grande Place')[0].address, '3 Grande Place');
  assert.deepEqual(notice('Le dossier peut être consulté en mairie'), [], 'no street, no parcel: no row');
});

test('an order dated « 21 / 9 /2026 » and signed « Le 24 septembre 2026 » over « Le Maire » gives both days (Rurange)', () => {
  const rurange = { insee: '57602', postcode: '57310', source: { oForZero: true } };
  const [row] = readDematdocNotice({ pages: [
    page([200, 800, 'Dossier n° DP05760226NO060'], [200, 780, 'Date de dépôt : 21 / 9 /2026'], [200, 760, 'Pour : installation d’une clôture'],
      [200, 740, 'Adresse du terrain : 3 rue Jacques Prévert MONTREQUIENNE (57310)'], [60, 700, 'ARRÊTÉ de non-opposition à une déclaration préalable'],
      [60, 680, 'ARTICLE UNIQUE : il n’est pas fait opposition à la déclaration préalable']).pages[0],
    page([300, 800, 'Le 24 septembre 2026'], [300, 788, 'Le Maire'], [300, 776, 'Prénom NOM']).pages[0],
  ] }, { city: rurange, file: { board: 'decisions', title: '' } });
  assert.equal(row.filedOn, '2026-09-21');
  assert.equal(row.decidedOn, '2026-09-24');
  const cadastral = page([200, 800, 'Dossier n° DP05760226NO060'], [200, 760, 'Adresse du terrain : 3 rue Jacques Prévert'], [200, 740, 'Références cadastrales : S37 P0113'],
    [60, 700, 'ARTICLE UNIQUE : il n’est pas fait opposition à la déclaration préalable']);
  const parcelsOf = (file) => readDematdocNotice(cadastral, { city: rurange, file: { board: 'decisions', title: '', ...file } })[0].parcels;
  assert.equal(parcelsOf({}), 'S 37, P 113', 'read as two parcels unless the board says otherwise');
  assert.equal(parcelsOf({ noParcels: true }), null);
  assert.equal(row.address, '3 rue Jacques Prévert MONTREQUIENNE');
});

test('a later sentence that says « parcelles » is no parcel reference: the first labelled line decides (Hagondange)', () => {
  const hagondange = { insee: '57283', postcode: '57300' };
  const read = (parcels) => readDematdocNotice(page(
    [200, 800, 'DP 057 283 2600108'], [60, 760, 'Sur un terrain sis : 2-4 rue de la liberté'], [60, 740, parcels],
    [60, 700, 'ARTICLE UNIQUE : il n’est pas fait opposition à la déclaration préalable'],
    [60, 660, 'sur les parcelles voisines (Zone d’influence Géotechnique décrite dans la norme NF P 94-500 révisée le 30 novembre 2013)'],
  ), { city: hagondange, file: { board: 'decisions', title: '' } })[0].parcels;
  assert.equal(read('Parcelle(s) : 14 0070, 14 0110'), null, 'numeric sections are not read, the note is not either');
  assert.equal(read('Parcelle(s) : AB 12, C 138'), 'AB 12, C 138');
});

test('a parcel reference where the site should be places the act on its parcels, with no address (Wasquehal)', () => {
  const wasquehal = { insee: '59646', postcode: '59290' };
  const read = (...lines) => readDematdocNotice(page(
    [60, 780, 'ARRÊTÉ de non-opposition à une déclaration préalable'], [60, 760, 'N° DP 059 646 26 00175'], [60, 740, 'Demande déposée le 07/08/2026'],
    ...lines, [60, 680, 'ARTICLE UNIQUE : il n’est pas fait opposition à la déclaration préalable'],
  ), { city: wasquehal, file: { board: 'decisions', title: '' } });
  const [row] = read([74, 712, 'Sur un 92 RUE EXEMPLE à WASQUEHAL'], [74, 700, 'terrain sis : Cadastré : BD40, BD74']);
  assert.deepEqual([row.dossier, row.address, row.postcode, row.parcels, row.verdict], ['DP 059646 26 00175', null, '59290', 'BD 40, BD 74', 'Non-opposition']);
  assert.equal(read([74, 700, 'Sur un terrain sis : Cadastré : BD40'], [74, 690, 'Adresse du terrain : 3 rue Exemple'])[0].address, '3 rue Exemple',
    'a label that gives an address wins over the parcels');
  assert.deepEqual(read([74, 700, 'Sur un terrain sis : Cadastré : néant']), [], 'no parcel read, no row');
});

test('a commune alone where the site should be keeps the act on its parcels; a lone stamp of the filing day signs nothing (Rouvroy, Wasquehal)', () => {
  const rouvroy = { insee: '62724', postcode: '62320' };
  const read = (...lines) => readDematdocNotice(page(
    [60, 780, 'ARRÊTÉ de non-opposition à une déclaration préalable'], [60, 760, 'N° DP 062 724 26 00026'], [60, 740, 'Dossier déposé le 26/05/2026'],
    ...lines, [60, 680, 'ARTICLE 1 : il n’est pas fait opposition à la déclaration préalable'],
  ), { city: rouvroy, file: { board: 'decisions', title: '' } })[0];
  const row = read([60, 712, 'Sur un terrain sis : 62320 ROUVROY'], [60, 700, 'Cadastré : AO 316']);
  assert.deepEqual([row.address, row.parcels], [null, 'AO 316']);
  assert.equal(read([60, 712, 'Sur un terrain sis : 62320 ROUVROY']), undefined, 'neither an address nor a parcel: no row');
  assert.equal(read([60, 712, 'Adresse du terrain : 2 rue Exemple'], [238, 120, '26 MAI 2026']).decidedOn, null, 'the filing day’s stamp');
  assert.equal(read([60, 712, 'Adresse du terrain : 2 rue Exemple'], [238, 120, '0 2 JUIN 2026']).decidedOn, '2026-06-02');
});

test('a label’s « à : » printed on its value’s line, a few points above it, is not the site (Lançon-Provence)', () => {
  const lancon = { insee: '13051', postcode: '13680' };
  const document = { pages: [{ runs: [
    { x: 304, x1: 347, y: 790.1, text: 'DOSSIER :' }, { x: 351, x1: 458, y: 790.8, text: 'N° DP 013 051 26 00134' },
    { x: 304, x1: 408, y: 776.2, text: 'Déposé le : 07/09/2026' },
    { x: 305, x1: 393, y: 718.4, text: 'Nature des travaux :' }, { x: 397, x1: 436, y: 718.5, text: 'PORTAIL' },
    { x: 382, x1: 386, y: 704.0, text: 'à' }, { x: 390, x1: 391, y: 704.1, text: ':' },
    { x: 395, x1: 489, y: 704.2, text: '12 Avenue du général' }, { x: 493, x1: 531, y: 705.7, text: 'Exemple à' },
    { x: 304, x1: 378, y: 702.8, text: 'Sur un terrain sis' },
    { x: 305, x1: 432, y: 689.4, text: 'LANCON-PROVENCE (13680)' },
    { x: 285, x1: 354, y: 593, text: 'DECISION' },
  ] }] };
  const [row] = readDematdocNotice(document, { city: lancon, file: { board: 'decisions', title: '' } });
  assert.equal(row.address, '12 Avenue du général Exemple');
});

test('a « | » ends the works; in a site it is a misread letter where no applicant’s column bounds the table (Anor, Lillers)', () => {
  const lillers = { insee: '62516', postcode: '62190' };
  const document = words(
    [372, 404, 555, 'AVIS'], [410, 428, 555, 'DE'], [433, 481, 555, 'DÉPÔT'],
    [118, 158, 474, 'Dossier'], [162, 202, 474, 'numéro'], [207, 208, 474, ':'], [221, 237, 474, 'DP'], [241, 260, 474, '062'],
    [265, 284, 474, '516'], [288, 301, 474, '26'], [305, 337, 474, '00121'],
    [140, 202, 423, 'Demandeur'], [207, 208, 423, ':'], [221, 267, 423, 'PRIVATE'], [271, 307, 423, 'PERSON'],
    [106, 151, 367, 'Adresse'], [155, 167, 367, 'du'], [171, 205, 367, 'terrain'], [221, 232, 367, '12'], [236, 254, 367, 'rue'],
    [258, 270, 367, 'de'], [274, 275, 367, '|'], [279, 318, 367, 'Église'],
    [220, 253, 351, '62190'], [258, 305, 351, 'LILLERS'],
    [102, 131, 311, 'Pour'], [135, 137, 311, ':'], [141, 160, 311, '|'], [221, 290, 311, 'Détachement'], [293, 306, 311, 'de'],
    [311, 340, 311, 'terrains'], [345, 347, 311, '|'], [351, 410, 311, 'Destination'], [414, 416, 311, ':'], [420, 470, 311, 'Habitation'],
  );
  const [row] = readDematdocNotice(document, { city: lillers, file: { board: 'filings', title: '' } });
  assert.equal(row.address, '12 rue de | Église', 'the misread « l\' » stays, and so does the rest of the street');
  assert.equal(row.purpose, 'Détachement de terrains');
});

test('the works of a justified line keep their words, however wide OCR spaces them (Bauvin)', () => {
  const bauvin = { insee: '59052', postcode: '59221' };
  const document = words(
    [289, 359, 801, 'ANNULATION'], [364, 396, 801, 'D’UNE'], [401, 478, 801, 'DECLARATION'], [482, 545, 801, 'PREALABLE'],
    [419, 527, 728, 'N° DP 059 052 26 00040'],
    [39, 61, 486, 'Pour'], [64, 66, 486, ':'], [189, 227, 486, 'Travaux'], [272, 288, 486, 'sur'], [332, 392, 486, 'construction'],
    [39, 55, 440, 'Sur'], [58, 68, 440, 'un'], [72, 100, 440, 'terrain'], [103, 115, 440, 'sis'], [118, 120, 440, ':'],
    [189, 218, 440, '04Bis,'], [222, 240, 440, 'Rue'], [243, 268, 440, 'Exemple'],
    [27, 59, 224, 'Article'], [63, 95, 224, 'unique'], [99, 99, 224, ':'], [104, 114, 224, 'La'], [117, 165, 224, 'déclaration'], [271, 309, 224, 'annulée.'],
  );
  const [row] = readDematdocNotice(document, { city: bauvin, file: { board: 'decisions', title: '' } });
  assert.equal(row.purpose, 'Travaux sur construction');
  // A single wide gap is still a second column.
  const two = words(...document.pages[0].runs.filter((r) => r.y !== 486).map((r) => [r.x, r.x1, r.y, r.text]),
    [39, 61, 486, 'Pour'], [64, 66, 486, ':'], [189, 227, 486, 'Clôture'], [232, 240, 486, 'en'], [244, 270, 486, 'bois'],
    [330, 380, 486, 'Destination'], [384, 386, 486, ':'], [390, 440, 486, 'Habitation']);
  assert.equal(readDematdocNotice(two, { city: bauvin, file: { board: 'decisions', title: '' } })[0].purpose, 'Clôture en bois');
});
