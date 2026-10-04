import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OWN_SITE_BOARD_PROTOCOLS, OWN_SITE_BOARD_READERS, amillyDay, caudryHeading, caudryParcel, clouangeTiles, douvrinPackages, excelDay, maingRows, montessonDecisions, montessonFilings, typedParcels, morangisStreet, queueTitle, sablesListDay, sarregueminesNumber, sglaBoxes, tidyWorks, weekEnd } from './permitBoardsOwnSites.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS, BOARD_READERS } from './permitBoards.js';
import { normalisePermitListRow, permitListFor } from './permitListsFeed.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);

/** A run as `extractPdfText` gives it; `wide` stretches its advance as Word does. */
const run = (x, y, text, wide = 0) => ({ x, x1: x + 5.5 * text.length + wide, y, text, size: 11 });

// --- Le Port -------------------------------------------------------------

const lePort = city('le-port');
const FILES = 'https://file.ville-port.re/app/actes/contenu/Urbanisme';
const link = (path) => `<a href="${FILES}/${encodeURI(path).replace(/'/g, '%27')}">PDF</a>`;

test('Le Port is in the permit registry, read by its own protocol', () => {
  assert.equal(permitListFor('97407'), lePort);
  assert.equal(BOARD_PROTOCOLS['le-port'], OWN_SITE_BOARD_PROTOCOLS['le-port']);
  assert.equal(BOARD_READERS['le-port-filings'], OWN_SITE_BOARD_READERS['le-port-filings']);
  assert.deepEqual(BOARD_PROTOCOLS['le-port'].start(lePort), [{ url: 'https://www.ville-port.re/affichage-legal-2/', as: 'html' }]);
});

test('a weekly list’s name gives the week’s last day, in its folder’s year', () => {
  assert.equal(weekEnd('33_Dossiers déposés du 24 août au 31 août 2026.pdf', '2026'), '2026-08-31');
  assert.equal(weekEnd('18_Dossiers déposés du 11 mai 2026 au 18 mai 2026.pdf', '2026'), '2026-05-18');
  assert.equal(weekEnd('01_Dossiers déposés du 29 décembre au 05 janvier 2026.pdf', '2026'), '2026-01-05');
  assert.equal(weekEnd('32_Dossiers séposés du 31 juillet au 07août 2023.pdf', '2023'), '2023-08-07');
  assert.equal(weekEnd('Dépôts.pdf', '2026'), null);
});

test('the page’s links to the two folders are the lists, from the window’s year on', () => {
  const html = [
    link("Dépôt des autorisations d'urbanisme/2026/33_Dossiers déposés du 24 août au 31 août 2026.pdf"),
    link("Dépôt des autorisations d'urbanisme/2026/32_Dossiers séposés du 17 août au 24 août 2026.pdf"),
    link("Décision des autorisations d'urbanisme/2026/31_Dossiers décidés du 24 août au 31 août 2026.pdf"),
    link("Décision des autorisations d'urbanisme/2025/40_Dossiers décidés du 06 octobre au 13 octobre 2025.pdf"),
    link('Planification/Affiche Concertation SCOT.pdf'),
    '<a href="https://www.ville-port.re/contact/">Contact</a>',
  ].join('\n');
  const answer = BOARD_PROTOCOLS['le-port'].index(lePort, html, { url: lePort.page }, { since: '2026-08-01' });
  assert.deepEqual(answer.files.map((file) => [file.board, file.layout, file.published]), [
    ['filings', 'le-port-filings', '2026-08-31'],
    ['filings', 'le-port-filings', '2026-08-24'],
    ['decisions', 'le-port-decisions', '2026-08-31'],
  ]);
  assert.match(answer.files[0].url, /^https:\/\/file\.ville-port\.re\/app\/actes\/contenu\/Urbanisme\/D%C3%A9p%C3%B4t%20des/);
  assert.equal(BOARD_PROTOCOLS['le-port'].index(lePort, '<a href="/contact/">Contact</a>', { url: lePort.page }, {}), null,
    'a page that links neither folder is not the board');
});

test('the export’s marks are taken out of the works', () => {
  assert.equal(tidyWorks('concerne l_installation de 6 panneaux d_une maison.__Le profil ne sera pas modifié.'),
    'concerne l’installation de 6 panneaux d’une maison. Le profil ne sera pas modifié.');
  assert.equal(tidyWorks('locaux livrés bruts_et_9 logements'), 'locaux livrés bruts et 9 logements');
  assert.equal(tidyWorks('  '), null);
});

/** A page of Le Port's decisions: the header, a section title, two rows. */
function decisionsPage() {
  return { pages: [{ runs: [
    run(28, 518, 'Numéro de dossier'), run(139, 518, 'Pétitionnaire'), run(259, 518, 'Décision'),
    run(334, 518, 'Date de'), run(334, 506, 'signature'), run(414, 518, 'Nature des travaux'),
    run(594, 518, 'Adresse des travaux'), run(769, 518, 'Surface'),
    run(28, 480, 'Déclaration préalable - Constructions et travaux non soumis à permis de construire'),
    run(28, 440, 'DP 974407 26'), run(142, 440, 'PRIVATE'), run(259, 440, 'Favorable'), run(334, 440, '06/08/2026'),
    // Word's advance runs this line of works far into the site's column.
    run(414, 440, 'Pose de panneaux'), run(594, 440, '1 Place Exemple'), run(772, 440, 'm²'),
    run(28, 428, '00106'), run(139, 428, 'Person'), run(259, 428, 'avec'), run(414, 428, 'photovoltaïques (14m²).', 400),
    run(594, 428, '97420 Le Port'), run(259, 416, 'prescriptions'),
    run(28, 380, 'PC 974407 26'), run(142, 380, 'SAS EXEMPLE'), run(259, 380, 'Rejet tacite'), run(334, 380, '27/08/2026'),
    run(414, 380, 'Construction d_une villa'), run(594, 380, 'Rue Exemple'), run(769, 380, '100,62 m²'),
    run(28, 368, '00033'), run(594, 368, '97420 Le Port'),
  ] }] };
}

test('a list of decisions reads each column apart, however wide Word draws a line', () => {
  const rows = OWN_SITE_BOARD_READERS['le-port-decisions'](decisionsPage(), { city: lePort, file: { board: 'decisions' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.purpose, row.verdict, row.decidedOn]), [
    ['DP 974407 26 00106', '1 Place Exemple', 'Pose de panneaux photovoltaïques (14m²).', 'Favorable avec prescriptions', '2026-08-06'],
    ['PC 974407 26 00033', 'Rue Exemple', 'Construction d’une villa', 'Rejet tacite', '2026-08-27'],
  ]);
  const normal = rows.map((row) => normalisePermitListRow(lePort, 'decisions', row));
  assert.deepEqual(normal.map((row) => row.state), ['accorde', 'refuse']);
  assert.doesNotMatch(JSON.stringify(normal), /PRIVATE|Person/);
  assert.equal(normal[1].applicant, 'SAS EXEMPLE');
  assert.deepEqual(OWN_SITE_BOARD_READERS['le-port-filings'](decisionsPage(), {}), [], 'a list of decisions has no filing');
});

test('a list of filings gives the filing day, the site and the works', () => {
  const document = { pages: [{ runs: [
    run(28, 518, 'Date de dépôt'), run(139, 518, 'Numéro de dossier'), run(259, 518, 'Pétitionnaire'),
    run(380, 518, 'Adresse du projet'), run(530, 518, 'Description du projet'),
    run(28, 480, 'PERMIS CONSTRUIRE'),
    run(28, 440, '28/08/2026'), run(139, 440, 'PC 974407 26 00083'), run(259, 440, 'PRIVATE PERSON'),
    run(380, 440, '12 Rue Exemple'), run(530, 440, 'Construction d’une villa type t4'),
    run(380, 428, '97420 Le Port'),
  ] }] };
  const rows = OWN_SITE_BOARD_READERS['le-port-filings'](document, {});
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.filedOn, row.address, row.postcode]),
    [['filings', 'PC 974407 26 00083', '2026-08-28', '12 Rue Exemple', '97420']]);
  assert.doesNotMatch(JSON.stringify(normalisePermitListRow(lePort, 'filings', rows[0])), /PRIVATE/);
});

// --- Les Sables-d'Olonne ----------------------------------------------------

const sables = city('les-sables-d-olonne');
const PORTAL = 'https://lessablesdolonneen1clic.fr';
const SESSION = 'abc123session';
/** The category page: a heading cell, then the documents' cell, each with its signed context. */
const sablesPage = [
  '<div class="combo-cell cell wcs-card-cell wcscardcell card wcs_wcscardcell-93 categorie" id="categorie"',
  '  data-ajax-cell-url="/ajax/cell/287/wcs_wcscardcell-93/"',
  '  data-extra-context="eyJ4IjoxfQ%3A1x%3Asig93"></div>',
  '<div class="combo-cell cell wcs-card-cell wcscardcell card wcs_wcscardcell-94 "',
  '  data-ajax-cell-url="/ajax/cell/287/wcs_wcscardcell-94/"',
  '  data-extra-context="eyJ4IjoxfQ%3A1x%3Asig94"></div>',
].join('\n');
/** The documents' cell searched for « LISTE »: a table of names and session-bound links. */
const sablesCell = (names, count) => [
  '<div class="pk-table-wrapper"><table class="pk-data-table"><tbody>',
  ...names.map((name, i) => `<tr><td>${name}</td><td><a href="/api/wcs/file/${SESSION}/token${i}/" class="pk-button" download="${name}">Consulter le document</a></td></tr>`),
  `</tbody></table></div><div class="cell-cards--items-pagination">${count}</div>`,
].join('\n');

test('Les Sables-d’Olonne is in the permit registry, read through its portal’s card cell', () => {
  assert.equal(permitListFor('85194'), sables);
  assert.equal(BOARD_PROTOCOLS['les-sables-d-olonne'], OWN_SITE_BOARD_PROTOCOLS['les-sables-d-olonne']);
  assert.deepEqual(BOARD_PROTOCOLS['les-sables-d-olonne'].start(sables), [{ url: sables.page, as: 'html' }]);
});

test('a list’s name gives its day, with or without separators', () => {
  assert.equal(sablesListDay('LISTE-DES-DECISIONS-AU-29092026'), '2026-09-29');
  assert.equal(sablesListDay('LISTE-DES-DECISIONS-09-06-2026'), '2026-06-09');
  assert.equal(sablesListDay('LISTE-DES-DECISIONS'), null);
  assert.equal(sablesListDay('LISTE-DES-DECISIONS-AU-29132026'), null);
});

test('the page names the documents’ cell, asked with its context and searched for the lists', () => {
  const protocol = BOARD_PROTOCOLS['les-sables-d-olonne'];
  const answer = protocol.index(sables, sablesPage, { url: sables.page }, { since: '2026-08-01' });
  assert.deepEqual(answer.next, [{
    url: `${PORTAL}/ajax/cell/287/wcs_wcscardcell-94/?ctx=eyJ4IjoxfQ%3A1x%3Asig94&cwcs_wcscardcell-94-q=LISTE`,
    as: 'html', cell: `${PORTAL}/ajax/cell/287/wcs_wcscardcell-94/`, offset: 0,
  }]);
  assert.equal(protocol.index(sables, '<html>Maintenance</html>', { url: sables.page }, {}), null, 'no cell, no board');
});

