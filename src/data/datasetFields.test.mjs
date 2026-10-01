import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFieldLine,
  compactFrenchDays,
  datasetDetailLine,
  datasetFieldValues,
  fieldMatchKey,
  formatOpeningHours,
  parseListValue,
  rowMatchesWhen,
} from './datasetFields.js';

// The literals below are the real cells, copied from the GeoDAE resource for
// Lyon (2026-09-14). They are the whole reason this module exists, so the tests
// are written against them rather than against invented shapes.
const LYON_WEEKDAYS = '{lundi,mardi,mercredi,jeudi,vendredi}';
const LYON_UNKNOWN = '{"non renseigné"}';
const LYON_OFFICE_HOURS = '{"heures ouvrables"}';
const LYON_EVENTS = '{lundi,mardi,mercredi,jeudi,vendredi,samedi,événements}';

test('a Postgres array literal is unpacked, quotes and commas included', () => {
  assert.deepEqual(parseListValue(LYON_WEEKDAYS), ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']);
  assert.deepEqual(parseListValue(LYON_UNKNOWN), ['non renseigné']);
  assert.deepEqual(parseListValue('{"heures ouvrables","heures de nuit"}'), ['heures ouvrables', 'heures de nuit']);
  // A comma INSIDE a quoted item is part of the item, not a separator.
  assert.deepEqual(parseListValue('{"lundi, sauf férié",mardi}'), ['lundi, sauf férié', 'mardi']);
  assert.deepEqual(parseListValue('{a\\,b}'), ['a,b']);
  assert.deepEqual(parseListValue('{}'), []);
});

test('anything that is not a literal is a list of one, and an empty cell is a list of none', () => {
  assert.deepEqual(parseListValue('24h/24'), ['24h/24']);
  assert.deepEqual(parseListValue(['a', ' b ', '']), ['a', 'b']);
  assert.deepEqual(parseListValue(null), []);
  assert.deepEqual(parseListValue(''), []);
  assert.deepEqual(parseListValue('   '), []);
});

test('weekday runs compact, and everything else survives verbatim', () => {
  assert.equal(compactFrenchDays(parseListValue(LYON_WEEKDAYS)), 'lun–ven');
  assert.equal(compactFrenchDays(parseListValue(LYON_EVENTS)), 'lun–sam, événements');
  assert.equal(compactFrenchDays(['lundi', 'mercredi', 'vendredi']), 'lun, mer, ven');
  assert.equal(compactFrenchDays(['lundi', 'mardi', 'jeudi', 'vendredi', 'samedi']), 'lun, mar, jeu–sam');
  // Two adjacent days print as two days: a range the reader has to expand to
  // count is not shorter than the days themselves.
  assert.equal(compactFrenchDays(['lundi', 'mardi']), 'lun, mar');
  assert.equal(compactFrenchDays(['7j/7']), '7j/7');
  assert.equal(compactFrenchDays([]), '');
  // Source order does not matter; the week does.
  assert.equal(compactFrenchDays(['vendredi', 'lundi', 'mardi', 'mercredi', 'jeudi']), 'lun–ven');
});

test('a declared blank is an absence, whatever its case or accents', () => {
  const blank = new Set(['non renseigné'].map(fieldMatchKey));
  assert.deepEqual(datasetFieldValues({ j: LYON_UNKNOWN }, { field: 'j', format: 'list' }, blank), []);
  assert.deepEqual(datasetFieldValues({ j: '{"NON RENSEIGNE"}' }, { field: 'j', format: 'list' }, blank), []);
  // A row that holds a blank AND a real value keeps the real one.
  assert.deepEqual(
    datasetFieldValues({ j: '{"non renseigné","heures ouvrables"}' }, { field: 'j', format: 'list' }, blank),
    ['heures ouvrables'],
  );
});

test('a detail line is null when the field has nothing to say', () => {
  const blankKeys = new Set(['non renseigné'].map(fieldMatchKey));
  const row = {
    c_adr_voie: 'rue Garibaldi',
    c_disp_j: LYON_UNKNOWN,
    c_disp_h: LYON_OFFICE_HOURS,
    c_etat_fonct: 'En fonctionnement',
    c_acc_etg: null,
  };
  assert.equal(datasetDetailLine(row, { field: 'c_adr_voie', label: 'Voie' }, { blankKeys }), 'Voie : rue Garibaldi');
  assert.equal(datasetDetailLine(row, { field: 'c_disp_j', label: 'Jours', format: 'days' }, { blankKeys }), null);
  assert.equal(datasetDetailLine(row, { field: 'c_disp_h', label: 'Heures', format: 'list' }, { blankKeys }), 'Heures : heures ouvrables');
  assert.equal(datasetDetailLine(row, { field: 'c_acc_etg', label: 'Étage' }, { blankKeys }), null);
  assert.equal(datasetDetailLine(row, { field: 'absent', label: 'X' }, { blankKeys }), null);
});

test('omitWhen silences the majority spelling and prints every other one', () => {
  const detail = { field: 'c_etat_fonct', label: 'État', omitWhen: ['En fonctionnement'] };
  // 883 of the 888 Lyon rows: the line disappears.
  assert.equal(datasetDetailLine({ c_etat_fonct: 'En fonctionnement' }, detail), null);
  // The five that are not: the line is the only thing on the card that moved.
  assert.equal(datasetDetailLine({ c_etat_fonct: 'Hors service' }, detail), 'État : Hors service');
  assert.equal(datasetDetailLine({ c_etat_fonct: 'Absent momentanément' }, detail), 'État : Absent momentanément');
  assert.equal(datasetDetailLine({ c_etat_fonct: 'en fonctionnement' }, detail), null, 'the match ignores case');
});

test('a unit is appended and a long line is clamped', () => {
  assert.equal(datasetDetailLine({ p: '12' }, { field: 'p', label: 'Puissance', unit: 'kW' }), 'Puissance : 12 kW');
  const long = datasetDetailLine({ a: 'x'.repeat(200) }, { field: 'a', label: 'A' }, { max: 20 });
  assert.equal(long.length, 20);
  assert.match(long, /…$/);
  assert.equal(clampFieldLine('court', 20), 'court');
});

test('a when-clause reads a cell as a list, so an array literal matches a plain value', () => {
  assert.equal(rowMatchesWhen({ c_disp_h: '{24h/24}' }, { c_disp_h: ['24h/24'] }), true);
  assert.equal(rowMatchesWhen({ c_disp_h: LYON_OFFICE_HOURS }, { c_disp_h: ['24h/24'] }), false);
  assert.equal(rowMatchesWhen({ c_acc_lib: 't' }, { c_acc_lib: ['t'] }), true);
  assert.equal(rowMatchesWhen({ c_acc_lib: 'f' }, { c_acc_lib: ['t'] }), false);
  // Every named field must be satisfied, not just one of them.
  assert.equal(rowMatchesWhen({ a: '1', b: '2' }, { a: ['1'], b: ['2'] }), true);
  assert.equal(rowMatchesWhen({ a: '1', b: '3' }, { a: ['1'], b: ['2'] }), false);
  assert.equal(rowMatchesWhen({}, null), false);
});

// Real `c_dispo_horaires` cells, copied from the GeoDAE resource on 2026-10-01,
// the day the register replaced `c_disp_j` and `c_disp_h` with this column.
const GEODAE_ALWAYS = '24/7';
const GEODAE_UNKNOWN = 'Mo-Su off';
const GEODAE_OFFICE = 'Mo-Fr 09:00-12:00,14:00-18:00';
const GEODAE_WEEK = 'Mo-Th 07:30-17:00; Fr 07:30-16:00; Sa-Su off; PH off';
const GEODAE_ALL_DAY = 'Mo-Fr 00:00-23:59';
const GEODAE_EXCEPTIONS = 'Mo 09:00-17:00; Tu-Fr 08:00-17:00; Sa-Su off; PH off; Dec 15-Dec 31 off; Jul 20-Aug 15 off';

test('an opening_hours value reads as French days, times kept as published', () => {
  assert.equal(formatOpeningHours(GEODAE_ALWAYS), '24 h/24, 7 j/7');
  assert.equal(formatOpeningHours(GEODAE_OFFICE), 'lun–ven 09:00–12:00, 14:00–18:00');
  assert.equal(formatOpeningHours(GEODAE_WEEK), 'lun–jeu 07:30–17:00 ; ven 07:30–16:00 ; sam–dim fermé ; fériés fermé');
  assert.equal(formatOpeningHours(GEODAE_ALL_DAY), 'lun–ven 24 h/24');
  assert.equal(
    formatOpeningHours(GEODAE_EXCEPTIONS),
    'lun 09:00–17:00 ; mar–ven 08:00–17:00 ; sam–dim fermé ; fériés fermé ; 15 déc.–31 déc. fermé ; 20 juil.–15 août fermé',
  );
  assert.equal(formatOpeningHours(''), '');
  assert.equal(formatOpeningHours(null), '');
});

test('what the hours reader does not recognise is kept in place', () => {
  // A hyphen or a comma in the author's own words is theirs, not a range.
  assert.equal(formatOpeningHours('Mo-Fr 08:00-18:00 "sur rendez-vous, sauf août"'), 'lun–ven 08:00–18:00 "sur rendez-vous, sauf août"');
  assert.equal(formatOpeningHours('sunrise-sunset'), 'sunrise-sunset');
});

test('the register’s "Mo-Su off" is a blank, not a week of closed doors', () => {
  // 149 874 of 188 147 rows on 2026-10-01, and the same rows carry their hours
  // as free text in `c_disp_complt`. The manifest declares it blank.
  const blankKeys = new Set(['Mo-Su off', 'Mo-Su off; PH off'].map(fieldMatchKey));
  const detail = { field: 'h', label: 'Horaires', format: 'hours' };
  assert.equal(datasetDetailLine({ h: GEODAE_UNKNOWN }, detail, { blankKeys }), null);
  assert.equal(datasetDetailLine({ h: 'Mo-Su off; PH off' }, detail, { blankKeys }), null);
  assert.equal(datasetDetailLine({ h: GEODAE_ALWAYS }, detail, { blankKeys }), 'Horaires : 24 h/24, 7 j/7');
});
