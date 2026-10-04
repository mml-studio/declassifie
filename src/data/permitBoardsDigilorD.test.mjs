import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIGILOR_D_BOARD_READERS, grandQuevillyDossier, readAlsaceList, readChatelAct, readGrandQuevillyOrder, longevilleNumber, readCrehangeRegister, readJarvilleAct, readLattesOrder, readEnneryOrder, readLongevilleAct, readMorhangeOrder, readNilvangeList,
  frameTitleNumber, readArgancyReceipt, readBussangNotice, readFrameAct, readPlessisBouchardList, readPlessisOrder, readPlessisReceipt, readSaulcyReceipt,
} from './permitBoardsDigilorD.js';
import { readScannedNotice } from './permitBoardsDigilorC.js';
import { DIGILOR_TOWNS } from './digilorTowns.js';
import { DIGILOR_TOWNS_D } from './digilorTownsD.js';
import { BOARD_READERS } from './permitBoards.js';
import { PERMIT_LIST_READERS, digilorDocuments, permitListFor } from './permitListsFeed.js';

const town = (key) => DIGILOR_TOWNS.find((item) => item.key === key);
/** OCR words, one run each, as `ocrTsvPage` gives them. */
const words = (text, x, y) => text.split(' ').map((word, at) => ({ text: word, x: x + at * 30, x1: x + at * 30 + 26, y, size: 7 }));
const PRIVATE = /PRIVATE|PERSON|Privée/;
const doc = (id, cat, sub, title, day = '2026-07-20', numero = '') => ({ id, id_cat: cat, id_sscat: sub, nom_affichage: title, aff_deb: day, numero, url_uiid: `./upload/x/${id}.pdf` });
const picked = (key, docs) => digilorDocuments(town(key), docs, '2026-07-01')
  .map((file) => [file.url.replace(/^.*%2F/, ''), file.board, file.layout]).sort();

test('every batch D town is a Digilor town of the permit registry, its layouts known to a reader', () => {
  assert.ok(DIGILOR_TOWNS_D.length > 0);
  for (const { key } of DIGILOR_TOWNS_D) {
    assert.equal(permitListFor(town(key).insee), town(key), key);
    assert.equal(town(key).source.kind, 'digilor');
    assert.match(town(key).page, new RegExp(`/documents/${town(key).source.app}$`));
    for (const shelf of town(key).source.shelves) {
      assert.ok(BOARD_READERS[shelf.layout] ?? PERMIT_LIST_READERS[shelf.layout], `${key} ${shelf.layout}`);
    }
  }
  for (const [layout, reader] of Object.entries(DIGILOR_D_BOARD_READERS)) {
    assert.match(layout, /^digilor-[a-z-]+-[a-z]+$/);
    assert.equal(BOARD_READERS[layout], reader);
  }
});

test('Le Grand-Quevilly’s permit shelves are read, its signs, public works and plans left out', () => {
  assert.deepEqual(picked('digilor-le-grand-quevilly', [
    doc(1, 1700, 1891, 'DP 26 G 0085'), doc(2, 1700, 1946, 'PC 23 G 0052 M01'), doc(3, 1700, 1948, 'PD 26 G 0004'),
    doc(4, 1700, 1949, 'AP 26 G 0005'), doc(5, 1700, 1947, 'AT 26 G 0002'), doc(6, 1700, 1893, 'PLU - ARRETE PRIVATE 26.402'),
    doc(7, 1700, 1891, 'DP 26 G 0042', '2026-06-30'),
  ]), [
    ['1.pdf', 'decisions', 'digilor-grandquevilly-order'], ['2.pdf', 'decisions', 'digilor-grandquevilly-order'],
    ['3.pdf', 'decisions', 'digilor-grandquevilly-order'],
  ]);
});

test('Le Grand-Quevilly’s short numbers become the ones Sitadel joins', () => {
  const city = town('digilor-le-grand-quevilly');
  assert.equal(grandQuevillyDossier('DP 26 G 0085', city), 'DP 076322 26 G0085');
  assert.equal(grandQuevillyDossier('PC 26 G0025', city), 'PC 076322 26 G0025');
  assert.equal(grandQuevillyDossier('DP 25 G 142', city), 'DP 076322 25 G0142');
  assert.equal(grandQuevillyDossier('PC 23 G 0052 M01', city), 'PC 076322 23 G0052 M01');
  assert.equal(grandQuevillyDossier('PLU - ARRETE PRIVATE 26.402', city), null);
});

/** The order's frame as OCR reads it: the street above a garbled label, the town and a parcel under it. */
const ORDER = (label = 'Sur un terrain sis à :', article = 'ARTICLE 1 : Il n’est pas fait opposition à la déclaration préalable') => ({ pages: [{ runs: [
  ...words('DECISION DE NON OPPOSITION', 275, 654),
  ...words('Demande déposée le 27/05/2026', 23, 564), ...words('N° DP 76322 26 G0085', 400, 564),
  ...words('Par: PRIVATE PERSON', 121, 528), ...words('1 rue Privée', 148, 516), ...words('Demeurant à : 76120 Grand Quevilly', 80, 505),
  ...words('Pour: Réfection de toiture et des', 115, 470), ...words('constructions annexes', 148, 459),
  ...words('16 Rue Exemple', 150, 437), ...words(label, 46, 426), ...words('Villa Exemple', 150, 426),
  ...words('76120 Grand Quevilly', 150, 418), ...words('AY 137', 150, 413),
  ...words('Le Maire,', 43, 388), ...words(article, 43, 189),
] }] });

test('Le Grand-Quevilly’s scanned order gives its number, site, parcel, filing day and verdict — never the applicant', () => {
  const city = town('digilor-le-grand-quevilly');
  const file = { board: 'decisions', title: 'DP 26 G 0085', published: '2026-08-04' };
  const [row] = readGrandQuevillyOrder(ORDER(), { city, file });
  assert.deepEqual(row, {
    board: 'decisions', dossier: 'DP 076322 26 G0085', applicant: null, address: '16 Rue Exemple', postcode: '76120',
    parcels: 'AY 137', filedOn: '2026-05-27', verdict: 'Non-opposition', decidedOn: null, postedOn: '2026-08-04',
  });
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // OCR garbles the label (« Sucunierran sise »); an article with no readable verdict leaves the heading's.
  const [garbled] = readGrandQuevillyOrder(ORDER('Sucunierran sise', 'ARTICLE 1 : voir annexe'), { city, file: { ...file, title: '' } });
  assert.equal(garbled.dossier, 'DP 076322 26 G0085');
  assert.equal(garbled.address, '16 Rue Exemple');
  assert.equal(garbled.verdict, 'Non-opposition');
  // No label, no site: no row.
  assert.deepEqual(readGrandQuevillyOrder({ pages: [{ runs: words('N° DP 76322 26 G0085', 400, 564) }] }, { city, file }), []);
});

test('Le Plessis-Trévise’s receipts and orders are read with the number typed in their record; other shelves keep their titles', () => {
  const files = digilorDocuments(town('digilor-le-plessis-trevise'), [
    doc(1, 3957, 6259, '24 avenue Exemple', '2026-09-30', 'PC 0940592601016'), doc(2, 3957, 6221, '68 avenue Exemple', '2026-10-01', 'DP0940592604078'),
    doc(3, 3957, 6144, '20 place Exemple', '2026-09-23', 'DP0940592601011'), doc(4, 3957, 6221, '35 avenue Exemple', '2026-07-15'),
    doc(5, 3957, 6196, 'Arrêté 2026-163 - Changement d’usage au 56 avenue Exemple', '2026-07-06', '2026-163'),
    doc(6, 3957, 6469, 'Arrêté d’alignement 2 rue Exemple', '2026-07-06', '2026-170'),
  ], '2026-07-01').map((file) => [file.url.replace(/^.*%2F/, ''), file.board, file.layout, file.title]).sort();
  assert.deepEqual(files, [
    ['1.pdf', 'filings', 'digilor-plessis-receipt', 'PC 0940592601016 24 avenue Exemple'],
    ['2.pdf', 'decisions', 'digilor-plessis-order', 'DP0940592604078 68 avenue Exemple'],
    ['3.pdf', 'decisions', 'digilor-plessis-order', 'DP0940592601011 20 place Exemple'],
    ['4.pdf', 'decisions', 'digilor-plessis-order', '35 avenue Exemple'],
  ]);
  // A shelf without `numbered` keeps its title as typed, whatever the record's `numero`.
  const [plain] = digilorDocuments(town('digilor-le-grand-quevilly'), [doc(1, 1700, 1891, 'DP 26 G 0085', '2026-07-20', 'X123')], '2026-07-01');
  assert.equal(plain.title, 'DP 26 G 0085');
});

test('Le Plessis-Trévise’s receipt gives the number and site of its title and the day it states', () => {
  const city = town('digilor-le-plessis-trevise');
  const receipt = { pages: [{ runs: [
    ...words('Récépissé de dépôt d’un Permis de Construire', 200, 790), ...words('Madame, Monsieur,', 20, 770),
    ...words('n°PC0940592601016,', 20, 300), ...words('Accusé d’enregistrement électronique : 28/09/2026', 300, 290),
    ...words('réalisée par : PRIVATE PERSON,', 20, 280), ...words('le : 28/09/2026.', 20, 260),
  ] }] };
  const file = { board: 'filings', title: 'PC 0940592601016 24 avenue Exemple', published: '2026-09-30' };
  assert.deepEqual(readPlessisReceipt(receipt, { city, file }), [{
    board: 'filings', dossier: 'PC 094059 26 01016', applicant: null, address: '24 avenue Exemple', postcode: '94420', parcels: null,
    postedOn: '2026-09-30', verdict: null, filedOn: '2026-09-28',
  }]);
  // A record left without a number: no row, whatever the title names.
  assert.deepEqual(readPlessisReceipt(receipt, { city, file: { ...file, title: 'ARE PCMI PRIVATE PERSON 20 Place Exemple' } }), []);
});

test('Le Plessis-Trévise’s scanned order trusts the number OCR glues to a rule over the record’s — never the applicant', () => {
  const city = town('digilor-le-plessis-trevise');
  const order = { pages: [{ runs: [
    ...words('Val de Marne PERMIS DE CONSTRUIRE', 49, 701), ...words('DESCRIPTION DE LA DEMANDE', 100, 651),
    ...words('Déposée le : 16/07/2026 Complétée le : 17/09/2026 _PC0940592601011', 117, 615),
    ...words('Par : PRIVATE PERSON', 152, 579), ...words('Demeurant à : 1 rue Privée 94420 LE PLESSIS TREVISE', 115, 566),
    ...words('Pour : Surélever un pavillon', 147, 541),
    ...words('Sur un terrain sis : 20 place Exemple 94420 LE PLESSIS TREVISE', 97, 504),
    ...words('LE MAIRE :', 87, 468), ...words('ARRETE', 295, 193),
    ...words('Article 1 : Le permis de construire est ACCORDE', 87, 160), ...words('Fait à Le Plessis-Trévise, le 22/09/2026', 87, 120),
  ] }] };
  const [row] = readPlessisOrder(order, { city, file: { board: 'decisions', title: 'DP0940592601011 20 place Exemple', published: '2026-09-23' } });
  assert.equal(row.dossier, 'PC 094059 26 01011');
  assert.equal(row.address, '20 place Exemple');
  assert.equal(row.filedOn, '2026-07-16');
  assert.equal(row.applicant, null);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // A scrap of text layer and no frame: no row, for the sweep's OCR to read the scan.
  assert.deepEqual(readPlessisOrder({ pages: [{ runs: [...words('DESCRIPTION DE DEMANDE dossier:', 100, 651), ...words('Document publié le 23/09/2026', 200, 20)] }] },
    { city, file: { board: 'decisions', title: 'DP0940592601011 20 place Exemple', published: '2026-09-23' } }), []);
});

test('Lattes’s permit orders are picked by the number in their title, its lists, signs, public works and shops left out', () => {
  assert.deepEqual(picked('digilor-lattes', [
    doc(1, 2692, 0, 'arr20261720_non_opposition_DP_341292600186'), doc(2, 2692, 3478, 'ARR PC3412926-0031'),
    doc(3, 2692, 3478, 'arr20261758_Autorisation_DP34129_2600176M01'), doc(4, 2692, 0, 'SEMAINE 38 DEPOTS DP - AT'),
    doc(5, 2692, 0, 'arr20261719_Autorisation_AT34129_26_00018'), doc(6, 2692, 0, 'AUTORISATION POSE ENSEIGNE AP34129 26-21'),
    doc(7, 2692, 3478, 'Arr20261534 Arrêté de poursuite d’exploitation EXEMPLE'), doc(8, 2692, 3477, 'DEPÔTS SEMAINE 39 DECLARATIONS PREALABLES'),
    doc(9, 2691, 0, 'Del2026_001 PC 34129 exemple'),
  ]), [
    ['1.pdf', 'decisions', 'digilor-lattes-order'], ['2.pdf', 'decisions', 'digilor-lattes-order'], ['3.pdf', 'decisions', 'digilor-lattes-order'],
  ]);
});