test('the cell’s dated lists are files, kept by name and fetched with the session their link holds', () => {
  const protocol = BOARD_PROTOCOLS['les-sables-d-olonne'];
  const request = { url: `${PORTAL}/ajax/cell/287/wcs_wcscardcell-94/?ctx=c&cwcs_wcscardcell-94-q=LISTE`, as: 'html',
    cell: `${PORTAL}/ajax/cell/287/wcs_wcscardcell-94/`, offset: 0 };
  const html = sablesCell(['LISTE-DES-AVIS-DE-DEPOTS-AU-29092026', 'LISTE-DES-DECISIONS-AU-29092026',
    'LISTE-DES-AVIS-DE-DEPOT-AU-22092026', 'LISTE-DES-DECISIONS', 'DP-085-194-26-00976'], '(1-10/21)');
  const answer = protocol.index(sables, html, request, { since: '2026-08-01' });
  assert.deepEqual(answer.files.map((file) => [file.board, file.layout, file.published, file.url]), [
    ['filings', 'les-sables-d-olonne-filings', '2026-09-29', `${sables.page}#LISTE-DES-AVIS-DE-DEPOTS-AU-29092026`],
    ['decisions', 'les-sables-d-olonne-decisions', '2026-09-29', `${sables.page}#LISTE-DES-DECISIONS-AU-29092026`],
    ['filings', 'les-sables-d-olonne-filings', '2026-09-22', `${sables.page}#LISTE-DES-AVIS-DE-DEPOT-AU-22092026`],
  ]);
  assert.equal(answer.files[0].requestUrl, `${PORTAL}/api/wcs/file/${SESSION}/token0/`);
  assert.deepEqual(answer.files[0].headers, { Cookie: `sessionid-combo-43cc4a=${SESSION}` });
  assert.deepEqual(answer.next.map((next) => [next.url, next.offset]), [[`${request.url}&offset=10`, 10]],
    'the next ten while the lists are in the window');
  const older = protocol.index(sables, sablesCell(['LISTE-DES-DECISIONS-AU-08072026'], '(11-20/21)'),
    { ...request, url: `${request.url}&offset=10`, offset: 10 }, { since: '2026-08-01' });
  assert.deepEqual(older.next, [], 'no page past the window');
  assert.equal(protocol.index(sables, sablesCell(['LISTE-DES-DECISIONS'], '(1-1/1)'), request, {}), null,
    'a cell with no dated list is not the board');
});

test('the lists are Cart@DS’s report, read without the applicant and the person who represents it', () => {
  const r = (text, x, y) => ({ text, x, x1: x + text.length * 4, y, size: 8 });
  const document = { pages: [{ runs: [
    r('Liste des avis de dépôt', 357, 569), r('194 - SABLES-D\'OLONNE (LES)', 32, 554), r('Permis de construire', 32, 535),
    r('29/09/2026', 32, 516), r('N° de dossier', 34, 499), r('Date dépôt', 135, 495), r('Demandeur', 195, 495),
    r('Lieux des travaux', 306, 495), r('Superficie', 416, 495), r('Nature des travaux', 476, 495),
    r('Projet', 697, 495), r('Date d\'affichage', 34, 491),
    r('PC 085 194 21 P0448', 34, 466), r('M02', 34, 458), r('04/08/2026', 34, 450), r('29/07/2026', 135, 458),
    r('EXEMPLE SCCV', 195, 461), r('PRIVATE PERSON', 195, 453), r('110 Rue Exemple', 306, 466),
    r('85180 (60 BE 408)', 306, 458), r('3788 m²', 416, 458), r('COLLECTIFS 50 LOGEMENTS', 476, 458),
  ] }] };
  const rows = OWN_SITE_BOARD_READERS['les-sables-d-olonne-filings'](document, { city: sables, file: { board: 'filings' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.filedOn, row.postedOn, row.applicant]),
    [['PC 085194 21 P0448 M02', '110 Rue Exemple', '85180', '2026-07-29', '2026-08-04', null]]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => normalisePermitListRow(sables, 'filings', row))), /PRIVATE|EXEMPLE SCCV/);
});

// --- Sarreguemines ------------------------------------------------------------

const sarreguemines = city('sarreguemines');
const UPLOADS = 'https://asld2.fr/handon/wp-content/uploads';
/** A post as the REST API gives it: the title's number and applicant, the order's PDF in its content. */
const post = (date, title, file) => ({ date: `${date}T09:07:02`, title: { rendered: title },
  content: { rendered: file ? `<div class="wp-block-file"><a id="f" href="${UPLOADS}/${file}">x</a><a href="${UPLOADS}/${file}" download>Télécharger</a></div>`
    : `<figure><img src="${UPLOADS}/2026/09/image-11.png" /></figure>` } });

test('Sarreguemines is in the permit registry, read through the WordPress behind its kiosk', () => {
  assert.equal(permitListFor('57631'), sarreguemines);
  assert.equal(BOARD_PROTOCOLS.sarreguemines, OWN_SITE_BOARD_PROTOCOLS.sarreguemines);
  assert.equal(sarreguemines.source.ocr, true);
  const [first] = BOARD_PROTOCOLS.sarreguemines.start(sarreguemines, { since: '2026-08-01' });
  assert.equal(first.as, 'json');
  assert.equal(first.url, 'https://asld2.fr/handon/wp-json/wp/v2/posts?categories=12&after=2026-08-01T00%3A00%3A00'
    + '&per_page=100&page=1&orderby=date&order=desc&_fields=date%2Ctitle%2Ccontent');
});

test('a post’s short number takes the commune’s code; the applicant after it is never read', () => {
  assert.equal(sarregueminesNumber('DP2600190 PRIVATE PERSON', sarreguemines), 'DP 057631 26 00190');
  assert.equal(sarregueminesNumber('PC24S0042M01 EXEMPLE SAS', sarreguemines), 'PC 057631 24 S0042 M01');
  assert.equal(sarregueminesNumber('DP2500091T01 PRIVATE PERSON', sarreguemines), 'DP 057631 25 00091 T01');
  assert.equal(sarregueminesNumber('CU2600255 PRIVATE PERSON', sarreguemines), null, 'a certificate is no permit');
  assert.equal(sarregueminesNumber('DP26000184 PRIVATE PERSON', sarreguemines), null, 'six digits: a typo, not a number');
});

test('each post with a PDF is a scanned order awaiting OCR, its title’s number a signed decision until then', () => {
  const protocol = BOARD_PROTOCOLS.sarreguemines;
  const request = protocol.start(sarreguemines, { since: '2026-08-01' })[0];
  const answer = protocol.index(sarreguemines, [
    post('2026-09-23', 'DP2600190 PRIVATE PERSON', '2026/09/DP2600190.pdf'),
    post('2026-09-09', 'DP2600202 PRIVATE PERSON'),
    post('2026-09-07', 'CU2600255 PRIVATE PERSON', '2026/09/CU2600255.pdf'),
    post('2026-08-04', 'PC2600020 PRIVATE PERSON', '2026/08/PC260020.pdf'),
  ], request, { since: '2026-08-01' });
  assert.deepEqual(answer.files.map((file) => [file.url, file.board, file.layout, file.published, file.scan, file.row.dossier, file.row.verdict]), [
    [`${UPLOADS}/2026/09/DP2600190.pdf`, 'decisions', 'sarreguemines-order', '2026-09-23', true, 'DP 057631 26 00190', 'Décision signée'],
    [`${UPLOADS}/2026/08/PC260020.pdf`, 'decisions', 'sarreguemines-order', '2026-08-04', true, 'PC 057631 26 00020', 'Décision signée'],
  ]);
  assert.doesNotMatch(JSON.stringify(answer), /PRIVATE/);
  assert.deepEqual(answer.next, [], 'fewer than a page: no next page');
  const full = protocol.index(sarreguemines, Array.from({ length: 100 }, () => post('2026-09-01', 'DP2600100 X', '2026/09/a.pdf')), request, { since: '2026-08-01' });
  assert.match(full.next[0].url, /&page=2&/);
  assert.equal(protocol.index(sarreguemines, { code: 'rest_no_route' }, request, {}), null, 'an error object is not the board');
});

test('a Sarreguemines order read by OCR: the form’s site and verdict, the signing day, the title’s number', () => {
  const words = (y, line) => {
    let x = 50;
    return line.split(' ').map((text) => { const item = { x, x1: x + 5 * text.length, y, text, size: 10 }; x = item.x1 + 4; return item; });
  };
  const document = { pages: [{ width: 595, height: 842, runs: [
    [814, 'Commune de Sarreguemines DECISION DE NON OPPOSITION A UNE DECLARATION PREALABLE'],
    [762, 'Demande déposée le 03/09/2026'], [726, 'Par : | PRIVATE PERSON'], [699, 'Demeurant à : | 1 rue Privée'],
    [687, '57200 SARREGUEMINES'], [675, 'Pour : | Installation photovoltaïque'],
    [577, 'Sur un terrain sis à : | 14 rue Exemple'], [563, '57200 Sarreguemines'], [552, 'Références cadastrales : | 45 0258'],
    [339, 'ARRETE'], [311, 'ARTICLE 1 :'], [299, 'Il n\'est pas fait opposition aux travaux projetés dans la déclaration susvisée.'],
    [262, 'SARREGUEMINES, le 04.09.2026'],
  ].flatMap(([y, line]) => words(y, line)) }] };
  const file = { url: `${UPLOADS}/2026/09/DP2600198.pdf`, board: 'decisions', published: '2026-09-09',
    row: { board: 'decisions', dossier: 'DP 057631 26 00198', applicant: null, address: null, postcode: '57200', postedOn: '2026-09-09', verdict: 'Décision signée' } };
  const rows = OWN_SITE_BOARD_READERS['sarreguemines-order'](document, { city: sarreguemines, file });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.filedOn, row.verdict, row.decidedOn, row.postedOn, row.applicant]),
    [['DP 057631 26 00198', '14 rue Exemple', '2026-09-03', 'Non-opposition', '2026-09-04', '2026-09-09', null]]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => normalisePermitListRow(sarreguemines, 'decisions', row))), /PRIVATE|Privée/);
});

// --- Caudry -------------------------------------------------------------------

const caudry = city('caudry');
const caudryBlock = (heading, uuid) => `<div class='bloctxt blocfile'><h4>${heading}</h4><a href="/techniques/dl/${uuid}/" target="_blank" class="link">Arrete d&#039;urbanisme</a></div>`;

test('Caudry is in the permit registry, read off its page of orders', () => {
  assert.equal(permitListFor('59139'), caudry);
  assert.equal(BOARD_PROTOCOLS.caudry, OWN_SITE_BOARD_PROTOCOLS.caudry);
  assert.deepEqual(BOARD_PROTOCOLS.caudry.start(caudry), [{ url: caudry.page, as: 'html' }]);
});

test('a heading gives its list’s day, and a past year’s register is not this year’s', () => {
  assert.deepEqual(caudryHeading('DEPOTS ET DECISIONS D&#039;URBANISME AU 28/08/2026'), { published: '2026-08-28' });
  assert.deepEqual(caudryHeading("DEPOT ET DECISION D'URBANISME AU 07 AOUT 2026"), { published: '2026-08-07' });
  assert.deepEqual(caudryHeading('AFFICHAGES ET DECISIONS 2026 AU 15/01/2026'), { published: '2026-01-15' });
  assert.equal(caudryHeading("DEPOTS ET DÉCISIONS D'URBANISME  2025 AU 1 JUILLET 2026"), null);
  assert.equal(caudryHeading("AUTORISATION D'ENSEIGNE EXEMPLE"), null);
});

