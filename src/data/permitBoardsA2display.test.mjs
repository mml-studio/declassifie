import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A2DISPLAY_BOARD_PROTOCOLS, a2displayDossier, a2displayFiles, a2displaySite } from './permitBoardsA2display.js';
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
