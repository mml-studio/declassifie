// src/data/cartdsArchive.test.mjs
// The archive keeps every row a Cart@DS board ever showed, once, without a
// person's name and without a sale. Rows below are shaped like the boards of
// 2026-09-30, applicants replaced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARTDS_BOARDS, CARTDS_INSTANCES } from './cartdsFeed.js';
import {
  CARTDS_ARCHIVE_SCHEMA,
  archivedCartdsRows,
  cartdsDay,
  emptyCartdsArchive,
  readCartdsArchive,
  recordCartdsBoards,
  scrubCartdsRow,
  unionCartdsArchives,
} from './cartdsArchive.js';

const MAMP = CARTDS_INSTANCES.find((instance) => instance.key === 'mamp');

const FILING = Object.freeze([
  '29/09/2026', 'DP 013 114 26 00167', '28/09/2026', 'DUPONT Jean',
  '3 Chemin du Puits des Nourades 13122  (AT 852)', '2000 m²', '', '',
]);
const DECISION = Object.freeze([
  '28/09/2026', 'PC 013 114 22 F0036 M02', '13/08/2026', 'SCI LES OLIVIERS',
  ' LES NOURADONS 13122  (AT 1048)', '5719 m²', 'Modificatif ', '',
  'Favorable avec réserve le 21/09/2026',
]);
const SALE = Object.freeze([
  '29/09/2026', 'IA 013 114 26 00321', '27/09/2026', 'DUPONT Jean',
  '5 Rue Basse 13122  (AT 12)', '400 m²', 'Vente', '320 000 €',
]);

test('a stored row never holds a person, and a sale is never stored', () => {
  const filing = scrubCartdsRow(FILING);
  assert.equal(filing[3], null);
  assert.equal(filing[1], 'DP 013 114 26 00167');
  assert.equal(filing.length, 8);
  assert.equal(scrubCartdsRow(DECISION)[3], 'SCI LES OLIVIERS');
  assert.equal(scrubCartdsRow(SALE), null);
  assert.equal(scrubCartdsRow(null), null);
  assert.equal(scrubCartdsRow([...DECISION, 'an extra column']).length, 9);
});

test('a reading adds new rows and moves the last day of rows already kept', () => {
  const empty = emptyCartdsArchive(MAMP, '13114');
  const first = recordCartdsBoards(empty, {
    [CARTDS_BOARDS.filings]: [FILING, SALE],
    [CARTDS_BOARDS.decisions]: [DECISION],
  }, '2026-09-30');
  assert.equal(first.added, 2);
  assert.equal(first.seen, 0);
  assert.equal(first.archive.days, 1);
  assert.equal(first.archive.firstDay, '2026-09-30');
  // The input is untouched.
  assert.equal(empty.rows.length, 0);

  // Same day again: nothing new, still one day.
  const again = recordCartdsBoards(first.archive, { [CARTDS_BOARDS.filings]: [FILING] }, '2026-09-30');
  assert.equal(again.added, 0);
  assert.equal(again.seen, 1);
  assert.equal(again.archive.days, 1);

  // Next day the filing is gone from the board and a withdrawal is posted:
  // the filing keeps its last day, the decision moves on, the new row joins.
  const withdrawal = [...DECISION];
  withdrawal[8] = 'Annulation le 01/10/2026';
  const next = recordCartdsBoards(first.archive, {
    [CARTDS_BOARDS.filings]: [],
    [CARTDS_BOARDS.decisions]: [DECISION, withdrawal],
  }, '2026-10-01');
  assert.equal(next.added, 1);
  assert.equal(next.archive.days, 2);
  assert.equal(next.archive.lastDay, '2026-10-01');
  const rows = archivedCartdsRows(next.archive);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => [row.board, row.first, row.last]), [
    ['1', '2026-09-30', '2026-09-30'],
    ['2', '2026-09-30', '2026-10-01'],
    ['2', '2026-10-01', '2026-10-01'],
  ]);
  // The same text on the other board is another row.
  const both = recordCartdsBoards(emptyCartdsArchive(MAMP, '13114'), {
    [CARTDS_BOARDS.filings]: [DECISION.slice(0, 8)],
    [CARTDS_BOARDS.decisions]: [DECISION.slice(0, 8)],
  }, '2026-09-30');
  assert.equal(both.added, 2);
  assert.throws(() => recordCartdsBoards(empty, {}, '30/09/2026'), /bad day/);
});

test('an archive of another commune, instance or schema is not read', () => {
  const { archive } = recordCartdsBoards(emptyCartdsArchive(MAMP, '13114'), {
    [CARTDS_BOARDS.decisions]: [DECISION],
  }, '2026-09-30');
  const stored = JSON.parse(JSON.stringify(archive));
  assert.deepEqual(readCartdsArchive(stored, MAMP, '13114'), { archive, usable: true });
  // No file yet is an empty archive that may be written.
  assert.equal(readCartdsArchive(null, MAMP, '13114').usable, true);
  assert.equal(readCartdsArchive(undefined, MAMP, '13114').archive.rows.length, 0);
  for (const wrong of [
    { ...stored, schema: CARTDS_ARCHIVE_SCHEMA + 1 },
    { ...stored, insee: '13113' },
    { ...stored, instance: 'ccbr' },
    { ...stored, rows: 'nope' },
    'garbage',
  ]) {
    const answer = readCartdsArchive(wrong, MAMP, '13114');
    assert.equal(answer.usable, false);
    assert.equal(answer.archive.rows.length, 0);
  }
  // A malformed row is dropped, the rest kept.
  const damaged = { ...stored, rows: [...stored.rows, { board: '9', cells: [], first: 'x', last: 'y' }] };
  assert.equal(readCartdsArchive(damaged, MAMP, '13114').archive.rows.length, 1);
});

test('two copies of one commune join into the archive both would have written', () => {
  const base = emptyCartdsArchive(MAMP, '13114');
  const here = recordCartdsBoards(base, { [CARTDS_BOARDS.decisions]: [DECISION] }, '2026-10-02').archive;
  let there = recordCartdsBoards(base, {
    [CARTDS_BOARDS.filings]: [FILING],
    [CARTDS_BOARDS.decisions]: [DECISION],
  }, '2026-09-30').archive;
  there = recordCartdsBoards(there, { [CARTDS_BOARDS.decisions]: [DECISION] }, '2026-10-01').archive;
  const joined = unionCartdsArchives(here, there);
  assert.equal(joined.rows.length, 2);
  assert.equal(joined.firstDay, '2026-09-30');
  assert.equal(joined.lastDay, '2026-10-02');
  assert.equal(joined.days, 2);
  const decision = joined.rows.find((row) => row.board === '2');
  assert.deepEqual([decision.first, decision.last], ['2026-09-30', '2026-10-02']);
  assert.throws(() => unionCartdsArchives(here, emptyCartdsArchive(MAMP, '13113')), /cannot join/);
});

test('the archive day is the day in France, whatever the server’s zone', () => {
  // 00:30 in Paris on 30 September is still the 29th in UTC.
  assert.equal(cartdsDay(new Date('2026-09-29T22:30:00Z')), '2026-09-30');
  assert.equal(cartdsDay(new Date('2026-12-31T22:59:00Z')), '2026-12-31');
  assert.equal(cartdsDay(new Date('2026-12-31T23:00:00Z')), '2027-01-01');
});