test('only the newest list is read: each holds the year from 1 January', () => {
  const html = [
    '<h3>2026</h3>',
    caudryBlock("DEPOT ET DECISIONS D'URBANISME AU 13/08/2026", 'b'),
    caudryBlock("DEPOTS ET DECISIONS D'URBANISME AU 28/08/2026", 'a'),
    caudryBlock("DEPOTS ET DÉCISIONS D'URBANISME  2025 AU 1 SEPTEMBRE 2026", 'c'),
    caudryBlock('ARRETE MISE EN DEMEURE - 4 RUE EXEMPLE', 'd'),
  ].join('\n');
  assert.deepEqual(BOARD_PROTOCOLS.caudry.index(caudry, html, { url: caudry.page }, {}), { files: [{
    url: 'https://www.caudry.fr/techniques/dl/a/', board: 'filings', layout: 'caudry-register', published: '2026-08-28' }] });
  assert.equal(BOARD_PROTOCOLS.caudry.index(caudry, '<h4>Contact</h4>', { url: caudry.page }, {}), null);
});

test('a parcel’s code gives its section and number', () => {
  assert.equal(caudryParcel('139000AC0147'), 'AC 0147');
  assert.equal(caudryParcel('1390000A0819,'.replace(',', '')), 'A 0819');
  assert.equal(caudryParcel('139000BE0000'), null);
  assert.equal(caudryParcel('Autre'), null);
});

test('the register’s rows are bands of centred cells; a decided permit is a decision, a pending one a filing, the rest left out', () => {
  /** A cell's lines centred on `y`, in a column centred on `centre`. */
  const cell = (centre, y, ...lines) => lines.map((text, i) => {
    const width = 4 * text.length;
    return { x: centre - width / 2, x1: centre + width / 2, y: y + (lines.length - 1) * 3.375 - 6.75 * i, text, size: 6 };
  });
  const header = [
    ...cell(52, 468, 'Type de', 'demande'), ...cell(101, 466, 'Numéro'), ...cell(150, 466, 'Demande'), ...cell(200, 466, 'Dépôt'),
    ...cell(249, 466, 'Complet'), ...cell(298, 468, 'Limite', "d'instruction"), ...cell(347, 466, 'Demandeur'),
    ...cell(396, 466, 'Adresse terrain'), ...cell(446, 466, 'Propriétaire'), ...cell(495, 466, 'Sf. terr.(m²)'),
    ...cell(544, 466, 'Sf. créée'), ...cell(593, 466, 'Parcelles'), ...cell(642, 468, 'Nature des', 'travaux'),
    ...cell(692, 466, 'Décision'), ...cell(741, 466, 'DOC'), ...cell(790, 466, 'DAACT'),
  ];
  const row = (y, type, number, filed, applicant, site, parcels, works, decision, opened = []) => [
    ...cell(52, y, type), ...cell(101, y, ...number), ...cell(150, y, filed), ...cell(200, y, filed),
    ...cell(347, y, ...applicant), ...cell(396, y, ...site), ...cell(446, y, 'PRIVATE OWNER'), ...cell(495, y, '1232'),
    ...cell(544, y, '0'), ...cell(593, y, ...parcels), ...cell(642, y, ...works), ...cell(692, y, ...decision), ...cell(741, y, ...opened),
  ];
  const document = { pages: [
    { runs: [{ x: 547, x1: 814, y: 542, text: 'Registre des dossiers pour affichage', size: 16 }, ...header,
      ...row(450, 'DPC', ['DP0591392600', '002'], '07/01/2026', ['PRIVATE PERSON'], ['0009 rue Exemple', '59540 CAUDRY'],
        ['139000AC0147'], ['Pose d’une', 'clôture'], ['26/01/2026', 'Accord avec', 'prescriptions'], ['02/03/2026']),
      ...row(410, 'CUa', ['CU0591392600', '003'], '08/01/2026', ['Maître', 'PRIVATE', 'NOTARY'], ['CHAMP EXEMPLE', '59540 Caudry'],
        ['139000ZD0012'], ['Autre'], ['13/01/2026', 'Accord']),
      ...row(60, 'PC', ['PC0591392600', '017'], '23/06/2026', ['EXEMPLE HABITAT'], ['Rue Exemple', '59540 Caudry'],
        ['139000AZ0880,', '139000AZ0881'], ['Construction de 30', 'logements'], []),
      { x: 40, x1: 100, y: 20, text: '28/08/2026 16:16:38', size: 6 }] },
    { runs: [...cell(593, 560, '139000AZ0882'),
      ...row(520, 'DPMI', ['DP0591392600', '120'], '20/08/2026', ['PRIVATE PERSON'], ['59540 Caudry'], ['1390000A0819'], ['Abri de jardin'], []),
      ...cell(80, 470, 'Type de permis'), ...cell(250, 470, 'Nbre. déposé'), ...cell(80, 455, 'Permis de Construire (PC)'), ...cell(250, 455, '17')] },
  ] };
  const rows = OWN_SITE_BOARD_READERS['caudry-register'](document, { city: caudry, file: { board: 'filings' } });
  assert.deepEqual(rows.map((item) => [item.board, item.dossier, item.address, item.parcels, item.purpose, item.filedOn, item.verdict, item.decidedOn]), [
    ['decisions', 'DP 059139 26 00002', '9 rue Exemple', 'AC 0147', 'Pose d’une clôture', '2026-01-07', 'Accord avec prescriptions', '2026-01-26'],
    ['filings', 'PC 059139 26 00017', 'Rue Exemple', 'AZ 0880, AZ 0881, AZ 0882', 'Construction de 30 logements', '2026-06-23', null, null],
    ['filings', 'DP 059139 26 00120', null, 'A 0819', 'Abri de jardin', '2026-08-20', null, null],
  ]);
  assert.ok(rows.every((item) => item.applicant === null));
  assert.doesNotMatch(JSON.stringify(rows.map((item) => normalisePermitListRow(caudry, item.board, item))), /PRIVATE|NOTARY|EXEMPLE HABITAT/);
});

// --- La Queue-en-Brie -----------------------------------------------------------

const queue = city('la-queue-en-brie');
const TENANT = 'c58fc4e2-bcaf-8bb3-b446-ec17d2d3ce78';
/** A display as affichage.legal's JSON gives it, its clerk's account included (never read). */
const display = (date, type, title, extra = {}) => ({ id: 'x', tenantId: TENANT, title, type, reference: title,
  description: 'Remplacement des escaliers extérieurs', file: `displays/x/${title}.pdf`, createdBy: 'CLERK ACCOUNT',
  date: `${date}T00:00:00.000Z`, removedAt: null, minurl: 'https://lgl.pub/abc1234', categories: ['c'], ...extra });

test('La Queue-en-Brie is in the permit registry, read through its affichage.legal tenant', () => {
  assert.equal(permitListFor('94060'), queue);
  assert.equal(BOARD_PROTOCOLS['la-queue-en-brie'], OWN_SITE_BOARD_PROTOCOLS['la-queue-en-brie']);
  assert.equal(queue.source.ocr, true);
  assert.deepEqual(BOARD_PROTOCOLS['la-queue-en-brie'].start(queue), [{
    url: 'https://affichage.legal/api/displays/visible?categories=9c074ae2-8fd1-1a54-6093-f701c59d4ff9', as: 'json',
    headers: { 'X-Tenant-Id': TENANT } }]);
});

test('a title gives the number, short or whole, and the verdict it states', () => {
  assert.deepEqual(queueTitle('ACCORD - DP2600077', queue), { dossier: 'DP 094060 26 00077', verdict: 'Accord' });
  assert.deepEqual(queueTitle('REFUS - DP2600063', queue), { dossier: 'DP 094060 26 00063', verdict: 'Refus' });
  assert.deepEqual(queueTitle('ACCORD - PC0940602600007', queue), { dossier: 'PC 094060 26 00007', verdict: 'Accord' });
  assert.deepEqual(queueTitle('ACCORD - PC21N1008T02', queue), { dossier: 'PC 094060 21 N1008 T02', verdict: 'Accord' });
  assert.equal(queueTitle('ACCORD - PC191002M02', queue), null, 'a counter that lost its letter');
  assert.equal(queueTitle('ACCORD - PC0770012600007', queue), null, 'another commune’s number');
});

test('each permit on display is a scanned order behind its short link; the rest of the category is left out', () => {
  const answer = BOARD_PROTOCOLS['la-queue-en-brie'].index(queue, [
    display('2026-10-01', 'Déclaration préalable de travaux', 'ACCORD - DP2600077'),
    display('2026-09-25', 'Permis de construire', 'ACCORD - PC191002M02'),
    display('2026-08-24', 'Arrêté permanent', 'Arrêté 2026-199 Relance de l’astreinte'),
    display('2026-08-20', 'Déclaration préalable de travaux', 'REFUS - DP2600067', { removedAt: '2026-08-21T00:00:00.000Z' }),
    display('2026-06-20', 'Déclaration préalable de travaux', 'ACCORD - DP2600040'),
  ], {}, { since: '2026-08-01' });
  assert.deepEqual(answer.files.map((file) => [file.url, file.layout, file.published, file.scan, file.row?.dossier, file.row?.verdict, file.row?.purpose]), [
    ['https://lgl.pub/abc1234', 'la-queue-en-brie-order', '2026-10-01', true, 'DP 094060 26 00077', 'Accord', 'Remplacement des escaliers extérieurs'],
    ['https://lgl.pub/abc1234', 'la-queue-en-brie-order', '2026-09-25', true, undefined, undefined, undefined],
  ]);
  assert.doesNotMatch(JSON.stringify(answer), /CLERK/);
  assert.equal(BOARD_PROTOCOLS['la-queue-en-brie'].index(queue, { error: 'Unknown tenant' }, {}, {}), null);
});

test('an order read by OCR: its labelled site, parcel and days, however OCR glued or shifted the labels; no applicant', () => {
  /** OCR words: a line's words share one baseline; the label block may sit a point off its values'. */
  const line = (y, x, words) => {
    let at = x;
    return words.split(' ').map((text) => { const item = { x: at, x1: at + 5 * text.length, y, text, size: 8 }; at = item.x1 + 4; return item; });
  };
  const order = (siteLabel) => ({ pages: [{ width: 595, height: 842, runs: [
    ...line(767, 238, 'NON-OPPOSITION A UNE DECLARATION'), ...line(736, 224, 'DELIVREE PAR LE MAIRE AU NOM DE LA COMMUNE'),
    ...line(661, 155, 'DECLARATION PREALABLE'), ...line(661, 429, 'N° DP0940602600077'),
    ...line(650, 155, '18/09/2026 Avis de dépôt affiché le : 18/09/2026'), ...line(650, 420, 'Surface de plancher'),
    ...line(638, 155, 'PRIVATE PERSON'), ...line(618, 155, '1, rue Privée — 75009 Paris'), ...line(618, 420, 'Destination : habitation'),
    ...line(606.6, 151, '| 4, rue Exemple — 94510 La Queue-en-Brie'), ...line(607.5, 420, 'd’intérêt collectif'), ...line(596, 155, 'AC-0320'),
    ...line(649, 60, 'Déposé le :'), ...line(638.5, 60, 'Par:'), ...line(618, 60, 'Demeurant :'), ...siteLabel, ...line(595.5, 60, 'Cadastré :'),
    ...line(300, 50, 'ARTICLE 1 : ce projet n’appelle aucune opposition'), ...line(260, 50, 'La Queue-en-Brie, le 1° septembre 2026'),
  ] }] });
  const file = { board: 'decisions', published: '2026-10-01',
    row: { board: 'decisions', dossier: 'DP 094060 26 00077', applicant: null, address: null, postcode: '94510', verdict: 'Accord', postedOn: '2026-10-01' } };
  const read = (siteLabel) => OWN_SITE_BOARD_READERS['la-queue-en-brie-order'](order(siteLabel), { city: queue, file });
  const expected = [['DP 094060 26 00077', '4, rue Exemple', '94510', 'AC 0320', '2026-09-18', 'Non-opposition', '2026-09-01', '2026-10-01', null]];
  const shape = (rows) => rows.map((row) => [row.dossier, row.address, row.postcode, row.parcels, row.filedOn, row.verdict, row.decidedOn, row.postedOn, row.applicant]);
  assert.deepEqual(shape(read(line(605.5, 60, 'Sur un terrain sis :'))), expected);
  assert.deepEqual(shape(read([{ x: 63, x1: 70, y: 606.6, text: 'Sur', size: 8 }, { x: 65, x1: 100, y: 606.6, text: 'terrainsis:', size: 8 },
    { x: 81, x1: 88, y: 606.6, text: 'un', size: 8 }])), expected, 'glued and misplaced label words');
  assert.deepEqual(read([]), [], 'no site label, no row');
  assert.doesNotMatch(JSON.stringify(read(line(605.5, 60, 'Sur un terrain sis :')).map((row) => normalisePermitListRow(queue, 'decisions', row))), /PRIVATE|Privée|Paris/);
});

