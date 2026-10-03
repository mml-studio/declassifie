import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALUIRE_BOARD_PROTOCOLS, readCaluireRegister } from './caluirePermitBoard.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { normalisePermitListRow } from './permitListsFeed.js';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPermitCity } from '../../scripts/lib/permitLists.mjs';
const city = BOARD_PERMIT_SOURCES.find((c) => c.key === 'caluire-et-cuire');
const options = { since: '2026-09-01', day: '2026-10-03' };
const file = { board: 'decisions', published: '2026-09-29', asOf: options.day };
const run = (text, x, y) => ({ text, x, x1: x + 5, y, size: 4 });
function table() {
  return { pages: [{ runs: [run('Type', 78, 632), run('adresse', 553, 632), run('pétitionnaire', 440, 632),
    run('DP', 78, 617), run('26', 103, 617), run('200', 127, 617), run('22/06/26', 149, 617),
    run('Roof renovation', 216, 617), run('PRIVATE PERSON', 430, 617), run('PRIVATE ADDRESS', 462, 617),
    run('Rue', 507, 617), run('Exemple', 554, 617), run('12', 605, 617), run('AB', 630, 617),
    run('0012', 666, 617), run('Sans suite', 704, 617), run('16/09/26', 739, 617), run('29/09/26', 764, 617)] }] };
}
test('Caluire discovers dated planning scans only on the municipal document path', () => {
  const link = (date, prefix = new URL(city.page).origin, title = "Avis des dépôts d'autorisation d'urbanisme") =>
    `<a href="${prefix}/fichiers/documents/vie_municipale_citoyennete/affichage_reglementaire/2-urbanisme/list.pdf">${title} - Publication du ${date}</a>`;
  const found = CALUIRE_BOARD_PROTOCOLS['caluire-register'].index(city,
    link('29/09/26') + link('31/08/26') + link('04/10/26') + link('29/09/26', 'https://other.example')
    + link('29/09/26', undefined, 'Public meeting'), {}, options);
  assert.equal(found.files.length, 1);
  assert.equal(found.files[0].scan, true);
  assert.equal(found.files[0].published, '2026-09-29');
  assert.deepEqual(found.files[0].ocrTypeColumn, { left: 68, right: 84, yearLeft: 96, yearRight: 112 });
});
test('Caluire builds a local dossier from printed family/year/counter and preserves explicit negative states', () => {
  const [row] = readCaluireRegister(table(), { city, file });
  assert.equal(row.dossier, 'DP 069034 26 00200');
  assert.equal(row.address, '12 Rue Exemple');
  assert.equal(row.parcels, 'AB 12');
  assert.equal(normalisePermitListRow(city, 'decisions', row).state, 'annule');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|PERSON|ADDRESS/);
});
test('Caluire withholds unread families, counters and changed columns; future dates stay null', () => {
  for (const text of ['DP', '200', 'adresse', 'pétitionnaire']) {
    const d = table();
    d.pages[0].runs = d.pages[0].runs.filter((r) => r.text !== text);
    assert.equal(readCaluireRegister(d, { city, file }).length, 0, text);
  }
  const d = table();
  d.pages[0].runs.find((r) => r.text === '16/09/26').text = '16/10/26';
  assert.equal(readCaluireRegister(d, { city, file })[0].decidedOn, null);
});
test('only the background collector downloads Caluire scans and receives bounded type-cell OCR', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'caluire-board-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const url = `${new URL(city.page).origin}/fichiers/documents/vie_municipale_citoyennete/affichage_reglementaire/2-urbanisme/list.pdf`;
  const html = `<a href="${url}">Avis des délivrances d'autorisation d'urbanisme - Publication du 29/09/26</a>`;
  const calls = [];
  const http = { fetch: async (url) => { calls.push(url); return { ok: true }; },
    text: async () => html, bytes: async () => new TextEncoder().encode('%PDF-1.4') };
  let ocrOptions;
  const ocr = async (bytes, options) => { ocrOptions = options; return { document: table() }; };
  const visitor = await readPermitCity(city, http, { dir, ocr, day: options.day });
  assert.deepEqual(calls, [city.page]);
  assert.equal(visitor.pendingOcr, 1);
  assert.equal(ocrOptions, undefined);
  const sweep = await readPermitCity(city, http, { dir, ocr, day: options.day, background: true });
  assert.equal(sweep.boards.decisions.length, 1);
  assert.equal(ocrOptions.positioned, true);
  assert.deepEqual(ocrOptions.typeColumn, { left: 77, right: 91, yearLeft: 96, yearRight: 112 });
  for (const path of await readdir(dir, { recursive: true })) if (path.endsWith('.json')) {
    assert.doesNotMatch(await readFile(join(dir, path), 'utf8'), /PRIVATE|PERSON|ADDRESS/);
  }
});