/** Lattes's frame as OCR reads it: the dotted rule as `!`, `|` or `}` between label and value. */
const LATTES = (site = 'Sur un terrain sis ! 17 Impasse Exemple 34970 Lattes', signed = 'LATTES, le 28/09/2026') => ({ pages: [{ runs: [
  ...words('ACCORD DE PERMIS DE CONSTRUIRE', 246, 761), ...words('DESCRIPTION DE LA DEMANDE', 129, 724),
  ...words('Déposée le 30/07/2026 } Complétée le 27/08/2026 N° PC 34129 23 M0050', 80, 711),
  ...words('Par ! PRIVATE PERSON', 185, 679), ...words('Demeurant à ! 7 Rue Privée 34750 Ailleurs', 147, 646),
  ...words('Pour | Extension de la maison', 180, 607), ...words(site, 130, 548), ...words('Parcelle | EB0214', 166, 525),
  ...words('Le Maire,', 78, 483), ...words('ARRETE', 264, 367), ...words('ARTICLE UNIQUE : Le permis de construire est ACCORDE', 79, 344),
  ...words(signed, 365, 283),
] }] });

test('Lattes’s scanned order gives the frame’s number with the title’s change, a mended site, its parcel — never the applicant', () => {
  const city = town('digilor-lattes');
  const file = { board: 'decisions', title: 'arr20261133_Autorisation_PC34129_23M0050M02', published: '2026-10-01' };
  const [row] = readLattesOrder(LATTES(), { city, file });
  assert.equal(row.dossier, 'PC 034129 23 M0050 M02');
  assert.equal(row.address, '17 Impasse Exemple');
  assert.equal(row.parcels, 'EB 214');
  assert.equal(row.filedOn, '2026-07-30');
  assert.equal(row.decidedOn, '2026-09-28');
  assert.equal(row.applicant, null);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // A title naming another counter adds nothing; the rule read as `1` goes, OCR's year 2028 is no day.
  const [other] = readLattesOrder(LATTES('Sur un terrain sis 1 16 rue Exemple', 'LATTES, le 01/09/2028'), { city, file: { ...file, title: 'ARR PC34129 23-0051M01' } });
  assert.equal(other.dossier, 'PC 034129 23 M0050');
  assert.equal(other.address, '16 rue Exemple');
  assert.equal(other.decidedOn, null);
});

test('Xertigny’s DP and PC orders are read, its certificates and other notices left out', () => {
  assert.deepEqual(picked('digilor-xertigny', [
    doc(1, 5465, 9117, 'DP 0885302600039'), doc(2, 5465, 9117, 'dp31'), doc(3, 5465, 9115, 'PC 0885302600007'),
    doc(4, 5465, 9114, 'DP 0885302600024'), doc(5, 5465, 9114, 'CU 0885302600054'), doc(6, 5465, 9114, 'CUa 0885302600040'),
    doc(7, 5465, 0, 'Arrêté d’alignement individuel'), doc(8, 5390, 8958, 'DP 0885302600039'),
  ]), [1, 2, 3, 4].map((id) => [`${id}.pdf`, 'decisions', 'digilor-amneville-notice']));
});

test('Basse-Ham’s avis de dépôt are read as filings, its municipal orders left out', () => {
  assert.deepEqual(picked('digilor-basse-ham', [
    doc(1, 6472, 11555, '6 rue Exemple', '2026-09-30', 'DP572872600073'), doc(2, 6493, 0, 'Arrêté municipal 2026-12'),
  ]), [['1.pdf', 'filings', 'extended-notice']]);
});

test('Châtel-Saint-Germain’s notices are filings and its orders decisions, by their titles', () => {
  assert.deepEqual(picked('digilor-chatel-saint-germain', [
    doc(1, 3289, 4782, 'DP 057 134 26 00037 AVIS DE DEPOT'), doc(2, 3289, 4782, 'DP 057 134 26 00018 ARRETE'),
    doc(3, 3289, 4776, 'PC 057 134 26 00003 ARRETE'), doc(4, 3289, 4782, 'DP 057 134 23 Y0054 M01 ARRETE TACITE OPPOSITION'),
    doc(5, 3289, 0, 'Approbation de la modification simplifiée n°3 du PLU'), doc(6, 3289, 11612, '20260921_Bureau_DELIB'),
  ]), [
    ['1.pdf', 'filings', 'digilor-chatel-act'], ['2.pdf', 'decisions', 'digilor-chatel-act'],
    ['3.pdf', 'decisions', 'digilor-chatel-act'], ['4.pdf', 'decisions', 'digilor-chatel-act'],
  ]);
});

test('Châtel-Saint-Germain’s scanned notice gives its number, filing day and site without the town — never the applicant', () => {
  const city = town('digilor-chatel-saint-germain');
  const notice = { pages: [{ runs: [
    ...words('MAIRIE DE CHATEL SAINT GERMAIN', 132, 649), ...words('AVIS DE DEPOT', 246, 559), ...words('Déclaration Préalable', 215, 541),
    ...words('Date du dépôt : 28/09/2026', 115, 500), ...words('Demandeur : PRIVATE PERSON', 115, 486),
    ...words('Adresse du terrain: 22 Rue Exemple à CHATEL-SAINT-GERMAIN ()', 114, 458), ...words('Superficie du terrain: 509 m²', 114, 429),
    ...words('Nature des Travaux : Aménagement du terrain', 115, 399),
    ...words('Ce dossier a été enregistré par les services de la commune sous le numéro :', 114, 270), ...words('DP 057 134 26 00037', 251, 243),
  ] }] };
  const [row] = readChatelAct(notice, { city, file: { board: 'filings', title: 'DP 057 134 26 00037 AVIS DE DEPOT', published: '2026-09-28' } });
  assert.equal(row.dossier, 'DP 057134 26 00037');
  assert.equal(row.address, '22 Rue Exemple');
  assert.equal(row.filedOn, '2026-09-28');
  assert.equal(row.applicant, null);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // A modification's notice prints the original's number; its title names the change.
  const [change] = readChatelAct(notice, { city, file: { board: 'filings', title: 'DP 057 134 26 00037 M01 AVIS DE DEPOT', published: '2026-09-28' } });
  assert.equal(change.dossier, 'DP 057134 26 00037 M01');
});

test('Jarville-la-Malgrange’s notices are filings and its orders decisions, the shelf deciding when the title does not', () => {
  assert.deepEqual(picked('digilor-jarville-la-malgrange', [
    doc(1, 2956, 4002, 'Avis de dépôt DP 054 274 26 00088 - PRIVATE PERSON'), doc(2, 2956, 4002, 'Avis de dépôt 054 274 26 00071 - PRIVATE PERSON'),
    doc(3, 2956, 4004, 'Arrêté DP 054 274 26 00075 - PRIVATE PERSON'), doc(4, 2956, 4004, 'DP 054 274 26 00091 - PRIVATE PERSON'),
    doc(5, 2956, 4004, 'Avis de dépôt DP n° 054 274 26 00093 - PRIVATE PERSON'), doc(6, 2956, 4000, 'PC 054 274 26 00004 - Métropole du Grand Nancy'),
    doc(7, 2956, 4001, 'Arrêté PD 26 00001 - PRIVATE PERSON', '2026-07-05'), doc(8, 2956, 8282, 'Coupure de courant ENEDIS pour Travaux'),
    doc(9, 2803, 3991, 'Arrêté temporaire N° 289 - Stationnement'),
  ]), [
    ['1.pdf', 'filings', 'digilor-jarville-act'], ['2.pdf', 'filings', 'digilor-jarville-act'], ['3.pdf', 'decisions', 'digilor-jarville-act'],
    ['4.pdf', 'decisions', 'digilor-jarville-act'], ['5.pdf', 'filings', 'digilor-jarville-act'], ['6.pdf', 'decisions', 'digilor-jarville-act'],
    ['7.pdf', 'decisions', 'digilor-jarville-act'],
  ]);
});

/** The town's avis de dépôt as OCR reads it: the applicant over the number, filing day, site and works, the mayor's signature to the right. */
const JARVILLE_NOTICE = (kind = 'Déclaration Préalable') => ({ pages: [{ runs: [
  ...words('Jarville-la-Malgrange, le 14 septembre 2026', 334, 641), ...words(`Objet : Avis de dépôt - ${kind}`, 199, 586),
  ...words('Nom du demandeur : PRIVATE PERSON', 200, 524), ...words('N° Enregistrement : 054 274 26 00085', 199, 499),
  ...words('Date d’enregistrement : 14/09/2026', 199, 473), ...words('Adresse exacte du terrain : 17 RUE EXEMPLE', 199, 450),
  ...words('Surface taxable créée : 0 m²', 199, 425), ...words('Destination : REMPLACEMENT D’UNE FENETRE', 199, 401),
  ...words('ET SON VOLET', 199, 390), ...words('PRIVATE SIGNATORY', 392, 374), ...words('le Maire', 392, 343),
  ...words('Cet avis doit être affiché dans les 15 jours', 199, 280),
] }] });

test('Jarville-la-Malgrange’s notice gives its number, filing day, site and works — never the applicant', () => {
  const city = town('digilor-jarville-la-malgrange');
  const file = { board: 'filings', title: 'Avis de dépôt DP 054 274 26 00085 - PRIVATE PERSON', published: '2026-09-21' };
  const [row] = readJarvilleAct(JARVILLE_NOTICE(), { city, file });
  assert.deepEqual(row, {
    board: 'filings', dossier: 'DP 054274 26 00085', applicant: null, address: '17 RUE EXEMPLE', postcode: '54140', parcels: null,
    purpose: 'REMPLACEMENT D’UNE FENETRE ET SON VOLET', filedOn: '2026-09-14', postedOn: '2026-09-21', verdict: null,
  });
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // A title that lost its kind (« Avis de dépôt 054 274 26 00071 - … ») takes it from « Objet ».
  const [untitled] = readJarvilleAct(JARVILLE_NOTICE('Permis de construire'), { city, file: { ...file, title: 'Avis de dépôt 054 274 26 00085 - PRIVATE PERSON' } });
  assert.equal(untitled.dossier, 'PC 054274 26 00085');
  const [declaration] = readJarvilleAct(JARVILLE_NOTICE(), { city, file: { ...file, title: 'Avis de dépôt 054 274 26 00085 - PRIVATE PERSON' } });
  assert.equal(declaration.dossier, 'DP 054274 26 00085');
  // No site, no row.
  assert.deepEqual(readJarvilleAct({ pages: [{ runs: words('Objet : Avis de dépôt - Déclaration Préalable', 199, 586) }] }, { city, file }), []);
});

test('Jarville-la-Malgrange’s order is read the State’s way, its number from the title the frame lacks', () => {
  const city = town('digilor-jarville-la-malgrange');
  const order = { pages: [{ runs: [
    ...words('DECISION DE NON-OPPOSITION A UNE', 79, 785), ...words('DECLARATION PREALABLE', 312, 768),
    ...words('Demande déposée le : 31/08/2026', 51, 716), ...words('Par: PRIVATE PERSON', 125, 696), ...words('Objet: La pose d’une isolation', 116, 659),
    ...words('Sur un terrain sis à : 27 Avenue Exemple', 56, 637), ...words('54140 JARVILLE-LA-MALGRANGE', 152, 625), ...words('274 AB 309', 152, 614),
    ...words('LE MAIRE AU NOM DE LA COMMUNE,', 46, 589), ...words('ARRETE', 271, 367),
    ...words('ARTICLE 1 : Il n’est pas fait opposition à la déclaration préalable.', 44, 333),
    ...words('2026.09.28 12:23:38 +0200', 416, 198),
  ] }] };
  const [row] = readJarvilleAct(order, { city, file: { board: 'decisions', title: 'Arrêté DP 054 274 26 00075 - PRIVATE PERSON', published: '2026-10-01' } });
  assert.equal(row.dossier, 'DP 054274 26 00075');
  assert.equal(row.address, '27 Avenue Exemple');
  assert.equal(row.verdict, 'Non-opposition');
  assert.equal(row.filedOn, '2026-08-31');
  // The electronic signature's stamp is the day it was signed, unless it falls outside the filing and posting days.
  assert.equal(row.decidedOn, '2026-09-28');
  const [late] = readJarvilleAct(order, { city, file: { board: 'decisions', title: 'Arrêté DP 054 274 26 00075 - PRIVATE PERSON', published: '2026-09-20' } });
  assert.equal(late.decidedOn, null);
  assert.equal(row.applicant, null);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // A letter with no frame (a rejection for an incomplete file) gives no row.
  assert.deepEqual(readJarvilleAct({ pages: [{ runs: words('OBJET : DOSSIER REJETE POUR INCOMPLETUDE', 62, 561) }] },
    { city, file: { board: 'decisions', title: 'REJET DP 054 274 26 00042 - PRIVATE PERSON', published: '2026-09-21' } }), []);
});

test('Souffelweyersheim’s sub-category gives its two weekly lists, the SAFER decisions beside it left out', () => {
  assert.deepEqual(picked('digilor-souffelweyersheim', [
    doc(1, 2676, 3567, 'AFFICHAGE DEPOTS COM021026'), doc(2, 2676, 3567, 'AFFICHAGE DECISIONS COM021026'),
    doc(3, 2676, 3567, 'AFFICHAGE DEPOTS 07 08 2026'), doc(4, 2676, 0, 'SAFER - Décision de rétrocession - Section 11'),
    doc(5, 2685, 4541, 'Arrêté 134.2026 portant réglementation de la circulation'),
  ]), [
    ['1.pdf', 'filings', 'digilor-alsace-list'], ['2.pdf', 'decisions', 'digilor-alsace-list'], ['3.pdf', 'filings', 'digilor-alsace-list'],
  ]);
});

/** A text run, as `extractPdfText` gives it. */
const run = (text, x, y, size = 8) => ({ text, x, x1: x + text.length * 4, y, size });

