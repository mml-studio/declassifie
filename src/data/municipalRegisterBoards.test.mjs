import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MUNICIPAL_REGISTER_PROTOCOLS as protocols, readAiffresRegister, readBryRegister,
  readRaphaelRegister, readScionzierRegister } from './municipalRegisterBoards.js';
import { BOARD_PERMIT_SOURCES } from './permitBoardCities.js';
import { boardProtocol } from './permitBoards.js';
import { normalisePermitListRow, permitListFor } from './permitListsFeed.js';
import { readPermitCity } from '../../scripts/lib/permitLists.mjs';

const city = (key) => BOARD_PERMIT_SOURCES.find((item) => item.key === key);
const options = { since: '2026-09-01', day: '2026-10-03' };
const run = (text, x, y, size = 8) => ({ text, x, y, x1: x + text.length * size / 2, size });
const doc = (runs) => ({ pages: [{ runs }] });
const file = (board) => ({ board, published: '2026-09-29', asOf: options.day });

test('four municipalities resolve through the existing permit registry without duplicate coverage', () => {
  for (const key of ['bry-sur-marne', 'saint-raphael', 'scionzier', 'aiffres']) {
    const c = city(key);
    assert.equal(permitListFor(c.insee), c);
    assert.equal(boardProtocol(c), protocols[key]);
  }
});

test('Aiffres uses its stable publisher runtime links and exact posting dates, excluding other CDNs and stale lists', () => {
  const c = city('aiffres');
  const url = 'https://cdn.website-editor.net/s/2a96eec688514d96ac7ad6bc097f71c1/files/uploaded/list.pdf';
  const link = (title, href = url, attrs = '') => `<a href="${href}" ${attrs}>${title}</a>`;
  const found = protocols.aiffres.index(c, link("Liste des demandes d'urbanisme au 02 octobre 2026", `${url}?Signature=temporary`, `runtime_url="${url}"`)
    + link("Liste des arr&ecirc;t&eacute;s d'urbanisme au 14 septembre 2026")
    + link("Liste des demandes d'urbanisme au 31 août 2026")
    + link("Liste des demandes d'urbanisme au 04 octobre 2026")
    + link("Liste des demandes d'urbanisme au 02 octobre 2026", 'https://other.example/list.pdf'), { url: c.page }, options);
  assert.deepEqual(found.files.map((item) => [item.board, item.published, item.url]), [
    ['filings', '2026-10-02', url], ['decisions', '2026-09-14', url],
  ]);
  assert.equal(found.files[0].requestUrl, `${url}?Signature=temporary`);
  assert.ok(found.files.every((item) => !item.url.includes('Signature')));
  assert.equal(protocols.aiffres.index(c, '<html>Login</html>', { url: c.page }, options), null);
});

