// What a plugged dataset's card line says in English.
//
// Two things move between the languages and nothing else does: the compacted
// weekday run, because `Mon–Fri` is the same fact as `lun–ven`, and the colon
// after a label, because French puts a space before it. The cell's own value
// never moves — it is what the register published.
import test from 'node:test';
import assert from 'node:assert/strict';

import { compactFrenchDays, datasetDetailLine, formatOpeningHours, weekdaysShort } from './datasetFields.js';
import { assertNoFrench, withLocale } from '../i18n/testing.js';

test('a French day column reads as an English run of days', () => {
  const cell = '{lundi,mardi,mercredi,jeudi,vendredi}';
  const detail = { field: 'c_disp_j', label: 'Days', format: 'days' };
  const english = withLocale('en', () => datasetDetailLine({ c_disp_j: cell }, detail));
  assert.equal(english, 'Days: Mon–Fri');
  assertNoFrench(english);
  assert.equal(datasetDetailLine({ c_disp_j: cell }, { ...detail, label: 'Jours' }), 'Jours : lun–ven');
});

test('what the compactor does not recognise survives in both languages', () => {
  // A GeoDAE day list legitimately holds `7j/7`: it is the register's word,
  // not ours, and dropping it would delete the unusual rows.
  assert.equal(withLocale('en', () => compactFrenchDays(['lundi', 'mardi', 'mercredi', '7j/7'])),
    'Mon–Wed, 7j/7');
  assert.equal(compactFrenchDays(['lundi', 'mardi', 'mercredi', '7j/7']), 'lun–mer, 7j/7');
});

test('the short weekdays are seven, Monday first, in both languages', () => {
  assert.deepEqual(withLocale('en', weekdaysShort),
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepEqual(weekdaysShort(), ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']);
});

test('the label keeps the manifest author’s word; only the colon moves', () => {
  const row = { p: '12' };
  const detail = { field: 'p', label: 'Power', unit: 'kW' };
  assert.equal(withLocale('en', () => datasetDetailLine(row, detail)), 'Power: 12 kW');
  assert.equal(datasetDetailLine(row, detail), 'Power : 12 kW');
});

test('an opening_hours value reads in English on an English page', () => {
  const english = withLocale('en', () => formatOpeningHours(
    'Mo-Th 07:30-17:00; Sa-Su off; PH off; Mo-Fr 00:00-23:59; Dec 24-Dec 25 off',
  ));
  assert.equal(english, 'Mon–Thu 07:30–17:00; Sat–Sun closed; holidays closed; Mon–Fri all day; Dec 24–Dec 25 closed');
  assertNoFrench(english);
  assert.equal(withLocale('en', () => formatOpeningHours('24/7')), '24/7');
});