test('the Alsace weekly list of filings is read whatever Excel did to its header, the applicants never kept', () => {
  const city = town('digilor-souffelweyersheim');
  // Reichstett and La Wantzenau: « SURFACE DE » in one cell, « N° Dossier » centred over numbers that start near the date.
  const header = [
    run('NATURE ET', 507, 460), run('DATE', 28, 455), run('NOMBRE', 599, 455), run('SURFACE DE', 638, 455), run('Date de début', 698, 455), run('Date de fin', 769, 455),
    run('N° Dossier', 111, 450), run('DEMANDEUR(S)', 240, 450), run('ADRESSE DU TERRAIN', 358, 450), run('DESTINATION', 502, 450),
    run('DE DEPOT', 19, 445), run('LOGTS', 603, 445), run('PLANCHERS', 639, 445), run('d’affichage', 704, 445), run('d’affichage', 769, 445), run('DES TRAVAUX', 502, 440),
  ];
  const rows = readAlsaceList({ pages: [{ runs: [
    ...header,
    run('PRIVATE PERSON', 198, 432), run('2 rue Exemple', 344, 423), run('Projet de construction', 462, 423),
    run('30/09/2026', 19, 418), run('PC 67471 26 V0002 T01', 64, 418), run('0', 614, 418), run('m²', 659, 418), run('30/09/2026', 703, 418), run('30/11/2026', 769, 418),
    run('67460 SOUFFELWEYERSHEIM', 344, 413), run('d’une maison individuelle.', 462, 413),
    run('SCI EXEMPLE', 198, 395), run('31 Rue Exemple', 344, 386),
    run('28/09/2026', 19, 381), run('DP 67471 26 V0037', 64, 381), run('la rénovation', 462, 381), run('0', 614, 381), run('m²', 659, 381), run('30/09/2026', 703, 381),
    run('67460 SOUFFELWEYERSHEIM', 344, 376),
  ] }] }, { city, file: { board: 'filings', published: '2026-10-01' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.postedOn, row.applicant]), [
    ['PC 067471 26 V0002 T01', '2 rue Exemple', '2026-09-30', '2026-09-30', null],
    ['DP 067471 26 V0037', '31 Rue Exemple', '2026-09-28', '2026-09-30', 'SCI EXEMPLE'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), PRIVATE);
});

test('an Alsace list’s applicant that starts with a number is the street the row above left it, not a name', () => {
  const city = town('digilor-souffelweyersheim');
  const rows = readAlsaceList({ pages: [{ runs: [
    run('DATE', 166, 511), run('NATURE ET DESTINATION', 571, 511), run('DEBUT', 747, 511), run('FIN', 825, 511),
    run('N° Dossier', 62, 506), run('BENEFICIAIRE', 253, 506), run('ADRESSE DU TERRAIN', 395, 506),
    run('D’ARRETE', 155, 500), run('DES TRAVAUX', 598, 500), run('D’AFFICHAGE', 732, 500), run('D’AFFICHAGE', 802, 500),
    run('18 rue de la Ville', 210, 464), run('04/08/2026', 155, 476), run('18 rue de la Ville', 362, 470),
    run('DP 67471 26 V0061', 23, 464), run('favorable', 160, 453), run('la pose d’un châssis de toit', 531, 464), run('07/08/2026', 739, 464),
    run('67460 SOUFFELWEYERSHEIM', 362, 459),
    run('SCI EXEMPLE', 210, 400), run('05/08/2026', 155, 412), run('9 rue Exemple', 362, 406),
    run('DP 67471 26 V0031', 23, 400), run('vente des lots', 160, 389), run('la pose d’un portail', 531, 400), run('07/08/2026', 739, 400),
    run('67460 SOUFFELWEYERSHEIM', 362, 395),
    run('06/08/2026', 155, 350), run('3 rue Exemple', 362, 344),
    run('DP 67471 26 V0032', 23, 338), run('favorable avec prescriptions favorable avec prescriptions', 130, 327), run('la pose d’un abri', 531, 338), run('07/08/2026', 739, 338),
    run('67460 SOUFFELWEYERSHEIM', 362, 333),
  ] }] }, { city, file: { board: 'decisions', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.applicant, row.verdict]), [
    ['DP 067471 26 V0061', '18 rue de la Ville', null, 'Accord'],
    ['DP 067471 26 V0031', '9 rue Exemple', 'SCI EXEMPLE', 'Décision signée'],
    ['DP 067471 26 V0032', '3 rue Exemple', null, 'Favorable avec prescriptions'],
  ]);
});

test('La Wantzenau’s two sub-categories decide the board, whatever the title’s typing', () => {
  assert.deepEqual(picked('digilor-la-wantzenau', [
    doc(1, 6478, 11536, 'DEPOT  01-10-2026'), doc(2, 6478, 11535, 'DECISIONS 01-10-2026'),
    doc(3, 6478, 11536, 'dépôts 20260909'), doc(4, 6478, 11535, 'AFFICHAGE DECISIONS 082026'), doc(5, 6482, 11540, 'Arrêté de circulation'),
  ]), [
    ['1.pdf', 'filings', 'digilor-alsace-list'], ['2.pdf', 'decisions', 'digilor-alsace-list'],
    ['3.pdf', 'filings', 'digilor-alsace-list'], ['4.pdf', 'decisions', 'digilor-alsace-list'],
  ]);
});

test('Oberhausbergen’s two sub-categories give its lists, the other documents of « Urbanisme » left out', () => {
  assert.deepEqual(picked('digilor-oberhausbergen', [
    doc(1, 4622, 7431, '2026-10-01_Affichage Dépôts'), doc(2, 4622, 7405, '2026-10-01_Affichage Décisions'),
    doc(3, 4622, 0, 'Avis d’enquête publique'), doc(4, 4630, 7500, 'Arrêté de circulation'),
  ]), [['1.pdf', 'filings', 'digilor-alsace-list'], ['2.pdf', 'decisions', 'digilor-alsace-list']]);
});

test('Reichstett’s lists are told by their titles, the notices and orders beside them left out', () => {
  assert.deepEqual(picked('digilor-reichstett', [
    doc(1, 4326, 0, 'AFFICHAGE DES DEPOTS AU 28/09/2026'), doc(2, 4326, 0, 'AFFICHAGE DES DECISIONS AU 28/09/2026'),
    doc(3, 4326, 0, 'AFFICHAGE DES DECISIONS DU 02/07/2026'), doc(4, 4326, 0, 'Avis de dépôt de permis de construire'),
    doc(5, 4325, 6838, 'Arrêté permanent'),
  ]), [
    ['1.pdf', 'filings', 'digilor-alsace-list'], ['2.pdf', 'decisions', 'digilor-alsace-list'], ['3.pdf', 'decisions', 'digilor-alsace-list'],
  ]);
});

test('Nilvange’s weekly tables are picked on their title, whatever else « Urbanisme » holds', () => {
  assert.deepEqual(picked('digilor-nilvange', [
    doc(1, 2701, 3503, 'Tableau 21092026 au 27092026'), doc(2, 2701, 3503, 'Tableau 14092026 au 20092026'),
    doc(3, 2701, 3925, 'Tableau 17032025 au 23032025'), doc(4, 2701, 3503, 'Arrêté d’alignement'), doc(5, 2700, 3499, 'ARRETE 2026-261'),
  ]), [['1.pdf', 'filings', 'digilor-nilvange-list'], ['2.pdf', 'filings', 'digilor-nilvange-list']]);
});

test('Nilvange’s table gives its demands and its decisions as the two sections say, the applicants never kept', () => {
  const city = town('digilor-nilvange');
  const header = (y, last) => [
    run('Type de', 40, y + 7), run('Surface', 598, y + 7), run('Hauteur', 641, y + 7),
    run('Numéro', 139, y), run('Demandeur', 232, y), run('Adresse travaux', 330, y), run('Nature des travaux', 470, y), ...last,
    run('demande', 36, y - 7), run('(en m²)', 599, y - 7), run('(en m)', 645, y - 7),
  ];
  const { pages } = { pages: [
    { runs: [
      run('DEMANDES D’AUTORISATION D’URBANISME', 227, 490), run('Période : 21/09/2026 au 27/09/2026', 276, 442),
      ...header(389, [run('Déposé le', 690, 389)]),
      run('Déclaration', 32, 354), run('DP 57 508 2600086', 114, 346), run('PRIVATE PERSON', 215, 346), run('87 Rue Exemple', 328, 346),
      run('ITE et installation d’une clim', 452, 346), run('-/-', 611, 346), run('-/-', 655, 346), run('25/09/2026', 686, 346), run('préalable', 37, 339),
      run('Permis de', 36, 303), run('PD 57 508 2600007', 114, 295), run('SCI EXEMPLE', 215, 295), run('33 Rue Exemple', 321, 295),
      run('Démolition partielle', 470, 295), run('-/-', 611, 295), run('-/-', 655, 295), run('24/09/2026', 686, 295), run('démolir', 41, 288),
      run('PC 57 508 2600007', 114, 250), run('COMMUNE DE', 215, 256), run('NILVANGE', 225, 244), run('14 Rue Exemple', 321, 250),
      run('Remplacement de portes', 470, 250), run('-/-', 611, 250), run('-/-', 655, 250), run('23/09/2026', 686, 250),
      run('DP 57 508 2600079', 114, 205), run('sci odb sci odb', 215, 205), run('33 rue Exemple', 321, 205),
      run('ravalement', 470, 205), run('-/-', 611, 205), run('-/-', 655, 205), run('22/09/2026', 686, 205),
      run('Pour tout renseignement, veuillez-vous adresser', 402, 170), run('Affiché du 30/09/2026 au 30/11/2026', 78, 150),
    ] },
    { runs: [
      run('DECISIONS D’URBANISME', 291, 481), run('Période : 21/09/2026 au 27/09/2026', 282, 433),
      ...header(379, [run('Délivré le', 686, 379), run('Décision', 755, 379)]),
      run('Déclaration', 32, 342), run('Remplacement d’une clôture avec', 439, 342), run('DP 57 508 2600044', 114, 334), run('PRIVATE PERSON', 221, 334),
      run('33 rue Exemple', 319, 334), run('-/-', 611, 334), run('-/-', 656, 334), run('22/09/2026', 686, 334), run('Rejet Tacite', 748, 334),
      run('préalable', 37, 327), run('ajout d’un portail', 477, 327),
      run('DP 57 508 19V0045', 114, 290), run('SCI EXEMPLE', 215, 290), run('105 rue Exemple', 320, 290), run('Abri de jardin', 470, 290),
      run('15/09/2026', 686, 290), run('Retrait', 748, 290),
      run('Pour tout renseignement, veuillez-vous adresser', 402, 266),
    ] },
  ] };
  const rows = readNilvangeList({ pages }, { city, file: { board: 'filings', published: '2026-09-30' } });
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.filedOn, row.decidedOn, row.verdict, row.applicant]), [
    ['filings', 'DP 057508 26 00086', '87 Rue Exemple', '2026-09-25', null, null, null],
    ['filings', 'PD 057508 26 00007', '33 Rue Exemple', '2026-09-24', null, null, 'SCI EXEMPLE'],
    // A name the column wrapped on a preposition is no name; one typed twice is read once.
    ['filings', 'PC 057508 26 00007', '14 Rue Exemple', '2026-09-23', null, null, null],
    ['filings', 'DP 057508 26 00079', '33 rue Exemple', '2026-09-22', null, null, 'sci odb'],
    ['decisions', 'DP 057508 26 00044', '33 rue Exemple', null, '2026-09-22', 'Rejet Tacite', null],
    ['decisions', 'DP 057508 19 V0045', '105 rue Exemple', null, '2026-09-15', 'Retrait', 'SCI EXEMPLE'],
  ]);
  assert.equal(rows.find((row) => row.dossier === 'DP 057508 26 00044').purpose, 'Remplacement d’une clôture avec ajout d’un portail');
  assert.doesNotMatch(JSON.stringify(rows), PRIVATE);
  // A week with nothing to show.
  assert.deepEqual(readNilvangeList({ pages: [{ runs: [
    run('DEMANDES D’AUTORISATION D’URBANISME', 227, 490), ...header(389, [run('Déposé le', 690, 389)]),
    run('Déclaration', 32, 354), run('-/-', 160, 346), run('-/-', 260, 346), run('-/-', 360, 346), run('-/-', 500, 346), run('-/-', 686, 346),
  ] }] }, { city, file: { board: 'filings' } }), []);
});

test('Créhange’s register is picked on its title, on whatever sub-category it is posted, its orders left out', () => {
  assert.deepEqual(picked('digilor-crehange', [
    doc(1, 2843, 3794, 'DEMANDES D’URBANISME'), doc(2, 2843, 0, 'DEMANDES D’URBANISME', '2026-09-03'), doc(3, 2843, 4344, 'DEMANDES D’URBANISME'),
    doc(4, 2843, 3796, 'Arrêté favorable DP 0571592600048 PRIVATE PERSON'), doc(5, 3322, 4869, 'Arrêté portant fermeture du terrain de football'),
  ]), [
    ['1.pdf', 'filings', 'digilor-crehange-register'], ['2.pdf', 'filings', 'digilor-crehange-register'], ['3.pdf', 'filings', 'digilor-crehange-register'],
  ]);
});

