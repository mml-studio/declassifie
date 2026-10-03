import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWN_LIST_READERS, readDecidedUntilList, readFiledBeforeList } from './permitBoardsTownLists.js';
import { BOARD_PERMIT_SOURCES, BOARD_READERS } from './permitBoards.js';
import { POSTED_LIST_PROTOCOLS, postedActFiles } from './permitBoardsPostedLists.js';
import { permitListFor, scrubPermitListRow } from './permitListsFeed.js';

const city = (key) => BOARD_PERMIT_SOURCES.find((source) => source.key === key);
const run = (text, x, y, size = 8) => ({ text, x, x1: x + text.length * 4, y, size });
const page = (...runs) => ({ pages: [{ runs }] });
const PRIVATE = /PRIVATE|PERSON/;

test('the town list readers are registered, and the communes that use them read by their protocol', () => {
  for (const layout of Object.keys(TOWN_LIST_READERS)) assert.equal(BOARD_READERS[layout], TOWN_LIST_READERS[layout], layout);
  for (const key of ['wp-media-29150', 'wp-media-28070', 'wp-media-71475']) {
    assert.equal(permitListFor(city(key).insee), city(key), key);
    assert.deepEqual(city(key).source.layouts, { filings: 'town-filed-before', decisions: 'town-decided-until' });
  }
  assert.equal(city('saint-jean-d-angely').source.actLayouts.filings, 'town-filed-before');
});

test('« Dossiers déposés avant le … »: columns are where the rows’ cells start, so a name set right of its header stays out of the site', () => {
  // Moëlan-sur-Mer's list of 23 September 2026: each cell starts 30 to 70 points right of its header.
  const rows = readFiledBeforeList(page(
    run('VILLE DE MOËLAN-SUR-MER', 672, 455), run('Dossiers déposés avant le 23 septembre 2026', 225, 399),
    run('Date de dépôt', 28, 372), run('Numéro de', 120, 372), run('Pétitionnaire', 211, 372),
    run('Adresse du projet', 312, 372), run('Description du projet', 455, 372), run('dossier', 120, 359),
    run('DECLARATION PREALABLE - CONSTRUCTIONS ET TRAVAUX NON SOUMIS A PERMIS DE CONSTRUIRE', 28, 321),
    run('22/09/2026', 28, 283), run('DP 29150 26 00111', 154, 283), run('PRIVATE PERSON', 282, 283), run('8 Route Exemple', 374, 283),
    run('M01', 154, 271), run('29350 Moëlan-sur-Mer', 374, 258),
    run('22/09/2026', 28, 219), run('DP 29150 26 00211', 154, 219), run('Evan', 282, 219), run('54 Kéryoualen', 374, 219),
    run('Installation d’un carport', 502, 219), run('PERSON', 279, 206), run('29350 Moëlan-sur-Mer', 374, 206),
    run('Page 1 sur 10', 739, 38),
  ), { city: city('wp-media-29150'), file: { board: 'filings', published: '2026-09-23' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.postcode, row.filedOn, row.purpose, row.applicant]), [
    ['DP 029150 26 00111 M01', '8 Route Exemple', '29350', '2026-09-22', null, null],
    ['DP 029150 26 00211', '54 Kéryoualen', '29350', '2026-09-22', 'Installation d’un carport', null],
  ]);
  assert.doesNotMatch(JSON.stringify(rows.map(scrubPermitListRow)), PRIVATE);
  assert.deepEqual(readFiledBeforeList(page(run('Date de dépôt', 28, 372)), { city: city('wp-media-29150'), file: {} }), [], 'no full row, no columns');
});

test('« Dossiers décidés jusqu’au … »: a site that is only the postcode and town is no site', () => {
  const rows = readDecidedUntilList(page(
    run('Dossiers décidés jusqu’au 23 septembre 2026', 301, 416),
    run('Numéro de dossier', 28, 391), run('Pétitionnaire', 139, 391), run('Décision', 259, 391), run('Date de', 334, 391),
    run('Nature des travaux', 414, 391), run('Adresse des travaux', 594, 391), run('Surface', 769, 391), run('signature', 334, 378),
    run('Déclaration préalable - Constructions et travaux non soumis à permis de construire', 28, 339),
    run('DP 29150 26 00182', 28, 302), run('PRIVATE', 142, 302), run('Octroi', 259, 302), run('16/09/2026', 334, 302),
    run('33 Route Exemple', 594, 302), run('29350 Moëlan-sur-Mer', 594, 290),
    run('DP 29150 26 00157', 28, 250), run('PERSON', 142, 250), run('Accord', 259, 250), run('02/09/2026', 334, 250),
    run('29350 Moëlan-sur-Mer', 594, 250),
  ), { city: city('wp-media-29150'), file: { board: 'decisions', published: '2026-09-23' } });
  assert.deepEqual(rows.map((row) => [row.dossier, row.address, row.decidedOn]), [
    ['DP 029150 26 00182', '33 Route Exemple', '2026-09-16'],
    ['DP 029150 26 00157', null, '2026-09-02'],
  ]);
});

test('Saint-Jean-d’Angély names its acts by their site: street first, then « au n° »', () => {
  const angely = city('saint-jean-d-angely');
  const html = [
    '<a href="/wp-content/uploads/2026/09/DP173472600138-rue-des-Marechaux-au-n°-4.pdf">x</a>',
    '<a href="/wp-content/uploads/2026/10/Avis-depot-DP-rue-Lachevalle-au-n°-64.pdf">x</a>',
    '<a href="/wp-content/uploads/2026/10/Arrete-DP-chaussee-de-lEperon-au-n°65-Publie-le-01.10.2026.pdf">x</a>',
  ].join('');
  const files = POSTED_LIST_PROTOCOLS['posted-acts'].index(angely, html, { url: angely.page }, { since: '2026-08-01' }).files;
  assert.deepEqual(files.map((file) => [file.board, file.layout, file.row?.dossier ?? null, file.row?.address ?? null]), [
    ['decisions', 'dematdoc-notice', 'DP 017347 26 00138', '4 rue des Marechaux'],
    ['filings', 'town-filed-before', null, null],
    ['decisions', 'dematdoc-notice', null, null],
  ], 'an « Avis depot » is a filing, read as the one-row list it is');
  assert.equal(postedActFiles(angely, '<a href="/x/PC173472600007-au-revoir.pdf">x</a>', angely.page, '2026-08-01')[0].row.address, null);
});
