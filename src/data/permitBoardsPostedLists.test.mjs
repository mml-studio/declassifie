import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSTED_LIST_PROTOCOLS, postedListDay, postedListFiles } from './permitBoardsPostedLists.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS, BOARD_READERS } from './permitBoards.js';
import { permitListFor } from './permitListsFeed.js';

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
