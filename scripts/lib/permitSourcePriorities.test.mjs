import { test } from 'node:test';
import assert from 'node:assert/strict';
import { permitSourcePriorities } from './permitSourcePriorities.mjs';

const communes = [
  { code: '01001', nom: 'Covered city', population: 100000, codeEpci: 'A' },
  { code: '01002', nom: 'Large city', population: 60000, codeEpci: 'A' },
  { code: '01003', nom: 'Small city', population: 30000, codeEpci: 'A' },
  { code: '01004', nom: 'Second city', population: 80000, codeEpci: 'B' },
  { code: '01005', nom: 'Excluded city', population: 200000, codeEpci: 'B' },
  { code: '98701', nom: 'Outside scope', population: 999999, codeEpci: 'C' },
];
const sources = [{ insee: '01001', communes: ['01001'] }, { communes: ['01001', '99999'] }];

test('population priorities count registry unions and rank whole services above individual towns', () => {
  const report = permitSourcePriorities(communes, sources, { excluded: ['01005'] });
  assert.deepEqual(report.coverage, { municipalities: 1, population: 100000, denominator: 470000, percentage: 10000000 / 470000 });
  assert.deepEqual(report.towns.map((city) => city.code), ['01004', '01002']);
  assert.deepEqual(report.intermunicipalities.map((group) => [group.code, group.population]), [['A', 90000], ['B', 80000]]);
});

test('already integrated and overlapping candidates cannot inflate the verified population gain', () => {
  const report = permitSourcePriorities(communes, sources, { day: '2026-10-03', candidates: [
    { key: 'existing', communes: ['01001'], verified: true, latestPublication: '2026-10-01' },
    { key: 'shared', communes: ['01001', '01002', '01002', '01003'], verified: true, latestPublication: '2026-09-28' },
    { key: 'same-town', communes: ['01002'], verified: true, latestPublication: '2026-09-28' },
    { key: 'stale', communes: ['01004'], verified: true, latestPublication: '2022-07-25' },
    { key: 'future', communes: ['01004'], verified: true, latestPublication: '2026-10-04' },
    { key: 'generic-board', communes: ['01004'], verified: false, latestPublication: '2026-10-01' },
  ] });
  assert.equal(report.verifiedAdditionalPopulation, 90000);
  assert.equal(report.candidates[0].key, 'shared');
  assert.equal(report.candidates.find((item) => item.key === 'existing').verifiedPopulation, 0);
  for (const key of ['stale', 'future', 'generic-board']) assert.equal(report.candidates.find((item) => item.key === key).verifiedPopulation, 0);
});

test('checked towns stay out of town and shared-service queues without becoming covered', () => {
  const report = permitSourcePriorities(communes, sources, { day: '2026-10-03', excluded: ['01005'], research: [
    { code: '01002', checkedOn: '2026-10-02', revisitAfter: null, status: 'previously-checked', note: 'User confirmed earlier research.' },
    { code: '01003', checkedOn: '2026-10-02', revisitAfter: '2026-11-02', status: 'screened-unconfirmed' },
  ] });
  assert.deepEqual(report.towns.map((city) => city.code), ['01004']);
  assert.deepEqual(report.deferredTowns.map((city) => city.code), ['01002']);
  assert.equal(report.deferredTowns[0].previousResearch.note, 'User confirmed earlier research.');
  assert.deepEqual(report.intermunicipalities.map((group) => group.code), ['B']);
  assert.equal(report.coverage.population, 100000);
  assert.equal(report.coverage.municipalities, 1);
});

test('research holds use INSEE codes, expire on their date and can reopen explicitly', () => {
  const cities = [
    { code: '97411', nom: 'Saint-Denis', population: 155634, codeEpci: 'A' },
    { code: '93066', nom: 'Saint-Denis', population: 150000, codeEpci: 'B' },
    { code: '69259', nom: 'Vénissieux', population: 65502, codeEpci: 'C' },
  ];
  const research = [
    { code: '97411', checkedOn: '2026-10-03', revisitAfter: null },
    { code: '69259', checkedOn: '2026-10-02', revisitAfter: '2026-10-03' },
  ];
  const report = permitSourcePriorities(cities, [], { day: '2026-10-03', research });
  assert.deepEqual(report.towns.map((city) => city.code), ['93066', '69259']);
  assert.deepEqual(report.deferredTowns.map((city) => city.code), ['97411']);
  assert.equal(permitSourcePriorities(cities, [], { day: '2026-10-03', research, revisit: ['97411'] }).towns.length, 3);
  assert.deepEqual(permitSourcePriorities(cities, [], { day: '2026-10-03', research, revisit: ['97411'], excluded: ['97411'] }).towns.map((city) => city.code), ['93066', '69259']);
});

test('the latest research replaces earlier results and a fresh new source can still count', () => {
  const report = permitSourcePriorities(communes, sources, { day: '2026-10-03', research: [
    { code: '01002', checkedOn: '2026-10-03', revisitAfter: '2026-11-03', status: 'protected' },
    { code: '01002', checkedOn: '2026-10-01', revisitAfter: '2026-10-01', status: 'candidate' },
    { code: '01004', checkedOn: '2026-10-04', revisitAfter: null },
  ], candidates: [{ key: 'new-public-board', communes: ['01002'], verified: true, latestPublication: '2026-10-02' }] });
  assert.equal(report.deferredTowns[0].previousResearch.status, 'protected');
  assert.ok(report.towns.some((city) => city.code === '01004'));
  assert.equal(report.verifiedAdditionalPopulation, 60000);
});

test('malformed research cannot silently suppress a city', () => {
  for (const entry of [
    { code: 'Saint-Denis', checkedOn: '2026-10-03', revisitAfter: null },
    { code: '97411', checkedOn: '2026-02-30', revisitAfter: null },
    { code: '97411', checkedOn: '2026-10-03' },
    { code: '97411', checkedOn: '2026-10-03', revisitAfter: '2026-10-02' },
  ]) assert.throws(() => permitSourcePriorities(communes, sources, { research: [entry] }), /Research entries require/);
});