test('Créhange’s register: the site by where its cell sits, a wrapped works with its number, the applicant never read', () => {
  const city = town('digilor-crehange');
  const at = (text, x, y, x1 = x + text.length * 3.6) => ({ text, x, x1, y, size: 7 });
  const rows = readCrehangeRegister({ pages: [{ runs: [
    at('COMMUNE DE CREHANGE', 55, 563), at('URBANISME', 355, 552),
    at('NUMERO DOSSIER', 47, 463), at('NOM - Prénom', 169, 463), at('Adresse demandeur', 282, 463), at('ADRESSE DU TERRAIN', 394, 463),
    at('NATURE DU PROJET', 539, 463), at('DATE DE DEPOT', 676, 463), at('ACCORD', 743, 463),
    // filed 3 September: the applicant's address and the site's printed as one cell, the works short and right-aligned
    at('DP 0571592600061PRIVATE PERSON', 49, 441), at('6 RUE EXEMPLE6 RUE EXEMPLE', 279, 441, 412), at('Pose d’un grillage', 560, 441), at('03/09/2026', 679, 441),
    // filed 6 August: a works wrapped over two lines, the applicant living elsewhere
    at('Fermeture d’un espace sous une', 540, 400), at('DP 0571592600052', 49, 394), at('PRIVATE PERSON', 141, 394), at('1 rue Privée', 311, 394),
    at('15 Rue Exemple', 424, 394), at('06/08/2026', 679, 394), at('terrasse', 640, 388),
    // filed 5 August, accord on 12 August, the day and the decision glued
    at('DP 0571592600051', 49, 365), at('PRIVATE PERSON', 141, 365), at('80 Rue Privée', 304, 365), at('80 Rue Exemple', 417, 365),
    at('Pergola', 641, 365), at('05/08/2026A 12/08/2026', 679, 365),
    // a certificate, an ERP work, a dossier declared inadmissible: no permit decided
    at('CUB 0571592600022PRIVATE PERSON', 49, 340), at('Rue Exemple', 431, 340), at('02/06/2026', 679, 340),
    at('AT 0571592600009', 49, 328), at('1 rue Exemple', 437, 328), at('10/04/2026', 679, 328), at('A 22/06/2026', 738, 328),
    at('DP 0571592600026', 49, 316), at('41 Cours Exemple', 406, 316), at('11/05/2026', 679, 316), at('IRRECEVABLE 20-05-2026', 733, 316),
    // a dossier of last year, no decision on it
    at('DP 0571592500019', 49, 304), at('19 rue Exemple', 429, 304), at('21/05/2025', 684, 304),
    // a refusal marked `R` after a tacit rejection's words, one marked `R` alone, an accord whose year lost a digit
    at('DP 0571592600004', 49, 292), at('38 rue Exemple', 407, 292), at('19/01/2026 Rejet tacite', 679, 292), at('R 26/05/2026', 738, 292),
    at('PC 0571592600002', 49, 280), at('24 route Exemple', 400, 280), at('30/01/2026', 679, 280), at('R 19/05/2026', 738, 280),
    at('DP 0571592600030', 49, 268), at('23 rue Exemple', 428, 268), at('29/05/2026', 679, 268), at('A 15-06-226', 738, 268),
    // the page's foot
    at('03/09/2026', 737, 27),
  ] }] }, { city, file: { board: 'filings', published: '2026-09-03' } });
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.filedOn, row.verdict, row.decidedOn, row.purpose]), [
    ['filings', 'DP 057159 26 00061', '6 RUE EXEMPLE', '2026-09-03', null, null, 'Pose d’un grillage'],
    ['filings', 'DP 057159 26 00052', '15 Rue Exemple', '2026-08-06', null, null, 'Fermeture d’un espace sous une terrasse'],
    ['decisions', 'DP 057159 26 00051', '80 Rue Exemple', '2026-08-05', 'Accord', '2026-08-12', 'Pergola'],
    ['decisions', 'DP 057159 26 00004', '38 rue Exemple', '2026-01-19', 'Rejet tacite', '2026-05-26', null],
    ['decisions', 'PC 057159 26 00002', '24 route Exemple', '2026-01-30', 'Refus', '2026-05-19', null],
    ['decisions', 'DP 057159 26 00030', '23 rue Exemple', '2026-05-29', 'Accord', null, null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), PRIVATE);
  assert.ok(rows.every((row) => row.applicant === null && row.postedOn === '2026-09-03'));
});

test('Longeville’s avis de dépôt are filings and its orders decisions, the ERP works beside them left out', () => {
  assert.deepEqual(picked('digilor-longeville-les-saint-avold', [
    doc(1, 3601, 0, 'ADDP PRIVATE 26 00038 du 02.10.2026'), doc(2, 3601, 0, 'ADPC PRIVATE 26 00009 du 11.08.2026'),
    doc(3, 3601, 5466, 'DP PRIVATE 26 00034 - Arrêté n° 220/26 du 29.09.2026'), doc(4, 3601, 0, 'PC 26 00008 PRIVATE - Arrêté n°173/26 du 22.07.2026'),
    doc(5, 3601, 0, 'AT CARREFOUR 26 00009 - Arrêté n° 209/26 - REFUS'), doc(6, 3601, 0, 'ERP EHPAD - Arrêté poursuite exploitation'),
    doc(7, 3601, 5466, 'AT SAS HARLAND (KFC) 26 00007 - Arrêté n° 178-26'), doc(8, 3600, 5470, 'Arrêté de circulation'),
  ]), [
    ['1.pdf', 'filings', 'digilor-longeville-act'], ['2.pdf', 'filings', 'digilor-longeville-act'],
    ['3.pdf', 'decisions', 'digilor-longeville-act'], ['4.pdf', 'decisions', 'digilor-longeville-act'],
  ]);
});

test('Longeville’s number is the title’s kind, year and counter, the applicant’s name between them left out', () => {
  const city = town('digilor-longeville-les-saint-avold');
  const number = (title) => longevilleNumber(title, city);
  assert.equal(number('ADDP PRIVATE148 26 00038 du 02.10.2026'), 'DP 057413 26 00038');
  assert.equal(number('ADDP PRIVATE 26 00027 M01 du 28.09.2026'), 'DP 057413 26 00027 M01');
  assert.equal(number('ADPA PRIVATE 2600001 du 24.08.2026'), 'PA 057413 26 00001');
  assert.equal(number('DP 26 00016 M 01 - PRIVATE PERSON - Arrêté n°171/26 du 22.07.2026'), 'DP 057413 26 00016 M01');
  assert.equal(number('PC PRIVATE 23 V0018 - Arrêté n° 185/26 du 30.07.26 - Retrait après décision'), 'PC 057413 23 V0018');
  assert.equal(number('PC modificatif SAS PRIVATE 25 00011 M01 - AT 26 00008 - Arrêté n° 212-26'), 'PC 057413 25 00011 M01');
  assert.equal(number('DP 057 413 26 00017 - Arrêté n°155/26 - PRIVATE PERSON du 02.07.2026'), 'DP 057413 26 00017');
  assert.equal(number('AT CARREFOUR 26 00009 - Arrêté n° 209/26 - REFUS'), null);
  assert.equal(number('DP 067 471 26 00017 - Arrêté'), null);
});

test('Longeville’s notice gives its number, filing day and site; its order the day and verdict its title types — never the applicant', () => {
  const city = town('digilor-longeville-les-saint-avold');
  const notice = { pages: [{ runs: [
    ...words('AVIS DE DEPOT : Déclaration préalable', 174, 759), ...words('Dossier numéro : DP 057 413 26 00027 MOI', 65, 721),
    ...words('Date du dépôt : 28/09/2026', 65, 695), ...words('Demandeur : PRIVATE PERSON', 65, 670), ...words('Adresse du terrain : 20c Chemin Exemple', 65, 618),
    ...words('413 10 201', 158, 606), ...words('Nature des Travaux : Travaux sur construction existante', 65, 542),
  ] }] };
  const [row] = readLongevilleAct(notice, { city, file: { board: 'filings', title: 'ADDP PRIVATE 26 00027 M01 du 28.09.2026', published: '2026-09-29' } });
  assert.deepEqual([row.board, row.dossier, row.address, row.filedOn, row.applicant], ['filings', 'DP 057413 26 00027 M01', '20c Chemin Exemple', '2026-09-28', null]);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  const order = { pages: [{ runs: [
    ...words('MAIRIE OPPOSITION A UNE DECLARATION PREALABLE', 111, 734), ...words('Déclaration déposée le 21/07/2026', 56, 667),
    ...words('Par : PRIVATE PERSON', 148, 644), ...words('Demeurant à : 3 Bis Rue Privée', 113, 607), ...words('Sur un terrain sis à : 19 Rue Exemple', 91, 549),
    ...words('57740 LONGEVILLE-LES-SAINT-AVOLD', 172, 538), ...words('ARRETE municipal', 219, 432), ...words('VU le Code de l’Urbanisme', 70, 312),
    ...words(', le 24/09/2026 avis du Préfet', 70, 111),
  ] }] };
  const file = { board: 'decisions', title: 'DP PRIVATE 26 00030 - Arrêté n° 213/26 du 18.09.2026 - Opposition', published: '2026-09-18' };
  const [decision] = readLongevilleAct(order, { city, file });
  assert.deepEqual([decision.dossier, decision.address, decision.filedOn, decision.decidedOn, decision.verdict, decision.applicant],
    ['DP 057413 26 00030', '19 Rue Exemple', '2026-07-21', '2026-09-18', 'Refus', null]);
  assert.doesNotMatch(JSON.stringify(decision), PRIVATE);
});

test('Richardménil’s two sub-categories give its Cart@DS reports, the municipal orders beside them left out', () => {
  assert.deepEqual(picked('digilor-richardmenil', [
    doc(1, 2344, 2868, 'Liste des avis de dépôt - 30_09_2026'), doc(2, 2344, 2869, 'Liste des décisions - 30_09_2026'),
    doc(3, 2344, 0, 'Arrêté engageant la modification1 du PLUi'), doc(4, 2345, 0, '2026 - 49 POL = arrêté de circulation vide greniers'),
  ]), [['1.pdf', 'filings', 'cartds-report-filings'], ['2.pdf', 'decisions', 'cartds-report-decisions']]);
});

test('Morhange’s orders are picked on their title, its receipts, avis de dépôt and delay letters left out', () => {
  assert.deepEqual(picked('digilor-morhange', [
    doc(1, 2233, 2716, '2026 - DP 029 - PRIVATE PERSON - DECISION'), doc(2, 2233, 2716, '2026 - DP 026 - PRIVATE PERSON - Décision et avis'),
    doc(3, 2233, 2714, '2025 - PC 006 - M01 - SAS PRIVATE - DECISION ET AVIS'), doc(4, 2233, 2716, '2026 - DP 028 - PRIVATE PERSON - Récépissé de dépôt'),
    doc(5, 2233, 2716, '2026 - DP 031 - PRIVATE PERSON - AVIS DE DEPOT'), doc(6, 2233, 2716, '2026 - DP 030 - PRIVATE PERSON - MAJ DELAIS'),
    doc(7, 2109, 0, '2026 - 073 - OCC DOM PUB CIRC STAT'),
  ]), [1, 2, 3].map((id) => [`${id}.pdf`, 'decisions', 'digilor-morhange-order']));
});

test('Morhange’s order gives the number, filing day and site of its block, the title’s change added — never the applicant', () => {
  const city = town('digilor-morhange');
  const order = (site = 'Sur un terrain situé : 29 Rue Exemple - 57340 Morhange', dossier = 'DP 057 483 25 00006') => ({ pages: [{ runs: [
    ...words(`Numéro de dossier : ${dossier}`, 176, 737), ...words('Date de dépôt : 13/08/2026', 308, 725),
    ...words('Par : Monsieur PRIVATE PERSON', 308, 714), ...words('Demeurant : 29 Rue Privée - 57340 MORHANGE', 308, 702),
    ...words(site, 308, 691), ...words('Nature des travaux : Pergola', 308, 669),
    ...words('Article I : Il n’est pas fait opposition à la déclaration préalable.', 86, 339),
  ] }] });
  const file = { board: 'decisions', title: '2025 - PC 006 - M01 - SAS PRIVATE - DECISION ET AVIS', published: '2026-09-16' };
  const [row] = readMorhangeOrder(order(), { city, file });
  assert.deepEqual([row.dossier, row.address, row.postcode, row.filedOn, row.verdict, row.applicant],
    ['DP 057483 25 00006 M01', '29 Rue Exemple', '57340', '2026-08-13', 'Non-opposition', null]);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // An OCR bracket before the street is no part of it; a certificate's order is no permit's.
  assert.equal(readMorhangeOrder(order('Sur un terrain situé : (4 Place Exemple - 57340 Morhange'), { city, file })[0].address, '4 Place Exemple');
  assert.deepEqual(readMorhangeOrder(order(undefined, 'CU 057 483 26 00034'), { city, file }), []);
});

test('Puttelange-aux-Lacs’s orders are picked on their sub-category, its receipts and certificates left out', () => {
  assert.deepEqual(picked('digilor-puttelange-aux-lacs', [
    doc(1, 4281, 6730, 'Décision DP0575562600043'), doc(2, 4281, 6730, 'REFUS DP575562600021'), doc(3, 4281, 6730, 'doc02498020260803135841'),
    doc(4, 4281, 6804, 'Récépissé DP0575562600046'), doc(5, 4281, 6732, 'Décision CU0575562600028'), doc(6, 4285, 6749, 'Arrêté fête patronale'),
  ]), [1, 2, 3].map((id) => [`${id}.pdf`, 'decisions', 'digilor-amneville-notice']));
});