// --- Saint-Germain-lès-Arpajon ---------------------------------------------------

const sgla = city('saint-germain-les-arpajon');
const sglaPage = [
  '<script>var et_link_options_data = [{"class":"et_pb_row_2","url":"https:\\/\\/example.sharepoint.com\\/:x:\\/s\\/Affichage\\/EzRow?rtime=x","target":"_self"},',
  '{"class":"dipi_hover_box_0","url":"https:\\/\\/example.sharepoint.com\\/:x:\\/s\\/Affichage\\/EbxFilings-1_a?rtime=P4I","target":"_blank"},',
  '{"class":"dipi_hover_box_1","url":"https:\\/\\/example.sharepoint.com\\/:x:\\/s\\/Affichage\\/EeDecisions?e=GEF","target":"_blank"},',
  '{"class":"et_pb_text_2_tb_footer","url":"https:\\/\\/ville-sgla.fr\\/contact\\/","target":"_self"}];</script>',
  '<div class="et_pb_with_border et_pb_module dipi_hover_box dipi_hover_box_0 et_clickable"><h2>Avis de dépôt des demandes d’autorisation d’urbanisme en cours d’instruction</h2></div>',
  '<div class="et_pb_with_border et_pb_module dipi_hover_box dipi_hover_box_1 et_clickable"><h2>Permis de construire</h2></div>',
].join('\n');

test('Saint-Germain-lès-Arpajon is in the permit registry, read off the workbook its page shares', () => {
  assert.equal(permitListFor('91552'), sgla);
  assert.equal(BOARD_PROTOCOLS['saint-germain-les-arpajon'], OWN_SITE_BOARD_PROTOCOLS['saint-germain-les-arpajon']);
  assert.equal(sgla.robots, 'overridden');
  assert.deepEqual(BOARD_PROTOCOLS['saint-germain-les-arpajon'].start(sgla), [{ url: sgla.page, as: 'html' }]);
});

test('the page’s boxes give their titles and SharePoint’s direct download of each shared workbook', () => {
  assert.deepEqual(sglaBoxes(sglaPage).map((box) => [box.title.slice(0, 26), box.url]), [
    ['Avis de dépôt des demandes', 'https://example.sharepoint.com/sites/Affichage/_layouts/15/download.aspx?share=EbxFilings-1_a'],
    ['Permis de construire', 'https://example.sharepoint.com/sites/Affichage/_layouts/15/download.aspx?share=EeDecisions'],
  ]);
  assert.deepEqual(BOARD_PROTOCOLS['saint-germain-les-arpajon'].index(sgla, sglaPage, { url: sgla.page }, {}), { files: [{
    url: 'https://example.sharepoint.com/sites/Affichage/_layouts/15/download.aspx?share=EbxFilings-1_a',
    board: 'filings', layout: 'sgla-filings', format: 'xlsx', sheet: "Demandes en cours d'instruction", rolling: true }] });
  assert.equal(BOARD_PROTOCOLS['saint-germain-les-arpajon'].index(sgla, '<p>Maintenance</p>', { url: sgla.page }, {}), null);
});

test('Excel’s serial days are calendar days', () => {
  assert.equal(excelDay('46294'), '2026-09-29');
  assert.equal(excelDay('46136'), '2026-04-24');
  assert.equal(excelDay('#VALUE!'), null);
  assert.equal(excelDay('0'), null);
});

test('the workbook of dossiers under review: permits with their site, the applicant never read', () => {
  const workbook = { sheet: "Demandes en cours d'instruction", rows: [
    ['#VALUE!', '0', '', '', '', ''],
    ['Numéro', 'Date dépôt', 'Demandeur désigné', 'Adresse du projet', 'Nature du projet', 'Affichage le'],
    ['PERMIS DE CONSTRUIRE', '', '', '', '', ''],
    ['PC 091 552 26 1 0006', '46136', 'EXEMPLE SAS', 'ROUTE D’EXEMPLE', 'EXTENSION DU BATI EXISTANT', '46139'],
    ['DP 091 552 26 1 0039 ', '46168', 'PRIVATE PERSON', '2 IMPASSE EXEMPLE', 'REALISATION D’UN MUR DE CLOTURE ', '46170'],
    ['DP 091 552 26 1 0040', '46169', 'PRIVATE PERSON', '', 'CLOTURE', '46170'],
    ['AT 091 552 26 1 0002', '46252', 'EXEMPLE SARL', '2 BIS RN20', 'TRAVAUX D’AMENAGEMENT', '46260'],
  ] };
  const rows = OWN_SITE_BOARD_READERS['sgla-filings'](workbook, { city: sgla, file: { board: 'filings' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.purpose, row.filedOn, row.postedOn, row.applicant]), [
    ['PC 091552 26 10006', 'ROUTE D’EXEMPLE', '91180', 'EXTENSION DU BATI EXISTANT', '2026-04-24', '2026-04-27', null],
    ['DP 091552 26 10039', '2 IMPASSE EXEMPLE', '91180', 'REALISATION D’UN MUR DE CLOTURE', '2026-05-26', '2026-05-28', null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => normalisePermitListRow(sgla, 'filings', row))), /PRIVATE|EXEMPLE SAS/);
  assert.deepEqual(OWN_SITE_BOARD_READERS['sgla-filings']({ sheet: 'x', rows: [['PC 091 552 26 1 0006']] }, { city: sgla }), [],
    'no header, no rows');
});

// --- Thorigny-sur-Marne -------------------------------------------------------------

const thorigny = city('thorigny-sur-marne');

test('Thorigny-sur-Marne is in the permit registry; its page’s two sheets of decisions are read, as replaced', () => {
  assert.equal(permitListFor('77464'), thorigny);
  const html = ['<a href="/sites/default/files/decisions_-_pc.xlsx.pdf">decisions_-_pc.xlsx.pdf</a>',
    '<a href="/sites/default/files/decisions_-_dp_13.pdf">decisions_-_dp.pdf</a>',
    '<a href="/sites/default/files/arrete_voirie.pdf">Arrêté</a>', '<a href="/sites/default/files/decisions_-_dpe.pdf">x</a>'].join('\n');
  assert.deepEqual(BOARD_PROTOCOLS['thorigny-sur-marne'].index(thorigny, html, { url: thorigny.page }, {}), { files: [
    { url: 'https://www.thorigny.fr/sites/default/files/decisions_-_pc.xlsx.pdf', board: 'decisions', layout: 'thorigny-decisions', rolling: true },
    { url: 'https://www.thorigny.fr/sites/default/files/decisions_-_dp_13.pdf', board: 'decisions', layout: 'thorigny-decisions', rolling: true },
  ] });
  assert.equal(BOARD_PROTOCOLS['thorigny-sur-marne'].index(thorigny, '<a href="/contact">Contact</a>', { url: thorigny.page }, {}), null);
});

