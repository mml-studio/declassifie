import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSTED_LIST_PROTOCOLS, postedActFiles, postedListDay, postedListFiles } from './permitBoardsPostedLists.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS, BOARD_READERS } from './permitBoards.js';
import { PERMIT_LIST_READERS, permitListFor, normalisePermitListRow } from './permitListsFeed.js';
import { municipalDossier } from './municipalPermitsFeed.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const KEYS = ['haguenau', 'saverne', 'barr', 'benfeld', 'offendorf', 'lauterbourg'];
const protocol = POSTED_LIST_PROTOCOLS['posted-lists'];
const link = (href, words = 'Télécharger') => `<li><a href="${href}">${words}</a></li>`;

test('the posted-list communes are in the permit registry, read by one protocol and the report readers', () => {
  for (const key of KEYS) {
    assert.equal(permitListFor(city(key).insee), city(key), key);
    assert.equal(city(key).source.protocol, 'posted-lists');
    assert.equal(BOARD_PROTOCOLS['posted-lists'], protocol);
  }
  assert.equal(typeof BOARD_READERS['cartds-report-filings'], 'function');
  assert.ok(Object.isFrozen(POSTED_LIST_PROTOCOLS));
});

test('a list’s day is read from its name or its words, whatever order the town writes it in', () => {
  assert.equal(postedListDay('/files/28 09 2026 VILLE DE HAGUENAU DEPOTS.pdf'), '2026-09-28');
  assert.equal(postedListDay('/wp-content/uploads/2026/10/Liste-des-avis-de-dépôt-26-10-01.pdf'), '2026-10-01');
  assert.equal(postedListDay('/liste_des_avis_de_depot_24_09_26.pdf'), '2026-09-24');
  assert.equal(postedListDay('/x.pdf', 'Liste des décisions – 21/09/2026'), '2026-09-21');
  assert.equal(postedListDay('/view_document.php', 'Dépôts du 1er octobre 2026'), '2026-10-01');
  assert.equal(postedListDay('/2026-09-30-liste.pdf'), '2026-09-30');
  assert.equal(postedListDay('/20261002_Liste-des-decisions.pdf'), '2026-10-02');
  assert.equal(postedListDay('/Liste-affichage-depot-02_10_2026-11_30_22.xlsx'), '2026-10-02');
  assert.equal(postedListDay('/wp-content/uploads/2026/09/liste.pdf'), '2026-09-01', 'the upload month, failing a day');
  assert.equal(postedListDay('/documents/81097'), null);
});

test('workbook links require an explicit board sheet and leave other municipalities on PDFs', () => {
  const html = link('/files/Liste-affichage-depot-02_10_2026.xlsx', 'Liste des avis de dépôt');
  assert.equal(postedListFiles(city('barr'), html, city('barr').page), null);
});

test('an edition day never spans an upload directory and its numeric filename', () => {
  const path = '/wp-content/uploads/2026/09/09-24-Affichage-des-Depots.pdf';
  assert.equal(postedListDay(path, 'Dossiers déposés avant le 24 septembre 2026'), '2026-09-24');
  assert.equal(postedListDay(path), '2026-09-01', 'no full day in the filename: only the known upload month');
  const files = postedListFiles(city('quimperle'), link(path, 'Dossiers déposés avant le 24 septembre 2026'), city('quimperle').page);
  assert.equal(files[0].layout, 'town-quarter-turn-filings');
  assert.equal(files[0].published, '2026-09-24');
});

test('Osny revalidates dated lists that its publisher replaces in place', () => {
  const source = city('osny');
  assert.equal(permitListFor('95476'), source);
  const files = postedListFiles(source, link('/sites/osny/files/document/affichage-decision-du-28.09.2026.pdf',
    'Affichage décision jusqu’au 28.09.2026'), source.page);
  assert.deepEqual(files.map(({ board, published, rolling, layout }) => ({ board, published, rolling, layout })),
    [{ board: 'decisions', published: '2026-09-28', rolling: true, layout: 'town-decided-until' }]);
});

test('whole-register snapshots retain each board’s newest edition, not departed pending filings', () => {
  const source = city('quimperle');
  const html = link('/wp-content/uploads/2026/09/09-17-Affichage-des-Depots.pdf', 'Dossiers déposés avant le 17 septembre 2026')
    + link('/wp-content/uploads/2026/09/09-24-Affichage-des-Depots.pdf', 'Dossiers déposés avant le 24 septembre 2026')
    + link('/wp-content/uploads/2026/09/09-24-Affichage-des-Decisions.pdf', 'Autorisations délivrées jusqu’au 24 septembre 2026');
  assert.deepEqual(postedListFiles(source, html, source.page).map(({ board, published }) => [board, published]),
    [['filings', '2026-09-24'], ['decisions', '2026-09-24']]);
});