test('Puttelange-aux-Lacs’s order gives the number, filing day, site and verdict of its frame — never the applicant or his address', () => {
  const city = town('digilor-puttelange-aux-lacs');
  const order = { pages: [{ runs: [
    ...words('Commune de Puttelange-aux-Lacs', 92, 790), ...words('DECISION DE NON OPPOSITION A UNE DECLARATION PREALABLE', 360, 790),
    ...words('Demande déposée le 14/09/2026', 80, 735), ...words('N° DP 57 556 2600043', 650, 735),
    ...words('Par : PRIVATE PERSON', 80, 705), ...words('Demeurant à : 10 BIS PLACE PRIVEE', 80, 690), ...words('57000 METZ', 262, 676),
    ...words('Pour : Réalisation d’une extension en ossature bois.', 80, 655),
    ...words('Sur un terrain sis à : 1 RUE EXEMPLE', 80, 620), ...words('57510 PUTTELANGE-AUX-LACS', 262, 606),
    ...words('Références cadastrales : 57 0556', 80, 590),
    ...words('ARRETE', 440, 520), ...words('ARTICLE 1 :', 80, 480), ...words('Il n’est pas fait opposition aux travaux projetés dans la déclaration susvisée.', 80, 466),
    ...words('PUTTELANGE-AUX-LACS, le 17/09/2026', 480, 340),
  ] }] };
  const [row] = readScannedNotice(order, { city, file: { board: 'decisions', title: 'Décision DP0575562600043', published: '2026-09-17' } });
  assert.deepEqual([row.dossier, row.address, row.postcode, row.filedOn, row.verdict, row.applicant],
    ['DP 057556 26 00043', '1 RUE EXEMPLE', '57510', '2026-09-14', 'Non-opposition', null]);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

test('Ennery’s orders are picked on their sub-categories, its receipts, certificates and AT left out', () => {
  assert.deepEqual(picked('digilor-ennery', [
    doc(1, 280, 544, 'ARRETE DP 32 PRIVATE'), doc(2, 280, 382, 'ARRETE PCMODIF01 PRIVATE'), doc(3, 280, 544, 'SKM_C36826082710161'),
    doc(4, 280, 388, 'DEPOT DP 42 PRIVATE'), doc(5, 280, 387, 'DEPOT PC04 CAPSTONE REGIONS'), doc(6, 280, 5617, 'CU N°22'),
    doc(7, 280, 1368, 'DEPOT AT 03 ORAKIN LORRAINE'), doc(8, 283, 0, '70-2026'),
  ]), [1, 2, 3].map((id) => [`${id}.pdf`, 'decisions', 'digilor-ennery-order']));
});

/** Ennery's frame as OCR reads it, the filing day in dots in the recitals. */
const ENNERY_ORDER = (article = 'La présente Déclaration Préalable fait l’objet d’une décision de non-opposition sous réserve des prescriptions.', number = 'DP 057 193 2600032') => ({ pages: [{ runs: [
  ...words('COMMUNE D’ENNERY', 330, 790), ...words(number, 300, 700),
  ...words('Avis de dépôt affiché le 17/08/2026', 300, 680), ...words('Arrêté affiché le 30/09/2026', 300, 660),
  ...words('Par : PRIVATE PERSON', 60, 640), ...words('Demeurant à : 19 Rue Privée', 60, 625), ...words('57365 ENNERY', 250, 610),
  ...words('Sur un terrain sis : 19 RUE EXEMPLE', 60, 595), ...words('57365 Ennery', 250, 580),
  ...words('Parcelle(s) : 02 0025', 60, 565), ...words('Nature des Travaux : Réfection de toiture', 60, 550),
  ...words('Vu la Déclaration Préalable susvisée déposée le 15.08.2026 et complétée le 12.09.2026,', 50, 500),
  ...words('ARRÊTE', 380, 420), ...words('Article 1', 380, 380), ...words(article, 50, 360), ...words('ENNERY, le 30/09/2026', 330, 300),
] }] });

test('Ennery’s order gives the number, the dotted filing day, the site and the verdict, the title’s change added — never the applicant', () => {
  const city = town('digilor-ennery');
  const file = { board: 'decisions', title: 'ARRETE DP 32 PRIVATE', published: '2026-10-01' };
  const [row] = readEnneryOrder(ENNERY_ORDER(), { city, file });
  assert.deepEqual([row.dossier, row.address, row.postcode, row.filedOn, row.verdict, row.applicant],
    ['DP 057193 26 00032', '19 RUE EXEMPLE', '57365', '2026-08-15', 'Non-opposition', null]);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // A change the frame drops comes from the title; a verdict a stamp hides from the recitals' own words.
  const [modified] = readEnneryOrder(ENNERY_ORDER('Le présent Permis de Construire modificatif est accordé.', 'PC 057 193 2500003'),
    { city, file: { ...file, title: 'ARRETE PCMODIF01 PRIVATE' } });
  assert.deepEqual([modified.dossier, modified.verdict], ['PC 057193 25 00003 M01', 'Accord']);
  const [hidden] = readEnneryOrder(ENNERY_ORDER('La présente Déclaration Préalable fait l’objet d’une décision de non-opp sition.'), { city, file });
  assert.equal(hidden.verdict, 'Non-opposition');
  // A recital naming an earlier decision is not this act's verdict.
  const recited = ENNERY_ORDER('Le présent arrêté est notifié au pétitionnaire.');
  recited.pages[0].runs.push(...words('Vu la décision de non-opposition du 02/02/2026,', 50, 480));
  assert.equal(readEnneryOrder(recited, { city, file })[0].verdict, 'Décision signée');
  // Posted before the day the recitals say the file was filed: that day is not trusted.
  assert.equal(readEnneryOrder(ENNERY_ORDER(), { city, file: { ...file, published: '2026-08-10' } })[0].filedOn, null);
});

test('Ennery’s tacit decision of opposition, a letter on an incomplete file, reads as a refusal with its own filing day', () => {
  const letter = { pages: [{ runs: [
    ...words('COMMUNE D’ENNERY', 330, 790), ...words('DP 057 193 2600015', 300, 740), ...words('Demande déposée le 13/04/2026', 300, 725),
    ...words('Par : SAS PRIVATE', 60, 700), ...words('Adresse des travaux : Rue Georges Claude', 60, 660), ...words('57365 ENNERY', 250, 645),
    ...words('Objet : Décision Tacite d’Opposition', 60, 560), ...words('Vous avez déposé le 13/04/2026 une demande de DP.', 60, 520),
    ...words('ENNERY, le 26/08/2026', 330, 330),
  ] }] };
  const [row] = readEnneryOrder(letter, { city: town('digilor-ennery'), file: { board: 'decisions', title: 'SKM_C36826082710161', published: '2026-08-27' } });
  assert.deepEqual([row.dossier, row.address, row.filedOn, row.verdict], ['DP 057193 26 00015', 'Rue Georges Claude', '2026-04-13', 'Refus']);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

// --- Le Plessis-Bouchard: weekly scanned lists -------------------------------

/** One OCR word at an exact place; `at` spaces a cell's words by their length. */
const word = (text, x, y) => ({ text, x, x1: x + 5 * text.length, y, size: 8 });
const at = (text, x, y) => { let left = x; return text.split(' ').map((item) => { const run = word(item, left, y); left = run.x1 + 4; return run; }); };

const PLESSISB_FILINGS_HEADER = (y, label = 'Adresse') => [
  ...at('Date de dépôt', 32, y), ...at('Numéro de dossier', 157, y), ...at('Pétitionnaire', 282, y), ...at(label, 410, y), ...at('du projet', 450, y),
  ...at('Description du projet', 575, y),
];
/** Two pages of filings: a sign and an ERP work (no permit), a person's request, a company's, a row the page breaks, and the commune's stamp up the margin. */
const PLESSISB_FILINGS = () => ({ pages: [
  { width: 842, runs: [
    ...at('Dossiers déposés avant le 2 octobre 2026', 315, 411), ...PLESSISB_FILINGS_HEADER(386),
    ...at('04/09/2026', 32, 345), ...at('AP 095491 26 0005', 156, 345), ...at('Madame PRIVATE', 282, 345), ...at('Rue Pasteur', 411, 345), ...at('Enseignes', 575, 345),
    ...at('04/09/2026', 32, 262), ...at('AT 095491 26 00004', 156, 262), ...at('Madame PRIVATE', 282, 262), ...at('rue Pasteur', 411, 262), ...at('Aménagement pharmacie', 575, 262),
    ...at('29/09/2026', 32, 180), ...at('DP 095491 26 00071', 156, 180), ...at('PRIVATE PERSON', 282, 180), ...at('3 Rue du Clos Lacroix', 411, 180), ...at('Pose de panneaux solaires', 575, 180),
    ...at('95130 LE PLESSIS-', 411, 168), ...at('BOUCHARD', 411, 156), ...at('sur toiture', 575, 168),
    ...at('22/09/2026', 32, 120), ...at('PC 095491 26 00013', 156, 120), ...at('PRIVATE PERSON', 282, 120), ...at('SCI ILE DE FRANCE', 282, 108), ...at('[16 Allée Mozart n', 411, 120), ...at('Bâtiment agricole', 575, 120),
    ...at('21/09/2026', 32, 53), ...at('DP 095491 26 00067', 156, 53), ...at('PRIVATE PERSON', 282, 53), ...at('16 Allée Mozart', 411, 53), ...at('Ouverture de 3 velux', 575, 53),
    word('S', 821, 345), word('2', 821, 262), ...at('Page 1 sur 2', 400, 31),
  ] },
  // The next page's header: OCR glued a rule to `Adresse`.
  { width: 842, runs: [
    ...PLESSISB_FILINGS_HEADER(544, 'J\'Adresse'),
    ...at('PRIVATE PERSON', 282, 519), ...at('95130 Le Plessis-Bouchard', 411, 519), ...at('grenier / comble', 575, 519),
    ...at('06/09/2026', 32, 487), ...at('DP 095491 26 00063', 156, 487), ...at('PRIVATE PERSON', 282, 487), ...at('74bis Rue Charles de Gaulle', 411, 487), ...at('Climatisation', 575, 487),
    ...at('Page 2 sur 2', 400, 34),
  ] },
] });

test('Le Plessis-Bouchard’s filings give the number, the site and the filing day — signs and ERP works left out, no person named', () => {
  const city = town('digilor-le-plessis-bouchard');
  const rows = readPlessisBouchardList(PLESSISB_FILINGS(), { city, file: { board: 'filings', title: 'dépôts ADS', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.applicant]), [
    ['DP 095491 26 00071', '3 Rue du Clos Lacroix', '2026-09-29', null],
    ['PC 095491 26 00013', '16 Allée Mozart', '2026-09-22', 'SCI ILE DE FRANCE'],
    ['DP 095491 26 00067', '16 Allée Mozart', '2026-09-21', null],
    ['DP 095491 26 00063', '74bis Rue Charles de Gaulle', '2026-09-06', null],
  ]);
  assert.deepEqual([rows[0].board, rows[0].postcode, rows[0].postedOn, rows[0].verdict], ['filings', '95130', '2026-10-02', null]);
  // The row the first page breaks takes the next page's lines, not its header: its works are the whole of its cell.
  assert.equal(rows[2].purpose, 'Ouverture de 3 velux grenier / comble');
  assert.equal(rows[0].purpose, 'Pose de panneaux solaires sur toiture');
  assert.doesNotMatch(JSON.stringify(rows), PRIVATE);
});

const PLESSISB_DECISIONS_HEADER = (y) => [
  ...at('Numéro de dossier', 32, y), ...at('Pétitionnaire', 141, y), ...at('Décision', 261, y), ...at('Date de', 336, y), ...at('Nature des travaux', 415, y),
  ...at('Adresse des travaux', 594, y), ...at('Surface', 769, y), ...at('signature', 336, y - 15),
];
const PLESSISB_DECISIONS = () => ({ pages: [{ width: 842, runs: [
  ...at('Dossiers décidés jusqu’au 2 octobre 2026', 315, 412), ...PLESSISB_DECISIONS_HEADER(387),
  ...at('Autorisation préalable de nouvelle installation, de remplacement ou de modification d’un dispositif', 31, 335), ...at('préenseigne ou une enseigne', 31, 321),
  ...at('AP 095491 26 0002', 30, 286), ...at('Monsieur PRIVATE', 141, 286), ...at('Favorable', 260, 286), ...at('09/09/2026', 335, 286), ...at('Enseignes', 415, 286), ...at('68 Chaussée Jules César', 593, 286),
  ...at('Déclaration préalable - Constructions et travaux non soumis à permis de construire', 31, 224),
  ...at('DP 095491 26', 30, 186), ...at('PRIVATE PERSON', 141, 186), ...at('Favorable', 260, 186), ...at('21/09/202€', 335, 186), ...at('Changement de portail', 415, 186), ...at('3 Rue Pierre Curie', 593, 186), ...at('m2', 771, 186),
  ...at('00066', 30, 174), ...at('95130 Le Plessis-Bouchard', 593, 174),
  ...at('DP 095491 26', 30, 120), ...at('PRIVATE PERSON', 141, 120), ...at('SAS LBF', 141, 108), ...at('Favorabie', 260, 120), ...at('14/09/2026', 335, 120), ...at('Clôture', 415, 120), ...at('7 allée Van Gogh', 593, 120), ...at('|', 585, 120),
  ...at('00060', 30, 108),
  ...at('Permis de construire pour une maison individuelle et/ou ses annexes', 31, 70),
  ...at('PC 095491 26', 30, 50), ...at('PRIVATE PERSON', 141, 50), ...at('Défavorable', 260, 50), ...at('17/08/2026', 335, 50), ...at('Extension', 415, 50), ...at('17 RUE JULES VOISIN', 593, 50),
  ...at('00008', 30, 38),
  ...at('Page 1 sur 1', 400, 31),
] }] });

test('Le Plessis-Bouchard’s decisions give the number wrapped under its family, the site, the verdict and the day — the rule’s lost digit mended', () => {
  const city = town('digilor-le-plessis-bouchard');
  const rows = readPlessisBouchardList(PLESSISB_DECISIONS(), { city, file: { board: 'decisions', title: 'Autorisations ADS', published: '2026-10-02' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.verdict, row.decidedOn, row.applicant]), [
    ['DP 095491 26 00066', '3 Rue Pierre Curie', 'Accord', '2026-09-21', null],
    ['DP 095491 26 00060', '7 allée Van Gogh', 'Accord', '2026-09-14', 'SAS LBF'],
    ['PC 095491 26 00008', '17 RUE JULES VOISIN', 'Refus', '2026-08-17', null],
  ]);
  assert.deepEqual([rows[0].board, rows[0].postcode, rows[0].purpose, rows[0].filedOn], ['decisions', '95130', 'Changement de portail', null]);
  assert.doesNotMatch(JSON.stringify(rows), PRIVATE);
});

test('Le Plessis-Bouchard’s shelves are told by the title, whatever sub-category a list was posted on', () => {
  assert.deepEqual(picked('digilor-le-plessis-bouchard', [
    doc(1, 3120, 4483, 'dépôts ADS', '2026-10-02'), doc(2, 3120, 4484, 'Autorisations ADS', '2026-10-02'), doc(3, 3120, 4483, 'Autorisations ADS', '2026-08-31'),
    doc(4, 3120, 4484, 'Autorisation ADS', '2026-09-01'), doc(5, 3120, 4483, 'Dépôt ADS', '2026-09-02'), doc(6, 3119, 4483, 'dépôts ADS', '2026-09-02'),
    doc(7, 3120, 4484, 'Notice du PLU', '2026-09-02'),
  ]), [
    ['1.pdf', 'filings', 'digilor-plessisb-list'], ['2.pdf', 'decisions', 'digilor-plessisb-list'], ['3.pdf', 'decisions', 'digilor-plessisb-list'],
    ['4.pdf', 'decisions', 'digilor-plessisb-list'], ['5.pdf', 'filings', 'digilor-plessisb-list'],
  ]);
});

// --- Small towns posting the State's frames ------------------------------------

/** An order's frame as OCR reads it, the label and its value one line, the last words the verdict's. */
const FRAME_ORDER = ({ number = 'N° DP 88445 26 H0035', site = 'Sur un terrain sis à : 26bis route du Pair', purpose = 'Pour : Couverture de terrasse Logement(s) démoli(s) :', parcels = 'Cadastré : AS157',
  heading = 'ARRÊTE DE NON OPPOSITION D’UNE DÉCLARATION PRÉALABLE', article = 'Article 1 : Il n’est pas fait opposition à l’autorisation susvisée.' } = {}) => ({ pages: [{ runs: [
  ...words(number ? `DOSSIER ${number} PAGE 1/2` : 'DOSSIER PAGE 1/2', 40, 790), ...words(heading, 40, 744), ...words('DÉLIVRÉ PAR LE MAIRE AU NOM DE LA COMMUNE', 40, 650),
  ...words('Dossier déposé complet le 29 Juillet 2026', 40, 564),
  ...words('Par : Monsieur PRIVATE PERSON', 40, 538), ...words('Demeurant à : 12 rue Privée', 40, 499),
  ...words(purpose, 40, 450), ...words(site, 40, 409), ...words(parcels, 40, 380),
  ...words('Le Maire,', 40, 349), ...words('Vu le Code de l’Urbanisme, notamment ses articles L.421-2, R.421-19', 40, 326),
  ...words('Vu l’aléa retrait-gonflement des argiles', 40, 300),
  ...words('ARRÊTE', 40, 249), ...words(article, 40, 221), ...words('Fait à SAULCY-SUR-MEURTHE', 40, 183), ...words('Le 9 septembre 2026', 40, 167),
] }] });

test('a frame act gives its number, site, parcels, filing day and verdict; the works stop before the frame’s next label', () => {
  const city = town('digilor-saulcy-sur-meurthe');
  const file = { board: 'decisions', title: 'PRIVATE PERSON', published: '2026-09-24' };
  const [row] = readFrameAct(FRAME_ORDER(), { city, file });
  assert.deepEqual([row.board, row.dossier, row.address, row.postcode, row.parcels, row.purpose, row.filedOn, row.verdict, row.postedOn],
    ['decisions', 'DP 088445 26 H0035', '26bis route du Pair', '88580', 'AS 157', 'Couverture de terrasse', '2026-07-29', 'Non-opposition', '2026-09-24']);
  assert.equal(row.applicant, null);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

test('a frame act whose number OCR lost takes the title’s, with the change it adds — Kuntzig, Angevillers, Bussang', () => {
  const kuntzig = { ...town('digilor-saulcy-sur-meurthe'), insee: '57372', postcode: '57970', label: 'Commune de Kuntzig — autorisations d’urbanisme' };
  const frame = FRAME_ORDER({ number: null, site: 'Sur un terrain sis à : 41 rue des Rouges Gorges 57970 KUNTZIG', article: 'Article 1 : Les travaux sont autorisés pour le projet.',
    heading: 'DÉCLARATION PRÉALABLE DÉLIVRÉE PAR LE MAIRE' });
  const [row] = readFrameAct(frame, { city: kuntzig, file: { board: 'decisions', title: 'DP2600015 M01 PRIVATE DECISION', published: '2026-07-23' } });
  assert.deepEqual([row.dossier, row.address, row.verdict], ['DP 057372 26 00015 M01', '41 rue des Rouges Gorges', 'Accord']);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // No number anywhere: no row.
  assert.deepEqual(readFrameAct(frame, { city: kuntzig, file: { board: 'decisions', title: 'DECISION PRIVATE', published: '2026-07-23' } }), []);
});

test('a frame act’s verdict is found where dematdoc’s reader misses it — Article I, a bare article, an « OPPOSITION », never the clay’s retrait-gonflement', () => {
  const city = town('digilor-saulcy-sur-meurthe');
  const file = { board: 'decisions', title: '', published: '2026-09-24' };
  const verdict = (options) => readFrameAct(FRAME_ORDER(options), { city, file })[0]?.verdict;
  assert.equal(verdict({ article: 'Article I : Il n’est pas fait opposition à la déclaration préalable pour le projet susvisé.' }), 'Non-opposition');
  assert.equal(verdict({ heading: 'ARRÊTÉ n°145/2026 de non-opposition à une déclaration préalable', article: 'Article unique' }), 'Non-opposition');
  assert.equal(verdict({ heading: 'ARRETE N° 94/2026 D’OPPOSITION À DÉCLARATION PRÉALABLE', article: 'Article 1: La Déclaration Préalable fait l’objet d’une décision d’OPPOSITION.' }), 'Refus');
  assert.equal(verdict({ heading: 'DÉCLARATION PRÉALABLE DÉLIVRÉE PAR LE MAIRE', article: 'Article 1 : voir annexe' }), 'Décision signée');
});

test('a frame act that is no permit’s, a certificate of urbanism, gives no row', () => {
  const city = town('digilor-saulcy-sur-meurthe');
  const certificate = FRAME_ORDER({ number: 'N° CU 88445 26 H0021', heading: 'CERTIFICAT D’URBANISME' });
  assert.deepEqual(readFrameAct(certificate, { city, file: { board: 'decisions', title: '', published: '2026-09-24' } }), []);
});

test('a title’s number is the commune’s full one, or a short one with the commune’s code put in', () => {
  const at = (insee) => ({ insee, postcode: '00000', label: 'x', source: {} });
  assert.equal(frameTitleNumber('DP 057 554 26 00022 - PRIVATE PERSON -', at('57554')), 'DP 057554 26 00022');
  assert.equal(frameTitleNumber('PC 057 554 25 00002 M01 - PRIVATE', at('57554')), 'PC 057554 25 00002 M01');
  assert.equal(frameTitleNumber('Avis.de.depot_DP57593260032', at('57593')), 'DP 057593 26 00032');
  assert.equal(frameTitleNumber('DP2600033 PRIVATE DECISION', at('57372')), 'DP 057372 26 00033');
  assert.equal(frameTitleNumber('DP26000028 PRIVATE DEPOT', at('57372')), 'DP 057372 26 00028');
  assert.equal(frameTitleNumber('DP260027 SFR', at('57372')), 'DP 057372 26 00027');
  assert.equal(frameTitleNumber('DP 2600019 Décision Déclaration Préalable n° 2600019', at('57022')), 'DP 057022 26 00019');
  assert.equal(frameTitleNumber('PC05730324M0010-M01', at('57303')), 'PC 057303 24 M0010 M01');
  // « DP 39 2026 » is counter 39 of 2026, not year 39.
  assert.equal(frameTitleNumber('DP 39 2026 PRIVATE modif ouvertures', at('88081')), 'DP 088081 26 00039');
  // Another commune's full number is no number of this one.
  assert.equal(frameTitleNumber('DP 057 999 26 00001 PRIVATE', at('57554')), null);
  assert.equal(frameTitleNumber('Arrêté de circulation', at('57554')), null);
});

/** A notice of filing as a small town types it, the label before its value, the town after the street. */
const FRAME_NOTICE = (site, number = 'DP 57 593 2600031') => ({ pages: [{ runs: [
  ...words('AVIS DE DÉPÔT DE LA DEMANDE DE', 40, 790), ...words('Déclaration préalable', 40, 770),
  ...words(`Numéro de dossier : ${number}`, 40, 740), ...words('Date de dépôt de la demande : 18/08/2026', 40, 720),
  ...words('Nom et prénom du demandeur : PRIVATE PERSON', 40, 700), ...words(site, 40, 680), ...words('Nature des travaux : Pose d’une clôture', 40, 660),
] }] });

test('a notice’s site loses the label’s remains and the town that follow it', () => {
  const roncourt = { ...town('digilor-saulcy-sur-meurthe'), insee: '57593', postcode: '57860', label: 'Commune de Roncourt — autorisations d’urbanisme' };
  const file = { board: 'filings', title: 'Avis de dépôt DP57593260031', published: '2026-08-20' };
  assert.equal(readFrameAct(FRAME_NOTICE('Adresse du projet : du projet : 38 Rue de Jaumont'), { city: roncourt, file })[0].address, '38 Rue de Jaumont');
  const pournoy = { ...roncourt, insee: '57554', postcode: '57420', label: 'Commune de Pournoy-la-Grasse — autorisations d’urbanisme' };
  const [row] = readFrameAct(FRAME_NOTICE('Adresse des travaux : 6 Rue des Tournesols à Pournoy-La-Grasse', 'DP 057 554 26 00018'), { city: pournoy, file: { ...file, title: 'DP 057 554 26 00018' } });
  assert.deepEqual([row.board, row.dossier, row.address], ['filings', 'DP 057554 26 00018', '6 Rue des Tournesols']);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

/** Saulcy's receipt: the « cadre réservé à la mairie » is typed under the State's form. */
const SAULCY_RECEIPT = (project = 'Projet: création d’une pergola de 24 m² au “1 rue de Bémont"') => ({ pages: [{ runs: [
  ...words('Récépissé de dépôt d’une déclaration préalable', 200, 790), ...words('Monsieur,', 20, 770),
  ...words('Le projet ayant fait l’objet d’une déclaration n° DP 088 445 26 H 0047,', 20, 300), ...words('déposée à la mairie le : 25 septembre 2026,', 20, 280),
  ...words('Par Monsieur PRIVATE PERSON', 20, 260), ...words(project, 20, 240),
  ...words('est autorisé à défaut de réponse de l’administration un mois après cette date.', 20, 220),
] }] });

test('Saulcy’s receipt gives the number, the filing day, the works and the site at the end of the project line — never the applicant', () => {
  const city = town('digilor-saulcy-sur-meurthe');
  const file = { board: 'filings', title: 'PRIVATE PERSON', published: '2026-10-02' };
  const [row] = readSaulcyReceipt(SAULCY_RECEIPT(), { city, file });
  assert.deepEqual(row, {
    board: 'filings', dossier: 'DP 088445 26 H0047', applicant: null, address: '1 rue de Bémont', postcode: '88580', parcels: null,
    purpose: 'création d’une pergola de 24 m²', filedOn: '2026-09-25', postedOn: '2026-10-02', verdict: null,
  });
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // The site in quotes with no « au » before; or with no quotes at all.
  assert.equal(readSaulcyReceipt(SAULCY_RECEIPT('Projet: division de la parcelle pour un lot à bâtir "5 rue de Moulins-sur-Allier"'), { city, file })[0].address, '5 rue de Moulins-sur-Allier');
  assert.equal(readSaulcyReceipt(SAULCY_RECEIPT('Projet: pose d’une clôture au 19 rue d’Anozel'), { city, file })[0].address, '19 rue d’Anozel');
  // No site, no row.
  assert.deepEqual(readSaulcyReceipt(SAULCY_RECEIPT('Projet: pose d’une clôture'), { city, file }), []);
});

test('Saulcy’s shelves read its orders by frame and its receipts by their project line, whatever the title', () => {
  assert.deepEqual(picked('digilor-saulcy-sur-meurthe', [
    doc(1, 3917, 6082, 'PRIVATE PERSON'), doc(2, 3917, 6087, 'PRIVATE PERSON'), doc(3, 3917, 6078, 'PRIVATE PERSON'),
    doc(4, 3917, 6076, 'PRIVATE PERSON'), doc(5, 3917, 6184, 'PRIVATE PERSON'), doc(6, 3921, 0, 'Arrêté de circulation'),
  ]), [
    ['1.pdf', 'filings', 'digilor-saulcy-receipt'], ['2.pdf', 'filings', 'digilor-saulcy-receipt'], ['3.pdf', 'decisions', 'digilor-frame-act'],
    ['4.pdf', 'decisions', 'digilor-frame-act'], ['5.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('Arches’s orders are picked on their sub-categories, and on their title when posted on none — receipts, certificates and municipal orders left out', () => {
  assert.deepEqual(picked('digilor-arches', [
    doc(1, 4565, 7288, 'Arrêté DP 088 011 2600026'), doc(2, 4565, 7287, 'Arrêté PC 088 011 2600007'), doc(3, 4565, 7290, 'Récépissé PC 088 011 2600009'),
    doc(4, 4565, 7289, 'Arrêté CU 088 011 2600062'), doc(5, 4565, 0, 'Arrêté PD 088 011 2600003'), doc(6, 4565, 0, '2026-52 TRB rue de Hadol RD4'),
    doc(7, 4566, 0, 'Arrêté DP 088 011 2600026'), doc(8, 4565, 7288, 'Arrêté DP 088 011 2600020', '2026-06-20'),
  ]), [
    ['1.pdf', 'decisions', 'digilor-frame-act'], ['2.pdf', 'decisions', 'digilor-frame-act'], ['5.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('an order whose heading OCR split with a border mark is a decision, not a filing — Arches’s permis de démolir', () => {
  const city = town('digilor-arches');
  const demolition = FRAME_ORDER({ number: 'N° PD 088 011 2600002', heading: 'PERMIS DE DÉMOLIR | DELIVRE PAR LE MAIRE AU NOM DE LA COMMUNE',
    site: 'Sur un terrain sis : | 4 rue de la colombière', parcels: 'Parcelle(s) : AD 0288', purpose: 'Pour : | Démolition de l’annexe.' });
  // Arches’s demolition order has no operative article, and its parcel (« AD ») reads as an avis d’affichage before any decision word.
  demolition.pages[0].runs = demolition.pages[0].runs.filter((run) => run.y < 150 || run.y > 300);
  const [row] = readFrameAct(demolition, { city, file: { board: 'decisions', title: 'Arrêté PD 088 011 2600003', published: '2026-08-07' } });
  assert.deepEqual([row.board, row.dossier, row.address, row.parcels, row.verdict], ['decisions', 'PD 088011 26 00002', '4 rue de la colombière', 'AD 288', 'Décision signée']);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

test('Ammerschwihr’s orders are picked on their sub-category, its handwritten receipts and the other orders of the town left out', () => {
  assert.deepEqual(picked('digilor-ammerschwihr', [
    doc(1, 4835, 7900, 'DP0680052600036_PRIVATE'), doc(2, 4835, 7900, 'PD0680052600002_PRIVATE'), doc(3, 4835, 7899, 'DP0680052600045_PRIVATE'),
    doc(4, 4835, 7938, 'arr_95_2026_fete_des_vendanges'), doc(5, 4864, 0, 'Arrete_Circulation_marathon_2026'), doc(6, 4835, 7900, 'DP0680052600019_PRIVATE', '2026-06-30'),
  ]), [
    ['1.pdf', 'decisions', 'digilor-frame-act'], ['2.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('Vigy’s orders are picked on their two sub-categories, whatever the applicant’s name in the title', () => {
  assert.deepEqual(picked('digilor-vigy', [
    doc(1, 5790, 9930, 'DP0577162600036_PRIVATE'), doc(2, 5790, 9929, 'PC 0577162600006 PRIVATE PERSON'), doc(3, 5789, 9930, 'DP0577162500044_PRIVATE'),
    doc(4, 6072, 0, 'Compte-rendu du conseil'), doc(5, 5790, 9930, 'DP0577162600010_PRIVATE', '2026-06-30'),
  ]), [
    ['1.pdf', 'decisions', 'digilor-frame-act'], ['2.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('a frame act’s site keeps the town when it ends the name of a lotissement or a street — Vigy’s « Hauts de Vigy »', () => {
  const city = town('digilor-vigy');
  const file = { board: 'decisions', title: 'DP0577162600028_PRIVATE', published: '2026-07-07' };
  const address = (site) => readFrameAct(FRAME_ORDER({ number: 'N° DP 057 716 26 00028', site }), { city, file })[0].address;
  assert.equal(address('Sur un terrain sis à : 4 Lotissement les Hauts de Vigy'), '4 Lotissement les Hauts de Vigy');
  assert.equal(address('Sur un terrain sis à : 12 rue de Vigy'), '12 rue de Vigy');
  // The town after a street that does not need it still goes.
  assert.equal(address('Sur un terrain sis à : 12 rue de la Gare à VIGY'), '12 rue de la Gare');
});

test('Angevillers’s decisions are picked with their number put before a title that names none, its certificates and receipts left out', () => {
  const files = digilorDocuments(town('digilor-angevillers'), [
    doc(1, 3438, 5034, 'Décision Déclaration Préalable n° 2600024', '2026-08-20', 'DP 2600024'),
    doc(2, 3438, 5034, 'Décision Permis de Construire n° 2600008', '2026-09-15', 'PC 2600008'),
    doc(3, 3438, 5034, 'Décision Certificat d’Urbanisme n° 2600017', '2026-08-13', 'CU 2600017'),
    doc(4, 3438, 5033, 'Récépissé de Dépôt Permis de Construire n° 2600010', '2026-09-10', 'RD PC 2600010'),
    doc(5, 3437, 0, 'Arrêté de stationnement', '2026-09-10'),
  ], '2026-07-01');
  assert.deepEqual(files.map((file) => [file.board, file.layout, file.title]), [
    ['decisions', 'digilor-frame-act', 'PC 2600008 Décision Permis de Construire n° 2600008'],
    ['decisions', 'digilor-frame-act', 'DP 2600024 Décision Déclaration Préalable n° 2600024'],
  ]);
  const city = town('digilor-angevillers');
  assert.equal(frameTitleNumber(files[0].title, city), 'PC 057022 26 00008');
  assert.equal(frameTitleNumber(files[1].title, city), 'DP 057022 26 00024');
});

test('a frame act that refuses is a refusal, whether its article says the works are « not authorised » or its heading says « REFUS » — never a grant', () => {
  const city = town('digilor-angevillers');
  const file = { board: 'decisions', title: 'DP 2600019 Décision Déclaration Préalable n° 2600019', published: '2026-07-28' };
  const verdict = (options) => readFrameAct(FRAME_ORDER({ number: null, site: 'Sur un terrain sis à : 375 rue d’Escherange', ...options }), { city, file })[0]?.verdict;
  assert.equal(verdict({ heading: 'REFUS DE DÉCLARATION PRÉALABLE', article: 'Article 1 - Les travaux ne sont pas autorisés pour le projet décrit dans la demande susvisée.' }), 'Refus');
  assert.equal(verdict({ heading: 'REFUS de Permis de construire', article: 'Article 1 : voir motifs' }), 'Refus');
  assert.equal(verdict({ heading: 'DÉCLARATION PRÉALABLE DÉLIVRÉE PAR LE MAIRE', article: 'Article 1 : Le permis est refusé pour le projet susvisé.' }), 'Refus');
  assert.equal(verdict({ heading: 'DÉCLARATION PRÉALABLE DÉLIVRÉE PAR LE MAIRE', article: 'Article 1 : Les travaux sont autorisés pour le projet décrit dans la demande susvisée.' }), 'Accord');
  // The recitals' « ne peut être accordé que si » is the law's, not the decision's.
  const recital = FRAME_ORDER({ number: null, site: 'Sur un terrain sis à : 375 rue d’Escherange', heading: 'DÉCLARATION PRÉALABLE DÉLIVRÉE PAR LE MAIRE', article: 'Article 1 : Les travaux sont autorisés pour le projet.' });
  recital.pages[0].runs.push(...words('Considérant que le permis ne peut pas être accordé que si le projet est conforme', 40, 290));
  assert.equal(readFrameAct(recital, { city, file })[0].verdict, 'Accord');
});

/** Argancy's receipt, page 2: the State's form, the cadre typed under the stamp (« Cachet de la mairie » shares the line). */
const ARGANCY_RECEIPT = (cadre = ['DP 57 028', '2600058,'], project = 'pour : ravalement de façade et isolation par l’extérieur à Argancy') => ({ pages: [
  { runs: [...words('Récépissé de dépôt d’une déclaration préalable', 40, 786), ...words('pour attester la date de dépôt ;', 300, 297)] },
  { runs: [
    ...words('Cadre réservé à la mairie', 40, 742),
    ...words(`Le projet ayant fait l’objet d’une demande de permis n°${cadre[0]} Cachet de la mairie`, 40, 719), ...words(cadre[1], 40, 700),
    ...words('déposée à la mairie le : 22/09/2026,', 40, 683), ...words(project, 40, 660), ...words('est autorisé à défaut de réponse de l’administration', 40, 638),
  ] }] });

test('Argancy’s receipt gives the number the stamp splits, the filing day and the works; the site is its title’s street — never the applicant', () => {
  const city = town('digilor-argancy');
  const file = { board: 'filings', title: '36 rue de Bussière à Argancy', published: '2026-09-28' };
  const [row] = readArgancyReceipt(ARGANCY_RECEIPT(), { city, file });
  assert.deepEqual(row, {
    board: 'filings', dossier: 'DP 057028 26 00058', applicant: null, address: '36 rue de Bussière', postcode: '57640', parcels: null,
    purpose: 'ravalement de façade et isolation par l’extérieur', filedOn: '2026-09-22', postedOn: '2026-09-28', verdict: null,
  });
  // A permit, a street without number, and a village after it.
  const permit = ARGANCY_RECEIPT(['PC 57 028 2600013,', ''], 'pour maison individuelle à Rugy');
  const [house] = readArgancyReceipt(permit, { city, file: { ...file, title: 'rue des Grandes Chenevières à Rugy' } });
  assert.deepEqual([house.dossier, house.address, house.purpose], ['PC 057028 26 00013', 'rue des Grandes Chenevières', 'maison individuelle']);
  // No number (the stamp hid it), or a title that is not a street, gives no row.
  assert.deepEqual(readArgancyReceipt(ARGANCY_RECEIPT(['DP 57 028', '']), { city, file }), []);
  assert.deepEqual(readArgancyReceipt(ARGANCY_RECEIPT(), { city, file: { ...file, title: 'PRIVATE PERSON' } }), []);
  assert.doesNotMatch(JSON.stringify(house), PRIVATE);
});

test('Argancy’s receipts and orders are picked on their sub-categories, its completion declarations and starts of works left out', () => {
  assert.deepEqual(picked('digilor-argancy', [
    doc(1, 4159, 6514, '36 rue de Bussière à Argancy'), doc(2, 4159, 6515, 'PRIVATE PERSON'), doc(3, 4159, 6530, 'PRIVATE PERSON'),
    doc(4, 4159, 6531, 'PRIVATE PERSON'), doc(5, 4200, 6594, 'ARRETE 100 RELATIF A LA NUMEROTATION'), doc(6, 4159, 6515, 'PRIVATE', '2026-06-30'),
  ]), [
    ['1.pdf', 'filings', 'digilor-argancy-receipt'], ['2.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('a frame act that stamps the day its filing was posted is still the order its shelf says — Argancy’s « Avis de dépôt affiché le »', () => {
  const city = town('digilor-argancy');
  const order = FRAME_ORDER({ number: 'DP 057 028 2600049', heading: 'DÉCLARATION PRÉALABLE', site: 'Sur un terrain sis : 6 rue de la Chapelle 57640 ARGANCY',
    purpose: 'Nature des Travaux : Réfection de façades', article: 'Article unique La présente Déclaration Préalable fait l’objet d’une décision de non-opposition.' });
  // Argancy signs « ARGANCY, le 03/09/2026 », not « Fait à … Le 9 septembre 2026 ».
  order.pages[0].runs = order.pages[0].runs.filter((run) => run.y !== 183 && run.y !== 167);
  order.pages[0].runs.push(...words('Avis de dépôt affiché le 25/08/2026', 40, 700), ...words('ARGANCY, le 03/09/2026', 40, 160));
  const [row] = readFrameAct(order, { city, file: { board: 'decisions', title: 'PRIVATE PERSON', published: '2026-09-04' } });
  assert.deepEqual([row.board, row.dossier, row.address, row.verdict, row.filedOn, row.decidedOn],
    ['decisions', 'DP 057028 26 00049', '6 rue de la Chapelle', 'Non-opposition', '2026-07-29', '2026-09-03']);
});

/** Bussang's notice of filing: a heading, the number, one sentence, the day it was posted. */
const BUSSANG_NOTICE = (sentence, number = 'DP 088 081 26 00033', heading = 'd’une déclaration préalable') => ({ pages: [{ runs: [
  ...words('Dépôt de demande', 40, 776), ...words(heading, 40, 747), ...words('Commune de BUSSANG', 40, 726), ...words(`(Vosges) ${number}`, 40, 705),
  ...sentence.map((line, at) => words(line, 40, 662 - at * 26)).flat(), ...words('Affiché le 11 août 2026', 40, 580), ...words('Le Maire,', 40, 544),
] }] });

test('Bussang’s notice gives the number, the filing day, the works and the site after the last « au » — never the applicant it names', () => {
  const city = town('digilor-bussang');
  const file = { board: 'filings', title: 'DP 33 2026 PRIVATE PERSON extension', published: '2026-08-11' };
  const [row] = readBussangNotice(BUSSANG_NOTICE([
    'Le 7 août 2026 a été déposé en Mairie par Mme PRIVATE PERSON un dossier de Déclaration',
    'Préalable concernant la construction d’une extension pour la cuisine au 33 Rue du 19ème', 'BCP.']), { city, file });
  assert.deepEqual(row, {
    board: 'filings', dossier: 'DP 088081 26 00033', applicant: null, address: '33 Rue du 19ème BCP', postcode: '88540', parcels: null,
    purpose: 'la construction d’une extension pour la cuisine', filedOn: '2026-08-07', postedOn: '2026-08-11', verdict: null,
  });
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
  // A permit, its site wrapped over two lines, the comma after « Mairie ».
  const [house] = readBussangNotice(BUSSANG_NOTICE([
    'Le 31 juillet 2026 a été déposé en Mairie, par M. PRIVATE PERSON un dossier de', 'demande de permis de construire concernant la construction d’une maison individuelle au 4', 'Rue du Calvaire.'],
  'PC 088 081 26 00006', 'de permis de construire'), { city, file });
  assert.deepEqual([house.dossier, house.address, house.filedOn], ['PC 088081 26 00006', '4 Rue du Calvaire', '2026-07-31']);
  // A certificate (« CUb ») gives no row, nor does a sentence with no numbered site.
  assert.deepEqual(readBussangNotice(BUSSANG_NOTICE(['Le 30 juin 2026 a été déposé en Mairie par Mme PRIVATE PERSON, un dossier de demande de', 'Certificat d’Urbanisme opérationnel concernant la construction de 2 maisons Route de Chamaka.'], 'CUb 088 081 26 00017'), { city, file }), []);
  assert.deepEqual(readBussangNotice(BUSSANG_NOTICE(['Le 2 juillet 2026 a été déposé en Mairie par M. PRIVATE PERSON un dossier de Déclaration', 'Préalable concernant la construction d’un abri.']), { city, file }), []);
});

test('Bussang’s notices of filing are read by their sub-category, its orders by frame, the town’s other shelves left out', () => {
  assert.deepEqual(picked('digilor-bussang', [
    doc(1, 2293, 2797, 'DP 33 2026 PRIVATE extension'), doc(2, 2293, 2795, 'DP 39 2026 PRIVATE modif ouvertures'), doc(3, 2293, 2794, 'PC 06 2026 PRIVATE chalet'),
    doc(4, 2302, 0, 'Arrete_367_crise_Moselle'), doc(5, 2299, 0, 'Arrêté de police'), doc(6, 2293, 2797, 'DP 30 2026 PRIVATE abri', '2026-06-30'),
  ]), [
    ['1.pdf', 'filings', 'digilor-bussang-notice'], ['2.pdf', 'decisions', 'digilor-frame-act'], ['3.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('Kuntzig’s files are told by the word of their title, a bare number and name left to the act’s own heading — its certificates left out', () => {
  assert.deepEqual(picked('digilor-kuntzig', [
    doc(1, 5228, 8618, 'DP2600033 PRIVATE DEPOT'), doc(2, 5228, 8618, 'DP2600033 PRIVATE DECISION'), doc(3, 5228, 8618, 'DP2600029 PRIVATE'),
    doc(4, 5228, 8616, 'PC2600002 PRIVATE DECISION'), doc(5, 5228, 8649, 'CU2600019 PRIVATE DECISION'), doc(6, 5243, 0, '2026_028 ARRETE STATIONNEMENT'),
    doc(7, 5228, 8618, 'DP2600015 PRIVATE DEPOT', '2026-06-30'),
  ]), [
    ['1.pdf', 'filings', 'digilor-frame-act'], ['2.pdf', 'decisions', 'digilor-frame-act'], ['3.pdf', 'decisions', 'digilor-frame-act'], ['4.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('a frame act whose street ends on « rue » is read all the same — Kuntzig’s « Grand Rue » and « Grand’rue », no cut street', () => {
  const city = town('digilor-kuntzig');
  const read = (site, board = 'decisions') => readFrameAct(FRAME_ORDER({ number: 'N° DP 57 372 2600023', site }), { city, file: { board, title: 'DP2600023 PRIVATE DECISION', published: '2026-08-06' } })[0];
  assert.deepEqual([read('Sur un terrain sis à : 71 Grand Rue').dossier, read('Sur un terrain sis à : 71 Grand Rue').address], ['DP 057372 26 00023', '71 Grand Rue']);
  assert.equal(read('Sur un terrain sis à : 28 Grand’rue').address, '28 Grand’rue');
  assert.doesNotMatch(JSON.stringify(read('Sur un terrain sis à : 71 Grand Rue')), PRIVATE);
});

/** Roncourt's State notice: labels with bullets before them, footnote marks after the works. */
const RONCOURT_NOTICE = (works = 'Véranda [1, 2, 3, 4, 5]') => ({ pages: [{ runs: [
  ...words('Avis de dépôt', 40, 728), ...words('REPUBLIQUE FRANÇAISE', 40, 701), ...words('Commune de RONCOURT', 40, 687),
  ...words('AVIS DE DÉPÔT D’UNE DEMANDE D’AUTORISATION D’URBANISME', 40, 662),
  ...words('e__ Numéro d’enregistrement : DP 57 593 26 0030', 40, 572), ...words('+ Date du dépôt : 11/08/2026', 40, 548), ...words('°e Type de demande : Déclaration préalable', 40, 524),
  ...words('+ Nom / Raison sociale du demandeur : PRIVATE PERSON', 40, 500), ...words('e Adresse du terrain du projet : 38 Rue de Jaumont 57860 RONCOURT', 40, 475),
  ...words('+ __ Références cadastrales : B 929', 40, 451), ...words(`° Nature du projet : ${works}`, 40, 426), ...words('Fait à RONCOURT, le 11/08/2026', 40, 238),
] }] });

test('Roncourt’s notice gives the number, the filing day, the site, the parcel and the works without the footnote marks — never the applicant', () => {
  const city = town('digilor-roncourt');
  const [row] = readFrameAct(RONCOURT_NOTICE(), { city, file: { board: 'filings', title: 'Avis de dépôt DP57593260030', published: '2026-08-12' } });
  assert.deepEqual([row.board, row.dossier, row.address, row.parcels, row.purpose, row.filedOn],
    ['filings', 'DP 057593 26 00030', '38 Rue de Jaumont', 'B 929', 'Véranda', '2026-08-11']);
  assert.equal(row.applicant, null);
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

test('Roncourt’s notices are picked on 9410, its orders on 9411 by their title — the plan’s deliberations beside them left out', () => {
  assert.deepEqual(picked('digilor-roncourt', [
    doc(1, 5555, 9410, 'Avis de dépôt DP57593260030'), doc(2, 5555, 9411, 'DP57593260025_DecisionNonOpposition'), doc(3, 5555, 9411, 'DECISION DP 57 593 26 0023'),
    doc(4, 5555, 9411, '20260928_Bureau_DELIB_P61_DIR_COM'), doc(5, 5564, 0, '2026.09.03_Arrete-PRIVATE'), doc(6, 5555, 9410, 'RECEPISSE DP 57593260026', '2026-05-22'),
  ]), [
    ['1.pdf', 'filings', 'digilor-frame-act'], ['2.pdf', 'decisions', 'digilor-frame-act'], ['3.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('a frame act keeps the parcels its label names as the cadastre writes them, and drops a number dematdoc made one of — Pournoy’s « 57554 05 344 »', () => {
  const city = town('digilor-pournoy-la-grasse');
  const file = { board: 'decisions', title: 'DP 057 554 26 00018 - PRIVATE', published: '2026-08-31' };
  const parcels = (label) => readFrameAct(FRAME_ORDER({ number: 'N° DP 057 554 26 00018', parcels: label }), { city, file })[0].parcels;
  assert.equal(parcels('Références cadastrales : AD 0288, AD 290'), 'AD 288, AD 290');
  assert.equal(parcels('Parcelle(s) : B 929'), 'B 929');
  // The site wraps its town onto the next line, and the cadastre label follows with the commune's code and a numbered section.
  const wrapped = FRAME_ORDER({ number: 'N° DP 057 554 26 00018', site: 'Sur un terrain sis à : 6 Rue des Tournesols à', parcels: 'Pournoy-La-Grasse (57420)' });
  wrapped.pages[0].runs.push(...words('Références cadastrales : 57554 05 344', 40, 366),
    // …and the letter asks for a plan « sur le site www.cadastre.gouv.fr ; échelle 1/1000 », which reads as parcels « OU 1 ».
    ...words('Un exemplaire est téléchargeable sur le site www.cadastre.gouv.fr ; échelle 1/1000 ou 1/2000', 40, 330));
  const [row] = readFrameAct(wrapped, { city, file });
  assert.deepEqual([row.address, row.parcels], ['6 Rue des Tournesols', null]);
});

test('Pournoy-la-Grasse’s applications are filings, its orders decisions — certificates left out, the order posted on no sub-category picked by title', () => {
  assert.deepEqual(picked('digilor-pournoy-la-grasse', [
    doc(1, 6444, 11419, 'DP 057 554 26 00018'), doc(2, 6444, 11422, 'PRIVATE - DP 057 554 26 00024'), doc(3, 6444, 11422, 'CU 057 554 26 00007 - Décision'),
    doc(4, 6444, 0, 'PC 057 554 25 00002 M01 - PRIVATE'), doc(5, 6444, 0, 'Mandat dépôt DLE'), doc(6, 6458, 0, 'Révision du PLU'), doc(7, 6444, 11422, 'DP 057 554 26 00010', '2026-06-30'),
  ]), [
    ['1.pdf', 'filings', 'digilor-frame-act'], ['2.pdf', 'decisions', 'digilor-frame-act'], ['4.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('Flévy’s orders are picked on 9295 and 11614, its receipts, which name no site, left out', () => {
  assert.deepEqual(picked('digilor-flevy', [
    doc(1, 5508, 9295, 'DECISION DP 0572192600016 PRIVATE'), doc(2, 5508, 11614, 'PC05721924M0003 RETRAIT/ PRIVATE'), doc(3, 5508, 9294, 'DP 057 219 2600017 PRIVATE'),
    doc(4, 5508, 9292, 'DP 057 219 24M0018 INCOMPLET'), doc(5, 5507, 9281, 'ARRETE 40 B ENTRETIEN DES JARDINS'), doc(6, 5508, 9295, 'DECISION 2600012 PRIVATE', '2026-06-30'),
  ]), [
    ['1.pdf', 'decisions', 'digilor-frame-act'], ['2.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('a frame act’s number is the act’s own when the title mistypes the kind — Flévy’s « PD » title over a DP', () => {
  const city = town('digilor-flevy');
  const file = { board: 'decisions', title: 'DECISION PRIVATE PERSON PD 057 219 2600018', published: '2026-07-31' };
  const [row] = readFrameAct(FRAME_ORDER({ number: 'N° DP 057 219 26 00018', site: 'Sur un terrain sis : 4 Rue d’Ennery' }), { city, file });
  assert.equal(row.dossier, 'DP 057219 26 00018');
  assert.doesNotMatch(JSON.stringify(row), PRIVATE);
});

test('Hauconcourt’s notices of filing and orders are picked on their sub-categories, its receipts and its ERP works left out', () => {
  assert.deepEqual(picked('digilor-hauconcourt', [
    doc(1, 243, 7024, 'AVIS DE DEPOT DP 057 303 26 00014'), doc(2, 242, 7023, 'AVIS DE DEPOT PC0573032600003'), doc(3, 243, 373, 'ARRETE DP 057 303 26 00008'),
    doc(4, 242, 370, 'ARRETE PC05730324M0010-M01'), doc(5, 243, 371, 'récépissé DP 057 303 26 00014'), doc(6, 242, 369, 'RECEPISSE PC0573032600003'),
    doc(7, 244, 375, 'ARRETE AT 057 303 2600006'), doc(8, 243, 7024, 'avis dépôt DP0573032600005', '2026-06-30'),
  ]), [
    ['1.pdf', 'filings', 'digilor-frame-act'], ['2.pdf', 'filings', 'digilor-frame-act'], ['3.pdf', 'decisions', 'digilor-frame-act'], ['4.pdf', 'decisions', 'digilor-frame-act'],
  ]);
});

test('a frame act’s site loses the bracket that opens an aside its line cut short, and its decision day must fall between the filing and the posting', () => {
  const city = town('digilor-hauconcourt');
  const file = { board: 'decisions', title: 'ARRETE PC05730324M0010-M01', published: '2026-07-24' };
  const [row] = readFrameAct(FRAME_ORDER({ number: 'N° PC 057 303 24 M0010 M01', site: 'Sur un terrain sis à : lieu-dit Maizières Les, A31 - [sortie Maizières-' }), { city, file });
  assert.equal(row.address, 'lieu-dit Maizières Les, A31');
  // « Le 9 septembre 2026 » signs the fixture’s order: after a posting on 24 July, it is no decision day.
  assert.equal(row.decidedOn, null);
  const later = readFrameAct(FRAME_ORDER(), { city: town('digilor-saulcy-sur-meurthe'), file: { ...file, published: '2026-09-24' } })[0];
  assert.equal(later.decidedOn, '2026-09-09');
});

test('a frame act whose site is a lieu-dit alone gives no row, the Amnéville fallback included — Saulcy’s « ANOZEL »', () => {
  const city = town('digilor-saulcy-sur-meurthe');
  const file = { board: 'decisions', title: 'DP n° 34-2026', published: '2026-08-20' };
  assert.deepEqual(readFrameAct(FRAME_ORDER({ site: 'Sur un terrain sis à : ANOZEL' }), { city, file }), []);
});