test('a Thorigny sheet: each row the runs a few points about its number, columns by where their cells start', () => {
  const r = (x, y, text) => ({ x, x1: x + 4.6 * text.length, y, text, size: 9 });
  const header = [r(121, 775, 'Numéro'), r(61, 769, 'Type'), r(199, 769, 'Date de dépôt'), r(289, 769, 'Nom du demandeur'),
    r(420, 769, 'Adresse des travaux'), r(663, 769, 'Description des travaux'), r(931, 769, 'Décision'), r(1025, 769, 'Affiché le'),
    r(1093, 775, 'Fin'), r(117, 763, 'de dossier'), r(1081, 763, 'd\'affichage')];
  const document = { pages: [{ runs: [...header,
    r(63, 630, 'DP'), r(104, 630, '077 464 26 000 51'), r(203, 630, '28/06/2026'), r(267, 630, 'PRIVATE PERSON'), r(390, 630, '28, Rue Exemple'),
    r(529, 630, 'Modification de la clôture, pose d’un mur de soutènement et d’une pergola'), r(896, 630, '15/07/2026 - NON OPPOSITION'),
    r(1021, 630, '22/07/2026'), r(1080, 630, '22/09/2026'),
    r(60, 609, 'DPM'), r(96, 609, '077 464 25 000 48 M01'), r(203, 609, '15/04/2026'), r(267, 612, 'PRIVATE PERSON'), r(390, 612, '14 bis , Rue Exemple'),
    r(529, 612, 'Pose d’un portail'), r(896, 612, '30/07/2026 - OPPOSITION'), r(1021, 612, '05/08/2026'),
    r(22, 590, 'PC 077 464 26 000 05'), r(174, 590, '07/05/2026'), r(400, 594, '12, rue Exemple'), r(919, 594, 'en cours'),
    r(22, 560, 'CU 077 464 26 000 09'), r(400, 560, '1, rue Exemple'),
  ] }] };
  const rows = OWN_SITE_BOARD_READERS['thorigny-decisions'](document, { city: thorigny, file: { board: 'decisions' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.purpose, row.filedOn, row.verdict, row.decidedOn, row.postedOn, row.applicant]), [
    ['DP 077464 26 00051', '28, Rue Exemple', 'Modification de la clôture, pose d’un mur de soutènement et d’une pergola', '2026-06-28', 'Non-opposition', '2026-07-15', '2026-07-22', null],
    ['DP 077464 25 00048 M01', '14 bis, Rue Exemple', 'Pose d’un portail', '2026-04-15', 'Refus', '2026-07-30', '2026-08-05', null],
    ['PC 077464 26 00005', '12, rue Exemple', null, '2026-05-07', 'Décision signée', null, null, null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map((row) => normalisePermitListRow(thorigny, 'decisions', row))), /PRIVATE/);
});

// --- Clouange and Douvrin ---------------------------------------------------

const clouange = city('clouange');
const tile = (id, title) => `<div id=${id} class="imgPDF">\n\t<a><span class="nom">${title}</span>\n\t<div class="background_image_pdf"><img src="/pdf/img/${id}.png" alt="Accueil"></div>\n\t<span class="select">Sélectionner</span></a>\n</div>`;

test('Clouange’s kiosk: a tile is a dossier’s number, its act the scan at the tile’s id, no day anywhere', () => {
  assert.equal(permitListFor('57143'), clouange);
  assert.equal(BOARD_PROTOCOLS.clouange, OWN_SITE_BOARD_PROTOCOLS.clouange);
  assert.deepEqual(BOARD_PROTOCOLS.clouange.start(clouange).map((request) => request.url), [
    'https://panneau.clouange.fr/modele/affichage.php?type=3', 'https://panneau.clouange.fr/modele/affichage.php?type=2',
    'https://panneau.clouange.fr/modele/affichage.php?type=4']);
  const html = tile(124, 'DP0571432600034') + tile(121, 'PC 05714324P0004M01') + tile(99, 'Contrôle sanitaire des Eaux');
  assert.deepEqual(clouangeTiles(html, clouange), [{ id: '124', dossier: 'DP 057143 26 00034' }, { id: '121', dossier: 'PC 057143 24 P0004 M01' }]);
  const { files } = BOARD_PROTOCOLS.clouange.index(clouange, html, { url: 'https://panneau.clouange.fr/modele/affichage.php?type=3' }, {});
  assert.deepEqual(files.map((file) => [file.url, file.board, file.layout, file.scan, file.row.dossier, file.row.address]), [
    ['https://panneau.clouange.fr/pdf/pdf/124.pdf', 'decisions', 'dematdoc-notice', true, 'DP 057143 26 00034', null],
    ['https://panneau.clouange.fr/pdf/pdf/121.pdf', 'decisions', 'dematdoc-notice', true, 'PC 057143 24 P0004 M01', null],
  ]);
  assert.deepEqual(BOARD_PROTOCOLS.clouange.index(clouange, '', { url: clouange.page }, {}), { files: [] }, 'an empty category is an answer');
  assert.equal(BOARD_PROTOCOLS.clouange.index(clouange, '<html><body>Maintenance</body></html>', { url: clouange.page }, {}), null);
});

const douvrin = city('douvrin');
const pack = (title, id, size = '1.53 MB') => `<div class="media-body"><div>\n<strong class="package-title">${title}</strong> | ${size}\n</div>\n`
  + `<a class='wpdm-download-link download-on-click btn btn-primary btn-sm' rel='nofollow' href='#' data-downloadurl="https://douvrin.fr/download/x/?wpdmdl=${id}&refresh=6ac13a0b3af1a1791048203">Télécharger</a></div>`;
const heading = (title) => `<h2 class="elementor-heading-title elementor-size-default">${title}</h2>`;

test('Douvrin’s packages: the listed headings’ orders, the number’s mistyped commune code mended, no refresh token kept', () => {
  assert.equal(permitListFor('62276'), douvrin);
  const html = heading('Permis de construire') + pack('PC 0620 276 26 00020', 17365) + pack('N° PC 062 276 26 00010', 16872) + pack('PC 062 276 24 00006 M01', 16876)
    + heading('Déclarations préalables') + pack('DP 062276 26 00049', 16928, '1,022.76 KB')
    + heading('Biens sans maîtres') + pack('Arrêté de péril 2026-12', 17297);
  assert.deepEqual(douvrinPackages(html, douvrin).map(({ dossier, url }) => [dossier, url]), [
    ['PC 062276 26 00020', 'https://douvrin.fr/download/x/?wpdmdl=17365'],
    ['PC 062276 26 00010', 'https://douvrin.fr/download/x/?wpdmdl=16872'],
    ['PC 062276 24 00006 M01', 'https://douvrin.fr/download/x/?wpdmdl=16876'],
    ['DP 062276 26 00049', 'https://douvrin.fr/download/x/?wpdmdl=16928'],
  ]);
  const { files } = BOARD_PROTOCOLS.douvrin.index(douvrin, html, { url: douvrin.page }, { since: '2026-07-01' });
  assert.deepEqual(files.map((file) => [file.row.dossier, file.board, file.scan, file.ocrPages]), [
    ['PC 062276 26 00020', 'decisions', true, 2], ['PC 062276 26 00010', 'decisions', true, 2], ['DP 062276 26 00049', 'decisions', true, 2],
  ], 'a number of two years back is an old file the page keeps');
  assert.equal(BOARD_PROTOCOLS.douvrin.index(douvrin, '<p>Page en construction</p>', { url: douvrin.page }, {}), null);
});

const maing = city('maing');
const maingRow = (day, category, title, file) => `<tr>\n<td width=20%  style="border: 1px solid;"><center>${day}</center></td>\n<td width=35%  style="border: 1px solid;">&nbsp;${category}</td>\n`
  + `<td width=3Affichage légal5%  style="border: 1px solid;">&nbsp;${title}</td>\n<td width=10%  style="border: 1px solid;"><center><a href="https://www.maing.fr/affichage/uploads/${file}.pdf" target="_blank" ><br />\n\t\t\t\t\t\t\tVOIR</a></center></td>\n</tr>`;

test('Maing’s table: the rows of « Droit d’occupation des sols » that name a dossier, with the posting day of the row', () => {
  assert.equal(permitListFor('59369'), maing);
  const html = '<table>' + maingRow('29-07-2026', 'Droit d&rsquo;occupation des sols ', 'DP0593692600046', '2026-07-29_9_a')
    + maingRow('29-07-2026', 'Arrêtés de circulation / stationnement / travaux', 'Arrêté portant restriction de circulation &#8211; 53 rue Exemple', '2026-07-29_3_b')
    + maingRow('25-06-2026', 'Droit d&rsquo;occupation des sols', 'PC 059369 26 00005', '2026-06-25_9_c')
    + maingRow('02-04-2026', 'Droit d&rsquo;occupation des sols', 'CUo 059369 26 00011', '2026-04-02_9_d')
    + maingRow('21-06-2024', 'Droit d&rsquo;occupation des sols', 'DÉCISION D&rsquo;OPPOSITION À UNE DECLARATION PREALABLE', '2024-06-21_9_e')
    + maingRow('11-07-2026', 'Droit d&rsquo;occupation des sols', 'DP 059 999 26 00012', '2026-07-11_9_f') + '</table>';
  assert.deepEqual(maingRows(html, maing, maing.page).map(({ published, dossier, url }) => [published, dossier, url.split('/').pop()]), [
    ['2026-07-29', 'DP 059369 26 00046', '2026-07-29_9_a.pdf'],
    ['2026-06-25', 'PC 059369 26 00005', '2026-06-25_9_c.pdf'],
  ], 'another category, a certificate, a title with no number and another commune’s number are not rows of this board');
  const { files } = BOARD_PROTOCOLS.maing.index(maing, html, { url: maing.page }, {});
  assert.deepEqual(files.map((file) => [file.board, file.layout, file.published, file.signedBy, file.ocr, file.row.postedOn, file.row.address]), [
    ['decisions', 'dematdoc-notice', '2026-07-29', '2026-07-29', true, '2026-07-29', null], ['decisions', 'dematdoc-notice', '2026-06-25', '2026-06-25', true, '2026-06-25', null],
  ]);
  assert.equal(BOARD_PROTOCOLS.maing.index(maing, '<p>Maintenance</p>', { url: maing.page }, {}), null);
});

// --- Montesson ----------------------------------------------------------------

const montesson = city('montesson');
const MONTESSON_HEAD = '<tr style="text-align:center"><th scope="col"><strong>Date de d&eacute;p&ocirc;t</strong></th><th scope="col"><strong>&nbsp;&nbsp;Num&eacute;ro&nbsp;de&nbsp;dossier&nbsp;&nbsp;</strong></th>'
  + '<th scope="col">Type*</th><th scope="col"><strong>D&eacute;posant</strong></th><th scope="col">Adresse&nbsp;du&nbsp;terrain</th><th scope="col">Parcelle(s)</th>'
  + '<th scope="col">Description du projet</th><th scope="col">Date de publication du d&eacute;p&ocirc;t</th></tr>';
const montessonFiling = (cells) => `<tr>${cells.map((cell) => `<td style="text-align: center;">${cell}</td>`).join('')}</tr>`;

test('Montesson’s filings: the table under review, its repeated header skipped, the applicant never read', () => {
  assert.equal(permitListFor('78418'), montesson);
  assert.equal(montesson.crawlDelayMs, 15_000, 'its robots.txt asks fifteen seconds');
  assert.equal(montesson.underReview, true);
  const html = `<table id="LB_TableauDepotsADS"><thead>${MONTESSON_HEAD}</thead><tbody>`
    + montessonFiling(['17/06/2026', 'PC&nbsp;078418&nbsp;26&nbsp;G0017', 'PCMI', '<em>Particulier</em>', '42 boulevard Exemple', 'AV145', 'Agrandissement de l&#39;entr&eacute;e<br />\nModification de la cl&ocirc;ture', '06/07/2026'])
    + MONTESSON_HEAD
    + montessonFiling(['06/07/2026', 'PC 078418 21 G1001 T01', 'DT', 'PRIVATE PERSON', '9 bis avenue Exemple', '', 'Transfert du permis de construire', '08/07/2026'])
    + montessonFiling(['13/08/2026', 'DP 078418&nbsp;26&nbsp;G0090', 'DPC', 'SAS EXEMPLE', 'avenue Exemple (Lot 2)', 'AZ 607 et 608', 'Fa&ccedil;ade', '17/08/2026'])
    + montessonFiling(['02/09/2026', 'DP 078 999 26 G0001', 'DPC', 'PRIVATE PERSON', '1 rue Ailleurs', 'non renseign&eacute;', 'Abri', '03/09/2026'])
    + '</tbody></table>';
  const rows = montessonFilings(html, montesson);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.parcels, row.filedOn, row.postedOn]), [
    ['PC 078418 26 G0017', '42 boulevard Exemple', 'AV 145', '2026-06-17', '2026-07-06'],
    ['PC 078418 21 G1001 T01', '9 bis avenue Exemple', null, '2026-07-06', '2026-07-08'],
    ['DP 078418 26 G0090', 'avenue Exemple (Lot 2)', 'AZ 607, AZ 608', '2026-08-13', '2026-08-17'],
  ], 'another commune’s number is not a row of this board');
  assert.equal(rows[0].purpose, 'Agrandissement de l\'entrée Modification de la clôture');
  assert.equal(rows[2].purpose, 'Façade');
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|EXEMPLE"|Particulier/);
  assert.ok(rows.every((row) => row.board === 'filings' && row.applicant === null));
  assert.deepEqual(BOARD_PROTOCOLS.montesson.index(montesson, html, { url: montesson.page, part: 'filings' }, {}).rows, rows);
  assert.equal(BOARD_PROTOCOLS.montesson.index(montesson, '<p>Maintenance</p>', { url: montesson.page, part: 'filings' }, {}), null);
});

test('Montesson’s parcels: a bare number is of the section before it, a range gives its ends', () => {
  assert.equal(typedParcels('AD 184, 185, 218, 221 et 511'), 'AD 184, AD 185, AD 218, AD 221, AD 511');
  assert.equal(typedParcels('AI251, AI252, AI259 à AI263, AI583'), 'AI 251, AI 252, AI 259, AI 263, AI 583');
  assert.equal(typedParcels('AO47'), 'AO 47');
  assert.equal(typedParcels('<em>non renseigné</em>'), null);
  assert.equal(typedParcels(''), null);
});

/** One item of Montesson's decisions list, its summary a two-column table. */
const montessonItem = (title, head, cells, posted) => `<div class="redac_telechargement item TListe " id="div_1_0" ><h2 class="titre rechmotcle">${title}</h2>`
  + '<span class="icon link_download"><a href="#collapse0_b2">Voir le résumé</a></span>'
  + `<div id='resume0' class='rechmotcle resume  pl-0'><p><strong>${title}</strong></p><p>${head}</p><table><tbody>`
  + cells.map(([label, value]) => `<tr><td>${label}&nbsp;:&nbsp;</td><td>${value}</td></tr>`).join('')
  + `</tbody></table><p><br />\n<em>Date de publication initiale de la d&eacute;cision : ${posted}</em></p></div>`
  + '<div class="hidden visible_pdf">Lien du fichier : </div></div>';

