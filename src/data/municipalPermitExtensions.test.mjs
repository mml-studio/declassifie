import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTENDED_PERMIT_SOURCES, digilorTitleRow, lorientBoardUrl, permitListGeocodeAccepted,
  readBloisFilings, readExtendedNotice, readLorientBoard, rueilTitleRow,
} from './municipalPermitExtensions.js';
import { digilorDocuments, normalisePermitListRow, permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const city = (key) => EXTENDED_PERMIT_SOURCES.find((source) => source.key === key);
const run = (x, y, text) => ({ x, y, text });

test('all 30 additional municipalities use the existing archived permit path', () => {
  assert.equal(EXTENDED_PERMIT_SOURCES.length, 30);
  assert.equal(EXTENDED_PERMIT_SOURCES.filter((source) => source.source.kind === 'lorient').length, 25);
  for (const source of EXTENDED_PERMIT_SOURCES) assert.equal(permitListFor(source.insee), source);
  assert.equal(permitListFor('56094'), null, 'the five empty legacy selectors are not coverage');
});

test('Lorient validates the commune and both board shapes, preserving verdicts and modifications', () => {
  const c = city('lorient-56121');
  const html = "local_secret[56121] = '0123456789abcdef01234567';";
  assert.equal(new URL(lorientBoardUrl(c, html, 'decisions')).searchParams.get('TYPE'), 'DEC');
  assert.equal(lorientBoardUrl(c, html.replace('56121', '56162'), 'filings'), null);
  const raw = { dossier: 'DP 56121 26 L0001 M02', terrain: '3 Rue de l’&Eacute;tang',
    depot: '02/09/2026', decision_date: '24/09/2026', decision_texte: 'Rejet tacite',
    nature_detail: 'Façade_extérieure', applicant: 'PRIVATE PERSON' };
  const json = { MSG: 'OK', DATA: { INSEE: '56121', TYPE_RQ: 'DEC', PC: [], DP: [raw], PA: [], PD: [], CU: [] } };
  const [row] = readLorientBoard(c, 'decisions', json);
  assert.equal(row.address, '3 Rue de l’Étang');
  assert.equal(row.purpose, 'Façade extérieure');
  assert.equal(row.dossier, 'DP 056121 26 L0001 M02');
  assert.equal(normalisePermitListRow(c, 'decisions', row).state, 'refuse');
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE/);
  assert.equal(readLorientBoard(c, 'decisions', { ...json, DATA: { ...json.DATA, INSEE: '56162' } }), null);
  assert.equal(readLorientBoard(c, 'decisions', { ...json, DATA: { ...json.DATA, PA: undefined } }), null);
  for (const [verdict, state] of [['Favorable avec prescriptions', 'accorde'], ['Octroi tacite', 'accorde'], ['Retrait', 'annule'], ['Irrecevable', 'annule']]) {
    const [item] = readLorientBoard(c, 'decisions', { ...json, DATA: { ...json.DATA, DP: [{ ...raw, decision_texte: verdict }] } });
    assert.equal(normalisePermitListRow(c, 'decisions', item).state, state);
  }
  assert.deepEqual(readLorientBoard(c, 'decisions', { ...json, DATA: { ...json.DATA, DP: [] } }), []);
});

test('mixed Digilor shelves separate lists from decisions and exclude unrelated acts', () => {
  const c = city('blois');
  const doc = (title, shelf = 2422) => ({ id_cat: 2018, id_sscat: shelf, nom_affichage: title, aff_deb: '2026-09-25', url_uiid: './upload/228/example.pdf' });
  const docs = digilorDocuments(c, [doc('LISTE DES DOSSIERS DEPOSES DU 21 AU 27 09 2026'),
    doc('ARRETE DP 41018 26 00001 PRIVATE PERSON 3 RUE EXEMPLE BLOIS'),
    doc('AP 41018 26 00001 PRIVATE PERSON 3 RUE EXEMPLE BLOIS'), doc('Water analysis', 2426)], '2026-09-01');
  assert.deepEqual(docs.map((file) => [file.board, file.layout]), [['filings', 'blois-filings'], ['decisions', 'extended-notice']]);
});

test('Digilor titles locate sites and leave a generic signed decision off the grant ladder', () => {
  const c = city('thionville');
  const file = { board: 'decisions', published: '2026-10-01', title: 'PC0576722600001_PRIVATE_PERSON_3_RUE_EXEMPLE_ARRETE_BAN' };
  const row = digilorTitleRow(c, file);
  assert.equal(row.address, '3 RUE EXEMPLE');
  assert.equal(normalisePermitListRow(c, 'decisions', row).stateLabel, 'Décision signée');
  assert.equal(normalisePermitListRow(c, 'decisions', { ...row, verdict: 'Refus' }).state, 'refuse');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|PERSON|ARRETE_BAN/);
  assert.equal(digilorTitleRow(c, { ...file, title: 'AP0576722600001_PRIVATE_PERSON_3_RUE_EXEMPLE' }), null);
});

