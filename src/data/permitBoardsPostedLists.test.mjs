import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSTED_LIST_PROTOCOLS, postedActFiles, postedListDay, postedListFiles } from './permitBoardsPostedLists.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS, BOARD_READERS } from './permitBoards.js';
import { PERMIT_LIST_READERS, permitListFor } from './permitListsFeed.js';

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
  assert.equal(postedListDay('/wp-content/uploads/2026/09/liste.pdf'), '2026-09-01', 'the upload month, failing a day');
  assert.equal(postedListDay('/documents/81097'), null);
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

const ACT_KEYS = ['saint-martin-boulogne', 'marquette-lez-lille', 'bauvin', 'rouvroy', 'coulogne', 'crespin', 'dourges', 'roost-warendin', 'anor'];

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