test('Montesson’s decisions: the order’s or the tacit decision’s day, the site, the nature; the applicant never read', () => {
  const html = '<div class="pagination_nombrederesultat">Affichage des r&eacute;sultats de 1 &agrave; 18 sur 100</div>'
    + montessonItem('DP 078 418 26 G0085', 'D&eacute;cision tacite acquise en date du 3&nbsp;octobre&nbsp;2026',
      [['D&eacute;clarant', 'SAS EXEMPLE repr&eacute;sent&eacute; par PRIVATE PERSON'], ['Adresse du projet', '5ter Rue Exemple<br />\n78360 MONTESSON'],
        ['Description du projet', 'Panneaux photovolta&iuml;ques, 26,98 m&sup2;'], ['Nature de la d&eacute;cision', 'Non-opposition &agrave; la d&eacute;claration pr&eacute;alable']], '03/10/2026')
    + montessonItem('PC 078418 26 G0023', 'D&eacute;cision tacite acquise en date du 31ao&ucirc;t 2026',
      [['Demandeur', 'PRIVATE PERSON'], ['Adresse du projet', '28 avenue Exemple - 78360 MONTESSON'], ['Nature de la d&eacute;cision', 'Accord du permis de construire']], '02/09/2026')
    + montessonItem('PC 078 418 26 G0029', 'Arr&ecirc;t&eacute; n<sup>o</sup> 2026-479 en date du 21 septembre 2026',
      [['Demandeurs', 'PRIVATE PERSON'], ['Adresse du projet', '<p> 102 D rue Exemple</p><p>78360 MONTESSON</p>'], ['Description du projet', 'Maison'], ['Nature de la d&eacute;cision', 'Accord du permis de construire']], '28/09/2026')
    + montessonItem('PC 078 418 21 G1001 T01', 'Arr&ecirc;t&eacute; n° 2026-434 du 24 ao&ucirc;t 2026',
      [['Demandeur', 'PRIVATE PERSON'], ['Adresse des travaux', '9 bis avenue Exemple<br /> 78360 Montesson'], ['Nature de d&eacute;cision', 'Transfert de l&#39;autorisation']], '27/08/2026');
  const rows = montessonDecisions(html, montesson);
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.verdict, row.decidedOn, row.postedOn]), [
    ['DP 078418 26 G0085', '5ter Rue Exemple', 'Non-opposition', '2026-10-03', '2026-10-03'],
    ['PC 078418 26 G0023', '28 avenue Exemple', 'Accord tacite', '2026-08-31', '2026-09-02'],
    ['PC 078418 26 G0029', '102 D rue Exemple', 'Accord', '2026-09-21', '2026-09-28'],
    ['PC 078418 21 G1001 T01', '9 bis avenue Exemple', 'Transfert de l\'autorisation', '2026-08-24', '2026-08-27'],
  ]);
  assert.equal(rows[0].purpose, 'Panneaux photovoltaïques, 26,98 m²');
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|EXEMPLE|Lien du fichier/);
  const protocol = BOARD_PROTOCOLS.montesson;
  const request = { url: montesson.source.decisions, as: 'html', part: 'decisions' };
  assert.deepEqual(protocol.start(montesson).map((item) => item.part), ['filings', 'decisions', 'orders']);
  const answer = protocol.index(montesson, html, request, { since: '2026-08-01' });
  assert.equal(answer.rows.length, 4);
  assert.deepEqual(answer.next, [{ ...request, url: `${montesson.source.decisions}&pagination_idxB2=19&pagecouranteB2=2`, page: 2 }]);
  assert.deepEqual(protocol.index(montesson, html, request, { since: '2026-09-01' }).next, [], 'a page posted before the window ends the list');
  const last = html.replace('de 1 &agrave; 18 sur 100', 'de 91 &agrave; 100 sur 100');
  assert.deepEqual(protocol.index(montesson, last, request, { since: '2026-08-01' }).next, []);
  assert.equal(protocol.index(montesson, '<div class="loading">Veuillez patienter</div>', request, {}), null);
});

test('Montesson’s legal display: an order’s summary in its object, the title’s number kept, signed and posted days', () => {
  const html = '<div class="total_resultat text-center">1 résultat</div><div class="redac_affichagelegal item TListe pl-15" id="div_9478_0" >'
    + '<p class="titre rechmotcle">PD 078418 26 G0005</p><p class="date_publication mb-10 pl-40">Publié le <time datetime=2026-10-02> 2-10-2026</time></p>'
    + '<div class="info_document pl-40"><p class="ma-0">Signataire : Le Maire</p><p class="ma-0">Date de la signature : 25-09-2026</p><p class="ma-0">N° d\'acte: 2026-493</p>'
    + '<p>Objet :   Permis de d&eacute;molir n o &nbsp;PD 078 418 26 G0004  \r\t Demandeur&nbsp;:&nbsp; \r\t SAS EXEMPLE repr&eacute;sent&eacute; par PRIVATE PERSON \r\t Adresse&nbsp;du&nbsp;projet&nbsp;:&nbsp; \r\t 136 avenue Exemple \r\t78360 Montesson \r\t '
    + 'Description&nbsp;du&nbsp;projet&nbsp;:&nbsp; \r\t D&eacute;molition d&rsquo;un local \r\t Nature&nbsp;de&nbsp;la&nbsp;d&eacute;cision&nbsp;:&nbsp; \r\t Accord du permis de d&eacute;molir \r &nbsp; \r</p></div>'
    + '<span class="icon link_download pl-0"><a href="https://www.montesson.fr/affichage_legal/556/1/PD.pdf">Télécharger</a></span></div>';
  const { rows, next } = BOARD_PROTOCOLS.montesson.index(montesson, html, { url: montesson.source.orders, part: 'orders' }, { since: '2026-08-01' });
  assert.equal(next, undefined);
  assert.deepEqual(rows, [{ board: 'decisions', dossier: 'PD 078418 26 G0005', applicant: null, address: '136 avenue Exemple', postcode: '78360',
    purpose: 'Démolition d’un local', verdict: 'Accord', decidedOn: '2026-09-25', postedOn: '2026-10-02' }]);
  const none = '<div class="total_resultat text-center">0 résultat</div>';
  assert.deepEqual(BOARD_PROTOCOLS.montesson.index(montesson, none, { url: montesson.source.orders, part: 'orders' }, {}), { rows: [] });
  const normal = normalisePermitListRow(montesson, 'decisions', rows[0]);
  assert.equal(normal.state, 'accorde');
});

// --- Morangis -----------------------------------------------------------------

const morangis = city('morangis');

test('Morangis’s page: its two sheets, each read again in place with its validators', () => {
  assert.equal(permitListFor('91432'), morangis);
  const html = '<a href="/sites/default/files/upload/documents/decisions-pc.pdf" type="application/pdf"><span class="icon"></span>Permis de construire au 2 octobre 2026 <span>pdf</span></a>'
    + '<a href="/sites/default/files/upload/documents/depot-dp_6.pdf"><span></span>D&eacute;clarations pr&eacute;alables au 2 octobre 2026</a>'
    + '<a href="/sites/default/files/upload/documents/plu.pdf">Plan local d&#039;urbanisme</a>';
  const { files } = BOARD_PROTOCOLS.morangis.index(morangis, html, { url: morangis.page });
  assert.deepEqual(files.map((file) => [file.url.split('/').pop(), file.board, file.layout, file.rolling, file.published]), [
    ['decisions-pc.pdf', 'decisions', 'morangis-permits', true, undefined],
    ['depot-dp_6.pdf', 'filings', 'morangis-declarations', true, undefined],
  ]);
  assert.equal(BOARD_PROTOCOLS.morangis.index(morangis, '<a href="/contact">Contact</a>', { url: morangis.page }), null);
});

test('Morangis’s streets: the kind its sheets index after the name goes first', () => {
  assert.equal(morangisStreet('Armée Leclerc (av de l\')'), 'avenue de l\'Armée Leclerc');
  assert.equal(morangisStreet('Hirondelles (rue des)'), 'rue des Hirondelles');
  assert.equal(morangisStreet('Juvisy (av de)'), 'avenue de Juvisy');
  assert.equal(morangisStreet('Lucien Boilleau (place)'), 'place Lucien Boilleau');
  assert.equal(morangisStreet('Jean-François de la Pérouse (allée)'), 'allée Jean-François de la Pérouse');
  assert.equal(morangisStreet('Colette Besson'), 'Colette Besson');
  assert.equal(morangisStreet(''), null);
});

/** A run of Morangis's sheets, its advance as wide as its glyphs. */
const cell = (x, y, text) => ({ x, x1: x + 4.6 * text.length, y, text, size: 9 });
const MORANGIS_PERMIT_HEAD = [cell(88, 511, 'P.C. 2026'), cell(170, 511, 'Nature de'), cell(280, 511, 'Nom'), cell(376, 511, 'N°'), cell(459, 511, 'Nom'),
  cell(582, 511, 'Nature des'), cell(687, 511, 'Date de'), cell(748, 511, 'Date'), cell(103, 496, 'N°'), cell(169, 496, 'la décision'),
  cell(256, 496, 'du pétitionnaire'), cell(369, 496, 'Voirie'), cell(449, 496, 'de la voie'), cell(589, 496, 'travaux'), cell(686, 496, 'décision'), cell(735, 496, 'd\'affichage')];

test('Morangis’s permits: a row from under the one above down to its decision, the number on one line or two', () => {
  const page = { runs: [cell(337, 561, 'PERMIS DE CONSTRUIRE 2026'), ...MORANGIS_PERMIT_HEAD,
    cell(537, 466, 'régularisation de la'), cell(537, 454, 'transformation d\'un garage'),
    cell(71, 419, '091 432 26 00001'), cell(165, 419, 'ACCORD'), cell(222, 419, 'PRIVATE PERSON'), cell(377, 419, '46'), cell(405, 419, 'Exemple (av)'),
    cell(537, 419, 'supplémentaire.'), cell(682, 419, '26/01/2026'), cell(737, 419, '30/01/2026'),
    cell(537, 408, 'surélévation et changement de'),
    cell(69, 352, '091 432 24 1 0017'), cell(537, 352, 'pour aménagement des'),
    cell(98, 340, 'M 01'), cell(165, 340, 'REFUS'), cell(222, 340, 'SCI EXEMPLE'), cell(370, 340, '67bis'), cell(405, 340, 'Exemple (av de l\')'),
    cell(537, 340, 'combles.'), cell(682, 340, '09/06/2026'), cell(737, 340, '19/06/2026'),
    cell(56, 262, '091 432 25 0005 M 01'), cell(165, 262, 'annulation'), cell(222, 262, 'PRIVATE PERSON'), cell(377, 262, '15'), cell(405, 262, 'Exemples (rue des)'),
    cell(537, 262, 'transfert PC'), cell(682, 262, '11/09/2026'), cell(737, 262, '18/09/2026'),
    cell(222, 250, 'PRIVATE PERSON')] };
  const rows = BOARD_READERS['morangis-permits']({ pages: [page] }, { city: morangis, file: { board: 'decisions' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.verdict, row.decidedOn, row.postedOn, row.purpose]), [
    ['PC 091432 26 00001', '46 avenue Exemple', 'Accord', '2026-01-26', '2026-01-30', 'régularisation de la transformation d\'un garage supplémentaire.'],
    ['PC 091432 24 10017 M01', '67bis avenue de l\'Exemple', 'Refus', '2026-06-09', '2026-06-19', 'surélévation et changement de pour aménagement des combles.'],
    ['PC 091432 25 00005 M01', '15 rue des Exemples', 'Retrait', '2026-09-11', '2026-09-18', 'transfert PC'],
  ]);
  assert.ok(rows.every((row) => row.board === 'decisions' && row.applicant === null));
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|SCI/);
  assert.deepEqual(BOARD_READERS['morangis-permits']({ pages: [{ runs: [cell(71, 419, '091 432 26 00001')] }] }, { city: morangis }), [], 'a page without the sheet’s header');
});

