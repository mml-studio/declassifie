import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCS2WEB_BOARD_PROTOCOLS, docs2webFiles, docs2webPapers, docs2webStreet, readDocs2webAct } from './permitBoardsDocs2web.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS, BOARD_READERS } from './permitBoards.js';
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

// A SaaS tenant's paper: its media address and its QR link, an opaque token, beside its path.
const saasPaper = (name, file, day = '30/09/2026') => paper(name, `/${file}`, `real_date_debut="${day}" date_debut="${day}"`)
  .replace(`fileInAdmin="/1/${file}"`, `fileInAdmin="/7500/${file}" qrcode="https://www.screensoft.eu/media.php?params=${btoa(file).replace(/\W/g, '')}%3D"`);

test('an unnamed SaaS kiosk is read folder by folder, every paper from its media address, known by its QR link, nothing taken from its name', () => {
  const xml = [
    '<theme name="theme1"><subtheme name="Urbanisme">',
    '<subtheme name="Déclarations préalables">',
    saasPaper('M. PRIVATE PERSON', 'm--private-person_1.pdf'),
    saasPaper('M. PRIVATE PERSON', 'm--private-person_1.pdf'),
    saasPaper('PRIVATE SCI 12 rue Privée', 'private-sci.pdf', '20/07/2026'),
    '</subtheme><subtheme name="Permis de construire">',
    saasPaper('Mme PRIVATE (2)', 'mme-private_3.pdf', '01/10/2026'),
    '</subtheme><subtheme name="Dépôt des demandes d&apos;autorisations d&apos;urbanisme">',
    saasPaper('M. PRIVATE OTHER', 'm--private-other.pdf'),
    '</subtheme><subtheme name="Foncier">',
    saasPaper('Cession PRIVATE', 'cession.pdf'),
    '</subtheme></subtheme></theme>',
  ].join('');
  const valette = city('83144');
  assert.equal(valette.robots, 'overridden');
  const files = docs2webFiles(valette, docs2webPapers(script(xml)), '2026-08-01', '2026-10-03');
  assert.deepEqual(files.map((file) => [file.board, file.published, file.requestUrl]), [
    ['decisions', '2026-09-30', 'https://www.screensoft.eu/frontend/images/MT_medias/7500/m--private-person_1.pdf'],
    ['decisions', '2026-10-01', 'https://www.screensoft.eu/frontend/images/MT_medias/7500/mme-private_3.pdf'],
  ], 'listed twice, read once; receipts and land sales are other folders; July is before the window');
  for (const file of files) {
    assert.match(file.url, /^https:\/\/www\.screensoft\.eu\/media\.php\?params=\w+%3D$/);
    assert.equal(file.row, undefined, 'the number and site come from the PDF alone');
    assert.equal(file.layout, 'docs2web-act');
    assert.equal(file.scan, true);
    assert.equal(file.ocr, true);
  }
  assert.doesNotMatch(JSON.stringify(files.map(({ requestUrl, ...file }) => file)), /PRIVATE|private/i, 'no name in what a reading keeps');
  assert.equal(BOARD_READERS['docs2web-act'], readDocs2webAct);
});

/** A page of positioned runs: [x, y, text], top of the page first. */
const page = (...runs) => ({ pages: [{ runs: runs.map(([x, y, text]) => ({ x, y, x1: x + text.length * 4.5, text })) }] });

