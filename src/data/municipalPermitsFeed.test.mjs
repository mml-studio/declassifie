import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MUNICIPAL_PERMIT_SOURCES, municipalDate, municipalDossier, municipalSite,
  municipalFiles, municipalNextPage, municipalTitleRow, municipalVerdict,
  dematdocFiles, readMunicipalNotice, readBalmaTable, readWattrelosTable,
} from './municipalPermitsFeed.js';
import { permitListFor, scrubPermitListRow, normalisePermitListRow } from './permitListsFeed.js';

const city = (key) => MUNICIPAL_PERMIT_SOURCES.find((c) => c.key === key);
const run = (text, x, y, x1 = x + text.length * 4, clip = null) => ({ text, x, x1, y, size: 8, clip });
const lines = (words) => ({ pages: [{ runs: words.map((word, i) => run(word, 30, 780 - i * 15)) }] });

test('a counter’s zero typed as a letter O, a « n° » after the type, and the hazard map are not read as part of a dossier or a withdrawal', () => {
  const rurange = { insee: '57602', postcode: '57310', source: { oForZero: true } };
  assert.equal(municipalDossier('DP05760226NO030M01', rurange), 'DP 057602 26 N0030 M01');
  assert.equal(municipalDossier('PC05760226No001', rurange), 'PC 057602 26 N0001');
  assert.equal(municipalDossier('PC05760226No001', { insee: '57602' }), null, 'only a town that types it so: elsewhere the O is OCR’s');
  assert.equal(municipalDossier('DP 06803626R0032', { insee: '68036' }), 'DP 068036 26 R0032');
  assert.equal(municipalDossier('Avis de dépôt DP n° 077 169 26 00024', { insee: '77169' }), 'DP 077169 26 00024');
  assert.equal(municipalDossier('N° DP 077 169 26 00024', { insee: '77169' }), 'DP 077169 26 00024');
  assert.equal(municipalVerdict('Il n’est pas fait opposition. Aléa de retrait-gonflement des argiles'), 'Non-opposition');
  assert.equal(municipalVerdict('retrait gonflement des sols argileux'), null);
  assert.equal(municipalVerdict('Arrêté de retrait de la décision'), 'Retrait');
});

test('the six municipal boards are available through the existing commune lookup', () => {
  assert.equal(MUNICIPAL_PERMIT_SOURCES.length, 6);
  for (const source of MUNICIPAL_PERMIT_SOURCES) assert.equal(permitListFor(source.insee), source);
});

test('abbreviated and wrapped numbers retain municipality, letter and modification', () => {
  assert.equal(municipalDossier('PC 15-9 M03', city('lambersart')), 'PC 059328 15 00009 M03');
  assert.equal(municipalDossier('AFF 2026.09.25 – DP 26A0077', city('acheres')), 'DP 078005 26 A0077');
  assert.equal(municipalDossier('PC 069290 21\n00063 M02', city('saint-priest')), 'PC 069290 21 00063 M02');
  assert.equal(municipalDossier('DP 310442600081M01', city('balma')), 'DP 031044 26 00081 M01');
  assert.equal(municipalDossier('DP 059014 26 00079', city('wattrelos')), null);
  assert.equal(municipalDate('Publié le 1er octobre 2026'), '2026-10-01');
  assert.equal(municipalDate('31 février 2026'), null);
  assert.deepEqual(municipalSite('81 RUE EXEMPLE 69800 (AB116, AB165)', city('saint-priest')),
    { address: '81 RUE EXEMPLE', postcode: '69800', parcels: 'AB 116, AB 165' });
});

test('an unknown decision remains unknown; opposition and withdrawal remain distinct', () => {
  assert.equal(municipalVerdict('Décision défavorable'), 'Refus');
  assert.equal(municipalVerdict('Non-opposition avec prescriptions'), 'Non-opposition');
  assert.equal(municipalVerdict('Retrait'), 'Retrait');
  const file = { title: 'PC 26-47 Extension 15 rue Exemple', board: 'decisions' };
  const row = municipalTitleRow(city('wattrelos'), file);
  assert.equal(row.address, '15 rue Exemple');
  assert.equal(row.verdict, 'Décision signée');
  const permit = normalisePermitListRow(city('wattrelos'), row.board, scrubPermitListRow(row));
  assert.equal(permit.state, 'depose');
  const refusal = municipalTitleRow(city('acheres'), { title: 'AFF 2026.09.10 – DP 26A0066 -7 PLACE EXEMPLE – REFUS', board: 'decisions' });
  assert.equal(refusal.address, '7 PLACE EXEMPLE');
  assert.equal(refusal.verdict, 'Refus');
});

test('filing notices read only labelled project fields and never the applicant address', () => {
  const document = lines(['AVIS DE DÉPÔT', 'travaux non soumis à permis de construire',
    'Dossier numéro : DP 059328 26 00055 M01', 'Date de dépôt en mairie : 09/09/2026',
    'Demandeur : PRIVATE PERSON', '33 Rue Private', '59110 Elsewhere',
    'Adresse du terrain : 10 Rue Exemple', 'Superficie du terrain : 545 m²',
    'Nature des travaux :', 'Surface de plancher : 0 m²', 'Fait à Lambersart', 'Le 10 septembre 2026']);
  const [row] = readMunicipalNotice(document, { city: city('lambersart'), file: { title: '', board: 'filings' } });
  assert.equal(row.address, '10 Rue Exemple');
  assert.equal(row.filedOn, '2026-09-09');
  assert.equal(row.purpose, null);
  assert.equal(row.applicant, null);
  assert.doesNotMatch(JSON.stringify(scrubPermitListRow(row)), /PRIVATE|Elsewhere|non soumis/);
});

