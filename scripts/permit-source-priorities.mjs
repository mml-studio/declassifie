#!/usr/bin/env node
/**
 * Population-first municipal permit research, against the current registries.
 * This command only reports priorities; it never registers a source.
 *
 * npm run permits:priorities -- --exclude 31555 --out .context/priorities.json
 * Optional: --communes <Geo-API-JSON> --candidates <JSON-array> --minimum 50000
 * Candidates: {key, url, communes: [INSEE], verified, latestPublication}.
 * `verified` means a public, placeable planning item was checked; a filing
 * portal, general legal board or protected endpoint is not verified.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { CARTDS_INSTANCES } from '../src/data/cartdsFeed.js';
import { SIRAP_INSTANCES } from '../src/data/sirapFeed.js';
import { EPERMIS_INSTANCES } from '../src/data/epermisFeed.js';
import { LOCAL_ADS_PORTALS } from '../src/data/adsFeed.js';
import { PUBLICATION_ACTES_COMMUNES } from '../src/data/publicationActesFeed.js';
import { PERMIT_LISTS } from '../src/data/permitListsFeed.js';
import { permitSourcePriorities } from './lib/permitSourcePriorities.mjs';

const { values } = parseArgs({ options: {
  communes: { type: 'string' }, candidates: { type: 'string' }, out: { type: 'string' },
  exclude: { type: 'string', multiple: true }, minimum: { type: 'string', default: '50000' },
  day: { type: 'string', default: new Date().toISOString().slice(0, 10) },
} });
const minimumPopulation = Number(values.minimum);
if (!Number.isFinite(minimumPopulation) || minimumPopulation < 0) throw new Error('--minimum must be a non-negative population');
if (!/^\d{4}-\d{2}-\d{2}$/.test(values.day) || new Date(`${values.day}T00:00:00Z`).toISOString().slice(0, 10) !== values.day) throw new Error('--day must be a valid YYYY-MM-DD');
let communes;
if (values.communes) communes = JSON.parse(await readFile(values.communes, 'utf8'));
else {
  const response = await fetch('https://geo.api.gouv.fr/communes?fields=nom,code,codeEpci,population&format=json', {
    headers: { 'User-Agent': 'Surplomb/1.0 (+https://github.com/mml-studio/surplomb)' }, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Geo API: HTTP ${response.status}`);
  communes = await response.json();
}
const candidates = values.candidates ? JSON.parse(await readFile(values.candidates, 'utf8')) : [];
const report = permitSourcePriorities(communes, [
  ...CARTDS_INSTANCES, ...SIRAP_INSTANCES, ...EPERMIS_INSTANCES,
  ...LOCAL_ADS_PORTALS, ...PUBLICATION_ACTES_COMMUNES, ...PERMIT_LISTS,
], { minimumPopulation, excluded: values.exclude ?? [], candidates, day: values.day });
// Montpellier's annual open-data export and national Sitadel are not current
// municipal boards and intentionally do not remove a city from this queue.
if (values.out) await writeFile(values.out, `${JSON.stringify(report, null, 2)}\n`);
else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (values.out) console.log(`${report.coverage.municipalities} municipalities, ${report.coverage.population} residents (${report.coverage.percentage.toFixed(4)}%); ${report.towns.length} town priorities, ${report.intermunicipalities.length} intermunicipal priorities; verified new residents: ${report.verifiedAdditionalPopulation}`);