test('the collector fetches signed Aiffres downloads but persists only the stable edition URL', async (t) => {
  const c = city('aiffres');
  const url = 'https://cdn.website-editor.net/s/2a96eec688514d96ac7ad6bc097f71c1/files/uploaded/list.pdf';
  const html = `<a href="${url}?Signature=temporary" runtime_url="${url}">Liste des demandes d'urbanisme au 02 octobre 2026</a>`;
  const dir = await mkdtemp(join(tmpdir(), 'surplomb-register-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  const http = { fetch: async (request) => { calls.push(request); return { ok: true, headers: { get: () => null } }; },
    text: async () => html, bytes: async () => new TextEncoder().encode('%PDF-1.4') };
  const result = await readPermitCity(c, http, { dir, day: options.day, months: 2 });
  assert.deepEqual(calls, [c.page, `${url}?Signature=temporary`]);
  assert.equal(result.lists[0].url, url);
  assert.doesNotMatch(JSON.stringify(result), /Signature|temporary/);
  const paths = await readdir(dir, { recursive: true });
  const cached = await Promise.all(paths.filter((path) => path.endsWith('.json')).map((path) => readFile(join(dir, path), 'utf8')));
  assert.equal(cached.length, 1);
  assert.doesNotMatch(cached.join('\n'), /Signature|temporary/);
  assert.equal(JSON.parse(cached[0]).url, url);
});

test('Saint-Raphaël revalidates rolling lists and excludes unrelated documents and origins', () => {
  const c = city('saint-raphael');
  const link = (title, url = '/fileadmin/ARBORESCENCE/UTILE/Urbanisme/Depots_et_decisions/current.pdf') => `<a href="${url}">${title}</a>`;
  const found = protocols['saint-raphael'].index(c, link('Permis de construire accordés')
    + link('Dépôt de demande de Déclaration préalable', '/fileadmin/ARBORESCENCE/UTILE/Urbanisme/Depots_et_decisions/filings.pdf')
    + link('Plan local d’urbanisme') + link('Permis de construire accordés', 'https://other.example/list.pdf'), { url: c.page }, options);
  assert.deepEqual(found.files.map((item) => [item.board, item.rolling]), [['decisions', true], ['filings', true]]);
  assert.ok(found.files.every((item) => !item.published));
});

test('Bry discovers dated municipal scans, preserves the collection window and requests rotation', () => {
  const c = city('bry-sur-marne');
  const html = ['28.09.2026', '25.08.2026', '05.10.2026'].map((date) => `<a href="/app/uploads/Affichage-pour-la-semaine-du-${date}.pdf">Register</a>`).join('');
  const found = protocols['bry-sur-marne'].index(c, html, { url: c.page }, options);
  assert.equal(found.files.length, 1);
  assert.deepEqual([found.files[0].published, found.files[0].scan, found.files[0].ocrRotate], ['2026-09-28', true, 90]);
});

function aiffresNotice(verdict = 'Négatif') {
  return doc([run('Dossier', 72, 668), run('Terrain', 185, 668), run('Description', 298, 668), run('Décision', 412, 668),
    run('CU 79003 26 X0088', 72, 650), run('Dépôt le 14/09/2026', 72, 640), run('par PRIVATE PERSON', 72, 630),
    run('Terrain : AZ0014', 185, 655), run('sis 12 Route Exemple', 185, 645), run('Propriétaire : PRIVATE OWNER', 185, 635),
    run('Projet : Storage building', 298, 650), run('Signée le : 24/09/2026', 412, 650), run(`Nature de la décision : ${verdict}`, 412, 640)]);
}
test('Aiffres keeps the project site and decision, never the applicant or terrain owner', () => {
  const c = city('aiffres');
  const [row] = readAiffresRegister(aiffresNotice(), { city: c, file: file('decisions') });
  assert.deepEqual([row.address, row.parcels, row.filedOn, row.decidedOn, row.verdict],
    ['12 Route Exemple', 'AZ 14', '2026-09-14', '2026-09-24', 'Refus']);
  assert.equal(normalisePermitListRow(c, 'decisions', row).state, 'refuse');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE|PERSON|OWNER/);
  const [grant] = readAiffresRegister(aiffresNotice('Octroi'), { city: c, file: file('decisions') });
  assert.equal(normalisePermitListRow(c, 'decisions', grant).state, 'accorde');
  const notified = aiffresNotice('Octroi avec prescription');
  notified.pages[0].runs.push(run('Notifié le : 25/09/2026', 412, 630));
  assert.equal(readAiffresRegister(notified, { city: c, file: file('decisions') })[0].verdict, 'Accord');
  const unlocated = aiffresNotice();
  unlocated.pages[0].runs = unlocated.pages[0].runs.filter((item) => !/^sis |^Terrain :/.test(item.text));
  assert.equal(readAiffresRegister(unlocated, { city: c, file: file('decisions') }).length, 0);
});

test('Saint-Raphaël retains explicit refusals and amendments rather than assuming a grant from the page', () => {
  const c = city('saint-raphael');
  const document = doc([run('Numéro de dossier', 42, 371), run('Nom du demandeur', 153, 371), run('Adresse du projet', 267, 371),
    run('Nature des travaux', 430, 371), run('Parcelle', 603, 371), run('Avis et date de', 657, 371), run('Date premier', 742, 371),
    run('PC 83118 26 C0001 M02', 42, 300), run('PRIVATE PERSON', 153, 300), run('12 Rue Exemple', 267, 300),
    run('Clôture', 430, 300), run('AB0123', 603, 300), run('Défavorable', 657, 300), run('24/09/2026', 657, 285), run('29/09/2026', 742, 300)]);
  const [row] = readRaphaelRegister(document, { city: c, file: file('decisions') });
  assert.equal(row.dossier, 'PC 083118 26 C0001 M02');
  assert.equal(normalisePermitListRow(c, 'decisions', row).state, 'refuse');
  assert.equal(row.decidedOn, '2026-09-24');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE/);
});

