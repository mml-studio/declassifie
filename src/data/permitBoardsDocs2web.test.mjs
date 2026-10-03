import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCS2WEB_BOARD_PROTOCOLS, docs2webFiles, docs2webPapers, docs2webStreet } from './permitBoardsDocs2web.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS } from './permitBoards.js';
import { DOCS2WEB_CITIES } from './docs2webCities.js';
import { PERMIT_LIST_READERS, permitListFor } from './permitListsFeed.js';

const city = (insee) => BOARD_PERMIT_SOURCES.find((source) => source.key === `docs2web-${insee}`);
const paper = (name, path, attributes = 'real_date_debut="30/09/2026" date_debut="30/09/2026"') =>
  `<paper nameForOrder="x" name="${name}" date="21/11/2026" ${attributes} path="${path}" fileInAdmin="/1${path}">`;
// The tree is XML in a script, its quotes escaped, as the kiosk serves it.
const script = (xml) => `var params = "${xml.replace(/"/g, '\\"')}";`;

test('the Docs2Web communes are in the permit registry, read by one protocol and the DematDOC act reader', () => {
  assert.ok(DOCS2WEB_CITIES.length >= 1);
  for (const { insee } of DOCS2WEB_CITIES) {
    assert.equal(permitListFor(insee), city(insee), insee);
    assert.equal(city(insee).source.protocol, 'docs2web');
    assert.equal(city(insee).source.ocr, true);
    assert.match(city(insee).page, /\/$/, 'params.js is asked beside the page');
  }
  assert.equal(BOARD_PROTOCOLS.docs2web, DOCS2WEB_BOARD_PROTOCOLS.docs2web);
  assert.equal(typeof PERMIT_LIST_READERS['dematdoc-notice'], 'function');
});

test('a name gives a numbered street from its house number on, never the name before it nor the segments after', () => {
  assert.equal(docs2webStreet('Avis de dépôt DP26 83 M. PRIVATE 66b rue de Comines'), '66b rue de Comines');
  assert.equal(docs2webStreet('Arrêté DP 26 0 0039 - 23 rue de Turenne'), '23 rue de Turenne');
  assert.equal(docs2webStreet('Récépissé PC 059 098 26 0 0007 - 14 rue de Wervicq (2)'), '14 rue de Wervicq');
  assert.equal(docs2webStreet('PC0723502600018 - ACCORD AVEC PRESCRIPTIONS - RUE DES ALOUETTES - PRIVATE'), null, 'no house number, no site');
});

test('a tree gives each urbanism paper that names a dossier, its board from its name, else its folders', () => {
  const xml = [
    '<theme name="theme1"><subtheme name="1 URBANISME">',
    '<subtheme name="AVIS DE DEPÔT"><subtheme name="PC">',
    paper('PC 03712226J0040', '/pc-26j0040.pdf'),
    '</subtheme></subtheme>',
    '<subtheme name="ARRETES MUNICIPAUX"><subtheme name="DP">',
    paper('DP 03712225J0355', '/dp-25j0355.pdf', 'date_debut="Never" dateFileInAdmin="31/07/2026 11:58:47"'),
    paper('DP 03712226J0101 - 9 ter rue de Chantepie', '/dp-26j0101.pdf', 'date_debut="15/09/2026"'),
    paper('DP 03712226J0101 - 9 ter rue de Chantepie', '/dp-26j0101.pdf', 'real_date_debut="15/09/2026" date_debut="15/11/2026"'),
    '</subtheme><subtheme name="Certificats d&apos;Urbanisme">',
    paper('CU 03712226J0304', '/cu-26j0304.pdf'),
    '</subtheme></subtheme>',
    '</subtheme><subtheme name="CONSEIL MUNICIPAL">',
    paper('PC 03712226J0041', '/conseil.pdf'),
    '</subtheme></theme>',
  ].join('');
  const papers = docs2webPapers(script(xml));
  assert.equal(papers[1].posted, '2026-07-31', 'a paper never scheduled is dated by its upload');
  const files = docs2webFiles(city('37122'), papers, '2026-08-01', '2026-10-03');
  assert.deepEqual(files.map((file) => [file.row.dossier, file.board, file.published, file.row.address]), [
    ['PC 037122 26 J0040', 'filings', '2026-09-30', null],
    ['DP 037122 26 J0101', 'decisions', '2026-09-15', '9 ter rue de Chantepie'],
  ], 'listed twice, read once; a certificate and a council paper are not permits');
  assert.equal(files[0].url, 'https://www.jouelestours.fr/wp-content/uploads/adtm/content/pc-26j0040.pdf');
  assert.ok(files.every((file) => file.layout === 'dematdoc-notice' && file.ocr));
});

test('the name’s words say the board and the verdict, and a counter typed apart is one number', () => {
  const xml = [
    '<theme name="theme1"><subtheme name="02- URBANISME"><subtheme name="Déclaration préalable">',
    paper('Arrêté DP 26 0 0039 - 23 rue de Turenne', '/arrete-dp-26-0-0039.pdf'),
    paper('Récépissé PC 059 098 26 0 0007 - 14 rue de Wervicq', '/recepisse-pc-26-0-0007.pdf'),
    paper('Courrier annulation DP 26 0 0046 - 39 rue du Château', '/courrier.pdf'),
    '</subtheme></subtheme></theme>',
  ].join('');
  const files = docs2webFiles(city('59098'), docs2webPapers(script(xml)), '2026-08-01');
  assert.deepEqual(files.map((file) => [file.row.dossier, file.board, file.row.verdict ?? null]), [
    ['DP 059098 26 00039', 'decisions', 'Décision signée'],
    ['PC 059098 26 00007', 'filings', null],
  ], 'a letter is not an act');
  const teloche = docs2webFiles({ key: 'teloche', insee: '72350', postcode: '72220', page: 'https://www.screensoft.eu/Docs2Web/x/', source: {} }, docs2webPapers(script(
    `<theme name="t"><subtheme name="04-URBANISME"><subtheme name="DÉCLARATION PRÉALABLE">${
      paper('DP0723502600051 - TACITE - RUE DES BLEUETS - PRIVATE', '/dp0723502600051.pdf')
    }${paper('PC0723502600021 - DEPOT - RUE DES DEUX CHENES - PRIVATE', '/pc0723502600021.pdf')}</subtheme></subtheme></theme>`)), '2026-08-01');
  assert.deepEqual(teloche.map((file) => [file.row.dossier, file.board, file.row.verdict ?? null]), [
    ['DP 072350 26 00051', 'decisions', 'Accord tacite'],
    ['PC 072350 26 00021', 'filings', null],
  ]);
  assert.doesNotMatch(JSON.stringify(teloche), /PRIVATE/);
});

test('a paper posted before the window or scheduled after the day is left out', () => {
  const xml = `<theme name="t"><subtheme name="Urbanisme">${
    paper('Arrêté DP26 70', '/old.pdf', 'real_date_debut="20/07/2026"')
  }${paper('Arrêté DP26 71', '/later.pdf', 'date_debut="12/10/2026"')}${paper('Arrêté DP26 72', '/now.pdf')}</subtheme></theme>`;
  const files = docs2webFiles(city('59098'), docs2webPapers(script(xml)), '2026-08-01', '2026-10-03');
  assert.deepEqual(files.map((file) => file.row.dossier), ['DP 059098 26 00072']);
  assert.equal(docs2webPapers('var params = "";'), null);
});
