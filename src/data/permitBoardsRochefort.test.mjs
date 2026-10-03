import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROCHEFORT_BOARD_PROTOCOLS, ROCHEFORT_NEWEST, rochefortDay, rochefortStreet } from './permitBoardsRochefort.js';
import { BOARD_PERMIT_SOURCES, BOARD_PROTOCOLS } from './permitBoards.js';
import { permitListFor } from './permitListsFeed.js';

const rochefort = BOARD_PERMIT_SOURCES.find((source) => source.key === 'rochefort');
const protocol = ROCHEFORT_BOARD_PROTOCOLS.rochefort;
// 2026-09-29 00:00 in Rochefort, as the board stamps it.
const item = (tid, title, type = 'Déclaration préalable de travaux', timestamp = 1790632800) => ({ tid: String(tid), fid: String(tid + 1000), title, type, timestamp });

test('Rochefort is in the permit registry, read by its own protocol', () => {
  assert.equal(permitListFor('17299'), rochefort);
  assert.equal(BOARD_PROTOCOLS.rochefort, protocol);
  assert.match(protocol.start(rochefort)[0].url, /listPublication\?_format=json&EID=108&CID=92&SID=109$/);
});

test('a title gives a numbered street up to the works, never the applicant', () => {
  assert.equal(rochefortStreet('DP 017 299 26 00423 M. PRIVATE Person 21 Av Marcel Dassault PAC'), '21 Av Marcel Dassault');
  assert.equal(rochefortStreet('EN 017 299 26 00031 FG HABITAT M. PRIVATE 14 Av Charles de Gaulle Enlèvement des enseignes'), '14 Av Charles de Gaulle');
  assert.equal(rochefortStreet('PC 017 299 26 00034 M. PRIVATE et Mme PRIVATE Imp Chante Alouette Habitation'), null, 'no house number, no site');
  assert.equal(rochefortDay(1790632800), '2026-09-29');
});

test('the list asks for the newest orders’ paths, and a path gives the order', () => {
  const list = [
    item(1, 'DP 017 299 26 00423 M. PRIVATE 21 Av Marcel Dassault PAC'),
    item(2, 'CU 017 299 26 00473 M. PRIVATE Rue Maurice Ravel Division', 'Décision'),
    item(3, 'Avis de dépôt du 21/09/26 au 27/09/26', 'Avis'),
    item(4, 'PC 017 299 26 00037 SCI EXEMPLE 26 Rue Emile Combes Habitation', 'Permis de construire', 1790200000),
    item(5, 'DP 017 299 26 00300 M. PRIVATE 3 rue des Fonderies Pose', 'Déclaration préalable de travaux', 1785000000),
  ];
  const { files, next } = protocol.index(rochefort, list, protocol.start(rochefort)[0], { since: '2026-08-01', day: '2026-10-03' });
  assert.deepEqual(files, []);
  assert.deepEqual(next.map((request) => request.order.dossier), ['DP 017299 26 00423', 'PC 017299 26 00037'],
    'newest first; a certificate, a weekly list and an order before the window are not asked for');
  assert.ok(next.length <= ROCHEFORT_NEWEST);
  const answer = protocol.index(rochefort, { fb64: '/sites/default/files/pdf/DP%20423_2.pdf', title: 'x' }, next[0], {});
  assert.equal(answer.files[0].url, 'https://adminrocheaffiche.ville-rochefort.fr/sites/default/files/pdf/DP%20423_2.pdf');
  assert.deepEqual([answer.files[0].board, answer.files[0].row.address, answer.files[0].layout], ['decisions', '21 Av Marcel Dassault', 'dematdoc-notice']);
  assert.doesNotMatch(JSON.stringify(answer), /PRIVATE/);
  assert.equal(protocol.index(rochefort, { fb64: 'https://elsewhere.example/x.pdf' }, next[0], {}), null);
});