test('an act read without its name takes the verdict its Objet line or its heading gives, and a certificate of urbanism is not a permit', () => {
  const context = (file = {}) => ({ city: city('83144'), file: { board: 'decisions', title: '', published: '2026-10-01', ...file } });
  const letter = (number, object) => page(
    [300, 800, 'À rappeler dans toute correspondance'],
    [300, 788, `DOSSIER : N° ${number}`],
    [300, 776, 'Demande du : 14/09/2026'],
    [300, 740, 'ADRESSE DES TRAVAUX :'],
    [60, 728, 'COMMUNE DE'], [300, 728, '114 Avenue Exemple'],
    [300, 716, '83160 LA VALETTE-DU-VAR'],
    [300, 680, 'DEMANDEUR :'],
    [300, 668, 'Monsieur PRIVATE PERSON'],
    [300, 656, '9 rue Privée'],
    [60, 620, `OBJET : ${object}`],
    [60, 590, 'Monsieur,'],
  );
  const [withdrawn] = readDocs2webAct(letter('DP 083 144 26 00132', 'Retrait avant décision d’une Déclaration Préalable.'), context());
  assert.deepEqual([withdrawn.dossier, withdrawn.address, withdrawn.verdict], ['DP 083144 26 00132', '114 Avenue Exemple', 'Retrait']);
  assert.doesNotMatch(JSON.stringify(withdrawn), /PRIVATE|Privée/);
  const [rejected] = readDocs2webAct(letter('PC 083 144 26 00027', 'Décision tacite de rejet'), context());
  assert.equal(rejected.verdict, 'Décision signée', 'no verdict the layer knows: a signed decision');
  assert.deepEqual(readDocs2webAct(letter('CU 083 144 26 00419', 'Récépissé'), context()), []);
  const certificate = page(
    [200, 800, 'COMMUNE DE SAINT-ISMIER'],
    [200, 788, 'Arrêté n° URB/2026/DP/tac/36'],
    [150, 776, 'CERTIFICAT DE NON OPPPOSITION A UNE DEMANDE DE'],
    [150, 764, 'DECLARATION PREALABLE TACITE'],
    [60, 740, 'DEMANDE n° DP 038397 26 10106 Déposée le 04/09/2026'],
    [60, 700, 'Par : PRIVATE PERSON'],
    [60, 688, 'Demeurant : 9 rue Privée - 38000 Exemple'],
    [60, 676, 'Parcelle(s) cadastrée(s) : AN73'],
    [60, 664, 'Sur un terrain sis : 117 Chemin De Chartreuse - 38330 Saint-Ismier'],
  );
  const [tacit] = readDocs2webAct(certificate, { city: { key: 'x', insee: '38397', postcode: '38330', name: 'Saint-Ismier' }, file: { board: 'decisions', title: '' } });
  assert.deepEqual([tacit.dossier, tacit.address, tacit.parcels, tacit.verdict], ['DP 038397 26 10106', '117 Chemin De Chartreuse', 'AN 73', 'Accord tacite']);
});

test('a kiosk of daily lists reads each list whole with the grid reader, its board from its folder, never by OCR', () => {
  const list = (name, file, day) => paper(name, `/${file}`, `real_date_debut="${day}" date_debut="${day}"`)
    .replace(`fileInAdmin="/1/${file}"`, `fileInAdmin="/6066/${file}" qrcode="https://www.screensoft.eu/media.php?params=${btoa(file).replace(/\W/g, '')}%3D"`);
  const xml = [
    '<theme name="theme1"><subtheme name="URBANISME"><subtheme name="Catégorie">',
    '<subtheme name="DEPOT DE DOSSIERS">',
    list('Affichage dépôt du 18 août 2026', 'affichage-d--p--t-du-18-ao--t-2026.pdf', '18/08/2026'),
    '</subtheme><subtheme name="ARRETES">',
    list('Affichage décision du 18 août 2026', 'affichage-d--cision-du-18-ao--t-2026.pdf', '18/08/2026'),
    '</subtheme></subtheme></subtheme>',
    '<subtheme name="ARRETES MUNICIPAUX"><subtheme name="TRAVAUX ET CIRCULATIONS">',
    list('Arrêté de circulation rue X', 'circulation.pdf', '18/08/2026'),
    '</subtheme></subtheme></theme>',
  ].join('');
  const files = docs2webFiles(city('59526'), docs2webPapers(script(xml)), '2026-08-01', '2026-10-04');
  const base = 'https://www.screensoft.eu/Docs2Web/1680%20-%20MAIRIE%20DE%20SAINT%20AMAND%20LES%20EAUX/content/';
  assert.deepEqual(files.map((file) => [file.board, file.layout, file.ocr, file.requestUrl]), [
    ['filings', 'grid', false, `${base}affichage-d--p--t-du-18-ao--t-2026.pdf`],
    ['decisions', 'grid', false, `${base}affichage-d--cision-du-18-ao--t-2026.pdf`],
  ]);
  assert.ok(files.every((file) => file.row === undefined && !file.scan));
});

test('an act read by OCR loses the spaced postcode and the misread commune after its site', () => {
  const ismier = city('38397');
  assert.equal(ismier.source.media, true);
  const certificate = (site) => page(
    [150, 776, 'CERTIFICAT DE NON OPPOSITION A UNE DEMANDE DE'],
    [150, 764, 'DECLARATION PREALABLE TACITE'],
    [60, 740, 'DEMANDE n° DP 038397 26 10112 Déposée le 04/09/2026'],
    [60, 664, `Sur un terrain sis : ${site}`],
  );
  const site = (value) => readDocs2webAct(certificate(value), { city: ismier, file: { board: 'decisions', title: '' } })[0]?.address;
  assert.equal(site('357 Chemin du Grand Torrent - 38 330'), '357 Chemin du Grand Torrent');
  assert.equal(site('430 chemin des Semaises — 38 330 Saint-lsmier'), '430 chemin des Semaises');
  assert.equal(site('148 chemin de la source - Saint-lsmier'), '148 chemin de la source');
  assert.equal(site('661 Route de Chambéry - Route Départementale'), '661 Route de Chambéry - Route Départementale');
});