test('Morangis’s declarations: each cell centred on its row, the header of the first page kept for the next, a pending one a filing', () => {
  const head = [cell(396, 558, 'DP 2026'), cell(42, 497, 'DP'), cell(101, 497, 'DEPÔT'), cell(201, 497, 'BENEFICIAIRE'), cell(383, 497, 'DES TRAVAUX'),
    cell(533, 497, 'N°'), cell(605, 497, 'ADRESSE'), cell(706, 504, 'DECISION'), cell(777, 504, 'DATE')];
  const first = { runs: [...head,
    cell(703, 472, 'Non'), cell(27, 464, '26 00001'), cell(91, 464, '08/01/2026'), cell(157, 464, 'PRIVATE PERSON'), cell(319, 464, 'édification de murs de clôture'),
    cell(533, 464, '25'), cell(558, 464, 'Exemples (av des)'), cell(763, 464, '05/02/2026'), cell(703, 456, 'opposition'),
    cell(319, 441, 'déplacement de la porte et'), cell(27, 433, '26 00018'), cell(93, 433, '02/03/2026'), cell(157, 433, 'PRIVATE PERSON'),
    cell(319, 433, 'installation de fenêtres de toit'), cell(536, 433, '9'), cell(558, 433, 'Exemples (av des)'),
    cell(27, 402, '26 00093'), cell(93, 402, '18/08/2026'), cell(157, 402, 'PRIVATE PERSON'), cell(319, 402, 'construction d\'un mur'),
    cell(558, 402, 'SAVIGNY-SUR-ORGE'), cell(703, 402, 'irrecevable'), cell(763, 402, '18/08/2026'), cell(406, 26, 'Page 1')] };
  const second = { runs: [cell(396, 558, 'DP 2026'),
    cell(703, 528, 'Non'), cell(319, 512, 'abattage d\'arbres'), cell(703, 512, 'opposition'),
    cell(27, 504, '26 00045'), cell(93, 504, '17/04/2026'), cell(157, 504, 'PRIVATE PERSON'), cell(522, 504, '119 bisExemple (av de la)'), cell(763, 504, '26/022026'),
    cell(703, 496, 'tacite'),
    cell(27, 473, '26 00094'), cell(93, 473, '21/08/2026'), cell(157, 473, 'PRIVATE PERSON'), cell(319, 473, 'ouverture d\'un portail'), cell(536, 473, '8'),
    cell(558, 473, 'Exemples (rue des)'), cell(703, 473, 'opposition'), cell(763, 473, '01/09/2026'), cell(406, 26, 'Page 2')] };
  const rows = BOARD_READERS['morangis-declarations']({ pages: [first, second] }, { city: morangis, file: { board: 'filings' } });
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.verdict ?? null, row.filedOn, row.decidedOn ?? null, row.purpose]), [
    ['decisions', 'DP 091432 26 00001', '25 avenue des Exemples', 'Non-opposition', '2026-01-08', '2026-02-05', 'édification de murs de clôture'],
    ['filings', 'DP 091432 26 00018', '9 avenue des Exemples', null, '2026-03-02', null, 'déplacement de la porte et installation de fenêtres de toit'],
    ['decisions', 'DP 091432 26 00093', null, 'irrecevable', '2026-08-18', '2026-08-18', 'construction d\'un mur'],
    ['decisions', 'DP 091432 26 00045', '119 bis avenue de la Exemple', 'Non-opposition', '2026-04-17', '2026-02-26', 'abattage d\'arbres'],
    ['decisions', 'DP 091432 26 00094', '8 rue des Exemples', 'Refus', '2026-08-21', '2026-09-01', 'ouverture d\'un portail'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|Page \d|DP 2026/);
});

// --- Amilly -------------------------------------------------------------------

const amilly = city('amilly');
const AMILLY_UPLOADS = 'https://www.amilly.com/wp-content/uploads';
const amillyLink = (path, words) => `<a role="region" class="elementor-element e-con-full" data-settings="{&quot;x&quot;:[]}" href="${AMILLY_UPLOADS}/${path}" target="_blank" rel="nofollow"><div><p>${words}</p></div></a>`;

test('Amilly’s page: the newest sheet of each kind, dated by « Publié le » or its name’s last day', () => {
  assert.equal(permitListFor('45004'), amilly);
  assert.equal(amillyDay('URBANISME-Dossiers-delivres-entre-le-24062026-et-le-23092026.pdf'), '2026-09-23');
  assert.equal(amillyDay('URBANISME-–-Dossiers-deposes-avant-le-16-09-2026.pdf'), '2026-09-16');
  assert.equal(amillyDay('URBANISME.pdf'), null);
  const html = [
    amillyLink('2026/10/URBANISME-Dossiers-deposes-avant-le-30-09-2026.pdf', 'URBANISME-Dossiers déposés avant le 30-09-2026 Publié le 01/10/2026'),
    amillyLink('2026/09/URBANISME-Dossiers-deposes-avant-le-23092026.pdf', 'URBANISME - Dossiers déposés avant le 23/09/2026 Publié le 24/09/2026'),
    amillyLink('2026/09/URBANISME-Dossiers-delivres-entre-le-24062026-et-le-23092026.pdf', 'URBANISME - Dossiers délivrés entre le 24/06/2026 et le 23/09/2026'),
    amillyLink('2026/10/URBANISME-Dossiers-delivres-entre-le-30-06-2026-et-le-30-09-2026.pdf', 'URBANISME-Dossiers délivrés entre le 30-06-2026 et le 30-09-2026'),
    amillyLink('2026/09/Arrete-circulation.pdf', 'Arrêté de circulation Publié le 02/10/2026'),
  ].join('\n');
  const { files } = BOARD_PROTOCOLS.amilly.index(amilly, html, { url: amilly.page });
  assert.deepEqual(files.map((file) => [file.board, file.url.split('/').pop(), file.layout, file.published]), [
    ['filings', 'URBANISME-Dossiers-deposes-avant-le-30-09-2026.pdf', 'amilly-list', '2026-10-01'],
    ['decisions', 'URBANISME-Dossiers-delivres-entre-le-30-06-2026-et-le-30-09-2026.pdf', 'amilly-list', '2026-09-30'],
  ]);
  assert.equal(BOARD_PROTOCOLS.amilly.index(amilly, amillyLink('2026/09/Arrete-circulation.pdf', 'Arrêté'), { url: amilly.page }), null);
});

/** A run of Amilly's sheets: its advance as wide as its glyphs, centred on `middle`. */
const centred = (middle, y, text) => ({ x: middle - 2.2 * text.length, x1: middle + 2.2 * text.length, y, text, size: 7 });

test('Amilly’s filings: each cell to the row whose number is nearest its middle, the applicant and certificates left out', () => {
  const page = { runs: [centred(351, 472, 'Dossiers déposés avant le 30/09/2026'),
    centred(97, 441, 'Date de dépôt du dossier'), centred(196, 441, 'Numéro de demande'), centred(315, 441, 'Nom du demandeur'),
    centred(471, 441, 'Adresse du lot'), centred(605, 441, 'Parcelle'), centred(716, 441, 'Objet du dossier'),
    centred(97, 424, '10/03/2026'), centred(196, 424, 'DP0450042600055'), centred(315, 424, 'PRIVATE PERSON'), centred(471, 424, 'AVENUE EXEMPLE'),
    centred(605, 424, 'CE 0089'), centred(716, 424, 'DECLARATION PREALABLE'),
    centred(605, 403, 'CM0775 / CM0360 /'), centred(97, 395, '28/04/2026'), centred(196, 395, 'CU0450042600112'), centred(315, 395, 'PRIVATE PERSON'),
    centred(471, 395, 'ROUTE EXEMPLE'), centred(605, 395, 'CM0773'), centred(605, 387, 'CM0779 / CM0776'),
    centred(97, 371, '27/05/2026'), centred(196, 371, 'DP0450042600119'), centred(315, 371, 'PRIVATE PERSON'), centred(471, 371, '12 AVENUE EXEMPLE'),
    centred(605, 371, 'CH0698'), centred(716, 371, 'DECLARATION PREALABLE'),
    centred(605, 351, 'AC0830 / AC0770 /'), centred(605, 343, 'AC0833 / AD1537 /'), centred(605, 335, 'AD1155 / AD1183 /'),
    centred(97, 324, '01/06/2026'), centred(196, 324, 'PA0450042600002'), centred(315, 324, 'SAS EXEMPLE'), centred(471, 324, '658 RUE EXEMPLE'),
    centred(716, 324, 'PERMIS D\'AMENAGEMENT'), centred(605, 327, 'AD1186 / AD1190 /'), centred(605, 319, 'AD1191 / AD1194 /'),
    centred(605, 311, 'AD1195 / AD1199 /'), centred(605, 303, 'AD0138 / AD0141'), centred(605, 295, 'AD0142')] };
  const rows = BOARD_READERS['amilly-list']({ pages: [page] }, { city: amilly, file: { board: 'filings' } });
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.parcels, row.filedOn]), [
    ['filings', 'DP 045004 26 00055', 'AVENUE EXEMPLE', 'CE 0089', '2026-03-10'],
    ['filings', 'DP 045004 26 00119', '12 AVENUE EXEMPLE', 'CH 0698', '2026-05-27'],
    ['filings', 'PA 045004 26 00002', '658 RUE EXEMPLE', 'AC 0830, AC 0770, AC 0833, AD 1537, AD 1155, AD 1183, AD 1186, AD 1190, AD 1191, AD 1194, AD 1195, AD 1199, AD 0138, AD 0141, AD 0142', '2026-06-01'],
  ], 'a certificate is not a row; a block of parcels goes whole to the row at its middle');
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|SAS/);
});

test('Amilly’s decisions: the parcels under no title of their own, the decision in the board’s words, a row without a number its own', () => {
  const page = { runs: [centred(766, 518, 'Affiché le 01/10/2026'), centred(760, 446, 'Date de signature de'),
    centred(84, 443, 'Numéro de demande'), centred(194, 443, 'Nom du demandeur'), centred(344, 443, 'Adresse du lot'), centred(561, 443, 'Objet de l\'arrêté'),
    centred(676, 443, 'Décision'), centred(760, 440, 'l\'arrêté'),
    centred(84, 430, 'DP0450042600112'), centred(194, 430, 'PRIVATE PERSON'), centred(344, 430, '20 RUE EXEMPLE'), centred(458, 430, 'AD0730'),
    centred(561, 430, 'DECLARATION PREALABLE'), centred(676, 430, 'FAVORABLE'), centred(760, 430, '30/06/2026'),
    centred(458, 396, 'BN0275 / BN0276 /'), centred(84, 393, 'PC0450042600014'), centred(194, 393, 'PRIVATE PERSON'), centred(344, 393, '73 RUE EXEMPLE'),
    centred(561, 393, 'PERMIS DE CONSTRUIRE'), centred(676, 393, 'REJET TACITE'), centred(760, 393, '01/07/2026'), centred(458, 390, 'BN0282'),
    centred(458, 362, 'AV0074 / AV0145 /'), centred(84, 359, 'NEANT'), centred(344, 359, 'LIEU-DIT EXEMPLE'), centred(676, 359, 'NEANT'), centred(760, 359, '28/08/2026'),
    centred(458, 356, 'AV0210'),
    centred(84, 344, 'DP0450042600160'), centred(194, 344, 'PRIVATE PERSON'), centred(344, 344, '10 RUE EXEMPLE'), centred(458, 344, 'BM0690'),
    centred(561, 344, 'DECLARATION PREALABLE'), centred(676, 344, 'NON-OPPOSITION'), centred(760, 344, '28/08/2026'),
    centred(84, 331, 'CU0450042600172'), centred(194, 331, 'PRIVATE PERSON'), centred(344, 331, 'RUE EXEMPLE'), centred(676, 331, 'FAVORABLE'), centred(760, 331, '03/07/2026')] };
  const rows = BOARD_READERS['amilly-list']({ pages: [page] }, { city: amilly, file: { board: 'decisions' } });
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.parcels, row.verdict, row.decidedOn]), [
    ['decisions', 'DP 045004 26 00112', '20 RUE EXEMPLE', 'AD 0730', 'Accord', '2026-06-30'],
    ['decisions', 'PC 045004 26 00014', '73 RUE EXEMPLE', 'BN 0275, BN 0276, BN 0282', 'REJET TACITE', '2026-07-01'],
    ['decisions', 'DP 045004 26 00160', '10 RUE EXEMPLE', 'BM 0690', 'Non-opposition', '2026-08-28'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|NEANT/);
});

