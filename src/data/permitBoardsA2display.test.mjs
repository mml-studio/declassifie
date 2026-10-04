import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A2DISPLAY_BOARD_PROTOCOLS, a2displayDossier, a2displayFiles, a2displaySite, a2displayStepRow, a2displayStepRows } from './permitBoardsA2display.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS } from './permitBoards.js';
import { permitListFor } from './permitListsFeed.js';

const chemille = BOARD_PERMIT_SOURCES.find((source) => source.key === 'chemille-en-anjou');
const object = (name, date, file = 'b00ef66d5e7f2d98765995b0a41c94e6.pdf') => ({
  name, start: { date: `${date} 08:30:00.000000`, timezone: 'UTC' }, isArchived: false, deleteDatetime: null, file: { name: file },
});

test('Chemillé-en-Anjou is read by the A2Display kiosk protocol, category by category', () => {
  assert.equal(permitListFor('49092'), chemille);
  assert.equal(BOARD_PROTOCOLS['a2display-kiosk'], A2DISPLAY_BOARD_PROTOCOLS['a2display-kiosk']);
  assert.deepEqual(A2DISPLAY_BOARD_PROTOCOLS['a2display-kiosk'].start(chemille).map((request) => request.url), ['https://api.a2display.fr/category/760']);
});

test('a name gives the dossier spelled out and the site from its house number, never the applicant', () => {
  assert.equal(a2displayDossier('2026_ARR_U544_PC2600100_PRIVATE_7_BILANGE_CA', chemille), 'PC 049092 26 00100');
  assert.equal(a2displayDossier('2026_ARR_U550_PC2500012M01_SCI_X', chemille), 'PC 049092 25 00012 M01');
  assert.equal(a2displaySite('PRIVATE_SAUVETRE_30_RUE_MARRON_NOIR_ME'), '30 RUE MARRON NOIR');
  assert.equal(a2displaySite('PRIVATE_1_RUE_PEUPLIERS_NM-1'), '1 RUE PEUPLIERS');
  assert.equal(a2displaySite('SCI_PARTENAIRE_AVENEAUX_SL'), null);
});

test('only orders posted in the window are kept, once each', () => {
  const objects = [
    object('2026_ARR_U541_DP2600364_PRIVATE_8_PLACE_CROIX_BOULAY_CH', '2026-10-02', 'dece1259091213599929f7b7863627b1.pdf'),
    object('2026_ARR_U541_DP2600364_PRIVATE_8_PLACE_CROIX_BOULAY_CH', '2026-10-02', 'dece1259091213599929f7b7863627b1.pdf'),
    object('2026_ARR_U100_DP2600010_PRIVATE_2_RUE_X_CH', '2026-06-01'),
    object('Note de service', '2026-10-01', 'aaaa.pdf'),
  ];
  const files = a2displayFiles(chemille, objects, '2026-08-01', '2026-10-03');
  assert.deepEqual(files.map((file) => [file.row.dossier, file.row.address, file.published]), [['DP 049092 26 00364', '8 PLACE CROIX BOULAY', '2026-10-02']]);
  assert.equal(files[0].url, 'https://api.a2display.fr/file?filename=dece1259091213599929f7b7863627b1.pdf');
  assert.doesNotMatch(JSON.stringify(files), /PRIVATE/);
});

const display = BOARD_PERMIT_SOURCES.find((source) => source.key === 'saint-etienne-au-mont');

test('Saint-Étienne-au-Mont is read from its A2Display legal display, category by category, without a file', () => {
  assert.equal(permitListFor('62746'), display);
  assert.equal(BOARD_PROTOCOLS['a2display-display'], A2DISPLAY_BOARD_PROTOCOLS['a2display-display']);
  const [request] = A2DISPLAY_BOARD_PROTOCOLS['a2display-display'].start(display);
  assert.equal(request.url, `https://api.a2display.fr/cvv/documents/${display.source.display}?l=300&s=creationDatetime&d=desc&fc=8137&fo=true&fa=true`);
  assert.equal(A2DISPLAY_BOARD_PROTOCOLS['a2display-display'].index(display, { status: 'error' }, request, { since: '2026-08-01' }), null);
});

test('a step\'s name gives a request or a decision, its number spelled out and its site, never what precedes the site', () => {
  const row = (name) => a2displayStepRow(display, name, '2026-10-02');
  assert.deepEqual(row('DP 26-59 Décision 49 Rue du Calvaire'), {
    board: 'decisions', dossier: 'DP 062746 26 00059', applicant: null, address: '49 Rue du Calvaire', postcode: '62360', parcels: null,
    postedOn: '2026-10-02', verdict: 'Décision signée',
  });
  assert.deepEqual([row('DP 26-59 Demande - 49 rue du Calvaire (2)').board, row('DP 26-59 Demande - 49 rue du Calvaire (2)').address], ['filings', '49 rue du Calvaire']);
  assert.equal(row('DP 26-28 Décision Refus 54 Rue du Dr Brousse').verdict, 'Refus');
  assert.deepEqual([row('PC 25-05 M 01 Décision 40 Rue Sené Porion-tampon').dossier, row('PC 25-05 M 01 Décision 40 Rue Sené Porion-tampon').address],
    ['PC 062746 25 00005 M01', '40 Rue Sené Porion']);
  assert.equal(row('DP 26-35 Décision - 14 Cité de l’Avenir').address, '14 Cité de l’Avenir');
  assert.equal(row('DP 26-60 @ Décision Route d’Equihen').address, 'Route d’Equihen');
  assert.equal(row('DP 26-10 Demande PRIVATE PERSON 12 rue Exemple').address, '12 rue Exemple');
  for (const name of ['DP 26-43 Demande de Pièces 25 Rue Jacques Duclos', 'DP 26-50 Complétude - 25 rue de la Gare', 'DP 26-50 Avis ABF 25 Rue de la Gare',
    'CU 26-62 @ Décision -Parcelle AC 77 Rue Haffreingue', 'DP 26-54 Demande Mairie', 'SAFER avis affichage appel à candidatures']) {
    assert.equal(row(name), null, name);
  }
});

test('a legal display keeps each request and decision posted in the window once', () => {
  const items = [
    object('DP 26-59 Demande - 49 rue du Calvaire (2)', '2026-10-02'),
    object('DP 26-59 Demande - 49 rue du Calvaire (2)', '2026-10-02'),
    object('DP 26-59 Décision 49 Rue du Calvaire', '2026-10-02'),
    object('DP 26-40 Décision 14 Rue M.Wallet-tampon', '2026-09-14'),
    { ...object('DP 26-40 Demande - 14 rue Marcel Wallet-tampon', '2026-09-14'), isArchived: true },
    object('DP 26-12 Décision 3 rue Ancienne', '2026-07-20'),
  ];
  assert.deepEqual(a2displayStepRows(display, items, '2026-08-01', '2026-10-04').map((row) => [row.board, row.dossier, row.address]), [
    ['filings', 'DP 062746 26 00059', '49 rue du Calvaire'],
    ['decisions', 'DP 062746 26 00059', '49 Rue du Calvaire'],
    ['decisions', 'DP 062746 26 00040', '14 Rue M.Wallet'],
  ]);
  assert.doesNotMatch(JSON.stringify(a2displayStepRows(display, [object('DP 26-10 Demande PRIVATE PERSON 12 rue Exemple', '2026-09-01')], '2026-08-01')), /PRIVATE/);
});