test('decisions read the operative article, not the favourable consultation in recitals', () => {
  const document = lines(['ARRÊTÉ', 'DP 059328 26 00266', 'Terrain sis Cadastré BH131',
    'Vu un avis favorable', 'ARTICLE 1 : Il est fait opposition à la demande',
    'Fait à Lambersart', 'Le 9 septembre 2026']);
  const [row] = readMunicipalNotice(document, { city: city('lambersart'), file: {
    title: 'DP 26 266', address: '10 rue Exemple', board: 'decisions' } });
  assert.equal(row.address, '10 rue Exemple');
  assert.equal(row.verdict, 'Refus');
  assert.equal(row.decidedOn, '2026-09-09');
  assert.equal(row.purpose, null);
});

test('a MEL decision reads its project column below the applicant, including the house number', () => {
  const document = { pages: [{ width: 600, runs: [
    run('POUR', 30, 790), run('UNE MAISON', 150, 790),
    run('DESCRIPTION DE LA DEMANDE', 30, 700),
    run('Dossier déposé le 31/07/2026', 30, 680),
    run('Demeurant à :', 30, 620), run('PRIVATE ADDRESS', 150, 620),
    run('Pour', 70, 560), run('Extension', 150, 560),
    run('Sur', 70, 520), run('un', 90, 520), run('15 Rue Exemple - WATTRELOS', 150, 520),
    run('Destination : Habitation', 390, 520), run('terrain sis', 70, 505), run('Cadastré', 150, 505),
    run('ARTICLE 1 : Le permis est accordé', 30, 450),
  ] }] };
  const [row] = readMunicipalNotice(document, { city: city('wattrelos'), file: { title: 'PC 26-47 Extension rue Exemple', board: 'decisions' } });
  assert.equal(row.address, '15 Rue Exemple');
  assert.equal(row.purpose, 'Extension');
  assert.equal(row.filedOn, '2026-07-31');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|Habitation|CADASTRE/i);
});

test('HTML discovery rejects unrelated and cross-origin files; pagination retains filters', () => {
  const acheres = municipalFiles(city('acheres'), '<a href="/files/a.pdf">AFF 2026.09.25 – DP 26A0077 – 2 RUE EXEMPLE – ACCORD</a><a href="https://other.example/b.pdf">PC 26A0001</a><a href="/files/plu.pdf">PLUi</a>');
  assert.equal(acheres.length, 1);
  assert.equal(acheres[0].board, 'decisions');
  assert.equal(acheres[0].published, '2026-09-25');
  const filtered = { ...city('lambersart'), page: `${city('lambersart').page}?categories%5B601%5D=601` };
  const next = municipalNextPage(filtered, '<a href="?page=1" rel="next">Page suivante</a>', filtered.page);
  assert.equal(new URL(next).searchParams.get('categories[601]'), '601');
  assert.equal(municipalNextPage(city('lambersart'), '<a href="https://other.example/?page=1" rel="next">Next</a>', city('lambersart').page), null);
  const lists = dematdocFiles(city('saint-priest'), { documents: [
    { name: 'Permis de construire du 2026-08-01', path: '/old.pdf' },
    { name: 'Permis de construire du 2026-09-29', path: '/new.pdf' },
    { name: 'Liste des avis de dépôt de demande du 2026-09-29', path: '/filings.pdf' },
    { name: 'Permis de construire PC 069290 26 00001', path: '/single.pdf' },
  ] });
  assert.deepEqual(lists.map((f) => new URL(f.url).pathname), ['/filings.pdf', '/new.pdf']);
});

test('Balma clipping bands keep centred applicant cells outside the project', () => {
  const centres = [195, 244, 308, 394, 473, 572, 660, 698];
  const heads = ['Nature', 'Date', 'Numéro du dossier', 'Nom et prénom (ou', 'Adresse du terrain', 'Nature des travaux', 'Surface', 'Hauteur'];
  const clip = { x0: 126, x1: 720, y0: 650, y1: 700 };
  const runs = heads.map((h, i) => run(h, centres[i] - 10, 740, centres[i] + 10));
  ['ACCORD', '07/09/2026', 'DP 310442600081M01', 'PRIVATE PERSON', '7 rue Exemple', 'Extension', '24', '3']
    .forEach((value, i) => runs.push(run(value, centres[i] - 10, 680, centres[i] + 10, clip)));
  const [row] = readBalmaTable({ pages: [{ runs }] }, { city: city('balma') });
  assert.equal(row.board, 'decisions');
  assert.equal(row.address, '7 rue Exemple');
  assert.equal(row.decidedOn, '2026-09-07');
  assert.equal(row.dossier, 'DP 031044 26 00081 M01');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE/);
});

test('positioned filing scans separate applicant, address and works columns', () => {
  const runs = [];
  [['Date de dépôt', 30], ['Numéro de dossier', 155], ['Pétitionnaire', 280], ['Adresse du projet', 410], ['Description du projet', 575]]
    .forEach(([words, x]) => words.split(' ').forEach((word, i) => runs.push(run(word, x + i * 35, 460))));
  ['DP', '059650', '26', '00284'].forEach((word, i) => runs.push(run(word, 155 + i * 25, 430)));
  runs.push(run('25/09/2026', 30, 430), run('PRIVATE PERSON', 280, 430), run('11 Rue Exemple', 410, 430), run('59150 Wattrelos', 410, 417), run('Windows', 575, 430));
  const [row] = readWattrelosTable({ pages: [{ runs }] }, { city: city('wattrelos') });
  assert.equal(row.address, '11 Rue Exemple');
  assert.equal(row.filedOn, '2026-09-25');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE/);
});
