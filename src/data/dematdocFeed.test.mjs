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