test('Rueil numbers join Sitadel and discard applicants on either side of the site', () => {
  const c = city('rueil');
  for (const [title, number, address, verdict] of [
    ['ARRETE DP 2600001 PRIVATE PERSON 82 TALUS_001', 'DP 092063 26 00001', '82 TALUS', 'Décision signée'],
    ['REFUS PC 2400002-02 PRIVATE COMPANY 28 EMPEREUR LOT1_001', 'PC 092063 24 00002 M02', '28 EMPEREUR', 'Refus'],
    ['ARRETE DP 2400003-M01 11 DELILLE MME PRIVATE PERSON_001', 'DP 092063 24 00003 M01', '11 DELILLE', 'Décision signée'],
    ['ARRETE DP 2600004 PRIVATE PERSON 52 M.L.DE HAUTECLOQUE_001', 'DP 092063 26 00004', '52 M.L.DE HAUTECLOQUE', 'Décision signée'],
    ['ARRETE DP 2600005 3 RUE DANTON SA PRIVATE COMPANY_001', 'DP 092063 26 00005', '3 RUE DANTON', 'Décision signée'],
  ]) {
    const row = rueilTitleRow(c, { title, published: '2026-09-25', decidedOn: '2026-09-24' });
    assert.deepEqual([row.dossier, row.address, row.verdict, row.decidedOn], [number, address, verdict, '2026-09-24']);
    assert.doesNotMatch(JSON.stringify(row), /PRIVATE|PERSON|COMPANY/);
  }
  for (const title of ['ARRETE INTERRUPTIF PC 2600001 82 TALUS_001', 'ARRETE AP 2600001 82 TALUS_001', 'ARRETE DP 2600001 PRIVATE PERSON_001']) {
    assert.equal(rueilTitleRow(c, { title }), null);
  }
});

test('an individual decision reads the project address and operative article, excluding applicant and recitals', () => {
  const c = city('bondy');
  const doc = { pages: [{ width: 595, runs: [
    run(33, 700, 'Dossier n° PC 093010 26 B0001'), run(33, 680, 'Déposé le 01/09/2026'),
    run(33, 660, 'Demandeur : PRIVATE PERSON'), run(33, 645, '99 rue du Demandeur'),
    run(33, 620, 'Adresse des travaux :'), run(310, 620, 'Surface de plancher : 100 m2'),
    run(33, 605, '3 rue Exemple 93140 Bondy'), run(33, 580, 'Vu l’avis favorable du service'),
    run(33, 550, 'ARTICLE 1 : Le permis de construire est REFUSE'),
  ] }] };
  const [row] = readExtendedNotice(doc, { city: c, file: { board: 'decisions', published: '2026-09-25' } });
  assert.equal(row.address, '3 rue Exemple');
  assert.equal(row.verdict, 'Refus');
  assert.equal(row.filedOn, '2026-09-01');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|Demandeur|Surface|favorable/);
  assert.deepEqual(readExtendedNotice({ pages: [{ runs: [run(30, 10, 'Document publié le 25/09/2026')] }] }, { city: c, file: { board: 'decisions' } }), []);
});

test('Blois reads parcels and dates, including repeated headers, without reading the terrain owner', () => {
  const doc = { pages: [{ runs: [
    run(43, 638, 'Dossier'), run(191, 638, 'Terrain'), run(402, 638, 'Description'),
    run(43, 620, 'AP 41018 26 00001'), run(191, 620, 'sis 9 rue Advertisement'),
    run(43, 517, 'DP 41018 26 00002'), run(43, 507, 'Dépôt le 21/09/2026'),
    run(43, 497, 'par PRIVATE APPLICANT'), run(191, 519, 'Terrain : DO0365 DR0169'),
    run(191, 509, 'sis 3 RUE EXEMPLE'), run(191, 499, 'Surface : 37m²'),
    run(191, 489, 'Propriétaire : PRIVATE OWNER'), run(402, 520, 'Projet : Façade'),
  ] }] };
  const [row] = readBloisFilings(doc);
  assert.deepEqual([row.dossier, row.address, row.parcels, row.filedOn, row.landArea], ['DP 041018 26 00002', '3 RUE EXEMPLE', 'DO 0365, DR 0169', '2026-09-21', '37']);
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|OWNER|APPLICANT|Advertisement/);
  assert.equal(normalisePermitListRow(city('blois'), 'filings', row).parcelIdus.length, 2);
});

test('Rueil geocodes require the same municipality, house number and street suffix', () => {
  const c = city('rueil');
  const permit = { address: '6 J. DE LA FONTAINE' };
  const hit = { result_type: 'housenumber', result_citycode: '92063', result_score: '0.51', result_name: '6 Rue Jean de la Fontaine', result_housenumber: '6' };
  assert.equal(permitListGeocodeAccepted(c, permit, hit), true);
  for (const wrong of [{ result_citycode: '92050' }, { result_type: 'street' }, { result_housenumber: '8' }, { result_name: '6 Rue Jean de la Bruyère' }, { result_score: '0.29' }, { result_score: undefined }]) {
    assert.equal(permitListGeocodeAccepted(c, permit, { ...hit, ...wrong }), false);
  }
  assert.equal(permitListGeocodeAccepted(c, { address: '3 BIS TALUS' }, { ...hit, result_name: '3bis Rue des Talus', result_housenumber: '3bis' }), true);
});

test('Rueil removes a PDF locality suffix before checking the published street', () => {
  const c = city('rueil');
  const doc = { pages: [{ runs: [run(30, 700, 'DP 092063 26 00001'),
    run(30, 680, 'Sur un terrain situé à : 39 rue des Lilas à Rueil-Malmaison'),
    run(30, 660, 'ARTICLE 1 : Il n’est pas fait opposition au projet')] }] };
  const [row] = readExtendedNotice(doc, { city: c, file: { board: 'decisions' } });
  assert.equal(row.address, '39 rue des Lilas');
  assert.equal(row.verdict, 'Non-opposition');
  assert.equal(permitListGeocodeAccepted(c, row, { result_type: 'housenumber', result_citycode: '92063',
    result_score: '0.8', result_name: '39 Rue des Lilas', result_housenumber: '39' }), true);
});