// --- Dourdan ------------------------------------------------------------------

const dourdan = city('dourdan');
const DOURDAN_UPLOADS = 'https://www.dourdan.fr/wp-content/uploads';
/** A card of the Creasit document library, as its API's `posts` give it. */
const creasitCard = (title, day, file) => `<article class="card card--document card--document--v1 e-ressources" data-categoryid="132">\n`
  + `<p class="card__category document-details__category">E-Ressources - urbanisme</p>\n`
  + `<p class="listing__title listing__title--files document-details__title">${title}</p>\n`
  + `<ul class="files-infos document-details__list">\n<li class="document-details__item document-details__item--date files-infos__date">${day}</li>\n`
  + `<li class="document-details__item document-details__item--extension files-infos__type">pdf</li>\n</ul>\n`
  + `<a href="javascript:void(0)" class="documents-details__button link-document link-document--feuilleter" data-href="${DOURDAN_UPLOADS}/${file}" data-id="1">Feuilleter</a>\n`
  + `<a href="${DOURDAN_UPLOADS}/${file}" class="documents-details__button link-document link-document--telecharger" download="${title}">Télécharger</a>\n</article>`;

test('Dourdan is in the permit registry, read through its document library’s API, thirty documents a page', () => {
  assert.equal(permitListFor('91200'), dourdan);
  const [first] = BOARD_PROTOCOLS.dourdan.start(dourdan, {});
  const url = new URL(first.url);
  assert.equal(`${url.origin}${url.pathname}`, 'https://www.dourdan.fr/wp-json/creasit/postsQuery');
  assert.deepEqual([url.searchParams.get('cpt'), url.searchParams.get('category'), url.searchParams.get('numberPosts'), url.searchParams.get('pages'), first.as],
    ['documents', '132', '30', '1', 'json']);
});

test('Dourdan’s cards: the lists of filings, and each order a scan its title names; signs, works in public buildings and the rest left out', () => {
  const posts = [
    creasitCard('DP 91200 26 10089 - 32 rue Exemple', '28 Septembre 2026', '2026/09/DP2610089-arrete.pdf'),
    creasitCard('AP 91200 26 1005 - 46 rue Exemple', '18 Septembre 2026', '2026/09/AP261005-ARRETE.pdf'),
    creasitCard('Dossiers déposés au 15 septembre 2026', '15 Septembre 2026', '2026/09/Dossiers-deposes-le-15-septembre-2026.pdf'),
    creasitCard('AT 912002610009 - 18 rue Exemple', '31 Août 2026', '2026/08/AT-2610009-PRIVATE-PERSON-AFP.pdf'),
    creasitCard('PC 91200 09 10015 T04 - 43 rue d&#039;Exemple', '31 Août 2026', '2026/08/PC-91200-09-10015-t04-SCCV-EXEMPLE.pdf'),
    creasitCard('PC 91200 2610010 - rue Exemple', '12 Août 2026', '2026/08/PC-91200-2610010-PRIVATE-PERSON-REFUS.pdf'),
    creasitCard('DP91200 26 10085- 3 Allée Exemple', '10 Août 2026', '2026/08/DP2610085-AF.pdf'),
    creasitCard('Contrôle sanitaire des eaux', '1er Juillet 2026', '2026/07/SKM_284e26063015490.pdf'),
  ];
  const answer = BOARD_PROTOCOLS.dourdan.index(dourdan, { pagination_infos: { foundPosts: 147 }, posts }, { page: 1 }, { since: '2026-06-01' });
  assert.deepEqual(answer.files.map((file) => [file.board, file.layout, file.published, file.row?.dossier ?? null, file.row?.address ?? null, Boolean(file.scan)]), [
    ['decisions', 'dourdan-order', '2026-09-28', 'DP 091200 26 10089', '32 rue Exemple', true],
    ['filings', 'dourdan-filings', '2026-09-15', null, null, false],
    ['decisions', 'dourdan-order', '2026-08-31', 'PC 091200 09 10015 T04', '43 rue d\'Exemple', true],
    ['decisions', 'dourdan-order', '2026-08-12', 'PC 091200 26 10010', 'rue Exemple', true],
    ['decisions', 'dourdan-order', '2026-08-10', 'DP 091200 26 10085', '3 Allée Exemple', true],
  ]);
  assert.deepEqual([answer.files[0].row.verdict, answer.files[0].row.postedOn, answer.files[0].row.applicant], ['Décision signée', '2026-09-28', null]);
  assert.doesNotMatch(JSON.stringify(answer.files.map((file) => file.row ?? {})), /PRIVATE|SCCV/);
  // The oldest card, of 1 July, is after the window's start: the next thirty are asked.
  assert.equal(new URL(answer.next[0].url).searchParams.get('pages'), '2');
  assert.deepEqual(BOARD_PROTOCOLS.dourdan.index(dourdan, { pagination_infos: { foundPosts: 147 }, posts }, { page: 1 }, { since: '2026-08-01' }).next, []);
  assert.deepEqual(BOARD_PROTOCOLS.dourdan.index(dourdan, { pagination_infos: { foundPosts: 8 }, posts }, { page: 1 }, { since: '2026-06-01' }).next, []);
  assert.equal(BOARD_PROTOCOLS.dourdan.index(dourdan, { code: 'rest_no_route' }, { page: 1 }, {}), null);
});

/** Dourdan's list header: the five column titles at `y`. */
const dourdanHeader = (y) => [run(28, y, 'Date de dépôt'), run(154, y, 'Numéro de dossier'), run(279, y, 'Pétitionnaire'),
  run(409, y, 'Adresse du projet'), run(574, y, 'Description du projet')];

test('Dourdan’s list: each cell to the row its number’s line hangs it from, across a page; signs, public buildings and the applicant left out', () => {
  const first = { runs: [run(560, 560, 'VILLE DE DOURDAN'), run(300, 540, 'Dossiers déposés au 15 septembre 2026'), ...dourdanHeader(500),
    run(28, 480, '01/09/2026'), run(154, 480, 'AT 91200 26 10012'), run(279, 480, 'PRIVATE PERSON'), run(409, 480, '13 rue Exemple'),
    run(574, 480, 'Travaux de mise en conformité'), run(409, 468, '91410 DOURDAN'),
    // The day comes first in the page's stream, and the site's font sits a point higher than the number's.
    run(28, 440, '15/09/2026'), run(279, 440, 'PRIVATE PERSON'), run(154, 440, 'DP 91200 26 10095'), run(409, 441, '23 Avenue Exemple'),
    run(574, 440, 'Remplacement de fenêtre'), run(409, 429, '91410 Dourdan'),
    run(28, 400, '17/07/2026'), run(154, 400, 'PC 91200 24 10016'), run(279, 400, 'PRIVATE PERSON'), run(409, 400, '2 Rue de l_Exemple'),
    run(574, 400, 'Modification du permis initial :'), run(154, 388, 'M01'), run(279, 388, 'SAS EXEMPLE'), run(409, 388, '91410 Dourdan'),
    run(574, 388, 'suppression de balcons'),
    run(28, 360, '18/08/2026'), run(154, 360, 'PC 91200 26 10016'), run(279, 360, 'PRIVATE PERSON'), run(409, 360, 'Rue Exemple, Le Clos de'),
    run(574, 360, 'Construction d’une maison individuelle'), run(739, 38, 'Page 1 sur 2')] };
  const second = { runs: [...dourdanHeader(560), run(409, 540, 'l’Église Lot 8'), run(409, 528, '91410 Dourdan'),
    run(28, 510, '23/07/2026'), run(154, 510, 'PC 91200 26 10013'), run(279, 510, 'PRIVATE PERSON'), run(409, 510, '3 Avenue Exemple'),
    run(574, 510, 'Réalisation d’une construction'), run(409, 498, '91410 Dourdan'), run(739, 38, 'Page 2 sur 2')] };
  const rows = BOARD_READERS['dourdan-filings']({ pages: [first, second] }, { city: dourdan, file: { board: 'filings' } });
  assert.deepEqual(rows.map((row) => [row.board, row.dossier, row.address, row.postcode, row.filedOn, row.purpose]), [
    ['filings', 'DP 091200 26 10095', '23 Avenue Exemple', '91410', '2026-09-15', 'Remplacement de fenêtre'],
    ['filings', 'PC 091200 24 10016 M01', '2 Rue de l’Exemple', '91410', '2026-07-17', 'Modification du permis initial : suppression de balcons'],
    ['filings', 'PC 091200 26 10016', 'Rue Exemple, Le Clos de l’Église Lot 8', '91410', '2026-08-18', 'Construction d’une maison individuelle'],
    ['filings', 'PC 091200 26 10013', '3 Avenue Exemple', '91410', '2026-07-23', 'Réalisation d’une construction'],
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|SAS|Page/);
});

test('a Dourdan order read by OCR: its verdict and parcels, the number and site its title types', () => {
  const runs = [[200, 780, 'Dourdan REFUS'], [200, 768, 'D’UN PERMIS DE CONSTRUIRE'], [200, 756, 'DÉLIVRÉ PAR LE MAIRE AU NOM DE LA COMMUNE'],
    [60, 740, 'Dossier déposé le 12 Juin 2026 N° PC 91200 26 10010'], [60, 716, 'Par : Monsieur PRIVATE PERSON'], [60, 704, 'Demeurant à : 9 rue Privée'],
    [60, 680, 'Pour : Construction d’une maison individuelle'],
    [60, 660, 'Sur un terrain sis à : Rue Exemple, lot 8 Destination : Habitation'], [60, 648, 'Cadastré : AO411'],
    [250, 560, 'ARRETE'], [60, 540, 'Article 1 : Le permis de construire est REFUSÉ pour le projet décrit dans la demande susvisée.'],
    [300, 400, 'Fait à DOURDAN, le 10 août 2026']];
  const document = { pages: [{ runs: runs.map(([x, y, text]) => ({ x, y, x1: x + text.length * 4.5, text })) }] };
  const title = { board: 'decisions', dossier: 'PC 091200 26 10010', applicant: null, address: 'rue Exemple', postcode: '91410', verdict: 'Décision signée', postedOn: '2026-08-12' };
  const [row] = BOARD_READERS['dourdan-order'](document, { city: dourdan, file: { board: 'decisions', row: title } });
  assert.deepEqual([row.board, row.dossier, row.address, row.postcode, row.verdict, row.parcels, row.filedOn, row.postedOn],
    ['decisions', 'PC 091200 26 10010', 'rue Exemple', '91410', 'Refus', 'AO 411', '2026-06-12', '2026-08-12']);
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|Privée|Destination/);
  assert.equal(normalisePermitListRow(dourdan, 'decisions', row).state, 'refuse');
});