function scionzierDocument() {
  return doc([run('Liste des avis de dépôt en date du 29 Septembre 2026', 200, 568), run('Numéro', 41, 531),
    run('Demandeur', 157, 531), run('Adresse', 225, 537), run('Parcelles', 281, 537),
    run('DP0742642600094', 13, 300), run('29/09/2026', 103, 300), run('PRIVATE PERSON', 147, 300),
    run('12 Rue Exemple', 215, 300), run('2640000N0223, 2640000N0224', 268, 300),
    run('Building extension', 331, 300), run('PRIVATE ARCHITECT', 480, 300), run('PRIVATE ADDRESS', 613, 300), run('28/09/2026', 792, 300)]);
}
test('Scionzier separates project parcels from applicant and architect columns and continues across pages', () => {
  const document = scionzierDocument();
  document.pages.push({ runs: [run('DP0742642600093', 13, 400), run('15 Rue Exemple', 215, 400), run('2640000N0225', 268, 400)] });
  const rows = readScionzierRegister(document, { city: city('scionzier'), file: file('filings') });
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].address, rows[0].parcels, rows[0].filedOn], ['12 Rue Exemple', 'N 223, N 224', '2026-09-28']);
  assert.equal(rows[1].address, '15 Rue Exemple');
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|ARCHITECT/);
});

function bryPage(board = 'filings', family = 'Permis de construire', number = 'PC 094 015 26 00022') {
  const decision = board === 'decisions';
  return { runs: [run(decision ? 'Liste des décisions' : 'Liste des avis de dépôt', 360, 567), run(family, 30, 535),
    run(number, 32, 450), run('29/09/2026', 32, 440), run('21/09/2026', 134, 450),
    run('PRIVATE PERSON', 200, 450), run('12 Rue Exemple', decision ? 280 : 315, 450),
    run('Fence', decision ? 416 : 476, 450), ...(decision ? [run('Défavorable le 28/09/2026', 745, 450)] : [])] };
}
test('Bry reads mixed filing/decision pages, excludes ERP and refuses conflicting or unread dossier identities', () => {
  const document = { pages: [bryPage(), bryPage('decisions', 'Permis de construire', 'PC 094 015 26 00021'),
    bryPage('decisions', 'Autorisation ERP / IGH', 'AT 094 015 26 00001'),
    bryPage('filings', 'Permis de construire', 'PC 094 016 26 00022'),
    bryPage('filings', 'Permis de construire', 'PC 094 015 26 O0022')] };
  const rows = readBryRegister(document, { city: city('bry-sur-marne'), file: file('filings') });
  assert.deepEqual(rows.map((row) => row.board), ['filings', 'decisions']);
  assert.equal(rows[1].verdict, 'Refus');
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|PERSON|ERP/);
  const unread = bryPage('decisions');
  unread.runs.at(-1).text = 'F ble some 04/08/2026';
  assert.equal(readBryRegister({ pages: [unread] }, { city: city('bry-sur-marne'), file: file('decisions') })[0].verdict, 'Décision signée');
  unread.runs.at(-1).text = '; [Annulation le 21/08/2026';
  assert.equal(readBryRegister({ pages: [unread] }, { city: city('bry-sur-marne'), file: file('decisions') })[0].verdict, 'Retrait');
});

test('the board collector rotates only Bry scans, defers visitor OCR and retains each row’s own board', async () => {
  const c = city('bry-sur-marne');
  const html = '<a href="/app/uploads/Affichage-pour-la-semaine-du-28.09.2026.pdf">Register</a>';
  const calls = [];
  const http = { fetch: async (url) => { calls.push(url); return { ok: true, headers: { get: () => null }, text: async () => html }; },
    text: async () => html, bytes: async () => new TextEncoder().encode('%PDF-1.4') };
  const visitor = await readPermitCity(c, http, { day: options.day, months: 2 });
  assert.equal(visitor.pendingOcr, 1);
  assert.equal(calls.length, 1);
  const sweep = await readPermitCity(c, http, { day: options.day, months: 2, background: true, ocr: async (bytes, opts) => {
    assert.equal(opts.rotate, 90);
    assert.equal(opts.positioned, true);
    return { document: { pages: [bryPage(), bryPage('decisions')] } };
  } });
  assert.equal(sweep.boards.filings.length, 1);
  assert.equal(sweep.boards.decisions.length, 1);
  assert.equal(sweep.incomplete, false);
});
