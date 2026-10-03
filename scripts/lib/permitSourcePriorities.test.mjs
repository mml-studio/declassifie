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