test('current Osny and Quimperlé filings are under review only while their newest snapshot retains them', () => {
  for (const key of ['osny', 'quimperle']) {
    const source = city(key);
    const row = { dossier: `DP ${source.insee} 26 00222`, address: '8 Rue Exemple', filedOn: '2026-09-21' };
    assert.equal(normalisePermitListRow(source, 'filings', row, { current: true }).state, 'instruction');
    assert.equal(normalisePermitListRow(source, 'filings', row, { current: false }).state, 'depose');
  }
});

test('a page gives each list newest first, a list with no day as the board refreshed in place', () => {
  const html = [
    link('/wp-content/uploads/2026/09/liste-des-avis-de-depot-21-09-2026.pdf'),
    link('/wp-content/uploads/2026/09/liste-des-avis-de-depot-30-09-2026.pdf'),
    link('/wp-content/uploads/2026/09/liste-des-decisions-30-09-2026.pdf'),
    link('/plu/reglement.pdf', 'Règlement du PLU'),
    link('/actualites', 'Liste des avis de dépôt'),
  ].join('');
  const files = postedListFiles(city('barr'), html, 'https://barr.fr/actes/');
  assert.deepEqual(files.map((file) => [file.board, file.published, file.layout, file.url.replace(/^.*\//, '')]), [
    ['filings', '2026-09-30', 'cartds-report-filings', 'liste-des-avis-de-depot-30-09-2026.pdf'],
    ['decisions', '2026-09-30', 'cartds-report-decisions', 'liste-des-decisions-30-09-2026.pdf'],
    ['filings', '2026-09-21', 'cartds-report-filings', 'liste-des-avis-de-depot-21-09-2026.pdf'],
  ]);
  const rolling = postedListFiles(city('saverne'), link('/files/a.pdf', 'Liste des avis de dépôt') + link('/files/b.pdf', 'Liste des avis de dépôt')
    + link('/files/c.pdf', 'Liste des décisions'), 'https://www.saverne.fr/');
  assert.deepEqual(rolling.map((file) => [file.board, file.rolling, file.url.replace(/^.*\//, '')]),
    [['filings', true, 'a.pdf'], ['decisions', true, 'c.pdf']]);
  assert.equal(postedListFiles(city('saverne'), link('/plu.pdf', 'PLU'), 'https://www.saverne.fr/'), null, 'no list, no board');
});

test('a town’s own patterns name its lists', () => {
  const html = link('/files_upload/public/Urbanisme/28%2009%202026%20VILLE%20DE%20HAGUENAU%20DEPOTS.pdf')
    + link('/files_upload/public/Urbanisme/28%2009%202026%20%20VILLE%20DE%20HAGUENAU%20AUTORISATIONS.pdf');
  const files = postedListFiles(city('haguenau'), html, 'https://haguenau.fr/fr/page/x');
  assert.deepEqual(files.map((file) => [file.board, file.published]), [['filings', '2026-09-28'], ['decisions', '2026-09-28']]);
  const weeks = postedListFiles(city('lauterbourg'), link('/view_document.php?id=469', 'Dépôts du 24 septembre 2026 Télécharger')
    + link('/view_document.php?id=464', 'Décisions du 24 septembre 2026 Télécharger'), 'https://www.mairie-lauterbourg.fr/FR/x.html');
  assert.deepEqual(weeks.map((file) => [file.board, file.published]), [['filings', '2026-09-24'], ['decisions', '2026-09-24']]);
});

test('a town that follows its links asks each one’s page for the PDF it links', () => {
  const benfeld = city('benfeld');
  const page = 'https://www.benfeld.fr/documents_administratifs';
  const first = protocol.index(benfeld, link('/documents_administratifs/81097', 'Liste des avis de dépôt')
    + link('/documents_administratifs/81098', 'Liste des décisions'), { url: page }, {});
  assert.deepEqual(first.files, []);
  assert.deepEqual(first.next.map((request) => [request.url, request.board, request.as]), [
    ['https://www.benfeld.fr/documents_administratifs/81097', 'filings', 'html'],
    ['https://www.benfeld.fr/documents_administratifs/81098', 'decisions', 'html'],
  ]);
  const second = protocol.index(benfeld, link('https://files.appli-intramuros.com/legal_documents/7937/8846b5.pdf', 'Télécharger'), first.next[0], {});
  assert.deepEqual(second.files, [{ url: 'https://files.appli-intramuros.com/legal_documents/7937/8846b5.pdf', board: 'filings',
    layout: 'cartds-report-filings', rolling: true }]);
  assert.equal(protocol.index(benfeld, '<p>nothing</p>', first.next[0], {}), null);
});

// --- One PDF per act -----------------------------------------------------------

const ACT_KEYS = ['saint-martin-boulogne', 'marquette-lez-lille', 'bauvin', 'rouvroy', 'coulogne', 'crespin', 'dourges', 'roost-warendin', 'anor', 'montbeliard', 'villeneuve-sur-lot', 'wasquehal', 'mantes-la-ville',
  'val-de-briey', 'kaysersberg-vignoble', 'biesheim', 'rurange-les-thionville', 'hagondange', 'emerainville'];

test('the communes that post one PDF per act are read by `posted-acts` and the DematDOC act reader', () => {
  for (const key of ACT_KEYS) {
    assert.equal(permitListFor(city(key).insee), city(key), key);
    assert.equal(city(key).source.protocol, 'posted-acts', key);
  }
  assert.equal(BOARD_PROTOCOLS['posted-acts'], POSTED_LIST_PROTOCOLS['posted-acts']);
  assert.equal(typeof PERMIT_LIST_READERS['dematdoc-notice'], 'function');
});

test('an act is a link that names one of the commune’s dossiers, its board said by its words', () => {
  const html = [
    link('/wp-content/uploads/2026/10/DP-062758-26-00149-Recepisse-de-Depot.pdf'),
    link('/wp-content/uploads/2026/09/arrete.pdf', 'ARRETE DP 26-85'),
    link('/wp-content/uploads/2026/09/arrete-2.pdf', 'Arrêté DP 059 386 26 00095'),
    link('/wp-content/uploads/2026/09/reglement-plu.pdf', 'Règlement du PLU'),
  ].join('');
  const files = postedActFiles(city('saint-martin-boulogne'), html, 'https://saintmartinboulogne.fr/affichage-legal/', '2026-08-01');
  assert.ok(files, 'the page names acts');
  assert.deepEqual(files.map((file) => [file.row.dossier, file.board, file.published]), [
    ['DP 062758 26 00149', 'filings', '2026-10-01'],
    ['DP 062758 26 00085', 'decisions', '2026-09-01'],
  ], 'another commune’s full number never becomes a short one');
  assert.ok(files.every((file) => file.layout === 'dematdoc-notice' && file.ocr));
});

test('a download button names its act in its title', () => {
  const html = '<a class="document__link" href="/download/file/17347?key=x" title="Télécharger : dp_26_00058_arrete-tampon_1.pdf - extension pdf - poids 196.63 Ko">Téléchargement</a>'
    + '<a href="/download/file/17348?key=y" title="Télécharger : dp_26_00058_-_demande-tampon.pdf - extension pdf">Téléchargement</a>';
  const files = postedActFiles(city('rouvroy'), html, 'https://ville-rouvroy62.fr/affichage-legal', '2026-08-01');
  assert.deepEqual(files.map((file) => [file.row.dossier, file.board]), [
    ['DP 062724 26 00058', 'decisions'],
    ['DP 062724 26 00058', 'filings'],
  ]);
});

test('the site a link prints stops before the works, the file’s weight and the number', () => {
  const html = [
    link('/medias/a.pdf', 'Arrêté Municipal n° 2026 / 428 : DP 062 274 26 00095 - [name] - 22 rue Erik Satie - Réalisation d\'une extension (163Ko)'),
    link('/medias/b.pdf', 'Arrêté Favorable - [name] - 193, rue Victor Hugo DP 26 65'),
  ].join('');
  const sites = postedActFiles(city('dourges'), html, 'https://www.dourges.fr/arretes-municipaux', '2026-08-01').map((file) => file.row.address);
  assert.deepEqual(sites, ['22 rue Erik Satie', '193, rue Victor Hugo']);
  const roost = postedActFiles(city('roost-warendin'), link('/medias/2026/09/c.pdf', 'ADM – 2026-224 Non opposition à déclaration préalable - [name] - 193, rue Victor Hugo - DP 26-65'), 'https://www.ville-roostwarendin.fr/', '2026-08-01');
  assert.equal(roost[0].row.address, '193, rue Victor Hugo');
});

test('an undated act counts when its number is of this year or the last, forty at most', () => {
  const html = Array.from({ length: 60 }, (_, i) => link(`/medias/act-${i}.pdf`, `Arrêté DP 062 274 26 ${String(100 - i).padStart(5, '0')}`)).join('')
    + link('/medias/old.pdf', 'REFUS PC 062 274 23 00007');
  const files = postedActFiles(city('dourges'), html, 'https://www.dourges.fr/arretes-municipaux', '2026-08-01');
  assert.equal(files.length, 40);
  assert.ok(files.every((file) => / 26 /.test(file.row.dossier)));
  assert.equal(postedActFiles(city('dourges'), link('/medias/old.pdf', 'REFUS PC 062 274 23 00007'), 'https://www.dourges.fr/', '2026-08-01'), null);
});

test('a number without its year takes the upload’s, for a town that writes them so', () => {
  const html = [
    link('https://www.montbeliard.fr/content/uploads/2026/09/DP-176-CHOPARD.pdf', 'DP 176 CHOPARD'),
    link('https://www.montbeliard.fr/content/uploads/2026/09/PC-26-00021-Ville.pdf', 'PC 26 00021 Ville de Montbéliard'),
  ].join('');
  const files = postedActFiles(city('montbeliard'), html, city('montbeliard').page, '2026-08-01');
  assert.deepEqual(files.map((file) => file.row.dossier), ['DP 025388 26 00176', 'PC 025388 26 00021']);
  assert.equal(postedActFiles({ ...city('montbeliard'), source: { protocol: 'posted-acts' } }, html, city('montbeliard').page, '2026-08-01').length, 1,
    'without `bareCounter`, a counter alone names no dossier');
});

test('a page drawn inside another names its files from that page', async () => {
  const villeneuve = city('villeneuve-sur-lot');
  const html = '<a href="pdf/affichage/6abfada909c3b.pdf" class="file-link"><span>DP 047 323 26 00255</span></a>';
  const { files } = POSTED_LIST_PROTOCOLS['posted-acts'].index(villeneuve, html, { url: villeneuve.page }, { since: '2026-08-01' });
  assert.equal(files[0].url, 'https://www.ville-villeneuve-sur-lot.fr/pdf/affichage/6abfada909c3b.pdf');
  assert.equal(files[0].row.dossier, 'DP 047323 26 00255');
});

test('file names that abbreviate a number still name the commune’s dossier', () => {
  const acts = (key, href) => postedActFiles(city(key), link(href), 'https://example.fr/', '2026-08-01')?.map((file) => file.row.dossier) ?? null;
  assert.deepEqual(acts('wp-media-59514', '/wp-content/uploads/sites/22/2026/02/DP-2600033.pdf'), ['DP 059514 26 00033'], 'the year run into its counter');
  assert.deepEqual(acts('wp-media-59514', '/wp-content/uploads/sites/22/2026/02/DP-2600017M01.pdf'), ['DP 059514 26 00017 M01']);
  assert.deepEqual(acts('wp-media-53140', '/wp-content/uploads/2023/12/2026-09-28-DP-2600078-ARRETE.pdf'), ['DP 053140 26 00078'], 'after a date');
  assert.deepEqual(acts('wp-media-22004', '/wp-content/uploads/2026/10/01.10.2026-Rejet-tacite-DP-022-004-26-P-0048.pdf'), ['DP 022004 26 P0048'], 'a service letter set apart');
  assert.deepEqual(acts('wp-media-50410', '/wp-content/uploads/2026/09/Arrete-Favorable-PC-050-410-26-0-0023.pdf'), ['PC 050410 26 00023'], 'a zero set apart');
  assert.equal(acts('wp-media-50410', '/wp-content/uploads/2026/09/Arrete-Favorable-PC-050-411-26-0-0023.pdf'), null, 'another commune’s number');
  assert.equal(acts('wp-media-59514', '/wp-content/uploads/2026/09/Budget-2026-00033.pdf'), null);
});

test('the WordPress communes are in the permit registry, read by `wp-media`', () => {
  const towns = BOARD_PERMIT_SOURCES.filter((source) => source.source.protocol === 'wp-media');
  assert.ok(towns.length >= 60);
  for (const town of towns) {
    assert.equal(permitListFor(town.insee), town, town.key);
    assert.match(town.page, /^https:\/\/[^/]+\/$/, town.key);
    assert.equal(town.source.ocr, town.insee !== '29075', 'Guipavas uses searchable lists; other signed acts may be scans');
  }
  assert.equal(BOARD_PROTOCOLS['wp-media'], POSTED_LIST_PROTOCOLS['wp-media']);
});

test('a WordPress commune’s text lists are read as text: `source.ocr` concerns its acts, `source.listOcr` its lists', () => {
  const wp = POSTED_LIST_PROTOCOLS['wp-media'];
  const moelan = city('wp-media-29150');
  assert.equal(moelan.source.ocr, true, 'its acts are scans');
  const [start] = wp.start(moelan, { since: '2026-08-01', day: '2026-10-04' });
  const body = [{ date: '2026-09-23T10:00:00', source_url: 'https://www.moelan-sur-mer.bzh/wp-content/uploads/2026/09/Dossiers-deposes-avant-le-23-septembre-2026.pdf', title: { rendered: '' } }];
  const [list] = wp.index(moelan, body, start, { since: '2026-08-01', day: '2026-10-04' }).files;
  assert.deepEqual([list.layout, list.scan ?? false, list.ocr ?? false], ['town-filed-before', false, false],
    'a visitor’s reading downloads it and its text is read');
  const html = '<a href="/l.pdf">Liste des avis de dépôt au 22 septembre 2026</a>';
  const scanned = (listOcr) => postedListFiles({ ...moelan, source: { protocol: 'posted-lists', listOcr } }, html, 'https://example.fr/')[0];
  assert.deepEqual([scanned(true).ocr, scanned(true).scan ?? false], [true, false], 'text first, OCR when it has none');
  assert.deepEqual([scanned('scan').ocr, scanned('scan').scan], [true, true], 'every edition a scan');
});

test('the media API gives a town’s lists and acts, newest first, and leaves its other PDFs', () => {
  const wp = POSTED_LIST_PROTOCOLS['wp-media'];
  const royat = city('wp-media-63308');
  const [start] = wp.start(royat, { since: '2026-08-01', day: '2026-10-03' });
  const asked = new URL(start.url);
  assert.equal(asked.origin + asked.pathname, 'https://www.royat.fr/wp-json/wp/v2/media');
  assert.equal(asked.searchParams.get('mime_type'), 'application/pdf');
  assert.equal(asked.searchParams.get('after'), '2026-08-01T00:00:00');
  assert.equal(start.as, 'json');
  const item = (date, path, title = '') => ({ date: `${date}T10:00:00`, source_url: `https://www.royat.fr/wp-content/uploads/${path}`, title: { rendered: title } });
  const body = [
    item('2026-10-04', '2026/10/Liste-des-avis-de-depot-04_10_2026.pdf'),
    item('2026-09-30', '2026/09/Liste-des-avis-de-depot-30_09_2026.pdf', 'Liste des avis de dépôt &#8211; 30 09 2026'),
    item('2026-09-30', '2026/09/Liste-des-decisions-30_09_2026.pdf'),
    item('2026-09-29', '2026/09/DP-063-308-26-00071-Arrete.pdf'),
    item('2026-09-28', '2026/09/Menus-octobre.pdf'),
    item('2026-09-27', '2026/09/DP-063-113-26-00012-Arrete.pdf'),
  ];
  const { files, next } = wp.index(royat, body, start, { since: '2026-08-01', day: '2026-10-03' });
  assert.deepEqual(files.map((file) => [file.board, file.layout, file.published, file.row?.dossier ?? null]), [
    ['filings', 'cartds-report-filings', '2026-09-30', null],
    ['decisions', 'cartds-report-decisions', '2026-09-30', null],
    ['decisions', 'dematdoc-notice', '2026-09-29', 'DP 063308 26 00071'],
  ], 'a file after the reading’s day, a menu and another commune’s act are left');
  assert.deepEqual(next, []);
  const full = Array.from({ length: 100 }, (_, i) => item('2026-09-01', `2026/09/menu-${i}.pdf`));
  const paged = wp.index(royat, full, start, { since: '2026-08-01', day: '2026-10-03' });
  assert.equal(new URL(paged.next[0].url).searchParams.get('page'), '2');
  assert.equal(wp.index(royat, { code: 'rest_not_logged_in' }, start, { since: '2026-08-01' }), null, 'a closed API is not the board');
  const listsOnly = wp.index({ ...royat, source: { ...royat.source, acts: false } }, body, start, { since: '2026-08-01', day: '2026-10-03' });
  assert.equal(listsOnly.files.length, 2);
});

test('a commune whose links name no number sets `unnumbered`: a dated act is read for its heading’s', () => {
  const rozay = { ...city('wp-media-59514'), insee: '77393', postcode: '77540', source: { protocol: 'posted-acts', unnumbered: true } };
  const html = [
    link('/wp-content/uploads/2026/09/DP-15-FAUBOURG-DE-GIRONDE.pdf'),
    link('/wp-content/uploads/2026/10/AVIS-DE-DEPOT-2-RUE-DES-QUATRE-VENTS.pdf'),
    link('/wp-content/uploads/2026/09/Arrete-160-2026-OLYMPIADES-Ecole-Elementaire.pdf'),
    link('/wp-content/uploads/2026/09/Menus-octobre.pdf'),
  ].join('');
  const files = postedActFiles(rozay, html, 'https://www.rozay-en-brie.fr/', '2026-08-01');
  assert.deepEqual(files.map((file) => [file.url.replace(/^.*\//, ''), file.board, file.published, file.row ?? null]), [
    ['DP-15-FAUBOURG-DE-GIRONDE.pdf', 'decisions', '2026-09-01', null],
    ['AVIS-DE-DEPOT-2-RUE-DES-QUATRE-VENTS.pdf', 'filings', '2026-10-01', null],
    ['Arrete-160-2026-OLYMPIADES-Ecole-Elementaire.pdf', 'decisions', '2026-09-01', null],
  ], 'its heading must then give the number: a police order gives no row');
  assert.equal(postedActFiles({ ...rozay, source: { protocol: 'posted-acts' } }, html, 'https://www.rozay-en-brie.fr/', '2026-08-01'), null);
});

test('a number typed without the commune’s code nor spaces names the dossier', () => {
  const html = [
    link('/wp-content/uploads/2026/10/cno.pdf', 'Certificat de non opposition DP 2600099'),
    link('/wp-content/uploads/2026/10/pc.pdf', 'PC 2500004-M01 Arrêté favorable'),
    link('/wp-content/uploads/2026/10/full.pdf', 'Arrêté favorable - DP 0783622600092'),
  ].join('');
  const files = postedActFiles(city('mantes-la-ville'), html, city('mantes-la-ville').page, '2026-08-01');
  assert.deepEqual(files.map((file) => file.row.dossier), ['DP 078362 26 00099', 'PC 078362 25 00004 M01', 'DP 078362 26 00092']);
});

test('a town posting Limeil-Brévannes’s Word tables names the town-list readers of that template', () => {
  const saintCyr = city('saint-cyr-l-ecole');
  assert.deepEqual(saintCyr.source.layouts, { filings: 'town-filed-before', decisions: 'town-decided-until' });
  assert.equal(typeof BOARD_READERS['town-filed-before'], 'function');
  const html = [
    link('https://www.saintcyr78.fr/wp-content/uploads/2026/09/AFFICHAGE-DEPOT-090926.pdf', 'Dossiers déposés au 09/09/2026'),
    link('https://www.saintcyr78.fr/wp-content/uploads/2026/09/AFFICHAGE-DECISIONS-090926.pdf', 'Autorisations délivrées au 09/09/2026'),
  ].join('');
  const files = postedListFiles(saintCyr, html, saintCyr.page);
  assert.deepEqual(files.map((file) => [file.board, file.layout, file.published]), [
    ['filings', 'town-filed-before', '2026-09-09'],
    ['decisions', 'town-decided-until', '2026-09-09'],
  ]);
});

test('Dompierre-sur-Mer and Sarralbe refuse PDFs to robots and are read anyway, the exception marked', () => {
  for (const key of ['dompierre-sur-mer', 'sarralbe']) {
    assert.equal(city(key).robots, 'overridden', key);
    assert.equal(permitListFor(city(key).insee), city(key), key);
  }
  const dompierre = city('dompierre-sur-mer');
  const html = [
    link('/sites/dompierresurmer/files/content/files/ar_pc_26_27.pdf', 'PC 17142 26 00027 - PRIVATE PERSON - Affiché le 25/09/2026'),
    link('/sites/dompierresurmer/files/content/files/scan_urbanisme1_urbanisme1_-2026-05-26-16-09-34-637.pdf', 'PC 17142 26 0143 M02 - SCCV EXEMPLE - Affiché le 26/05/2026'),
  ].join('');
  const files = postedActFiles(dompierre, html, dompierre.page, '2026-08-01');
  assert.deepEqual(files.map((file) => [file.row.dossier, file.published, file.row.applicant]), [
    ['PC 017142 26 00027', '2026-09-25', null],
    ['PC 017142 26 00143 M02', '2026-05-26', null],
  ], 'the number and the posting day from the link, a four-digit counter padded, never the applicant');
  assert.doesNotMatch(JSON.stringify(files), /PRIVATE/);
});

test('posted acts with `follow`: a dossier’s own page is asked, its first PDF is the act, posted from the day it says', () => {
  const sarralbe = city('sarralbe');
  const acts = POSTED_LIST_PROTOCOLS['posted-acts'];
  const index = [
    '<a href="pc-057-628-26-00014privateperson" title="PC 057 628 26 00014_PRIVATE_PERSON"><h2>PC 057 628 26 00014_PRIVATE_PERSON</h2></a>',
    '<a href="dp-057-628-26-00088exemple" title="DP 057 628 26 00088_EXEMPLE"><h2>DP 057 628 26 00088_EXEMPLE</h2></a>',
    '<a href="plan-local-urbanisme" title="PLU (Plan local d’urbanisme)">PLU</a>',
    '<a href="https://www.facebook.com/sharer.php?u=x" title="PC 057 628 26 00014">Partager</a>',
  ].join('');
  const listed = acts.index(sarralbe, index, { url: sarralbe.page, as: 'html' }, { since: '2026-08-01' });
  assert.deepEqual(listed.files, []);
  assert.deepEqual(listed.next.map((request) => [request.url.replace(/^.*\//, ''), request.act]), [
    ['pc-057-628-26-00014privateperson', 'PC 057628 26 00014'],
    ['dp-057-628-26-00088exemple', 'DP 057628 26 00088'],
  ], 'another site’s link and a page naming no dossier are not asked');
  const page = (from) => `<h1>PC 057 628 26 00014_PRIVATE_PERSON</h1><p>Décision d'accord d'un permis de construire</p>
    <p>Disponible à compter du ${from} au 06/10/2026</p><a href="fichiers/contenus/textes/1853/fr/DECISION-PC2600014.pdf">DECISION PC2600014</a>`;
  const detail = { url: 'https://www.sarralbe.fr/pc-057-628-26-00014privateperson', as: 'html', act: 'PC 057628 26 00014' };
  const { files } = acts.index(sarralbe, page('06/08/2026'), detail, { since: '2026-08-01' });
  assert.deepEqual(files.map((file) => [file.url, file.board, file.layout, file.published, file.row.dossier, file.row.applicant]), [
    ['https://www.sarralbe.fr/fichiers/contenus/textes/1853/fr/DECISION-PC2600014.pdf', 'decisions', 'dematdoc-notice', '2026-08-06', 'PC 057628 26 00014', null],
  ]);
  assert.doesNotMatch(JSON.stringify(files), /PRIVATE/);
  assert.equal(acts.index(sarralbe, page('06/06/2026'), detail, { since: '2026-08-01' }), null, 'posted before the window');
  assert.equal(acts.index(sarralbe, '<p>Aucun document</p>', detail, { since: '2026-08-01' }), null);
});

test('a DOCman address names its act in the folder before `/file`', () => {
  const base = '/la-mairie-a-votre-service/vie-municipale/recueil-des-actes-administratifs/urbanisme';
  const button = (slug) => `<a class="btn docman_track_download docman_download__button" href="${base}/${slug}/file" target="_blank" data-title="x" type="application/pdf">
    <span class="docman_download_label">Télécharger</span><span class="docman_download__info">(pdf, 33 KB)</span></a>`;
  const html = ['2086-avis-de-depot-dia-025-228-26-00024', '2087-avis-de-depot-dp-025-228-26-00050', '2085-decision-dp-025-228-26-00049',
    '2075-99-ar-025-212502280-20260922-2026-69-ar-1-1-1', '2059-avis-de-depot-pc-025-228-26-00004-1'].map(button).join('');
  const files = postedActFiles(city('etupes'), html, city('etupes').page, '2026-08-04');
  assert.deepEqual(files.map((file) => [file.row.dossier, file.board]), [
    ['DP 025228 26 00050', 'filings'],
    ['DP 025228 26 00049', 'decisions'],
    ['PC 025228 26 00004', 'filings'],
  ], 'a pre-emption notice (DIA) and a municipal order name no dossier');
  assert.equal(files[0].url, `https://www.etupes.fr${base}/2087-avis-de-depot-dp-025-228-26-00050/file`);
});

// --- The backlog survey of 2026-10-03: communes whose own sites post one PDF per act -------

test('Kaysersberg Vignoble names each file by its site, number and day, and says which board in its last word', () => {
  const html = [
    link('https://www.kaysersberg-vignoble.fr/wp-content/uploads/2026/10/ka_31_rue_exemple_DP0681622600086_avis_depot.pdf', ''),
    link('https://www.kaysersberg-vignoble.fr/wp-content/uploads/2026/09/si_2_bis_rue_du_vallon_DP0681622600081_18_09_2026_avis_depot.pdf', ''),
    link('https://www.kaysersberg-vignoble.fr/wp-content/uploads/2026/09/ka_6_rue_du_chateau_PC0681622600011_23_09_2026_arrete.pdf', ''),
  ].join('');
  const files = postedActFiles(city('kaysersberg-vignoble'), html, city('kaysersberg-vignoble').page, '2026-08-01');
  assert.deepEqual(files.map((file) => [file.row.dossier, file.board, file.published, file.row.address]), [
    ['DP 068162 26 00086', 'filings', '2026-10-01', '31 rue exemple'],
    ['DP 068162 26 00081', 'filings', '2026-09-18', '2 bis rue du vallon'],
    ['PC 068162 26 00011', 'decisions', '2026-09-23', '6 rue du chateau'],
  ]);
});

test('Rurange types the zero of its counters as a letter, and files named after an applicant keep no name', () => {
  const rurange = city('rurange-les-thionville');
  const html = '<a href="/pages/1/500/EXEMPLE%20arr%C3%AAt%C3%A9%20cl%C3%B4ture.pdf">DP05760226NO060</a>'
    + `<a href="/pages/1/500/RENOV'EST%20arr%C3%AAt%C3%A9%20panneaux.pdf">DP05760226NO031</a>`
    + '<a href=\'/pages/1/500/PC05760226No001.pdf\'>PC05760226NO001</a>';
  const files = postedActFiles(rurange, html, rurange.page, '2026-08-01');
  assert.deepEqual(files.map((file) => file.row.dossier), ['DP 057602 26 N0060', 'DP 057602 26 N0031', 'PC 057602 26 N0001']);
  assert.equal(files[1].url, `https://rurange-les-thionville.fr/pages/1/500/RENOV'EST%20arr%C3%AAt%C3%A9%20panneaux.pdf`, 'an apostrophe in an address does not cut it');
  assert.ok(files.every((file) => file.row.address === null && file.row.applicant === null));
  assert.ok(files.every((file) => file.noParcels), 'its « S37 P0113 » is a section and a parcel, not two parcels');
});

test('the towns that write a counter’s zero as the letter O say so: Rurange types it, OCR reads Biesheim’s that way', () => {
  assert.equal(municipalDossier('N° DP 068 036 26 RO028', city('biesheim')), 'DP 068036 26 R0028');
  assert.equal(municipalDossier('DP05760226NO060', city('rurange-les-thionville')), 'DP 057602 26 N0060');
  assert.equal(municipalDossier('N° DP 068 036 26 RO028', { ...city('biesheim'), source: { protocol: 'posted-acts' } }), null, 'nowhere else');
});

test('Hagondange’s tabs say the board, its filings keep no row of their own, and its newest acts are the last of the page', () => {
  const hagondange = city('hagondange');
  const tab = (id, title) => `<a class="card-header" href="#panel_${id}">${title}</a>`;
  const act = (id, number) => `<a href="/view_document.php?id=${id}">${number} Télécharger</a>`;
  const html = tab(122, 'Affichage des dépôts') + act(2967, 'DP 057 283 26 00093') + act(3182, 'DP 057 283 26 00141') + act(3033, 'AT 057 283 26 N0013')
    + tab(123, 'Affichage des décisions') + act(2971, 'DP 057 283 26 00026') + act(3176, 'PC 057 283 21 N0006 T01') + act(3071, 'DP 057 283 26 0129');
  const files = postedActFiles(hagondange, html, hagondange.page, '2026-08-01');
  assert.deepEqual(files.map((file) => [file.url.split('=')[1], file.board, Boolean(file.row)]), [
    ['3071', 'decisions', true], ['2971', 'decisions', true],
    ['3182', 'filings', false], ['2967', 'filings', false],
  ], 'the last of an oldest-first page comes first; an AT is no permit, a 2021 number is not of this year or the last');
  assert.equal(files.find((file) => file.url.endsWith('3071')).row.dossier, 'DP 057283 26 00129', 'a counter typed with four digits');
  const crowded = tab(123, 'Affichage des décisions') + Array.from({ length: 80 }, (_, i) => act(3000 + i, `DP 057 283 26 ${String(i + 1).padStart(5, '0')}`)).join('');
  assert.equal(postedActFiles(hagondange, crowded, hagondange.page, '2026-08-01').length, 80, 'its limit is wider than forty');
  assert.equal(postedActFiles({ ...hagondange, source: { protocol: 'posted-acts' } }, crowded, hagondange.page, '2026-08-01').length, 40);
});

test('an act of the whole page names its board in its words; an « avis dépôt » is a filing', () => {
  const html = link('/wp-content/uploads/2026/10/si_2_rue_exemple_DP0681622600090_avis_depot.pdf', '');
  assert.equal(postedActFiles(city('kaysersberg-vignoble'), html, 'https://www.kaysersberg-vignoble.fr/x/', '2026-08-01')[0].board, 'filings');
});
